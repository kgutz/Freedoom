"""Generate delivery-sized WebP assets while preserving the source artwork.

The originals remain untouched so future art edits never start from a compressed
copy. Only assets rendered by the app are included; share art and concept boards
intentionally keep their original resolution.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def app_images():
    fixed = [
        PUBLIC / "logo.png",
        PUBLIC / "backgrounds" / "onboarding_bg.png",
        PUBLIC / "backgrounds" / "habits_training_bg.png",
        PUBLIC / "hunt" / "world-map.jpg",
        PUBLIC / "hunt" / "fields-of-mist" / "region.png",
        PUBLIC / "rewards" / "pioneer-chest.png",
        PUBLIC / "ui" / "backpack.png",
    ]
    class_ids = ("knight", "paladin", "sorcerer", "druid")
    fixed.extend(PUBLIC / "hero_background" / f"{class_id}_bg.png" for class_id in class_ids)
    fixed.extend(PUBLIC / "hero_background" / f"{class_id}_today_bg.png" for class_id in class_ids)
    patterns = [
        "hero_face/*.png",
        "sprites/*.png",
        "outfits/**/*.png",
        "hunt/fields-of-mist/*.png",
        "bosses/*.png",
        "relics/*.png",
        "potions/*.png",
        "spells/**/*.png",
    ]
    found = list(fixed)
    for pattern in patterns:
        found.extend(PUBLIC.glob(pattern))
    return sorted({path for path in found if path.exists()})


def delivery_size(path, width, height):
    relative = path.relative_to(PUBLIC).as_posix()
    if relative == "hunt/world-map.jpg":
        return min(width, 840), min(height, 840)
    if relative == "hunt/fields-of-mist/region.png" and width > 840:
        return 840, round(height * 840 / width)
    if relative.startswith("hunt/fields-of-mist/") and relative != "hunt/fields-of-mist/region.png":
        scale = min(1, 384 / max(width, height))
        return round(width * scale), round(height * scale)
    return width, height


def optimize(path):
    destination = path.with_suffix(".webp")
    with Image.open(path) as source:
        source.load()
        target_size = delivery_size(path, *source.size)
        image = source
        if target_size != source.size:
            image = source.resize(target_size, Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=95, method=6, exact=True)
    return destination


if __name__ == "__main__":
    total_before = 0
    total_after = 0
    for source in app_images():
        destination = optimize(source)
        before = source.stat().st_size
        after = destination.stat().st_size
        total_before += before
        total_after += after
        print(
            f"{source.relative_to(PUBLIC).as_posix():62} "
            f"{before / 1024:7.1f} KB -> {after / 1024:7.1f} KB"
        )
    saved = 100 * (1 - total_after / total_before) if total_before else 0
    print(
        f"TOTAL {total_before / 1024 / 1024:.2f} MB -> "
        f"{total_after / 1024 / 1024:.2f} MB ({saved:.1f}% less)"
    )
