import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Manifest } from 'material-icon-theme';

/** Recolorização de uma pasta: gera variante SVG (fechada + aberta) com novos tons. */
export type FolderRecolor = {
  name: string; // nome da pasta (folderNames)
  source: string; // ícone material base (sem .svg), ex.: 'folder-routes'
  color: string; // cor principal (path id="folder")
  tint: string; // tom claro (path id="motive")
};

/** routes -> rosa; resources -> lilás (paleta Material). */
export const FOLDER_RECOLORS: FolderRecolor[] = [
  {
    name: 'routes',
    source: 'folder-routes',
    color: '#ec407a',
    tint: '#f8bbd0',
  },
  {
    name: 'resources',
    source: 'folder-resource',
    color: '#ab47bc',
    tint: '#e1bee7',
  },
];

/** Pastas -> ícone material existente (reutiliza a arte da base). */
export const FOLDER_ICONS: Record<string, string> = {
  storage: 'folder-store',
  framework: 'folder-core',
  traits: 'folder-interface',
  observers: 'folder-event',
  http: 'folder-api',
  ai: 'folder-robot',
  support: 'folder-helper',
  factories: 'folder-mock',
  plans: 'folder-target',
  'media-library': 'folder-images',
  users: 'folder-client',
  // segundo lote (chaves em minúsculo — VSCode casa nomes de pasta sem case)
  clockwork: 'folder-tools',
  '.superpowers': 'folder-skills',
  '.claire': 'folder-robot',
  stubs: 'folder-template',
  maps: 'folder-mappings',
  location: 'folder-mappings',
  address: 'folder-mappings',
  bugs: 'folder-debug',
  thumb: 'folder-images',
  thumbs: 'folder-images',
  thumbnails: 'folder-images',
  sections: 'folder-layout',
  structure: 'folder-layout',
  menu: 'folder-layout',
  menus: 'folder-layout',
  pulse: 'folder-log',
  calendar: 'folder-event',
  component: 'folder-components',
  statistics: 'folder-benchmark',
  promotion: 'folder-cart',
  finance: 'folder-cart',
  list: 'folder-toc',
  lists: 'folder-toc',
  file: 'folder-content',
  station: 'folder-television',
  user: 'folder-client',
  automation: 'folder-flow',
  automations: 'folder-flow',
  planner: 'folder-tasks',
  messages: 'folder-messages',
  whatsapp: 'folder-messages',
  webhook: 'folder-hook',
  webhooks: 'folder-hook',
  // terceiro lote
  scope: 'folder-context',
  scopes: 'folder-context',
  agency: 'folder-client',
  action: 'folder-command',
  actions: 'folder-command',
  unit: 'folder-test',
  session: 'folder-secure',
  sessions: 'folder-secure',
  worktrees: 'folder-git',
  workflows: 'folder-flow',
  global_workflows: 'folder-flow',
  medialibrary: 'folder-images',
  request: 'folder-api',
  requests: 'folder-api',
  bank: 'folder-database',
  banks: 'folder-database',
  signature: 'folder-keys',
  signatures: 'folder-keys',
  price: 'folder-cart',
  prices: 'folder-cart',
  live: 'folder-television',
  lead: 'folder-client',
  leads: 'folder-client',
  protocol: 'folder-contract',
  protocols: 'folder-contract',
  prime: 'folder-ui',
  preset: 'folder-theme',
  // quarto lote — pastas reais dos projetos em ~/GitHub ainda sem ícone
  '.junie': 'folder-robot',
  '.antigravitycli': 'folder-robot',
  '.adonisjs': 'folder-node',
  openai: 'folder-robot',
  mcp: 'folder-plugin',
  references: 'folder-docs',
  superpowers: 'folder-skills',
  sdd: 'folder-flow',
  socialmedia: 'folder-messages',
  social_media: 'folder-messages',
  supportchat: 'folder-messages',
  concessionaire: 'folder-client',
  institution: 'folder-client',
  solarcompany: 'folder-client',
  solar_company: 'folder-client',
  usersolarcompanies: 'folder-client',
  equipment: 'folder-tools',
  equipments: 'folder-tools',
  electrical: 'folder-tools',
  userstores: 'folder-store',
  pagelayout: 'folder-layout',
  bottommenu: 'folder-layout',
  popovers: 'folder-components',
  dashboard: 'folder-admin',
  category: 'folder-content',
  cashaccount: 'folder-database',
  scheduler: 'folder-tasks',
  planners: 'folder-tasks',
  inertiapages: 'folder-views',
  functional: 'folder-test',
  exceptions: 'folder-error',
  anticaptcha: 'folder-secure',
};

/** Substitui os fills dos paths id="folder" (cor) e id="motive" (tom claro). */
export function recolorSvg(svg: string, color: string, tint: string): string {
  return svg
    .replace(/(id="folder"\s+fill=")#[0-9a-fA-F]{6}(")/, `$1${color}$2`)
    .replace(/(id="motive"\s+fill=")#[0-9a-fA-F]{6}(")/, `$1${tint}$2`);
}

/**
 * Aplica os overrides customizados sobre o theme já montado:
 * 1) recolore routes/resources (gera SVGs mbip-folder-<name>[-open].svg);
 * 2) mapeia as pastas de FOLDER_ICONS para ícones material existentes.
 * Escreve os SVGs recoloridos em iconsDir e muta `theme`. Retorna problemas.
 */
