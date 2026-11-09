// Shared Glyphdeep UI pieces (PLAN §13.8–13.9).
import { h, kbd } from '../dom.js';
import { RELIC_BY_ID } from '../../data/rogue.js';
import { BOON_BY_ID } from '../../data/boons.js';
import { boonText } from '../../logic/boons.js';
import { runCurses, runRelics, nextGuardianDepth } from '../../logic/rogue.js';
import { clamp } from '../../core/util.js';

const SVG = 'http://www.w3.org/2000/svg';
const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('');

export function relicCard(id, { index = null, onClick = null, price = null, tag = null, sold = false } = {}) {
  const def = RELIC_BY_ID[id];
  return h(
    'div',
    { class: `boon-card panel relic-card${def.curse ? ' curse' : ''}${sold ? ' sold' : ''}`, onClick },
    index != null ? h('div', { class: 'bc-key' }, kbd(String(index + 1))) : null,
    h('div', { class: 'bc-icon' }, def.icon),
    h('div', { class: 'bc-name' }, def.name),
    h('div', { class: 'bc-rank' }, tag || (def.curse ? 'CURSE' : 'RELIC')),
    h('div', { class: 'bc-text' }, def.text),
    price != null ? h('div', { class: 'bc-price' }, sold ? 'SOLD' : `🪙 ${price}`) : null,
  );
}

