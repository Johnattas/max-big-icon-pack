# Max Big Icon Pack

Icon theme de VSCode baseado no Material Icon Theme, com ícones extras importados de
`atom-master` (glifos coloridos) e `AFileIcon` (PNGs). Gerado por `npm run import-icons`.

## Como testar/instalar no VSCode (verificação manual)

1. Na raiz do repositório, rode `npm run import-icons` para (re)gerar
   `dist-theme/max-big-icon-theme.json` e `dist-theme/icons/`.
2. Abra o VSCode e use o Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) →
   **"Developer: Install Extension from Location…"** → selecione a pasta `dist-theme/`
   deste repositório.
3. Ainda no Command Palette, rode **"Preferences: File Icon Theme"** e escolha
   **"Max Big Icon Pack"**.
4. Confira no Explorer:
   - Os ícones do Material Icon Theme continuam aparecendo normalmente para arquivos/pastas comuns.
   - Pelo menos um ícone novo (ex.: um conceito listado em `SUPPORTED_ICONS.md` que não existe
     no Material, como `pinia`) aparece colorido.

Alternativamente, para empacotar como `.vsix` instalável:

```bash
npx @vscode/vsce package
```

(rodar dentro de `dist-theme/`, após gerar o tema).
