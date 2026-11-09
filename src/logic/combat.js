import { TIERS } from '../data/spells.js';
import { BAL, DIFFICULTIES, PACE, COMBO_TIERS } from '../data/balance.js';
import { clamp, mean } from '../core/util.js';
import { createInitialCards, createCard, replaceCard } from './cards.js';
import { resolveSpell } from './spellResolve.js';
import { recordKey, recordKeyTracked } from './mastery.js';
import { enemyStats } from './progression.js';

/** Enemy attack-interval multiplier: adapts to the player's rolling WPM (difficulty is applied by the engine). */
export function tempoMultiplier(recentWpm = [], tempoPct = 0) {
  const avg = recentWpm.length ? mean(recentWpm) : BAL.tempoRef;
  const adaptive = clamp(Math.sqrt(BAL.tempoRef / Math.max(avg, 1)), BAL.tempoMin, BAL.tempoMax);
  return adaptive * (1 + tempoPct / 100);
}

/** The combo power tier reached at this combo. */
export function comboTier(combo) {
  let index = 0;
  for (let i = 0; i < COMBO_TIERS.length; i++) if (COMBO_TIERS[i].at <= combo) index = i;
  return { index, ...COMBO_TIERS[index] };
}

/** Archmage pace: how much faster (or slower) this cast was than the player's average. */
export function paceMultiplier(wpm, paceRef) {
  return clamp(wpm / Math.max(1, paceRef), PACE.min, PACE.max);
}

/**
 * Glyphdeep Metronome: how even the gaps between keys were. 1 = metronome-steady, 0 = ragged.
 * cv 0.2 → 1, cv 0.4 → 0.5, cv ≥ 0.6 → 0. Fewer than 4 gaps → 0.
 */
export function rhythmScore(gaps = []) {
  if (!gaps || gaps.length < 4) return 0;
  const g = gaps.map((x) => Math.min(1500, Math.max(1, x)));
  const m = mean(g);
  const sd = Math.sqrt(g.reduce((a, x) => a + (x - m) * (x - m), 0) / g.length);
  return clamp((0.6 - sd / m) / 0.4, 0, 1);
}

/**
 * Real-time fight state machine. Contains no DOM code: the UI calls update(now) every frame,
 * forwards typed characters to handleChar(ch, now) and renders the events from drainEvents().
 */
export class CombatEngine {
  constructor({
    zoneIndex, kind, enemyDef, stats, layoutId, keyStats, rng, now, carryHp = null, tempoMult = 1, weakChars = [],
    difficulty = DIFFICULTIES.adept, paceRef = BAL.tempoRef, heat = 0, enemyOverride = null,
  }) {
    this.heat = heat;
    this.difficulty = difficulty;
    this.paceRef = paceRef;
    this.zoneIndex = zoneIndex;
    this.kind = kind;
    this.def = enemyDef;
    this.stats = stats;
    this.layoutId = layoutId;
    this.keyStats = keyStats;
    this.rng = rng;
    this.ctx = { layoutId, zoneIndex, weakChars, goldenRate: stats.goldenRate || 0 };
    this.dummy = !!enemyDef.dummy;

    const es = enemyOverride || enemyStats(zoneIndex, this.dummy ? 'dummy' : kind, enemyDef);
    this.enemy = {
      name: enemyDef.name,
      icon: enemyDef.icon,
      kind,
      aura: enemyDef.aura || null,
      hp: this.dummy ? Infinity : Math.max(1, Math.round(es.hp * difficulty.enemyHp * (1 + heat))),
      maxHp: this.dummy ? Infinity : Math.max(1, Math.round(es.hp * difficulty.enemyHp * (1 + heat))),
      atk: this.dummy ? 0 : Math.round(es.atk * BAL.enemyDamageMult * difficulty.enemyDamage * (1 + heat)),
      baseInterval: es.attackSec * tempoMult * difficulty.enemySpeed,
      intervalMult: 1,
      attackTimer: 0,
      windupSent: false,
      burn: { remaining: 0, dps: 0, tick: 0 },
      barrier: 0,
      barrierMax: 0,
    };
    this.mechanics = (enemyDef.mechanics || []).map((m) => ({ ...m, state: { timer: 0, done: false, triggered: [] } }));
    this.blindfold = this.mechanics.some((m) => m.id === 'blindfold') || !!stats.blind;

    const startHp = carryHp != null ? Math.min(carryHp, stats.maxHp) : stats.maxHp;
    this.player = { hp: Math.max(1, Math.round(startHp)), maxHp: stats.maxHp, shield: 0 };
    this.cards = createInitialCards(this.ctx, rng);
    this.cast = null;
    this.flow = stats.startFlow ? Math.min(99, stats.startFlow) : 0;
    if (stats.startShieldPct) {
      this.player.shield = Math.min(Math.round(stats.maxHp * BAL.shieldCapPct), Math.round(stats.maxHp * stats.startShieldPct));
    }
    this.flowLocked = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.phase = 'fighting';
    this.paused = false;
    this.events = [];
    this.lastNow = now;
    this.elapsed = 0;
    this.lastCastEnd = -Infinity;
    this.avalancheStacks = 0;
    this.usedPhoenix = false;
    this.usedSecondWind = false;
    this.fight = {
      correct: 0, errors: 0, casts: 0, perfects: 0, perfectHighTier: 0, fizzles: 0,
      damageDealt: 0, damageTaken: 0, wpms: [], bestWpm: 0, ritesCast: 0, golden: 0,
    };
  }

