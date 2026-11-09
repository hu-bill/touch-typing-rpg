import { h, clear, kbd, fill } from '../dom.js';
import { ZONES } from '../../data/zones.js';
import { BAL } from '../../data/balance.js';
import { FINGERS } from '../../data/layouts.js';
import { zoneState } from '../../core/save.js';
import { bossAvailable } from '../../logic/progression.js';
import { newCharsForZone, charInfo } from '../../logic/keyboard.js';
import { nearestGoals } from '../../logic/goals.js';
import { goalsStrip } from '../components/goalsStrip.js';

const NODE_POS = [
  [9, 78], [23, 56], [13, 30], [32, 15], [49, 36], [41, 66], [62, 80], [77, 55], [89, 24],
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

function actionButton(title, desc, hotkey, onClick, { primary = false, disabled = false } = {}) {
  return h(
    'button',
    { class: `btn action-btn${primary ? ' primary' : ''}`, type: 'button', disabled, onClick: disabled ? null : onClick },
    kbd(hotkey),
    h('span', { class: 'ab-text' }, h('span', { class: 'ab-title' }, title), h('span', { class: 'ab-desc' }, desc)),
  );
}

export function mechanicText(m) {
  switch (m.id) {
    case 'enrage': return `Enrages below ${Math.round(m.at * 100)}% health`;
    case 'quicken': return 'Attacks faster after every strike';
    case 'searing': return 'Every mistake burns you';
    case 'gust': return `Scatters your spell cards every ${m.every}s`;
    case 'hex': return `Hexes a spell card every ${m.every}s`;
    case 'regen': return 'Regenerates health';
    case 'blindfold': return 'Blinds you — no keyboard guide';
    case 'barrier': return 'Raises barriers — Cantrips and Spells barely dent them';
    case 'armored': return m.unless === '[0-9]' ? 'Armored — only spells containing digits pierce it' : 'Armored — only spells with Capital letters pierce it';
    default: return m.id;
  }
}

export function createMapTab(game, camp) {
  let el;
  let mapPanel;
  let zonePanel;

  const isUnlocked = (i) => i <= game.save.unlockedZone;

  function select(i) {
    if (!isUnlocked(i)) return;
    game.selectedZone = i;
    render();
    game.audio.click();
  }

  function renderMap() {
    clear(mapPanel);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i < NODE_POS.length - 1; i++) {
      const [x1, y1] = NODE_POS[i];
      const [x2, y2] = NODE_POS[i + 1];
      const path = document.createElementNS(svgNS, 'path');
      const cx = (x1 + x2) / 2 + (i % 2 ? 6 : -6);
      const cy = (y1 + y2) / 2 + (i % 2 ? -4 : 4);
      path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
      const open = isUnlocked(i + 1);
      path.setAttribute('stroke', open ? 'rgba(245,198,107,0.75)' : 'rgba(255,255,255,0.18)');
      path.setAttribute('stroke-width', open ? '0.7' : '0.45');
      path.setAttribute('fill', 'none');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.style.strokeWidth = open ? '3px' : '2px';
      if (!open) path.setAttribute('stroke-dasharray', '6 8');
      svg.appendChild(path);
    }
    mapPanel.appendChild(svg);
    mapPanel.appendChild(h('div', { class: 'map-title' }, 'The Realm of Qwerth'));

    ZONES.forEach((z, i) => {
      const zs = zoneState(game.save, z.id);
      const unlocked = isUnlocked(i);
      const cls = ['map-node', unlocked ? (zs.bossDefeated ? 'cleared' : 'open') : 'locked', i === game.selectedZone ? 'selected' : ''].join(' ');
      mapPanel.appendChild(
        h(
          'div',
          {
            class: cls,
            style: { left: `${NODE_POS[i][0]}%`, top: `${NODE_POS[i][1]}%`, '--zone-accent': z.palette.accent },
            onClick: () => select(i),
            title: unlocked ? z.name : 'Locked',
          },
          h(
            'div',
            { class: 'map-medal' },
            unlocked ? z.icon : '❔',
            zs.bossDefeated ? h('span', { class: 'medal-crown' }, '👑') : null,
            !unlocked ? h('span', { class: 'medal-lock' }, '🔒') : null,
          ),
          h('div', { class: 'map-name' }, unlocked ? z.name : `Region ${ROMAN[i]}`),
        ),
      );
    });
  }

  function runeKeycaps(i) {
    const chars = [...newCharsForZone(game.layoutId, i)].filter((c) => c !== ' ');
    const layout = game.layoutId;
    let list = chars;
    const caps = [];
    if (ZONES[i].modifiers.includes('shift')) caps.push(h('span', { class: 'keycap', style: { '--finger': FINGERS.lp.color } }, 'Shift'));
    if (ZONES[i].modifiers.includes('altgr') && layout === 'qwertz') caps.push(h('span', { class: 'keycap', style: { '--finger': FINGERS.th.color } }, 'AltGr'));
    if (list.length > 18) list = list.filter((c) => !/[A-Z]/.test(c));
    for (const c of list.slice(0, 18)) {
      const info = charInfo(layout, c);
      caps.push(h('span', { class: 'keycap', style: { '--finger': info ? FINGERS[info.finger].color : '#888' }, title: info ? FINGERS[info.finger].name : '' }, c));
    }
    if (list.length > 18) caps.push(h('span', { class: 'faint' }, `+${list.length - 18}`));
    if (ZONES[i].modifiers.includes('shift')) caps.push(h('span', { class: 'faint', style: { alignSelf: 'center' } }, 'A–Z capitals'));
    return caps;
  }

  function renderZonePanel() {
    clear(zonePanel);
    const i = game.selectedZone;
    const z = ZONES[i];
    const zs = zoneState(game.save, z.id);
    const bossOk = bossAvailable(game.save, i);
    zonePanel.style.setProperty('--zone-accent', z.palette.accent);
    const progressText = zs.bossDefeated
      ? 'Boss defeated — challenge it again for rare loot'
      : bossOk
        ? 'The boss has awakened!'
        : `Defeat ${BAL.killsForBoss - zs.kills} more foes to awaken the boss`;
    fill(zonePanel, 
      h(
        'div',
        { class: 'zone-head' },
        h('div', { class: 'zone-icon' }, z.icon),
        h('div', {}, h('div', { class: 'zone-sub' }, `Region ${ROMAN[i]}`), h('div', { class: 'zone-name' }, z.name)),
      ),
      h('div', { class: 'zone-blurb' }, z.blurb),
      h('div', { class: 'section-label' }, 'Runes of this region'),
      h('div', { class: 'rune-row' }, runeKeycaps(i)),
      h('div', { class: 'section-label' }, 'Hunt progress'),
      h('div', { class: 'progress' }, h('div', { style: { width: `${Math.min(100, (zs.kills / BAL.killsForBoss) * 100)}%` } })),
      h('div', { class: 'dim', style: { fontSize: '13px' } }, `${Math.min(zs.kills, BAL.killsForBoss)} / ${BAL.killsForBoss} — ${progressText}`),
      h(
        'div',
        { class: 'boss-preview', style: { opacity: bossOk ? 1 : 0.55 } },
        h('div', { class: 'bp-icon' }, bossOk ? z.boss.icon : '❓'),
        h(
          'div',
          {},
          h('div', { class: 'bp-name' }, bossOk ? `${z.boss.name}, ${z.boss.title}` : 'An unknown presence…'),
          bossOk ? z.boss.mechanics.map((m) => h('div', { class: 'bp-mech' }, `• ${mechanicText(m)}`)) : h('div', { class: 'bp-mech' }, 'Hunt in this region to draw it out.'),
        ),
      ),
      goalsStrip(nearestGoals(game.save, { layoutId: game.layoutId, zoneIndex: i, max: 4 }).filter((g) => g.id !== 'boss').slice(0, 2)),
      h(
        'div',
        { class: 'zone-actions' },
        actionButton('Hunt', 'Fight foes · chain victories for bonus loot', 'Enter', () => game.startHunt(i), { primary: true }),
        actionButton(zs.bossDefeated ? `Rematch ${z.boss.name}` : 'Challenge the boss', bossOk ? 'Guaranteed rare loot' : `Slay ${BAL.killsForBoss} foes first`, 'B', () => game.startBoss(i), { disabled: !bossOk }),
        actionButton('Practice Shrine', 'No danger · drill this region\'s runes for XP', 'P', () => game.startPractice(i)),
      ),
    );
  }

  function render() {
    renderMap();
    renderZonePanel();
    const z = ZONES[game.selectedZone];
    game.bg.setPalette(z.palette, z.ambient);
  }

  return {
    mount(container) {
      game.selectedZone = Math.min(game.selectedZone ?? game.save.unlockedZone, game.save.unlockedZone);
      mapPanel = h('div', { class: 'map-panel panel' });
      zonePanel = h('div', { class: 'zone-panel panel' });
      el = h('div', { class: 'tab-content' }, mapPanel, zonePanel);
      container.appendChild(el);
      render();
    },
    unmount() {},
    onKey(e) {
      const i = game.selectedZone;
      if (e.key === 'Enter') {
        e.preventDefault();
        game.startHunt(i);
      } else if (e.key === 'b' || e.key === 'B') {
        if (bossAvailable(game.save, i)) game.startBoss(i);
      } else if (e.key === 'p' || e.key === 'P') {
        game.startPractice(i);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        select(Math.min(game.save.unlockedZone, i + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        select(Math.max(0, i - 1));
      }
    },
  };
}
