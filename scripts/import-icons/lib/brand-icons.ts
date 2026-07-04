import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from 'material-icon-theme';
import { parseColours } from './parse-colours';
import { parseConfigCson } from './parse-config-cson';
import { parseIconsLess } from './parse-icons-less';

export type RecItem = { slug: string; source: string; category: string };

/** Logo já pronto para ser aninhado como motivo da pasta. */
type Logo =
  | { kind: 'svg'; viewBox: string; inner: string }
  | { kind: 'png'; dataUri: string }
  | null;

const DEF_PREFIX = 'mbip-';
const FALLBACK_COLOR = '#42a5f5';

/** Extrai viewBox e conteúdo interno de um markup <svg>…</svg>. */
function splitSvg(svg: string): { viewBox: string; inner: string } {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  return { viewBox: vb, inner };
}

type Sources = {
  siMap: Record<string, { path: string; hex: string }>;
  deviconDir: string;
  deviconVersions: Record<string, string[]>;
  atomGlyphs: ReturnType<typeof parseIconsLess>;
  atomColours: Map<string, string>;
  atomConceptColour: Map<string, string>;
  atomFontsDir: string;
  pyScript: string;
  afiPngDir: string;
};

function siLogo(s: Sources, slug: string): Logo {
  const icon = s.siMap[slug];
  if (!icon) return null;
  return {
    kind: 'svg',
    viewBox: '0 0 24 24',
    inner: `<path d="${icon.path}" fill="#${icon.hex}"/>`,
  };
}

/** Carrega o logo da fonte primária do item (sem fallback). */
function loadPrimary(item: RecItem, s: Sources): Logo {
  if (item.source === 'si') return siLogo(s, item.slug);
  if (item.source === 'dev') {
    const versions = s.deviconVersions[item.slug] ?? [];
    const variant =
      ['original', 'plain'].find((v) => versions.includes(v)) ?? versions[0];
    if (!variant) return null;
    const file = join(s.deviconDir, item.slug, `${item.slug}-${variant}.svg`);
    if (!existsSync(file)) return null;
    return { kind: 'svg', ...splitSvg(readFileSync(file, 'utf8')) };
  }
  if (item.source === 'atom') {
    const glyph = s.atomGlyphs.get(item.slug);
    if (!glyph || glyph.font === null) return null; // octicons -> fallback
    const colourName = s.atomConceptColour.get(item.slug);
    const hex = (colourName && s.atomColours.get(colourName)) || FALLBACK_COLOR;
    const safe = item.slug.replace(/[^\w.-]/g, '_');
    const tmp = join(tmpdir(), `mbip-glyph-${safe}.svg`);
    execFileSync('python3', [
      s.pyScript,
      join(s.atomFontsDir, glyph.font),
      glyph.codepoint.toString(16),
      hex,
      tmp,
    ]);
    const svg = readFileSync(tmp, 'utf8');
    rmSync(tmp, { force: true });
    return { kind: 'svg', ...splitSvg(svg) };
  }
  if (item.source === 'afi') {
    const png = join(s.afiPngDir, `file_type_${item.slug}.png`);
    if (!existsSync(png)) return null;
    const b64 = readFileSync(png).toString('base64');
    return { kind: 'png', dataUri: `data:image/png;base64,${b64}` };
  }
  return null;
}

/** Logo do item, com simple-icons como fallback universal quando a fonte falha. */
function loadLogo(item: RecItem, s: Sources): Logo {
  try {
    const primary = loadPrimary(item, s);
    if (primary) return primary;
    if (item.source !== 'si') return siLogo(s, item.slug);
    return null;
  } catch {
    return null;
  }
  return null;
}

const MOTIVE = { x: 5.7, y: 4.8, w: 8.8, h: 8.8 };

/** Força todos os preenchimentos de um markup SVG para branco (badge monocromático). */
function whitenInner(inner: string): string {
  const cleaned = inner
    // remove defs/gradientes/máscaras/clips/filtros (não usados no branco)
    .replace(/<defs[\s\S]*?<\/defs>/g, '')
    .replace(
      /<(linearGradient|radialGradient|mask|clipPath|filter)\b[\s\S]*?<\/\1>/g,
      ''
    )
    // remove refs que quebram sem o alvo (xlink/mask/clip/filter)
    .replace(/\s(xlink:href|mask|clip-path|filter)="[^"]*"/g, '')
    .replace(/fill="[^"]*"/g, 'fill="#fff"')
    .replace(/fill:\s*[^;"'}]+/g, 'fill:#fff')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#fff"');
  return `<g fill="#fff">${cleaned}</g>`;
}

/** `d` da forma da pasta (path id="folder" ou o primeiro path). */
function folderShapeD(svg: string): string {
  return (
    svg.match(/id="folder"[^>]*\sd="([^"]+)"/)?.[1] ??
    svg.match(/\sd="([^"]+)"/)?.[1] ??
    ''
  );
}

