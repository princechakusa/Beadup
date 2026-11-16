# Trade landing photos: prompts

Used for the hero photo at the top of each `/for/<trade>` page (`apps/web/public/hero/trades/<slug>.webp`, 1280 x 731). The same scene text works in Google Stitch, the free Hugging Face FLUX space (`apps/web/scripts/trade-hero-gen.py`), ElevenLabs or any image tool.

**Shared style (add to every prompt):**
`Cinematic wide photograph, moody dark premium commercial look with deep midnight blue ambience and a soft cyan rim light, shallow depth of field, 35mm lens, generic unbranded, no text, no logos, no brand names, no signs.`

**Rules:** no readable brand names, number plates or signs; no recognisable real person; hands, backs of heads and side views are fine. Always look at the picture before using it.

For Stitch, wrap the scene like this (it creates the photo as its own image screen):
`A dark premium landing page hero for a {trade} booking service: a full-bleed photograph of {scene}. {shared style}`

| Page (slug) | Scene |
|---|---|
| car-detailers | a mobile car detailer polishing a generic dark SUV with no badges in a driveway at dusk, water beads on glossy paint |
| boat-rv-detailers | a worker polishing the white hull of a boat at a marina at dusk, water droplets, glossy fibreglass reflections |
| pressure-washing | a pressure washer cleaning a stone patio, half clean and half dirty, spray mist glowing in evening light |
| window-cleaners | a window cleaner with a squeegee cleaning a large glass window of a modern house at dusk, streak-free reflections |
| house-cleaners | a cleaner tidying a bright modern living room, folded throw on the sofa, soft evening light through the window, no people |
| pet-groomers | a groomer brushing a friendly golden retriever on a grooming table in a clean warm studio |
| hair-salons | a stylist blow-drying a client's long wavy hair in a modern salon with a large mirror and soft studio lights, client seen from behind |
| barbers | a barber trimming a client's beard in a dark barbershop with a leather chair and warm lamp light |
| nail-technicians | a manicurist painting a glossy deep blue nail, close-up of hands only, soft studio light |
| makeup-artists | a makeup artist applying eyeshadow with a brush, close-up of hands and brush beside a palette, soft glamour lighting, no face visible |
| mobile-mechanics | a mobile mechanic checking the engine of a generic car with the hood open in a driveway at dusk, work light glowing |
| handymen | a handyman fitting a shelf with a drill in a modern home interior, warm lamp light |

After adding a photo, add its slug to `apps/web/src/content/trade-heroes.ts` (a unit test checks the list matches the files).