export function applyOverrides(theme: Manifest, iconsDir: string): string[] {
  const t: any = theme;
  const problems: string[] = [];
  t.iconDefinitions ??= {};
  t.folderNames ??= {};
  t.folderNamesExpanded ??= {};

  for (const r of FOLDER_RECOLORS) {
    for (const variant of ['', '-open']) {
      const srcFile = join(iconsDir, `${r.source}${variant}.svg`);
      if (!existsSync(srcFile)) {
        problems.push(
          `recolor ${r.name}: origem ausente ${r.source}${variant}.svg`
        );
        continue;
      }
      const outName = `mbip-folder-${r.name}${variant}.svg`;
      writeFileSync(
        join(iconsDir, outName),
        recolorSvg(readFileSync(srcFile, 'utf8'), r.color, r.tint)
      );
      t.iconDefinitions[`mbip-folder-${r.name}${variant}`] = {
        iconPath: `icons/${outName}`,
      };
    }
    t.folderNames[r.name] = `mbip-folder-${r.name}`;
    t.folderNamesExpanded[r.name] = `mbip-folder-${r.name}-open`;
  }

  for (const [name, icon] of Object.entries(FOLDER_ICONS)) {
    if (!t.iconDefinitions[icon]) {
      problems.push(`folderIcon ${name}: def material ausente ${icon}`);
      continue;
    }
    t.folderNames[name] = icon;
    t.folderNamesExpanded[name] = t.iconDefinitions[`${icon}-open`]
      ? `${icon}-open`
      : icon;
  }

  return problems;
}

/** Recolor de ícone de ARQUIVO por nome (manifesto verde, lock vermelho). */
export type FileRecolor = {
  fileName: string; // chave em fileNames (ex.: 'package.json')
  color: string; // cor alvo
  from?: string; // ícone base já no tema (sem .svg), ex.: 'nodejs'
  si?: string; // slug simple-icons (logo monocromático) — alternativa a `from`
  path?: string; // path SVG cru (viewBox 0 0 24 24) — alternativa a `from`/`si`
};

const GREEN = '#4caf50';
const RED = '#e53935';
const LILAC = '#b39ddb'; // lilás suave (Material Deep Purple 200)

// Caixa/pacote limpa (Material "inventory_2") — legível a 16px; o furo do slot
// é feito por winding oposto do subpath. Manifesto verde / lock vermelho, mesma
// silhueta (mesma abordagem de package.json vs package-lock.json).
const BOX_PATH =
  'M20 2H4c-1.11 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z';

export const FILE_RECOLORS: FileRecolor[] = [
  { fileName: 'package.json', from: 'nodejs', color: GREEN },
  { fileName: 'package-lock.json', from: 'nodejs', color: RED },
  { fileName: 'composer.json', path: BOX_PATH, color: GREEN },
  { fileName: 'composer.lock', path: BOX_PATH, color: RED },
  { fileName: 'vite.config.ts', from: 'vite', color: LILAC },
];

/** Troca todos os fills de um SVG por uma única cor. */
export function recolorAllFills(svg: string, color: string): string {
  return svg.replace(/fill="#[0-9a-fA-F]{3,8}"/g, `fill="${color}"`);
}

/**
 * Gera ícones de arquivo recoloridos (FILE_RECOLORS) e mapeia em fileNames.
 * `from` recolore um ícone base do tema; `si` colore um logo do simple-icons.
 */
export function applyFileRecolors(theme: Manifest, iconsDir: string): string[] {
  const t: any = theme;
  const problems: string[] = [];
  t.iconDefinitions ??= {};
  t.fileNames ??= {};

  let siMap: Record<string, { path: string }> | null = null;
  const getSi = (slug: string) => {
    if (!siMap) {
      siMap = {};
      const m = require('simple-icons');
      for (const k of Object.keys(m)) {
        const i = m[k];
        if (i?.slug) siMap[i.slug] = { path: i.path };
      }
    }
    return siMap[slug];
  };

  for (const r of FILE_RECOLORS) {
    let svg: string;
    if (r.from) {
      const src = join(iconsDir, `${r.from}.svg`);
      if (!existsSync(src)) {
        problems.push(`file-recolor ${r.fileName}: base ${r.from}.svg ausente`);
        continue;
      }
      svg = recolorAllFills(readFileSync(src, 'utf8'), r.color);
    } else if (r.si) {
      const icon = getSi(r.si);
      if (!icon) {
        problems.push(`file-recolor ${r.fileName}: si ${r.si} ausente`);
        continue;
      }
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}" fill="${r.color}"/></svg>`;
    } else if (r.path) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${r.path}" fill="${r.color}"/></svg>`;
    } else {
      continue;
    }
    const safe = r.fileName.replace(/[^\w.-]/g, '_').toLowerCase();
    const file = `mbip-file-${safe}.svg`;
    writeFileSync(join(iconsDir, file), svg);
    t.iconDefinitions[`mbip-file-${safe}`] = { iconPath: `icons/${file}` };
    t.fileNames[r.fileName] = `mbip-file-${safe}`;
  }
  return problems;
}
