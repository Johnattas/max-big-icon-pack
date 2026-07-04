import { describe, expect, it } from 'vitest';
import { MIXIN_TO_WOFF2, resolveFont } from '../lib/fonts';

describe('fonts map', () => {
  it('mapeia mixins conhecidos para woff2', () => {
    expect(MIXIN_TO_WOFF2['fi']).toBe('file-icons.woff2');
    expect(MIXIN_TO_WOFF2['devicons']).toBe('devopicons.woff2');
    expect(MIXIN_TO_WOFF2['fa']).toBe('fontawesome.woff2');
    expect(MIXIN_TO_WOFF2['mf']).toBe('mfixx.woff2');
  });
  it('octicons não é extraível (null)', () => {
    expect(resolveFont('octicons')).toBeNull();
  });
  it('mixin desconhecido retorna null', () => {
    expect(resolveFont('nope')).toBeNull();
  });
});
