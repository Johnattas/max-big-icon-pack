import { describe, expect, it } from 'vitest';
import { renderReport } from '../lib/report';

describe('renderReport', () => {
  it('conta por fonte e lista pulados', () => {
    const md = renderReport(
      [
        {
          concept: 'pinia',
          kind: 'file',
          iconFile: 'pinia.svg',
          extensions: ['pinia'],
          fileNames: [],
          source: 'atom',
        },
        {
          concept: 'file_type_deno',
          kind: 'file',
          iconFile: 'file_type_deno.png',
          extensions: ['deno'],
          fileNames: [],
          source: 'afileicon',
        },
      ],
      [{ concept: 'binary', reason: 'octicons não extraível' }]
    );
    expect(md).toContain('atom: 1');
    expect(md).toContain('afileicon: 1');
    expect(md).toContain('binary');
    expect(md).toContain('octicons');
  });
});
