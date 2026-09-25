"""Validate genuine alpha and create exact lossless WebP; originals untouched."""
from pathlib import Path
from PIL import Image

root = Path('public/relics')
for number in range(26, 32):
    sources = list(root.glob(f'fusion_{number}_*_source.png'))
    assert len(sources) == 1, sources
    source = sources[0]
    with Image.open(source) as image:
        assert image.mode == 'RGBA', f'No alpha: {source}'
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255), source
        # Ignore nearly transparent generated noise when checking silhouette.
        bounds = alpha.point(lambda a: 255 if a >= 16 else 0).getbbox()
        w, h = image.size
        left, top, right, bottom = bounds
        margins = (left, top, w-right, h-bottom)
        assert min(margins) > 0, f'Clipped: {source}: {margins}'
        target = source.with_name(source.name.replace('_source.png', '.webp'))
        image.save(target, 'WEBP', lossless=True, exact=True, method=6)
        with Image.open(target) as decoded:
            assert image.tobytes() == decoded.convert('RGBA').tobytes(), target
        print(f'{target.name}: {w}x{h}, margins={margins}, {target.stat().st_size} bytes, RGBA exact')
