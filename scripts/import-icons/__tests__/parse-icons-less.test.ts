import { describe, expect, it } from 'vitest';
import { parseIconsLess } from '../lib/parse-icons-less';

const SRC = `
.binary-icon:before       { .octicons; content: "\\f094"; }
.acre-icon:before         { .fi; content: "\\e0a2"; }
.ada-icon:before          { .devicons; content: "\\e6a1"; font-size: 14px; }
`;

describe('parseIconsLess', () => {
  it('extrai fonte+codepoint por nome de ícone', () => {
    const m = parseIconsLess(SRC);
    expect(m.get('acre')).toEqual({
      font: 'file-icons.woff2',
      codepoint: 0xe0a2,
    });
    expect(m.get('ada')).toEqual({
      font: 'devopicons.woff2',
      codepoint: 0xe6a1,
    });
    // octicons -> font null (não extraível)
    expect(m.get('binary')).toEqual({ font: null, codepoint: 0xf094 });
  });
});
