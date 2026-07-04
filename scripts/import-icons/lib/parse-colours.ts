import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
// @ts-expect-error - less não tem tipos default satisfatórios aqui
import less from 'less';

export async function parseColours(
  coloursLessPath: string
): Promise<Map<string, string>> {
  const src = await readFile(coloursLessPath, 'utf8');
  // Nomes de variáveis LESS declaradas: `@nome: ...;`
  const names = Array.from(
    new Set(Array.from(src.matchAll(/^@([a-zA-Z][\w-]*)\s*:/gm), (mm) => mm[1]))
  );
  const rules = names.map((n) => `.c-${n}{color:@${n};}`).join('\n');
  const program = `${src}\n${rules}\n`;
  const out = await less.render(program, { paths: [dirname(coloursLessPath)] });
  const css: string = out.css;
  const map = new Map<string, string>();
  for (const m of css.matchAll(
    /\.c-([\w-]+)\s*\{\s*color:\s*([^;}]+)\s*;?\s*\}/g
  )) {
    const normalized = normalizeHex(m[2].trim());
    if (normalized !== null) {
      map.set(m[1], normalized);
    }
  }
  return map;
}

function normalizeHex(v: string): string | null {
  // less pode emitir #abc, #aabbcc ou rgb(...)
  const short = v.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const s = short[1];
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }
  const full = v.match(/^#([0-9a-fA-F]{6})$/);
  if (full) return `#${full[1].toLowerCase()}`;
  const rgb = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const h = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${h(rgb[1])}${h(rgb[2])}${h(rgb[3])}`;
  }
  return null;
}
