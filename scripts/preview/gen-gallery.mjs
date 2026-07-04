// Gera galerias PNG densas (grid de ícone + nome) com os ícones REAIS do tema.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ICONS = join(ROOT, 'dist-theme', 'icons');
const theme = JSON.parse(
  readFileSync(join(ROOT, 'dist-theme', 'max-big-icon-theme.json'), 'utf8')
);
const rec = JSON.parse(
  readFileSync(join(ROOT, 'scripts/import-icons/data/recommended-icons.json'), 'utf8')
);

const pathOf = (def) => {
  const d = def && theme.iconDefinitions[def];
  return d ? join(ICONS, basename(d.iconPath)) : null;
};
const dataUri = (p) =>
  p && existsSync(p)
    ? `data:image/svg+xml;base64,${Buffer.from(readFileSync(p, 'utf8')).toString('base64')}`
    : null;

function folderByName(name) {
  const def = theme.folderNames[name.toLowerCase()];
  if (!def || def === 'folder') return null;
  return pathOf(def);
}
function fileByName(name) {
  const lower = name.toLowerCase();
  if (theme.fileNames[lower]) return pathOf(theme.fileNames[lower]);
  const parts = lower.split('.');
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join('.');
    if (theme.fileExtensions[ext]) return pathOf(theme.fileExtensions[ext]);
  }
  return null;
}

// deixa o label mais legível
const pretty = (s) =>
  s
    .replace(/dotjs$/, '.js')
    .replace(/dotio$/, '.io')
    .replace(/dotcom$/, '.com')
    .replace(/dotnet$/, '.net')
    .replace(/dotch$/, '.ch')
    .replace(/dotpage$/, '.page')
    .replace(/dotdev$/, '.dev');

// slugs recomendados por categoria (todos viram folderNames -> resolvem)
function byCat(reFilter, cap) {
  const seen = new Set();
  const out = [];
  for (const r of rec) {
    if (!reFilter.test(r.category)) continue;
    const key = r.slug.toLowerCase();
    if (seen.has(key)) continue;
    if (!folderByName(r.slug)) continue;
    seen.add(key);
    out.push(r.slug);
    if (out.length >= cap) break;
  }
  return out;
}

