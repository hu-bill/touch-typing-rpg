import { createRng } from '../core/rng.js';
import { writeSave, createNewSave, zoneState } from '../core/save.js';
import { computePlayerStats } from '../logic/stats.js';
import {
  spawnEnemy, grantVictory, addXp, createHunt, huntHeat, chainMilestone, nextChainMilestone, grantChainMilestone,
} from '../logic/progression.js';
import { applyHuntMods, rollBoonOffer, takeBoon, boonCount } from '../logic/boons.js';
import { rollHuntEvent, tickMods } from '../logic/events.js';
import { checkAchievements } from '../logic/achievements.js';
import {
  runBaseStats, rogueFightStats, createRun, rollDoors, rogueEnemyStats, stratumZone, pickBane, rogueVictoryRewards,
  takeRelic, rollRelicOffer, finishRun, rollRogueEvent, runRelics,
} from '../logic/rogue.js';
import { DOOR_TYPES, FIGHT_TYPES } from '../data/rogue.js';
import { EVENT_BY_ID } from '../data/events.js';
import { ROGUE } from '../data/balance.js';
import { round1 } from '../core/util.js';
import { ZONES, TRAINING_DUMMY } from '../data/zones.js';
import { BAL, DIFFICULTIES } from '../data/balance.js';
import { createAudio } from './audio.js';
import { createFx } from './fx/particles.js';
import { createBackground } from './fx/background.js';
import { clearFloaters } from './fx/floaters.js';
import { toast } from './components/toast.js';
import { hideTooltip } from './components/itemView.js';
import { createLessonModal } from './components/lessonModal.js';
import { createTitleScreen } from './screens/titleScreen.js';
import { createCampScreen } from './screens/campScreen.js';
import { createCombatScreen } from './screens/combatScreen.js';
import { createEventScreen } from './screens/eventScreen.js';
import { createRogueMapScreen } from './screens/rogueMapScreen.js';
import { createRogueRoomScreen } from './screens/rogueRoomScreen.js';
import { clear } from './dom.js';

export class Game {
  constructor({ root, save, storage, hadSave }) {
    this.root = root;
    this.save = save;
    this.storage = storage;
    this.hadSave = hadSave;
    this.rng = createRng();
    this.audio = createAudio();
    this.audio.setVolume(save.settings.volume);
    this.bg = createBackground(document.getElementById('bg-canvas'));
    this.fx = createFx(document.getElementById('fx-canvas'), root);
    this.fx.setShakeEnabled(save.settings.shake);
    this.modals = [];
    this.screen = null;
    this.screenName = null;
    this.hunt = null;
    this.selectedZone = save.unlockedZone;
    this.refreshStats();
    this.screens = {
      title: createTitleScreen(this),
      camp: createCampScreen(this),
      combat: createCombatScreen(this),
      event: createEventScreen(this),
      rogueMap: createRogueMapScreen(this),
      rogueRoom: createRogueRoomScreen(this),
    };
  }

  get layoutId() {
    return this.save.settings.layout;
  }

  refreshStats() {
    this.stats = computePlayerStats(this.save);
  }

  /** Stats used in fights: hunt boons and temporary mods on top of the camp stats; a Glyphdeep run has its own. */
  get fightStats() {
    if (this.hunt && this.hunt.mode === 'rogue') return rogueFightStats(runBaseStats(this.save), this.hunt);
    return this.hunt && this.hunt.mode === 'hunt' ? applyHuntMods(this.stats, this.hunt) : this.stats;
  }

  /** The Glyphdeep run being played, or null. */
  get run() {
    return this.hunt && this.hunt.mode === 'rogue' ? this.hunt : null;
  }

  /** Equip an inventory item; the old item takes its place. → true if equipped */
  equipItem(item) {
    const s = this.save;
    const idx = s.inventory.findIndex((i) => i.id === item.id);
    if (idx < 0) return false;
    const old = s.equipment[item.slot];
    s.inventory.splice(idx, 1);
    s.equipment[item.slot] = item;
    if (old) s.inventory.splice(idx, 0, old);
    this.refreshStats();
    this.persist();
    return true;
  }

  persist() {
    writeSave(this.save, this.storage);
  }

  // ------------------------------------------------------------ screens & modals

  showScreen(name, params = {}) {
    hideTooltip();
    this.closeAllModals();
    if (this.screen && this.screen.unmount) this.screen.unmount();
    clear(this.root);
    this.root.style.transform = '';
    this.fx.clearAll();
    clearFloaters();
    this.screen = this.screens[name];
    this.screenName = name;
    this.screen.mount(this.root, params);
  }

