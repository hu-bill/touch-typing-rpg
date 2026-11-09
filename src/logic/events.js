import { BAL } from '../data/balance.js';
import { HUNT_EVENTS, EVENT_TEXT } from '../data/events.js';
import { clamp } from '../core/util.js';
import { generateIncantation } from './textGen.js';

/** The event that replaces the next fight, or null. Never two in a row, never before a lure. */
export function rollHuntEvent(rng, hunt) {
  if (!hunt || hunt.mode !== 'hunt' || hunt.chain < BAL.eventMinChain || hunt.lure || hunt.lastWasEvent) return null;
  if (!rng.chance(BAL.eventChance)) return null;
  return rng.weighted(HUNT_EVENTS.filter((e) => (e.minSatchel || 0) <= hunt.satchel), (e) => e.weight) || null;
}

export function eventText(eventId, { layoutId, zoneIndex, rng, weakChars = [] }) {
  const { tier, school } = EVENT_TEXT[eventId];
  return generateIncantation({ layoutId, zoneIndex, tier, rng, weakChars, avoidFirst: [], school, short: true });
}

/** Seconds allowed for the Restless Chest. */
export function mimicTimeLimit(textLen, avgWpm) {
  const charsPerSec = (Math.max(5, avgWpm) * 5) / 60;
  return clamp((textLen / charsPerSec) * BAL.mimicTimeFactor, BAL.mimicMinSec, BAL.mimicMaxSec);
}

export function traderPrice(satchel) {
  return Math.max(BAL.traderMinPrice, Math.round(satchel * BAL.traderPricePct));
}

export function altarMod() {
  return {
    id: 'altar', name: 'Altar Curse', icon: '🗿', fightsLeft: BAL.altarFights,
    stats: { tempoPct: BAL.altarTempoPct, goldMult: BAL.altarGoldMult },
  };
}

/** One fight passed: decrement every mod, drop the expired ones. */
export function tickMods(hunt) {
  if (!hunt || !hunt.mods) return;
  for (const m of hunt.mods) m.fightsLeft -= 1;
  hunt.mods = hunt.mods.filter((m) => m.fightsLeft > 0);
}