// grupos de ARQUIVO (cada um vira gallery-files-<nome>.png)
const FILE_GROUPS = {
  languages: {
    title: '📄 Arquivos — linguagens de programação',
    items: [
      ['TypeScript', 'a.ts'], ['JavaScript', 'a.js'], ['Python', 'a.py'], ['Rust', 'a.rs'],
      ['Go', 'a.go'], ['Ruby', 'a.rb'], ['PHP', 'a.php'], ['Java', 'a.java'],
      ['Kotlin', 'a.kt'], ['Swift', 'a.swift'], ['C', 'a.c'], ['C++', 'a.cpp'],
      ['C#', 'a.cs'], ['Objective-C', 'a.m'], ['Dart', 'a.dart'], ['Elixir', 'a.ex'],
      ['Erlang', 'a.erl'], ['Elm', 'a.elm'], ['Zig', 'a.zig'], ['Nim', 'a.nim'],
      ['Crystal', 'a.cr'], ['Lua', 'a.lua'], ['Scala', 'a.scala'], ['Clojure', 'a.clj'],
      ['ClojureScript', 'a.cljs'], ['Haskell', 'a.hs'], ['PureScript', 'a.purs'], ['OCaml', 'a.ml'],
      ['F#', 'a.fs'], ['Reason', 'a.re'], ['ReScript', 'a.res'], ['Julia', 'a.jl'],
      ['R', 'a.r'], ['Perl', 'a.pl'], ['Raku', 'a.raku'], ['Groovy', 'a.groovy'],
      ['Solidity', 'a.sol'], ['Move', 'a.move'], ['Cairo', 'a.cairo'], ['Assembly', 'a.asm'],
      ['COBOL', 'a.cob'], ['Fortran', 'a.f90'], ['Pascal', 'a.pas'], ['Ada', 'a.adb'],
      ['D', 'a.d'], ['V', 'a.v'], ['Vala', 'a.vala'], ['Haxe', 'a.hx'],
      ['Tcl', 'a.tcl'], ['Racket', 'a.rkt'], ['Scheme', 'a.scm'], ['Lisp', 'a.lisp'],
      ['Prolog', 'a.pro'], ['Gleam', 'a.gleam'], ['Odin', 'a.odin'], ['Mojo', 'a.mojo'],
      ['Nix', 'a.nix'], ['VHDL', 'a.vhdl'], ['SystemVerilog', 'a.sv'], ['GLSL', 'a.glsl'],
      ['HLSL', 'a.hlsl'], ['WGSL', 'a.wgsl'], ['CUDA', 'a.cu'], ['WASM', 'a.wasm'],
      ['WAT', 'a.wat'], ['Bash', 'a.sh'], ['PowerShell', 'a.ps1'], ['Batch', 'a.bat'],
      ['Fish', 'a.fish'], ['Awk', 'a.awk'], ['Vim', 'a.vim'], ['Coq', 'a.coq'],
    ],
  },
  web: {
    title: '📄 Arquivos — web & frontend',
    items: [
      ['HTML', 'a.html'], ['CSS', 'a.css'], ['Sass', 'a.scss'], ['Sass', 'a.sass'],
      ['Less', 'a.less'], ['Stylus', 'a.styl'], ['PostCSS', 'a.pcss'], ['Vue', 'a.vue'],
      ['Svelte', 'a.svelte'], ['Astro', 'a.astro'], ['JSX', 'a.jsx'], ['TSX', 'a.tsx'],
      ['Angular', 'a.component.ts'], ['Riot', 'a.riot'], ['Marko', 'a.marko'], ['Pug', 'a.pug'],
      ['Haml', 'a.haml'], ['Slim', 'a.slim'], ['EJS', 'a.ejs'], ['Handlebars', 'a.hbs'],
      ['Mustache', 'a.mustache'], ['Liquid', 'a.liquid'], ['Nunjucks', 'a.njk'], ['Twig', 'a.twig'],
      ['Blade', 'a.blade.php'], ['ERB', 'a.erb'], ['Razor', 'a.cshtml'], ['MDX', 'a.mdx'],
      ['SVG', 'a.svg'], ['WebP', 'a.webp'], ['PNG', 'a.png'], ['Font', 'a.woff2'],
      ['GraphQL', 'a.graphql'], ['Storybook', 'a.stories.tsx'], ['Cypress', 'a.cy.ts'], ['Test', 'a.test.ts'],
    ],
  },
  data: {
    title: '📄 Arquivos — dados & formatos',
    items: [
      ['JSON', 'a.json'], ['JSON5', 'a.json5'], ['JSONC', 'a.jsonc'], ['YAML', 'a.yaml'],
      ['TOML', 'a.toml'], ['XML', 'a.xml'], ['CSV', 'a.csv'], ['TSV', 'a.tsv'],
      ['INI', 'a.ini'], ['Env', '.env'], ['Properties', 'a.properties'], ['GraphQL', 'a.graphql'],
      ['Protobuf', 'a.proto'], ['Avro', 'a.avsc'], ['Parquet', 'a.parquet'], ['SQL', 'a.sql'],
      ['Prisma', 'schema.prisma'], ['Markdown', 'a.md'], ['reST', 'a.rst'], ['AsciiDoc', 'a.adoc'],
      ['LaTeX', 'a.tex'], ['BibTeX', 'a.bib'], ['PDF', 'a.pdf'], ['Jupyter', 'a.ipynb'],
      ['NDJSON', 'a.ndjson'], ['GeoJSON', 'a.geojson'], ['Log', 'a.log'], ['Diff', 'a.diff'],
      ['HDF5', 'a.h5'], ['Excel', 'a.xlsx'], ['Binary', 'a.bin'], ['Certificate', 'a.pem'],
    ],
  },
  config: {
    title: '📄 Arquivos — config & tooling',
    items: [
      ['TS Config', 'tsconfig.json'], ['JS Config', 'jsconfig.json'], ['Editorconfig', '.editorconfig'], ['ESLint', '.eslintrc'],
      ['ESLint', 'eslint.config.js'], ['Prettier', '.prettierrc'], ['Stylelint', '.stylelintrc'], ['Babel', 'babel.config.js'],
      ['Browserslist', '.browserslistrc'], ['npmrc', '.npmrc'], ['nvmrc', '.nvmrc'], ['yarnrc', '.yarnrc'],
      ['package.json', 'package.json'], ['Vite', 'vite.config.ts'], ['Webpack', 'webpack.config.js'], ['Rollup', 'rollup.config.js'],
      ['esbuild', 'esbuild.config.js'], ['Tailwind', 'tailwind.config.js'], ['PostCSS', 'postcss.config.js'], ['Jest', 'jest.config.js'],
      ['Vitest', 'vitest.config.ts'], ['Cypress', 'cypress.config.js'], ['Playwright', 'playwright.config.ts'], ['Mocha', '.mocharc'],
      ['Karma', 'karma.conf.js'], ['Commitlint', '.commitlintrc'], ['Renovate', 'renovate.json'], ['Turbo', 'turbo.json'],
      ['Nx', 'nx.json'], ['Lerna', 'lerna.json'], ['SWC', '.swcrc'], ['Biome', 'biome.json'],
      ['Nodemon', 'nodemon.json'], ['Husky', '.huskyrc'], ['Lint-staged', '.lintstagedrc'], ['gitignore', '.gitignore'],
      ['gitattributes', '.gitattributes'], ['dockerignore', '.dockerignore'], ['npmignore', '.npmignore'], ['Lock', 'yarn.lock'],
    ],
  },
  build: {
    title: '📄 Arquivos — build, DevOps & meta',
    items: [
      ['Docker', 'Dockerfile'], ['Compose', 'docker-compose.yml'], ['Makefile', 'Makefile'], ['CMake', 'CMakeLists.txt'],
      ['Bazel', 'BUILD.bazel'], ['Gradle', 'build.gradle'], ['Maven', 'pom.xml'], ['Cargo', 'Cargo.toml'],
      ['Gemfile', 'Gemfile'], ['Rakefile', 'Rakefile'], ['pip', 'requirements.txt'], ['Pipenv', 'Pipfile'],
      ['Poetry', 'pyproject.toml'], ['Composer', 'composer.json'], ['Go mod', 'go.mod'], ['Mix', 'mix.exs'],
      ['Pubspec', 'pubspec.yaml'], ['Ansible', 'playbook.yml'], ['Terraform', 'a.tf'], ['HCL', 'a.hcl'],
      ['Helm', 'Chart.yaml'], ['K8s', 'deployment.yaml'], ['Vagrant', 'Vagrantfile'], ['Procfile', 'Procfile'],
      ['Nginx', 'nginx.conf'], ['Apache', '.htaccess'], ['Nix', 'flake.nix'], ['Jenkins', 'Jenkinsfile'],
      ['GitLab CI', '.gitlab-ci.yml'], ['Azure', 'azure-pipelines.yml'], ['Travis', '.travis.yml'], ['Netlify', 'netlify.toml'],
      ['Vercel', 'vercel.json'], ['Firebase', 'firebase.json'], ['Serverless', 'serverless.yml'], ['OpenAPI', 'openapi.yaml'],
      ['License', 'LICENSE'], ['Changelog', 'CHANGELOG.md'], ['Readme', 'README.md'], ['Contributing', 'CONTRIBUTING.md'],
      ['Codeowners', 'CODEOWNERS'], ['Security', 'SECURITY.md'], ['Robots', 'robots.txt'], ['Sitemap', 'sitemap.xml'],
    ],
  },
};

