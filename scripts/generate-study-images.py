#!/usr/bin/env python3
"""Generate 8 AI visualization images for the Jeddah food-manufacturing feasibility study.

Images are fetched from Pollinations.ai (free, no-key image generation API) using the
visual prompts supplied by the project owner. Each image is saved as a WebP in
assets/study-images/food-manufacturing-jeddah/.

If the original composite image is available later, these can be replaced easily.
"""
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "study-images" / "food-manufacturing-jeddah"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Shared style anchor to keep the 8 renders visually coherent.
STYLE_ANCHOR = (
    "Ultra realistic, photorealistic, professional architectural photography, "
    "modern Saudi industrial food facility, clean premium finish, soft natural lighting, "
    "no text, no watermark, no logos, no people unless specified, 8K detail"
)

IMAGES = [
    {
        "name": "01-exterior",
        "caption": "المنظور الخارجي للمصنع",
        "prompt": (
            "Ultra realistic architectural visualization of a modern food processing factory in Jeddah, Saudi Arabia. "
            "Premium industrial architecture. White concrete with charcoal gray aluminum panels. "
            "Large glass entrance. Gold corporate logo accent. Minimalist luxury industrial design. "
            "Two refrigerated trucks. Large loading docks. Wide roads. Palm trees. Saudi flags. "
            "Solar panels. Night lighting. Very clean. Corporate headquarters style. "
            "High-end food manufacturing campus. Aerial view."
        ),
    },
    {
        "name": "02-reception",
        "caption": "الاستقبال والإدارة",
        "prompt": (
            "Luxury reception of a premium food manufacturing company. Double-height lobby. "
            "Italian marble floors. Glass walls. Gold logo accent. Modern reception desk. "
            "Waiting lounge. Executive offices. Large digital screens. Minimalist architecture. "
            "Natural lighting. Indoor plants. Saudi corporate style."
        ),
    },
    {
        "name": "03-meat",
        "caption": "قسم تصنيع اللحوم",
        "prompt": (
            "Ultra modern meat processing hall. Stainless steel production lines. "
            "Automatic meat cutting. Grinding. Burger patty production. Vacuum packaging. "
            "HACCP compliant. Workers wearing clean white uniforms and hairnets. "
            "Bright white lighting. Food grade epoxy flooring. Very clean. Industrial automation."
        ),
    },
    {
        "name": "04-poultry",
        "caption": "قسم الدواجن",
        "prompt": (
            "Modern poultry processing facility. Chicken fillet production. Nuggets. Strips. "
            "Marinated chicken. Automatic production line. Food safety standards. "
            "Stainless steel equipment. Cold environment. Bright lighting. "
            "Premium industrial food factory."
        ),
    },
    {
        "name": "05-salads-fruits",
        "caption": "قسم السلطات والفواكه",
        "prompt": (
            "Fresh vegetables and fruit processing facility. Automatic washing machines. "
            "Cutting machines. Packing stations. Fresh salads. Fresh fruit. Dried fruit section. "
            "Colorful environment. Premium food processing. Ultra clean. Luxury food factory."
        ),
    },
    {
        "name": "06-cold-storage",
        "caption": "غرف التبريد والتجميد",
        "prompt": (
            "Large refrigerated warehouse. Cold storage. Frozen storage. High pallet racks. "
            "Forklifts. Barcode system. Temperature monitoring screens. Modern logistics. "
            "Industrial refrigeration. Very clean. Blue LED lighting."
        ),
    },
    {
        "name": "07-loading",
        "caption": "منطقة التحميل واللوجستيات",
        "prompt": (
            "Modern loading docks. Refrigerated trucks. Warehouse logistics. Barcode scanning. "
            "Forklifts. Loading ramps. Cold chain logistics. Large industrial facility. "
            "Clean concrete yard. Professional operations. Saudi Arabia."
        ),
    },
    {
        "name": "08-masterplan",
        "caption": "المنظور الجوي الكامل للمشروع",
        "prompt": (
            "Masterplan of a modern integrated food manufacturing campus. Administration building. "
            "Meat factory. Chicken factory. Fruit processing building. Cold storage warehouse. "
            "Logistics warehouse. Loading docks. Parking. Green landscape. Palm trees. "
            "Solar panels. Saudi industrial architecture. Premium investment project. Drone aerial view."
        ),
    },
]


def fetch_image(prompt: str, seed: int, width: int = 1280, height: int = 720) -> bytes:
    full_prompt = f"{prompt}. {STYLE_ANCHOR}"
    encoded = urllib.parse.quote(full_prompt)
    url = (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}&seed={seed}&nologo=true&no_seed_check=true"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/*",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def main():
    from PIL import Image
    from io import BytesIO

    failures = []
    for idx, item in enumerate(IMAGES, start=1):
        out_path = OUT_DIR / f"{item['name']}.webp"
        if out_path.exists() and out_path.stat().st_size > 10000:
            print(f"[{idx}/8] {out_path.name} already exists, skipping.")
            continue

        print(f"[{idx}/8] Generating {out_path.name} ...", flush=True)
        try:
            seed = 100 + idx
            data = fetch_image(item["prompt"], seed)
            img = Image.open(BytesIO(data))
            # Convert RGBA to RGB if needed
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Save as WebP for smaller file size
            img.save(out_path, "WEBP", quality=88, method=6)
            print(f"       Saved {out_path.name} ({out_path.stat().st_size // 1024} KB)", flush=True)
        except Exception as exc:
            print(f"       FAILED {out_path.name}: {exc}", file=sys.stderr)
            failures.append(out_path.name)
        # Small polite delay between requests
        time.sleep(0.5)

    if failures:
        print(f"\n[!] Failures: {', '.join(failures)}", flush=True)
        sys.exit(1)
    print("\n[OK] All study images generated successfully.", flush=True)


if __name__ == "__main__":
    main()
