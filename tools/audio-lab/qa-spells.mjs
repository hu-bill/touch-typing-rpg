// In-game QA: cast every school × tier in practice combat, log the audio calls with timing, catch page errors.
import { createRequire } from 'module';
const require = createRequire(process.env.PLAYWRIGHT_DIR || '/home/billh/.npm/_npx/9b9809298fe40d2c/node_modules/');
const { chromium } = require('playwright-core');

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/home/billh/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

await page.addInitScript(() => {
  if (localStorage.getItem('spellstroke.save.v1')) return;
  const ks = {};
  for (const ch of 'asdfjkl') ks[ch] = { n: 120, miss: 0, recent: Array(40).fill(1), ms: Array(40).fill(200), peak: 3 };
  const zones = {};
  for (const id of ['meadow', 'whisperwood', 'ember']) zones[id] = { kills: 4, bossDefeated: false, lessonSeen: true };
  localStorage.setItem('spellstroke.save.v1', JSON.stringify({
    version: 1, player: { level: 20, xp: 0, gold: 120, points: 0, attune: { might: 0, focus: 0, vigor: 0, fortune: 0 } },
    unlockedZone: 2, zones, keyStats: ks, recentWpm: [40, 40, 40], stats: { totalKills: 10 },
    settings: { layout: 'qwerty', guide: 'hints', difficulty: 'adept', difficultyChosen: true, volume: 0.6, shake: true },
  }));
});
await page.goto((process.env.URL || 'http://localhost:5199/'));
await page.waitForTimeout(800);
await page.keyboard.press('Shift'); // user gesture → audio unlock
const g = (fn, arg) => page.evaluate(fn, arg);

await g(() => window.__spellstroke.startPractice(0));
await page.waitForTimeout(600);
// log every spell-audio call
await g(() => {
  const a = window.__spellstroke.audio;
  window.__alog = [];
  for (const m of ['spellNote', 'spellMisnote', 'spellFizzle', 'seal', 'manifest', 'impact', 'bolt', 'shatter']) {
    const orig = a[m];
    a[m] = (...args) => {
      window.__alog.push({ m, t: Math.round(performance.now()), args: JSON.stringify(args).slice(0, 90) });
      return orig(...args);
    };
  }
});

async function prepCard(school, tier) {
  return g(([school, tier]) => {
    const e = window.__spellstroke.screen.engine;
    let idx = 0;
    if (tier === 4) {
      e.flow = 0;
      e.flowLocked = false;
      e.cards = e.cards.filter((c) => c.tier !== 4);
      e.addFlow(100);
      idx = e.cards.findIndex((c) => c.tier === 4);
    }
    const c = e.cards[idx];
    e.cards[idx] = { ...c, school, tier };
    if (idx !== 0) { const t = e.cards[idx]; e.cards.splice(idx, 1); e.cards.unshift(t); }
    e.emit('cardsChanged');
    return e.cards[0].text;
  }, [school, tier]);
}

const summary = [];
for (const school of ['arcane', 'fire', 'frost', 'storm', 'nature', 'ward']) {
  for (const tier of [1, 2, 3, 4]) {
    await g(() => { window.__alog = []; });
    const text = await prepCard(school, tier);
    await page.waitForTimeout(100);
    // one deliberate mistake in the middle
    const mid = Math.floor(text.length / 2);
    await page.keyboard.type(text.slice(0, mid), { delay: 25 });
    await page.keyboard.type('`');
    await page.keyboard.type(text.slice(mid), { delay: 25 });
    await page.waitForTimeout(tier === 4 ? 1500 : 1100);
    const log = await g(() => window.__alog);
    const t0 = log.find((l) => l.m === 'seal')?.t;
    const beats = log.filter((l) => !['spellNote'].includes(l.m)).map((l) => `${l.m}${t0 != null ? `@${l.t - t0}` : ''}`);
    const notes = log.filter((l) => l.m === 'spellNote').length;
    summary.push(`${school.padEnd(6)} t${tier} notes ${String(notes).padStart(2)}/${text.length - 1} | ${beats.join(' ')}`);
  }
}
console.log(summary.join('\n'));

// fizzle, cancel
{
  await g(() => { window.__alog = []; });
  const t2 = await prepCard('storm', 2);
  await page.keyboard.type(t2.slice(0, 2), { delay: 30 });
  for (let i = 0; i < 6; i++) await page.keyboard.type('`');
  await page.waitForTimeout(700);
  console.log('fizzle:', (await g(() => window.__alog)).map((l) => l.m).filter((m) => m !== 'spellNote').join(' '));
}
const st = await g(() => ({ ctx: window.__spellstroke.audio.context?.state, layers: window.__spellstroke.fx.layerCount, keysGain: window.__spellstroke.audio.buses.keys.gain.value }));
console.log('audio', JSON.stringify(st));
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