/** Cor do corpo da pasta = cor da marca (fallback azul Material). */
function brandColor(item: RecItem, s: Sources): string {
  const si = s.siMap[item.slug];
  if (item.source === 'atom') {
    const cn = s.atomConceptColour.get(item.slug);
    return (
      (cn && s.atomColours.get(cn)) || (si ? `#${si.hex}` : FALLBACK_COLOR)
    );
  }
  return si ? `#${si.hex}` : FALLBACK_COLOR;
}

/** Motivo da pasta = logo em BRANCO (ou PNG colorido do AFileIcon). */
function whiteMotive(item: RecItem, s: Sources): string | null {
  const { x, y, w, h } = MOTIVE;
  const wrap = (vb: string, inner: string) =>
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`;
  const si = s.siMap[item.slug];

  if (item.source === 'si' && si)
    return wrap('0 0 24 24', `<path fill="#fff" d="${si.path}"/>`);

  if (item.source === 'dev') {
    const versions = s.deviconVersions[item.slug] ?? [];
    const variant =
      ['original', 'plain'].find((v) => versions.includes(v)) ?? versions[0];
    const file =
      variant && join(s.deviconDir, item.slug, `${item.slug}-${variant}.svg`);
    if (file && existsSync(file)) {
      const { viewBox, inner } = splitSvg(readFileSync(file, 'utf8'));
      return wrap(viewBox, whitenInner(inner));
    }
  }

  if (item.source === 'atom') {
    const glyph = s.atomGlyphs.get(item.slug);
    if (glyph?.font) {
      const safe = item.slug.replace(/[^\w.-]/g, '_');
      const tmp = join(tmpdir(), `mbip-wglyph-${safe}.svg`);
      try {
        execFileSync('python3', [
          s.pyScript,
          join(s.atomFontsDir, glyph.font),
          glyph.codepoint.toString(16),
          '#ffffff',
          tmp,
        ]);
        const { viewBox, inner } = splitSvg(readFileSync(tmp, 'utf8'));
        rmSync(tmp, { force: true });
        return wrap(viewBox, inner);
      } catch {
        /* cai no fallback si abaixo */
      }
    }
  }

  if (item.source === 'afi') {
    const png = join(s.afiPngDir, `file_type_${item.slug}.png`);
    if (existsSync(png)) {
      const b64 = readFileSync(png).toString('base64');
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b64}"/>`;
    }
  }

  // fallback universal: logo branco do simple-icons
  if (si) return wrap('0 0 24 24', `<path fill="#fff" d="${si.path}"/>`);
  return null;
}

