# Design — VSCode Icon Theme com ícones faltantes (max-big-icon-pack)

Data: 2026-07-01
Status: Aprovado (design). Próximo passo: writing-plans.

## Objetivo

Produzir um **VSCode File Icon Theme** próprio, baseado no **Material Icon Theme**
(`material-icon-theme@5.36.1`), acrescentando ícones que faltam no pacote original,
importados de dois pacotes-fonte locais. A geração deve ser um **pipeline reproduzível**
(scripts), para poder ser refeita quando o Material atualizar.

## Contexto

Ver `CLAUDE.md` para o estado do repositório. Pontos-chave:
- O repo é um derivado do `material-icons-browser-extension` (extensão de navegador), mas o
  produto-alvo é um icon theme de VSCode.
- `node_modules/` vazio; rede npm funciona; `fonttools` 4.63.0 e Python 3.14 disponíveis.
- Fontes: `atom-master/` (glifos de fonte, PRIORIDADE) e `AFileIcon-master/` (PNG, preenche o
  que sobrar).

## Decisões acordadas

1. Produto-alvo: VSCode File Icon Theme baseado no Material + extras.
2. **Apenas ícones coloridos.**
3. **`atom-master` tem prioridade**; `AFileIcon-master` só cobre lacunas remanescentes.
4. "Faltante" = por **conceito** (marca/linguagem ausente) **e** por **associação**
   (extensão/nome de arquivo/nome de pasta não reconhecidos). Cobrir **arquivos e pastas**.
5. Ícones do atom sairão como **SVG de 1 cor** (glifo + cor do atom). Glifos baseados em
   `octicons` são pulados (font `.woff2` não incluída no pacote).

## Arquitetura do pipeline

Scripts em `scripts/import-icons/` (TypeScript via `tsx`, com um helper Python para extração de
glifos). Cada etapa é um módulo isolado, testável, com entrada/saída bem definidas.

### Etapa 0 — Base Material
- `npm install` (garante `material-icon-theme`).
- Carregar o manifest completo via `generateManifest()` e localizar os SVGs do pacote.
- Copiar os SVGs base + registrar as associações base (fileExtensions, fileNames, folderNames,
  fileNamesGlob, languageIds conforme aplicável) como fundação do tema.
- **Saída:** `dist-theme/icons/` (SVGs base) + estrutura de associações base em memória/JSON.

### Etapa 1 — Inventário de lacunas
- Do Material: derivar conjuntos cobertos — `extensions`, `fileNames`, `folderNames`, e o
  conjunto de **conceitos** (nomes de ícone/def).
- Parsear `atom-master`:
  - `config.cson` (CSON) → lista de `{ icon, match, colour, priority }`.
    `match` (string/array/regex) → normalizar para extensões e nomes de arquivo.
  - `styles/icons.less` → `{ iconName → (fonte, codepoint) }`.
  - `styles/colours.less` → `{ colourName → hex }`.
- Parsear `AFileIcon-master`:
  - `icons/single|multi/file_type_<nome>.png` → inventário de PNGs (usar maior resolução).
  - `preferences/*.tmPreferences` e/ou `icons/icons.json` → associações (escopo/extensão).
- Computar o **delta**: itens presentes nas fontes e ausentes no Material, separando
  arquivo vs. pasta, e conceito vs. associação.
- **Saída:** `dist-theme/report/gaps.json` (fonte, tipo, conceito, associações, cor/glyph/png).

### Etapa 2 — Geração de ícones (coloridos)
- **atom (prioridade):** para cada lacuna coberta pelo atom:
  - resolver fonte+codepoint (icons.less) e hex (colours.less);
  - extrair o path do glifo do `.woff2` correto via helper Python (`fonttools`);
  - emitir SVG (viewBox normalizado, `fill` = hex).
  - pular se: for glifo `octicons`, se não houver cor, ou se o glyph não existir na fonte.
- **AFileIcon (só o restante):** para lacunas não cobertas pelo atom, copiar o PNG (@3x/maior)
  para `dist-theme/icons/` e usar como `iconPath`.
- **Saída:** SVGs/PNGs novos em `dist-theme/icons/` + índice `{ concept → iconFile, source }`.

### Etapa 3 — Montagem do tema e empacotamento
- Mesclar base (Etapa 0) + novos (Etapa 2) em `dist-theme/max-big-icon-theme.json`:
  `iconDefinitions`, `file`, `folder`, `folderExpanded`, `fileExtensions`, `fileNames`,
  `folderNames`, `folderNamesExpanded`, `light`/`highContrast` (herdar do Material quando houver).
- Gerar/atualizar o manifesto do VSCode (`package.json` → `contributes.iconThemes` ou uma
  extensão dedicada em `dist-theme/`).
- Regenerar `SUPPORTED_ICONS.md` (relatório do que foi adicionado por fonte e do que foi pulado,
  ex.: glifos octicons).

## Estrutura de arquivos proposta

```
scripts/import-icons/
  00-base-material.ts      # Etapa 0
  01-inventory-gaps.ts     # Etapa 1 (parsers cson/less/tmPreferences)
  02-generate-icons.ts     # Etapa 2 (chama extract-glyph.py)
  03-build-theme.ts        # Etapa 3
  lib/                     # parsers + tipos compartilhados
  extract-glyph.py         # fonttools: codepoint+woff2 -> SVG path
  run.ts                   # orquestra 00->03
dist-theme/                # saída gerada (tema + ícones + relatório)
```

## Testes

- Unit (Vitest) para os parsers: `config.cson`, `icons.less`, `colours.less`, tmPreferences,
  normalização de `match` → extensões/nomes.
- Unit para o cálculo de delta (dado Material fake + fontes fake → lacunas esperadas).
- Teste do `extract-glyph.py` com um codepoint conhecido → SVG não vazio.
- Validação do tema final: JSON válido, todo `iconDefinitions` referenciado existe em `icons/`,
  nenhuma associação órfã.

## Tratamento de erros / casos de borda

- Glifo `octicons` ou codepoint inexistente → pular e registrar no relatório.
- `match` regex complexo não redutível a extensão/nome simples → registrar como "não mapeável",
  não quebrar o build.
- Colisão de conceito atom vs AFileIcon → atom vence (prioridade).
- Colisão com conceito já existente no Material → não é lacuna; ignorar (a menos que o dono peça
  override explícito depois).
- PNG ausente numa resolução → usar a maior disponível.

## Fora de escopo (YAGNI)

- Redesenhar ícones do atom em multi-tom estilo material.
- Extrair glifos octicons (fonte não incluída).
- Publicar a extensão no marketplace.
- Alterar a lógica da extensão de navegador herdada (`src/`), exceto reuso de utilidades.