  onKeyDown(e) {
    this.audio.unlock();
    const top = this.modals[this.modals.length - 1];
    if (top) {
      if (top.onKey) top.onKey(e);
      return;
    }
    if (this.screen && this.screen.onKey) this.screen.onKey(e);
  }

  update(dt, now) {
    if (this.screen && this.screen.update) this.screen.update(dt, now);
    for (const m of this.modals) if (m.update) m.update(dt, now);
    this.bg.update(dt);
    this.bg.draw();
    this.fx.update(dt);
    this.fx.draw();
  }

  openModal(m) {
    this.modals.push(m);
    document.getElementById('modal-root').appendChild(m.el);
    if (m.onOpen) m.onOpen();
  }

  closeModal(m) {
    const i = this.modals.indexOf(m);
    if (i < 0) return;
    this.modals.splice(i, 1);
    m.el.remove();
    hideTooltip();
    if (m.onClose) m.onClose();
  }

  closeAllModals() {
    for (const m of [...this.modals]) {
      m.onClose = null;
      this.closeModal(m);
    }
  }

  get hasModal() {
    return this.modals.length > 0;
  }

  toast(title, opts) {
    toast(title, opts);
  }

  // ------------------------------------------------------------ game flow

  newGame() {
    const { layout, volume, shake } = this.save.settings;
    this.save = createNewSave();
    Object.assign(this.save.settings, { layout, volume, shake });
    this.selectedZone = 0;
    this.hunt = null;
    this.refreshStats();
    this.persist();
  }

  get difficulty() {
    return DIFFICULTIES[this.save.settings.difficulty] || DIFFICULTIES.adept;
  }

  /** Apply the "Choose your path" result. skipAhead jumps experienced typists past the letter regions. */
  applyDifficulty(id, { skipAhead = false } = {}) {
    const d = DIFFICULTIES[id] || DIFFICULTIES.adept;
    const st = this.save.settings;
    st.difficulty = d.id;
    st.difficultyChosen = true;
    st.guide = d.guide;
    if (skipAhead) {
      const target = ZONES.findIndex((z) => z.id === 'archive');
      this.save.unlockedZone = Math.max(this.save.unlockedZone, target);
      for (let i = 0; i < target; i++) zoneState(this.save, ZONES[i].id).lessonSeen = true;
      const p = this.save.player;
      if (p.level < BAL.skipAheadLevel) {
        p.points += BAL.skipAheadLevel - p.level;
        p.level = BAL.skipAheadLevel;
        p.xp = 0;
      }
      this.selectedZone = target;
    }
    this.refreshStats();
    this.persist();
  }

  /** Show the new-runes lesson the first time a zone is entered, then continue. */
  withLesson(zoneIndex, then) {
    const zs = zoneState(this.save, ZONES[zoneIndex].id);
    if (zs.lessonSeen) {
      then();
      return;
    }
    const m = createLessonModal(this, zoneIndex, (completed) => {
      zs.lessonSeen = true;
      if (completed) addXp(this.save, 5);
      this.refreshStats();
      this.persist();
      then();
    });
    this.openModal(m);
  }

  startHunt(zoneIndex) {
    this.hunt = createHunt('hunt', zoneIndex);
    this.withLesson(zoneIndex, () => this.nextFight());
  }

  nextFight() {
    const hunt = this.hunt;
    const { def, kind } = spawnEnemy({ rng: this.rng, zoneIndex: hunt.zoneIndex, chain: hunt.chain, forceGlimmer: hunt.lure });
    hunt.lure = false;
    this.showScreen('combat', {
      mode: 'hunt', zoneIndex: hunt.zoneIndex, kind, enemyDef: def, carryHp: hunt.hp, heat: huntHeat(hunt.chain),
    });
  }

  startBoss(zoneIndex) {
    this.hunt = createHunt('boss', zoneIndex);
    this.withLesson(zoneIndex, () =>
      this.showScreen('combat', { mode: 'boss', zoneIndex, kind: 'boss', enemyDef: { ...ZONES[zoneIndex].boss }, carryHp: null }),
    );
  }

  startPractice(zoneIndex) {
    this.hunt = createHunt('practice', zoneIndex);
    this.withLesson(zoneIndex, () =>
      this.showScreen('combat', { mode: 'practice', zoneIndex, kind: 'dummy', enemyDef: { ...TRAINING_DUMMY } }),
    );
  }

