import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyBrandFileIcons,
  applyBrandIcons,
  type RecItem,
} from './lib/brand-icons';
import { buildTheme, validateTheme } from './lib/build-theme';
import { computeGaps } from './lib/compute-gaps';
import { applyFileRecolors, applyOverrides } from './lib/custom-overrides';
import { generateIcons } from './lib/generate-icons';
import {
  loadMaterialManifest,
  materialCoverage,
  materialIconsDir,
} from './lib/material-base';
import { parseAfileicon } from './lib/parse-afileicon';
import { parseColours } from './lib/parse-colours';
import { parseConfigCson } from './lib/parse-config-cson';
import { parseIconsLess } from './lib/parse-icons-less';
import { renderReport } from './lib/report';

const THIS_DIR = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(THIS_DIR, '../..');
const ATOM = join(ROOT, 'atom-master');
const AFI = join(ROOT, 'AFileIcon-master');
const OUT = join(ROOT, 'dist-theme');
const OUT_ICONS = join(OUT, 'icons');

async function main() {
  mkdirSync(OUT_ICONS, { recursive: true });

  // Parsers
  const colours = await parseColours(join(ATOM, 'styles/colours.less'));
  const glyphs = parseIconsLess(
    readFileSync(join(ATOM, 'styles/icons.less'), 'utf8')
  );
  const atom = parseConfigCson(join(ATOM, 'config.cson'));
  const afi = parseAfileicon(join(AFI, 'icons/icons.json'));
  const afiColors = new Map<string, string>(
    Object.entries(
      JSON.parse(
        readFileSync(join(AFI, 'icons/colors.json'), 'utf8')
      ) as Record<string, string>
    )
  );

  // Base Material
  const base = loadMaterialManifest();
  const coverage = materialCoverage(base);
  const matIcons = materialIconsDir();

  // Lacunas
  const gaps = computeGaps({
    atom,
    afi,
    coverage,
    glyphs,
    colours,
    afiPngDir: join(AFI, 'icons/single'),
    afiColors,
  });

  // Copiar SVGs base do Material
  for (const f of readdirSync(matIcons)) {
    if (f.endsWith('.svg'))
      cpSync(join(matIcons, f), join(OUT_ICONS, basename(f)));
  }

  // Gerar novos ícones
  const generated = generateIcons(gaps, {
    fontsDir: join(ATOM, 'fonts'),
    pyScript: join(THIS_DIR, 'extract-glyph.py'),
    outDir: OUT_ICONS,
  });

  // Montar + overrides customizados (recolor + mapeamento de pastas) + validar
  const theme = buildTheme(base, generated);
  const overrideProblems = [
    ...applyOverrides(theme, OUT_ICONS),
    ...applyFileRecolors(theme, OUT_ICONS),
  ];

  // Ícones de marca/tecnologia recomendados (logo composto sobre pasta)
  const recItems = JSON.parse(
    readFileSync(join(THIS_DIR, 'data/recommended-icons.json'), 'utf8')
  ) as RecItem[];
  const brand = await applyBrandIcons(
    theme,
    OUT_ICONS,
    ROOT,
    recItems,
    join(THIS_DIR, 'extract-glyph.py')
  );
  console.log(
    `[run] marcas: ${brand.added.length} adicionadas, ${brand.skipped.length} puladas`
  );

  // Ícones de ARQUIVO (logo puro) para as marcas "cara de arquivo":
  // linguagens/frameworks/ferramentas/bancos/formatos (exclui marca/serviço/consumo).
  const notFileLike =
    /^(Marcas|Marcas\/Apps|SaaS\/Servi|Servicos|Web3|Mensageria|Extra)$/i;
  const fileLike = recItems.filter(
    (r) =>
      r.source === 'atom' ||
      r.source === 'afi' ||
      r.source === 'dev' ||
      !notFileLike.test(r.category)
  );
  const brandFiles = await applyBrandFileIcons(
    theme,
    OUT_ICONS,
    ROOT,
    fileLike,
    join(THIS_DIR, 'extract-glyph.py')
  );
  console.log(
    `[run] ícones de arquivo: ${brandFiles.added.length} adicionados, ${brandFiles.skipped.length} pulados`
  );

  const problems = [...overrideProblems, ...validateTheme(theme, OUT_ICONS)];
  if (problems.length) {
    console.error(`[run] ${problems.length} problemas de validação:`);
    for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
    process.exitCode = 1;
  }
  writeFileSync(
    join(OUT, 'max-big-icon-theme.json'),
    JSON.stringify(theme, null, 2)
  );

  // Relatório
  const skipped = gaps
    .filter((g) => !generated.some((x) => x.concept === g.concept))
    .map((g) => ({
      concept: g.concept,
      reason: g.source === 'atom' ? 'glifo não extraível/sem cor' : 'sem PNG',
    }));
  writeFileSync(
    join(ROOT, 'SUPPORTED_ICONS.md'),
    renderReport(generated, skipped)
  );

  console.log(
    `[run] adicionados: ${generated.length} | pulados: ${skipped.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
