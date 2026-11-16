"""
Makes the trade landing photos (public/hero/trades/<slug>.webp) with the free
Hugging Face space mcp-tools/FLUX.1-Krea-dev. No key needed, but the free
daily GPU quota is small (about 2 images per run per day per network), so run
it again later for the rest: it skips photos that already exist.

  python scripts/trade-hero-gen.py            # every missing trade
  python scripts/trade-hero-gen.py barber     # one trade

After new photos appear, add their slugs to src/content/trade-heroes.ts
(a unit test checks the list matches the files). Always look at each picture:
no readable brand names, plates or faces that look like a real person.
"""
import json, os, sys, time, urllib.request
from io import BytesIO

from PIL import Image

BASE = "https://mcp-tools-flux-1-krea-dev.hf.space/gradio_api"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "hero", "trades")
STYLE = (
    "cinematic wide photograph, deep midnight blue ambience with soft cyan rim light, shallow depth of field, "
    "35mm lens, moody premium commercial photography, generic unbranded, no text, no logos, no brand names, no signs"
)
PROMPTS = {
    "car-detailers": "mobile car detailer polishing a generic dark SUV with no badges in a driveway at dusk, water beads on glossy paint",
    "boat-rv-detailers": "worker polishing the white hull of a boat at a marina at dusk, water droplets, glossy fiberglass reflections",
    "pressure-washing": "pressure washer cleaning a stone patio, half clean half dirty, spray mist glowing in evening light",
    "window-cleaners": "squeegee cleaning a large glass window of a modern house, streak-free reflections of a blue sky at dusk",
    "house-cleaners": "bright tidy modern living room just cleaned, folded throw on sofa, soft evening light through a window, no people",
    "pet-groomers": "friendly golden retriever being groomed on a grooming table, groomer's hands with a brush, warm clean studio, soft rim light",
    "hair-salon": "stylist blow-drying long wavy hair in a modern salon, mirror and soft studio lights, back view of the client",
    "barber": "barber trimming a beard with clippers in a dark barbershop, leather chair, warm lamp and cyan rim light, close side view",
    "nail-technicians": "close-up of a manicurist painting a glossy deep blue nail, hands only, soft studio light",
    "makeup-artists": "makeup artist applying eyeshadow with a brush, close-up of hands and brush with a makeup palette, soft glam lighting, no face visible",
    "mobile-mechanics": "mobile mechanic checking the engine of a generic car with the hood open in a driveway at dusk, work light glowing",
    "handymen": "handyman fitting a shelf with a drill in a modern home interior, tool belt, warm lamp light",
}


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def generate(slug):
    path = os.path.join(OUT, slug + ".webp")
    if os.path.exists(path):
        print(slug, "already there")
        return True
    ev = post(BASE + "/call/infer", {"data": [f"{PROMPTS[slug]}, {STYLE}", 7, True, 1344, 768, 4.5, 28]})["event_id"]
    event = data = None
    with urllib.request.urlopen(BASE + "/call/infer/" + ev, timeout=240) as r:
        for raw in r:
            line = raw.decode().strip()
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
                if event in ("complete", "error"):
                    break
    if event != "complete":
        print(slug, "not made (free quota used up or busy); try again later")
        return False
    img = json.loads(data)[0]
    raw_img = urllib.request.urlopen(img["url"] if isinstance(img, dict) else img, timeout=120).read()
    Image.open(BytesIO(raw_img)).convert("RGB").resize((1280, 731)).save(path, "WEBP", quality=78, method=6)
    print(slug, "saved", os.path.getsize(path) // 1024, "KB")
    return True


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for slug in sys.argv[1:] or list(PROMPTS):
        try:
            if not generate(slug):
                break
        except Exception as e:
            print(slug, "failed:", str(e)[:120])
            break
        time.sleep(2)