  continueHunt(hpLeft, boonId = null) {
    if (!this.hunt) return;
    const before = this.fightStats.maxHp;
    if (boonId) {
      takeBoon(this.hunt, boonId);
      this.save.stats.boonsTaken += 1;
      this.save.stats.bestBoonCount = Math.max(this.save.stats.bestBoonCount, boonCount(this.hunt));
    }
    const fs = this.fightStats;
    const hp = hpLeft + Math.max(0, fs.maxHp - before); // Second Heart heals the HP it adds
    this.hunt.hp = Math.min(fs.maxHp, hp + BAL.chainHeal * fs.maxHp);
    tickMods(this.hunt);
    const ev = rollHuntEvent(this.rng, this.hunt);
    this.hunt.lastWasEvent = !!ev;
    this.persist();
    if (ev) this.showScreen('event', { event: ev });
    else this.nextFight();
  }

  /** Leave the hunt: bank the satchel (minus losses) and go back to camp. */
  endHunt(outcome, { toCamp = true } = {}) {
    const hunt = this.hunt;
    let banked = 0;
    let lost = 0;
    if (hunt) {
      const lossPct = outcome === 'defeat' ? BAL.deathGoldLoss : outcome === 'flee' ? BAL.fleeGoldLoss : 0;
      lost = Math.floor(hunt.satchel * lossPct);
      banked = hunt.satchel - lost;
      this.save.player.gold += banked;
      if (outcome === 'defeat') this.save.stats.deaths += 1;
    }
    this.hunt = null;
    this.persist();
    if (toCamp) this.showScreen('camp', { tab: 'map' });
    if (banked > 0) {
      this.toast(`Banked ${banked} gold`, { icon: '💰', sub: lost ? `${lost} gold was lost` : 'Your satchel is safe at camp', color: '#f5c66b' });
      this.audio.coin();
    }
    this.checkAchievements();
    return { banked, lost };
  }

  satchelLoss(outcome) {
    if (!this.hunt) return 0;
    const pct = outcome === 'defeat' ? BAL.deathGoldLoss : outcome === 'flee' ? BAL.fleeGoldLoss : 0;
    return Math.floor(this.hunt.satchel * pct);
  }

  recordCast(wpm) {
    const r = this.save.recentWpm;
    r.push(Math.round(wpm * 10) / 10);
    if (r.length > 30) r.splice(0, r.length - 30);
  }

  /** Lifetime stats + history after any fight (win, loss, flee, practice). */
  recordFight(summary, zoneIndex) {
    const st = this.save.stats;
    st.totalCasts += summary.casts;
    st.perfectCasts += summary.perfects;
    st.perfectHighTier += summary.perfectHighTier;
    st.fizzles += summary.fizzles;
    st.ritesCast += summary.ritesCast;
    st.charsTyped += summary.correct;
    st.bestCombo = Math.max(st.bestCombo, summary.maxCombo);
    st.bestWpm = Math.max(st.bestWpm, Math.round(summary.bestWpm));
    st.playSeconds += Math.round(summary.duration);
    if (summary.casts > 0) {
      this.save.history.push({ t: Date.now(), wpm: Math.round(summary.avgWpm * 10) / 10, acc: Math.round(summary.accuracy * 1000) / 1000, zone: zoneIndex });
      if (this.save.history.length > 200) this.save.history.splice(0, this.save.history.length - 200);
    }
    this.persist();
  }

  applyVictory({ zoneIndex, kind, enemyDef }) {
    const hunt = this.hunt;
    const chain = hunt ? hunt.chain : 0;
    const stats = this.fightStats;
    const rewards = grantVictory(this.save, {
      zoneIndex, kind, chain, stats, rng: this.rng, enemyDef, rewardMult: this.difficulty.rewardMult,
    });
    const extra = {};
    if (hunt) {
      hunt.satchel += rewards.gold;
      hunt.chain += 1;
      this.save.stats.bestChain = Math.max(this.save.stats.bestChain, hunt.chain);
      if (hunt.mode === 'hunt') {
        const ms = chainMilestone(hunt.chain);
        if (ms) {
          const got = grantChainMilestone(this.save, { milestone: ms, zoneIndex, stats, rng: this.rng });
          hunt.satchel += got.gold;
          if (got.lure) hunt.lure = true;
          extra.milestone = { def: ms, ...got };
        }
        extra.nextMilestone = nextChainMilestone(hunt.chain);
        extra.boonOffer = rollBoonOffer(this.rng, hunt.boons, 3);
      }
    } else {
      this.save.player.gold += rewards.gold;
    }
    this.refreshStats();
    this.persist();
    return { ...rewards, ...extra, chainAfter: hunt ? hunt.chain : 0 };
  }

