import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateIncantation } from '../src/logic/textGen.js';
import { allowedChars } from '../src/logic/keyboard.js';
import { ZONES } from '../src/data/zones.js';
import { TIERS } from '../src/data/spells.js';
import { SCHOOL_LEXICON, SCHOOL_CODE_LINES } from '../src/data/spellLexicon.js';

const SCHOOLS = Object.keys(SCHOOL_LEXICON);

function themedWords(school) {
  const lex = SCHOOL_LEXICON[school];
  const set = new Set();
  for (const key of ['verbs', 'nouns', 'plurals', 'adjs']) for (const w of lex[key]) set.add(w);
  return set;
}

for (const layoutId of ['qwerty', 'qwertz']) {
  test(`themed incantations only use unlocked characters (${layoutId})`, () => {
    for (let z = 0; z < ZONES.length; z++) {
      const allowed = allowedChars(layoutId, z);
      for (const school of SCHOOLS) {
        for (let tier = 1; tier <= 4; tier++) {
          for (let seed = 1; seed <= 12; seed++) {
            const text = generateIncantation({ layoutId, zoneIndex: z, tier, rng: createRng(seed * 97 + z * 13 + tier), school });
            assert.ok(text.length > 0, 'empty');
            for (const ch of text) assert.ok(allowed.has(ch), `${school} z${z} t${tier}: "${ch}" not allowed in "${text}"`);
            assert.ok(text.length <= TIERS[tier].max + 12, `too long: ${text}`);
            assert.ok(!/^[\s,;:.!]/.test(text) && !/\s$/.test(text) && !/ {2}/.test(text), `badly formed: "${text}"`);
          }
        }
      }
    }
  });
}

test('incantations match their school once enough letters are unlocked', () => {
  for (let z = 2; z < ZONES.length; z++) {
    for (const school of SCHOOLS) {
      const words = themedWords(school);
      let themed = 0;
      let total = 0;
      for (let tier = 1; tier <= 4; tier++) {
        for (let seed = 1; seed <= 15; seed++) {
          const text = generateIncantation({ layoutId: 'qwerty', zoneIndex: z, tier, rng: createRng(seed * 31 + tier), school });
          total += 1;
          const isCode = SCHOOL_CODE_LINES[school].includes(text);
          const hasWord = text.toLowerCase().split(/[^a-z]+/).some((w) => words.has(w));
          if (isCode || hasWord) themed += 1;
        }
      }
      assert.ok(themed / total >= 0.85, `${school} zone ${z}: only ${themed}/${total} themed`);
    }
  }
});
