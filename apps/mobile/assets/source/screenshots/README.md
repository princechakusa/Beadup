# App Store screenshots

`apps/mobile/assets/store/ios-6.9-*.png`: iPhone 6.9" (1290 x 2796), upload in number order.
Real app screens in demo mode (Marcus Shine Co.), captured in a browser at iPhone size.

Re-make them after design changes:
1. `cd apps/mobile`, then build a single-page dev export in demo mode with the real link shown:
   `BEADUP_WEB_SPA=1 EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_ANON_KEY= EXPO_PUBLIC_API_URL=https://beadup.netlify.app npx expo export --platform web --dev`
2. Copy `node_modules/canvaskit-wasm/bin/full/canvaskit.{js,wasm}` into `dist/` and change `dist/index.html`
   so the app bundle loads after `CanvasKitInit` (Skia needs CanvasKit on the web).
3. `node serve.js <abs path to apps/mobile/dist>` (port 4410: Windows reserves 8082-8181 here) and run the
   booking site in demo mode on 3311 (`apps/web`, Supabase/Turnstile env vars empty, `npx next dev -p 3311`).
4. `node capture.js <out dir>` then `python compose.py <out dir> apps/mobile/node_modules/@expo-google-fonts`.
