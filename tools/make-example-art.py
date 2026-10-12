"""Generates the abstract placeholder art in examples/art. Files are named after
the example cards, since images match cards by name.

Run: python3 tools/make-example-art.py

Needs Pillow. Output is deterministic (seeded), so re-running produces the same files.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "examples" / "art"
W, H = 900, 700

PALETTES = {
    "ember.jpg": [(40, 10, 5), (180, 50, 20), (250, 160, 50), (255, 230, 150)],
    "cinder.jpg": [(25, 20, 18), (90, 40, 30), (200, 80, 30), (120, 110, 100)],
    "tide.jpg": [(5, 20, 45), (20, 80, 130), (60, 160, 190), (200, 240, 250)],
    "coral.jpg": [(10, 40, 50), (40, 120, 130), (230, 120, 110), (250, 200, 170)],
    "block-party-boss.jpg": [(20, 5, 35), (150, 20, 120), (255, 60, 160), (255, 220, 80)],
    "corner-lookout.jpg": [(15, 18, 22), (50, 60, 70), (40, 190, 200), (230, 230, 220)],
    "night-shift.jpg": [(8, 6, 30), (50, 30, 120), (120, 90, 240), (255, 200, 120)],
    "gold-chain.jpg": [(30, 18, 5), (130, 80, 10), (250, 190, 40), (255, 245, 200)],
    "kindling.jpg": [(35, 15, 8), (120, 60, 30), (230, 140, 60), (250, 220, 170)],
    "still-waters.jpg": [(10, 25, 40), (40, 90, 120), (120, 170, 200), (220, 240, 245)],
    "mixtape-drop.jpg": [(10, 30, 15), (30, 110, 60), (110, 210, 90), (240, 250, 200)],
    "mossback-warden.jpg": [(12, 25, 12), (40, 80, 35), (110, 150, 70), (210, 220, 170)],
    "archivist-of-ash.jpg": [(15, 15, 30), (50, 60, 120), (190, 90, 60), (240, 220, 190)],
    "fallen-paladin.jpg": [(20, 18, 15), (90, 85, 75), (200, 190, 160), (120, 30, 25)],
    "the-hollow-sage.jpg": [(8, 10, 8), (30, 40, 30), (70, 100, 120), (180, 200, 160)],
    "wildfire-chorus.jpg": [(30, 10, 10), (40, 110, 60), (60, 100, 190), (250, 200, 80)],
    "iron-recruit.jpg": [(18, 18, 20), (60, 62, 68), (130, 130, 135), (220, 215, 205)],
    "plague-rat-swarm.jpg": [(15, 18, 10), (55, 60, 30), (120, 115, 60), (200, 190, 140)],
    "cleaving-strike.jpg": [(25, 8, 5), (120, 30, 20), (220, 90, 40), (250, 220, 180)],
    "arcane-bolt.jpg": [(5, 8, 30), (30, 50, 140), (90, 160, 240), (230, 240, 255)],
    "rally.jpg": [(30, 25, 15), (120, 110, 80), (230, 220, 180), (60, 120, 70)],
    "shadowstep.jpg": [(5, 6, 10), (20, 30, 50), (60, 80, 110), (150, 170, 190)],
    "venom-coat.jpg": [(8, 15, 5), (40, 80, 20), (140, 190, 40), (220, 240, 120)],
    "ruinous-barrage.jpg": [(20, 5, 15), (90, 20, 40), (200, 60, 50), (120, 140, 200)],
    "brace.jpg": [(20, 20, 22), (70, 72, 78), (150, 150, 155), (230, 225, 210)],
    "wildfire.jpg": [(30, 8, 4), (150, 40, 15), (240, 120, 30), (255, 210, 120)],
    "riptide.jpg": [(4, 15, 35), (15, 60, 110), (40, 140, 180), (210, 245, 250)],
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(name, colors, seed):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        row = lerp(colors[0], colors[1], t / 0.6) if t < 0.6 else lerp(colors[1], colors[0], (t - 0.6) / 0.4 * 0.5)
        for x in range(W):
            px[x, y] = row
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for _ in range(60):
        r = rnd.randint(20, 160)
        cx, cy = rnd.randint(-50, W + 50), rnd.randint(-50, H + 50)
        c = colors[rnd.randint(1, 3)]
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c + (rnd.randint(40, 120),))
    for i in range(6):
        amp, phase, base = rnd.randint(20, 60), rnd.random() * math.tau, rnd.randint(H // 3, H)
        pts = [(x, base + amp * math.sin(x / 90 + phase)) for x in range(0, W + 10, 10)]
        draw.line(pts, fill=colors[3] + (90,), width=rnd.randint(3, 10))
    layer = layer.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    img.save(OUT / name, quality=85)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, colors) in enumerate(PALETTES.items()):
        make(name, colors, seed=i + 1)
        print("wrote", OUT / name)
