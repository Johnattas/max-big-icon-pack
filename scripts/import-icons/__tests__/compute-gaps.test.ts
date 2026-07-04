import { describe, expect, it } from 'vitest';
import { computeGaps } from '../lib/compute-gaps';
import type { AfiEntry, AtomEntry } from '../lib/types';

const coverage = {
  extensions: new Set(['ts']),
  fileNames: new Set<string>(),
  folderNames: new Set<string>(),
  concepts: new Set(['typescript']),
};

const atom: AtomEntry[] = [
  {
    concept: 'pinia',
    kind: 'file',
    extensions: ['pinia'],
    fileNames: [],
    colour: 'medium-yellow',
    priority: 1,
  },
  {
    concept: 'typescript',
    kind: 'file',
    extensions: ['ts'],
    fileNames: [],
    colour: 'medium-blue',
    priority: 1,
  },
  {
    concept: 'nofont',
    kind: 'file',
    extensions: ['zz'],
    fileNames: [],
    colour: 'red',
    priority: 1,
  },
];
const afi: AfiEntry[] = [
  { concept: 'file_type_pinia', extensions: ['pinia'], color: 'yellow' }, // já coberto por atom
  { concept: 'file_type_deno', extensions: ['deno'], color: 'green' }, // lacuna nova via afi
];

const glyphs = new Map([
  ['pinia', { font: 'file-icons.woff2', codepoint: 0xe111 }],
  ['typescript', { font: 'file-icons.woff2', codepoint: 0xe0a2 }],
  ['nofont', { font: null, codepoint: 0xf000 }], // octicons -> descartado
]);
const colours = new Map([
  ['medium-yellow', '#f4bf75'],
  ['medium-blue', '#6a9fb5'],
  ['red', '#ac4142'],
]);

describe('computeGaps', () => {
  it('prioriza atom, descarta cobertos e sem-fonte, e usa afi só p/ o resto', () => {
    const gaps = computeGaps({
      atom,
      afi,
      coverage,
      glyphs,
      colours,
      afiPngDir: '/nonexistent',
      afiColors: new Map(),
    });
    const concepts = gaps.map((g) => g.concept).sort();
    // pinia (atom) entra; typescript (coberto) sai; nofont (sem font) sai;
    // file_type_pinia (dup) sai; file_type_deno -> PNG inexistente -> sai
    expect(concepts).toEqual(['pinia']);
    expect(gaps[0].source).toBe('atom');
    expect(gaps[0].hex).toBe('#f4bf75');
  });

  it('mantém namespaces de nome independentes por kind (folder vs file)', () => {
    const folderCoverage = {
      extensions: new Set<string>(),
      fileNames: new Set<string>(),
      folderNames: new Set<string>(),
      concepts: new Set<string>(),
    };
    const atomFolderAndFile: AtomEntry[] = [
      {
        concept: 'store-folder',
        kind: 'folder',
        extensions: [],
        fileNames: ['store'],
        colour: 'medium-yellow',
        priority: 1,
      },
      {
        concept: 'store-file',
        kind: 'file',
        extensions: [],
        fileNames: ['store'],
        colour: 'medium-blue',
        priority: 1,
      },
    ];
    const folderGlyphs = new Map([
      ['store-folder', { font: 'file-icons.woff2', codepoint: 0xe200 }],
      ['store-file', { font: 'file-icons.woff2', codepoint: 0xe201 }],
    ]);
    const folderColours = new Map([
      ['medium-yellow', '#f4bf75'],
      ['medium-blue', '#6a9fb5'],
    ]);

    const gaps = computeGaps({
      atom: atomFolderAndFile,
      afi: [],
      coverage: folderCoverage,
      glyphs: folderGlyphs,
      colours: folderColours,
      afiPngDir: '/nonexistent',
      afiColors: new Map(),
    });

    const byConcept = new Map(gaps.map((g) => [g.concept, g]));
    expect(gaps).toHaveLength(2);
    expect(byConcept.get('store-folder')?.kind).toBe('folder');
    expect(byConcept.get('store-file')?.kind).toBe('file');
  });

  it('mescla gaps atom com o mesmo concept em uma única entrada', () => {
    const earthCoverage = {
      extensions: new Set<string>(),
      fileNames: new Set<string>(),
      folderNames: new Set<string>(),
      concepts: new Set<string>(),
    };
    const atomEarth: AtomEntry[] = [
      {
        concept: 'earth',
        kind: 'file',
        extensions: ['zone'],
        fileNames: [],
        colour: 'medium-blue',
        priority: 1,
      },
      {
        concept: 'earth',
        kind: 'file',
        extensions: ['kml'],
        fileNames: [],
        colour: 'medium-yellow',
        priority: 1,
      },
    ];
    const earthGlyphs = new Map([
      ['earth', { font: 'file-icons.woff2', codepoint: 0xe300 }],
    ]);
    const earthColours = new Map([
      ['medium-blue', '#6a9fb5'],
      ['medium-yellow', '#f4bf75'],
    ]);

    const gaps = computeGaps({
      atom: atomEarth,
      afi: [],
      coverage: earthCoverage,
      glyphs: earthGlyphs,
      colours: earthColours,
      afiPngDir: '/nonexistent',
      afiColors: new Map(),
    });

    const earthGaps = gaps.filter((g) => g.concept === 'earth');
    expect(earthGaps).toHaveLength(1);
    expect(earthGaps[0].extensions.sort()).toEqual(['kml', 'zone']);
    expect(earthGaps[0].hex).toBe('#6a9fb5');
  });

  it('preserva a distinção file/folder quando o mesmo concept aparece nos dois kinds', () => {
    const gitCoverage = {
      extensions: new Set<string>(),
      fileNames: new Set<string>(),
      folderNames: new Set<string>(),
      concepts: new Set<string>(),
    };
    const atomGit: AtomEntry[] = [
      {
        concept: 'git',
        kind: 'file',
        extensions: ['gitignore-ext'],
        fileNames: [],
        colour: 'medium-yellow',
        priority: 1,
      },
      {
        concept: 'git',
        kind: 'folder',
        extensions: [],
        fileNames: ['.git'],
        colour: 'medium-blue',
        priority: 1,
      },
    ];
    const gitGlyphs = new Map([
      ['git', { font: 'file-icons.woff2', codepoint: 0xe400 }],
    ]);
    const gitColours = new Map([
      ['medium-yellow', '#f4bf75'],
      ['medium-blue', '#6a9fb5'],
    ]);

    const gaps = computeGaps({
      atom: atomGit,
      afi: [],
      coverage: gitCoverage,
      glyphs: gitGlyphs,
      colours: gitColours,
      afiPngDir: '/nonexistent',
      afiColors: new Map(),
    });

    const gitGaps = gaps.filter((g) => g.concept === 'git');
    expect(gitGaps).toHaveLength(2);
    const kinds = gitGaps.map((g) => g.kind).sort();
    expect(kinds).toEqual(['file', 'folder']);
    const fileGap = gitGaps.find((g) => g.kind === 'file');
    const folderGap = gitGaps.find((g) => g.kind === 'folder');
    expect(fileGap?.extensions).toEqual(['gitignore-ext']);
    expect(folderGap?.fileNames).toEqual(['.git']);
  });
});