  get interval() {
    return this.enemy.baseInterval * this.enemy.intervalMult;
  }

  get activeCard() {
    return this.cast ? this.cards.find((c) => c.id === this.cast.cardId) || null : null;
  }

  toleranceFor(card) {
    return Math.max(1, TIERS[card.tier].tolerance + (this.stats.tolerance || 0) + (this.difficulty.tolerance || 0));
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  setPaused(paused, now) {
    this.paused = paused;
    this.lastNow = now;
  }

  // ------------------------------------------------------------------ time

  update(now) {
    const rawDt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (this.phase !== 'fighting' || this.paused) return;
    const dt = clamp(rawDt, 0, 0.1);
    this.elapsed += dt;

    let changed = false;
    for (const c of this.cards) {
      if (c.silencedUntil && c.silencedUntil <= now) {
        delete c.silencedUntil;
        changed = true;
      }
    }
    if (changed) this.emit('cardsChanged');
    if (this.dummy) return;

    if (this.def.fleeAfter && this.elapsed >= this.def.fleeAfter) {
      this.phase = 'escaped';
      this.cast = null;
      this.emit('escaped');
      return;
    }

    const e = this.enemy;
    if (e.atk > 0) {
      e.attackTimer += dt;
      if (!e.windupSent && e.attackTimer >= this.interval - BAL.windupSec) {
        e.windupSent = true;
        this.emit('windup');
      }
      if (e.attackTimer >= this.interval) this.enemyAttack();
      if (this.phase !== 'fighting') return;
    }

    if (e.burn.remaining > 0) {
      e.burn.tick += dt;
      while (e.burn.tick >= 0.5 && e.burn.remaining > 0) {
        e.burn.tick -= 0.5;
        e.burn.remaining -= 0.5;
        const hit = this.damageEnemy(e.burn.dps * 0.5, null);
        this.emit('burnTick', { amount: hit.dealt + hit.toBarrier });
        if (this.checkEnemyDeath()) return;
      }
      if (e.burn.remaining <= 0) e.burn = { remaining: 0, dps: 0, tick: 0 };
    }

    for (const m of this.mechanics) this.tickMechanic(m, dt, now);
  }

  tickMechanic(m, dt, now) {
    const e = this.enemy;
    const st = m.state;
    if (m.id === 'regen') {
      if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * m.pct * dt);
    } else if (m.id === 'gust') {
      st.timer += dt;
      if (st.timer >= m.every) {
        st.timer = 0;
        this.gust();
      }
    } else if (m.id === 'hex') {
      st.timer += dt;
      if (st.timer >= m.every) {
        st.timer = 0;
        this.hex(m, now);
      }
    }
  }

  gust() {
    const keep = this.cast ? this.cast.cardId : null;
    let cards = this.cards;
    for (const c of this.cards) {
      if (c.id !== keep && c.tier !== 4) cards = replaceCard(cards, c.id, this.ctx, this.rng);
    }
    this.cards = cards;
    this.emit('mechanic', { id: 'gust', text: 'A gust scatters your spells!' });
    this.emit('cardsChanged');
  }

  hex(m, now) {
    const options = this.cards.filter((c) => (!this.cast || c.id !== this.cast.cardId) && !c.silencedUntil);
    if (!options.length) return;
    const c = this.rng.pick(options);
    c.silencedUntil = now + m.duration * 1000;
    this.emit('mechanic', { id: 'hex', text: `${c.name} is hexed!`, cardId: c.id });
    this.emit('cardsChanged');
  }

