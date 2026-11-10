"""Beadup social profile images: avatar + banners for each network.

python -I make_social.py <repo root>
Uses the 3D bead render and Sora, on the brand's Midnight with a Bead Blue glow.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(sys.argv[1])
OUT = ROOT / "docs/marketing/social"
BEAD = Image.open(ROOT / "apps/mobile/assets/source/bead-transparent.png").convert("RGBA")
BEAD = BEAD.crop(BEAD.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox())
_s = max(BEAD.size)
_sq = Image.new("RGBA", (_s, _s), (0, 0, 0, 0))
_sq.paste(BEAD, ((_s - BEAD.width) // 2, (_s - BEAD.height) // 2))
BEAD = _sq
FONTS = ROOT / "apps/mobile/node_modules/@expo-google-fonts"
SORA_B = str(FONTS / "sora/700Bold/Sora_700Bold.ttf")
INTER = str(FONTS / "inter/500Medium/Inter_500Medium.ttf")
MIDNIGHT, BLUE, WHITE, STEEL = (10, 12, 16), (77, 216, 255), (244, 246, 250), (154, 163, 178)


def glow(img, cx, cy, r, color, alpha):
    layer = Image.new("L", img.size, 0)
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=alpha)
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.55))
    img.paste(Image.new("RGB", img.size, color), (0, 0), layer)


def bead(img, cx, cy, size):
    b = BEAD.resize((size, size), Image.LANCZOS)
    img.paste(b, (int(cx - size / 2), int(cy - size / 2)), b)


def avatar(px=1080):
    img = Image.new("RGB", (px, px), MIDNIGHT)
    glow(img, px / 2, px / 2, px * 0.42, BLUE, 90)
    bead(img, px / 2, px / 2, int(px * 0.62))  # stays inside the circle crop
    img.save(OUT / "avatar-1080.png", optimize=True)


def banner(name, w, h, safe_w=None):
    """Bead + wordmark + line, centred inside the network's safe area."""
    img = Image.new("RGB", (w, h), MIDNIGHT)
    sw = safe_w or w
    unit = min(h, sw / 3.2)
    bs = int(unit * 0.62)
    title = ImageFont.truetype(SORA_B, int(unit * 0.30))
    line = ImageFont.truetype(INTER, int(unit * 0.085))
    url = ImageFont.truetype(SORA_B, int(unit * 0.085))
    d = ImageDraw.Draw(img)
    t1, t2, t3 = "Beadup", "Quote, book and get paid. Built for mobile detailers.", "beadup.app"
    tw = max(d.textlength(t1, font=title), d.textlength(t2, font=line))
    gap = unit * 0.12
    total = bs + gap + tw
    x0 = (w - total) / 2
    cy = h / 2
    glow(img, x0 + bs / 2, cy, bs * 0.75, BLUE, 80)
    bead(img, x0 + bs / 2, cy, bs)
    tx = x0 + bs + gap
    d.text((tx, cy - unit * 0.06), t1, font=title, fill=WHITE, anchor="ls")
    d.text((tx, cy + unit * 0.10), t2, font=line, fill=STEEL, anchor="ls")
    d.text((tx, cy + unit * 0.24), t3, font=url, fill=BLUE, anchor="ls")
    img.save(OUT / f"{name}.png", optimize=True)


avatar()
banner("facebook-cover-1640x624", 1640, 624, safe_w=1200)
banner("x-header-1500x500", 1500, 500)
banner("linkedin-banner-1584x396", 1584, 396)
banner("youtube-banner-2560x1440", 2560, 1440, safe_w=1546)
print("done")