/** FNV-1a: deterministic per card, so Ink Blots stay put while a card is on screen. */
function hash(str) {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

/** Ink Blots: about one in three words of 4+ letters loses one letter (never a word's first letter). */
export function blotIndices(card) {
  const out = [];
  const re = /[A-Za-z]{4,}/g;
  let m;
  while ((m = re.exec(card.text))) {
    const hv = hash(`${card.id}:${m.index}`);
    if (hv % 3 !== 0) continue;
    out.push(m.index + 1 + ((hv >>> 4) % (m[0].length - 1)));
  }
  return out;
}

/** Extra classes per character: golden / bane / blot. */
export function charMarks(card, { bane = null, blots = false } = {}) {
  const marks = new Array(card.text.length).fill('');
  const add = (i, c) => {
    marks[i] = marks[i] ? `${marks[i]} ${c}` : c;
  };
  for (const i of card.golden || []) if (i < marks.length) add(i, 'golden');
  if (bane) for (let i = 0; i < card.text.length; i++) if (card.text[i].toLowerCase() === bane) add(i, 'bane');
  if (blots) for (const i of blotIndices(card)) add(i, 'blot');
  return marks;
}

/** Card text: the trigger letter, then plain text with marked letters as spans. */
export function markedCardText(card, marks) {
  const text = card.text;
  const out = [h('span', { class: `trigger${marks[0] ? ` ${marks[0]}` : ''}` }, text[0])];
  let buf = '';
  for (let i = 1; i < text.length; i++) {
    if (marks[i]) {
      if (buf) out.push(buf);
      buf = '';
      out.push(h('span', { class: `cm ${marks[i]}` }, text[i]));
    } else buf += text[i];
  }
  if (buf) out.push(buf);
  return out;
}

/** Top-bar chips describing the run. `inRoom`: show the depth of the room being played (the map shows it as its title). */
export function runChips(game, run, { coins = run.coins, inRoom = true, compact = false } = {}) {
  const chips = [];
  const d = run.depth;
  if (inRoom) chips.push(h('span', { class: 'chip hot', title: `You are in depth ${d + 1} · ${d} cleared` }, `🌀 Depth ${d + 1}`));
  const rec = run.prevBest;
  if (rec > 0) {
    const broke = d > rec;
    chips.push(h('span', { class: `chip${broke ? ' record' : ''}`, title: `Your best depth with this rune circle: ${rec}` }, broke ? `🏆 New record! (was ${rec})` : `🏆 Record ${rec}`));
  } else chips.push(h('span', { class: 'chip', title: 'No record yet with this rune circle' }, '🏆 First descent'));
  chips.push(h('span', { class: 'chip coins', title: 'Coins — spend them at the Ink Merchant. Golden runes typed cleanly pay 2 each.' }, `🪙 ${coins}`));
  if (run.rerolls > 0 && !compact) chips.push(h('span', { class: 'chip', title: 'Rerolls: press R on a reward to roll new choices' }, `🎲 ${run.rerolls}`));
  // icon strips stay short so the bar never wraps: the full list is in the tooltip
  const strip = (icons, max) => (icons.length > max ? `${icons.slice(0, max).join(' ')} +${icons.length - max}` : icons.join(' '));
  const relics = runRelics(run);
  if (relics.length) {
    chips.push(h('span', { class: 'chip relics', title: relics.map((id) => `${RELIC_BY_ID[id].icon} ${RELIC_BY_ID[id].name} — ${RELIC_BY_ID[id].text}`).join('\n') }, strip(relics.map((id) => RELIC_BY_ID[id].icon), compact ? 3 : 6)));
  }
  const curses = runCurses(run);
  if (curses.length) {
    chips.push(h('span', { class: 'chip curse', title: curses.map((id) => `${RELIC_BY_ID[id].name} — ${RELIC_BY_ID[id].text}`).join('\n') }, strip(curses.map((id) => RELIC_BY_ID[id].icon), 2)));
  }
  const boons = Object.entries(run.boons || {}).filter(([id, r]) => r > 0 && BOON_BY_ID[id]);
  if (boons.length) {
    const total = boons.reduce((a, [, r]) => a + r, 0);
    chips.push(h('span', { class: 'chip boons', title: boons.map(([id, r]) => `${BOON_BY_ID[id].name} (${r}) — ${boonText(id, r)}`).join('\n') }, compact ? `✦ ${total}` : `✦ ${strip(boons.map(([id, r]) => `${BOON_BY_ID[id].icon}${r > 1 ? sup(r) : ''}`), 5)}`));
  }
  const tempered = Object.entries(run.tempered || {}).filter(([, r]) => r > 0);
  if (tempered.length) {
    chips.push(h('span', { class: 'chip tempered', title: 'Tempered runes: extra power whenever you type them' }, `🔨 ${tempered.map(([c, r]) => `${c}${r > 1 ? sup(r) : ''}`).join(' ')}`));
  }
  for (const mod of run.mods || []) {
    chips.push(h('span', { class: 'chip hot', title: `${mod.name}: ${mod.fightsLeft} fight${mod.fightsLeft === 1 ? '' : 's'} left` }, `${mod.icon} ${mod.fightsLeft}`));
  }
  return chips;
}

/** HP bar for screens without fighters (map, rooms, events). */
export function hpBar(hp, maxHp) {
  const pct = clamp((hp / maxHp) * 100, 0, 100);
  return h('div', { class: 'bar player-hp event-hp' }, h('div', { class: 'fill', style: { width: `${pct}%` } }), h('div', { class: 'bar-text' }, `${Math.round(hp)} / ${maxHp}`));
}

/** Small SVG line of WPM per fight this run, with the player's long-term average as a dashed line. */
export function wpmSparkline(fights, { width = 240, height = 52, avg = null } = {}) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('class', 'sparkline');
  const vals = fights.map((f) => f.wpm);
  if (!vals.length) return svg;
  const all = avg ? [...vals, avg] : vals;
  const lo = Math.max(0, Math.min(...all) - 4);
  const hi = Math.max(...all) + 4;
  const x = (i) => (vals.length === 1 ? width / 2 : 4 + (i * (width - 8)) / (vals.length - 1));
  const y = (v) => height - 4 - ((v - lo) / Math.max(1, hi - lo)) * (height - 8);
  if (avg) {
    const l = document.createElementNS(SVG, 'line');
    l.setAttribute('x1', 0);
    l.setAttribute('x2', width);
    l.setAttribute('y1', y(avg));
    l.setAttribute('y2', y(avg));
    l.setAttribute('class', 'sp-avg');
    svg.appendChild(l);
  }
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const line = document.createElementNS(SVG, 'polyline');
  line.setAttribute('points', pts);
  line.setAttribute('class', 'sp-line');
  svg.appendChild(line);
  vals.forEach((v, i) => {
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('cx', x(i));
    c.setAttribute('cy', y(v));
    c.setAttribute('r', i === vals.length - 1 ? 3.2 : 2);
    c.setAttribute('class', 'sp-dot');
    const t = document.createElementNS(SVG, 'title');
    t.textContent = `Depth ${fights[i].d}: ${v} WPM · ${Math.round((fights[i].acc || 0) * 100)}%`;
    c.appendChild(t);
    svg.appendChild(c);
  });
  return svg;
}

/** Past rooms, the current position, and the dots up to the next guardian (with the record marker). */
export function depthTrack(run) {
  const items = [];
  for (const entry of run.log.slice(-7)) items.push(h('span', { class: 'dt-past', title: `Depth ${entry.depth}` }, entry.icon));
  const next = run.depth + 1;
  items.push(h('span', { class: 'dt-here', title: `Depth ${next} — you are here` }, '◆'));
  const guardian = nextGuardianDepth(next);
  for (let d = next + 1; d <= Math.max(guardian, next + 2) && d <= next + 6; d++) {
    const isRecord = run.prevBest > 0 && d === run.prevBest + 1 && !run.recordBroken;
    const g = d % 5 === 0;
    items.push(h('span', { class: `dt-next${g ? ' guardian' : ''}${isRecord ? ' record' : ''}`, title: g ? `Depth ${d}: guardian` : isRecord ? `Depth ${d}: beats your record` : `Depth ${d}` }, g ? '👑' : isRecord ? '🏆' : '·'));
  }
  return h('div', { class: 'depth-track' }, items);
}