  enemyAttack() {
    const e = this.enemy;
    e.attackTimer = 0;
    e.windupSent = false;
    const dmg = Math.max(1, Math.round(e.atk * this.rng.float(0.85, 1.15)));
    this.emit('enemyAttack');
    this.damagePlayer(dmg, 'attack');
    for (const m of this.mechanics) {
      if (m.id === 'quicken') e.intervalMult = Math.max(m.min, e.intervalMult - m.step);
    }
  }

  // ------------------------------------------------------------------ typing

  handleChar(ch, now) {
    if (this.phase !== 'fighting' || this.paused) return;
    if (!this.cast) {
      const card = this.cards.find((c) => c.text[0] === ch && !(c.silencedUntil && c.silencedUntil > now));
      if (!card) {
        this.emit('noMatch', { ch });
        return;
      }
      this.cast = { cardId: card.id, typed: 0, errors: 0, startTime: now, lastKeyTime: now, forgiven: false, gaps: [], errAt: [], golden: 0 };
      this.emit('castStart', { cardId: card.id });
      this.onCorrect(card, ch, now, true);
      return;
    }
    const card = this.activeCard;
    if (!card) {
      this.cast = null;
      return;
    }
    const expected = card.text[this.cast.typed];
    if (ch === expected) this.onCorrect(card, ch, now, false);
    else this.onError(card, expected, ch, now);
  }

  cancelCast() {
    if (!this.cast) return false;
    this.cast = null;
    this.emit('cancel');
    return true;
  }

  onCorrect(card, ch, now, first) {
    const c = this.cast;
    const ms = first ? null : now - c.lastKeyTime;
    const up = recordKeyTracked(this.keyStats, ch, true, ms);
    if (ms != null) c.gaps.push(ms);
    const index = c.typed;
    c.typed += 1;
    c.lastKeyTime = now;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.fight.correct += 1;
    this.addFlow(BAL.flowPerKey * this.stats.flowGainMult);
    this.emit('keyCorrect', { index, combo: this.combo, ch });
    if (up && ch !== ' ') this.emit('masteryUp', { ch, level: up });
    // Glyphdeep: a golden rune counts only when typed without a mistake on it
    if (card.golden && card.golden.length && card.golden.includes(index) && !c.errAt.includes(index)) {
      c.golden += 1;
      this.fight.golden += 1;
      this.emit('golden', { index });
    }
    if (ch === ' ' && this.stats.spaceShieldPct) {
      const p = this.player;
      p.shield = Math.min(Math.round(p.maxHp * BAL.shieldCapPct), p.shield + Math.max(1, Math.round(p.maxHp * this.stats.spaceShieldPct)));
    }
    if (c.typed >= card.text.length) this.completeCast(card, now);
  }

  onError(card, expected, ch, now) {
    const c = this.cast;
    if (!c.errAt.includes(c.typed)) c.errAt.push(c.typed);
    if (this.stats.grace && !c.graced) {
      c.graced = true;
      this.fight.errors += 1;
      recordKey(this.keyStats, expected, false, null);
      this.emit('grace', { index: c.typed, expected, got: ch });
      return;
    }
    c.errors += 1;
    this.fight.errors += 1;
    this.combo = this.stats.momentum ? Math.floor(this.combo / 2) : 0;
    if (!this.flowLocked) this.flow = Math.max(0, this.flow - BAL.flowPerError);
    recordKey(this.keyStats, expected, false, null);
    const tolerance = this.toleranceFor(card);
    this.emit('keyError', { index: c.typed, expected, got: ch, errors: c.errors, tolerance, combo: this.combo });
    for (const m of this.mechanics) {
      if (m.id === 'searing') this.damagePlayer(Math.max(1, Math.round(this.player.maxHp * m.pct)), 'searing');
    }
    if (this.stats.glassPct && this.phase === 'fighting') this.damagePlayer(Math.max(1, Math.round(this.player.maxHp * this.stats.glassPct)), 'glass');
    if (this.phase !== 'fighting') return;
    if (c.errors > tolerance && !c.forgiven) {
      if (this.stats.uniques.has('secondWind') && !this.usedSecondWind) {
        this.usedSecondWind = true;
        c.forgiven = true;
        this.emit('secondWind');
      } else {
        this.fizzle(card, now);
      }
    }
  }

  addFlow(amount) {
    if (this.flowLocked) return;
    this.flow = Math.min(100, this.flow + amount);
    if (this.flow >= 100) {
      this.flow = 100;
      this.flowLocked = true;
      this.spawnRite();
    }
  }

