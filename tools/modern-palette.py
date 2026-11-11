"""Genera una versión "moderna" de la paleta de cosmo-art: colores apagados y oscuros (polímero, acero, oliva)
en lugar de los verdes y colores saturados de juguete. Uso: python3 tools/modern-palette.py"""
import colorsys
from PIL import Image

src = "raw/cosmo-low-poly-guns/uv_palette.png"
dst = "raw/cosmo-low-poly-guns/uv_palette_modern.png"
im = Image.open(src).convert("RGB")
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b = (c / 255 for c in px[x, y])
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        s *= 0.18                      # casi sin saturación: tonos militares
        l = 0.07 + l * 0.42            # rango oscuro: de polímero negro a acero gris
        if 0.17 < h < 0.45:            # los verdes pasan a verde oliva apagado
            s, l = 0.22, 0.13 + l * 0.35
        r, g, b = colorsys.hls_to_rgb(h, l, s)
        px[x, y] = tuple(round(c * 255) for c in (r, g, b))
im.save(dst)
print("ok", dst)
