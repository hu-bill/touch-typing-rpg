import { SCHOOLS, SCHOOL_WEIGHTS, SPELL_NAMES, DAMAGE_SCHOOLS } from '../data/spells.js';
import { generateIncantation } from './textGen.js';

let cardCounter = 0;
const nextId = () => `c${++cardCounter}`;

/** Choose a school; at most one regular (tier 1-3) card may be heal/shield. */
export function pickSchool(rng, tier, otherCards = []) {
  if (tier === 4) return rng.pick(DAMAGE_SCHOOLS);
  const hasSupport = otherCards.some((c) => c.tier !== 4 && SCHOOLS[c.school].kind !== 'damage');
  const ids = Object.keys(SCHOOL_WEIGHTS).filter((id) => !hasSupport || SCHOOLS[id].kind === 'damage');
  return rng.weighted(ids, (id) => SCHOOL_WEIGHTS[id]);
}

/**
 * @param {{tier:number, ctx:{layoutId:string, zoneIndex:number, weakChars?:string[], goldenRate?:number}, rng:any, otherCards?:any[], school?:string}} p
 */
export function createCard({ tier, ctx, rng, otherCards = [], school }) {
  const sch = school || pickSchool(rng, tier, otherCards);
  const avoidFirst = otherCards.map((c) => c.text[0]);
  const text = generateIncantation({
    layoutId: ctx.layoutId,
    zoneIndex: ctx.zoneIndex,
    tier,
    rng,
    weakChars: ctx.weakChars || [],
    avoidFirst,
    school: sch,
  });
  // Glyphdeep golden runes: only rolled when the context has a rate (campaign RNG use is unchanged)
  const golden = [];
  if (ctx.goldenRate > 0) {
    for (let i = 1; i < text.length; i++) if (text[i] !== ' ' && rng.chance(ctx.goldenRate)) golden.push(i);
  }
  return { id: nextId(), tier, school: sch, name: SPELL_NAMES[sch][tier - 1], text, golden };
}

export function createInitialCards(ctx, rng) {
  const cards = [];
  for (const tier of [1, 2, 3]) cards.push(createCard({ tier, ctx, rng, otherCards: cards }));
  return cards;
}

/** Replace a card with a fresh one of the same tier at the same position. */
export function replaceCard(cards, cardId, ctx, rng) {
  const index = cards.findIndex((c) => c.id === cardId);
  if (index < 0) return cards;
  const others = cards.filter((c) => c.id !== cardId);
  const fresh = createCard({ tier: cards[index].tier, ctx, rng, otherCards: others });
  const out = cards.slice();
  out[index] = fresh;
  return out;
}
