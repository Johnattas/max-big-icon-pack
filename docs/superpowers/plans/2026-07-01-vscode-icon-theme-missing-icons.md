# VSCode Icon Theme com ícones faltantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, por um pipeline reproduzível, um VSCode File Icon Theme baseado no Material Icon Theme com os ícones que faltam, importados de `atom-master` (prioridade) e `AFileIcon-master`.

**Architecture:** Scripts TypeScript (rodados via `tsx`) em `scripts/import-icons/`, com um helper Python (`fonttools`) para extrair glifos de fonte. Etapas isoladas: parsers das fontes → carregar base Material (`generateManifest`) → calcular lacunas → gerar ícones (SVG colorido do atom; PNG do AFileIcon) → montar/validar o tema em `dist-theme/`.

**Tech Stack:** TypeScript, `tsx`, Vitest, `material-icon-theme@5.36.1`, `less` (resolver cores), `cson` (parsear config.cson), Python 3 + `fonttools` (extração de glifo).

## Global Constraints

- Node/npm: `node_modules/` começa vazio — rodar `npm install` antes de qualquer script.
- Apenas ícones **coloridos**. Ícones do atom saem como SVG de **1 cor** (glifo + cor do atom).
- **Prioridade `atom-master`**; `AFileIcon-master` só preenche lacunas remanescentes.
- "Faltante" = conceito e/ou associação (extensão/nome de arquivo/nome de pasta) ausente no Material. Cobrir arquivos **e** pastas.
- Glifos da fonte `octicons` são **pulados** (woff2 não incluído) e registrados no relatório.
- Mapa mixin→woff2 (verbatim): `.fi`→`file-icons.woff2`, `.devicons`→`devopicons.woff2`, `.fa`→`fontawesome.woff2`, `.mf`→`mfixx.woff2`, `.octicons`→(pular).
- Fontes atom em `atom-master/fonts/`; config em `atom-master/config.cson`; glifos em `atom-master/styles/icons.less`; cores em `atom-master/styles/colours.less`.
- AFileIcon: associações/cores em `AFileIcon-master/icons/icons.json`; PNGs em `AFileIcon-master/icons/single/file_type_<nome>.png` (usar `@3x` quando existir, senão base).
- Saída do pipeline em `dist-theme/` (não versionar SVGs base do Material; ver Task 11).
- Lint/format: Biome. Formatar arquivos novos antes de commitar (`npx biome format --write <arquivo>`).
- Commits: pular hooks com `--no-verify` (o working tree tem muitos arquivos staged em reformulação que quebram o husky/lint-staged).

## File Structure

```
scripts/import-icons/
  lib/
    types.ts            # tipos compartilhados
    fonts.ts            # mapa mixin->woff2
    parse-colours.ts    # colours.less -> Map<name,hex> (via less)
    parse-icons-less.ts # icons.less -> Map<iconName,{font,codepoint}>
    parse-config-cson.ts# config.cson -> AtomEntry[] (files+folders)
    parse-afileicon.ts  # icons.json -> AfiEntry[]
    material-base.ts     # generateManifest + dir de SVGs
    compute-gaps.ts     # delta fontes x Material
    generate-icons.ts   # gera SVG (atom) / copia PNG (AFileIcon)
    build-theme.ts      # monta + valida o theme JSON
    report.ts           # gera SUPPORTED_ICONS.md
  extract-glyph.py      # fonttools: (woff2, codepoint) -> SVG
  run.ts                # orquestra tudo
  __tests__/            # testes Vitest
dist-theme/             # saída gerada
```

---

### Task 0: Setup — dependências, tipos e mapa de fontes

**Files:**
- Modify: `package.json` (devDependencies + script)
- Create: `scripts/import-icons/lib/types.ts`
- Create: `scripts/import-icons/lib/fonts.ts`
- Test: `scripts/import-icons/__tests__/fonts.test.ts`

**Interfaces:**
- Produces: `types.ts` exporta `IconTarget`, `AtomEntry`, `AfiEntry`, `GlyphRef`, `GapItem`, `GeneratedIcon`. `fonts.ts` exporta `MIXIN_TO_WOFF2: Record<string,string|null>` e `resolveFont(mixin: string): string | null`.

- [ ] **Step 1: Instalar deps e adicionar devDeps**

Run:
```bash
cd /home/johnattas/GitHub/max-big-icon-pack
npm install
npm install -D less cson @types/less
python3 -c "import fontTools; print('fonttools', fontTools.version)"
```
Expected: instala sem erro; imprime `fonttools 4.63.0` (ou superior).

- [ ] **Step 2: Adicionar script npm**

Em `package.json`, dentro de `"scripts"`, adicionar:
```json
"import-icons": "tsx ./scripts/import-icons/run.ts"
```

- [ ] **Step 3: Criar tipos compartilhados**

Create `scripts/import-icons/lib/types.ts`:
```ts
export type IconKind = 'file' | 'folder';

/** Referência a um glifo dentro de uma fonte woff2. */
export type GlyphRef = { font: string | null; codepoint: number };

/** Uma entrada normalizada vinda do atom config.cson. */
export type AtomEntry = {
  concept: string;        // nome do ícone (config.cson `icon`)
  kind: IconKind;
  extensions: string[];   // ex.: ['ada','adb']
  fileNames: string[];    // ex.: ['.acre'] (arquivos) ou nomes de pasta
  colour: string | null;  // nome da cor no colours.less
  priority: number;
};

/** Uma entrada normalizada vinda do AFileIcon icons.json. */
export type AfiEntry = {
  concept: string;        // ex.: 'file_type_ada'
  extensions: string[];
  color: string | null;   // nome da cor AFileIcon (colors.json)
};

/** Item de lacuna: algo que falta no Material. */
export type GapItem = {
  concept: string;
  kind: IconKind;
  source: 'atom' | 'afileicon';
  extensions: string[];
  fileNames: string[];
  hex: string | null;     // cor resolvida (atom) ou null
  glyph: GlyphRef | null; // atom
  pngPath: string | null; // afileicon
};

/** Ícone efetivamente gerado. */
export type GeneratedIcon = {
  concept: string;
  kind: IconKind;
  iconFile: string;       // nome do arquivo em dist-theme/icons
  extensions: string[];
  fileNames: string[];
  source: 'atom' | 'afileicon';
};

export type IconTarget = GapItem; // alias semântico
```

- [ ] **Step 4: Escrever o teste do mapa de fontes**