/** Pasta 16×16: corpo na cor da marca + motivo (logo branco) no canto inferior-direito. */
export function compositeFolder(
  shapeD: string,
  color: string,
  motive: string
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="${color}" d="${shapeD}"/>${motive}</svg>`;
}

export function loadSources(root: string, pyScript: string): Sources {
  const siModule = require('simple-icons');
  const siMap: Record<string, { path: string; hex: string }> = {};
  for (const k of Object.keys(siModule)) {
    const i = siModule[k];
    if (i?.slug) siMap[i.slug] = { path: i.path, hex: i.hex };
  }
  const deviconJson = require('devicon/devicon.json') as {
    name: string;
    versions: { svg: string[] };
  }[];
  const deviconVersions: Record<string, string[]> = {};
  for (const d of deviconJson) deviconVersions[d.name] = d.versions.svg;

  const atomColours = new Map<string, string>();
  const atomConceptColour = new Map<string, string>();
  return {
    siMap,
    deviconDir: join(root, 'node_modules/devicon/icons'),
    deviconVersions,
    atomGlyphs: parseIconsLess(
      readFileSync(join(root, 'atom-master/styles/icons.less'), 'utf8')
    ),
    atomColours,
    atomConceptColour,
    atomFontsDir: join(root, 'atom-master/fonts'),
    pyScript,
    afiPngDir: join(root, 'AFileIcon-master/icons/single'),
  };
}

/**
 * Gera ícones de pasta (logo composto sobre base) para os itens recomendados e
 * mapeia cada slug em folderNames + folderNamesExpanded. Muta `theme`, escreve
 * os SVGs em iconsDir. Retorna { added, skipped }.
 */
export async function applyBrandIcons(
  theme: Manifest,
  iconsDir: string,
  root: string,
  items: RecItem[],
  pyScript: string
): Promise<{ added: string[]; skipped: { slug: string; reason: string }[] }> {
  const t: any = theme;
  t.iconDefinitions ??= {};
  t.folderNames ??= {};
  t.folderNamesExpanded ??= {};

  const s = await prepareSources(root, pyScript);

  const closedD = folderShapeD(
    readFileSync(join(iconsDir, 'folder.svg'), 'utf8')
  );
  const openD = existsSync(join(iconsDir, 'folder-open.svg'))
    ? folderShapeD(readFileSync(join(iconsDir, 'folder-open.svg'), 'utf8'))
    : closedD;

  const added: string[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  for (const item of items) {
    const motive = whiteMotive(item, s);
    if (!motive) {
      skipped.push({
        slug: item.slug,
        reason: `logo indisponível (${item.source})`,
      });
      continue;
    }
    const color = brandColor(item, s);
    const safe = item.slug.replace(/[^\w.-]/g, '_').toLowerCase();
    const closedFile = `${DEF_PREFIX}folder-${safe}.svg`;
    const openFile = `${DEF_PREFIX}folder-${safe}-open.svg`;
    writeFileSync(
      join(iconsDir, closedFile),
      compositeFolder(closedD, color, motive)
    );
    writeFileSync(
      join(iconsDir, openFile),
      compositeFolder(openD, color, motive)
    );
    t.iconDefinitions[`${DEF_PREFIX}folder-${safe}`] = {
      iconPath: `icons/${closedFile}`,
    };
    t.iconDefinitions[`${DEF_PREFIX}folder-${safe}-open`] = {
      iconPath: `icons/${openFile}`,
    };
    t.folderNames[item.slug] = `${DEF_PREFIX}folder-${safe}`;
    t.folderNamesExpanded[item.slug] = `${DEF_PREFIX}folder-${safe}-open`;
    added.push(item.slug);
  }
  return { added, skipped };
}

/** Carrega Sources + popula as cores do atom (concept -> hex). */
export async function prepareSources(
  root: string,
  pyScript: string
): Promise<Sources> {
  const s = loadSources(root, pyScript);
  s.atomColours.clear();
  const cmap = await parseColours(
    join(root, 'atom-master/styles/colours.less')
  );
  for (const [k, v] of cmap) s.atomColours.set(k, v);
  for (const e of parseConfigCson(join(root, 'atom-master/config.cson'))) {
    if (e.colour && !s.atomConceptColour.has(e.concept))
      s.atomConceptColour.set(e.concept, e.colour);
  }
  return s;
}

/** Envolve um logo num SVG autônomo (para uso como ícone de ARQUIVO). */
function standaloneSvg(logo: Logo): string | null {
  if (logo?.kind === 'svg') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logo.viewBox}">${logo.inner}</svg>`;
  }
  if (logo?.kind === 'png') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image width="32" height="32" href="${logo.dataUri}"/></svg>`;
  }
  return null;
}

/**
 * Gera ícones de ARQUIVO (logo puro) para os itens e mapeia em fileNames +
 * fileExtensions (só quando o Material não já usa aquela chave — não-destrutivo).
 */
export async function applyBrandFileIcons(
  theme: Manifest,
  iconsDir: string,
  root: string,
  items: RecItem[],
  pyScript: string
): Promise<{ added: string[]; skipped: { slug: string; reason: string }[] }> {
  const t: any = theme;
  t.iconDefinitions ??= {};
  t.fileNames ??= {};
  t.fileExtensions ??= {};

  const s = await prepareSources(root, pyScript);
  const added: string[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  for (const item of items) {
    const svg = standaloneSvg(loadLogo(item, s));
    if (!svg) {
      skipped.push({
        slug: item.slug,
        reason: `logo indisponível (${item.source})`,
      });
      continue;
    }
    const safe = item.slug.replace(/[^\w.-]/g, '_').toLowerCase();
    const file = `${DEF_PREFIX}file-${safe}.svg`;
    writeFileSync(join(iconsDir, file), svg);
    const def = `${DEF_PREFIX}file-${safe}`;
    t.iconDefinitions[def] = { iconPath: `icons/${file}` };
    if (!t.fileNames[item.slug]) t.fileNames[item.slug] = def;
    if (!t.fileExtensions[item.slug]) t.fileExtensions[item.slug] = def;
    added.push(item.slug);
  }
  return { added, skipped };
}
