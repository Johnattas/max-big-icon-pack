import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Caminhos dos arquivos package.json da raiz e da pasta dist-theme
const rootPackagePath = resolve(__dirname, '../package.json');
const distThemePackagePath = resolve(__dirname, '../dist-theme/package.json');

/**
 * Incrementa a versão patch (ex: 1.0.22 -> 1.0.23) no package.json e em dist-theme/package.json.
 */
function bumpVersion(): void {
  const rootPkg = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  const oldVersion: string = rootPkg.version;

  const versionParts = oldVersion.split('.').map((part) => parseInt(part, 10));
  if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) {
    throw new Error(`Formato de versão inválido no package.json: ${oldVersion}`);
  }

  // Incrementa número patch
  versionParts[2] += 1;
  const newVersion = versionParts.join('.');

  // Atualiza package.json da raiz
  rootPkg.version = newVersion;
  writeFileSync(rootPackagePath, `${JSON.stringify(rootPkg, null, 2)}\n`, 'utf8');

  // Atualiza package.json do dist-theme
  try {
    const distPkg = JSON.parse(readFileSync(distThemePackagePath, 'utf8'));
    distPkg.version = newVersion;
    writeFileSync(
      distThemePackagePath,
      `${JSON.stringify(distPkg, null, 2)}\n`,
      'utf8'
    );
  } catch (error) {
    console.warn(`[bump-version] Aviso: Não foi possível atualizar dist-theme/package.json:`, error);
  }

  console.log(`[bump-version] Versão incrementada com sucesso: ${oldVersion} -> ${newVersion}`);
}

bumpVersion();
