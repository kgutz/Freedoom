"""Prepare static WebP backgrounds from the original Temple PNGs."""
from pathlib import Path
from PIL import Image

source = Path(r'C:\Users\tripe\Downloads\FREEDOOM\VIDEOS\BG')
target = Path(__file__).resolve().parents[1] / 'public' / 'hero_background'
variants = [
    ('magnific_recompose-the-exact-appro_templo-fondo-heroe-11_ovkCzU7829.png', 'azariel_temple.webp', 768),
    ('magnific_recompose-the-exact-appro_templo-fondo-heroe-219_LwZOCV2swO.png', 'azariel_temple_wide.webp', 960),
]
for original, output, width in variants:
    with Image.open(source / original) as image:
        height = round(image.height * width / image.width)
        resized = image.convert('RGB').resize((width, height), Image.Resampling.NEAREST)
        resized.save(target / output, 'WEBP', quality=88, method=6)
        print(output, resized.size, (target / output).stat().st_size)