  spawnRite() {
    if (this.cards.some((c) => c.tier === 4)) return;
    const rite = createCard({ tier: 4, ctx: this.ctx, rng: this.rng, otherCards: this.cards });
    this.cards = [...this.cards, rite];
    this.emit('flowFull', { cardId: rite.id });
    this.emit('cardsChanged');
  }

  retireCard(card) {
    if (card.tier === 4) {
      this.cards = this.cards.filter((c) => c.id !== card.id);
      this.flow = 0;
      this.flowLocked = false;
    } else {
      this.cards = replaceCard(this.cards, card.id, this.ctx, this.rng);
    }
    this.emit('cardsChanged');
  }

  fizzle(card, now) {
    const backfire = Math.round(this.player.maxHp * TIERS[card.tier].backfire * this.difficulty.backfire);
    this.fight.fizzles += 1;
    this.cast = null;
    this.lastCastEnd = now;
    this.avalancheStacks = 0;
    this.emit('fizzle', { card, backfire });
    this.retireCard(card);
    if (backfire > 0) this.damagePlayer(backfire, 'backfire', true);
  }

  completeCast(card, now) {
    const c = this.cast;
    const elapsed = Math.max(300, c.lastKeyTime - c.startTime);
    const wpm = Math.min(250, (Math.max(0, card.text.length - 1) / 5) / (elapsed / 60000));
    const uniques = this.stats.uniques;
    const rhythm = this.stats.rhythm ? rhythmScore(c.gaps) : 0;
    if (uniques.has('avalanche')) {
      this.avalancheStacks = now - this.lastCastEnd <= 2500 ? Math.min(5, this.avalancheStacks + 1) : 0;
    }
    const result = resolveSpell({
      card, wpm, errors: c.errors, stats: this.stats, rng: this.rng, keyStats: this.keyStats,
      layoutId: this.layoutId, flow: this.flow, avalancheStacks: this.avalancheStacks,
      paceMult: this.difficulty.pace || this.stats.paceRune ? paceMultiplier(wpm, this.paceRef) : 1,
      comboMult: comboTier(this.combo * (this.stats.comboRate || 1)).mult,
      extraMult: rhythm ? 1 + this.stats.rhythm * rhythm : 1,
      forceCrit: !!this.stats.goldenCrit && c.golden > 0,
    });
    result.rhythm = rhythm;
    result.golden = c.golden;
    this.cast = null;
    this.lastCastEnd = now;

    const f = this.fight;
    f.casts += 1;
    f.wpms.push(wpm);
    f.bestWpm = Math.max(f.bestWpm, wpm);
    if (result.perfect) {
      f.perfects += 1;
      if (card.tier >= 3) f.perfectHighTier += 1;
    }
    if (card.tier === 4) f.ritesCast += 1;

    const e = this.enemy;
    const p = this.player;
    let hit = { dealt: 0, toBarrier: 0, resisted: false };
    if (this.stats.executePct && result.kind === 'damage' && e.hp / e.maxHp < 0.3) {
      result.damage = Math.round(result.damage * (1 + this.stats.executePct));
      result.executed = true;
    }
    if (result.damage > 0) hit = this.damageEnemy(result.damage, card);
    if (result.heal) this.healPlayer(result.heal);
    if (result.shield) p.shield = Math.min(Math.round(p.maxHp * BAL.shieldCapPct), p.shield + result.shield);
    if (result.burnTotal && hit.dealt + hit.toBarrier > 0) {
      const total = Math.round(result.burnTotal * (hit.resisted ? 0.5 : 1));
      e.burn = { remaining: 3, dps: (e.burn.dps * e.burn.remaining + total) / 3, tick: 0 };
    }
    if (result.freezePct) this.pushBackAttack(result.freezePct);
    if (result.crit && uniques.has('tempest')) this.pushBackAttack(0.25);
    if (this.stats.leechPct && hit.dealt > 0) this.healPlayer(Math.round((hit.dealt * this.stats.leechPct) / 100));

    this.emit('castComplete', { card, result, dealt: hit.dealt, toBarrier: hit.toBarrier, resisted: hit.resisted, wpm, errors: c.errors });

    if (result.echo && this.phase === 'fighting' && e.hp > 0) {
      const h2 = this.damageEnemy(result.damage, card);
      this.emit('echo', { dealt: h2.dealt + h2.toBarrier });
    }
    this.retireCard(card);
    this.checkEnemyDeath();
  }

