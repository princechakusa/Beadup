import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
S, F = sys.argv[1], sys.argv[2]
W, H = 1290, 2796
MID, BEAD = (10, 12, 16), (77, 216, 255)
sora = ImageFont.truetype(F + '/sora/800ExtraBold/Sora_800ExtraBold.ttf', 104)
inter = ImageFont.truetype(F + '/inter/600SemiBold/Inter_600SemiBold.ttf', 40)
SHOTS = [
  ('1-today', 'Your day, your jobs,', 'your money'),
  ('2-quote', 'Photos in,', 'priced quote out'),
  ('3-calendar', 'Every job, every hour,', 'at a glance'),
  ('4-booking', 'One link. Clients', 'book in a minute'),
  ('5-money', 'Know what this month', 'brought in'),
  ('6-payment', 'Deposits go', 'straight to you'),
]
def compose(name, l1, l2):
    img = Image.new('RGB', (W, H), MID)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W*0.5-760, -520, W*0.5+760, 900), fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    img.paste(Image.new('RGB', (W, H), BEAD), (0, 0), glow.point(lambda v: int(v*0.55)))
    d = ImageDraw.Draw(img)
    d.text((W/2, 150), 'BEADUP', font=inter, fill=BEAD, anchor='mm')
    d.text((W/2, 300), l1, font=sora, fill=(244, 246, 250), anchor='mm')
    d.text((W/2, 430), l2, font=sora, fill=(244, 246, 250), anchor='mm')
    shot = Image.open(f'{S}/raw-{name}.png').convert('RGB')
    sh = 2160; sw = round(shot.width * sh / shot.height)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x, y, r = (W - sw)//2, 570, 78
    # soft bead-blue glow and shadow behind the phone screen
    halo = Image.new('L', (W, H), 0)
    ImageDraw.Draw(halo).rounded_rectangle((x-10, y+30, x+sw+10, y+sh+40), r+10, fill=150)
    halo = halo.filter(ImageFilter.GaussianBlur(60))
    img.paste(Image.new('RGB', (W, H), (16, 70, 92)), (0, 0), halo)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw-1, sh-1), r, fill=255)
    img.paste(shot, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle((x, y, x+sw-1, y+sh-1), r, outline=(52, 60, 74), width=3)
    img.save(f'{S}/store-{name}.png', optimize=True)
    return f'store-{name}.png'
for n, a, b in SHOTS:
    print(compose(n, a, b))
