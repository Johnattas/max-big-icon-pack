#!/usr/bin/env python3
"""Extrai um glifo de uma fonte (woff2) como SVG colorido.

Uso: extract-glyph.py <woff2> <codepointHex> <fillHex> <outSvg>
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen


def glyph_name_for_codepoint(font, cp):
    cmap = font.getBestCmap()
    return cmap.get(cp)


def main():
    if len(sys.argv) != 5:
        print("uso: extract-glyph.py <woff2> <cpHex> <fillHex> <out>", file=sys.stderr)
        return 2
    woff2, cp_hex, fill, out = sys.argv[1:5]
    cp = int(cp_hex, 16)

    font = TTFont(woff2)
    gname = glyph_name_for_codepoint(font, cp)
    if gname is None:
        print(f"codepoint U+{cp_hex} ausente em {woff2}", file=sys.stderr)
        return 3

    upm = font["head"].unitsPerEm
    glyph_set = font.getGlyphSet()
    pen = SVGPathPen(glyph_set)
    glyph_set[gname].draw(pen)
    d = pen.getCommands()
    if not d:
        print(f"glifo {gname} vazio", file=sys.stderr)
        return 4

    # Fontes têm y para cima; SVG tem y para baixo. Espelhar via transform.
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {upm} {upm}">'
        f'<g transform="translate(0,{upm}) scale(1,-1)">'
        f'<path fill="{fill}" d="{d}"/>'
        f"</g></svg>\n"
    )
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
