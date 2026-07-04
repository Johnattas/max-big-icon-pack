import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAfileicon } from '../lib/parse-afileicon';

const JSON_PATH = resolve(
  __dirname,
  '../../../AFileIcon-master/icons/icons.json'
);

describe('parseAfileicon', () => {
  it('extrai extensões e cor por file_type', () => {
    const entries = parseAfileicon(JSON_PATH);
    const ada = entries.find((e) => e.concept === 'file_type_ada');
    expect(ada?.extensions).toEqual(
      expect.arrayContaining(['ada', 'adb', 'ads'])
    );
    expect(ada?.color).toBe('red');
    const access = entries.find((e) => e.concept === 'file_type_access');
    expect(access?.extensions).toEqual(
      expect.arrayContaining(['accdb', 'mdw'])
    );
  });
});