Create `scripts/import-icons/__tests__/fonts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MIXIN_TO_WOFF2, resolveFont } from '../lib/fonts';

describe('fonts map', () => {
  it('mapeia mixins conhecidos para woff2', () => {
    expect(MIXIN_TO_WOFF2['fi']).toBe('file-icons.woff2');
    expect(MIXIN_TO_WOFF2['devicons']).toBe('devopicons.woff2');
    expect(MIXIN_TO_WOFF2['fa']).toBe('fontawesome.woff2');
    expect(MIXIN_TO_WOFF2['mf']).toBe('mfixx.woff2');
  });
  it('octicons não é extraível (null)', () => {
    expect(resolveFont('octicons')).toBeNull();
  });
  it('mixin desconhecido retorna null', () => {
    expect(resolveFont('nope')).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/fonts.test.ts`
Expected: FAIL — `Cannot find module '../lib/fonts'`.

- [ ] **Step 6: Implementar `fonts.ts`**

Create `scripts/import-icons/lib/fonts.ts`:
```ts
export const MIXIN_TO_WOFF2: Record<string, string | null> = {
  fi: 'file-icons.woff2',
  devicons: 'devopicons.woff2',
  fa: 'fontawesome.woff2',
  mf: 'mfixx.woff2',
  octicons: null, // woff2 não incluído no pacote atom
};

export function resolveFont(mixin: string): string | null {
  return MIXIN_TO_WOFF2[mixin] ?? null;
}
```

- [ ] **Step 7: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/fonts.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 8: Commit**

```bash
npx biome format --write scripts/import-icons package.json
git add package.json package-lock.json scripts/import-icons
git commit --no-verify -m "chore: setup import-icons pipeline (deps, types, fonts map)"
```

---

### Task 1: Parser de cores (colours.less → Map<name,hex>)

**Files:**
- Create: `scripts/import-icons/lib/parse-colours.ts`
- Test: `scripts/import-icons/__tests__/parse-colours.test.ts`

**Interfaces:**
- Produces: `export async function parseColours(coloursLessPath: string): Promise<Map<string,string>>` — nomes como `dark-green`, `medium-blue` → hex `#rrggbb`. Resolve `lighten()/darken()` via compilação LESS.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/parse-colours.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseColours } from '../lib/parse-colours';

const COLOURS = resolve(__dirname, '../../../atom-master/styles/colours.less');

