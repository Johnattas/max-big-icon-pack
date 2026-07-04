# CLAUDE.md

Guia para agentes/IA e mantenedores entenderem este repositório rapidamente.

## O que este repositório é (hoje) vs. o objetivo

- **Base de código atual:** é um _fork/derivado_ do projeto
  [`material-icons-browser-extension`](https://github.com/material-extensions/material-icons-browser-extension)
  (ver `package.json` → `"name": "material-icons-browser-extension"`). É uma **extensão de
  navegador** que troca os ícones de arquivos/pastas nas telas do GitHub/GitLab/etc. pelos
  ícones do **Material Icon Theme**.
- **Objetivo do dono do repo (`max-big-icon-pack`):** construir um **VSCode File Icon Theme
  próprio**, baseado no Material Icon Theme, **acrescentando ícones que faltam** no pacote
  original. Ou seja, o produto-alvo NÃO é a extensão de navegador — é um _icon theme_ de VSCode
  (SVGs + JSON com `iconDefinitions` / `fileExtensions` / `fileNames` / `folderNames`).

> Atenção: por isso há descasamento entre o `package.json` (extensão de navegador) e a intenção
> real. Trate a extensão como a "herança" e o icon theme de VSCode como o alvo.

## Como a extensão de navegador funciona (herança)

- **Fonte de ícones e mapeamento:** tudo vem do pacote npm `material-icon-theme` (dependência).
  A extensão **não guarda uma biblioteca própria de SVGs**.
  - `src/lib/replace-icons.ts` chama `generateManifest()` do `material-icon-theme` para obter o
    mapa arquivo→ícone e observa o DOM (`selector-observer`) para trocar os ícones.
  - `src/lib/replace-icon.ts` faz a troca de um elemento/linha específica.
  - `src/models/providerCustomMapping.ts` define regras _por provedor_ (casos especiais via DOM,
    ex.: pasta `.github/workflows`). NÃO é um mapa geral de tipos de arquivo.
  - `src/custom/` guarda SVGs customizados avulsos (hoje só `folder-symlink.svg`).
- **Build:** `scripts/build-src.ts` (esbuild), `scripts/build-icons.ts` (logos da extensão),
  `scripts/update-*.ts`. Testes com Vitest; e2e com Playwright (`e2e/`, `playwright.config.ts`).

## Estado do ambiente (importante)

- `node_modules/` está **vazio** — dependências NÃO instaladas. Rodar `npm ci`/`npm install`
  antes de qualquer build.
- Rede npm **funciona**; `material-icon-theme` mais recente observado: **5.36.1**
  (o `generateManifest()` desse pacote é a fonte de verdade das associações do Material).
- `git status` mostra o repo em forte reformulação (muitos arquivos deletados, `assets/` novo,
  README/CHANGELOG alterados, nome "max-big-icon-pack"). Trate arquivos deletados no working
  tree como intencionais.

## Pacotes-fonte de ícones a serem importados

Ambos ficam na raiz do repo (também há os `.zip` correspondentes):

### 1. `atom-master/` — file-icons/atom (PRIORIDADE)
- Ícones vêm de **fontes** (`fonts/*.woff2`: `file-icons`, `devopicons`, `mfixx`,
  `fontawesome`). Referências a `octicons` existem no CSS mas o `.woff2` do octicons NÃO está
  incluído (é provido pelo Atom) — glifos octicons não são extraíveis só deste pacote.
- Mapeamento em 3 arquivos:
  - `config.cson` → entradas com `icon: "<nome>"`, `match: <padrão>`, `colour: "<nome>"`.
  - `styles/icons.less` → `.<nome>-icon:before { .<fonte>; content: "\XXXX"; }`
    (nome do ícone → fonte + codepoint do glifo).
  - `styles/colours.less` → nome da cor → hex.
- São glifos **monocromáticos** colorizados por CSS (1 cor por ícone). Para virar SVG:
  extrair o path do glifo (via `fonttools`) do codepoint na fonte certa e preencher com o hex.

### 2. `AFileIcon-master/` — A File Icon (Sublime Text)
- **780 ícones PNG** coloridos (logos reais), em `icons/single/` e `icons/multi/`
  (variações `@2x`/`@3x`, tamanhos 16/32/48). Nomeados `file_type_<nome>.png`.
- Mapeamento em `preferences/*.tmPreferences` (escopo TextMate → ícone) e `icons/icons.json`.

## Decisões de produto acordadas com o dono

- Produto-alvo: **VSCode File Icon Theme** baseado no Material, com ícones extras faltantes.
- **Apenas ícones coloridos.**
- **`atom-master` tem prioridade**; ícones do **`AFileIcon-master` só para as lacunas que
  sobrarem** depois do atom.
- "Faltante" = **por conceito E por associação** (marca/linguagem que o Material não tem, e/ou
  extensão/nome/pasta que o Material não reconhece). Cobrir **arquivos e pastas**.
  Ex. citado pelo dono: ícones de arquivos `pinia`, ícone de pasta `store`/pinia, etc.

## Fluxo de trabalho recomendado (skills superpowers)

`brainstorming` → `writing-plans` → `executing-plans`/`subagent-driven-development`
(+ `dispatching-parallel-agents` para processar centenas de ícones) → `verification-before-completion`.
Não há skill específica para conversão de fonte/SVG; essa parte é scripting sob medida.

## Convenções

- Referencie arquivos como `caminho:linha`. Lint/format: Biome (`biome.jsonc`).
- Não instale deps nem rode builds sem necessidade; `node_modules/` começa vazio.
