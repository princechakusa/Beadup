const { chromium } = require('C:/Users/Dev Prince/Projects/beadup/apps/web/node_modules/playwright');
const out = process.argv[2];
const only = process.argv[3];
const APP = 'http://127.0.0.1:4410';
const shots = [
  { name: '1-today', url: `${APP}/`, ready: 'Next up' },
  { name: '2-quote', url: `${APP}/quote`, ready: 'New quote', act: async (p) => {
      await p.getByText('Full detail', { exact: true }).first().click();
      await p.getByText('Pet hair removal', { exact: false }).first().click().catch(() => {});
      await p.getByText('Odor treatment', { exact: false }).first().click().catch(() => {});
    } },
  { name: '3-calendar', url: `${APP}/calendar`, ready: 'Calendar' },
  { name: '4-booking', url: 'http://localhost:3311/marcus', act: async (p) => {
      await p.getByRole('radio', { name: /Full detail/ }).click();
      await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
    } },
  { name: '5-money', url: `${APP}/money`, ready: 'Jobs this month' },
  { name: '6-payment', url: `${APP}/settings/payment`, ready: 'Payment link' },
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: 'dark', isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'America/Chicago', locale: 'en-US' });
  for (const s of shots) {
    if (only && !s.name.startsWith(only)) continue;
    const p = await ctx.newPage();
    // A normal Tuesday morning in Austin (the demo business), so the day looks real.
    await p.clock.install({ time: new Date('2026-11-10T08:05:00-06:00') });
    await p.goto(s.url, { waitUntil: 'networkidle', timeout: 120000 });
    if (s.ready) await p.getByText(s.ready, { exact: true }).first().waitFor({ timeout: 60000 }).catch(() => console.log('not ready', s.name));
    await p.waitForTimeout(2500);
    if (s.act) { await s.act(p).catch((e) => console.log('act failed', s.name, String(e.message).slice(0, 120))); await p.waitForTimeout(1200); }
    // Hide development-only warning toasts (never shown to users).
    await p.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        if (el.children.length || !/React does not|recognize the/i.test(el.textContent || '')) continue;
        let n = el;
        while (n && n !== document.body && getComputedStyle(n).position !== 'fixed') n = n.parentElement;
        if (n && n !== document.body) n.style.display = 'none';
      }
    });
    await p.screenshot({ path: `${out}/raw-${s.name}.png`, animations: 'disabled', timeout: 90000, style: '#error-toast{display:none!important}' });
    console.log('shot', s.name);
    await p.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
