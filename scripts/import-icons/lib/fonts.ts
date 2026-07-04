export const MIXIN_TO_WOFF2: Record<string, string | null> = {
  fi: 'file-icons.woff2',
  devicons: 'devopicons.woff2',
  fa: 'fontawesome.woff2',
  mf: 'mfixx.woff2',
  octicons: null, // woff2 não incluído no pacote atom
};

export function resolveFont(mixin: string): string | null {
  return MIXIN_TO_WOFF2[mixin] ?? null;
}