const GALLERIES = [
  ...Object.entries(FILE_GROUPS).map(([name, g]) => ({
    file: `gallery-files-${name}.png`,
    title: g.title,
    type: 'file',
    items: g.items,
  })),
  {
    file: 'gallery-frameworks.png',
    title: '📁 Frameworks, libs & UI',
    type: 'folder',
    slugs: byCat(/framework|lib/i, 110),
  },
  {
    file: 'gallery-databases.png',
    title: '📁 Bancos de dados',
    type: 'folder',
    slugs: byCat(/database/i, 80),
  },
  {
    file: 'gallery-devops.png',
    title: '📁 Cloud, DevOps & CI',
    type: 'folder',
    slugs: byCat(/cloud|devops|ci/i, 130),
  },
  {
    file: 'gallery-tools.png',
    title: '📁 Ferramentas, editores & IDEs',
    type: 'folder',
    slugs: byCat(/ferrament|editor|dev tool/i, 130),
  },
  {
    file: 'gallery-services.png',
    title: '📁 Serviços, SaaS & APIs',
    type: 'folder',
    slugs: byCat(/saas|servi/i, 110),
  },
  {
    file: 'gallery-ai-web3.png',
    title: '📁 IA/ML, Web3 & mensageria',
    type: 'folder',
    slugs: byCat(/ia\/ml|web3|mensageria|comms|design/i, 90),
  },
];

const COLS = 10;

function grid(cells) {
  return cells
    .filter((c) => c.uri)
    .map((c) => `<div class="cell"><img src="${c.uri}"><span>${c.label}</span></div>`)
    .join('\n');
}
function html(title, cells) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{background:#1e1e1e;font-family:-apple-system,"Segoe UI",Ubuntu,sans-serif}
  .wrap{width:${COLS * 106 + 24}px;padding:18px 12px}
  h2{color:#e6e6e6;font-size:15px;font-weight:600;padding:0 10px 12px}
  .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:5px}
  .cell{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 3px;border-radius:7px;background:#252526}
  .cell img{width:30px;height:30px}
  .cell span{color:#b4b4b4;font-size:10px;text-align:center;line-height:1.15;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  </style></head><body><div class="wrap"><h2>${title}</h2><div class="grid">${grid(cells)}</div></div></body></html>`;
}

const browser = await chromium.launch();
for (const g of GALLERIES) {
  const cells =
    g.type === 'file'
      ? g.items.map(([label, name]) => ({ label, uri: dataUri(fileByName(name)) }))
      : g.slugs.map((s) => ({ label: pretty(s), uri: dataUri(folderByName(s)) }));
  const have = cells.filter((c) => c.uri).length;
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(html(g.title, cells), { waitUntil: 'networkidle' });
  const el = await page.$('.wrap');
  await el.screenshot({ path: join(ROOT, 'assets', g.file) });
  await page.close();
  console.log(`${g.file}: ${have} ícones`);
}
await browser.close();
