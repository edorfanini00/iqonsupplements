#!/usr/bin/env python3
"""Downscaled WebP variants of approved editorial images for srcset (same image and crop).

Each variant is `<name>-<width>w.webp` beside its source; the source itself remains the
largest srcset candidate. Requires Pillow with WebP support. Re-run after replacing a source:

    python3 scripts/responsive-images.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public"
# Keep in sync with lib/responsive-images.ts.
QUALITY = {"/images/editorial/iqon-coastal-mobile-v32.webp": 86}  # the LCP photograph; others use 82
VARIANTS = {
    "/images/editorial/iqon-coastal-mobile-v32.webp": [640, 750],
    "/images/editorial/supplement-campaign-mobile-v12.webp": [750],
    "/images/editorial/news-reading-labels-iqon-v11.webp": [480, 768],
    "/images/editorial/daily-water-v24.webp": [480, 768],
    "/images/editorial/skincare-ritual-v26.webp": [480, 768],
    "/images/supplements/12_hero_creatine_scoop.webp": [480, 720],
    "/images/supplements/16_hero_colostrum_open.webp": [480, 720],
}

for src, widths in VARIANTS.items():
    path = ROOT / src.lstrip("/")
    with Image.open(path) as image:
        image.load()
        for width in widths:
            assert width < image.width, f"{src}: {width}w is not smaller than {image.width}px"
            height = round(image.height * width / image.width)
            out = path.with_name(f"{path.stem}-{width}w.webp")
            image.resize((width, height), Image.LANCZOS).save(out, "WEBP", quality=QUALITY.get(src, 82), method=6)
            print(f"{out.relative_to(ROOT)} {width}x{height} {out.stat().st_size} bytes (source {path.stat().st_size})")
