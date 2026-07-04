export type IconKind = 'file' | 'folder';

/** Referência a um glifo dentro de uma fonte woff2. */
export type GlyphRef = { font: string | null; codepoint: number };

/** Uma entrada normalizada vinda do atom config.cson. */
export type AtomEntry = {
  concept: string; // nome do ícone (config.cson `icon`)
  kind: IconKind;
  extensions: string[]; // ex.: ['ada','adb']
  fileNames: string[]; // ex.: ['.acre'] (arquivos) ou nomes de pasta
  colour: string | null; // nome da cor no colours.less
  priority: number;
};

/** Uma entrada normalizada vinda do AFileIcon icons.json. */
export type AfiEntry = {
  concept: string; // ex.: 'file_type_ada'
  extensions: string[];
  color: string | null; // nome da cor AFileIcon (colors.json)
};

/** Item de lacuna: algo que falta no Material. */
export type GapItem = {
  concept: string;
  kind: IconKind;
  source: 'atom' | 'afileicon';
  extensions: string[];
  fileNames: string[];
  hex: string | null; // cor resolvida (atom) ou null
  glyph: GlyphRef | null; // atom
  pngPath: string | null; // afileicon
};

/** Ícone efetivamente gerado. */
export type GeneratedIcon = {
  concept: string;
  kind: IconKind;
  iconFile: string; // nome do arquivo em dist-theme/icons
  extensions: string[];
  fileNames: string[];
  source: 'atom' | 'afileicon';
};

export type IconTarget = GapItem; // alias semântico
