import { readFileSync } from 'node:fs';
// @ts-expect-error - cson sem tipos
import CSON from 'cson';
import type { AtomEntry, IconKind } from './types';

export function normalizeMatch(match: unknown): {
  extensions: string[];
  fileNames: string[];
} {
  const extensions = new Set<string>();
  const fileNames = new Set<string>();

  const handleString = (s: string) => {
    const t = s.startsWith('.') ? s.slice(1) : s;
    if (t) extensions.add(t.toLowerCase());
  };

  const handleRegex = (re: RegExp) => {
    const src = re.source;
    // fileName: /^\.name$/  (nome literal iniciado por ponto, sem metacaracteres)
    const nameM = src.match(/^\^\\\.([\w.-]+)\$$/);
    if (nameM) {
      fileNames.add(`.${nameM[1]}`);
      return;
    }
    // extensão simples: /\.ext$/  ou  /\.(a|b|c)$/
    const extM = src.match(/\\\.\(?([\w+|.-]+)\)?\$$/);
    if (extM) {
      for (const part of extM[1].split('|')) {
        const clean = part.replace(/[^\w+.-]/g, '');
        if (clean) extensions.add(clean.toLowerCase());
      }
    }
    // demais padrões (path-based etc.) são ignorados de propósito
  };

  const visit = (m: unknown) => {
    if (m == null) return;
    if (typeof m === 'string') return handleString(m);
    if (m instanceof RegExp) return handleRegex(m);
    if (Array.isArray(m)) {
      for (const item of m) {
        // item pode ser [pattern, colour, ...] ou pattern direto
        visit(Array.isArray(item) ? item[0] : item);
      }
    }
  };

  visit(match);
  return { extensions: [...extensions], fileNames: [...fileNames] };
}

/**
 * Resolve a cor de uma entrada. A maioria declara `colour` no nível do
 * objeto, mas algumas (ex.: Agda em fileIcons) só carregam a cor dentro do
 * array `match`, no formato [pattern, colour, ...props]. Nesses casos usamos
 * a cor da primeira variante como representativa da entrada.
 */
function resolveColour(e: Record<string, unknown>): string | null {
  if (typeof e.colour === 'string') return e.colour;
  if (Array.isArray(e.match)) {
    for (const item of e.match) {
      if (Array.isArray(item) && typeof item[1] === 'string') {
        return item[1];
      }
    }
  }
  return null;
}

function section(obj: Record<string, any>, kind: IconKind): AtomEntry[] {
  const out: AtomEntry[] = [];
  for (const key of Object.keys(obj)) {
    const e = obj[key];
    if (!e || typeof e !== 'object' || !e.icon) continue;
    const { extensions, fileNames } = normalizeMatch(e.match);
    out.push({
      concept: String(e.icon),
      kind,
      extensions,
      fileNames,
      colour: resolveColour(e),
      priority: typeof e.priority === 'number' ? e.priority : 1,
    });
  }
  return out;
}

export function parseConfigCson(csonPath: string): AtomEntry[] {
  const raw = readFileSync(csonPath, 'utf8');
  const data = CSON.parse(raw) as {
    fileIcons?: Record<string, any>;
    directoryIcons?: Record<string, any>;
  };
  return [
    ...section(data.fileIcons ?? {}, 'file'),
    ...section(data.directoryIcons ?? {}, 'folder'),
  ];
}
