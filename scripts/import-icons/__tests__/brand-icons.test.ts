import { describe, expect, it } from 'vitest';
import { compositeFolder } from '../lib/brand-icons';

const SHAPE = 'm1 1h4v4h-4z';

describe('compositeFolder', () => {
  it('desenha a pasta na cor da marca + o motivo (logo branco)', () => {
    const motive =
      '<svg x="5.7" y="4.8" width="8.8" height="8.8" viewBox="0 0 24 24"><path fill="#fff" d="M2 2"/></svg>';
    const out = compositeFolder(SHAPE, '#635BFF', motive);
    expect(out).toContain('viewBox="0 0 16 16"'); // moldura da pasta
    expect(out).toContain(`fill="#635BFF" d="${SHAPE}"`); // corpo na cor da marca
    expect(out).toContain('<svg x="'); // motivo aninhado
    expect(out).toContain('fill="#fff"'); // logo em branco
  });

  it('embute um motivo PNG (<image>)', () => {
    const motive =
      '<image x="5.7" y="4.8" width="8.8" height="8.8" href="data:image/png;base64,AAAA"/>';
    const out = compositeFolder(SHAPE, '#42a5f5', motive);
    expect(out).toContain('<image');
    expect(out).toContain('data:image/png;base64,AAAA');
    expect(out).toContain('fill="#42a5f5"');
  });
});
