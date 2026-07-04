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
