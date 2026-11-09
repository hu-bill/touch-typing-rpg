import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateIncantation, generateLessonDrill } from '../src/logic/textGen.js';
import { allowedChars } from '../src/logic/keyboard.js';
import { ZONES } from '../src/data/zones.js';
import { TIERS } from '../src/data/spells.js';

for (const layoutId of ['qwerty', 'qwertz']) {
  test(`incantations only use unlocked characters (${layoutId})`, () => {
    for (let z = 0; z < ZONES.length; z++) {
      const allowed = allowedChars(layoutId, z);
      for (let tier = 1; tier <= 4; tier++) {
        for (let seed = 1; seed <= 40; seed++) {
          const rng = createRng(seed * 31 + z * 7 + tier);
          const text = generateIncantation({ layoutId, zoneIndex: z, tier, rng });
          assert.ok(text.length > 0, 'empty text');
          for (const ch of text) assert.ok(allowed.has(ch), `zone ${z} tier ${tier}: "${ch}" not allowed in "${text}"`);
          assert.ok(text.length <= TIERS[tier].max + 12, `too long: ${text}`);
          assert.ok(!text.startsWith(' ') && !text.endsWith(' '), `untrimmed: "${text}"`);
        }
      }
    }
  });

  test(`avoidFirst is respected (${layoutId})`, () => {
    for (let z = 1; z < ZONES.length; z++) {
      for (let tier = 1; tier <= 4; tier++) {
        for (let seed = 1; seed <= 15; seed++) {
          const rng = createRng(seed + 1000);
          const a = generateIncantation({ layoutId, zoneIndex: z, tier: 1, rng });
          const b = generateIncantation({ layoutId, zoneIndex: z, tier: 2, rng, avoidFirst: [a[0]] });
          const c = generateIncantation({ layoutId, zoneIndex: z, tier, rng, avoidFirst: [a[0], b[0]] });
          assert.notEqual(b[0].toLowerCase(), a[0].toLowerCase());
          assert.ok(![a[0], b[0]].map((x) => x.toLowerCase()).includes(c[0].toLowerCase()), `${a} | ${b} | ${c}`);
        }
      }
    }
  });

  test(`lesson drills exist for every zone (${layoutId})`, () => {
    for (let z = 0; z < ZONES.length; z++) {
      const lines = generateLessonDrill({ layoutId, zoneIndex: z, rng: createRng(z + 1) });
      assert.ok(lines.length >= 1);
      const allowed = allowedChars(layoutId, z);
      for (const line of lines) for (const ch of line) assert.ok(allowed.has(ch), `drill char ${ch}`);
    }
  });
}