  pushBackAttack(pct) {
    const e = this.enemy;
    e.attackTimer = Math.max(0, e.attackTimer - pct * this.interval);
    if (e.attackTimer < this.interval - BAL.windupSec) e.windupSent = false;
  }

  // ------------------------------------------------------------------ damage

  damageEnemy(amount, card) {
    const e = this.enemy;
    let dmg = amount;
    let resisted = false;
    if (card) {
      for (const m of this.mechanics) {
        if (m.id === 'armored' && !new RegExp(m.unless).test(card.text)) {
          dmg *= m.pct;
          resisted = true;
        }
      }
    }
    let toBarrier = 0;
    if (e.barrier > 0 && dmg > 0) {
      const bm = this.mechanics.find((m) => m.id === 'barrier');
      const eff = card && card.tier <= 2 ? (bm ? bm.lowTierPct : 1) : 1;
      toBarrier = Math.min(e.barrier, dmg * eff);
      e.barrier -= toBarrier;
      dmg -= toBarrier / eff;
      if (e.barrier <= 0.0001) {
        e.barrier = 0;
        this.emit('barrierBroken');
      }
    }
    dmg = Math.max(0, dmg);
    if (!this.dummy) e.hp -= dmg;
    this.fight.damageDealt += dmg + toBarrier;
    if (!this.dummy) this.afterEnemyDamaged();
    return { dealt: Math.round(dmg), toBarrier: Math.round(toBarrier), resisted };
  }

  afterEnemyDamaged() {
    const e = this.enemy;
    if (e.hp <= 0) return;
    const ratio = e.hp / e.maxHp;
    for (const m of this.mechanics) {
      if (m.id === 'enrage' && !m.state.done && ratio < m.at) {
        m.state.done = true;
        e.intervalMult *= m.mult;
        this.emit('mechanic', { id: 'enrage', text: 'ENRAGED!' });
      }
      if (m.id === 'barrier') {
        for (const at of m.at) {
          if (ratio < at && !m.state.triggered.includes(at)) {
            m.state.triggered.push(at);
            const amount = Math.round(e.maxHp * m.amount);
            e.barrier = amount;
            e.barrierMax = amount;
            this.emit('barrier', { amount });
            this.emit('mechanic', { id: 'barrier', text: 'A barrier rises!' });
          }
        }
      }
    }
  }

  damagePlayer(amount, source, pierce = false) {
    if (this.phase !== 'fighting') return { damage: 0, absorbed: 0 };
    const p = this.player;
    const absorbed = pierce ? 0 : Math.min(p.shield, amount);
    p.shield -= absorbed;
    const damage = amount - absorbed;
    p.hp -= damage;
    this.fight.damageTaken += damage;
    this.emit('playerHurt', { damage, absorbed, source });
    this.checkPlayerDeath();
    return { damage, absorbed };
  }

  healPlayer(amount) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    const healed = Math.round(p.hp - before);
    if (healed > 0) this.emit('heal', { amount: healed });
  }

  checkEnemyDeath() {
    if (this.dummy || this.phase !== 'fighting') return false;
    if (this.enemy.hp <= 0.5) {
      this.enemy.hp = 0;
      this.phase = 'victory';
      this.cast = null;
      this.emit('victory');
      return true;
    }
    return false;
  }

  checkPlayerDeath() {
    if (this.phase !== 'fighting') return;
    const p = this.player;
    if (p.hp > 0) return;
    if (this.stats.uniques.has('phoenix') && !this.usedPhoenix) {
      this.usedPhoenix = true;
      p.hp = Math.round(p.maxHp * 0.3);
      this.emit('phoenix');
      return;
    }
    p.hp = 0;
    this.phase = 'defeat';
    this.cast = null;
    this.emit('defeat');
  }
}

export function summarizeFight(engine) {
  const f = engine.fight;
  const total = f.correct + f.errors;
  return {
    avgWpm: f.wpms.length ? mean(f.wpms) : 0,
    bestWpm: f.bestWpm,
    accuracy: total ? f.correct / total : 1,
    maxCombo: engine.maxCombo,
    duration: engine.elapsed,
    casts: f.casts,
    perfects: f.perfects,
    perfectHighTier: f.perfectHighTier,
    fizzles: f.fizzles,
    ritesCast: f.ritesCast,
    correct: f.correct,
    errors: f.errors,
    damageDealt: Math.round(f.damageDealt),
    damageTaken: Math.round(f.damageTaken),
    golden: f.golden || 0,
  };
}
