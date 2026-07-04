// Gera example-dark.png e example-light.png: um mockup do explorer do VSCode
// com os ícones REAIS do tema, renderizado via Playwright.
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ICONS = join(ROOT, 'dist-theme', 'icons');
const theme = JSON.parse(
  readFileSync(join(ROOT, 'dist-theme', 'max-big-icon-theme.json'), 'utf8')
);

const iconFile = (def) => {
  const d = theme.iconDefinitions[def];
  return d ? join(ICONS, basename(d.iconPath)) : null;
};

// Embute o SVG como data URI (file:// é bloqueado no contexto do Playwright).
function dataUri(path) {
  if (!path) return '';
  const svg = readFileSync(path, 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function folderIcon(name, expanded) {
  const key = name.toLowerCase();
  const def =
    (expanded && theme.folderNamesExpanded[key]) ||
    theme.folderNames[key] ||
    (expanded ? 'folderExpanded' : 'folder');
  return iconFile(def) ?? iconFile(expanded ? 'folder-open' : 'folder');
}

function fileIcon(name) {
  const lower = name.toLowerCase();
  if (theme.fileNames[lower]) return iconFile(theme.fileNames[lower]);
  // maior extensão que casa (ex.: config.ts antes de ts)
  const parts = lower.split('.');
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.');
    if (theme.fileExtensions[ext]) return iconFile(theme.fileExtensions[ext]);
  }
  return iconFile(theme.file ?? 'file');
}

// Árvore realista de um projeto full-stack (mostra recolors, marcas e color-code)
// [nome, tipo, depth, expanded?]
const TREE = [
  ['meu-app', 'folder', 0, true],
  ['.github', 'folder', 1, true],
  ['workflows', 'folder', 2, false],
  ['src', 'folder', 1, true],
  ['components', 'folder', 2, false],
  ['routes', 'folder', 2, false],
  ['stores', 'folder', 2, false],
  ['http', 'folder', 2, false],
  ['composables', 'folder', 2, false],
  ['App.vue', 'file', 2],
  ['main.ts', 'file', 2],
  ['router.ts', 'file', 2],
  ['resources', 'folder', 1, false],
  ['storage', 'folder', 1, false],
  ['database', 'folder', 1, true],
  ['migrations', 'folder', 2, false],
  ['seeders', 'folder', 2, false],
  ['ai', 'folder', 1, false],
  ['.superpowers', 'folder', 1, false],
  ['tests', 'folder', 1, false],
  ['prisma', 'folder', 1, false],
  ['.env', 'file', 1],
  ['.gitignore', 'file', 1],
  ['composer.json', 'file', 1],
  ['composer.lock', 'file', 1],
  ['docker-compose.yml', 'file', 1],
  ['Dockerfile', 'file', 1],
  ['package.json', 'file', 1],
  ['package-lock.json', 'file', 1],
  ['README.md', 'file', 1],
  ['tailwind.config.js', 'file', 1],
  ['tsconfig.json', 'file', 1],
  ['vite.config.ts', 'file', 1],
];

const chevron = (expanded) =>
  `<svg class="chev" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="${expanded ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'}"/></svg>`;

function rows() {
  return TREE.map(([name, type, depth, expanded]) => {
    const icon =
      type === 'folder' ? folderIcon(name, !!expanded) : fileIcon(name);
    const pad = 8 + depth * 16;
    const chev = type === 'folder' ? chevron(!!expanded) : '<span class="chev"></span>';
    const cls = type === 'folder' ? 'row folder' : 'row';
    return `<div class="${cls}" style="padding-left:${pad}px">${chev}<img src="${dataUri(icon)}"><span>${name}</span></div>`;
  }).join('\n');
}

const THEMES = {
  dark: { bg: '#1e1e1e', fg: '#cccccc', folder: '#c8c8c8', title: '#bbbbbb', border: '#2b2b2b' },
  light: { bg: '#ffffff', fg: '#3b3b3b', folder: '#5c5c5c', title: '#6f6f6f', border: '#ececec' },
};

function html(t) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{background:${t.bg};font-family:-apple-system,"Segoe UI",Ubuntu,sans-serif;padding:0}
  .panel{width:340px}
  .head{color:${t.title};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:10px 14px 8px;border-bottom:1px solid ${t.border}}
  .row{display:flex;align-items:center;height:23px;color:${t.fg};font-size:13px;line-height:23px;cursor:default}
  .row:hover{background:rgba(128,128,128,.14)}
  .row.folder{color:${t.folder};font-weight:500}
  .row img{width:17px;height:17px;margin-right:6px;flex:none}
  .chev{width:16px;height:16px;margin-right:1px;flex:none;color:${t.folder};opacity:.7}
  .row:not(.folder) .chev{visibility:hidden}
  </style></head><body><div class="panel"><div class="head">Explorer</div>${rows()}</div></body></html>`;
}

const browser = await chromium.launch();
for (const [name, t] of Object.entries(THEMES)) {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(html(t), { waitUntil: 'networkidle' });
  const el = await page.$('.panel');
  await el.screenshot({ path: join(ROOT, 'assets', `example-${name}.png`) });
  await page.close();
  console.log(`gerado assets/example-${name}.png`);
}
await browser.close();
