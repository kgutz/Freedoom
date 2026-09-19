"""Lossless WebP derivatives; source PNGs and pixel dimensions are preserved."""
from pathlib import Path
from PIL import Image, ImageChops

for source in sorted(Path('public/relics').glob('fusion_2*_source.png')):
    target = source.with_name(source.name.replace('_source.png', '.webp'))
    with Image.open(source) as img:
        rgba = img.convert('RGBA')
        rgba.save(target, 'WEBP', lossless=True, exact=True, method=6)
        with Image.open(target) as decoded:
            assert decoded.size == rgba.size
            assert rgba.tobytes() == decoded.convert('RGBA').tobytes(), target
        print(f'{target.name}: {source.stat().st_size} -> {target.stat().st_size} bytes, RGBA identical')