  checkAchievements(ctx = {}) {
    const list = checkAchievements(this.save, ctx);
    list.forEach((a, i) => {
      setTimeout(() => {
        this.toast(`Achievement: ${a.name}`, { icon: a.icon, sub: a.desc, color: '#f5c66b', life: 4000 });
        this.audio.loot(3);
      }, i * 500);
    });
    if (list.length) this.persist();
    return list;
  }

  // ------------------------------------------------------------ the Glyphdeep (PLAN §13.7)

  /** Begin a new descent with the rune circle `circle` (0–8). */
  startRun(circle) {
    const run = createRun({ save: this.save, circle, layoutId: this.layoutId, rng: this.rng });
    this.save.rogue.run = run;
    this.save.rogue.lastCircle = circle;
    this.hunt = run;
    run.hp = this.fightStats.maxHp;
    this.persist();
    this.showScreen('rogueMap', { fresh: true });
  }

  /** Resume the saved descent at the room it was in. → false if there is none. */
  continueRun() {
    const run = this.save.rogue.run;
    if (!run) return false;
    this.hunt = run;
    if (run.hp == null) run.hp = this.fightStats.maxHp;
    if (run.room && run.room.cleared && !(run.room.offer && run.room.offer.choices.length)) this.rogueAdvance();
    else if (run.room && !run.room.cleared) this.enterRoom(run.room);
    else {
      if (!run.room && !run.doors.length) run.doors = rollDoors(this.rng, run, { layoutId: this.layoutId });
      this.showScreen('rogueMap', {});
    }
    return true;
  }

  /** Leave the descent for camp; it stays saved. */
  leaveRunToCamp() {
    this.hunt = null;
    this.persist();
    this.showScreen('camp', { tab: 'glyphdeep' });
  }

  enterDoor(door) {
    const run = this.run;
    if (!run) return;
    if (door.type === 'mystery' && !door.event) door.event = rollRogueEvent(this.rng, run).id;
    run.room = door;
    run.doors = [];
    this.persist();
    this.enterRoom(door);
  }

  enterRoom(door) {
    const run = this.run;
    if (FIGHT_TYPES.includes(door.type)) this.startRogueFight(door);
    else if (door.type === 'mystery') {
      run.lastEvent = door.event;
      this.showScreen('event', { event: EVENT_BY_ID[door.event] });
    } else this.showScreen('rogueRoom', { door });
  }

  startRogueFight(door) {
    const run = this.run;
    run.bane = pickBane(this.rng, this.save.keyStats, this.layoutId, run.circle);
    const stats = this.fightStats;
    if (run.hp == null) run.hp = stats.maxHp;
    let toll = 0;
    if (stats.bloodToll) {
      toll = Math.min(run.hp - 1, Math.round(stats.maxHp * stats.bloodToll));
      run.hp -= toll;
    }
    const depth = run.depth + 1;
    const { def, kind } = door.foe;
    this.persist();
    this.showScreen('combat', {
      mode: 'rogue', zoneIndex: run.circle, visualZone: stratumZone(depth), kind, enemyDef: { ...def },
      enemyStats: rogueEnemyStats(depth, kind, def), carryHp: run.hp, door, depth, toll,
    });
  }

  /** Fold a fight summary into the run's numbers (every outcome). */
  rogueRecordFight(summary) {
    const run = this.run;
    if (!run) return;
    const st = run.stats;
    st.casts += summary.casts;
    st.correct += summary.correct;
    st.errors += summary.errors;
    st.golden += summary.golden || 0;
    st.perfects += summary.perfects;
    st.fizzles += summary.fizzles;
    st.bestCombo = Math.max(st.bestCombo, summary.maxCombo);
    st.seconds += summary.duration;
    if (summary.casts > 0) st.fights.push({ d: run.depth + 1, wpm: round1(summary.avgWpm), acc: Math.round(summary.accuracy * 1000) / 1000 });
    if (st.fights.length > 80) st.fights.splice(0, st.fights.length - 80);
  }