describe('parseColours', () => {
  it('resolve cores base e derivadas para hex', async () => {
    const m = await parseColours(COLOURS);
    expect(m.get('medium-green')).toBe('#90a959'); // @green
    // dark-green = darken(@green,15%) -> mais escuro que o base
    const dark = m.get('dark-green')!;
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark).not.toBe('#90a959');
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-colours.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `parse-colours.ts`**

Estratégia: extrair todos os nomes de variável `@nome:` do colours.less, gerar um LESS que produz uma regra por variável (`.c-<nome>{c:@<nome>}`), compilar com `less` e ler os hex do CSS resultante. `less` resolve `lighten/darken/@import ./mixins` automaticamente.

Create `scripts/import-icons/lib/parse-colours.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
// @ts-expect-error - less não tem tipos default satisfatórios aqui
import less from 'less';

export async function parseColours(
  coloursLessPath: string
): Promise<Map<string, string>> {
  const src = await readFile(coloursLessPath, 'utf8');
  // Nomes de variáveis LESS declaradas: `@nome: ...;`
  const names = Array.from(
    new Set(
      Array.from(src.matchAll(/^@([a-zA-Z][\w-]*)\s*:/gm), (mm) => mm[1])
    )
  );
  const rules = names
    .map((n) => `.c-${n}{color:@${n};}`)
    .join('\n');
  const program = `${src}\n${rules}\n`;
  const out = await less.render(program, { paths: [dirname(coloursLessPath)] });
  const css: string = out.css;
  const map = new Map<string, string>();
  for (const m of css.matchAll(/\.c-([\w-]+)\s*\{\s*color:\s*([^;}]+)\s*;?\s*\}/g)) {
    map.set(m[1], normalizeHex(m[2].trim()));
  }
  return map;
}

function normalizeHex(v: string): string {
  // less pode emitir #abc, #aabbcc ou rgb(...)
  const short = v.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const s = short[1];
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }
  const full = v.match(/^#([0-9a-fA-F]{6})$/);
  if (full) return `#${full[1].toLowerCase()}`;
  const rgb = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const h = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`;
  }
  return v.toLowerCase();
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-colours.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: parse atom colours.less to hex map"
```

---

### Task 2: Parser de glifos (icons.less → Map<iconName,{font,codepoint}>)

**Files:**
- Create: `scripts/import-icons/lib/parse-icons-less.ts`
- Test: `scripts/import-icons/__tests__/parse-icons-less.test.ts`

**Interfaces:**
- Consumes: `resolveFont` de `lib/fonts.ts`.
- Produces: `export function parseIconsLess(src: string): Map<string, GlyphRef>` — chave = nome do ícone (sem sufixo `-icon`), valor `{ font, codepoint }` (font = woff2 ou null p/ octicons).

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/parse-icons-less.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseIconsLess } from '../lib/parse-icons-less';

const SRC = `
.binary-icon:before       { .octicons; content: "\\f094"; }
.acre-icon:before         { .fi; content: "\\e0a2"; }
.ada-icon:before          { .devicons; content: "\\e6a1"; font-size: 14px; }
`;

describe('parseIconsLess', () => {
  it('extrai fonte+codepoint por nome de ícone', () => {
    const m = parseIconsLess(SRC);
    expect(m.get('acre')).toEqual({ font: 'file-icons.woff2', codepoint: 0xe0a2 });
    expect(m.get('ada')).toEqual({ font: 'devopicons.woff2', codepoint: 0xe6a1 });
    // octicons -> font null (não extraível)
    expect(m.get('binary')).toEqual({ font: null, codepoint: 0xf094 });
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-icons-less.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `parse-icons-less.ts`**

Create `scripts/import-icons/lib/parse-icons-less.ts`:
```ts
import type { GlyphRef } from './types';
import { resolveFont } from './fonts';

const RULE = /\.([\w+.-]+)-icon:before\s*\{([^}]*)\}/g;
const MIXIN = /\.(fi|devicons|fa|mf|octicons)\b/;
const CONTENT = /content:\s*"\\([0-9a-fA-F]+)"/;

export function parseIconsLess(src: string): Map<string, GlyphRef> {
  const out = new Map<string, GlyphRef>();
  for (const m of src.matchAll(RULE)) {
    const name = m[1];
    const body = m[2];
    const mixin = body.match(MIXIN)?.[1];
    const content = body.match(CONTENT)?.[1];
    if (!mixin || !content) continue;
    out.set(name, {
      font: resolveFont(mixin),
      codepoint: parseInt(content, 16),
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-icons-less.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: parse atom icons.less to glyph refs"
```

---

### Task 3: Parser do config.cson (files + folders → AtomEntry[])

**Files:**
- Create: `scripts/import-icons/lib/parse-config-cson.ts`
- Test: `scripts/import-icons/__tests__/parse-config-cson.test.ts`

**Interfaces:**
- Produces: `export function parseConfigCson(csonPath: string): AtomEntry[]` — lê `fileIcons` (kind `file`) e `directoryIcons` (kind `folder`), normalizando `match` (regex/string/array) em `extensions`/`fileNames`.
- Produces helper testável: `export function normalizeMatch(match: unknown): { extensions: string[]; fileNames: string[] }`.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/parse-config-cson.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseConfigCson, normalizeMatch } from '../lib/parse-config-cson';

const CSON = resolve(__dirname, '../../../atom-master/config.cson');

describe('normalizeMatch', () => {
  it('extrai extensão de /\\.ext$/', () => {
    expect(normalizeMatch(/\.agda$/i)).toEqual({ extensions: ['agda'], fileNames: [] });
  });
  it('extrai múltiplas extensões de grupo', () => {
    const r = normalizeMatch(/\.(app|xcodeproj)$/i);
    expect(r.extensions.sort()).toEqual(['app', 'xcodeproj']);
  });
  it('extrai fileName de /^\\.name$/', () => {
    expect(normalizeMatch(/^\.atom$/)).toEqual({ extensions: [], fileNames: ['.atom'] });
  });
  it('string vira extensão', () => {
    expect(normalizeMatch('.json')).toEqual({ extensions: ['json'], fileNames: [] });
  });
});

describe('parseConfigCson', () => {
  it('lê arquivos e pastas do config real', () => {
    const entries = parseConfigCson(CSON);
    expect(entries.length).toBeGreaterThan(100);
    const agda = entries.find((e) => e.concept === 'agda');
    expect(agda?.kind).toBe('file');
    expect(agda?.extensions).toContain('agda');
    expect(agda?.colour).toBe('dark-cyan');
    expect(entries.some((e) => e.kind === 'folder')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-config-cson.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `parse-config-cson.ts`**

Create `scripts/import-icons/lib/parse-config-cson.ts`:
```ts
import { readFileSync } from 'node:fs';
// @ts-expect-error - cson sem tipos
import CSON from 'cson';
import type { AtomEntry, IconKind } from './types';

export function normalizeMatch(match: unknown): {
  extensions: string[];
  fileNames: string[];
} {
  const extensions = new Set<string>();
  const fileNames = new Set<string>();

  const handleString = (s: string) => {
    const t = s.startsWith('.') ? s.slice(1) : s;
    if (t) extensions.add(t.toLowerCase());
  };

  const handleRegex = (re: RegExp) => {
    const src = re.source;
    // fileName: /^\.name$/  (nome literal iniciado por ponto, sem metacaracteres)
    const nameM = src.match(/^\^\\\.([\w.-]+)\$$/);
    if (nameM) {
      fileNames.add(`.${nameM[1]}`);
      return;
    }
    // extensão simples: /\.ext$/  ou  /\.(a|b|c)$/
    const extM = src.match(/\\\.\(?([\w+|.-]+)\)?\$$/);
    if (extM) {
      for (const part of extM[1].split('|')) {
        const clean = part.replace(/[^\w+.-]/g, '');
        if (clean) extensions.add(clean.toLowerCase());
      }
    }
    // demais padrões (path-based etc.) são ignorados de propósito
  };

  const visit = (m: unknown) => {
    if (m == null) return;
    if (typeof m === 'string') return handleString(m);
    if (m instanceof RegExp) return handleRegex(m);
    if (Array.isArray(m)) {
      for (const item of m) {
        // item pode ser [pattern, colour, ...] ou pattern direto
        visit(Array.isArray(item) ? item[0] : item);
      }
    }
  };

  visit(match);
  return { extensions: [...extensions], fileNames: [...fileNames] };
}

function section(
  obj: Record<string, any>,
  kind: IconKind
): AtomEntry[] {
  const out: AtomEntry[] = [];
  for (const key of Object.keys(obj)) {
    const e = obj[key];
    if (!e || typeof e !== 'object' || !e.icon) continue;
    const { extensions, fileNames } = normalizeMatch(e.match);
    out.push({
      concept: String(e.icon),
      kind,
      extensions,
      fileNames,
      colour: e.colour ?? null,
      priority: typeof e.priority === 'number' ? e.priority : 1,
    });
  }
  return out;
}

export function parseConfigCson(csonPath: string): AtomEntry[] {
  const raw = readFileSync(csonPath, 'utf8');
  const data = CSON.parse(raw) as {
    fileIcons?: Record<string, any>;
    directoryIcons?: Record<string, any>;
  };
  return [
    ...section(data.fileIcons ?? {}, 'file'),
    ...section(data.directoryIcons ?? {}, 'folder'),
  ];
}
```

> Nota: se `CSON.parse` falhar por sintaxe CoffeeScript (regex literais), verificar que o pacote instalado é `cson` (usa o compilador CoffeeScript), não `cson-parser`.

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-config-cson.test.ts`
Expected: PASS. Se `parseConfigCson` falhar ao ler o arquivo real, ajustar apenas o acesso às seções (logar `Object.keys(data)`), sem mudar os testes de `normalizeMatch`.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: parse atom config.cson into normalized entries"
```

---

### Task 4: Parser do AFileIcon (icons.json → AfiEntry[])

**Files:**
- Create: `scripts/import-icons/lib/parse-afileicon.ts`
- Test: `scripts/import-icons/__tests__/parse-afileicon.test.ts`

**Interfaces:**
- Produces: `export function parseAfileicon(iconsJsonPath: string): AfiEntry[]` — cada `file_type_X` → extensões (de `aliases[].extensions` e `syntaxes[].extensions`) + `color`.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/parse-afileicon.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseAfileicon } from '../lib/parse-afileicon';

const JSON_PATH = resolve(__dirname, '../../../AFileIcon-master/icons/icons.json');

describe('parseAfileicon', () => {
  it('extrai extensões e cor por file_type', () => {
    const entries = parseAfileicon(JSON_PATH);
    const ada = entries.find((e) => e.concept === 'file_type_ada');
    expect(ada?.extensions).toEqual(expect.arrayContaining(['ada', 'adb', 'ads']));
    expect(ada?.color).toBe('red');
    const access = entries.find((e) => e.concept === 'file_type_access');
    expect(access?.extensions).toEqual(expect.arrayContaining(['accdb', 'mdw']));
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-afileicon.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `parse-afileicon.ts`**

Create `scripts/import-icons/lib/parse-afileicon.ts`:
```ts
import { readFileSync } from 'node:fs';
import type { AfiEntry } from './types';

type Group = { extensions?: string[] };
type Def = { color?: string; aliases?: Group[]; syntaxes?: Group[] };

export function parseAfileicon(iconsJsonPath: string): AfiEntry[] {
  const data = JSON.parse(readFileSync(iconsJsonPath, 'utf8')) as Record<
    string,
    Def
  >;
  const out: AfiEntry[] = [];
  for (const concept of Object.keys(data)) {
    const def = data[concept];
    const exts = new Set<string>();
    for (const g of [...(def.aliases ?? []), ...(def.syntaxes ?? [])]) {
      for (const e of g.extensions ?? []) exts.add(e.toLowerCase());
    }
    out.push({
      concept,
      extensions: [...exts],
      color: def.color ?? null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/parse-afileicon.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: parse AFileIcon icons.json into entries"
```

---

### Task 5: Extrator de glifo (Python + fonttools)

**Files:**
- Create: `scripts/import-icons/extract-glyph.py`
- Test: `scripts/import-icons/__tests__/extract-glyph.test.ts`

**Interfaces:**
- CLI: `python3 extract-glyph.py <woff2Path> <codepointHex> <fillHex> <outSvgPath>` — escreve um SVG (viewBox 0 0 1000 1000, com `<path>` preenchido com `fillHex`). Sai com código ≠0 e mensagem em stderr se o codepoint não existir na fonte.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/extract-glyph.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PY = resolve(__dirname, '../extract-glyph.py');
const FONT = resolve(__dirname, '../../../atom-master/fonts/file-icons.woff2');

describe('extract-glyph.py', () => {
  it('gera SVG com path para um codepoint válido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'glyph-'));
    const out = join(dir, 'x.svg');
    // 0xe0a2 = acre (file-icons). Se não existir, o teste indicará ajuste.
    execFileSync('python3', [PY, FONT, 'e0a2', '#90a959', out]);
    const svg = readFileSync(out, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('<path');
    expect(svg.toLowerCase()).toContain('#90a959');
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/extract-glyph.test.ts`
Expected: FAIL — script inexistente.

- [ ] **Step 3: Implementar `extract-glyph.py`**

Create `scripts/import-icons/extract-glyph.py`:
```python
#!/usr/bin/env python3
"""Extrai um glifo de uma fonte (woff2) como SVG colorido.

Uso: extract-glyph.py <woff2> <codepointHex> <fillHex> <outSvg>
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen


def glyph_name_for_codepoint(font, cp):
    cmap = font.getBestCmap()
    return cmap.get(cp)


def main():
    if len(sys.argv) != 5:
        print("uso: extract-glyph.py <woff2> <cpHex> <fillHex> <out>", file=sys.stderr)
        return 2
    woff2, cp_hex, fill, out = sys.argv[1:5]
    cp = int(cp_hex, 16)

    font = TTFont(woff2)
    gname = glyph_name_for_codepoint(font, cp)
    if gname is None:
        print(f"codepoint U+{cp_hex} ausente em {woff2}", file=sys.stderr)
        return 3

    upm = font["head"].unitsPerEm
    glyph_set = font.getGlyphSet()
    pen = SVGPathPen(glyph_set)
    glyph_set[gname].draw(pen)
    d = pen.getCommands()
    if not d:
        print(f"glifo {gname} vazio", file=sys.stderr)
        return 4

    # Fontes têm y para cima; SVG tem y para baixo. Espelhar via transform.
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {upm} {upm}">'
        f'<g transform="translate(0,{upm}) scale(1,-1)">'
        f'<path fill="{fill}" d="{d}"/>'
        f"</g></svg>\n"
    )
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/extract-glyph.test.ts`
Expected: PASS. Se falhar com "codepoint ausente", listar os codepoints reais com:
`python3 -c "from fontTools.ttLib import TTFont; print(sorted(hex(c) for c in TTFont('atom-master/fonts/file-icons.woff2').getBestCmap())[:20])"`
e atualizar o codepoint usado no teste (o parser da Task 2 fornece o valor correto em produção).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-icons/extract-glyph.py scripts/import-icons/__tests__/extract-glyph.test.ts
git commit --no-verify -m "feat: python glyph-to-svg extractor via fonttools"
```

---

### Task 6: Carregar base Material (generateManifest + dir de SVGs)

**Files:**
- Create: `scripts/import-icons/lib/material-base.ts`
- Test: `scripts/import-icons/__tests__/material-base.test.ts`

**Interfaces:**
- Produces:
  - `export function loadMaterialManifest(): Manifest` (usa `generateManifest` de `material-icon-theme`).
  - `export function materialIconsDir(): string` (dir dos SVGs do pacote).
  - `export function materialCoverage(m: Manifest): { extensions: Set<string>; fileNames: Set<string>; folderNames: Set<string>; concepts: Set<string> }`.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/material-base.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  loadMaterialManifest,
  materialIconsDir,
  materialCoverage,
} from '../lib/material-base';

describe('material-base', () => {
  it('carrega manifest e cobertura', () => {
    const m = loadMaterialManifest();
    const cov = materialCoverage(m);
    expect(cov.extensions.has('ts')).toBe(true);
    expect(cov.concepts.size).toBeGreaterThan(100);
  });
  it('localiza o diretório de SVGs com typescript.svg', () => {
    const dir = materialIconsDir();
    expect(existsSync(`${dir}/typescript.svg`)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/material-base.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `material-base.ts`**

Create `scripts/import-icons/lib/material-base.ts`:
```ts
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { generateManifest, type Manifest } from 'material-icon-theme';

const require = createRequire(import.meta.url);

export function loadMaterialManifest(): Manifest {
  return generateManifest({});
}

export function materialIconsDir(): string {
  // package.json do material-icon-theme -> raiz do pacote -> icons/
  const pkgJson = require.resolve('material-icon-theme/package.json');
  return join(dirname(pkgJson), 'icons');
}

export function materialCoverage(m: Manifest) {
  const extensions = new Set<string>(
    Object.keys(m.fileExtensions ?? {}).map((e) => e.toLowerCase())
  );
  const fileNames = new Set<string>(
    Object.keys(m.fileNames ?? {}).map((n) => n.toLowerCase())
  );
  const folderNames = new Set<string>(
    Object.keys(m.folderNames ?? {}).map((n) => n.toLowerCase())
  );
  const concepts = new Set<string>(Object.keys(m.iconDefinitions ?? {}));
  return { extensions, fileNames, folderNames, concepts };
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/material-base.test.ts`
Expected: PASS. Se `materialIconsDir` não achar `typescript.svg`, inspecionar a árvore do pacote:
`node -e "console.log(require('node:path').dirname(require.resolve('material-icon-theme/package.json')))"` e ajustar o subdir (`icons`).

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: load material-icon-theme base manifest and coverage"
```

---

### Task 7: Calcular lacunas (delta fontes × Material)

**Files:**
- Create: `scripts/import-icons/lib/compute-gaps.ts`
- Test: `scripts/import-icons/__tests__/compute-gaps.test.ts`

**Interfaces:**
- Consumes: `AtomEntry[]`, `AfiEntry[]`, cobertura Material, `Map` de glifos (Task 2), `Map` de cores (Task 1), e dir de PNGs do AFileIcon.
- Produces: `export function computeGaps(input: ComputeGapsInput): GapItem[]` onde
  `ComputeGapsInput = { atom: AtomEntry[]; afi: AfiEntry[]; coverage: ReturnType<typeof materialCoverage>; glyphs: Map<string,GlyphRef>; colours: Map<string,string>; afiPngDir: string; afiColors: Map<string,string> }`.
- Regras: uma entrada atom é lacuna se **nenhuma** de suas extensions/fileNames está coberta pelo Material E o conceito não existe. atom tem prioridade; AFileIcon só entra se a extensão ainda não foi coberta nem pelo Material nem por uma lacuna atom já aceita. Só inclui itens **coloridos** (atom: cor resolvida != null e glyph.font != null; afi: PNG existe).

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/compute-gaps.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeGaps } from '../lib/compute-gaps';
import type { AtomEntry, AfiEntry } from '../lib/types';

const coverage = {
  extensions: new Set(['ts']),
  fileNames: new Set<string>(),
  folderNames: new Set<string>(),
  concepts: new Set(['typescript']),
};

const atom: AtomEntry[] = [
  { concept: 'pinia', kind: 'file', extensions: ['pinia'], fileNames: [], colour: 'medium-yellow', priority: 1 },
  { concept: 'typescript', kind: 'file', extensions: ['ts'], fileNames: [], colour: 'medium-blue', priority: 1 },
  { concept: 'nofont', kind: 'file', extensions: ['zz'], fileNames: [], colour: 'red', priority: 1 },
];
const afi: AfiEntry[] = [
  { concept: 'file_type_pinia', extensions: ['pinia'], color: 'yellow' }, // já coberto por atom
  { concept: 'file_type_deno', extensions: ['deno'], color: 'green' },    // lacuna nova via afi
];

const glyphs = new Map([
  ['pinia', { font: 'file-icons.woff2', codepoint: 0xe111 }],
  ['typescript', { font: 'file-icons.woff2', codepoint: 0xe0a2 }],
  ['nofont', { font: null, codepoint: 0xf000 }], // octicons -> descartado
]);
const colours = new Map([
  ['medium-yellow', '#f4bf75'], ['medium-blue', '#6a9fb5'], ['red', '#ac4142'],
]);

describe('computeGaps', () => {
  it('prioriza atom, descarta cobertos e sem-fonte, e usa afi só p/ o resto', () => {
    const gaps = computeGaps({
      atom, afi, coverage, glyphs, colours,
      afiPngDir: '/nonexistent', afiColors: new Map(),
    });
    const concepts = gaps.map((g) => g.concept).sort();
    // pinia (atom) entra; typescript (coberto) sai; nofont (sem font) sai;
    // file_type_pinia (dup) sai; file_type_deno -> PNG inexistente -> sai
    expect(concepts).toEqual(['pinia']);
    expect(gaps[0].source).toBe('atom');
    expect(gaps[0].hex).toBe('#f4bf75');
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/compute-gaps.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `compute-gaps.ts`**

Create `scripts/import-icons/lib/compute-gaps.ts`:
```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AtomEntry, AfiEntry, GapItem, GlyphRef } from './types';

export type ComputeGapsInput = {
  atom: AtomEntry[];
  afi: AfiEntry[];
  coverage: {
    extensions: Set<string>;
    fileNames: Set<string>;
    folderNames: Set<string>;
    concepts: Set<string>;
  };
  glyphs: Map<string, GlyphRef>;
  colours: Map<string, string>;
  afiPngDir: string;
  afiColors: Map<string, string>;
};

function pngFor(dir: string, concept: string): string | null {
  for (const suffix of ['@3x', '@2x', '']) {
    const p = join(dir, `${concept}${suffix}.png`);
    if (existsSync(p)) return p;
  }
  return null;
}

export function computeGaps(input: ComputeGapsInput): GapItem[] {
  const { atom, afi, coverage, glyphs, colours, afiPngDir, afiColors } = input;
  const taken = new Set<string>(); // extensões/nomes já resolvidos
  const gaps: GapItem[] = [];

  const covered = (kind: string, ext: string[], names: string[]) => {
    const nameSet = kind === 'folder' ? coverage.folderNames : coverage.fileNames;
    return (
      ext.some((e) => coverage.extensions.has(e) || taken.has(`e:${e}`)) ||
      names.some((n) => nameSet.has(n.toLowerCase()) || taken.has(`n:${n.toLowerCase()}`))
    );
  };
  const claim = (ext: string[], names: string[]) => {
    for (const e of ext) taken.add(`e:${e}`);
    for (const n of names) taken.add(`n:${n.toLowerCase()}`);
  };

  // 1) atom (prioridade) — só coloridos com fonte extraível
  for (const e of atom) {
    if (coverage.concepts.has(e.concept)) continue;
    if (covered(e.kind, e.extensions, e.fileNames)) continue;
    const glyph = glyphs.get(e.concept);
    const hex = e.colour ? colours.get(e.colour) ?? null : null;
    if (!glyph || glyph.font === null || !hex) continue; // não colorido/extraível
    if (e.extensions.length === 0 && e.fileNames.length === 0) continue;
    claim(e.extensions, e.fileNames);
    gaps.push({
      concept: e.concept,
      kind: e.kind,
      source: 'atom',
      extensions: e.extensions,
      fileNames: e.fileNames,
      hex,
      glyph,
      pngPath: null,
    });
  }

  // 2) AFileIcon — só o que sobrou (sempre kind 'file'); precisa de PNG
  for (const e of afi) {
    if (e.extensions.length === 0) continue;
    if (coverage.concepts.has(e.concept)) continue;
    if (covered('file', e.extensions, [])) continue;
    const png = pngFor(afiPngDir, e.concept);
    if (!png) continue;
    claim(e.extensions, []);
    gaps.push({
      concept: e.concept,
      kind: 'file',
      source: 'afileicon',
      extensions: e.extensions,
      fileNames: [],
      hex: e.color ? afiColors.get(e.color) ?? null : null,
      glyph: null,
      pngPath: png,
    });
  }

  return gaps;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/compute-gaps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: compute icon gaps with atom priority"
```

---

### Task 8: Gerar ícones (SVG do atom + copiar PNG do AFileIcon)

**Files:**
- Create: `scripts/import-icons/lib/generate-icons.ts`
- Test: `scripts/import-icons/__tests__/generate-icons.test.ts`

**Interfaces:**
- Consumes: `GapItem[]`, caminho do `extract-glyph.py`, dir das fontes atom, dir de saída.
- Produces: `export function generateIcons(gaps: GapItem[], opts: { fontsDir: string; pyScript: string; outDir: string }): GeneratedIcon[]` — escreve SVG (atom) / copia PNG (afi) em `outDir`, retorna os gerados. Erros por-ícone são registrados (console.warn) e o ícone é pulado, sem quebrar.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/generate-icons.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generateIcons } from '../lib/generate-icons';
import type { GapItem } from '../lib/types';

const FONTS = resolve(__dirname, '../../../atom-master/fonts');
const PY = resolve(__dirname, '../extract-glyph.py');

describe('generateIcons', () => {
  it('gera SVG colorido para gap do atom', () => {
    const out = mkdtempSync(join(tmpdir(), 'gen-'));
    const gaps: GapItem[] = [{
      concept: 'acre', kind: 'file', source: 'atom',
      extensions: ['acre'], fileNames: [], hex: '#90a959',
      glyph: { font: 'file-icons.woff2', codepoint: 0xe0a2 }, pngPath: null,
    }];
    const gen = generateIcons(gaps, { fontsDir: FONTS, pyScript: PY, outDir: out });
    expect(gen).toHaveLength(1);
    const svg = join(out, gen[0].iconFile);
    expect(existsSync(svg)).toBe(true);
    expect(readFileSync(svg, 'utf8')).toContain('#90a959');
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/generate-icons.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `generate-icons.ts`**

Create `scripts/import-icons/lib/generate-icons.ts`:
```ts
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GapItem, GeneratedIcon } from './types';

function safeName(concept: string): string {
  return concept.replace(/[^\w.-]/g, '_').toLowerCase();
}

export function generateIcons(
  gaps: GapItem[],
  opts: { fontsDir: string; pyScript: string; outDir: string }
): GeneratedIcon[] {
  mkdirSync(opts.outDir, { recursive: true });
  const generated: GeneratedIcon[] = [];

  for (const g of gaps) {
    const base = safeName(g.concept);
    try {
      if (g.source === 'atom' && g.glyph?.font && g.hex) {
        const iconFile = `${base}.svg`;
        const out = join(opts.outDir, iconFile);
        execFileSync('python3', [
          opts.pyScript,
          join(opts.fontsDir, g.glyph.font),
          g.glyph.codepoint.toString(16),
          g.hex,
          out,
        ]);
        generated.push(toGenerated(g, iconFile));
      } else if (g.source === 'afileicon' && g.pngPath) {
        const iconFile = `${base}.png`;
        copyFileSync(g.pngPath, join(opts.outDir, iconFile));
        generated.push(toGenerated(g, iconFile));
      }
    } catch (err) {
      console.warn(`[generate-icons] pulando ${g.concept}: ${(err as Error).message}`);
    }
  }
  return generated;
}

function toGenerated(g: GapItem, iconFile: string): GeneratedIcon {
  return {
    concept: g.concept,
    kind: g.kind,
    iconFile,
    extensions: g.extensions,
    fileNames: g.fileNames,
    source: g.source,
  };
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/generate-icons.test.ts`
Expected: PASS. Se o codepoint `0xe0a2` não existir na fonte, ajustar para um codepoint real (ver Task 5, Step 4).

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: generate SVG/PNG icons from gaps"
```

---

### Task 9: Montar e validar o theme JSON

**Files:**
- Create: `scripts/import-icons/lib/build-theme.ts`
- Test: `scripts/import-icons/__tests__/build-theme.test.ts`

**Interfaces:**
- Consumes: `Manifest` base (Material), `GeneratedIcon[]`, prefixo de nome de definição.
- Produces:
  - `export function buildTheme(base: Manifest, generated: GeneratedIcon[]): Manifest` — clona a base e adiciona `iconDefinitions[def] = { iconPath: 'icons/<file>' }` + associações (`fileExtensions`, `fileNames`, `folderNames`) apontando para `def = mbip-<concept>`.
  - `export function validateTheme(theme: Manifest, iconsDir: string): string[]` — retorna lista de problemas (defs sem arquivo, associações órfãs); vazio = ok.

- [ ] **Step 1: Escrever o teste**

Create `scripts/import-icons/__tests__/build-theme.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTheme, validateTheme } from '../lib/build-theme';
import type { GeneratedIcon } from '../lib/types';

const base: any = {
  iconDefinitions: { typescript: { iconPath: './icons/typescript.svg' } },
  fileExtensions: { ts: 'typescript' },
  fileNames: {}, folderNames: {},
};
const generated: GeneratedIcon[] = [{
  concept: 'pinia', kind: 'file', iconFile: 'pinia.svg',
  extensions: ['pinia'], fileNames: [], source: 'atom',
}];

describe('buildTheme', () => {
  it('adiciona def e associação de extensão', () => {
    const t: any = buildTheme(base, generated);
    expect(t.iconDefinitions['mbip-pinia']).toEqual({ iconPath: 'icons/pinia.svg' });
    expect(t.fileExtensions['pinia']).toBe('mbip-pinia');
    expect(t.fileExtensions['ts']).toBe('typescript'); // base preservada
  });

  it('valida arquivos presentes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'theme-'));
    writeFileSync(join(dir, 'pinia.svg'), '<svg/>');
    const t: any = { iconDefinitions: { 'mbip-pinia': { iconPath: 'icons/pinia.svg' } }, fileExtensions: { pinia: 'mbip-pinia' } };
    expect(validateTheme(t, dir)).toEqual([]);
    const bad: any = { iconDefinitions: { x: { iconPath: 'icons/missing.svg' } }, fileExtensions: {} };
    expect(validateTheme(bad, dir).length).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/build-theme.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `build-theme.ts`**

Create `scripts/import-icons/lib/build-theme.ts`:
```ts
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Manifest } from 'material-icon-theme';
import type { GeneratedIcon } from './types';

const DEF_PREFIX = 'mbip-';

export function buildTheme(base: Manifest, generated: GeneratedIcon[]): Manifest {
  const theme: any = structuredClone(base);
  theme.iconDefinitions ??= {};
  theme.fileExtensions ??= {};
  theme.fileNames ??= {};
  theme.folderNames ??= {};

  for (const g of generated) {
    const def = `${DEF_PREFIX}${g.concept}`;
    theme.iconDefinitions[def] = { iconPath: `icons/${g.iconFile}` };
    for (const ext of g.extensions) theme.fileExtensions[ext] = def;
    for (const name of g.fileNames) {
      if (g.kind === 'folder') theme.folderNames[name] = def;
      else theme.fileNames[name] = def;
    }
  }
  return theme as Manifest;
}

export function validateTheme(theme: Manifest, iconsDir: string): string[] {
  const t: any = theme;
  const problems: string[] = [];
  for (const [def, val] of Object.entries<any>(t.iconDefinitions ?? {})) {
    const file = basename(val.iconPath ?? '');
    if (!file || !existsSync(join(iconsDir, file))) {
      problems.push(`def ${def}: arquivo ausente (${val.iconPath})`);
    }
  }
  const defs = new Set(Object.keys(t.iconDefinitions ?? {}));
  for (const map of ['fileExtensions', 'fileNames', 'folderNames'] as const) {
    for (const [key, def] of Object.entries<string>(t[map] ?? {})) {
      if (!defs.has(def)) problems.push(`${map}[${key}] -> def inexistente ${def}`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/build-theme.test.ts`
Expected: PASS.

> Nota sobre `structuredClone`: disponível no Node ≥17. Se indisponível, usar `JSON.parse(JSON.stringify(base))`.

- [ ] **Step 5: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons
git commit --no-verify -m "feat: assemble and validate the vscode icon theme"
```

---

### Task 10: Relatório + orquestrador `run.ts`

**Files:**
- Create: `scripts/import-icons/lib/report.ts`
- Create: `scripts/import-icons/run.ts`
- Test: `scripts/import-icons/__tests__/report.test.ts`

**Interfaces:**
- Produces: `export function renderReport(generated: GeneratedIcon[], skipped: { concept: string; reason: string }[]): string` (markdown).
- `run.ts`: sem exports; orquestra Tasks 1-9, escreve `dist-theme/max-big-icon-theme.json`, copia SVGs base do Material p/ `dist-theme/icons/`, gera os novos ícones, valida, e escreve `SUPPORTED_ICONS.md`.

- [ ] **Step 1: Escrever o teste do relatório**

Create `scripts/import-icons/__tests__/report.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderReport } from '../lib/report';

describe('renderReport', () => {
  it('conta por fonte e lista pulados', () => {
    const md = renderReport(
      [
        { concept: 'pinia', kind: 'file', iconFile: 'pinia.svg', extensions: ['pinia'], fileNames: [], source: 'atom' },
        { concept: 'file_type_deno', kind: 'file', iconFile: 'file_type_deno.png', extensions: ['deno'], fileNames: [], source: 'afileicon' },
      ],
      [{ concept: 'binary', reason: 'octicons não extraível' }]
    );
    expect(md).toContain('atom: 1');
    expect(md).toContain('afileicon: 1');
    expect(md).toContain('binary');
    expect(md).toContain('octicons');
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/report.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `report.ts`**

Create `scripts/import-icons/lib/report.ts`:
```ts
import type { GeneratedIcon } from './types';

export function renderReport(
  generated: GeneratedIcon[],
  skipped: { concept: string; reason: string }[]
): string {
  const bySource = (s: string) => generated.filter((g) => g.source === s).length;
  const lines: string[] = [];
  lines.push('# Ícones adicionados (max-big-icon-pack)', '');
  lines.push(`Total adicionado: ${generated.length}`);
  lines.push(`- atom: ${bySource('atom')}`);
  lines.push(`- afileicon: ${bySource('afileicon')}`, '');
  lines.push('## Adicionados', '');
  lines.push('| conceito | fonte | tipo | arquivo | associações |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const g of generated) {
    const assoc = [...g.extensions.map((e) => `.${e}`), ...g.fileNames].join(', ');
    lines.push(`| ${g.concept} | ${g.source} | ${g.kind} | ${g.iconFile} | ${assoc} |`);
  }
  lines.push('', `## Pulados (${skipped.length})`, '');
  for (const s of skipped) lines.push(`- ${s.concept}: ${s.reason}`);
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `run.ts`**

Create `scripts/import-icons/run.ts`:
```ts
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseColours } from './lib/parse-colours';
import { parseIconsLess } from './lib/parse-icons-less';
import { parseConfigCson } from './lib/parse-config-cson';
import { parseAfileicon } from './lib/parse-afileicon';
import {
  loadMaterialManifest,
  materialIconsDir,
  materialCoverage,
} from './lib/material-base';
import { computeGaps } from './lib/compute-gaps';
import { generateIcons } from './lib/generate-icons';
import { buildTheme, validateTheme } from './lib/build-theme';
import { renderReport } from './lib/report';
import { readFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dirname, '../..');
const ATOM = join(ROOT, 'atom-master');
const AFI = join(ROOT, 'AFileIcon-master');
const OUT = join(ROOT, 'dist-theme');
const OUT_ICONS = join(OUT, 'icons');

async function main() {
  mkdirSync(OUT_ICONS, { recursive: true });

  // Parsers
  const colours = await parseColours(join(ATOM, 'styles/colours.less'));
  const glyphs = parseIconsLess(readFileSync(join(ATOM, 'styles/icons.less'), 'utf8'));
  const atom = parseConfigCson(join(ATOM, 'config.cson'));
  const afi = parseAfileicon(join(AFI, 'icons/icons.json'));
  const afiColors = new Map<string, string>(
    Object.entries(JSON.parse(readFileSync(join(AFI, 'icons/colors.json'), 'utf8')) as Record<string, string>)
  );

  // Base Material
  const base = loadMaterialManifest();
  const coverage = materialCoverage(base);
  const matIcons = materialIconsDir();

  // Lacunas
  const gaps = computeGaps({
    atom, afi, coverage, glyphs, colours,
    afiPngDir: join(AFI, 'icons/single'), afiColors,
  });

  // Copiar SVGs base do Material
  for (const f of readdirSync(matIcons)) {
    if (f.endsWith('.svg')) cpSync(join(matIcons, f), join(OUT_ICONS, basename(f)));
  }

  // Gerar novos ícones
  const generated = generateIcons(gaps, {
    fontsDir: join(ATOM, 'fonts'),
    pyScript: join(import.meta.dirname, 'extract-glyph.py'),
    outDir: OUT_ICONS,
  });

  // Montar + validar
  const theme = buildTheme(base, generated);
  const problems = validateTheme(theme, OUT_ICONS);
  if (problems.length) {
    console.error(`[run] ${problems.length} problemas de validação:`);
    for (const p of problems.slice(0, 20)) console.error('  - ' + p);
    process.exitCode = 1;
  }
  writeFileSync(join(OUT, 'max-big-icon-theme.json'), JSON.stringify(theme, null, 2));

  // Relatório
  const skipped = gaps
    .filter((g) => !generated.some((x) => x.concept === g.concept))
    .map((g) => ({ concept: g.concept, reason: g.source === 'atom' ? 'glifo não extraível/sem cor' : 'sem PNG' }));
  writeFileSync(join(ROOT, 'SUPPORTED_ICONS.md'), renderReport(generated, skipped));

  console.log(`[run] adicionados: ${generated.length} | pulados: ${skipped.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: Rodar o pipeline completo**

Run: `npm run import-icons`
Expected: imprime `[run] adicionados: N | pulados: M` com N > 0; cria `dist-theme/max-big-icon-theme.json`, `dist-theme/icons/*` e `SUPPORTED_ICONS.md`; sem problemas de validação (exit 0). Se `colors.json` não existir em AFileIcon, ajustar o caminho (`AFileIcon-master/icons/colors.json`) conforme a árvore real.

- [ ] **Step 7: Commit**

```bash
npx biome format --write scripts/import-icons
git add scripts/import-icons SUPPORTED_ICONS.md
git commit --no-verify -m "feat: orchestrate import-icons pipeline and report"
```

---

### Task 11: Empacotar como extensão de icon theme do VSCode

**Files:**
- Create: `dist-theme/package.json` (manifesto da extensão VSCode)
- Create: `dist-theme/README.md`
- Modify: `.gitignore` (ignorar SVGs base copiados, versionar só os gerados — ver abaixo)
- Test: `scripts/import-icons/__tests__/vscode-manifest.test.ts`

**Interfaces:**
- Produces: `dist-theme/package.json` com `contributes.iconThemes[0] = { id: 'max-big-icon-pack', label: 'Max Big Icon Pack', path: './max-big-icon-theme.json' }`.

- [ ] **Step 1: Escrever o teste do manifesto**

Create `scripts/import-icons/__tests__/vscode-manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('vscode manifest', () => {
  it('contribui um iconTheme válido', () => {
    const p = resolve(__dirname, '../../../dist-theme/package.json');
    const pkg = JSON.parse(readFileSync(p, 'utf8'));
    const theme = pkg.contributes?.iconThemes?.[0];
    expect(theme?.id).toBe('max-big-icon-pack');
    expect(theme?.path).toBe('./max-big-icon-theme.json');
    expect(pkg.engines?.vscode).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run scripts/import-icons/__tests__/vscode-manifest.test.ts`
Expected: FAIL — arquivo inexistente.

- [ ] **Step 3: Criar `dist-theme/package.json`**

Create `dist-theme/package.json`:
```json
{
  "name": "max-big-icon-pack",
  "displayName": "Max Big Icon Pack",
  "description": "Material Icon Theme estendido com ícones extras (atom-master + AFileIcon).",
  "version": "0.1.0",
  "publisher": "johnattas",
  "engines": { "vscode": "^1.80.0" },
  "categories": ["Themes"],
  "contributes": {
    "iconThemes": [
      {
        "id": "max-big-icon-pack",
        "label": "Max Big Icon Pack",
        "path": "./max-big-icon-theme.json"
      }
    ]
  }
}
```

- [ ] **Step 4: Criar `dist-theme/README.md`**

Create `dist-theme/README.md`:
```markdown
# Max Big Icon Pack

Icon theme de VSCode baseado no Material Icon Theme, com ícones extras importados de
`atom-master` (glifos coloridos) e `AFileIcon` (PNGs). Gerado por `npm run import-icons`.

Para testar: abra este diretório no VSCode e rode "Developer: Install Extension from Location…",
ou empacote com `npx @vscode/vsce package`.
```

- [ ] **Step 5: Rodar o teste (deve passar)**

Run: `npx vitest run scripts/import-icons/__tests__/vscode-manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Ajustar `.gitignore`**

Em `.gitignore`, adicionar (para não versionar centenas de SVGs base copiados do Material, que são regeneráveis):
```
dist-theme/icons/
```
E manter versionados: `dist-theme/package.json`, `dist-theme/README.md`, `dist-theme/max-big-icon-theme.json`, `SUPPORTED_ICONS.md`.

- [ ] **Step 7: Verificação manual no VSCode (checkpoint humano)**

Run: `npm run import-icons`
Depois, no VSCode: Command Palette → "Developer: Install Extension from Location…" → selecionar `dist-theme/` → File Icon Theme → "Max Big Icon Pack".
Expected: ícones do Material aparecem normalmente e pelo menos um ícone novo (ex.: um `.pinia`/conceito do relatório) aparece colorido.

- [ ] **Step 8: Commit**

```bash
npx biome format --write scripts/import-icons dist-theme/package.json
git add dist-theme/package.json dist-theme/README.md dist-theme/max-big-icon-theme.json .gitignore scripts/import-icons/__tests__/vscode-manifest.test.ts
git commit --no-verify -m "feat: package generated theme as vscode icon-theme extension"
```

---

## Self-Review

**Spec coverage:**
- Base Material → Task 6, 10. Inventário/lacunas → Tasks 1-4, 7. Geração coloridos (atom prioridade, AFileIcon resto) → Tasks 5, 8, 7. Montagem + validação + relatório → Tasks 9, 10. Empacotamento VSCode → Task 11. Todas as seções do spec têm task correspondente. ✔
- Casos de borda do spec: octicons pulado (Task 2/7/10 report), match não mapeável (Task 3 ignora silenciosamente), colisão atom>afi (Task 7 `taken`/prioridade), conceito já no Material (Task 7 `coverage.concepts`), PNG ausente (Task 7 `pngFor`/Task 8). ✔

**Placeholder scan:** Sem TBD/TODO; todo passo de código tem código real. ✔

**Type consistency:** `GapItem`/`GeneratedIcon`/`GlyphRef`/`AtomEntry`/`AfiEntry` definidos na Task 0 e usados consistentemente. `buildTheme`/`validateTheme`/`computeGaps`/`generateIcons`/`parse*` com assinaturas idênticas entre "Produces" e implementação. Prefixo de def `mbip-` consistente entre Task 9 e testes. ✔

**Riscos conhecidos a validar durante execução (não bloqueiam o plano):**
- Formato exato do `Manifest` do `material-icon-theme` (nomes `fileExtensions`/`fileNames`/`folderNames`) — confirmar na Task 6/9; ajustar chaves se a API divergir.
- Codepoints reais nas fontes — confirmar na Task 5.
- Caminho de `colors.json` do AFileIcon — confirmar na Task 10.