  /** A won fight: pay coins and healing, roll the reward offer. The room is marked cleared (a reload keeps the offer). */
  rogueVictory({ kind, summary, hpLeft }) {
    const run = this.run;
    const door = run.room || {};
    const stats = this.fightStats;
    const rewards = rogueVictoryRewards(this.rng, run, { kind, door, summary, stats });
    run.hp = Math.min(stats.maxHp, Math.max(1, Math.round(hpLeft)) + rewards.heal);
    run.coins += rewards.coins.total;
    if (rewards.vital) {
      run.vital += 1;
      const after = this.fightStats.maxHp;
      run.hp = Math.min(after, run.hp + (after - stats.maxHp) + Math.round(after * ROGUE.vitalHeal));
    }
    run.rerolls += rewards.rerollGain;
    run.stats.kills += 1;
    if (kind === 'elite') run.stats.elites += 1;
    if (kind === 'boss') run.stats.guardians += 1;
    run.room = { ...door, cleared: true, offer: rewards.offer.kind ? rewards.offer : null };
    this.save.stats.totalKills += 1;
    this.persist();
    return rewards;
  }

  /** Take a boon or relic. Max-health gains heal what they add. */
  rogueClaim(kind, id) {
    const run = this.run;
    if (!run || !id) return false;
    const before = this.fightStats.maxHp;
    let ok = false;
    if (kind === 'boon') {
      takeBoon(run, id);
      ok = true;
      this.save.stats.boonsTaken += 1;
      this.save.stats.bestBoonCount = Math.max(this.save.stats.bestBoonCount, boonCount(run));
    } else if (kind === 'relic') {
      ok = takeRelic(run, id);
      this.save.stats.bestRelics = Math.max(this.save.stats.bestRelics || 0, runRelics(run).length);
    }
    const after = this.fightStats.maxHp;
    const hp = run.hp ?? before;
    run.hp = Math.min(after, after > before ? hp + (after - before) : hp);
    if (run.room) run.room.offer = null;
    this.persist();
    return ok;
  }

  /** Spend a reroll on an offer → the new offer, or null. */
  rogueReroll(offer) {
    const run = this.run;
    if (!run || run.rerolls <= 0 || !offer || !offer.kind) return null;
    const n = offer.choices.length;
    let choices;
    if (offer.kind === 'relic') {
      choices = rollRelicOffer(this.rng, { ...run, relics: [...run.relics, ...offer.choices] }, n);
      if (!choices.length) choices = rollRelicOffer(this.rng, run, n);
    } else {
      const owned = { ...run.boons };
      for (const c of offer.choices) owned[c.id] = 99;
      choices = rollBoonOffer(this.rng, owned, n).map((c) => ({ id: c.id, rank: (run.boons[c.id] || 0) + 1 }));
      if (!choices.length) choices = rollBoonOffer(this.rng, run.boons, n);
    }
    run.rerolls -= 1;
    const next = { kind: offer.kind, choices };
    if (run.room && run.room.offer) run.room.offer = next;
    // the Keepsake pick lives on the run itself: keep a reload from undoing the reroll
    if (run.keepsake && offer.kind === 'relic' && offer.choices.every((id) => run.keepsake.includes(id))) run.keepsake = choices;
    this.persist();
    return next;
  }

  /** The room is done: next depth, new doors, back to the map. */
  rogueAdvance() {
    const run = this.run;
    if (!run) return;
    const door = run.room;
    const type = door ? door.type : 'fight';
    run.depth += 1;
    run.log.push({ depth: run.depth, type, icon: (DOOR_TYPES[type] || DOOR_TYPES.fight).icon });
    if (run.log.length > 60) run.log.splice(0, run.log.length - 60);
    run.room = null;
    run.bane = null;
    if (FIGHT_TYPES.includes(type)) tickMods(run);
    const newRecord = !run.recordBroken && run.prevBest > 0 && run.depth > run.prevBest;
    if (newRecord) run.recordBroken = true;
    run.doors = rollDoors(this.rng, run, { layoutId: this.layoutId });
    this.save.stats.bestDepth = Math.max(this.save.stats.bestDepth || 0, run.depth);
    this.persist();
    this.showScreen('rogueMap', { arrived: true, newRecord, after: type });
    this.checkAchievements();
  }

  /** The descent ends (defeat or abandon) → its Chronicle. */
  endRun(cause = 'defeat', killedBy = null) {
    const run = this.run || this.save.rogue.run;
    if (!run) return null;
    const chronicle = finishRun(this.save, run, { cause, killedBy });
    if (cause === 'defeat') this.save.stats.deaths += 1;
    this.hunt = null;
    this.persist();
    this.checkAchievements();
    return chronicle;
  }
}
