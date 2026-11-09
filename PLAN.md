# SPELLSTROKE — Implementation Plan

> A browser RPG where every spell is an incantation you touch‑type. The world map *is* the
> keyboard curriculum: each region you conquer teaches new keys, and your real typing skill
> (speed, accuracy, per‑key mastery) is literally your magic power.

This document is written so that a less capable model can implement the game **top to bottom
without making design decisions**. Every number, file, function signature and data shape is
specified. When something is not specified, choose the simplest option and keep going.

**v1.1:** §11 adds the *session hooks* update (milestones M12–M22). Build it after M11 is complete. **Status: implemented.**

**v1.2:** §12 adds the *Spellcraft* update — charge, release and impact feel for every spell (milestones M23–M27). Build it after M22.

**v1.3:** §13 adds **The Glyphdeep** — an endless roguelike mode playable from the very first launch (milestones M28–M35). Build it after M27.

**v1.4:** §14 *Sigil & Song* replaces the look and sound of every spell — inscribed sigils and per-school instruments instead of orbs, projectiles and a charge hum (milestones M36–M40). It supersedes parts of §12.

---

## 0. Rules for the implementer

1. Follow the milestones in §9 **in order**. After each milestone run `npm test` (and for UI
   milestones `npm run dev` and look at the page). Do not start the next milestone with failing tests.
2. **Pure logic never touches the DOM.** Everything in `src/core`, `src/data`, `src/logic` must run
   in Node (the tests import them directly). Only `src/ui/**` and `src/main.js` may use
   `document`, `window`, `localStorage`, `AudioContext`, `requestAnimationFrame`.
3. All randomness in logic goes through an `rng` object (see `core/rng.js`) passed in as a
   parameter. Never call `Math.random()` inside `src/logic`.
4. Use plain modern JavaScript (ES modules, `const`/`let`, arrow functions, classes where
   specified). No TypeScript, no frameworks, no extra npm dependencies besides `vite`.
5. Keep numbers in one place: balance constants live in `src/data/balance.js` (§6).
6. Strings that the player types must only contain characters the player has unlocked
   (§3.1). Tests enforce this — never weaken those tests.

---

## 1. Vision & core loop

**Fantasy:** You are a *Spellstroke*, a mage of the realm of **Qwerth**, where magic is written
with the fingers. Runes (keys) are learned region by region. Fast, precise casting is power.

**Core loop (one fight, ~30–90 s):**

1. An enemy appears with an HP bar and an **attack timer** that fills in real time.
2. Three **spell cards** are shown (tiers I, II, III), plus a fourth **Forbidden Rite** card when
   the Flow meter is full. Each card shows an incantation (natural words, sentences, numbers or a
   line of code).
3. The player **selects a spell by typing its first character** (every visible card starts with a
   different character). The card locks in and the player types the rest. Wrong keys do not
   advance the cursor; they count as mistakes and destabilise the spell.
4. When the last character is typed the spell fires. Damage = character difficulty × tier ×
   **speed (WPM)** × **accuracy** × gear × crits. Too many mistakes → the spell **fizzles**
   (high tiers backfire and hurt you).
5. The enemy hits you whenever its timer fills. Shields/heals/freeze help.
6. Victory → XP, gold (into a *satchel*), RNG loot with rarity beams. Choose **Continue the hunt**
   (chain bonus grows, HP only partially restores, satchel at risk) or **Return to camp** (bank gold).
7. Six kills in a region awaken its **boss**. Beating the boss unlocks the next region and teaches
   new runes with a short finger‑placement lesson.

**Meta loop:** level up → attunement points; equip/sell items; buy mystery chests; watch your
WPM chart and keyboard mastery heatmap grow; unlock achievements. Practice Shrine for drills.

**Surprise features (all must be implemented):**
- **Musical typing:** every correct key plays the next note of a pentatonic scale; the melody
  climbs with your combo. Errors play a dull thud.
- **Rune mastery:** each key you master in real life (accuracy + speed thresholds) permanently
  makes that key worth +10/20/30 % power in spells. Your keyboard heatmap glows gold as you improve.
- **The game hunts your weaknesses:** incantations are weighted toward your 3 weakest keys.
- **Incantations match the spell:** a Fireball reads "ignite fierce cinder; scorch their bones", a Ward
  "by onyx, by bronze, by endless armor, brace my allies", a frost spell in the code region `freeze(foe);`.
- **Difficulty chosen at the start** (Apprentice / Adept / Archmage, §3.11). Archmage adds a *pace rune*
  that rewards beating your own average WPM, and experienced typists may skip the letter regions.
- **Adaptive tempo:** enemy speed adapts to your rolling WPM so beginners and 100‑WPM typists both
  stay in the flow zone; raw WPM still scales damage, so getting faster always feels stronger.
- **Glimmerkin:** a rare (5 %) gold‑stuffed creature that flees after 20 s. Kill it fast for a jackpot.
- **Keyboard layouts:** QWERTY (US) and QWERTZ (DE). The curriculum is defined by *physical key
  positions*, so both layouts get a correct home‑row‑first course and correct on‑screen keyboard.
- **Hint‑only keyboard guide:** by default the on‑screen keyboard only lights the next key if you
  hesitate > 1.2 s, training you not to look.

---

## 2. Tech stack & project layout

- Vite (dev server + build), vanilla JS ES modules, HTML/CSS, `<canvas>` for backgrounds & particles,
  DOM for all text/UI (crisp fonts), WebAudio for synthesized sound (no audio files),
  `localStorage` for saves, Node's built‑in test runner (`node --test`) for logic tests.
- Fonts from Google Fonts: **Cinzel** (titles), **Inter** (UI), **JetBrains Mono** (incantations),
  **Noto Color Emoji** (so creatures/items look identical on Windows, macOS and Linux). Always provide
  fallbacks (`Georgia, serif` / `system-ui, sans-serif` / `ui-monospace, Consolas, monospace`) and append
  `'Noto Color Emoji'` as the LAST entry of every stack. **Disable ligatures** on `body` and `.itext`
  (`font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0`) — otherwise JetBrains Mono
  draws `=>` as `⇒` and the player cannot tell what to type.
- Graphics: emoji for creatures/items (no image assets) made "game‑like" with CSS drop‑shadows,
  auras, idle bobbing, hit flashes, and canvas particles.

### `package.json`
```json
{
  "name": "spellstroke",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test \"tests/**/*.test.js\""
  },
  "devDependencies": { "vite": "^8.0.0" }
}
```

### File tree (create exactly these files)
```
index.html
package.json
vite.config.js                 // { base: './' } so the build works from any folder
src/
  main.js                      // bootstrap: load save, create Game, input + RAF loop
  styles/main.css              // all styles
  core/
    rng.js                     // seeded PRNG + helpers
    util.js                    // clamp, lerp, median, uid, formatNumber, deepMerge, round1
    save.js                    // create/load/write/clear save (storage injected)
  data/
    balance.js                 // every tunable number (§8)
    layouts.js                 // QWERTY + QWERTZ physical layouts, fingers
    zones.js                   // 9 regions, mobs, bosses, palettes, text modes
    words.js                   // ~1200 lowercase English words + contractions + fantasy words
    sentences.js               // capitalised fantasy sentences
    codeLines.js               // natural lines of code (JS/Python/SQL/shell)
    numberTemplates.js         // templates for the number zone
    spells.js                  // tiers, schools, spell names
    spellLexicon.js            // themed words, incantation templates, themed number phrases & code per school
    items.js                   // slots, rarities, base names, affixes, uniques, chests
    achievements.js            // achievement definitions
  logic/
    keyboard.js                // char maps, allowed chars per zone, char weights
    textGen.js                 // incantation + lesson drill generation
    cards.js                   // spell card creation (distinct first chars)
    mastery.js                 // per-key stats, mastery levels, weak keys
    stats.js                   // derived player stats from level/attunements/gear
    spellResolve.js            // damage/heal/shield formula
    loot.js                    // rarity rolls, item generation, drops, chests, sell values
    progression.js             // xp curve, enemy stats, victory rewards, zone unlocks
    achievements.js            // checkAchievements
    combat.js                  // CombatEngine (pure real-time state machine)
  ui/
    dom.js                     // h(), append(), clear(), fill(), charFromEvent(), button(), pulseClass(), centerOf()
    game.js                    // Game controller: screens, modals, save, hunt session
    audio.js                   // WebAudio synth sfx
    fx/background.js           // zone backgrounds on #bg-canvas
    fx/particles.js            // particles/projectiles on #fx-canvas + screen shake
    fx/floaters.js             // floating DOM damage numbers / banners
    components/keyboardView.js // on-screen keyboard with finger colours
    components/itemView.js     // item tile + tooltip + compare
    components/modal.js        // generic modal
    components/toast.js        // toasts
    components/lessonModal.js  // new-runes lesson with typing drill
    components/difficultyModal.js // "Choose your path": difficulty + optional skip-ahead
    components/incantation.js  // per-character typing line renderer (typed / current / pending spans)
    components/lootReveal.js   // victory / defeat / chest reveal panels
    screens/titleScreen.js
    screens/campScreen.js      // tab shell (map, character, merchant, grimoire, settings)
    screens/mapTab.js
    screens/characterTab.js
    screens/merchantTab.js
    screens/grimoireTab.js
    screens/settingsTab.js
    screens/combatScreen.js
tests/
  rng.test.js keyboard.test.js textGen.test.js cards.test.js mastery.test.js
  spellResolve.test.js loot.test.js progression.test.js combat.test.js save.test.js themedText.test.js
```

**Dependency rule:** `data` imports nothing (except other `data`). `logic` imports `core` + `data`.
`ui` imports everything. Nothing imports `ui` except `ui` and `main.js`.

---

## 3. Game design specification

### 3.1 Keyboard curriculum and layouts

Keys are identified by **physical code** (`KeyboardEvent.code` names, e.g. `KeyA`, `Semicolon`).
A layout maps each code to the characters it produces.

`data/layouts.js` exports:
```js
export const FINGERS = {
  lp: { name: 'Left pinky',   color: '#ff6b8b' },
  lr: { name: 'Left ring',    color: '#ffa94d' },
  lm: { name: 'Left middle',  color: '#ffe066' },
  li: { name: 'Left index',   color: '#69db7c' },
  ri: { name: 'Right index',  color: '#4dd4ac' },
  rm: { name: 'Right middle', color: '#4dabf7' },
  rr: { name: 'Right ring',   color: '#9775fa' },
  rp: { name: 'Right pinky',  color: '#f783ac' },
  th: { name: 'Thumb',        color: '#adb5bd' },
};
export const CODE_FINGER = { /* every code below → finger id */ };
export const LAYOUTS = { qwerty: {...}, qwertz: {...} };
```
Each layout: `{ id, name, rows }`. `rows` is an array of 5 rows (0 = number row, 1 = top, 2 = home,
3 = bottom, 4 = space). Each key: `{ code, base, shift, altgr?, dead?: ['base'|'shift'|'altgr'] , w?: width }`.
Dead keys are never generated in text. Also include non‑character keys for drawing only:
`Backspace`, `Tab`, `CapsLock`, `Enter`, `ShiftLeft`, `ShiftRight`, `Space` with `label` and `w`.

**QWERTY (US):**
- Row0: `` ` ~ `` 1! 2@ 3# 4$ 5% 6^ 7& 8* 9( 0) -_ =+ (codes Backquote, Digit1…Digit0, Minus, Equal), Backspace
- Row1: Tab, q w e r t y u i o p (KeyQ…KeyP), `[ {` BracketLeft, `] }` BracketRight, `\ |` Backslash
- Row2: CapsLock, a s d f g h j k l (KeyA…KeyL), `; :` Semicolon, `' "` Quote, Enter
- Row3: ShiftLeft, z x c v b n m (KeyZ…KeyM), `, <` Comma, `. >` Period, `/ ?` Slash, ShiftRight
- Row4: Space

**QWERTZ (DE):**
- Row0: Backquote `^ °` (base dead), 1! 2" (altgr ²) 3§ (altgr ³) 4$ 5% 6& 7/ (altgr {) 8( (altgr [) 9) (altgr ]) 0= (altgr }) Minus `ß ?` (altgr `\`) Equal `´ `` ` (both dead), Backspace
- Row1: Tab, q(altgr @) w e(altgr €) r t z(code KeyY) u i o p, BracketLeft `ü Ü`, BracketRight `+ *` (altgr ~), Enter spans
- Row2: CapsLock, a s d f g h j k l, Semicolon `ö Ö`, Quote `ä Ä`, Backslash `# '`
- Row3: ShiftLeft, IntlBackslash `< >` (altgr |), y(code KeyZ) x c v b n m (altgr µ), Comma `, ;`, Period `. :`, Slash `- _`, ShiftRight
- Row4: Space, `AltRight` (label "AltGr", special key, thumb) — needed to highlight AltGr chars

**Fingers by code** (standard touch typing):
- lp: Backquote Digit1 KeyQ KeyA KeyZ IntlBackslash ShiftLeft Tab CapsLock
- lr: Digit2 KeyW KeyS KeyX
- lm: Digit3 KeyE KeyD KeyC
- li: Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB
- ri: Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM
- rm: Digit8 KeyI KeyK Comma
- rr: Digit9 KeyO KeyL Period
- rp: Digit0 Minus Equal KeyP BracketLeft BracketRight Backslash Semicolon Quote Slash ShiftRight Enter Backspace
- th: Space

**Curriculum (zone index → codes unlocked, cumulative):**

| # | Zone id | Codes added | Modifier unlocked |
|---|---------|-------------|-------------------|
| 0 | meadow | KeyA KeyS KeyD KeyF KeyJ KeyK KeyL Semicolon (+Space always) | – |
| 1 | whisperwood | KeyG KeyH KeyE KeyI | – |
| 2 | ember | KeyR KeyU KeyT KeyY | – |
| 3 | skyreach | KeyO KeyW KeyQ KeyP | – |
| 4 | underbog | KeyC KeyV KeyB KeyN KeyM | – |
| 5 | archive | KeyX KeyZ Comma Period Slash Quote | – |
| 6 | citadel | (none) | **shift** |
| 7 | forge | Backquote Digit1…Digit0 Minus Equal | – |
| 8 | abyss | BracketLeft BracketRight Backslash IntlBackslash | **altgr** |

`logic/keyboard.js`:
```js
export function buildCharMap(layoutId)            // Map<char, {code,row,finger,shift,altgr}>; memoize per layout.
                                                  // Space → {code:'Space',row:4,finger:'th',shift:false,altgr:false}
                                                  // If a char is produced by 2 keys keep the first (no shift, no altgr preferred).
export function charInfo(layoutId, ch)            // lookup or null
export function codesUnlocked(zoneIndex)          // Set of codes of zones 0..zoneIndex
export function modifiersUnlocked(zoneIndex)      // { shift: bool, altgr: bool }
export function allowedChars(layoutId, zoneIndex) // Set<string>: ' ' + base chars of unlocked codes,
                                                  // + shift chars if shift unlocked, + altgr chars if altgr unlocked,
                                                  // skipping dead entries. Memoize by `${layoutId}:${zoneIndex}`.
export function newCharsForZone(layoutId, zoneIndex) // allowed(z) minus allowed(z-1) (z=0 → all of allowed(0) minus ' ')
export function charWeight(layoutId, ch)          // difficulty weight, see below
export function isTextAllowed(text, allowedSet)   // every char in set
```
**Character weight** (`charWeight`): `info = charInfo(...)`; unknown → 1.
`base = ROW_WEIGHT[info.row]` with `ROW_WEIGHT = [1.8, 1.25, 1.0, 1.4, 0.5]` (number, top, home, bottom, space).
Add `+0.1` if code is KeyG or KeyH (index stretch), `+0.15` if finger is `lp` or `rp`,
`+0.6` if `shift`, `+1.0` if `altgr`.

### 3.2 Zones (`data/zones.js`)

```js
export const ZONES = [ { id, name, icon, blurb, codes:[...], modifiers:[], palette:{...},
  ambient, textModes:{1,2,3,4}, mobs:[...], boss:{...} }, ... ];
export const GLIMMERKIN = { id:'glimmerkin', name:'Glimmerkin', icon:'💰', hpMult:0.8, atkMult:0,
  fleeAfter:20, goldMult:6, minRarity:'rare' };
export const TRAINING_DUMMY = { id:'dummy', name:'Training Sigil', icon:'🎯', dummy:true };
```
Mob: `{ id, name, icon, hpMult, atkMult, speedMult }` (speedMult multiplies the attack interval;
>1 = slower). Boss: `{ id, name, title, icon, hpMult, atkMult, speedMult, mechanics:[{id,...params}], intro }`.

Palette: `{ skyTop, skyBottom, moon, layers:[far, mid, near], accent, ambientColor }`.
Ambient types: `fireflies | spores | embers | snow | bubbles | motes | sparkles | sparks | void`.

| # | Name | Icon | Ambient | Text modes I/II/III/IV | Mobs (icon) | Boss | Boss mechanics |
|---|------|------|---------|------------------------|-------------|------|----------------|
| 0 | Hearthrow Meadow | 🌾 | fireflies | words ×4 | Dew Slug 🐌, Fluffhorn 🐇, Buzzling 🐝, Burrow Rat 🐀 | Mossback, the Elder Toad 🐸 | enrage{at:0.35,mult:0.6} |
| 1 | Whisperwood | 🌲 | spores | words ×4 | Hush Owl 🦉, Gloam Wolf 🐺, Sporeling 🍄, Silk Lurker 🕷️ | The Hollow Stag 🦌 | quicken{step:0.04,min:0.65}, enrage{at:0.3,mult:0.65} |
| 2 | Ember Hollow | 🌋 | embers | words ×4 | Ash Scorpion 🦂, Cinderbat 🦇, Magma Boar 🐗, Ember Wisp 🔥 | Cindermaw 🦎 | searing{pct:0.03}, enrage{at:0.3,mult:0.6} |
| 3 | Skyreach Peaks | 🏔️ | snow | words ×4 | Cliff Raptor 🦅, Squall Ram 🐏, Thunderhead ⛈️, Peak Goat 🐐 | Galecaller, Eye of the Storm 🌪️ | gust{every:12}, quicken{step:0.03,min:0.7} |
| 4 | The Underbog | 🐊 | bubbles | words ×4 | Mire Croc 🐊, Bloodgnat 🦟, Drowned One 🧟, Leech Coil 🐍 | Morra, the Mire Hag 👹 | hex{every:9,duration:5}, regen{pct:0.003} |
| 5 | The Sunken Archive | 📚 | motes | words ×4 (punctuation auto) | Living Scroll 📜, Ink Wraith 👻, Archive Kraken 🦑, Candle Imp 🕯️ | The Librarian Lich 💀 | blindfold{}, barrier{at:[0.66,0.33],amount:0.12,lowTierPct:0.3} |
| 6 | Capital Citadel | 🏰 | sparkles | words / capWords / sentence / sentence | Royal Guard 💂, Gilded Lion 🦁, Court Jester 🃏, Living Armor 🛡️ | King Shiftwright 🤴 | barrier{...same}, armored{pct:0.5,unless:'[A-Z]'} |
| 7 | Numeral Forge | ⚙️ | sparks | words / numbers / numbers / numbers | Clockwork Sentry 🤖, Cog Swarm ⚙️, Brass Beetle 🐞, Anvil Crab 🦀 | The Abacus Golem 🗿 | armored{pct:0.5,unless:'[0-9]'}, quicken{step:0.03,min:0.7} |
| 8 | The Glyph Abyss | 🌀 | void | words / code / code / code | Glitch Invader 👾, Void Octopus 🐙, Recursion 🌀, Null Pointer 🕳️ | Null, the Unterminated 👁️ | gust{every:15}, hex{every:11,duration:4}, barrier{...}, enrage{at:0.25,mult:0.6} |

Mob multipliers: give each zone's 4 mobs a mix, e.g. `{hpMult:1,atkMult:1,speedMult:1}`,
`{hpMult:0.8,atkMult:0.9,speedMult:0.85}` (fast & fragile), `{hpMult:1.3,atkMult:1.15,speedMult:1.15}` (tank),
`{hpMult:1,atkMult:1.25,speedMult:1.05}` (hard hitter). Bosses 0–5: `hpMult 3.5, atkMult 1.15, speedMult 1.0`;
citadel & forge bosses: `hpMult 3.0, atkMult 1.1, speedMult 1.05` (their armor/barrier already adds
effective HP); final boss: `hpMult 3.8, atkMult 1.1, speedMult 1.05`. (Tuned with the simulation in §8.) Write a short evocative `blurb` (1–2 sentences) per zone and an `intro` line per boss.

Palettes (skyTop, skyBottom, moon, far, mid, near, accent, ambientColor):
- meadow: `#14213d #3f6b5c #fff3c4 #2c5146 #1f3d33 #142a22 #9be37a #e9ff8a`
- whisperwood: `#0b1a26 #24434a #cfe8ff #1c3a3a #142c2c #0b1f1f #6fd6c0 #b8f5d0`
- ember: `#1a0a0a #6b1f12 #ffb36b #4a1a12 #33110c #200806 #ff7a3d #ffb35c`
- skyreach: `#0e1430 #4b5c99 #e8f0ff #3b4775 #2a335a #1b2140 #a5c8ff #ffffff`
- underbog: `#0d140f #34402a #d7ffb0 #2b3a26 #1e2a1b #121b10 #a3d977 #c6ff9e`
- archive: `#04111f #0f3a5a #9ff3ff #0c2f47 #082236 #041624 #5fd0e6 #bdf7ff`
- citadel: `#160d2b #4b2a6e #ffe7a3 #3a2257 #2a173f #1a0e28 #f5c66b #ffe9a8`
- forge: `#0f0f12 #3a2a1f #ffcf8a #2b221c #1e1814 #120e0b #ff9f43 #ffd27a`
- abyss: `#020208 #1a0b33 #c9a7ff #170a2e #0f0620 #070312 #b07cff #7df9ff`

Text modes: `words`, `capWords`, `sentence`, `numbers`, `code` (see §3.3).

### 3.3 Text generation (`logic/textGen.js`)

Tier length ranges (characters, inclusive) — from `TIERS` in `data/spells.js`:
I: 3–12, II: 10–22, III: 20–40, IV: 34–64.

```js
export function generateIncantation({ layoutId, zoneIndex, tier, rng, weakChars = [], avoidFirst = [], school = null })
export function generateLessonDrill({ layoutId, zoneIndex, rng }) // → string[] (2 lines)
export function wordPool(layoutId, zoneIndex) // memoized: WORDS filtered by allowedChars
```
`generateIncantation` algorithm:
1. `allowed = allowedChars(layoutId, zoneIndex)`, `fresh = newCharsForZone(...)`, `mode = ZONES[zoneIndex].textModes[tier]`.
2. Try up to 40 times: build a candidate with the mode builder (the **themed** builder when `school` is
   given, see "Themed incantations" below); accept the first candidate that
   (a) passes `isTextAllowed`, (b) `floor(tier.min * 0.7) <= length <= tier.max`, (c) its first character (lower‑cased)
   is not in `avoidFirst` (compare lower‑cased). Remember the best fallback (allowed + not avoided,
   ignoring length) and return it if no perfect candidate; final fallback: up to 30 `words` results,
   returning the first whose first character is not avoided (never break the distinct‑first‑letter rule).
3. A non‑themed builder that cannot produce allowed text falls back to the `words` builder. A themed
   builder returning `null` just retries with another template.

**Word weighting** (used by every builder that picks words): weight =
`1 + (word contains any fresh char ? 2.5 : 0) + (word contains any weak char ? 1.5 : 0)`,
then × `2` if tier 1 and length ≤ 5, × `0.4` if tier 1 and length > 6,
× `1.6` if tier ≥ 3 and length ≥ 5. Never repeat a word inside one incantation (retry pick up to 5 times).

**`words` builder:** pick words until total length (joined with single spaces) ≥ tier min; if
it exceeds max, return it anyway (the retry loop will reject it). Then punctuation by allowed chars:
- if `;` allowed and tier ≥ 3 and `rng.chance(0.35)`: join one random middle gap with `"; "` instead of `" "`.
- if `,` allowed and tier ≥ 2: each gap (not the last) becomes `", "` with chance 0.18 (max 2 commas).
- if `/` allowed and tier ≥ 2 and `rng.chance(0.08)`: join one gap with `/` (no spaces).
- if `.` allowed and tier ≥ 3: append `.`.

**`capWords` builder:** `words` builder result, then capitalise the first letter; with chance 0.5
replace one random word (not the first) by a proper noun from `PROPER_NOUNS` (in `sentences.js`:
`Qwerth, Elandra, Morrow, Vex, Ashgrove, Kael, Lyra, Orin, Thorne, Sable, Dawnhold, Ivy, Rook, Juno, Halden`),
then ensure it ends with `.` if allowed.

**`sentence` builder:** `SENTENCES` filtered by allowed + the same length rule as step 2(b); pick one
(weighted by weak/fresh chars like words). If none → `capWords`.

**`numbers` builder:** pick a template from `NUMBER_TEMPLATES[tier]` (tiers 2–4; tier 1 uses `words`).
Placeholders: `{d}` 1–9, `{dd}` 10–99, `{ddd}` 100–999, `{year}` 1000–2099, `{time}` `h:mm`
(h 1–12, mm 00–59 zero‑padded), `{noun}` from `NUMBER_NOUNS` (plural nouns), `{verb}` from
`NUMBER_VERBS`. Fill every placeholder independently.

**`code` builder:** `CODE_LINES` filtered by allowed + tier length range; pick one. If none → `words`.

#### Themed incantations (`data/spellLexicon.js`) — used for every spell card

Spell cards pass their `school` so the words match the spell. `spellLexicon.js` exports:
- `SCHOOL_LEXICON[school] = { verbs, nouns, plurals, adjs, targets }` for fire, frost, storm, arcane, nature,
  ward (≈20 lowercase words each; `targets` are phrases such as `"the foe"`, `"my wounds"`, `"my allies"` —
  heal/ward targets are the caster). Include words that only use early letters (e.g. ward: shield, aegis,
  shell, hide, safe; nature: heal, leaf, seed, life) so themes start early.
- `GENERIC_LEXICON` (same keys): neutral magic words used when a school has no unlocked word for a slot.
- `PLACES`: capitalised proper nouns (needs Shift).
- `INCANTATION_TEMPLATES[tier]`: token strings, e.g. `'{adj} {noun} , {verb} !'`,
  `'let the {adj} {pl} {verb} {target}'`, `'by {noun} , by {noun} , by {adj} {noun} : {verb} {target} !'`.
  Slots: `{verb} {noun} {pl} {adj} {target} {place}` and numbers `{d} {dd} {ddd} {year} {time}`.
  Punctuation is a separate token. Other tokens are literal words (`of`, `and`, `let`, `by`, `I`...).
- `NUMBER_INCANTATIONS[2..4]` (e.g. `'{verb} {dd} {pl} at {time} !'` → "Summon 12 sparks at 9:30!").
- `SCHOOL_CODE_LINES[school]`: ~12 code lines that do what the spell does (`burn(foe);`, `shield.up();`,
  `for (const s of shards) { s.hurl(foe); }`), spanning all tier lengths.

`renderTemplate(tpl, ctx, { caps, capFirst })`:
1. Split on spaces. Punctuation token: use the first unlocked option of
   `! → [! .]`, `. → [.]`, `, → [,]`, `; → [; ,]`, `: → [: , ;]`; attach to the previous word; drop if none.
2. Number slot → random number. Word slot → candidates = unlocked, unused words of the school's list for
   that slot, else of `GENERIC_LEXICON`, else (any slot but `place`) a word from `wordPool` — this keeps the
   home row playable even though it has almost no themed words. Weight `1 + 2.5·fresh + 1.5·weak`.
3. Literal word not fully unlocked → return `null` (the template becomes usable later).
4. Strip a trailing `, ; :`. With `caps` (and Shift unlocked): capitalise the first letter, every `{noun}` and
   `{place}`, and the first letter after `. ! ?`. `capFirst` only capitalises the first letter.

Themed builders per text mode: `words` → template; `capWords` and `sentence` → template with `caps`;
`numbers` → tier 1 template, else `NUMBER_INCANTATIONS` with `capFirst` for tiers ≥ 3; `code` → tier 1 template,
else `SCHOOL_CODE_LINES[school]` (length rule), else `CODE_LINES`, else template.
Expected results (QWERTY): region 3 "sear the dark", region 5 "by ember by flare by burning sun; crackle the
wicked", region 7 "Hear me, Truth of Ashgrove.", region 8 "Charge the foe 2 times, then whirl!".
`tests/themedText.test.js` asserts only unlocked characters are used, and that from region 3 on (zone index ≥ 2)
≥ 85 % of incantations contain a word of their school (or are one of its code lines).

The original untargeted builders below stay in use for lesson drills and as fallbacks.

**Lesson drill:** `fresh = [...newCharsForZone]` without space. Line 1: take up to 6 fresh chars
(random order; prefer letters/digits/symbols over uppercase if more than 6), each repeated 3 times,
joined by spaces (e.g. `"ggg hhh eee iii"`). For uppercase chars use `"Aa"`‑style pairs instead
(e.g. `"Aa Ss Dd"`). Line 2: `generateIncantation({tier: 2, ...})` with `weakChars = fresh`.

### 3.4 Spells (`data/spells.js`, `logic/cards.js`)

```js
export const TIERS = {
  1: { id:1, name:'Cantrip',        roman:'I',   mult:1.00, tolerance:2, min:3,  max:12, backfire:0    },
  2: { id:2, name:'Spell',          roman:'II',  mult:1.20, tolerance:3, min:10, max:22, backfire:0    },
  3: { id:3, name:'Incantation',    roman:'III', mult:1.45, tolerance:3, min:20, max:40, backfire:0.10 },
  4: { id:4, name:'Forbidden Rite', roman:'IV',  mult:1.90, tolerance:4, min:34, max:64, backfire:0.20 },
};
export const SCHOOLS = {
  arcane: { id:'arcane', name:'Arcane', icon:'✨', color:'#b48cff', kind:'damage', dmg:1.15 },
  fire:   { id:'fire',   name:'Fire',   icon:'🔥', color:'#ff7a3d', kind:'damage', dmg:1.00, burnPct:0.30, burnSec:3 },
  frost:  { id:'frost',  name:'Frost',  icon:'❄️', color:'#7fd8ff', kind:'damage', dmg:0.85, freezePct:0.30 },
  storm:  { id:'storm',  name:'Storm',  icon:'⚡', color:'#ffe066', kind:'damage', dmg:0.90, critBonus:0.20 },
  nature: { id:'nature', name:'Nature', icon:'🌿', color:'#7dffa1', kind:'heal',   dmg:0.25, healPct:0.80 },
  ward:   { id:'ward',   name:'Ward',   icon:'🛡️', color:'#9fb4ff', kind:'shield', dmg:0,    shieldPct:1.20 },
};
export const SCHOOL_WEIGHTS = { arcane:18, fire:20, frost:16, storm:16, nature:15, ward:15 };
export const SPELL_NAMES = {
  arcane: ['Arcane Spark','Arcane Missile','Arcane Torrent','Singularity'],
  fire:   ['Ember','Fireball','Inferno','Sunfall'],
  frost:  ['Chill','Frost Lance','Blizzard','Absolute Zero'],
  storm:  ['Static','Lightning Bolt','Chain Storm','Wrath of the Skies'],
  nature: ['Mend','Rejuvenate','Verdant Bloom','World Tree'],
  ward:   ['Guard','Barrier','Aegis','Bastion of Ages'],
};
```
`logic/cards.js`:
```js
export function pickSchool(rng, tier, otherCards)   // tier 4: uniform among damage schools.
   // else weighted by SCHOOL_WEIGHTS; if the other regular cards already contain a non-damage card,
   // force a damage school (so at most one of the 3 regular cards is heal/shield).
export function createCard({ tier, ctx, rng, otherCards, school }) // → { id, tier, school, name, text }
   // picks the school FIRST, then generateIncantation({ ..., school }) so the words match the spell
   // ctx = { layoutId, zoneIndex, weakChars }; avoidFirst = otherCards' first chars
export function createInitialCards(ctx, rng)        // tiers [1,2,3] in that order
export function replaceCard(cards, cardId, ctx, rng)// new card of same tier at same index (returns new array)
```
`id` = incrementing string `c1, c2, …` (module counter is fine).

**Casting rules (implemented in CombatEngine):**
- No active cast + a typed char: candidates = non‑silenced cards whose `text[0] === ch`. First match
  (lowest index) becomes the active cast and the char counts as the first correct key. No match →
  event `noMatch` (UI wiggle), not counted as an error.
- Active cast: `ch === text[typed]` → correct; otherwise mistake (cursor does not move).
- `Escape` with active cast → cancel (no penalty, card stays). Without cast → pause menu.
- Mistakes > `tier.tolerance + stats.tolerance` → **fizzle**: card replaced (tier IV removed),
  backfire damage `round(maxHp × tier.backfire)` to the player.
- After a cast completes or fizzles, the card is replaced by a fresh one of the same tier
  (tier IV is removed and Flow resets to 0).

**Flow & combo:** each correct key: `combo++`, `flow += 1.25 × stats.flowGainMult` (max 100).
Each mistake: `combo = 0`, `flow −= 15` (min 0). When flow reaches 100 the Rite card (tier IV) is
added and flow is **locked at 100** (mistakes don't reduce it) until the Rite is completed or
fizzles, then flow = 0. Flow ≥ 50 gives +5 % crit chance.

### 3.5 Damage formula (`logic/spellResolve.js`)

```js
export function rawPower(text, layoutId, keyStats, uniques)
  // Σ charWeight(c) × (1 + masteryBonus(keyMastery(keyStats[c])))
  //   × (uniques.has('hearth') && row===2 ? 2 : 1)
  //   × (uniques.has('glyphwright') && (digit|symbol|uppercase) ? 1.5 : 1)
export function speedMultiplier(wpm)        // clamp(0.5 + wpm/40, 0.5, 3.0)
export function accuracyMultiplier(errors, uniques) // max(0.25, 1 - perErr*errors), perErr = 0.12 (0.24 with 'perfectionist')
export function resolveSpell({ card, wpm, errors, stats, rng, keyStats, layoutId, flow, avalancheStacks })
  // returns { kind, damage, heal, shield, burnTotal, freezePct, crit, perfect, echo, speedMult, accMult, power }
export function estimateCard(card, stats, avgWpm, layoutId, keyStats) // preview: no crit, 0 errors → { kind, value }
```
Computation:
```
school = SCHOOLS[card.school]; tier = TIERS[card.tier]
power  = rawPower(...) * tier.mult
speed  = speedMultiplier(wpm); if speed > 1: speed = 1 + (speed-1) * (1 + stats.swiftness/100)
acc    = accuracyMultiplier(errors, stats.uniques)
perfect= errors === 0
perfMul= perfect ? 1.15 + stats.perfectBonus/100 + (uniques.perfectionist ? 0.60 : 0) : 1
base   = power * stats.powerMult * speed * acc * perfMul
critCh = stats.critChance + (school.critBonus||0) + (flow >= 50 ? 0.05 : 0)
crit   = rng.chance(critCh) (never for heal/shield kinds)
critMul= crit ? stats.critMult : 1
aval   = 1 + 0.10 * avalancheStacks (only if unique 'avalanche')
damage = round(base * school.dmg * (1 + stats.schoolPct[school]/100) * critMul * aval)     // damage & heal kinds
heal   = kind==='heal'   ? round(base * school.healPct * stats.healMult) : 0
shield = kind==='shield' ? round(base * school.shieldPct * stats.shieldMult) : 0
burnTotal = school.burnPct ? round(damage * school.burnPct) : 0
freezePct = school.freezePct || 0
echo   = uniques.has('echo') && kind==='damage' && rng.chance(0.15)
```
Every result value ≥ 0; damage kinds have damage ≥ 1.

### 3.6 Enemies, bosses, mechanics

Enemy stats (`progression.enemyStats(zoneIndex, kind, def)`), `z = zoneIndex`:
```
hp       = round(BAL.enemyHpBase * BAL.enemyHpGrowth^z * def.hpMult * kindHp)    // 50, 1.24
atk      = round(BAL.enemyAtkBase * BAL.enemyAtkGrowth^z * def.atkMult * kindAtk)  // 8, 1.16
attackSec= max(3.5, (BAL.attackSecBase - BAL.attackSecPerZone*z) * def.speedMult)  // 7.5, 0.3
kindHp  = { mob:1, elite:2.2, boss:1, glimmerkin:1, dummy:1 }   (boss hpMult already in def)
kindAtk = { mob:1, elite:1.3, boss:1, glimmerkin:0, dummy:0 }
```
Effective attack interval in the engine: `attackSec × tempoMult × difficulty.enemySpeed`, where
`tempoMult = clamp(sqrt(25 / avgWpm), 0.75, 1.5) × (1 + stats.tempoPct/100)`
(square root on purpose: a linear version stacked with `quicken` made late bosses attack every ~2 s),
`avgWpm` = mean of `save.recentWpm`
(default 25 when empty).

**Elites:** 12 % + 2 % × chain chance when a hunt fight spawns (not for bosses). Name prefix and
one mechanic: `Furious` → quicken{step:0.04,min:0.65}, `Ancient` → regen{pct:0.004},
`Blazing` → searing{pct:0.02}. CSS aura colour red/green/orange.
**Glimmerkin:** 5 % chance (checked before elite). Never attacks, flees after 20 s (event
`escaped`, ends the fight with no rewards but no penalty), on death gives `goldMult 6` and an item
with minimum rarity `rare`.

**Mechanics** (all handled inside `CombatEngine`; each mechanic object keeps a `state`):
- `enrage{at,mult}` once when `hp/maxHp < at`: `intervalMult *= mult`, event `mechanic` text `"ENRAGED!"`.
- `quicken{step,min}` after every enemy attack: `intervalMult = max(min, intervalMult - step)`.
- `searing{pct}` on every player mistake: player takes `max(1, round(maxHp*pct))` (shield absorbs).
- `gust{every}` every `every` s: replace all cards except the one being cast (event `mechanic` "A gust scatters your spells!").
- `hex{every,duration}` every `every` s: a random non‑casting, non‑silenced card gets `silencedUntil = now + duration*1000` (event `mechanic` "Hexed!"). Silenced cards can't be selected; UI shows them greyed with a lock.
- `blindfold{}` UI hides the keyboard guide for the whole fight (engine exposes `this.blindfold = true`).
- `barrier{at:[..],amount,lowTierPct}` when `hp/maxHp` first drops below each threshold: `barrier = round(maxHp*amount)`. Damage hits the barrier first; tier I/II spells only deal `lowTierPct` of their damage to the barrier. Events `barrier` / `barrierBroken`.
- `armored{pct,unless}` spells whose text does not match `new RegExp(unless)` deal `× pct`; event field `resisted: true`.
- `regen{pct}` each second heals `maxHp*pct` (fractional, continuous).

### 3.7 Hunts, chains, rewards, death

- Starting a hunt from the map creates `game.hunt = { zoneIndex, chain: 0, satchel: 0, hp: null }`.
- Each victory: rewards (`progression.grantVictory`); gold goes into `hunt.satchel`.
  Victory panel offers **Continue** (Enter) → `chain++`, next fight starts with
  `hp = min(maxHp, hpLeft + 0.3*maxHp)`, or **Camp** (Esc) → satchel banked into `save.player.gold`.
- Chain bonus: `chainBonus = min(chain * 0.10, 1.0)` → gold × (1 + chainBonus), magic find + chainBonus×50.
- **Defeat:** lose `floor(satchel * 0.5)`, bank the rest, return to camp. Items are kept.
- **Flee** (pause menu): lose `floor(satchel * 0.25)`, bank the rest.
- **Boss fight:** separate session with chain 0; victory banks everything and returns to camp after
  the panel. Bosses can be re‑fought for loot once defeated.
- **Practice Shrine:** fight vs `TRAINING_DUMMY` (infinite HP shown as ∞, never attacks, no loot).
  Leaving gives XP = `floor(correctChars / 10)`.
- Boss becomes available when `save.zones[id].kills >= BAL.killsForBoss (6)` or already defeated.

`grantVictory(save, { zoneIndex, kind, chain, stats, rng, enemyDef })` → `{ xp, gold, items, autoSold, levelsGained, newLevel, zoneCleared, zoneUnlocked }`:
```
kindXp   = { mob:1, elite:2.5, boss:10, glimmerkin:2 }
kindGold = { mob:1, elite:2.5, boss:8, glimmerkin:6 }
xp   = round(BAL.xpBase(15) * BAL.xpGrowth(1.35)^z * kindXp)
gold = round(rng.int(5,10) * 1.4^z * kindGold * stats.goldMult * (1+chainBonus))
items= rollDrops(...) ; push into inventory; if inventory full (30) → auto-sell (add value to gold, list in autoSold)
kills++ (mob/elite/glimmerkin); boss → zones[id].bossDefeated = true; if save.unlockedZone === z and z < last → unlockedZone++ (zoneUnlocked = z+1)
addXp(save, xp) → level ups grant +1 attunement point each
stats counters: totalKills++, bossesDefeated++ ...
```
`xpToNext(level) = round(25 * level^1.5)`. Max level 60.
`spawnEnemy({ rng, zoneIndex, chain })` (progression.js) → `{ def, kind }`: Glimmerkin check first, then
elite check (clone the mob def with `name: "<prefix> <name>"`, `aura`, `mechanics:[trait.mechanic]`), else mob.

### 3.8 Loot (`data/items.js`, `logic/loot.js`)

Slots: `staff 🪄`, `robe 🧥`, `amulet 📿`, `ring 💍`, `tome 📖`.
Rarities (order matters):
```js
export const RARITIES = [
 { id:'common',    name:'Common',    color:'#c9cdd6', weight:600, affixes:1, mult:1.00, sell:3   },
 { id:'uncommon',  name:'Uncommon',  color:'#4ade80', weight:260, affixes:2, mult:1.15, sell:8   },
 { id:'rare',      name:'Rare',      color:'#60a5fa', weight:105, affixes:3, mult:1.30, sell:20  },
 { id:'epic',      name:'Epic',      color:'#c084fc', weight:30,  affixes:4, mult:1.50, sell:50  },
 { id:'legendary', name:'Legendary', color:'#fb923c', weight:5,   affixes:3, mult:1.70, sell:150 },
];
```
`rollRarity(rng, { magicFind = 0, minRarity = 'common' })`: weights; uncommon × (1+mf/200),
rare/epic/legendary × (1+mf/100); rarities below `minRarity` get weight 0.

Base names by slot × tier band (`band = min(4, floor((ilvl-1)/2))`):
- staff: Twig Wand, Birch Staff, Runed Rod, Starwood Staff, Voidglass Scepter
- robe: Linen Robe, Wool Cloak, Silk Vestment, Runewoven Robe, Astral Mantle
- amulet: Bone Charm, Copper Locket, Jade Amulet, Sunstone Pendant, Eclipse Talisman
- ring: Tin Band, Silver Ring, Opal Ring, Dragonbone Loop, Infinity Signet
- tome: Tattered Primer, Apprentice Spellbook, Scholar's Codex, Sage's Grimoire, Elder Codex
Prefix by rarity: common none, uncommon `Fine`, rare `Gleaming`, epic `Exalted`. Suffix from the
first affix's `suffix`. Name = `[prefix] base [suffix]`. Legendary uses the unique's name.

Affixes (`value = max(1, round(base * (1 + 0.15*(ilvl-1)) * rarity.mult * rng.float(0.75, 1.0)))`,
except `steady` which is always 1). Each item gets distinct affixes:
| id | label (`{v}` = value) | base | stat key | suffix | notes |
|----|----|----|----|----|----|
| power | +{v}% spell damage | 4 | powerPct | of Might | |
| crit | +{v}% critical chance | 2 | critPct | of Precision | |
| critDmg | +{v}% critical damage | 10 | critDmgPct | of Ruin | |
| vitality | +{v} maximum health | 8 | maxHp | of the Bear | |
| flow | +{v}% flow gain | 6 | flowPct | of Flow | |
| gold | +{v}% gold found | 6 | goldPct | of Greed | |
| luck | +{v}% item rarity | 5 | magicFind | of Fortune | |
| fire | +{v}% fire damage | 8 | school.fire | of Embers | |
| frost | +{v}% frost damage | 8 | school.frost | of Winter | |
| storm | +{v}% storm damage | 8 | school.storm | of Storms | |
| arcane | +{v}% arcane damage | 8 | school.arcane | of the Arcane | |
| healing | +{v}% healing | 8 | healPct | of Mending | |
| warding | +{v}% shield strength | 8 | shieldPct | of Warding | |
| patience | Enemies attack {v}% slower | 2 | tempoPct | of Patience | |
| perfection | +{v}% damage on perfect casts | 6 | perfectBonus | of Perfection | |
| swiftness | +{v}% speed bonus | 5 | swiftness | of Haste | |
| leech | Heal {v}% of damage dealt | 1 | leechPct | of the Leech | |
| steady | +1 mistake allowed before fizzling | – | tolerance | of Composure | rare+ only, value 1 |

Uniques (legendary only; item = unique + 3 random affixes; `ilvl` as normal):
| id | slot | name | effect text |
|----|------|------|-------------|
| echo | staff | Quill of Echoes | 15% chance a damage spell is cast twice. |
| avalanche | staff | Avalanche Rod | Each cast within 2.5s of the last adds +10% damage (max +50%). |
| hearth | robe | Mantle of the Hearth | Home row keys channel double power. |
| phoenix | amulet | Phoenix Ember | Once per fight, survive a lethal blow with 30% health. |
| secondWind | ring | Band of Second Chances | The first spell that would fizzle each fight holds together. |
| glyphwright | ring | Signet of the Glyphwright | Capitals, digits and symbols channel +50% power. |
| perfectionist | tome | Codex of the Perfectionist | Perfect casts deal +60% damage, but mistakes cost double. |
| tempest | tome | Tempest Primer | Critical hits push the enemy's attack back by 25%. |

Item object: `{ id, slot, rarity, ilvl, name, affixes:[{id, value}], unique: null|uniqueId }`.

Drops (`rollDrops({ rng, kind, zoneIndex, magicFind, pity })` → items; `ilvl = zoneIndex + 1` (+1 boss)):
- mob: 30 % one item. elite: 75 % one item, then 25 % a second; min rarity uncommon.
- boss: 2 items, min rarity rare, +100 magic find. glimmerkin: 1 item, min rare.
- **Pity:** `save.stats.itemsSinceLegendary` increments per item; at ≥ 150 the next item is legendary; reset when a legendary drops.

Chests (merchant), cost × `1.4^highestUnlockedZone`:
- Weathered Chest 🧰 50g: 1 item, normal roll.
- Gilded Chest 🎁 220g: 1 item, min uncommon, +60 magic find.
- Astral Coffer 💎 900g: 1 item, min rare, +200 magic find.
`sellValue(item) = round(rarity.sell * 1.35^(ilvl-1))`.

### 3.9 Player progression

`computePlayerStats(save)` (`logic/stats.js`) — sum affixes of equipped items into `gear[statKey]`:
```
level = save.player.level ; a = save.player.attune {might, focus, vigor, fortune}
maxHp      = 100 + BAL.hpPerLevel(12)*(level-1) + 8*a.vigor + gear.maxHp
powerMult  = 1 + BAL.powerPerLevel(0.05)*(level-1) + 0.03*a.might + gear.powerPct/100
critChance = min(0.75, 0.05 + 0.015*a.focus + gear.critPct/100)
critMult   = 1.75 + gear.critDmgPct/100
flowGainMult = 1 + 0.03*a.focus + gear.flowPct/100
goldMult   = 1 + 0.04*a.fortune + gear.goldPct/100
magicFind  = 3*a.fortune + gear.magicFind
tolerance  = gear.tolerance            (extra mistakes allowed)
tempoPct, healMult = 1+gear.healPct/100, shieldMult = 1+gear.shieldPct/100,
schoolPct  = { fire, frost, storm, arcane } (gear school.* values),
perfectBonus, swiftness, leechPct, uniques: Set of equipped unique ids
```
Attunements (1 point per level‑up, freely re‑assignable with a Reset button):
Might (+3 % damage), Focus (+1.5 % crit, +3 % flow), Vigor (+8 HP), Fortune (+4 % gold, +3 magic find).

**Key mastery** (`logic/mastery.js`). `keyStats[ch] = { n, miss, recent: number[] (1/0, last 40), ms: number[] (last 40) }`.
```js
export function recordKey(keyStats, ch, ok, ms)    // ms = null when unknown; ignore ms > 2000
export function keySummary(stat)                    // { n, acc (recent, or 1 if none), medianMs (or null) }
export function keyMastery(stat)                    // 0..3
export function masteryBonus(level)                 // [0, 0.10, 0.20, 0.30][level]
export function weakChars(keyStats, allowedSet, count = 3) // chars with n >= 8, lowest score = acc * (300 / max(medianMs,150))
export const MASTERY_NAMES = ['Novice','Adept','Master','Grandmaster']
```
Mastery levels: 1 = n ≥ 20, acc ≥ 0.90, median ≤ 450 ms; 2 = n ≥ 50, acc ≥ 0.95, median ≤ 330;
3 = n ≥ 100, acc ≥ 0.98, median ≤ 240. (`acc` and `median` use the `recent` / `ms` windows.)

### 3.11 Difficulty (`DIFFICULTIES` in `data/balance.js`, `components/difficultyModal.js`)

Chosen on the "Choose your path" screen when a journey starts (first Begin, New game, Reset progress, or
Continue on an older save where `settings.difficultyChosen` is false). Changeable later in Settings.

| | Apprentice 🌱 | Adept 🔮 | Archmage ⚡ |
|---|---|---|---|
| For | new to touch typing | knows the keys (default) | touch types, wants to get faster |
| `enemySpeed` (attack interval ×) | 1.4 | 1 | 0.8 |
| `enemyDamage` / `enemyHp` | 0.65 / 0.85 | 1 / 1 | 1.25 / 1.1 |
| `tolerance` (mistakes, min total 1) | +1 | 0 | −1 |
| `backfire` (fizzle damage ×) | 0 | 1 | 1.5 |
| `rewardMult` (gold & XP) | 1 | 1 | 1.35 |
| `pace` | – | – | ✓ |
| `guide` set on choosing | always | hints | off |

**Pace rune (Archmage):** `paceMult = clamp(castWpm / paceRef, 0.7, 1.4)` multiplies the spell's base
(damage, heal and shield); `paceRef` = mean of `save.recentWpm` when the fight starts (25 if empty). It is
exported from combat.js as `paceMultiplier(wpm, paceRef)`, returned as `result.paceMult`, and shown in the
WPM floater ("· pace +18%").

**Skip ahead:** on a fresh save (`level 1, unlockedZone 0, totalKills 0`) the path screen offers
"I already touch type — skip the letter lessons" (`S`). It sets `unlockedZone` to the Sunken Archive,
marks the lessons of earlier zones as seen (bosses stay undefeated so they can be revisited), and raises
the player to `BAL.skipAheadLevel` (8) with the matching attunement points. `game.applyDifficulty(id, { skipAhead })`
stores `settings.difficulty`, `settings.difficultyChosen = true`, `settings.guide = d.guide`, then saves.

Path screen UI: three cards (icon, name, tagline, perk list; `1`/`2`/`3` or `←/→` to select, click works),
the skip toggle, `Enter` to begin. The combat top bar shows a chip with the difficulty's icon and name.

Simulated checks: Apprentice at 12 WPM with 8 % mistakes beats Mossback 100 %; Archmage who skipped ahead
(level 8→9, 60 WPM) beats the Librarian Lich ~50 %, at 75 WPM ~90 %.

### 3.10 Achievements (`data/achievements.js`, `logic/achievements.js`)

`{ id, name, icon, desc, check(save, ctx) }` where ctx = `{ fight }` (fight summary) or `{}`.
- firstBlood 🗡️ First Blood — defeat your first foe (`stats.totalKills >= 1`)
- flawless 💎 Flawless — complete a tier III+ spell with no mistakes (`stats.perfectHighTier >= 1`)
- combo50 🔗 In the Flow — reach a 50 combo (`stats.bestCombo >= 50`)
- combo150 ⛓️ Unbroken — reach a 150 combo
- wpm60 💨 Swift Tongue — cast a spell at 60+ WPM (`stats.bestWpm >= 60`)
- wpm100 ⚡ Lightning Fingers — cast at 100+ WPM
- legendary 🌟 Legend Touched — find a legendary item (`stats.legendariesFound >= 1`)
- chain10 🔥 Relentless — win 10 fights in one hunt (`stats.bestChain >= 10`)
- rite 📜 Forbidden Knowledge — complete a Forbidden Rite (`stats.ritesCast >= 1`)
- glimmer 💰 Finders Keepers — defeat a Glimmerkin
- boss5 👑 Halfway Hero — defeat 5 different bosses (count `zones[*].bossDefeated`)
- realmBreaker 🌀 Realm Breaker — defeat Null, the Unterminated
`checkAchievements(save, ctx)` → newly unlocked list; sets `save.achievements[id] = Date.now()`.

---

## 4. Architecture details

### 4.1 Save schema (`core/save.js`)
```js
export const SAVE_KEY = 'spellstroke.save.v1';
export function createNewSave() { return {
  version: 1,
  createdAt: Date.now(),
  player: { level: 1, xp: 0, gold: 0, points: 0, attune: { might:0, focus:0, vigor:0, fortune:0 } },
  equipment: { staff:null, robe:null, amulet:null, ring:null, tome:null },
  inventory: [],
  unlockedZone: 0,
  zones: {},                  // zoneId → { kills, bossDefeated, lessonSeen }
  keyStats: {},
  recentWpm: [],              // last 30 cast WPMs
  history: [],                // last 200 fights { t, wpm, acc, zone }
  achievements: {},
  stats: { totalKills:0, totalCasts:0, perfectCasts:0, perfectHighTier:0, fizzles:0, bestWpm:0,
           bestCombo:0, bestChain:0, ritesCast:0, legendariesFound:0, glimmerkins:0,
           itemsSinceLegendary:0, charsTyped:0, bossesDefeated:0, deaths:0, playSeconds:0,
           // v1.1:
           milestonesReached:0, boonsTaken:0, bestBoonCount:0, eventsCompleted:0 },
  settings: { layout: 'qwerty', guide: 'hints', difficulty: 'adept', difficultyChosen: false, volume: 0.6, shake: true },
}; }
export function zoneState(save, zoneId) // get-or-create { kills:0, bossDefeated:false, lessonSeen:false }
export function loadSave(storage)        // parse JSON → deepMerge(createNewSave(), parsed); null if none/invalid
export function writeSave(save, storage) // try/catch, JSON.stringify
export function clearSave(storage)
```
`deepMerge(defaults, loaded)`: for plain objects recurse; arrays and primitives from `loaded` win.

v1.3: `rogue: { ink, upgrades, best, runs, totalRuns, lastCircle, run }` and five stats counters — see §13.3.

v1.1: `keyStats[ch]` = `{ n, miss, recent, ms, peak? }` — `peak` is the highest mastery level ever announced
(initialised lazily by `recordKeyTracked`, §11.2). The active hunt (`Game.hunt`, `createHunt` in §11.1) is not saved.

### 4.2 Combat engine (`logic/combat.js`)

```js
export class CombatEngine {
  constructor({ zoneIndex, kind, enemyDef, stats, layoutId, keyStats, rng, now, carryHp = null,
                tempoMult = 1, weakChars = [], difficulty = DIFFICULTIES.adept, paceRef = 25 })
  // difficulty scales enemy hp/atk/interval, toleranceFor() and fizzle backfire; paceRef feeds the pace rune
  // public state (read by UI):
  //   phase: 'fighting'|'victory'|'defeat'|'escaped'
  //   player {hp,maxHp,shield}, enemy {name,icon,kind,hp,maxHp,atk,attackTimer,barrier,silenced...}
  //   cards [], cast {cardId,typed,errors,startTime,lastKeyTime,forgiven} | null
  //   flow, combo, maxCombo, blindfold, paused, fight (summary counters)
  get interval()                 // enemy.baseInterval * enemy.intervalMult
  get activeCard()
  toleranceFor(card)             // TIERS[card.tier].tolerance + stats.tolerance
  update(now)                    // real time step (dt clamp 0.1 s); no-op unless phase==='fighting' && !paused
  handleChar(ch, now)            // typing input
  cancelCast()
  setPaused(p, now)
  drainEvents()                  // returns and clears queued events
}
```
**Events** (`{ type, ...data }`), consumed by `combatScreen`:
`castStart{cardId}`, `keyCorrect{index, combo, ch}`, `keyError{index, expected, got, errors, tolerance}`,
`noMatch{ch}`, `castComplete{card, result, dealt, toBarrier, resisted, wpm, errors}`, `echo{dealt}`,
`fizzle{card, backfire}` (emit it BEFORE the replacement card's `cardsChanged`, so the UI can play the
fizzle animation), `secondWind{}`, `cardsChanged{}`, `flowFull{cardId}`, `windup{}`, `enemyAttack{}` (animation
only), `playerHurt{damage, absorbed, source:'attack'|'searing'|'backfire'}` (every HP loss goes through
`damagePlayer(amount, source, pierce)`; backfire pierces shields), `burnTick{amount}`, `heal{amount}`,
`mechanic{id, text}`, `barrier{amount}`, `barrierBroken{}`, `phoenix{}`, `victory{}`, `defeat{}`,
`escaped{}`, `cancel{}`.
Also export `tempoMultiplier(recentWpm, tempoPct)` and `paceMultiplier(wpm, paceRef)` from combat.js.
Rules described in §3.4–3.6. Additional details:
- `windup` fires once per attack cycle when `attackTimer >= interval - 1.2`.
- WPM of a cast: `elapsed = max(300, lastKeyTime - startTime)`; `wpm = min(250, ((len-1)/5) / (elapsed/60000))`.
- Latency recorded for a correct key = `now - cast.lastKeyTime` (not for the first key of a cast).
- Mistake records `recordKey(keyStats, expectedChar, false, null)`.
- `damageEnemy(amount, card)` applies armored → barrier → hp, returns `{ dealt, resisted, toBarrier }`.
- `leechPct` heals `round(dealt * leechPct/100)` after damage.
- `tempest` unique: on crit, `attackTimer = max(0, attackTimer - 0.25*interval)`.
- `avalanche`: if `now - lastCastEnd <= 2500` → stacks = min(5, stacks+1) else 0.
- Frost: `attackTimer = max(0, attackTimer - freezePct*interval)`.
- Burn: `enemy.burn = { remaining: 3, dps: (oldRemainingTotal + burnTotal) / 3 }` ; tick every 0.5 s.
- Glimmerkin: `elapsed > fleeAfter` → `phase='escaped'`.
- Dummy: `update` never attacks; damage numbers still computed but hp is not reduced (hp = Infinity display).
- `update(now)` clamps each step to 0.1 s (frame hitches/tab switches must not teleport time). Any script
  that simulates fights must therefore step time in ≤ 50 ms increments.
- `fight` summary: `{ startTime, correct, errors, casts, perfects, perfectHighTier, fizzles, damageDealt,
  damageTaken, wpms: [], bestWpm, ritesCast }` — UI calls `summarizeFight(engine)` helper (in combat.js)
  returning `{ avgWpm, accuracy, maxCombo, duration, ... }`.

### 4.3 Game controller & screens (`ui/game.js`)

```js
export class Game {
  constructor({ root, save, storage })
  // fields: save, stats (computePlayerStats cache), screen, modal, hunt, fx, audio, bg
  showScreen(name, params)   // 'title' | 'camp' | 'combat'; calls old.unmount(), new.mount(root, params)
  refreshStats()             // recompute this.stats after gear/attune/level changes
  persist()                  // writeSave
  onKeyDown(e)               // audio.unlock(); modal → modal.onKey(e); else screen.onKey(e)
  update(dt, now)            // screen.update(dt, now); fx/bg update + draw
  openModal(modalObj) / closeModal()
  toast(text, opts)
  startHunt(zoneIndex) / startBoss(zoneIndex) / startPractice(zoneIndex) / endHunt(reason)
}
```
Screen object interface: `{ mount(root, params), unmount(), update(dt, now), onKey(e) }`.
Modal interface: `{ el, onKey(e), onClose?() }`.

**Input:** `main.js` adds one `keydown` listener on `window` → `game.onKeyDown(e)`.
`charFromEvent(e)` (in `ui/dom.js`): returns `e.key` if `e.key.length === 1` and not `e.metaKey`
and not (`e.ctrlKey && !e.altKey`) [AltGr on Windows = ctrl+alt]; else null. In combat, call
`e.preventDefault()` for every handled key (prevents `/` quick‑find, `'` in Firefox, Space scroll).
Warn once per fight via toast if `e.getModifierState('CapsLock')`.

**Main loop** (`main.js`): `requestAnimationFrame` with `dt = min(0.05, (t - last)/1000)`; pass
`performance.now()` as `now`.

**Layout auto‑detect** on first run (no save): if `navigator.keyboard?.getLayoutMap` exists, check
`map.get('KeyY') === 'z'` → qwertz; else if `navigator.language` starts with `de` → qwertz; else qwerty.

---

## 5. UI & visual specification

### 5.1 Design tokens (`main.css` `:root`)
```
--bg:#0a0c16; --bg-2:#11152a; --panel:rgba(16,20,37,.82); --panel-solid:#151a30;
--border:rgba(255,255,255,.09); --border-strong:rgba(255,255,255,.18);
--text:#ece9f5; --text-dim:#a29fb8; --text-faint:#625f78;
--gold:#f5c66b; --gold-2:#ffe2a1; --hp:#ef4b5f; --hp-2:#ff8a8a; --shield:#8fb4ff;
--ok:#6ee7a8; --danger:#ff5566; --flow-a:#7df9ff; --flow-b:#b07cff;
--r-common:#c9cdd6; --r-uncommon:#4ade80; --r-rare:#60a5fa; --r-epic:#c084fc; --r-legendary:#fb923c;
--font-title:'Cinzel',Georgia,serif; --font-ui:'Inter',system-ui,sans-serif;
--font-mono:'JetBrains Mono',ui-monospace,Consolas,monospace;
--radius:14px; --shadow:0 12px 40px rgba(0,0,0,.5);
```
Body: `background: var(--bg)`, full viewport, `overflow:hidden`, `user-select:none`.
Panels: glassy (`background: var(--panel); backdrop-filter: blur(8px); border:1px solid var(--border)`).
Buttons: `.btn` with gold border glow on hover; hotkey shown in a `<kbd>` chip.
Stacking: `#bg-canvas` z 0 (fixed, full screen) → `#app` z 1 → `#fx-canvas` z 5 (pointer-events none)
→ `#floaters` z 6 → `#modal-root` z 10 → `#toast-root` z 20 (top: 84px; right: 16px — below the camp header).
Also `#tooltip` (z 30, fixed, `hidden` by default) for item tooltips.

### 5.2 Screens

**Title:** Big animated "SPELLSTROKE" (Cinzel, gold gradient text, each letter in a span with a
staggered float + glow animation), subtitle "Every spell is a keystroke.", meadow background.
Hints: `Space` Continue/Begin, `N` New game (only if save exists; confirm modal). Short "How to play"
(3 bullets).

**Camp:** top bar: logo, tabs (`1` Map, `2` Character, `3` Merchant, `4` Grimoire, `5` Settings),
right side: level badge, XP bar, gold, unspent points indicator. Background = selected zone palette.

**Map tab:** left 65 %: world map panel with the 9 zone nodes on a winding path (absolute positions
in %; path drawn with an SVG polyline between node centres; dashed for locked segments). Node =
round medallion with icon, name below, states: locked (grayscale, 🔒), open (pulsing glow),
cleared (gold ring + 👑). Click → select. Right 35 %: zone detail panel: icon, name, blurb,
"Runes" keycaps (chars from `newCharsForZone`, max 16 shown + "+N"), kills progress bar
("4 / 6 — the boss stirs"), buttons: `Enter` Hunt, `B` Boss (disabled until available),
`P` Practice. Arrow keys ←/→ change selected zone among unlocked ones.

**Combat:** (full screen)
```
[top bar: zone • Chain ×N • Satchel g • (boss name banner)          Esc: cancel / pause]
[arena: player 🧙 left  (HP bar + shield overlay)        enemy right (name, HP bar, barrier bar, attack timer bar)]
[spell stack: 3–4 spell cards, one full-width row each (name | incantation | estimate + tolerance pips);
 the card being cast shows the typing progress in place — there is no separate incantation panel (2026-11-09)]
[flow bar + combo counter]
[on-screen keyboard]
```
- Card: school colour border/top gradient, icon + name + tier roman numeral, incantation text
  with the **first character enlarged and glowing** (the trigger key), footer with estimate
  (`⚔ 24` / `✚ 19` / `🛡 22`) and tolerance pips. Active card: lifted + glowing; others dimmed.
  Silenced: greyscale + 🔒 overlay. Rite: animated rainbow border, slides in. Mistakes break the active card's
  tolerance pips. The cast card is replaced as soon as it resolves, so `ghostCard()` lays a fixed-position copy over
  its slot that plays the release (`.ghost.released`) or fizzle (`.ghost.fizzled`) animation.
- Active card letters (`incView` is mounted into the card's `.card-text`): typed = school colour with glow, current = underlined pulsing caret
  (space shown as `␣` in faint colour only when current), pending = dim. Error: the typing line shakes
  (`.shake` class 250 ms), current letter flashes red.
- Enemy sprite: emoji `font-size: clamp(90px, 14vh, 150px)` (boss 1.4×) with idle bob, CSS drop
  shadow; `.hit` (white flash + knockback 160 ms), `.windup` (red pulsing glow + scale 1.08),
  `.attack` (lunge left 300 ms), `.dying` (spin, fade, shrink 700 ms). Elite: coloured aura.
- Player sprite 🧙 (mirrored with `transform: scaleX(-1)` so it faces right), `.casting` glow
  in school colour, `.hurt` red shake.
- Bars animate width with CSS transitions (enemy HP 300 ms), plus a lagging "ghost" bar (white,
  700 ms delay) behind HP bars for satisfying chunk loss.
- Attack timer bar under enemy HP: fills left→right, red when in windup.

**Character tab:** three columns — Equipment (5 slot tiles with labels), Stats + Attunements,
Inventory (6×5 grid, 30 slots). Hover tile → tooltip (name in rarity colour, `Rare Staff · iLvl 3`,
affixes, unique effect in orange italics, sell value, and **compare** lines vs equipped:
green `▲ +3% spell damage` / red `▼`). Click inventory item = equip; Shift+click = sell; click
equipped = unequip. Buttons: "Sell all Common", "Sell all Uncommon". Points: `+` buttons, Reset.

**Merchant tab:** 3 chest cards (icon, name, cost, odds text). Buying opens the chest reveal modal:
chest shakes (800 ms), flash in rarity colour + radial beam, item card flips in, `Enter` to close.
Shows legendary pity counter.

**Grimoire tab:** stat tiles (Best WPM, Avg WPM last 20 casts, Accuracy last 20 fights, Total
keystrokes, Kills, Perfect casts), WPM history line chart on canvas (last 60 fights: WPM line in
cyan, accuracy % line in gold, axes with 4 gridlines, no library), **Rune Mastery keyboard**
(keyboardView in heatmap mode: colour by mastery: locked `#2a2d3d`, untrained `#3b3f57`,
novice→red/orange by accuracy, adept `#4dabf7`, master `#b07cff`, grandmaster gold glow; tooltip
with accuracy, median ms, samples), weakest runes list, achievements grid (locked = dim).

**Settings tab:** Layout (QWERTY US / QWERTZ DE), Keyboard guide (Hints – recommended / Always /
Off), Difficulty (Apprentice / Adept / Archmage; description = the selected preset's perks), Volume slider, Screen shake toggle, Reset progress
(confirm modal requires typing `reset`).

**Lesson modal:** "New runes awaken" title, keycaps of the new chars each with finger colour and
finger name, the on‑screen keyboard highlighting those keys, then the drill lines from
`generateLessonDrill` typed with the same incantation renderer (strict: wrong key doesn't
advance). Finishing → "Lesson complete" + XP 5 → close. `Esc` skips. Shown the first time the player
hunts in a zone (`zoneState.lessonSeen`).

**Victory panel (lootReveal):** "VICTORY" (or "ZONE CLEARED" for a first boss kill), stat row
(WPM, accuracy, max combo, time), XP bar fill animation, gold count‑up, items revealed one per
350 ms with rarity beam + sound, level‑up banner, `Enter` Continue hunt (shows next chain bonus) /
`Esc` Return to camp. For bosses only `Enter` Return to camp. **Defeat panel:** "YOU HAVE FALLEN",
lost gold, `Enter` Return to camp. **Escaped panel** for Glimmerkin.

### 5.3 FX catalogue (`ui/fx/*`)
- `background.js` → `createBackground(canvas)` `{ setPalette(p, ambient), update(dt), draw(), resize() }`:
  vertical sky gradient; 80 twinkling stars on dark palettes (top 60 %); moon disc with radial glow
  at (78 %, 20 %); 3 hill layers each `y = base + Σ_{k=1..3} amp_k * sin(x*freq_k + phase_k + t*speed)`
  (layer base heights 62 %, 72 %, 84 % of height; speeds 4, 9, 16 px/s; seeded per palette);
  ambient particles (60) per type: fireflies (wander, blink), spores (rise slowly, sway), embers
  (rise fast, flicker), snow (fall, drift), bubbles (rise, outline circles), motes (drift),
  sparkles (twinkling crosses), sparks (fast short streaks upward), void (drift toward centre,
  fade). Palette crossfade 600 ms when zone changes. Uses `devicePixelRatio`.
- `particles.js` → `createFx(canvas, appEl)` `{ burst(x,y,opts), sparks(x,y,color,n), projectile(from,to,color,ms,onArrive), ring(x,y,color), shake(intensity, ms), setShakeEnabled(b), update(dt), draw() }`.
  Additive blending (`globalCompositeOperation='lighter'`) for glow. Cap 800 particles.
  Shake translates `#app` via `style.transform`.
- `floaters.js` → `floatText(x, y, text, { color, size=28, crit=false, cls })` and
  `banner(text, { color, sub })` (big centred text that scales in and fades, e.g. "COMBO 50!",
  "ENRAGED!", "PERFECT!", "FLOW STATE").

Juice mapping (combat): correct key → sparks at char (4) + key note; mistake → red sparks + shake
panel + thud; cast start → ring at player; cast complete → projectile from player to enemy
(280 ms; heal/shield → ring at player instead), on arrive: burst (20 + damage‑scaled up to 80
particles), damage floater (crit: bigger, gold, "CRIT!"), enemy `.hit`, screen shake
`min(14, 3 + 20*dealt/maxHp)`; enemy attack → enemy `.attack`, player `.hurt`, red floater, shake 8;
death → `.dying` + big burst + gold sparkle; combo milestones 25/50/100/150/200 banner;
perfect cast banner "PERFECT!" small; flow full banner "FLOW STATE" + rite card slide‑in.

### 5.4 Audio catalogue (`ui/audio.js`)
`createAudio()` → `{ unlock(), setVolume(v), key(combo), error(), castStart(), cast(school), hit(big),
crit(), enemyAttack(), windup(), fizzle(), heal(), shield(), loot(rarityIndex), coin(), levelUp(),
victory(), defeat(), click(), banner() }`. All synthesized with oscillators + a noise buffer through
a master gain. `unlock()` creates/resumes the AudioContext on the first key press.
- `key(combo)`: pentatonic `[0,2,4,7,9]`; `step = combo % 15`; `semis = scale[step%5] + 12*floor(step/5)`;
  `freq = 392 * 2^(semis/12)`; triangle, 70 ms exponential decay, gain 0.07.
- `error`: square 140→70 Hz, 120 ms, gain 0.06. `hit`: sine 160→45 Hz 220 ms + short lowpassed noise.
- `loot(r)`: arpeggio of `2 + r` notes from a major chord, 70 ms apart; legendary adds a shimmer
  (high triangle tremolo 600 ms).

---

## 6. Balance constants (`data/balance.js`)
```js
export const BAL = {
  enemyHpBase: 50, enemyHpGrowth: 1.24, enemyAtkBase: 8, enemyAtkGrowth: 1.16,
  attackSecBase: 7.5, attackSecPerZone: 0.3, minAttackSec: 3.5, windupSec: 1.2,
  xpBase: 15, xpGrowth: 1.35, goldGrowth: 1.4, killsForBoss: 6, maxLevel: 60,
  hpPerLevel: 12, powerPerLevel: 0.05,
  eliteChance: 0.12, eliteChancePerChain: 0.02, glimmerChance: 0.05,
  chainBonusPer: 0.10, chainBonusMax: 1.0, chainHeal: 0.30,
  deathGoldLoss: 0.5, fleeGoldLoss: 0.25,
  flowPerKey: 1.25, flowPerError: 15, flowCritThreshold: 50, flowCritBonus: 0.05,
  errorPenalty: 0.12, minAccMult: 0.25, perfectMult: 1.15,
  shieldCapPct: 0.6, inventorySize: 30, pityLegendary: 150,
  tempoRef: 25, tempoMin: 0.75, tempoMax: 1.5,
};
// + skipAheadLevel: 8, and DIFFICULTIES / DIFFICULTY_IDS / PACE = { min: 0.7, max: 1.4 } as in §3.11
// v1.1 additions to BAL (§11.8, §11.9; huntHeatPer tuned in M22):
//   huntHeatPer: 0.02, huntHeatMax: 0.45,
//   eventChance: 0.2, eventMinChain: 2, mimicTimeFactor: 1.6, mimicMinSec: 4, mimicMaxSec: 20, mimicBitePct: 0.15,
//   shrineAcc: 0.95, shrineHealPct: 0.2, altarFights: 3, altarTempoPct: -20, altarGoldMult: 0.75,
//   traderPricePct: 0.3, traderMinPrice: 20
// v1.1 exports: COMBO_TIERS (§11.3), CHAIN_MILESTONES (§11.6)
// v1.3 export: ROGUE — every Glyphdeep number (§13.2, tuned in §13.12)
```
Sanity target: zone 0 mob (HP ≈ 50) dies to ~3 tier‑II casts at 20 WPM; a boss fight lasts 1–2 min.
Reference results of a naive simulated player (3 % mistakes, tier II for mobs / tier III for bosses, never
uses Ward) at realistic levels — reproduce these with a scratch script after any balance change:

| Fight | Level / gear | WPM | Win rate |
|-------|--------------|-----|----------|
| Meadow mob | L1, none | 15 | 100 % (~40 s) |
| Meadow boss | L3, none | 18 | ~80–100 % |
| Underbog boss | L9, +15 % power | 30 | ~80 % |
| Citadel boss | L13, +30 % | 35 | ~70 % |
| Forge boss | L15, +40 % | 40 | ~60 % |
| Final boss | L18, +50 % | 45 / 70 | ~30 % / ~100 % (it is the skill check) |

**v1.1 re-run (M22)** with the combo tiers on (in brackets: same seeds with every tier multiplier forced to 1):
Meadow mob 100 % (100 %), Meadow boss 88 % (90 %), Underbog 65 % (62 %), Citadel 72 % (68 %), Forge 57 % (50 %),
Final 27 % / 100 % (25 % / 98 %). No row moves by more than 7 points, so `COMBO_TIERS` keeps its values.
**Hunt simulation (M22)**, Underbog, L9 +15 % power, 30 WPM, first boon, camp below 35 % HP, 300 hunts:
heat 0 → median chain 10, 7.7 % deaths · heat 0.03 → chain 6, 28.7 % deaths, chain-8 fight ×1.16 ·
heat 0.025 → chain 7, 26.7 % · **heat 0.02 → chain 7, 19.0 % deaths, chain-8 fight ×1.08** (chosen).

**Longer incantations (2026-11-09).** `TIERS` lengths went up ~1.5× (I 6–20, II 16–34, III 30–58, IV 50–90; the old
ranges live on as `TIERS[t].piece`, one generated phrase, and `textGen` chains phrases until the spell is long enough —
hunt events and lesson drills stay one phrase). Tolerance III 3→4, IV 4→5. Compensation: `BAL.enemyDamageMult` scales
every enemy's attack (campaign and Glyphdeep). Same naive player, 150–200 fights per row:

| Fight | WPM | before | longer, ×1.0 | ×0.9 | ×0.85 | **×0.8 (chosen)** |
|-------|-----|--------|--------------|------|-------|-------------------|
| Meadow mob | 15 | 100 % | 100 % | 100 % | 100 % | 100 % |
| Meadow boss | 18 | 66 % | 28 % | 51 % | 51 % | **79 %** |
| Underbog boss | 30 | 80 % | 73 % | 86 % | 94 % | **95 %** |
| Citadel boss | 35 | 74 % | 72 % | 78 % | 80 % | **81 %** |
| Forge boss | 40 | 72 % | 67 % | 76 % | 80 % | **83 %** |
| Final boss | 45 / 70 | 61 / 100 % | 47 / 100 % | 61 / 100 % | 69 / 100 % | **79 / 100 %** |

Mossback (low integer attack, home-row-only words) is the most sensitive fight and decided the value.

---

## 7. Data content requirements
- `words.js`: `export const WORDS = [...]` ≥ 1000 unique lowercase words (letters and `'` only),
  including at least 25 words that use only `a s d f j k l` (e.g. a, ad, add, adds, ads, all, alas,
  alfalfa, as, ask, asks, dad, dads, fad, fads, fall, falls, flak, flask, flasks, lad, lads, lass,
  sad, salad, salads, sass, ska, skald, skalds), contractions (don't, can't, it's, i'll, we're,
  you're, isn't, won't, that's, let's, they're, i'm), and fantasy words (spell, rune, mage, wand,
  dragon, ember, frost, shield, potion, quest, sword, ...).
- `sentences.js`: `SENTENCES` ≥ 50 capitalised sentences, 15–80 chars; at least 30 use only letters,
  spaces, `,` and `.` (so they work on both layouts before digits are unlocked). `PROPER_NOUNS` list.
- `codeLines.js`: `CODE_LINES` ≥ 70 realistic one‑liners 6–64 chars across JS, Python, SQL, shell,
  HTML; at least 15 per tier length band. Avoid `^` and `` ` `` in at least 80 % (dead keys on DE).
- `numberTemplates.js`: `NUMBER_TEMPLATES = {2:[...≥8], 3:[...≥8], 4:[...≥6]}`, `NUMBER_NOUNS`, `NUMBER_VERBS`.

---

## 8. Testing (`tests/*.test.js`, run with `npm test`)
Use `import { test } from 'node:test'; import assert from 'node:assert/strict';`.
- **rng:** same seed → same sequence; `int(a,b)` within bounds; `weighted` respects zero weights.
- **keyboard:** for both layouts: `allowedChars(l,0)` equals `{a,s,d,f,j,k,l,' '}` plus `;` (qwerty) / `ö` (qwertz);
  zone 6 adds uppercase; `charWeight('A') > charWeight('a')`; dead keys never allowed.
- **themedText:** for both layouts × zone × school × tier: only unlocked chars, well formed; ≥ 85 % themed from
  zone index 2. **combat:** difficulty scales enemies/tolerance, Apprentice fizzles never backfire, pace > 1 when
  faster than `paceRef`. **progression:** `rewardMult` raises xp and gold.
- **textGen:** for both layouts × every zone × every tier × 40 seeds: text non‑empty, every char
  allowed, length ≤ tier max + 12, first char not in `avoidFirst` when 3 chars are avoided
  (zone ≥ 1). Lesson drill non‑empty for every zone.
- **cards:** initial cards have distinct lower‑cased first chars; tiers 1,2,3; at most 1 non‑damage card.
- **mastery:** recordKey caps windows at 40; mastery thresholds; weakChars returns the slowest/least accurate.
- **spellResolve:** speedMultiplier(20)=1, (0)=0.5, (200)=3; perfect > 1 error > 3 errors; nature → heal > 0, damage small; ward → shield > 0.
- **loot:** rollRarity with minRarity never below it; 10 000 rolls produce every rarity and the common share ≈ 60 % (±5 %); generated items have `affixes.length` per rarity (legendary 3 + unique) and distinct affix ids; pity forces legendary.
- **progression:** xpToNext monotonic; addXp levels up and grants points; grantVictory on boss unlocks next zone.
- **combat:** with fake `now`, typing a card's full text perfectly → `castComplete` and enemy hp drops;
  typing wrong chars beyond tolerance → `fizzle`; advancing time by `interval` → `enemyAttack`;
  enough perfect casts → `victory`; HP 0 → `defeat`; flow reaching 100 adds a tier‑4 card.
- **save:** createNewSave → write → load roundtrip with an in‑memory storage stub; deepMerge fills new keys.

---

## 9. Milestones (implement in this order)

**M1 – Scaffold.** `package.json`, `vite.config.js`, `index.html` (fonts, canvases, roots, module
script), empty `main.css` with tokens, `main.js` that renders "Spellstroke" into `#app`.
✅ `npm install && npm run dev` shows the text.

**M2 – Core + keyboard.** `core/rng.js`, `core/util.js`, `data/layouts.js`, `data/zones.js` (full
data), `data/balance.js`, `logic/keyboard.js`. ✅ `tests/rng.test.js`, `tests/keyboard.test.js` pass.

**M3 – Text.** `data/words.js`, `data/sentences.js`, `data/codeLines.js`, `data/numberTemplates.js`, `data/spellLexicon.js`,
`logic/textGen.js`. ✅ `tests/textGen.test.js` passes. Print a sample of 5 incantations per zone/tier
with a scratch script and read them: they must look natural.

**M4 – Spells & stats.** `data/spells.js`, `data/items.js`, `logic/mastery.js`, `logic/stats.js`,
`logic/spellResolve.js`, `logic/cards.js`. ✅ tests pass.

**M5 – Loot & progression & save.** `logic/loot.js`, `logic/progression.js`, `data/achievements.js`,
`logic/achievements.js`, `core/save.js`. ✅ tests pass.

**M6 – Combat engine.** `logic/combat.js` with every rule in §3.4–3.7, §4.2. ✅ `tests/combat.test.js` passes.

**M7 – UI shell.** `ui/dom.js`, `ui/game.js`, `ui/components/modal.js`, `toast.js`, `ui/audio.js`,
`ui/fx/background.js`, `screens/titleScreen.js`, `screens/campScreen.js` with the 5 tabs (stub
content), `main.js` loop + input. ✅ Title → Space → camp with animated background, tabs switch with 1–5.

**M8 – Map + combat screen.** `mapTab.js`, `components/keyboardView.js`, `components/incantation.js`, `screens/combatScreen.js`
(DOM, bars, cards, incantation panel, events → simple visuals), `ui/fx/particles.js`,
`ui/fx/floaters.js`. ✅ You can hunt in the meadow, cast spells, see damage, die or win.

**M9 – Rewards loop.** `components/lootReveal.js` (victory/defeat/escaped), hunt chain + satchel,
boss button/fight, zone unlock, `components/lessonModal.js`. ✅ Beat 6 mobs → boss → next zone + lesson.

**M9b – Difficulty.** `DIFFICULTIES` in balance.js, engine/resolve/grantVictory parameters, `difficultyModal.js`,
title/new‑game/reset flows, Settings row, combat chip. ✅ Fresh start shows the path screen; Archmage + skip
lands in the Sunken Archive at level 8 with the guide off.

**M10 – Meta screens.** `characterTab.js` + `components/itemView.js` (equip/sell/compare,
attunements), `merchantTab.js` (chests + reveal), `grimoireTab.js` (chart, heatmap, achievements),
`settingsTab.js`. ✅ All interactions persist across reload.

**M11 – Juice & polish.** All FX in §5.3, audio in §5.4, combo banners, caps‑lock warning,
pause menu, `visibilitychange` → pause combat, reduced shake setting, responsive down to 1100×650.
✅ Manual QA checklist below.

**M12–M22 – v1.1 session hooks.** Mastery pop-ups, combo tiers, quick-equip, goals, chain milestones, retry,
boons, hunt events. See §11.11 for the order and §11.12 for pitfalls.

### Manual QA checklist
- [ ] Fresh save: title → camp → Meadow lesson appears → drill types correctly → hunt begins.
- [ ] Every card starts with a different glowing letter; typing it locks the card.
- [ ] Wrong key: no advance, red flash, error pip; exceeding tolerance fizzles (tier III hurts you).
- [ ] Notes climb with combo; mistakes reset the melody.
- [ ] Enemy attack timer fills, windup glow, hit shakes screen, shield absorbs.
- [ ] Flow full → Forbidden Rite card appears; casting it resets flow.
- [ ] Victory shows loot with rarity beams; Continue keeps chain and partial HP; Camp banks gold.
- [ ] Death loses half the satchel.
- [ ] 6 kills unlock boss; boss mechanics visible (enrage banner, hex lock, gust reshuffle, barrier bar).
- [ ] Boss win unlocks next zone and new keys appear in text only after unlock.
- [ ] Equip/sell/compare work; stats update; chests open with animation; pity counter increments.
- [ ] Grimoire chart and mastery heatmap update after fights.
- [ ] Switching to QWERTZ changes on‑screen keyboard and generated text (e.g. no `y` until zone 5... z appears in zone 2).
- [ ] Reload keeps all progress.

---

## 10. Pitfalls found while building the reference implementation

Read these before writing UI code — each one was a real bug.

1. **`Element.append()` does not flatten arrays.** `el.append('Type ', [nodeA, nodeB])` renders
   `[object HTMLElement]`. Use the `append(el, children)` / `fill(el, ...children)` helpers from `ui/dom.js`
   whenever a child might be an array (e.g. `list.map(...)`).
2. **Ligatures** — see §2. Disable them or `=>`, `!=`, `<=` become single glyphs.
3. **AltGr on Windows arrives as `ctrlKey && altKey`.** `charFromEvent` must accept that combination, and
   only reject `ctrlKey && !altKey` (real shortcuts) and `metaKey`.
4. **Ignore `e.repeat`** in combat — a held key would otherwise generate a burst of mistakes.
5. **`preventDefault()` every handled key in combat** (Space scrolls, `/` and `'` open Firefox quick‑find).
6. **Blur buttons after mouse clicks** (`document` click listener in `main.js`): the game is
   keyboard‑driven, and a focused button would be re‑clicked by Space/Enter.
7. **Hold the incantation panel ~450 ms after a fizzle** (`fizzleHoldUntil` in combatScreen) — the card
   re‑render would otherwise hide the panel before the fizzle animation is visible.
8. **Damage numbers & HP bars wait for the projectile.** Keep `pendingHits`; only copy `engine.enemy.hp` into the
   displayed HP when no projectile is in flight, and only start the death animation when `pendingHits === 0`.
9. **Stray keys after a fight** — the result panels ignore input for ~450 ms (`guardKeys`) so a player who
   is still typing does not instantly skip the loot reveal.
10. **Fight simulations** must step the engine in ≤ 50 ms increments (see §4.2).
11. **Headless Linux browsers have no emoji font** — that is why Noto Color Emoji is loaded from Google Fonts.
12. **Line‑2 caret in the lesson:** call `view.setProgress(-1)` on inactive drill lines so only the active
    line shows a caret; scroll the active line into view on its first keystroke (small screens).
13. **Themed text and the first-letter rule:** early regions have very few themed words, so sometimes no
    template yields an allowed first letter. The final fallback must still respect `avoidFirst`.
14. **(v1.1) The boon choice did not fit.** With drops, a chain reward, goals and three boon cards the victory panel was
    ~1000 px tall and the boons sat below the fold at 1280×800. When boons are offered the panel is two columns
    (loot left; goals + boons right), stacking below 960 px.
15. **(v1.1) Chips wrapped inside themselves** once heat, boon and curse chips joined the combat top bar. Chips are
    `white-space: nowrap`, the bar wraps as a whole, and the `Esc` hint hides below 1250 px.
16. **(v1.1) Event screens:** a banner with the event name sat on top of the panel's own title (removed), and the
    result pushed the panel off-screen — the keyboard/timer (type events) or the options (choice events) are
    removed when the result shows.
17. **(v1.1) "±1" tests need realistic numbers.** At 30 WPM a 5-letter cantrip deals ~9 damage, where rounding alone
    breaks a ±1 check on ×1.35. Resolve tests use 60 WPM and an 11-character cantrip.

---

## 11. v1.1 — Session hooks update

> Goal: make a single session last longer and feel better, using proven "one more fight" techniques:
> goals you can see are nearly done, choices that build up during a hunt, discrete rewards you can see
> coming, and moments that celebrate real typing improvement. **Design rule:** every hook must reward
> accurate typing. No streak punishments, no real money, no FOMO timers.

Implement **after M11**, in the order of §11.11. All rules in §0 still apply (pure logic in `src/logic`,
randomness through `rng`, numbers in `data/balance.js`, never weaken existing tests). Everything not
specified here: choose the simplest option and keep going. When a milestone is done, fold its save fields
into §4.1, its constants into §6 and its keys into the README controls table.

### 11.0 Option catalogue

All options that were considered. Only the **Planned** rows (now **Done**) are part of v1.1. Backlog rows are ideas for
later. Do not build them now.

| # | Option | Status | Section / milestone |
|---|--------|--------|---------------------|
| 1 | Rune mastery pop-ups | **Done** | §11.2 · M13 |
| 2 | Combo power tiers | **Done** | §11.3 · M14 |
| 3 | Golden runes (1 in ~40 chars glows; typing it gives a guaranteed crit or coins) | Backlog | – |
| 4 | Pace ghost for all difficulties (display only) | Backlog | – |
| 5 | Finisher card below 15 % enemy HP (slow-mo kill) | Backlog | – |
| 6 | Boons: pick 1 of 3 after each hunt win | **Done** | §11.8 · M19–M20 |
| 7 | Chain milestones with named rewards | **Done** | §11.6 · M17 |
| 8 | Hunt events between fights | **Done** | §11.9 · M21 |
| 9 | Nemesis: the enemy that killed you returns with your gold | Backlog | – |
| 10 | "So close" defeat panel + instant retry | **Done** | §11.7 · M18 |
| 11 | Nearest-goals strip | **Done** | §11.5 · M16 |
| 12 | Bounty board (3 rotating contracts) | Backlog | – |
| 13 | Session summary on return to camp | Backlog | – |
| 14 | Speed-kill medals | Backlog | – |
| 15 | Upgrade arrows + quick-equip on loot | **Done** | §11.4 · M15 |
| 16 | Enchanter (reroll/upgrade affixes, salvage dust) | Backlog | – |
| 17 | Spell evolution (cast 50× → evolved spell) | Backlog | – |
| 18 | Tiered achievements | Backlog (v1.1 adds 3 single achievements) | – |
| 19 | Rested XP after time away | Backlog | – |
| 20 | Daily Rite (seeded daily challenge) | Backlog | – |
| – | Carry hunt boons into a boss fight | Backlog | – |
| – | Day-streaks that reset progress, real-money items | **Rejected** | punishes breaks; not for a trainer |

### 11.1 Shared groundwork (M12)

**`src/logic/loot.js`**: add (move `itemScore` out of `characterTab.js`, import it there):
```js
/** Rough desirability used for ▲ upgrade marks. */
export function itemScore(item) {
  if (!item) return 0;
  return item.affixes.reduce((a, x) => a + x.value, 0) * (1 + RARITY_INDEX[item.rarity] * 0.25)
    + (item.unique ? 50 : 0) + item.ilvl * 2;
}
export function isUpgrade(item, equipment) { return itemScore(item) > itemScore(equipment[item.slot]); }
/** Push items into the inventory; overflow (>= BAL.inventorySize) is auto-sold. Mutates save. */
export function stashItems(save, items) // → { kept: Item[], autoSold: Item[], gold: number }
  // for every item: if legendary → save.stats.legendariesFound += 1; then keep or auto-sell exactly as grantVictory does now
```
Refactor `grantVictory` to call `stashItems` (behaviour unchanged; existing tests must still pass).

**`src/logic/progression.js`**: add the hunt factory and use it in `Game.startHunt/startBoss/startPractice`:
```js
export function createHunt(mode, zoneIndex) {
  return { mode, zoneIndex, chain: 0, satchel: 0, hp: null, boons: {}, mods: [], lure: false, lastWasEvent: false };
}
```
`boons` = `{ [boonId]: rank }` (§11.8), `mods` = temporary modifiers `{ id, name, icon, fightsLeft, stats }` (§11.9),
`lure` = next fight is a Glimmerkin (§11.6), `lastWasEvent` = the previous step was an event (§11.9).

**`src/ui/game.js`**: move the equip logic out of `characterTab.equip` so the loot panels can use it too:
```js
equipItem(item) {          // → true if equipped
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
```
`characterTab.equip(item)` becomes `if (game.equipItem(item)) { game.audio.shield(); afterChange(); }`.

**`src/core/save.js`**: add to `stats`: `milestonesReached: 0, boonsTaken: 0, bestBoonCount: 0, eventsCompleted: 0`.
`keyStats[ch]` entries get an optional `peak` field (§11.2). `version` stays 1. `deepMerge` fills the new keys
for old saves.

✅ `tests/loot.test.js`: `itemScore(null) === 0`; `isUpgrade(item, { staff: null, ... })` is true for an
empty slot; `stashItems` on a full inventory returns the item in `autoSold` with `gold === sellValue(item)`.
`tests/save.test.js`: an old save without the new stats keys loads with them at 0.

### 11.2 Rune mastery pop-ups (M13)

Mastery levels currently change silently. Announce every **new personal best** level of a key.

**`src/logic/mastery.js`**:
```js
/**
 * recordKey + personal-best tracking. Returns the new mastery level the first time a key reaches it, else 0.
 * Old saves have no `peak`: initialise it to the current level BEFORE recording, so existing mastery is not
 * re-announced on the first keystroke after the update.
 */
export function recordKeyTracked(keyStats, ch, ok, ms) {
  const prev = keyStats[ch];
  if (prev && prev.peak == null) prev.peak = keyMastery(prev);
  const s = recordKey(keyStats, ch, ok, ms);
  if (s.peak == null) s.peak = 0;
  if (!ok) return 0;
  const lvl = keyMastery(s);
  if (lvl > s.peak) { s.peak = lvl; return lvl; }
  return 0;
}
```
**`src/logic/combat.js`** `onCorrect`: replace `recordKey(...)` with `const up = recordKeyTracked(...)`; after
emitting `keyCorrect`, `if (up && ch !== ' ') this.emit('masteryUp', { ch, level: up })`. `onError` keeps `recordKey`.
**`lessonModal.js`**: use `recordKeyTracked` too and announce level-ups the same way.

**New `src/ui/components/masteryToast.js`**:
```js
export function announceMastery(game, { ch, level, keyboard = null })
// toast title `Rune ${ch} → ${MASTERY_NAMES[level]}` (space shown as ␣), icon '✦',
// sub `+${masteryBonus(level)*100}% power whenever you type it`, color MASTERY_COLORS[level], life 3600;
// game.audio.loot(level + 1); keyboard?.celebrate(charInfo(game.layoutId, ch).code, MASTERY_COLORS[level]).
// Queue: if called again within 700 ms of the previous announcement, delay it so it starts 700 ms after the
// previous one (module-level `nextAt` timestamp + setTimeout).
```
Do **not** use `banner()`: it removes other small banners (PERFECT, combo tiers).

**`keyboardView.js`**: add `celebrate(code, color)` → `k.style.setProperty('--celebrate', color); pulseClass(k, 'celebrate', 1400)`.
**`combatScreen.js`** `handleEvent`: `case 'masteryUp': announceMastery(game, { ch: ev.ch, level: ev.level, keyboard }); break;`
**CSS:**
```css
.key.celebrate { animation: keyCelebrate 1.4s ease-out; z-index: 2; }
@keyframes keyCelebrate {
  0%   { box-shadow: 0 0 0 0 var(--celebrate); transform: scale(1); }
  25%  { box-shadow: 0 0 26px 6px var(--celebrate); transform: scale(1.18); background: var(--celebrate); color: #111; }
  100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); }
}
```
**Achievement** (append to `ACHIEVEMENTS`): `grandRune` 🌟 *Grandmaster Rune* — "Raise any rune to Grandmaster."
`check: (s) => Object.values(s.keyStats).some((st) => st.peak === 3)`.

✅ `tests/mastery.test.js`: 19 correct presses at 200 ms return 0, the 20th returns 1, the 21st returns 0; a stat at
level 1 without `peak` returns 0 on the next correct press and ends with `peak === 1`; a miss returns 0.
`tests/combat.test.js`: pre-fill `keyStats[card.text[1]]` (pick a card whose `text[1] !== ' '`) with 19 correct presses
at 200 ms and `peak: 0`, type the card → events contain `masteryUp` with `ch === card.text[1]` and `level === 1`.

### 11.3 Combo power tiers (M14)

At the moment the combo only drives the melody and Flow. Give it power so keeping it alive matters.

**`src/data/balance.js`**:
```js
export const COMBO_TIERS = [
  { at: 0,   name: '',             mult: 1.00, color: '' },
  { at: 25,  name: 'Kindled',      mult: 1.05, color: '#ffd27a' },
  { at: 50,  name: 'Blazing',      mult: 1.10, color: '#ff9f43' },
  { at: 100, name: 'Radiant',      mult: 1.15, color: '#7df9ff' },
  { at: 200, name: 'Transcendent', mult: 1.20, color: '#d9b3ff' },
];
```
**`src/logic/combat.js`**: `export function comboTier(combo)` → `{ index, ...COMBO_TIERS[index] }` for the last tier with
`at <= combo`. In `completeCast`, pass `comboMult: comboTier(this.combo).mult` to `resolveSpell` (the combo already
includes this cast's keys). Add `combo: this.combo` to the `keyError` event payload (after the reset).
**`src/logic/spellResolve.js`**: new param `comboMult = 1`; `base *= comboMult` (so it scales damage, heal and shield);
return `comboMult` in the result. `estimateCard` stays at combo 0.

**`combatScreen.js`**:
- New state `comboTierShown = 0` (reset in `mount`).
- `updateCombo(combo, up)`: set the number; set the `<small>` text to `tier.name || 'combo'`; set `el.dataset.tier` and
  `els.screen.dataset.comboTier = index`; `els.screen.style.setProperty('--combo-color', tier.color || 'transparent')`.
  If `index > comboTierShown` → `banner(tier.name.toUpperCase(), { color: tier.color, sub: `${tier.at} combo · +${pct}% spell power`, size: 'small', duration: 1200 })` + `audio.banner()`.
  If `index < comboTierShown` → `floatText` at the combo element: `"<old tier name> lost"`, colour `#9aa0b8`, size 16,
  `cls: 'small'` + `audio.soft()`. Then `comboTierShown = index`.
- `COMBO_MILESTONES` becomes `[150, 300, 500]` (the tier banners replace 25/50/100/200). Instead of resetting
  `reachedMilestones` at combo 0, delete every milestone `> combo` (needed once Momentum, §11.8, halves combos).
- `keyError` handler: `updateCombo(ev.combo ?? 0, false)`.
- Cast floater: append `` · ${tierName} +${pct}%`` when `result.comboMult > 1`.
- `audio.key(combo, tierIndex)`: tier ≥ 2 adds `tone({ freq: f * 1.5, type: 'triangle', dur: 0.09, gain: 0.022 })`;
  tier ≥ 4 also adds `tone({ freq: f * 3, type: 'sine', dur: 0.05, gain: 0.012 })`.

**CSS:** `.combo` text colour `var(--combo-color, var(--gold-2))` when `data-tier` ≠ 0;
`.combat:not([data-combo-tier="0"]) .arena { box-shadow: inset 0 0 140px -40px var(--combo-color); transition: box-shadow .6s; }`;
`.combat[data-combo-tier="4"] .flow-bar { box-shadow: 0 0 18px var(--combo-color); }`.

✅ `tests/combat.test.js`: `comboTier(24).index === 0`, `(25) === 1`, `(199) === 3`, `(999) === 4`; set `engine.combo = 24`,
type a tier-I card perfectly → `castComplete.result.comboMult === 1.05`. `tests/spellResolve.test.js`: with a no-crit
rng, `comboMult: 1.1` gives `damage ≈ 1.1 ×` the `comboMult: 1` damage (±1).

### 11.4 Upgrade arrows + quick-equip (M15)

**`itemView.js`** `lootCard(item, delayMs = 0, { compare, upgrade = false, tag = '' } = {})`: class `upgrade` + child
`h('div', { class: 'lc-up' }, '▲ Upgrade')` when `upgrade`; `tag` renders `h('div', { class: 'lc-tag' }, tag)` (used by §11.6);
the tooltip passes `{ compare }` to `itemTooltipContent` when `compare !== undefined`. Export
`markEquipped(cardEl)` → adds class `equipped`, sets `.lc-up` text to `✓ Equipped` (create it if missing).

**Victory panel** (`createVictoryPanel`): build loot cards with
`{ compare: eq[it.slot] || null, upgrade: isUpgrade(it, eq) }`. Quick-equip:
- `pendingUpgrades()` = new items (drops + milestone items) that are still in `save.inventory` and `isUpgrade`,
  sorted by `itemScore(item) - itemScore(equipped)` descending.
- A hint line `.quick-equip`: `kbd('E')` + `Equip <name>` for the first pending upgrade; hidden when none.
- `E` (handled in `createModal({ onKey })`, return `true`) and a click on an upgrade card → `game.equipItem(item)`,
  `markEquipped(card)`, `audio.shield()`, toast `Equipped <name>` (icon = slot icon, colour = rarity colour), then
  re-evaluate the `upgrade` class of the other cards and re-render the hint.
**Chest reveal**: same flag on its loot card, and `E` equips it if it is an upgrade.

**CSS:** `.loot-card.upgrade` gets a green inner glow; `.lc-up` is a green (`var(--ok)`) 11px uppercase label;
`.loot-card.equipped` gets a `var(--ok)` border and a 0.3 s `bump` animation; `.quick-equip` is centred, 13px.

✅ Manual: a victory with an upgrade shows ▲; `E` equips it, the card says ✓ Equipped, the Character tab shows it equipped.

### 11.5 Nearest-goals strip (M16)

Always show the 2–3 things the player is closest to completing.

**`src/logic/mastery.js`**:
```js
/** Progress toward the next mastery level, or null at Grandmaster. */
export function masteryProgress(stat) // → { level, next, progress, need: { kind: 'presses'|'accuracy'|'speed', value } }
// t = THRESHOLDS[level + 1]; { n, acc, medianMs } = keySummary(stat)
// pN = min(1, n / t.n); pAcc = acc >= t.acc ? 1 : max(0, 1 - (t.acc - acc) / 0.2)
// pMs = medianMs == null ? 0 : medianMs <= t.ms ? 1 : t.ms / medianMs
// progress = min(pN, pAcc, pMs)
// need: n < t.n → presses, value t.n - n; else acc < t.acc → accuracy, value round(t.acc*100); else speed, value t.ms
```
**`src/data/achievements.js`**: add an optional `progress: (s) => [current, target]` to `combo50` (`bestCombo`, 50),
`combo150` (150), `wpm60` (`bestWpm`, 60), `wpm100` (100), `chain10` (`bestChain`, 10), `boss5` (bosses defeated, 5)
and to the new achievements of §11.8/§11.9.

**New `src/logic/goals.js`**:
```js
export function nearestGoals(save, { layoutId, zoneIndex, max = 3 }) // → [{ id, icon, text, progress }] (progress 0..1)
```
Candidates (`score` = `progress` unless stated otherwise). Sort by score descending (ties keep this order), return the first `max`:
1. `boss` (only if the zone boss is not defeated): `bossAvailable` → `{ icon: boss.icon, text: `${boss.name} has awakened — press B on the map`, progress: 1, score: 2 }`;
   else `{ icon: '👑', text: `Boss awakens in ${n} more ${n === 1 ? 'kill' : 'kills'}`, progress: kills / BAL.killsForBoss }`.
2. `level` (below max level): `{ icon: '⭐', text: `Level ${L + 1} in ${formatNumber(need - xp)} XP`, progress: xp / need }`.
3. `rune`: among `allowedChars(layoutId, save.unlockedZone)` without space, keys with `n >= 5` and a non-null
   `masteryProgress` with `progress < 1`; take the highest progress →
   `{ icon: '✦', text: `Rune ${ch} → ${MASTERY_NAMES[next]}: ${needText}` }` with needText `N more presses` /
   `raise accuracy to N%` / `type it in under N ms`.
4. `achievement`: not unlocked, has `progress`, ratio `cur / target` ≥ 0.4 (clamp to 0.999); highest ratio →
   `{ icon: a.icon, text: `${a.name}: ${cur} / ${target}` }`.
5. `pity`: `itemsSinceLegendary >= 75` → `{ icon: '🌟', text: `Legendary guaranteed within ${BAL.pityLegendary - n} items` }`.
6. `chest`: the first chest in `CHESTS` order with `chestCost > gold` and `gold >= 0.5 × cost` →
   `{ icon, text: `${name} in ${cost - gold} gold`, progress: gold / cost }` (banked gold only).

**New `src/ui/components/goalsStrip.js`**: `goalsStrip(goals, { title = 'Within reach' })` → `null` if empty, else
`.goals` with a section label and one `.goal` row per goal: icon, text, `.g-bar` (6px track, gold fill at `progress`).
Show it:
- Victory panel, under the XP bar: `max: 3`; drop the `boss` goal when `rewards.bossReady` (the box already says it).
- Map tab zone panel, after the boss preview: `max: 2`, without `boss` goals.
- Defeat panel (§11.7): `max: 2`.

**CSS:** `.goal { display: grid; grid-template-columns: 22px 1fr 90px; gap: 8px; align-items: center; font-size: 13px; }`.

✅ New `tests/goals.test.js`: meadow with 4 kills → a goal containing `2 more kills`; xp = need − 3 → first goal is
`level` and contains `3 XP`; `keyStats.f` with 18 correct presses at 200 ms → a `rune` goal with `f` and `2 more presses`;
never more than `max`; every progress in [0, 1]; ids unique; unlocked achievements never listed.

### 11.6 Chain milestones (M17)

The chain bonus ("+10 % loot per win") is abstract. Add discrete rewards the player can see coming.
Keep the existing percentage bonus as well.

**`src/data/balance.js`**:
```js
export const CHAIN_MILESTONES = [
  { chain: 3,  id: 'cache',  icon: '🧰', name: "Hunter's Cache", chest: 'weathered', desc: 'A free Weathered Chest' },
  { chain: 5,  id: 'gilded', icon: '🎁', name: 'Gilded Cache',   chest: 'gilded',    desc: 'A free Gilded Chest' },
  { chain: 7,  id: 'lure',   icon: '✨', name: 'Glimmer Lure',   lure: true,         desc: 'Your next foe is a Glimmerkin' },
  { chain: 10, id: 'vault',  icon: '💎', name: 'Treasure Vault', chest: 'astral',    desc: 'A free Astral Coffer' },
];
// After chain 10 every 5th win repeats a reward: multiples of 10 → vault, other multiples of 5 → gilded.
```
**`src/logic/progression.js`**:
```js
export function chainMilestone(chain)          // fixed entry, else (chain > 10 && chain % 5 === 0) → { ...vault|gilded, chain }, else null
export function nextChainMilestone(chain)      // first chainMilestone(c) for c = chain+1 … chain+5, else null
export function prevChainMilestoneAt(chain)    // largest c <= chain with a milestone, else 0 (for the progress pips)
export function grantChainMilestone(save, { milestone, zoneIndex, stats, rng })
  // save.stats.milestonesReached += 1
  // lure → { items: [], autoSold: [], gold: 0, lure: true }
  // chest → item = openChest({ rng, chestId: milestone.chest, highestZone: zoneIndex, magicFind: stats.magicFind, pity: save.stats })
  //         return { ...stashItems(save, [item]) renamed kept→items, lure: false }
spawnEnemy({ rng, zoneIndex, chain = 0, forceGlimmer = false })  // forceGlimmer → Glimmerkin, no rng calls
```
**`Game.applyVictory`**: after `hunt.chain += 1`, in hunt mode only: `ms = chainMilestone(hunt.chain)`; if set, grant it
(with the fight stats, §11.8), add `got.gold` (auto-sold value) to the satchel, set `hunt.lure = true` for a lure, and
return `milestone: { def: ms, ...got }` plus `nextMilestone: nextChainMilestone(hunt.chain)` in the rewards.
**`Game.nextFight`**: `spawnEnemy({ ..., forceGlimmer: this.hunt.lure })`, then `this.hunt.lure = false`.

**Victory panel**:
- If `rewards.milestone`: a `.milestone-box` (`${icon} Chain ${chain} — ${name}` + desc) and on open
  `banner(`CHAIN ${chain}`, { sub: `${icon} ${name}`, color: '#ffb35c', size: 'small' })`. Milestone items are added
  after the regular drops in the loot row with `tag: 'Chain reward'` and revealed in the same sequence.
- Hunt mode with a next milestone: `.next-milestone` row. Pips run from `prevChainMilestoneAt(chainAfter)` to
  `next.chain` (filled = wins already made). Text: `Next: ${icon} ${name} at chain ${next.chain} — ${n} more ${n === 1 ? 'win' : 'wins'}`.
**Combat top bar** chain chip: append `` · ${next.icon} in ${n}``.

✅ `tests/progression.test.js`: `chainMilestone` for 1…30 returns entries exactly at 3, 5, 7, 10, 15, 20, 25, 30 (20 and
30 are `vault`); `nextChainMilestone(0).chain === 3`, `(7).chain === 10`, `(10).chain === 15`; granting `gilded` adds one
item of rarity ≥ uncommon and increments `milestonesReached`; on a full inventory it is auto-sold with gold > 0;
`lure` returns no items; `spawnEnemy({ forceGlimmer: true }).kind === 'glimmerkin'`.

### 11.7 "So close" defeat panel + retry (M18)

`createDefeatPanel(game, { summary, lost, enemy: { name, hpPct }, mode, nextMilestone, chain, onRetry, onCamp })`:
- Under the stat row: `pct = max(1, round(hpPct × 100))`. If `hpPct <= 0.25` → `.so-close.hot` "So close! {name} had
  only {pct}% health left." (gold, 18px); else `.so-close` "{name} had {pct}% health left."
- Hunt mode with `nextMilestone` at most 2 wins away: "You were {n} win(s) from {icon} {name}."
- The existing lost-gold line, then `defeatTip(summary)` instead of the fixed tip:
  `fizzles >= 2` → "Fizzles cost twice: lost damage and backfire. Take a Cantrip when a big spell feels shaky.";
  `accuracy < 0.92` → "Accuracy beats speed — each mistake costs 12% of a spell's power. Ease off a little.";
  else → "Ward and Nature spells buy time. Cast one when the enemy winds up."
- `goalsStrip(nearestGoals(...), max 2)`.
- Actions: **Enter** = `mode === 'boss' ? `Rematch ${name}` : 'Hunt again'` (primary) · **Esc** = Return to camp.

**`combatScreen.showResult('defeat')`**: `enemy.hpPct = engine.enemy.hp / engine.enemy.maxHp` (read the engine, not the
lagging display). `onRetry`: close the panel, `game.endHunt('defeat', { toCamp: false })`, then
`mode === 'boss' ? game.startBoss(zoneIndex) : game.startHunt(zoneIndex)`.
**`Game.endHunt(outcome, { toCamp = true } = {})`**: skip `showScreen('camp')` when `toCamp` is false. Banking, the gold
toast and achievement checks still happen.

✅ Manual: losing a boss at low HP shows "So close!"; Enter starts the rematch immediately with full HP and the satchel
loss toast; Esc goes to camp.

### 11.8 Boons + hunt heat (M19 logic, M20 UI)

After every **hunt** victory (not boss, not practice), offer 3 boons. Picking one continues the hunt. Boons stack
(ranks) and last until the hunt ends (camp, flee or death), so continuing is how a build gets stronger. **Hunt heat**
makes each successive fight in a hunt a little tougher, so long chains stay a risk.

**New `src/data/boons.js`**: every boon is a set of **per-rank additive stat changes**, so the engine needs no
per-boon code. `text(rank)` describes the boon at that rank.
```js
export const BOONS = [ { id, icon, name, max, weight, text: (r) => string, stats: { statKey: perRankValue } }, ... ];
export const BOON_BY_ID = Object.fromEntries(BOONS.map((b) => [b.id, b]));
```
| id | icon | name | max | weight | text(r) | stats (per rank) |
|----|------|------|-----|--------|---------|------------------|
| kindling | 🔥 | Kindling | 3 | 10 | Fire spells burn for +{50r}% more | `burnBonus: 0.5` |
| rime | ❄️ | Rime | 3 | 10 | Frost spells push the attack back an extra {10r}% | `freezeBonus: 0.10` |
| charge | ⚡ | Static Charge | 3 | 10 | Storm spells gain +{10r}% critical chance | `stormCrit: 0.10` |
| arcana | ✨ | Deep Arcana | 3 | 10 | Arcane spells deal +{20r}% damage | `'schoolPct.arcane': 20` |
| steady | 🪶 | Steady Hand | 2 | 9 | +{r} mistake(s) allowed in every spell | `tolerance: 1` |
| swift | 💨 | Swift Quill | 3 | 10 | +{20r}% speed bonus | `swiftness: 20` |
| bloodink | 🩸 | Blood Ink | 3 | 9 | Heal {4r}% of damage dealt | `leechPct: 4` |
| bulwark | 🛡️ | Bulwark | 3 | 9 | Ward shields are {30r}% stronger | `shieldMult: 0.3` |
| bloom | 🌿 | Wild Bloom | 3 | 9 | Nature heals {30r}% more | `healMult: 0.3` |
| heart | ❤️ | Second Heart | 3 | 9 | +{15r}% maximum health | `maxHpPct: 15` |
| keen | 🎯 | Keen Eye | 3 | 10 | +{5r}% critical chance | `critChance: 0.05` |
| ruin | 💥 | Ruin | 3 | 10 | Critical hits deal +{25r}% damage | `critMult: 0.25` |
| wellspring | 🌊 | Wellspring | 3 | 9 | +{25r}% Flow gain | `flowGainMult: 0.25` |
| patience | ⏳ | Patience | 3 | 9 | Enemies attack {8r}% slower | `tempoPct: 8` |
| greed | 💰 | Greed | 3 | 6 | +{20r}% gold found | `goldMult: 0.2` |
| luckystar | 🍀 | Lucky Star | 3 | 6 | +{25r} item rarity | `magicFind: 25` |
| cantor | 🎵 | Cantor | 3 | 9 | Cantrips deal +{35r}% damage | `cantripPct: 35` |
| echoing | 🔁 | Echoing Voice | 3 | 8 | {8r}% chance a damage spell is cast twice | `echoChance: 0.08` |
| grace | 🕊️ | Grace | 1 | 7 | The first mistake in each spell is forgiven | `grace: 1` |
| momentum | 🌀 | Momentum | 1 | 7 | Mistakes halve your combo instead of breaking it | `momentum: 1` |
| riteborn | 📜 | Riteborn | 2 | 8 | Start every fight with {30r}% Flow | `startFlow: 30` |
| dawnward | 🌅 | Dawn Ward | 3 | 8 | Start every fight with a shield of {10r}% max health | `startShieldPct: 0.10` |
| executioner | 🪓 | Executioner | 3 | 8 | +{25r}% damage to foes below 30% health | `executePct: 0.25` |

**`src/logic/stats.js`** `computePlayerStats`: also return `burnBonus: 0, freezeBonus: 0, stormCrit: 0, cantripPct: 0,
echoChance: 0, maxHpPct: 0, startFlow: 0, startShieldPct: 0, executePct: 0, grace: 0, momentum: 0, boons: {}`.

**New `src/logic/boons.js`**:
```js
export function rollBoonOffer(rng, owned = {}, count = 3)
  // pool = BOONS with (owned[id] || 0) < max; repeat count times: rng.weighted(pool, b => b.weight * (owned[b.id] ? 1.5 : 1)),
  // remove it from the pool, push { id, rank: (owned[id] || 0) + 1 }. Returns fewer (or []) if the pool runs out.
export function boonText(id, rank)        // BOON_BY_ID[id].text(rank)
export function takeBoon(hunt, id)        // hunt.boons[id] = min(max, (hunt.boons[id] || 0) + 1)
export function boonCount(hunt)           // sum of ranks
export function applyHuntMods(stats, hunt) // → NEW stats object (never mutate `stats`):
  // out = { ...stats, schoolPct: { ...stats.schoolPct }, uniques: new Set(stats.uniques), boons: {} }
  // for each owned boon: out.boons[id] = rank; for each [key, v] of def.stats: add(key, v * rank)
  // for each hunt.mods entry: for each [key, v] of mod.stats: add(key, v)
  // add('schoolPct.x', v) adds into out.schoolPct.x; other keys: out[key] = (out[key] || 0) + v
  // finally: if (out.maxHpPct) out.maxHp = round(stats.maxHp * (1 + out.maxHpPct / 100)); out.critChance = min(0.75, out.critChance)
```

**`src/logic/spellResolve.js`** (each guard keeps the old RNG consumption when the stat is 0, so seeded tests stay stable):
- `if (card.tier === 1 && stats.cantripPct) base *= 1 + stats.cantripPct / 100`
- crit chance `+ (school.id === 'storm' ? stats.stormCrit || 0 : 0)`
- `burnTotal = school.burnPct ? round(damage * school.burnPct * (1 + (stats.burnBonus || 0))) : 0`
- `freezePct = school.freezePct ? school.freezePct + (stats.freezeBonus || 0) : 0`
- `echoCh = (uniques.has('echo') ? 0.15 : 0) + (stats.echoChance || 0); echo = kind === 'damage' && echoCh > 0 && rng.chance(echoCh)`

**`src/logic/combat.js`**:
- Constructor option `heat = 0`: enemy `hp`/`maxHp` × `(1 + heat)` (multiply together with `difficulty.enemyHp`), `atk` × `(1 + heat)`.
- After the player is created: `if (stats.startFlow) this.flow = min(99, stats.startFlow)`;
  `if (stats.startShieldPct) player.shield = min(round(maxHp * BAL.shieldCapPct), round(maxHp * stats.startShieldPct))`.
- `onError`, first thing: `if (this.stats.grace && !c.graced) { c.graced = true; this.fight.errors += 1; recordKey(this.keyStats, expected, false, null); this.emit('grace', { index: c.typed, expected, got: ch }); return; }`
  (stability, combo, flow and searing are untouched; the error still counts toward accuracy stats).
- Combo reset: `this.combo = this.stats.momentum ? Math.floor(this.combo / 2) : 0`.
- `completeCast`, before `damageEnemy`: `if (this.stats.executePct && result.kind === 'damage' && e.hp / e.maxHp < 0.3) { result.damage = round(result.damage * (1 + this.stats.executePct)); result.executed = true; }`.

**`src/data/balance.js`**: `huntHeatPer: 0.03, huntHeatMax: 0.45` in `BAL` (M22 lowered `huntHeatPer` to 0.02, see §6).
**`src/logic/progression.js`**: `export function huntHeat(chain) { return Math.min(BAL.huntHeatMax, chain * BAL.huntHeatPer); }`.

**`src/ui/game.js`**:
- `get fightStats()` → `this.hunt && this.hunt.mode === 'hunt' ? applyHuntMods(this.stats, this.hunt) : this.stats`.
- `applyVictory`: pass `this.fightStats` to `grantVictory` and `grantChainMilestone`; in hunt mode add
  `boonOffer: rollBoonOffer(this.rng, this.hunt.boons, 3)` to the result.
- `continueHunt(hpLeft, boonId = null)`:
  ```js
  const before = this.fightStats.maxHp;
  if (boonId) {
    takeBoon(this.hunt, boonId);
    this.save.stats.boonsTaken += 1;
    this.save.stats.bestBoonCount = Math.max(this.save.stats.bestBoonCount, boonCount(this.hunt));
  }
  const fs = this.fightStats;
  const hp = hpLeft + Math.max(0, fs.maxHp - before);          // Second Heart heals the HP it adds
  this.hunt.hp = Math.min(fs.maxHp, hp + BAL.chainHeal * fs.maxHp);
  // M21 inserts tickMods + the event roll here
  this.nextFight();
  ```
- `nextFight`: add `heat: huntHeat(this.hunt.chain)` to the combat params. Boss and practice use heat 0.

**`combatScreen.js`**: in `mount` read `const fstats = game.fightStats` once and use it everywhere `game.stats` is used
today: engine `stats`, `tempoMultiplier(s.recentWpm, fstats.tempoPct)`, card estimates (`estimateCard(c, engine.stats, ...)`).
Pass `heat: p.heat || 0` to the engine. `grace` event → `floatText` "Grace" (colour `#e9e0ff`) above the incantation, plus
`audio.soft()` (no shake, no error sound). The executed cast floater adds "EXECUTE".
Top bar: `🌡️ Heat +N%` chip when heat > 0 (title "Foes grow stronger the longer you hunt"), and a `✦ N` boons chip whose
title lists every boon as `Name (rank) — text`.

**Victory panel (M20)**: when `rewards.boonOffer.length`:
- Section `.boon-pick`: label "Choose a boon — it lasts until you return to camp", then `.boon-row` with one `.boon-card`
  per offer: `kbd(1..3)`, icon, name, rank tag (`NEW` for rank 1, else `II → III` style), `boonText(id, rank)`.
  `selected` index (default 0) gets `.selected`; a card with rank > 1 gets `.upgrade` (gold border).
- Keys (in `createModal({ onKey })`): `1`–`3` → `onContinue(offer[i].id)`; `←/→` change `selected`. The Enter action
  "Continue the hunt" calls `onContinue(offer[selected].id)`. A click on a card picks it and continues.
- Hint line under the row: "1–3 pick & continue · ←/→ select · Enter takes the highlighted boon".
- `.boon-owned`: "Your boons: 🔥² 🛡️ 🕊️" (superscript rank when > 1).
- `onContinue(boonId)` → in `combatScreen`: `game.continueHunt(engine.player.hp, boonId)`. Escaped panel: `continueHunt(hp, null)`.
- Defeat panel: "Your boons fade: …" when the hunt had boons.

**Achievement:** `architect` ✦ *Architect* — "Hold 6 boon ranks in a single hunt."
`check: s.stats.bestBoonCount >= 6`, `progress: [bestBoonCount, 6]`.

**CSS:** `.boon-row` = 3 equal columns, gap 12px; `.boon-card` = panel, 12px padding, 2px border `var(--border)`,
icon 30px; `.selected` → `var(--gold)` border, lifted 3px, glow; `.upgrade` tag in gold; responsive down to 1100×650
(the modal already scrolls: `.modal { max-height: 92vh; overflow-y: auto }`).

✅ New `tests/boons.test.js`: offers have distinct ids, length 3, are deterministic per seed, never include a maxed boon
(`grace: 1` owned → never `grace`), and are `[]` when everything is maxed; `applyHuntMods` does not mutate its input
(`schoolPct`, `tolerance`, `uniques` unchanged); `steady` rank 2 → tolerance + 2; `heart` rank 2 → `maxHp === round(base × 1.3)`;
a mod `{ stats: { tempoPct: -20, goldMult: 0.75 } }` is applied; **every stat key used in `BOONS` exists in the output of
`computePlayerStats` (or is `schoolPct.<school>`)** — catches typos; every `text(1)` is a non-empty string.
`tests/combat.test.js`: grace → first wrong key leaves `cast.errors === 0` and the combo unchanged and emits `grace`, the
second wrong key sets errors to 1; momentum → combo 40 becomes 20; `startFlow: 30` → `engine.flow === 30`;
`startShieldPct: 0.1` → shield = round(maxHp × 0.1); `heat: 0.3` → enemy maxHp = round(heat-0 maxHp × 1.3) (±1);
executePct with the enemy at 20 % HP deals more than the same seed without it.
`tests/spellResolve.test.js`: `cantripPct: 35` on a tier-I card → ×1.35 (±1); `burnBonus: 0.5` on fire → burnTotal ×1.5 (±1).

### 11.9 Hunt events (M21)

Sometimes the next step of a hunt is an event instead of a fight. Each event is a short typing challenge or a choice.

**New `src/data/events.js`**:
```js
export const HUNT_EVENTS = [
  { id: 'wayshrine', icon: '⛩️', name: 'Wayshrine',        weight: 10, kind: 'type',   intro: 'A mossy shrine hums with old magic. Recite its prayer without faltering and it may bless you.' },
  { id: 'mimic',     icon: '🧰', name: 'Restless Chest',   weight: 8,  kind: 'type',   intro: 'The chest has teeth. Type the binding phrase before it bites — the timer starts with your first key.' },
  { id: 'spring',    icon: '💧', name: 'Moonlit Spring',   weight: 7,  kind: 'type',   intro: 'Still water, silver light. Speak the calming words and be restored.' },
  { id: 'runedoor',  icon: '🚪', name: 'Rune-Sealed Door', weight: 6,  kind: 'type',   intro: 'One mistake and the runes seal forever. Behind it: treasure.' },
  { id: 'altar',     icon: '🗿', name: 'Cursed Altar',     weight: 7,  kind: 'choice', intro: 'Blood-red runes promise riches — for a price.' },
  { id: 'trader',    icon: '🧝', name: 'Wandering Trader', weight: 6,  kind: 'choice', minSatchel: 40, intro: 'A hooded figure opens a coat full of glowing charms. "Gold for power, friend?"' },
];
export const EVENT_TEXT = { wayshrine: { tier: 3, school: 'arcane' }, mimic: { tier: 2, school: 'ward' }, spring: { tier: 2, school: 'nature' }, runedoor: { tier: 2, school: 'arcane' } };
```
**`BAL`** additions: `eventChance: 0.2, eventMinChain: 2, mimicTimeFactor: 1.6, mimicMinSec: 4, mimicMaxSec: 20,
mimicBitePct: 0.15, shrineAcc: 0.95, shrineHealPct: 0.2, altarFights: 3, altarTempoPct: -20, altarGoldMult: 0.75,
traderPricePct: 0.3, traderMinPrice: 20`.

**New `src/logic/events.js`**:
```js
export function rollHuntEvent(rng, hunt)
  // null if !hunt || mode !== 'hunt' || chain < BAL.eventMinChain || hunt.lure || hunt.lastWasEvent || !rng.chance(BAL.eventChance)
  // else rng.weighted(HUNT_EVENTS filtered by minSatchel <= hunt.satchel, e => e.weight)
export function eventText(eventId, { layoutId, zoneIndex, rng, weakChars = [] })
  // generateIncantation({ layoutId, zoneIndex, tier, rng, weakChars, avoidFirst: [], school }) from EVENT_TEXT
export function mimicTimeLimit(textLen, avgWpm) // clamp(textLen / (max(5, avgWpm) * 5 / 60) * mimicTimeFactor, mimicMinSec, mimicMaxSec)
export function traderPrice(satchel)             // max(traderMinPrice, round(satchel * traderPricePct))
export function altarMod()                       // { id: 'altar', name: 'Altar Curse', icon: '🗿', fightsLeft: BAL.altarFights, stats: { tempoPct: BAL.altarTempoPct, goldMult: BAL.altarGoldMult } }
export function tickMods(hunt)                   // decrement every mod's fightsLeft, drop those at 0
```
**`Game.continueHunt`** (replace the M19 placeholder comment):
```js
tickMods(this.hunt);
const ev = rollHuntEvent(this.rng, this.hunt);
this.hunt.lastWasEvent = !!ev;
if (ev) this.showScreen('event', { event: ev }); else this.nextFight();
```
Register `event: createEventScreen(this)` in `this.screens`. Events never change `chain`.

**New `src/ui/screens/eventScreen.js`** (screen interface `{ mount, unmount, update, onKey }`):
- Layout: top bar panel (zone tag, chain chip, satchel chip, HP bar `hunt.hp / game.fightStats.maxHp`), then a centred
  `.event-panel panel`: big bobbing icon, `h2` name, intro text, body, result area, key hints. Zone palette background.
- **Type events**: an incantation view with the text from `eventText`. Strict typing like the lesson: a wrong key does not
  advance. Use `charFromEvent`, ignore `e.repeat`, `preventDefault`, `recordKeyTracked` + `announceMastery`,
  `audio.key(combo)` / `audio.error()`, sparks at the character. Count `correct` and `errors`.
  - `mimic`: a timer bar starts on the first correct key; `update(dt, now)` fails the event when `elapsed > mimicTimeLimit(text.length, mean(recentWpm) || 25)`.
  - `runedoor`: the first error fails immediately ("The runes seal shut").
- **Choice events**: `altar` → `1` accept the curse / `2` walk away. `trader` → two boons from
  `rollBoonOffer(rng, hunt.boons, 2)` shown as boon cards, price `traderPrice(hunt.satchel)`: `1`/`2` buy (satchel −= price,
  `takeBoon`), `3` leave.
- `Esc` before the result: leave the event (no reward). Exception: a mimic whose timer has started counts as a failure.
- **Outcomes** (then show the result area; increment `save.stats.eventsCompleted` unless the player left; `game.persist()`):
  - wayshrine: heal `round(maxHp × shrineHealPct)`; if `correct / (correct + errors) >= shrineAcc` also grant
    `rollBoonOffer(rng, hunt.boons, 1)[0]` (if any) with `takeBoon` and show its boon card; otherwise show the accuracy and
    "95% earns a blessing".
  - mimic: success → `rollItem({ rng, ilvl: zoneIndex + 1, magicFind: fightStats.magicFind + 60, minRarity: 'uncommon', pity: save.stats })`
    → `stashItems`, show `lootCard` with the upgrade flag + `E` quick-equip (§11.4). Failure → `hunt.hp = max(1, hp − round(maxHp × mimicBitePct))`.
  - spring: `hunt.hp = maxHp`.
  - runedoor: success → item with `minRarity: 'rare'`, `magicFind + 100`; failure → nothing.
  - altar: accept → `hunt.mods.push(altarMod())`, text "Next 3 fights: enemies attack 25% faster, +75% gold".
- Result keys: **Enter** → `game.nextFight()` · **Esc** → `game.endHunt('camp')`. An event can never kill the player.

**Achievement:** `wanderer` 🧭 *Wanderer* — "Complete 10 hunt events." `progress: [eventsCompleted, 10]`.

✅ New `tests/events.test.js`: `rollHuntEvent` is null for chain < 2, after an event, with a lure pending, and in boss mode;
over 1000 seeds at chain 5 with satchel 0 the event rate is 20 % ± 4 % and `trader` never appears; `mimicTimeLimit(20, 25)`
≈ 15.4 and is clamped to [4, 20]; `traderPrice(10) === 20`, `traderPrice(200) === 60`; `tickMods` removes a 3-fight mod after
3 ticks; `eventText` uses only allowed characters for every zone × both layouts × the 4 type events.

### 11.10 Balance pass and docs (M22)

1. Re-run the §6 fight simulation (combo tiers add up to +20 % damage). If any row moves by more than 10 percentage
   points, lower the `COMBO_TIERS` multipliers, not the enemy stats.
2. Write a hunt simulation (scratch script, not committed): the §6 naive player (3 % mistakes, tier II casts, step ≤ 50 ms)
   in the Underbog at level 9 with +15 % power and 30 WPM. Each hunt takes the first offered boon, ignores events, and
   returns to camp when HP < 35 %. 300 hunts each with heat 0 and heat 0.03.
   **Targets** (with heat): median chain at camp return 5–8; deaths ≤ 25 % of hunts; the fight at chain 8 lasts ≤ 1.5×
   the chain-0 fight. Tune `huntHeatPer` (0.02–0.04) first, boon values second.
3. Update §4.1 (save fields), §6 (new constants), README (controls: `E` equip upgrade, `1`–`3` pick a boon, event keys;
   test count) and §10 with any real bugs found.

### 11.11 Milestones (implement in this order)

**Phase 1: quick wins**
- **M12 – Groundwork** (§11.1). ✅ All existing tests pass, plus the new loot/save tests.
- **M13 – Rune mastery pop-ups** (§11.2). ✅ Tests; manually reach a level-up → toast + gold key flash, no repeat on reload.
- **M14 – Combo power tiers** (§11.3). ✅ Tests; 25/50 combos show tier banners, the arena tint and the floater bonus.
- **M15 – Upgrade arrows + quick-equip** (§11.4). ✅ Manual check.
- **M16 – Nearest goals** (§11.5). ✅ `goals.test.js`; the strip shows on victory, map and defeat.
- **M17 – Chain milestones** (§11.6). ✅ Tests; chain 3 gives a free item, chain 7 lures a Glimmerkin.
- **M18 – Defeat panel + retry** (§11.7). ✅ Manual check.
- Play a 15-minute session at Adept before Phase 2. Nothing should feel noisy (toasts, banners and sounds must not pile up).

**Phase 2: boons**
- **M19 – Boon logic + hunt heat** (§11.8 data, stats, resolve, engine, game). ✅ `boons.test.js` + new combat/resolve tests.
- **M20 – Boon UI** (§11.8 victory panel, chips, defeat line). ✅ Manual: a 5-win hunt builds visible boons; camp clears them.

**Phase 3: variety**
- **M21 – Hunt events** (§11.9). ✅ `events.test.js`; every event can be reached (temporarily set `eventChance: 1` locally).
- **M22 – Balance pass and docs** (§11.10).

#### v1.1 manual QA checklist
- [ ] A rune level-up mid-fight shows one toast and flashes the key. Typing on after a reload does not repeat it.
- [ ] The combo tier name replaces "combo"; a tier-up shows a banner; a mistake shows "<tier> lost"; the cast floater shows the bonus.
- [ ] Loot that beats your gear shows ▲ Upgrade; `E` equips it; the Character tab agrees.
- [ ] The victory, map and defeat panels show "Within reach" goals that change as you play.
- [ ] Chain 3/5/10 rewards appear as extra loot cards tagged "Chain reward"; chain 7 makes the next foe a Glimmerkin; the top chip counts down.
- [ ] Defeat at < 25 % enemy HP says "So close!"; Enter retries (boss rematch / new hunt); the satchel loss is still applied.
- [ ] After each hunt win you choose 1 of 3 boons (1–3, ←/→, Enter, click); ranks stack; the chips list them; camp or death clears them.
- [ ] The heat chip grows with the chain; boss and practice have no heat.
- [ ] Events appear only from chain 2, never twice in a row; mimic timer, rune door, altar curse (3 fights) and trader all work; Esc behaves as specified.
- [ ] Old save from v1.0 loads without errors and without a burst of mastery toasts.

### 11.12 Pitfalls to expect (read before coding)

1. **`banner()` removes the other small banners.** Mastery pop-ups use toasts; tier banners may replace "PERFECT" (acceptable).
2. **`guardKeys` wraps `m.onKey`.** Put every custom key (E, 1–3, arrows) into `createModal({ onKey })` and return `true`
   when handled. Never add separate `keydown` listeners in panels.
3. **Never mutate `game.stats`.** `applyHuntMods` must copy `schoolPct` and `uniques`. Camp tabs read `game.stats`.
4. **Use the fight stats consistently.** In `combatScreen`, card estimates, tempo and the engine must all use `engine.stats` /
   `game.fightStats`, or the numbers shown will not match the numbers dealt.
5. **Order in `continueHunt`:** take the boon, then compute HP (Second Heart), then `tickMods`, then the event roll.
6. **Keep RNG consumption stable.** Only call `rng.chance` for echo/crit additions when the chance is > 0. Otherwise seeded
   tests change their outcome.
7. **Lazy `peak` init.** Without it, every already-mastered key of an old save is announced on its first press.
8. **Momentum makes the combo non-zero after an error.** The combo UI must take the combo from the event, and milestone
   resets must compare against the new value.
9. **`showScreen` closes all modals.** Close the victory panel before `continueHunt` (already the case). The event screen is a
   screen, not a modal, so camp's `1`–`5` tab keys never reach it.
10. **Esc means different things.** In an event before the result it means leave the event; on the result it means return
    to camp. Show both in the key hints.
11. **Heat never applies to bosses or practice.** Only `nextFight` passes it.
12. **Quick-equip only touches items still in the inventory.** Auto-sold or already-equipped items must be skipped.

---

## 12. v1.2 — Spellcraft update (spell feel)

> **Superseded in part by §14 (v1.4):** the charge orb, glyph flight, projectile kinds and the charge hum below were
> removed. The impact juice (hit-stop, flash, shake/kick/punch, knockback, tints, ward dome, release hold) is still current.

**Goal:** casting must *feel* like magic. Today every school fires the same glowing dot, every impact is the
same burst, and the sounds are thin. v1.2 gives each spell three phases with escalating feedback —
**Charge** (while typing) → **Release** (last key) → **Impact** (on arrival) — a distinct visual and sonic
identity per school, and an intensity that scales with tier, crits, perfect casts and killing blows.
Nothing in the combat rules changes: no balance numbers, no engine events, no save fields.

Design rules (follow them when a detail is unspecified):

1. **Cantrips stay snappy.** Tier I has no hit-stop, no flash, no zoom punch. Spectacle grows with tier.
2. **Feedback is immediate.** The release sound, hand flare and launch happen on the final keystroke. Only
   Forbidden Rites (tier IV) may delay the impact for drama (≤ 300 ms).
3. **One screen flash per cast, max 0.32 alpha.** Never strobe. Flashes, shake, kick and zoom punch obey the
   "Screen shake & flashes" setting; hit-stop does not (it is not motion).
4. **Your words become the spell.** The letters you typed lift off the incantation and fly into the target.
5. **No stuck state.** The charge hum and charge orb must always stop: on release, fizzle, cancel, pause,
   victory, defeat and screen change.

### 12.1 Data — `src/data/spellFx.js` (new, DOM-free)

```js
// Visual/audio identity of each school and the scale of each tier. UI reads these; tests check them.
export const SCHOOL_FX = {
  arcane: { projectile: 'orb',      impact: 'sigil',   flightMs: 300, arc: -70, colors: ['#b48cff', '#efe4ff', '#7b4dff'], tint: 'fx-arcane', hum: 147 },
  fire:   { projectile: 'fireball', impact: 'explode', flightMs: 330, arc: -90, colors: ['#ff7a3d', '#ffd166', '#ff3d2e'], tint: 'fx-burn',   hum: 98 },
  frost:  { projectile: 'lance',    impact: 'shatter', flightMs: 190, arc: -14, colors: ['#7fd8ff', '#effbff', '#3fa9ff'], tint: 'fx-frost',  hum: 294 },
  storm:  { projectile: 'bolt',     impact: 'zap',     flightMs: 0,   arc: 0,   colors: ['#ffe066', '#ffffff', '#8fd3ff'], tint: 'fx-shock',  hum: 196 },
  nature: { projectile: 'seed',     impact: 'bloom',   flightMs: 300, arc: -80, colors: ['#7dffa1', '#e2ffc4', '#ff9ad5'], tint: 'fx-heal',   hum: 220 },
  ward:   { projectile: null,       impact: 'dome',    flightMs: 0,   arc: 0,   colors: ['#9fb4ff', '#ffffff', '#c9b8ff'], tint: 'fx-ward',   hum: 165 },
};

// scale: size of projectiles/orbs · intensity: base impact strength · extra: decorative extra projectiles
export const TIER_FX = {
  1: { scale: 1.0,  intensity: 0.5, hitstopMs: 0,   flash: 0,    punch: 0,     extra: 0, sound: 0.75 },
  2: { scale: 1.25, intensity: 0.8, hitstopMs: 45,  flash: 0.08, punch: 0.006, extra: 0, sound: 1.0 },
  3: { scale: 1.6,  intensity: 1.1, hitstopMs: 70,  flash: 0.14, punch: 0.012, extra: 2, sound: 1.2 },
  4: { scale: 2.1,  intensity: 1.5, hitstopMs: 110, flash: 0.22, punch: 0.022, extra: 0, sound: 1.45 },
};
```

`colors` = `[main, highlight (near white), deep]`. Tier IV has `extra: 0` because every rite has its own
cinematic recipe (§12.5).

### 12.2 Logic — `src/logic/spellFeel.js` (new, pure)

```js
import { TIER_FX } from '../data/spellFx.js';
import { clamp } from '../core/util.js';

/** How hard a landed spell should feel. dmgFrac = (dealt + toBarrier) / enemy max HP (250 for the dummy). */
export function impactProfile({ tier, crit = false, perfect = false, lethal = false, dmgFrac = 0, comboIndex = 0 }) {
  const t = TIER_FX[tier] || TIER_FX[1];
  const frac = clamp(dmgFrac || 0, 0, 1);
  const intensity = clamp(t.intensity + 0.8 * frac + (crit ? 0.35 : 0) + (perfect ? 0.1 : 0) + (lethal ? 0.4 : 0) + 0.05 * comboIndex, 0.4, 2.6);
  return {
    intensity,
    hitstopMs: Math.round(Math.min(220, t.hitstopMs + (crit ? 40 : 0) + (lethal ? 90 : 0))),
    shake: Math.round(clamp(2 + 6 * intensity, 3, 18) * 10) / 10,
    flash: Math.min(0.32, t.flash + (crit ? 0.08 : 0) + (lethal ? 0.06 : 0)),
    punch: Math.min(0.035, t.punch + (crit ? 0.006 : 0) + (lethal ? 0.01 : 0)),
    particles: Math.round(clamp(16 + 36 * intensity, 16, 110)),
    knockPx: Math.round(clamp(8 + 22 * intensity, 8, 60)),
    numberSize: Math.round(clamp(26 + 14 * intensity + (crit ? 12 : 0), 26, 78)),
  };
}

/** Charge orb while typing. progress 0..1 → radius (px), mote spawn rate (per s), glow 0..1, hum 0..1. */
export function chargeLevel(progress, tier) {
  const p = clamp(progress || 0, 0, 1);
  const s = (TIER_FX[tier] || TIER_FX[1]).scale;
  return { radius: (5 + 15 * p) * s, moteRate: (6 + 34 * p) * s, glow: 0.25 + 0.75 * p, hum: 0.5 + 0.7 * p };
}
```

`tests/spellFeel.test.js` (new): every school in `SCHOOLS` has a `SCHOOL_FX` entry with three `#rrggbb`
colours; tiers 1–4 exist; intensity and hitstop are non-decreasing in tier; tier I (no crit, not lethal) has
`hitstopMs 0`, `flash 0`, `punch 0`; crit > no crit and lethal > not lethal for intensity and hitstop;
`dmgFrac: 5` equals `dmgFrac: 1` (clamp); over all tiers × crit × lethal × dmgFrac ∈ {0, 1} the flash
never exceeds 0.32 and hitstop never exceeds 220; `chargeLevel` radius grows with progress and tier and
clamps progress outside 0..1.

### 12.3 FX engine — `src/ui/fx/particles.js` (extend; keep every existing signature)

Keep `burst, sparks, ring, projectile, shake, setShakeEnabled, update, draw, resize, clearAll`. Raise
`MAX_PARTICLES` to 1200. Add:

| API | Behaviour |
|-----|-----------|
| `spawn(p)` | add a raw particle (`type` + fields below). |
| `ring(x, y, color, maxR, life, width = 3)` | `width` = stroke at birth (fades to 1). |
| `projectile(from, to, color, ms, onArrive, size, opts = {})` | `opts.kind`: `'orb'` (default) · `'fireball'` · `'lance'` · `'seed'` · `'meteor'`; `opts.colors` (3 colours); `opts.arc` (px offset of the bezier control point, negative = up; default random −60…−120 as before); `opts.gold` adds gold sparkle to the trail (perfect casts). |
| `lightning(from, to, { color, core = '#fff', width = 3, life = 0.22, branches = 2, jitter = 0.16 })` | jagged bolt (midpoint displacement, 5 levels = 32 segments, perpendicular offset `±len*jitter`, halved per level); points regenerate every 45 ms (flicker); `branches` forks of 25 % length from random points. Glow pass (width × 4, alpha 0.25, colour) + core pass (width, alpha 1, `core`). |
| `arcs(x, y, r, color, ms)` | electric crackle: every 45 ms for `ms`, a mini-bolt (life 0.08, width 1.5, 0 branches) between two random points on a circle of radius `r`. |
| `glyphs(list, to, color, ms)` | `list = [{ ch, x, y, size }]`. Each glyph flies on a quadratic bezier to `to ± 18px` (control point `x + 0.3·dx`, `min(y, to.y) − 60…140`), start delayed `i × 7 ms`, life `ms × (0.85…1.15)`; scale 1 → 0.5; alpha 1 until 60 %, 0 at 90 %. Drawn with `fillText` in `700 {size}px "JetBrains Mono"` twice: 1.5× size at alpha 0.25 (glow), 1× in white→colour. |
| `flash(color, alpha, ms = 160)` | full-screen additive rect, alpha × (1−t)². A new flash replaces the old one if stronger. Disabled when shake is off; × 0.4 under `prefers-reduced-motion`. |
| `setVignette(alpha)` | target darkness of a radial edge vignette (transparent inside 45 % of the larger side → `rgba(4,2,12,alpha)` at the corners); eases at 4/s. Drawn first, `source-over`. |
| `hitstop(ms)` | freeze particles, projectiles, scheduled tasks and the charge orb for `ms` (the longer of current and new). Shake, kick, punch and flashes keep animating. |
| `kick(dx, dy)` | directional impulse on `#app` (damped spring, k = 520, c = 26). Disabled with shake off. |
| `punch(amount)` | zoom impulse on `#app` (`scale(1 + z)`, same spring). Disabled with shake off and under reduced motion. |
| `after(ms, fn)` | run `fn` after `ms` of *FX time* (paused by hit-stop, cleared by `clearAll`). Use this instead of `setTimeout` for anything visual inside a fight. |
| `setCharge(c \| null)` | charge orb: `{ x, y, colors, progress, tier }`. Radius eases to `chargeLevel().radius`; spawns inward-spiralling motes at `moteRate`/s from 30…(30 + 50·scale) px (velocity = (inward + 0.6 × tangential) · d / 0.35 s, life 0.35, no gravity/drag). Draws glow (radius × 3, colour alpha 0.35·glow), core (white → main), and from tier ≥ 2 a rotating dashed rune ring at radius × 2.2. |
| `chargeJolt()` | 0.2 s: orb shrinks 20 %, jitters ±3 px, tints red; spits 5 red sparks. |
| `get size`, `get charging` | `{ w, h }` of the canvas; whether a charge orb is shown (browser QA). |

`#app` transform = `translate(shakeX + kickX, shakeY + kickY) scale(1 + punchZ)`; clear the transform when all
three are idle. New particle `type`s (all additive unless noted):

- `streak` — line from `(x,y)` back along velocity (`len` px, `size` width). Sparks in explosions/storms.
- `shard` — rotating filled triangle (`size` 4–9, `vr` ±10 rad/s), gravity 700. Frost/shatter.
- `flake` — six-armed star, stroke 1.2, slow spin, gravity 30, drag 0.96.
- `flame` — circle growing ×1.8; colour by age: < 25 % highlight, < 55 % main, then deep; negative gravity.
- `smoke` — `source-over`, `rgba(38,34,48, 0.32·a)`, grows ×2.6. Drawn in the non-additive pass.
- `leaf` — rotating ellipse (`size` × `size·0.45`), sways `sin(age·6)·40 px/s` sideways, negative gravity.
- `ray` — line at fixed angle from `r0` outward to `r1` (ease-out), length shrinks to 0. Starbursts, ice spikes.
- `sigil` — magic circle: two circles (r, 0.78 r), hexagram, 12 ticks; radius `r0 → r1` ease-out; spins `vr`.
- `dome` — circle + hexagon outline + faint radial fill, radius `0.55 R → R` ease-out. Ward bubble.
- `flare` — soft radial glow (white centre → colour → transparent), size `s → s·grow`, alpha (1−t)².
- `pillar` — vertical gradient column of light (`x`, `width`, from 0 to `y`), alpha (1−t). Rites.
- `glyph`, `bolt` — see table above.

Projectile drawing per `kind` (position from the existing quadratic bezier, heading from the previous position):
- `orb` — existing core gradient + 2 motes orbiting at `size·1.8` (14 rad/s); trail dots in main colour.
- `fireball` — flickering core (white → highlight → main → transparent, radius `size·3.2·(1 ± 0.1)`); trail per
  frame: 3 `flame`, 30 % chance `smoke`, 30 % chance ember dot (gravity −60, life 0.9).
- `meteor` — fireball × 1.6 plus 2 `streak`s per frame pointing back along the path.
- `lance` — elongated diamond along the heading (tip `+size·3.6`, tail `−size·2.2`, half width `size·0.9`),
  white → main gradient, glow circle alpha 0.3; trail: 40 % chance `flake`, 2 small dots in highlight.
- `seed` — green orb (as `orb`) with 50 % chance per frame of a `leaf` in the trail.
- `opts.gold` — every kind adds one gold (`#ffe066`) dot per frame to the trail.

### 12.4 Audio — `src/ui/audio.js` (extend; keep every existing method)

Signal chain: every voice → (optional `StereoPannerNode`) → `master`; plus an optional send → `verbIn` →
`ConvolverNode` (impulse: 2.2 s stereo noise × (1 − t)³, generated in `unlock()`) → `verbOut` (gain 0.32) →
`master`. `tone()` and `noise()` take two new options, `pan` (−1…1) and `verb` (send gain 0…1), and `noise()`
takes `attack` (default 0.01). Release sounds pan to −0.35 (the wizard), impacts to +0.35 (the enemy).

New helpers: `bell(freq, { dur, gain, delay, pan, verb })` = sines at ratios `[1, 2.76, 5.4, 8.93]`, gains
`[1, 0.5, 0.25, 0.12]`, decays `dur × [1, 0.7, 0.5, 0.35]`. `crackle({ dur, count, gain, delay, pan })` =
`count` highpass noise ticks (12–28 ms, 2.5–6 kHz) spread over `dur`. `whoosh(...)` = `noise()` whose attack
is 40 % of its duration.

| Method | Recipe (`k` = `TIER_FX[tier].sound`) |
|--------|--------------------------------------|
| `chargeStart(school, tier)` | voice: sawtooth at `SCHOOL_FX.hum` + sine an octave up (+7 cents) → lowpass (Q 6, 250 Hz) → gain ramps to `HUM_GAIN·k·0.5` in 0.15 s (`HUM_GAIN = 0.011`); tier IV adds a 6 Hz tremolo (LFO gain 0.0035). Replaces a running voice. |
| `chargeSet(p)` | `setTargetAtTime(…, 0.05)`: pitch × (1 + p), cutoff 250 + 2800·p², gain `HUM_GAIN·k·chargeLevel(p).hum`. |
| `chargeEnd(reason)` | `'release'`: fade in 40 ms. `'fizzle'`: pitch falls to 0.5× and fades in 250 ms. otherwise fade 80 ms. Stops the oscillators 0.4 s later. Idempotent. |
| `release(school, tier, { perfect })` | arcane: bandpass whoosh 700→2600 Hz (q 3, 0.22 s, 0.14k) + sine 1046→523 (0.18 s, 0.06k) + triangle 1568 (0.25 s, 0.02, verb 0.4). fire: lowpass whoosh 300→2200 (0.32 s, 0.14k) + sawtooth 110→220 (0.25 s, 0.03k) + crackle ×5. frost: highpass whoosh 7000→3000 (0.18 s, 0.08k) + sine 1760→2637 (0.16 s, 0.03k) + bell 2349 (0.4 s, 0.025, verb 0.5). storm: highpass noise crack 1500 Hz (0.06 s, 0.22k) + square 2400→180 (0.14 s, 0.04k). nature: harp — `3 + tier` triangle notes of `[0,4,7,12,16,19,24]` on 523 Hz, 50 ms apart (0.5 s, 0.045, verb 0.5) + airy bandpass whoosh 2→4 kHz (0.6 s, 0.03). ward: bell 784 (0.9 s, 0.06, verb 0.5) + bell 1175 (+40 ms, 0.035) + sine 196 hum (0.6 s, attack 0.08, 0.05) + highpass "shing" 5→9 kHz (0.2 s, 0.04); tier ≥ 3 + bell 1568 (+120 ms, 0.03). Nature and ward releases *are* the heal/shield sound — do not also call `heal()`/`shield()`. `perfect`: 4 sines `[24,28,31,36]` semitones over 392 Hz, 35 ms apart (0.12 s, 0.02, verb 0.4). |
| `impact(school, tier, { intensity, crit, lethal })` | `k = min(1.4, 0.6 + 0.4·intensity)`. arcane: sub sine 220→55 (0.35 s, 0.22k) + bandpass sweep 2400→240 (q 7, 0.3 s, 0.12k) + triangle chord `[0,7,12]` on 523 (0.5 s, 0.03, verb 0.5). fire: lowpass noise 3500→140 (0.55 s, 0.26k) + sub 95→32 (0.5 s, 0.24k) + crackle ×10 over 0.6 s (verb 0.2). frost: 8 bandpass ticks 3–9 kHz (q 12, 40 ms, 0.06, spread 0.18 s) + bell 1568 (0.7 s, 0.05, verb 0.5) + sub 150→60 (0.2 s, 0.16k). storm: highpass crack (0.05 s, 0.2k) + rumble lowpass 700→70 (0.9 + 0.3·tier s, attack 0.02, delay 0.03, 0.2k) + sub 70→30 (0.6 s, 0.18k). nature: soft thud sub 180→70 (0.18 s, 0.12k) + bandpass 1500→500 (0.15 s, 0.05). Layers: `crit` → bell 2093 (0.5 s, 0.05, verb 0.4) + the old `crit()` tones; tier IV → boom sub 50→22 (1.2 s, 0.22) + lowpass noise 1500→50 (1.6 s, 0.14, verb 0.7); `lethal` → sub 60→25 (1.0 s, 0.2) + lowpass noise 900→60 (1.4 s, 0.1, verb 0.6). |
| `heal(tier = 1)` / `shield(tier = 1)` | keep the old notes, add `verb 0.35`; tier ≥ 3 adds one octave-up repeat 0.12 s later. |
| `shatter()` | barrier break / ward break: 10 bandpass ticks + bell 1975 (0.6 s, 0.05, verb 0.5). |

`createAudio({ makeContext } = {})` — optional factory so an `OfflineAudioContext` can render sounds for level
checks (`unlock()` must not call `resume()` on it). `cast(school)` stays as an alias of `release(school, 2, {})`.
`get charging` reports a running hum voice; `setVolume(0)` ends it. The noise buffer is 2 s and **loops** (long
rumbles would otherwise run off its end into silence).

Measured levels (offline render, volume 0.6, after the compressor): a typical tier-II fire impact is as loud as the
old `hit(true)` (loudest 300 ms ≈ −41.5 dBFS); the extreme case (tier IV + crit + lethal, intensity 2.6) peaks
around −16 dBFS — no clipping; the full charge hum stays below the old cast whoosh.

### 12.5 Choreography — `src/ui/fx/spellFx.js` (new)

`createSpellFx(game)` → `{ beginCharge, chargeProgress, chargeJolt, endCharge, charging, cast, echo, shatter, tick }`.
It only calls `game.fx.*`, `game.audio.*`, `floatText`/`banner` and element classes; combat rules stay in the engine.

- `beginCharge({ school, tier, hand })` → `fx.setCharge`, `audio.chargeStart`; tier IV also `fx.setVignette(0.12)`.
- `chargeProgress(p)` → orb progress, `audio.chargeSet(p)`; tier IV vignette `0.12 + 0.3·p`.
- `chargeJolt()` → `fx.chargeJolt()`.
- `endCharge(reason)` → orb removed; `'fizzle'`: 16 smoke + 12 red dots at the orb; `'cancel'`: 8 soft motes
  drifting up. Vignette back to 0 except on `'release'` (a rite keeps it until the impact). Always calls
  `audio.chargeEnd(reason)`.
- `cast({ card, result, hand, playerAt, enemyAt, glyphs, hits, lethal, dmgFrac, comboIndex, onImpact })`:
  1. `audio.release(school, tier, { perfect })`; player sprite gets `.thrust` (280 ms); flare at the hand
     (highlight colour, size `24·scale`, grow 2.2, life 0.25) + `8 + 4·tier` dots fired toward the enemy (angle 0,
     spread 0.9; self spells: upward, spread 2.4); perfect casts add 8 short gold rays + 10 gold sparks.
  2. `fx.glyphs(glyphs, hits ? enemyAt : playerAt, colors[0], flightMs || 220)`.
  3. Heal (`result.heal`): ring green (90·scale), flare at the player, `14 + 8·tier` leaves spiralling up,
     `20 + 10·tier` rising motes, player `.fx-heal` 900 ms (the sound is the nature release). Tier IV: green `pillar` at the
     player (width 90) + 40 extra leaves incl. pink petals.
  4. Shield (`result.shield`): `dome` at the player (R = 0.7 × sprite height, life 0.9), 12 glints on the
     circle (the sound is the ward release); tier ≥ 3 a second dome 120 ms later; tier IV + 12 lavender rays and a sigil
     at the player's feet.
  5. If `hits`: launch by school (main projectile carries `onImpact`; flight = `flightMs + 25·tier`):
     - arcane `orb`, fire `fireball`, frost `lance`, nature `seed` — `size = (8 + tier) · (crit ? 1.4 : 1)`.
     - storm — no flight: `fx.lightning(hand, enemyAt, { width: 3 + tier, branches: 1 + tier, life: 0.26 })`,
       impact after 30 ms.
     - tier III: `extra` decorative copies (no damage, no number) 70 ms apart with arcs −30 / −130 (storm: bolts
       from `(enemy.x ± 60, −20)`), each landing with a 10-particle burst.
     - tier IV rites: **Sunfall** (fire) `meteor` from `(enemy.x − 220, −60)`, arc 0, 420 ms ·
       **Absolute Zero** (frost) lance + 3 decorative lances from above + frost flash `#bfefff` ·
       **Wrath of the Skies** (storm) 4 decorative sky bolts 70 ms apart, then the real bolt from the hand at 280 ms ·
       **Singularity** (arcane) orb; on arrival a vortex (fast-spinning sigil + 40 motes pulled inward for
       260 ms), then the impact. Every rite also shows `banner(card.name.toUpperCase(), { sub: perfect ?
       'Perfect Forbidden Rite' : 'Forbidden Rite', size: 'small', duration: 1300 })` instead of "PERFECT".
  6. **Impact** (`profile = impactProfile(...)`): `fx.hitstop`, `fx.flash(highlight, profile.flash)`,
     `fx.shake(profile.shake, 260 + 60·I)`, `fx.kick(8 + 10·I, −2)`, `fx.punch(profile.punch)`, flare at the
     enemy (size `30 + 30·I`), then by school:
     - fire `explode`: `0.6·particles` flames outward, `12 + 10·I` streak sparks, `3 + 3·I` smoke, `10 + 10·I`
       embers, orange ring width 6 (tier ≥ 3: second ring after 80 ms).
     - frost `shatter`: `14 + 16·I` shards, `8 + 8·I` flakes, 8 ice rays (length `40 + 30·I`), cyan ring width 4.
     - storm `zap`: `20 + 20·I` streaks (speed 500), thin yellow ring, `fx.arcs(enemy, 50, …, 420 ms)`.
     - arcane `sigil`: sigil `r 30 → 60 + 40·I` (life 0.6, spin 3 rad/s) + `particles` dots purple/white + ring.
     - nature: 10 leaves + 12 green dots.
     - crit (any school): 10 gold rays (length `60 + 30·I`).
     - enemy sprite gets `SCHOOL_FX.tint` (frost 1200 ms, others 600 ms) and `audio.impact(...)`.
     - finally `onImpact(profile)`.
- `echo({ from, to, onImpact })` — white `orb`, 260 ms, impact at tier-I strength, no hitstop.
- `shatter(at, colors)` — 24 shards + ring + `audio.shatter()` (barrier broken, ward broken).
- `tick(dt, { burning, enemyAt })` — while the enemy burns, 18 flames/s licking up from its lower half.

### 12.6 Combat screen wiring — `src/ui/screens/combatScreen.js`

- `const spell = createSpellFx(game)`. `handOf(sprite)` = rect `(left + 0.78·w, top + 0.42·h)`.
- `castStart` → `spell.beginCharge`; `keyCorrect` → `spell.chargeProgress((index + 1) / len)` and set
  `--charge` (same value) on `.incant` and the player sprite; `keyError` → `spell.chargeJolt()`;
  `cancel` → `endCharge('cancel')`; `fizzle` → `endCharge('fizzle')`; pause / defeat / victory / unmount →
  `endCharge('abort')`. Safety net in `update()`: `if (!engine.cast && spell.charging) spell.endCharge('abort')`.
  After the pause closes with a cast still open, call `beginCharge` + `chargeProgress` again.
- `onCastComplete`: **before** anything else, read glyph rects from the incantation spans (non-space typed
  characters; font size from `getComputedStyle(incView.el).fontSize`). Then `endCharge('release')`, then
  `spell.cast(...)` with `lethal = !engine.dummy && engine.enemy.hp <= 0.5`, `dmgFrac = (dealt + toBarrier) /
  (finite maxHp ? maxHp : 250)`, `comboIndex = comboTier(engine.combo).index`.
- **Release hold:** like the fizzle hold, keep the finished line visible with `.incant.released` for 340 ms
  (`holdUntil`, one variable for fizzle and release), then `idleIncant(true)` via `fx.after`, guarded by a hold
  token so an older timer never ends a newer hold — the fizzle timer uses the same token. `showIncant` removes
  `.released`.
- `impact(...)` now takes the profile: `--knock = knockPx`, `.hit` for `240 + hitstopMs` ms, `.arena.frozen`
  for `hitstopMs` (pauses sprite animations → the white hit frame is held), enemy bar `.struck` 320 ms,
  number size `profile.numberSize`, class `slam` for tier IV or lethal hits.
- **Killing blow:** `impactHoldUntil = now + hitstopMs + 140` when lethal; the victory burst waits for
  `pendingHits === 0 && now >= impactHoldUntil`.
- Ward: a `.ward-dome` element inside the player sprite, `.on` while `player.shield > 0`, opacity
  `clamp(0.35 + shield / maxHp, 0.35, 0.9)` via `--ward`; `.hit` pulse when it absorbs damage; when the shield
  breaks (absorbed > 0 and shield now 0) → `spell.shatter(player, ward colours)`.
- `barrierBroken` → `spell.shatter(enemy, ['#cfdcff', '#ffffff', '#9fb4ff'])` in addition to the old burst.
- `spell.tick(dt, …)` every frame. Expose `get engine()` on the screen object (debugging / browser QA).

### 12.7 CSS — `src/styles/main.css`

- `.ch.typed` plays `chLit` 0.22 s: starts white with a strong glow and `top: -0.14em` (spans are
  `position: relative` inline — **do not** make them inline-block, it breaks word wrapping), settles to the
  school colour.
- `.incant.casting` glow scales with `--charge`; `.incant.released .itext` plays `released` 0.34 s (scale 1 →
  1.05, brightness 2, blur 0 → 3 px, opacity → 0).
- `.player .sprite.casting` drop-shadow radius `10px + 30px·--charge`; `.player .sprite.thrust` 0.28 s lean
  toward the enemy (translateX 14 px, scale 1.06).
- `knock` keyframes use `var(--knock, 18px)` with a squash `scale(0.94, 1.06)`; `.arena.frozen .sprite,
  .arena.frozen .sprite-inner { animation-play-state: paused !important }`.
- Tints on `.sprite-inner`: `fx-frost` (saturate 0.35, brightness 1.2, cyan drop-shadow), `fx-burn`
  (orange drop-shadow, brightness 1.15), `fx-shock` (jitter animation, yellow glow, brightness 1.4),
  `fx-arcane` (violet glow), `fx-heal` (green glow, brightness 1.15) — the player's inner sprite keeps
  `scaleX(-1)` in every animation.
- `.ward-dome` (absolute, inset −14 % −20 %, round, border + radial fill in `--shield`, shimmer animation),
  `.ward-dome.on`, `.ward-dome.hit`.
- `.bar.struck` (brightness flash + 2 px shake), `.floater.slam` (lands from scale 3 with a small rotation).
- Reduced motion: no `chLit` hop, no thrust.

Settings: rename the row to **Screen shake & flashes** — "Impacts shake and flash the screen." (same `shake` key).

### 12.8 Milestones

| # | Work | Acceptance |
|---|------|-----------|
| M23 | `data/spellFx.js`, `logic/spellFeel.js`, `tests/spellFeel.test.js` | `npm test` green |
| M24 | `particles.js` additions (§12.3) | old callers unchanged; no console errors on the title screen |
| M25 | `audio.js` additions (§12.4) | offline render: no sound peaks above 0 dBFS after the compressor; old methods still work |
| M26 | `spellFx.js` + combat wiring + CSS (§12.5–12.7) | every school and tier casts in the browser with its own look; no stuck hum/orb after cancel, fizzle, pause or victory |
| M27 | settings label, README, this section's pitfalls | docs match the code |

#### v1.2 manual QA checklist
- [ ] Typing grows an orb in the wizard's hand; a hum rises with progress; a mistake jolts the orb red.
- [ ] Esc / fizzle / pause / victory / defeat while casting: orb and hum stop at once.
- [ ] Each school reads differently at a glance: purple sigil, fire explosion with smoke, frost shards, instant lightning, leaves, shield dome.
- [ ] The typed letters fly from the incantation into the target.
- [ ] Cantrips: no freeze, no flash. Rites: name banner, freeze-frame, flash, zoom punch, unique cinematic.
- [ ] Crits add a gold starburst + bell; killing blows freeze longer before the enemy dies.
- [ ] "Screen shake & flashes: Off" removes shake, kick, punch and flashes, but hit-stop still works.
- [ ] Fast typists can start the next spell during the release hold and the impact of the previous one.

### 12.9 Pitfalls found while building v1.2

1. **Never make `.ch` spans `inline-block`** to animate them: atomic inlines create a line-break opportunity
   between every letter and long incantations wrap mid-word. The hop animates `top` on the relatively
   positioned inline span instead.
2. **Read the glyph rects first** in `onCastComplete` — after `idleIncant`/`renderCards` the spans are hidden or
   gone and every rect is 0×0.
3. **`fx.setCharge` must always receive the full state** (`x, y, colors, progress, tier`). A screen change calls
   `fx.clearAll()`, and a partial update afterwards would create an orb at `NaN, NaN`.
4. **Projectile `onArrive` can change the arrays it is iterated over** (it may spawn projectiles or, on the last
   hit, lead to `showScreen` → `clearAll`). Iterate backwards, find the projectile again with `indexOf` before
   splicing, and skip entries that are gone.
5. **Use `fx.after`, not `setTimeout`, for timed visuals in a fight** — it pauses during hit-stop and is cleared on
   screen change, so a late callback never touches a dead screen. (The arena `.frozen` class is the one real
   `setTimeout`: it must track wall-clock time and only touches its own element.)
6. **Specificity:** `.enemy .sprite.hit` (knockback) beats `.sprite.dying`; the victory code removes `hit` before
   adding `dying`, otherwise the death animation waits for the hit class to expire.
7. **`.sprite.fx-shock .sprite-inner` would replace the white hit flash** (same specificity, later rule). The combined
   `.sprite.hit.fx-shock .sprite-inner` rule runs both animations.
8. **Trail spawning per frame is frame-rate dependent** — a 144 Hz screen would get 2.4× the particles. Projectiles
   accumulate `dt·60` and spawn one trail step per whole unit.
9. **Measure loudness, don't guess.** The first draft of the tier-IV + lethal layers measured ~16 dB above the old
   hit; the RMS was dominated by sub-bass that laptop speakers barely play, but headphones would. Gains were cut and
   `impact()`'s `k` capped at 1.4.
10. **Headless Chromium idles at ~66 ms per frame** (software rendering) — compare frame times against an idle
    baseline, not against 16.7 ms. `fx.update + draw` with 900 mixed particles costs ≈ 0.7 ms.

**Status: implemented** (M23–M27).

---

## 13. v1.3 — The Glyphdeep (endless roguelike mode)

> **Goal:** an endless mode whose only goal is *get as deep as possible*. It can be played from the very first
> launch (no campaign progress needed), and every roguelike system must make the player a better touch typist:
> the run hunts your weak keys, pays you for clean keystrokes, rewards rhythm and finger discipline, and ends
> with a report of which keys got faster during the run.

Design rules (follow them when a detail is unspecified):

1. **Self-contained power.** A run never uses campaign level, attunements or gear. Power comes from the run
   (boons, relics, tempered runes), small meta upgrades bought with Ink, and real key mastery (which already
   scales `rawPower`). A fresh save and a level-40 save start a run equally strong.
2. **Every reward is earned with clean typing.** Coins come from golden runes typed without a mistake; bane
   letters, tempering, rhythm and the wisp all reward accuracy and steadiness first, speed second.
3. **The run is the keyboard's choice, not the campaign's.** The player picks a *rune circle* (the cumulative key
   set of campaign region I…IX). Records are kept per circle, so a home-row beginner and a full-keyboard typist
   both chase their own best depth.
4. **No dead ends, no stuck state.** Every room ends in exactly one call to `game.rogueAdvance()` (or the run
   ends). A reload during a run resumes at the room the player was in.
5. **Pure logic stays pure** (§0): everything in `src/logic/rogue.js` runs in Node and takes `rng` as a parameter.

### 13.0 Feature catalogue

| # | Feature | Where |
|---|---------|-------|
| 1 | Rune circle choice + per-circle records | §13.2, §13.9 Glyphdeep tab |
| 2 | Doors: choose the next room by **typing its word** (fight, elite, mystery, campfire, shop, treasure, glimmerkin; guardian every 5th depth) | §13.4, §13.9 map screen |
| 3 | Depth scaling + strata (every 5 depths the scenery and foes move to the next region; guardians are the region bosses) | §13.4 |
| 4 | **Bane rune** — each fight's foe is weak to one of *your* weakest keys: those letters glow red and channel ×2 power | §13.4, §13.5 |
| 5 | **Golden runes** — ~1 in 28 letters is gold; typed without a mistake = coins | §13.5 |
| 6 | **Relics** (24) incl. technique relics: Metronome (rhythm), Pinky Promise / Ringbearer (finger power), Racing Wisp (ghost of your average pace), Blind Oath (no guide, +damage), Space Between (spaces shield you) | §13.2 |
| 7 | **Curses** (6) taken in Dark Pacts for strong relics: Ink Blots (hidden letters — know the word), Brittle Spells, Hasted Foes… | §13.2 |
| 8 | **Campfire tempering**: rest, or drill one of your weakest runes; ≥ 90 % accuracy tempers it (+50 % power on that key for the run, ×3 ranks) | §13.6 |
| 9 | Run events: the 6 hunt events (rogue variants) + **Racing Wisp** (beat your own ghost), **Glass Bridge** (3 cracks and you fall), **Dark Pact** | §13.6 |
| 10 | Shop (relics, boons, mending, cleansing, rerolls) and reward rerolls 🎲 | §13.4, §13.9 |
| 11 | **Ink** meta currency + **Scriptorium** (6 permanent upgrades) | §13.2, §13.9 |
| 12 | **Chronicle** (run summary): depth, record, WPM per fight sparkline, accuracy, **runes that got faster this run**, build recap, ink | §13.4, §13.9 |
| 13 | New record banner mid-run, record marker on the depth track | §13.9 |
| 14 | 4 achievements (depth 10, depth 25, 6 relics, 5 tempered runes) | §13.10 |
| – | Daily seeded descent, global leaderboards, opposite-hand-Shift relic | Backlog |

### 13.1 The run loop

```
Title (D) / Camp tab 6 ──► Glyphdeep tab: pick circle, Enter
        │
        ▼
 createRun ──► [Keepsake upgrade? pick 1 of 3 relics]
        │
        ▼
 ┌─► Map screen "Depth N+1": 2–3 doors (1 guardian door at every 5th depth). Type a door's word.
 │       │
 │       ├─ fight / elite / guardian / glimmer ─► combat (mode 'rogue') ─► reward panel ─┐
 │       ├─ mystery ─► event screen (hunt events + wisp / bridge / pact) ───────────────┤
 │       ├─ campfire ─► room screen: Rest, or Temper ─► event screen (temper drill) ────┤
 │       ├─ shop / treasure ─► room screen ──────────────────────────────────────────────┤
 │       ▼                                                                               │
 └── game.rogueAdvance(): depth += 1, tick mods, roll new doors, save ◄───────────────────┘
        defeat (or Abandon) ─► finishRun ─► Chronicle panel ─► Enter: new run · Esc: camp
```
`run.depth` = depths **cleared**; it is the score. The room being played is depth `run.depth + 1`.

### 13.2 Data

**`src/data/balance.js`** — add (numbers after the M35 balance pass, §13.12):
```js
export const ROGUE = {
  guardianEvery: 5,
  // enemies (depth d is 1-based)
  hpBase: 46, hpGrowth: 1.1, atkBase: 7, atkGrowth: 1.075,
  attackSecBase: 7.6, attackSecPerDepth: 0.08, minAttackSec: 3.6,
  eliteHp: 1.9, eliteAtk: 1.25, guardianHp: 0.65, guardianAtk: 0.85,
  // player
  baseHp: 100, victoryHeal: 0.15, guardianHeal: 0.3, campfireHeal: 0.35, vitalHeal: 0.3, vitalHpPct: 6,
  startRerolls: 1,
  // coins
  coinMin: 6, coinMax: 10, coinPerDepth: 0.06, coinsDoorMult: 3,
  coinKind: { mob: 1, elite: 2, boss: 4, glimmerkin: 6 },
  goldenRate: 0.035, goldenCoins: 2,
  // bane & tempering
  bane: 2, temperBonus: 0.5, temperMax: 3, temperAcc: 0.9, temperLen: 34,
  // shop: price = round(base × (1 + shopScalePerDepth × depth))
  shopScalePerDepth: 0.03,
  prices: { relic: 70, boon: 38, heal: 28, cleanse: 55, reroll: 24 },
  shopHeal: 0.35,
  // events
  wispSpeed: 1.12, wispMinWpm: 12, bridgeCracks: 3, bridgeFallPct: 0.15, mimicCoins: 18, bridgeCoins: 30,
  // doors
  doorWeights: { fight: 46, elite: 14, mystery: 18, campfire: 9, shop: 7, treasure: 3, glimmer: 3 },
  fightRewardWeights: { boon: 62, coins: 22, vital: 16 },
  // meta
  inkPerDepth: 2, inkPerGuardian: 6, inkPerGolden: 0.34,
  keepRuns: 12,
};
```

**New `src/data/rogue.js`** (imports `ROGUE` from balance.js only):
```js
export const DOOR_TYPES = {
  fight:    { id: 'fight',    icon: '⚔️', name: 'Battle',       desc: 'A foe of this stratum' },
  elite:    { id: 'elite',    icon: '💀', name: 'Elite',        desc: 'A deadly foe guarding a relic' },
  guardian: { id: 'guardian', icon: '👑', name: 'Guardian',     desc: 'The lord of this stratum' },
  glimmer:  { id: 'glimmer',  icon: '💰', name: 'Glimmerkin',   desc: 'Catch it before it flees' },
  mystery:  { id: 'mystery',  icon: '❓', name: 'Mystery',      desc: 'Anything can wait in the dark' },
  campfire: { id: 'campfire', icon: '🔥', name: 'Campfire',     desc: 'Rest, or temper a rune' },
  shop:     { id: 'shop',     icon: '🛒', name: 'Ink Merchant', desc: 'Spend your coins' },
  treasure: { id: 'treasure', icon: '💎', name: 'Treasure',     desc: 'An unguarded relic' },
};
export const REWARD_TYPES = {
  boon:  { icon: '✦',  name: 'Boon',        desc: 'Choose a boon' },
  coins: { icon: '🪙', name: 'Coin hoard',  desc: 'Triple coins' },
  vital: { icon: '❤️', name: 'Vital spark', desc: `Heal ${Math.round(ROGUE.vitalHeal * 100)}% and +${ROGUE.vitalHpPct}% max health` },
  relic: { icon: '🔮', name: 'Relic',       desc: 'Choose a relic' },
};
// stats: numbers are ADDED to the fight stats (same keys as boons, §11.8) except
//   uniques: string[] → added to stats.uniques;  fingerMult: { finger: m } → multiplied into stats.fingerMult
export const RELICS = [ { id, icon, name, weight, text, stats, minCircle?, curse?, consumable? }, ... ];
export const RELIC_BY_ID;  export const CURSE_IDS;
export const META_UPGRADES = [ { id, icon, name, max, cost: (rank) => number, text: (rank) => string }, ... ];
export const META_BY_ID;
```
Relics (weight 10 unless noted; `text` exactly as shown):

| id | icon | name | text | stats |
|----|------|------|------|-------|
| metronome | 🎼 | Metronome | Keep a steady beat: spells typed with an even rhythm deal up to +35% damage | `rhythm: 0.35` |
| pinky | 🤙 | Pinky Promise | Keys under your pinkies channel triple power | `fingerMult: { lp: 3, rp: 3 }` |
| ringbearer | 💍 | Ringbearer | Keys under your ring fingers channel double power | `fingerMult: { lr: 2, rr: 2 }` |
| wisp | 🧚 | Racing Wisp | A wisp races every incantation at your average speed. Beat it for up to +40% damage — trail it and lose up to 30% | `paceRune: 1` |
| blindoath | 🙈 | Blind Oath | The keyboard guide is sealed for this run. Your spells deal +30% damage | `blind: 1, powerMult: 0.3` |
| midas | ✨ | Midas Quill | Golden runes appear twice as often, and a spell with a golden rune always crits | `goldenRate: ROGUE.goldenRate, goldenCrit: 1` |
| glass | 🪞 | Glass Quill | +50% spell damage, but every mistake cuts you for 4% of your max health | `powerMult: 0.5, glassPct: 0.04` |
| spacer | 🌌 | Space Between | Every space you type adds a shield of 1.5% max health | `spaceShieldPct: 0.015` |
| crown | 👑 | Combo Crown | Combo tiers come twice as fast | `comboRate: 1` |
| ledger | 📒 | Scribe's Ledger | +8 coins for every 100 correct keystrokes | `ledger: 8` |
| hearth | 🏠 | Hearthstone | Home row keys channel double power | `uniques: ['hearth']` |
| glyph | 🔣 | Glyphwright's Signet | Capitals, digits and symbols channel +50% power (minCircle 5) | `uniques: ['glyphwright']` |
| phoenix | 🪶 | Phoenix Feather | Once, survive a lethal blow with 30% health — then the feather burns away | `uniques: ['phoenix']`, consumable |
| chime | 🎐 | Wind Chime | The first spell that would fizzle in each fight holds together | `uniques: ['secondWind']` |
| lens | 💎 | Flawless Lens | Perfect casts deal +40% more | `perfectBonus: 40` |
| hourglass | ⏳ | Slow Hourglass | Enemies attack 15% slower | `tempoPct: 15` |
| heartstone | 💗 | Heartstone | +25% maximum health | `maxHpPct: 25` |
| clover | 🍀 | Four-Leaf Clover | Every boon and relic reward offers one more choice | `extraChoice: 1` (weight 6) |
| dice | 🎲 | Loaded Dice | Gain 2 rerolls now and 1 after every guardian | `rerollPerGuardian: 1` (+2 rerolls when taken) |
| banebrand | 🗡️ | Banebrand | Bane runes channel ×3 power instead of ×2 | `baneBonus: 1` |
| whetstone | 🪨 | Whetstone | Tempered runes gain twice the power | `temperBonus: 1` (weight 6) |
| echoshell | 🔁 | Echo Shell | 15% chance a damage spell is cast twice | `uniques: ['echo']` |
| avalanche | 🏔️ | Avalanche Stone | Each cast within 2.5s of the last adds +10% damage (max +50%) | `uniques: ['avalanche']` |
| tempest | 🌩️ | Storm Primer | Critical hits push the enemy's attack back by 25% | `uniques: ['tempest']` (weight 6) |

Curses (`curse: true`, weight 10, never offered as rewards; they come from the Dark Pact; the shop can cleanse them):

| id | icon | name | text | stats |
|----|------|------|------|-------|
| blots | 🫥 | Ink Blots | Some letters are blotted out — you must know the word | `blots: 1` (UI only, §13.9) |
| brittle | 🥀 | Brittle Spells | One fewer mistake allowed in every spell | `tolerance: -1` |
| haste | ⏩ | Hasted Foes | Enemies attack 25% faster | `tempoPct: -20` |
| frail | 🩹 | Frailty | −20% maximum health | `maxHpPct: -20` |
| sealed | 🕶️ | Sealed Sight | The keyboard guide is sealed | `blind: 1` |
| toll | 🩸 | Blood Toll | Every fight starts with a cut of 6% max health | `bloodToll: 0.06` |

Meta upgrades (`cost(r)` = price of the next rank when `r` ranks are owned):

| id | icon | name | max | cost(r) | text(r) |
|----|------|------|-----|---------|---------|
| vigor | ❤️ | Hardy Hands | 5 | 20 + 10r | +{8r} maximum health in every run |
| purse | 🪙 | Inheritance | 3 | 25 + 15r | Start every run with {20r} coins |
| bones | 🎲 | Lucky Bones | 2 | 35 + 25r | Start every run with {r} extra reroll(s) |
| gild | ✨ | Gilded Script | 3 | 30 + 15r | Golden runes appear {25r}% more often |
| embers | 🔥 | Warm Embers | 2 | 30 + 20r | Campfires heal {10r}% more |
| keepsake | 📿 | Keepsake | 1 | 90 | Begin every run by choosing 1 of 3 relics |

### 13.3 Save schema

`createNewSave()` adds (deepMerge fills them for old saves; `version` stays 1):
```js
rogue: { ink: 0, upgrades: {}, best: {}, runs: [], totalRuns: 0, lastCircle: null, run: null },
// stats additions:
bestDepth: 0, bestRelics: 0, runesTempered: 0, guardiansSlain: 0, goldenRunes: 0,
```
`best[circle] = depth` (circle as string key). `runs` = last `ROGUE.keepRuns` Chronicles, newest first.
`run` = the run in progress (plain JSON, §13.4) or `null`. **Never put a `Set` or a function into the run.**

### 13.4 Logic — new `src/logic/rogue.js`

```js
export const ROGUE_STAT_DEFAULTS = { rhythm: 0, glassPct: 0, spaceShieldPct: 0, comboRate: 1, paceRune: 0, blind: 0,
  goldenCrit: 0, extraChoice: 0, ledger: 0, rerollPerGuardian: 0, temperBonus: 0, baneBonus: 0, bloodToll: 0, blots: 0 };

export function isGuardianDepth(depth)        // depth % ROGUE.guardianEvery === 0
export function stratumOf(depth)              // floor((depth - 1) / guardianEvery)  (0, 1, 2, …; unbounded)
export function stratumZone(depth)            // stratumOf(depth) % ZONES.length  (visuals + foes)
export function circleLabel(layoutId, circle) // { roman, icon, name: ZONES[circle].name, keys: string (new chars, ≤ 14 + "…"), total: allowed letters count }

export function runBaseStats(save)
  // st = computePlayerStats(createNewSave()) (level 1, no gear); up = save.rogue.upgrades
  // return { ...st, ...ROGUE_STAT_DEFAULTS, maxHp: ROGUE.baseHp + 8 * (up.vigor || 0),
  //          goldenRate: ROGUE.goldenRate * (1 + 0.25 * (up.gild || 0)), campfireBonus: 0.1 * (up.embers || 0) }

export function rogueFightStats(base, run)
  // relics = run.relics → defs; mods = [...run.mods, ...defs.map(d => ({ stats: numeric entries of d.stats }))]
  // run.vital → mods.push({ stats: { maxHpPct: ROGUE.vitalHpPct * run.vital } })
  // out = applyHuntMods(base, { boons: run.boons, mods })      (never mutates base)
  // out.uniques += every d.stats.uniques; out.fingerMult = {} then multiply every d.stats.fingerMult in
  // out.runeMult = {}: tempered ch (rank r) → 1 + r * ROGUE.temperBonus * (1 + out.temperBonus);
  //   bane (if run.bane) → × (ROGUE.bane + out.baneBonus); set the same value on ch.toUpperCase() too
  // out.bane = run.bane; out.maxHp = max(1, out.maxHp); return out

export function createRun({ save, circle, layoutId, rng })
  // → { mode: 'rogue', circle, zoneIndex: circle, layoutId, seed: rng.int(1, 1e9), depth: 0, hp: null,
  //     coins: 20 * (up.purse || 0), rerolls: ROGUE.startRerolls + (up.bones || 0),
  //     boons: {}, mods: [], relics: [], tempered: {}, vital: 0, doors: [], room: null, bane: null, lastEvent: null,
  //     keepsake: up.keepsake ? rollRelicOffer(rng, run, 3) : null,
  //     prevBest: save.rogue.best[circle] || 0, recordBroken: false, log: [],
  //     stats: { kills: 0, elites: 0, guardians: 0, casts: 0, correct: 0, errors: 0, golden: 0, perfects: 0,
  //              fizzles: 0, bestCombo: 0, seconds: 0, fights: [] },          // fights: [{ d, wpm, acc }]
  //     startKeys: keySnapshot(save.keyStats, allowedChars(layoutId, circle)), startedAt: Date.now() }

export function rogueEnemyStats(depth, kind, def)
  // hp  = round(hpBase × hpGrowth^(d-1) × (def.hpMult ?? 1) × K) with K = { mob 1, elite eliteHp, boss guardianHp, glimmerkin 1 }
  // atk = round(atkBase × atkGrowth^(d-1) × (def.atkMult ?? 1) × A) with A = { mob 1, elite eliteAtk, boss guardianAtk, glimmerkin 0 }
  // (read ROGUE inside the function, never into module-level tables: the balance script overrides ROGUE at run time)
  // attackSec = max(minAttackSec, (attackSecBase − attackSecPerDepth × (d−1)) × (def.speedMult ?? 1))
  // → { hp, atk, attackSec }   (same shape as progression.enemyStats; passed to the engine as `enemyOverride`)

export function guardianDef(depth, layoutId, circle)
  // { ...ZONES[stratumZone(depth)].boss } with mechanics deep-copied; drop every `armored` mechanic whose
  // `new RegExp(unless)` matches no char of allowedChars(layoutId, circle) (a home-row run can't type digits);
  // from the 2nd lap (stratumOf ≥ ZONES.length): name `Echo of ${name}`, add enrage {at:0.3, mult:0.7} if missing

export function rollFoe(rng, depth, type, { layoutId, circle })   // → { def, kind }
  // fight → { ...rng.pick(zone.mobs) }, 'mob' · elite → ELITE_TRAITS clone like spawnEnemy, 'elite'
  // glimmer → { ...GLIMMERKIN }, 'glimmerkin' · guardian → guardianDef(...), 'boss'

export function doorWords(rng, layoutId, circle, count, depth)
  // pool = wordPool(layoutId, circle) filtered /^[a-z]+$/ and 3 ≤ length ≤ 5 + min(3, floor(depth / 5));
  // shuffle; take words with distinct first letters; widen to any length, then single allowed letters if short.

export function rollDoors(rng, run, { layoutId })   // → door[] for depth run.depth + 1
  // guardian depth → [ { type: 'guardian', reward: 'relic' } ]
  // else n = (next === 1 ? 2 : 3) doors from doorWeights with these rules:
  //   elite/shop/glimmer need next ≥ 3, mystery/campfire next ≥ 2, treasure next ≥ 4;
  //   no campfire or shop if the previous room had that type; each non-fight type at most once;
  //   the depth right before a guardian always offers a campfire (replace the last door) unless last room was one;
  //   at least one fight or elite door (replace door 0 with a fight);
  //   fight rewards from fightRewardWeights, distinct between fight doors where possible; elite → 'relic';
  //   glimmer → 'coins'; others → null.
  // every door: { id: `d${next}-${i}`, type, reward, word, foe? } — fight/elite/glimmer/guardian get foe = rollFoe(...)

export function rollRelicOffer(rng, run, count)    // distinct non-curse relic ids not owned, minCircle ≤ run.circle, weighted
export function rollCurse(rng, run)                 // a curse id not owned, or null
export function takeRelic(run, id)                  // push once; dice → run.rerolls += 2; returns true if added
export function removeRelic(run, id)
export function fightCoins(rng, run, { kind, door, stats })   // round(int(coinMin,coinMax) × (1 + coinPerDepth×(d−1)) × coinKind × (door.reward==='coins' ? coinsDoorMult : 1) × stats.goldMult)
export function rogueVictoryRewards(rng, run, { kind, door, summary, stats })
  // → { coins: { base, golden: summary.golden × goldenCoins, ledger: floor(summary.correct × stats.ledger / 100), total },
  //     heal: round(stats.maxHp × (kind === 'boss' ? guardianHeal : victoryHeal)), vital: door.reward === 'vital',
  //     offer: { kind: 'boon'|'relic'|null, choices: [...] }, rerollGain: kind === 'boss' ? stats.rerollPerGuardian : 0 }
  // boon offer: rollBoonOffer(rng, run.boons, 3 + extraChoice) (entries { id, rank }); relic: rollRelicOffer(rng, run, 3 + extraChoice)
  // relic offers for elite and guardian; an empty relic pool falls back to a boon offer.
export function rollShop(rng, run, stats)          // 2 relics, 2 boons, heal, reroll, + cleanse when a curse is held
  // → [{ key: '1'…, kind, id?, rank?, price, sold: false }]
export function shopPrice(kind, depth)
export function temperCandidates(keyStats, layoutId, circle, run, rng)  // 3 chars: weakChars first, then random letters; skip rank ≥ temperMax
export function temperDrill(ch, { layoutId, circle, rng })              // ≥ temperLen chars rich in `ch` (words containing it, else "ch ch" groups with home letters)
export function rollRogueEvent(rng, run)            // weighted HUNT_EVENTS + ROGUE_EVENTS (trader needs 40 coins), never run.lastEvent
export function keySnapshot(keyStats, allowedSet)   // { ch: { n, acc, ms } } for every allowed non-space key with n ≥ 1
export function keyImprovements(before, keyStats, { min = 6 } = {})
  // keys typed ≥ min times during the run with a before snapshot: gain = (msBefore − msAfter) + (accAfter − accBefore) × 1000;
  // → sorted list of { ch, msBefore, msAfter, accBefore, accAfter, gain } with gain > 0
export function runInk(run)                          // round(inkPerDepth × depth + inkPerGuardian × guardians + inkPerGolden × golden)
export function finishRun(save, run, { cause, killedBy = null })
  // builds the Chronicle { t, circle, layoutId, depth, cause, killedBy, prevBest, record, ink, guardians, kills, relics, boons,
  //   tempered, avgWpm, accuracy, bestCombo, golden, seconds, fights, improvements: top 3, weakest: weakChars(...)[0] }
  // updates save.rogue (ink, best, runs (cap keepRuns), totalRuns, run = null) and save.stats (bestDepth, bestRelics, guardiansSlain, goldenRunes)
export function upgradeCost(id, rank) / buyUpgrade(save, id) // → bool (enough ink and below max)
```

### 13.5 Engine, resolve and cards changes

All changes are **inert for campaign fights** (stats default to 0/1, no extra RNG calls), so every existing test passes.

**`spellResolve.js`**
- `rawPower(text, layoutId, keyStats, uniques, mults = null)`: `mults = { runeMult, fingerMult }`; per char
  `w *= (runeMult?.[ch] || 1) * (fingerMult?.[info.finger] || 1)` (skip space for fingerMult).
- `resolveSpell({ …, extraMult = 1, forceCrit = false })`: `base *= extraMult`; `crit = rng.chance(critCh) || forceCrit`
  (the RNG is consumed exactly as before); pass `{ runeMult: stats.runeMult, fingerMult: stats.fingerMult }` to `rawPower`;
  return `extraMult` in the result. `estimateCard` therefore includes bane/temper/finger power automatically.

**`cards.js` `createCard`**: when `ctx.goldenRate > 0`, `golden = []` of indices `i ≥ 1` with `text[i] !== ' '` and
`rng.chance(ctx.goldenRate)`; always return `golden` (empty array when the rate is 0 — no RNG call).

**`combat.js`**
- constructor option `enemyOverride = null` → `const es = enemyOverride || enemyStats(...)`.
- `this.ctx = { layoutId, zoneIndex, weakChars, goldenRate: stats.goldenRate || 0 }`.
- `this.blindfold = mechanics has blindfold || !!stats.blind`.
- cast gets `gaps: []` and `errAt: []`; `fight.golden = 0`; `summarizeFight` returns `golden`.
- `onCorrect`: when not the first key push `ms` into `c.gaps`; if `card.golden` contains the index and it is not in
  `c.errAt` → `c.golden++`, `fight.golden++`, emit `golden { index }`. If `ch === ' '` and `stats.spaceShieldPct` →
  shield += `max(1, round(maxHp × pct))` (capped at `shieldCapPct`).
- `onError`: push the index into `c.errAt` (grace path too); non-grace path with `stats.glassPct` →
  `damagePlayer(max(1, round(maxHp × glassPct)), 'glass')`.
- `completeCast`: `comboMult: comboTier(combo × (stats.comboRate || 1)).mult`; pace when `difficulty.pace || stats.paceRune`;
  `extraMult = stats.rhythm ? 1 + stats.rhythm × rhythmScore(c.gaps) : 1` → result `rhythm` (score) for the floater;
  `forceCrit: !!stats.goldenCrit && c.golden > 0`.
- `export function rhythmScore(gaps)`: fewer than 4 gaps → 0; gaps clipped to 1500 ms; `cv = sd / mean`;
  `clamp((0.6 − cv) / 0.4, 0, 1)` (cv 0.2 → 1, 0.4 → 0.5, ≥ 0.6 → 0).

### 13.6 Events

**`src/data/events.js`** adds:
```js
export const ROGUE_EVENTS = [
  { id: 'wisp',   icon: '🧚', name: 'Racing Wisp',  weight: 9, kind: 'type',   intro: 'A wisp of light challenges you to a race. It runs at your own best pace — the race starts with your first key.' },
  { id: 'bridge', icon: '🌉', name: 'Glass Bridge', weight: 8, kind: 'type',   intro: 'Every mistake cracks a pane. Three cracks and you fall.' },
  { id: 'pact',   icon: '🩸', name: 'Dark Pact',    weight: 6, kind: 'choice', intro: 'A voice offers great power. It asks only for a small, lasting flaw.' },
];
export const TEMPER_EVENT = { id: 'temper', icon: '🔨', name: 'Rune Tempering', kind: 'type', intro: 'Strike the rune again and again. Keep your accuracy and the rune grows stronger for this descent.' };
// EVENT_TEXT += wisp: { tier: 3, school: 'storm' }, bridge: { tier: 4, school: 'frost' }
// EVENT_BY_ID includes ROGUE_EVENTS and TEMPER_EVENT
```
Rogue outcomes in `eventScreen.js` (hunt behaviour unchanged):
- wayshrine / spring / altar: as in §11.9 on `run.hp`, `run.boons`, `run.mods` (altar gold → coins via `goldMult`).
- mimic success → `ROGUE.mimicCoins × (1 + 0.06 × depth)` coins; runedoor success → a random relic (`rollRelicOffer(rng, run, 1)`), else coins.
- trader → pays with `run.coins`.
- **wisp**: ghost WPM = `max(wispMinWpm, mean(recentWpm) × wispSpeed)`; the ghost caret starts with the first key and moves
  `(elapsed min × ghostWpm × 5)` characters. Finish first → relic; lose → "The wisp wins" (no penalty).
- **bridge**: each error = 1 crack (a pane row of `bridgeCracks` icons); at `bridgeCracks` cracks → fall: lose
  `bridgeFallPct × maxHp` (never below 1). Success → `bridgeCoins + 3 × depth` coins, and a boon when perfect.
- **pact**: `1` accept → a relic from `rollRelicOffer(rng, run, 1)` + `rollCurse(rng, run)` (both shown); `2` refuse.
- **temper** (params `{ ch }` from the campfire): text `temperDrill(ch)`; accuracy ≥ `temperAcc` →
  `run.tempered[ch] = min(temperMax, rank + 1)`, `save.stats.runesTempered += 1`; else "The rune cracks — no change".
- After the result: **Enter** (and Esc) → `game.rogueAdvance()`. Before the result, Esc leaves (mimic/bridge: started = failure).

### 13.7 Game controller (`ui/game.js`)

```js
get run()                       // this.hunt when this.hunt.mode === 'rogue', else null
get fightStats()                // rogue → rogueFightStats(runBaseStats(save), run); hunt → applyHuntMods; else stats
startRun(circle)                // createRun → save.rogue.run = this.hunt = run; lastCircle; rogueAdvance-like door roll; persist; showScreen('rogueMap')
continueRun()                   // this.hunt = save.rogue.run; run.room ? enterRoom(run.room) : showScreen('rogueMap')
enterDoor(door)                 // run.room = door; run.doors = []; persist; enterRoom(door)
enterRoom(door)                 // fight/elite/guardian/glimmer → startRogueFight(door); mystery → event (rolled once, stored in door.event);
                                // campfire/shop/treasure → showScreen('rogueRoom', { door })
startRogueFight(door)           // run.bane = pick from weakChars(…, 3) else a random letter of the circle;
                                // bloodToll; showScreen('combat', { mode: 'rogue', zoneIndex: circle, visualZone: stratumZone,
                                //   kind, enemyDef, enemyStats: rogueEnemyStats(...), carryHp: run.hp, door })
rogueRecordFight(summary)       // run.stats += summary (casts, correct, errors, golden, perfects, fizzles, bestCombo, seconds, fights.push)
rogueVictory({ kind, summary }) // rewards = rogueVictoryRewards(...); coins/heal/vital/rerolls/kill counters applied; persist; return rewards
rogueClaim(offerKind, id)       // boon → takeBoon (Second Heart heals what it adds); relic → takeRelic (Heartstone heals likewise)
rogueAdvance()                  // run.depth += 1; log; recordBroken check; run.room = null; run.bane = null; tickMods(run);
                                // run.doors = rollDoors(...); persist; showScreen('rogueMap', { arrived: true })
endRun(cause, killedBy)         // summary = finishRun(...); this.hunt = null; persist; checkAchievements(); return summary
```
Register screens `rogueMap: createRogueMapScreen(this)` and `rogueRoom: createRogueRoomScreen(this)`.

### 13.8 Incantation marks

`incantation.js`: `setText(text, marks = null)` — `marks[i]` is a space-separated class string added to span `i`
(`golden`, `bane`, `blot`); `setGhost(i)` moves a `ghost` class (−1 removes it). `rogueView.js` exports
`charMarks(card, { bane, blots })` used for cards and the incantation panel:
- `golden` for `card.golden` indices; `bane` where `ch.toLowerCase() === bane`;
- `blot` (Ink Blots curse): letters at index ≥ 1, not the first letter of their word, in words of ≥ 4 letters, at most one
  per word, chosen by a deterministic hash of `card.id + index` (`hash % 5 === 0`). Pure UI — the engine still expects the real letter.

### 13.9 UI

- **Title** (`titleScreen.js`): button `The Glyphdeep — endless` (hotkey `D`, label `Continue the descent (depth N)` with a
  saved run). It runs the normal "choose your path" difficulty modal when needed, then opens camp tab `glyphdeep`.
- **Camp** (`campScreen.js`): 6th tab `🌀 Glyphdeep` (`6`). **`glyphdeepTab.js`**: left = rune circles I–IX (icon, name,
  new keys, best depth, "new to you" tag above the campaign progress, ↑/↓ select, Enter descend; with a saved run:
  Enter continue, `X` abandon with confirm); right = Ink + Scriptorium (click to buy), lifetime numbers, last runs.
- **Top bars** (`rogueView.runChips`): rooms show `🌀 Depth N+1` (the room being played); the map shows no depth chip — its
  title is the depth. Record chip: `🏆 Record R` → `🏆 New record! (was R)` once `depth > R`; `🏆 First descent` without one.
- **Map screen** (`rogueMapScreen.js`): run top bar (record, coins, rerolls, HP, relics, boons, curses); title
  `Depth N+1`; doors (`.door`): type icon, name, foe icon + name, reward line, the door word with a glowing first letter
  (typing works like casting: first letter selects, wrong keys flash, Esc cancels; ←/→ + Enter also work); depth track
  (last 8 rooms, upcoming dots, 👑 guardian, 🏆 record marker); WPM-this-run sparkline; Esc → pause (Resume /
  Return to camp — the run is saved / Abandon run). Keepsake: relic pick modal on the first map visit.
  Arrival: `NEW RECORD` banner once per run when `depth > prevBest > 0`; stratum banner after every guardian.
- **Combat** (`combatScreen.js`, mode `rogue`): visuals from `visualZone`, text from the circle; top bar = run chips +
  `☠ Bane k`; nameplate bane tag; cards and incantation rendered with `charMarks`; `golden` → `+2🪙` floater + coin sound;
  Racing Wisp ghost caret; victory → `createRogueVictoryPanel`; defeat → `endRun` + `createChroniclePanel`;
  glimmer escape → continue; pause → Resume / Abandon run; `phoenix` event consumes the feather.
- **Room screen** (`rogueRoomScreen.js`): campfire (`1` rest · `2` temper → `1`–`3` rune), shop (`1`–`8` buy, Enter/Esc
  leave), treasure (`1`–`3` relic, `4` take coins instead).
- **Panels** (`rogueReveal.js`): `relicCard`, victory (title, depth, stats, coin breakdown, offer with `1`–`n`, ←/→,
  Enter, `R` reroll), relic pick modal, **Chronicle** (title `THE DESCENT ENDS` / `NEW RECORD`, depth, record, stat row,
  sparkline, "Runes that got faster", build recap, ink; Enter: descend again · Esc: camp).

### 13.10 Achievements

`deep10` 🕳️ Into the Deep — "Reach depth 10 in the Glyphdeep." `bestDepth ≥ 10`, progress · `deep25` 🌌 Abyssal Diver —
"Reach depth 25 in the Glyphdeep." · `curator` 🏺 Curator — "Hold 6 relics in one descent." `bestRelics ≥ 6` ·
`runesmith` 🔨 Runesmith — "Temper 5 runes at Glyphdeep campfires." `runesTempered ≥ 5`.

### 13.11 Tests — new `tests/rogue.test.js` (+ additions)

- `runBaseStats` ignores campaign level/gear (level-30 save with gear → same maxHp/powerMult as a fresh save) and applies
  `vigor`; `rogueFightStats` never mutates its input, applies boons + relics + curses (`heartstone` → maxHp × 1.25,
  `frail` with it → × 1.05), adds uniques, multiplies `fingerMult`, sets `runeMult` for bane (×2, ×3 with banebrand, also
  uppercase) and tempered runes.
- Every numeric relic stat key exists in `runBaseStats` output (or is `schoolPct.*`) — catches typos.
- `rogueEnemyStats` grows monotonically with depth; elites tougher than mobs; glimmerkin atk 0.
- `rollDoors`: guardian alone at 5/10/15; depth 1 → 2 doors; ≥ 1 fight/elite door; distinct first letters of words; words
  only use allowed chars of the circle (all circles × both layouts × 30 seeds); a campfire on depth 4/9; no shop twice in a row.
- `guardianDef` drops `armored` digits for circle 0 and keeps it for circle 8.
- `rollRelicOffer` distinct, never owned, never curses, honours `minCircle`; `rollCurse` never owned.
- `rogueVictoryRewards`: golden coins, ledger coins, boss → relic offer, coins door triples base.
- `temperDrill` uses only allowed chars and contains the rune ≥ 3 times (every circle × both layouts, letters and `;`).
- `keyImprovements` finds a key that got faster; `finishRun` updates best/ink/runs and clears `save.rogue.run`; old saves
  load with `rogue` defaults; `buyUpgrade` respects ink and max.
- `combat.test.js`: `enemyOverride` sets hp/atk; golden index typed cleanly → `golden` event, typed after an error at
  that index → none; `goldenCrit` forces a crit; `glassPct` mistake hurts; space shield; `comboRate: 2` → combo 13 gives
  the tier-1 mult; `rhythmScore([200,200,200,200]) === 1`, uneven gaps → < 0.5; `blind` sets `blindfold`.
- `spellResolve.test.js`: `runeMult` doubles a char's contribution; `fingerMult` likewise; `forceCrit` crits with a no-crit rng.
- `cards.test.js`: `goldenRate: 0` → `golden` empty and identical texts for the same seed; `goldenRate: 1` → every non-space index ≥ 1.

### 13.12 Balance simulation (M35)

Scratch script (not committed): the §6 naive typist (3 % mistakes, prefers tier II, steps ≤ 50 ms) plays whole runs on
Adept, circle 4 (all letters): picks the first fight door (boon reward preferred), a campfire when HP < 50 % (rest), takes
the first boon/relic offered, ignores shops/events. 200 runs per WPM.
**Targets** (median depth): 20 WPM → 7–10 · 35 WPM → 11–15 · 60 WPM → 17–23. A guardian should take 1.5–2.5× a normal
fight of its depth. Tune `hpGrowth` / `atkGrowth` first, `victoryHeal` second.

**M35 results** (200 runs per row, Circle V, Adept). First draft (`guardianHp 0.8`, `guardianAtk 1`, `atkGrowth 1.07`,
`victoryHeal 0.1`): 20 WPM → **4** (Mossback, the first guardian, ended 62 of 80 runs) · 35 → 13 · 60 → 24.
Chosen (`guardianHp 0.65`, `guardianAtk 0.85`, `atkGrowth 1.075`, `victoryHeal 0.15`):

| Setup | WPM | Median depth (p10–p90) | Fight / guardian |
|-------|-----|------------------------|------------------|
| Circle V, Adept | 20 / 35 / 60 | **8** (4–9) / **14** (9–19) / **24** (19–29) | 28 s / 54 s (×2.0) at 20 WPM |
| Circle I (home row), Adept | 15 / 30 | 4 (4–8) / 14 (9–19) | home-row beginners belong on Apprentice |
| Circle IX (full keyboard), Adept | 40 / 70 | 17 / 29 | symbols weigh more, so the circle is "richer" |
| Circle V, Apprentice | 12 / 20 | 9 / 14 | |
| Circle V, Archmage | 50 / 80 | 14 / 23 | |

60 WPM sits one depth above the target; the naive bot never casts Ward, so real players do better anyway and the
records are per circle. Guardians are the main killer at every speed — that is their job.

### 13.13 Milestones

| # | Work | Acceptance |
|---|------|-----------|
| M28 | `ROGUE` + `data/rogue.js` + save schema + achievements data | `npm test` green; old save loads |
| M29 | `logic/rogue.js` + `tests/rogue.test.js` | tests green |
| M30 | engine / resolve / cards changes (§13.5) + tests | all old tests unchanged and green |
| M31 | events data/logic + `game.js` run flow | a run can be driven from the console: `startRun(0)` … `endRun` |
| M32 | incantation marks, `rogueView.js`, `rogueReveal.js`, map screen | doors can be typed open; reward panel works |
| M33 | combat + event + room screens in rogue mode | full loop playable in the browser, no console errors |
| M34 | title button, camp tab, Chronicle, CSS polish | playable from a fresh save straight from the title |
| M35 | balance simulation (§13.12), README, this section's pitfalls | targets met; docs match the code |

#### v1.3 manual QA checklist
- [ ] Fresh save: title → `D` → path modal → Glyphdeep tab → circle I → Enter → doors on the home row.
- [ ] Typing a door word opens it; wrong keys flash; ←/→ + Enter works; Esc opens the pause menu.
- [ ] Bane letters glow red on cards and in the incantation; the nameplate names the bane; estimates are higher for bane-rich cards.
- [ ] Golden letters typed cleanly pop `+2🪙`; a mistake on a golden letter forfeits it.
- [ ] Fight → reward panel (boon / relic / coins / vital) → map at the next depth; `R` rerolls while rerolls remain.
- [ ] Depth 5 shows one guardian door; after it the stratum (scenery + foes) changes and a banner announces it.
- [ ] Campfire: rest heals; temper runs a drill heavy in the chosen key and shows the result; the tempered chip appears.
- [ ] Shop buys relics/boons/heal/reroll/cleanse with coins; prices grow with depth.
- [ ] Mystery: every event works in rogue mode (temporarily force each id); Enter always returns to the map.
- [ ] Racing Wisp relic shows a ghost caret; Blind Oath hides the keyboard; Ink Blots hides letters until typed.
- [ ] Reload mid-run (map, shop, fight) → title shows "Continue the descent" and resumes the same room.
- [ ] Death → Chronicle with sparkline, faster runes, ink; Enter starts a new run on the same circle; records update.
- [ ] Scriptorium purchases persist and take effect (HP, coins, rerolls, keepsake pick).
- [ ] Campaign hunts, bosses, events and practice behave exactly as before.

### 13.14 Pitfalls (read before coding; extended during implementation)

1. **The run is persisted JSON.** No `Set`s, Maps or functions in `run`; offers store ids, never relic objects.
2. **`zoneIndex` means two things in a run.** Text, keyboard and weak keys use the *circle*; scenery and foes use the
   *stratum zone*. Combat gets `zoneIndex: circle` + `visualZone`; the engine gets `enemyOverride` so `enemyStats(circle)`
   is never used for a rogue foe.
3. **Never call `endHunt` in rogue mode** (it banks a satchel and goes to camp). Every rogue exit is `rogueAdvance()` or `endRun()`.
4. **RNG stability:** golden rolls only when `goldenRate > 0`; `forceCrit` ORs after `rng.chance` so the campaign consumes the same numbers.
5. **Bane letters must match the incantation weighting:** pass the bane first in `weakChars` so cards actually contain it.
6. **Max-HP changes heal what they add** (Second Heart, Heartstone, Vital spark) — otherwise taking +HP looks like damage.

Found while building v1.3 (real bugs):

7. **Door rules collided.** "The depth before a guardian offers a campfire" replaced the last door, then "at least one fight"
   overwrote door 0 — which could be that very campfire. Force the fight onto a door that is not the pre-guardian campfire.
8. **A second row in the enemy column pushes boss nameplates over the top bar** (the first bane tag was its own row). The
   bane is now a `np-bane` span inside the nameplate. Separately, at heights ≤ 720 px even *campaign* fighters overflowed their
   arena row; a `max-height: 720px` media query shrinks sprites and hides the attack-timer label.
9. **Run chips wrap the top bar** once a run holds 8+ relics. Icon strips are capped (`+N`, full list in the tooltip), combat
   uses `runChips(..., { compact: true })`, and the HP bar sits right after the zone tag so wrapping moves chips, not the HP bar.
10. **The shop sold a Mending Draught at full health** ("+0 health"). Buying a heal at full HP is refused with a toast.
11. **Module-level tables froze balance values.** `KIND_HP/KIND_ATK` built from `ROGUE` at import time ignored the balance
    script's overrides — build them inside `rogueEnemyStats`.
12. **The event screen assumed a hunt** (`satchel`, `zoneIndex` for text, `nextFight`/`endHunt`). It now uses small
    mode-aware helpers (`textZone`, `purse`, `pay`, `takeBoonHere`) and `rogueAdvance()` after every result in a run.
13. **Esc on the campfire drill used up the campfire.** Before the first key it returns to the fire (`rogueRoom`).
14. **Don't edit `src/` while a browser script drives the dev server** — Vite reloads the page and the script reports
    phantom failures.

**Status: implemented** (M28–M35). 113 tests (`tests/rogue.test.js` + additions to combat, resolve and cards tests).

---

## 14. v1.4 — Sigil & Song (spell style revamp)

**Why:** after v1.2 every school still *sounded* the same while charging — one sawtooth drone under the same triangle-wave
combo melody (measured: all six schools within 0.5 dB and 0.03 brightness of each other, and the level between keystrokes
only ~4 dB under the overall level = a constant drone). Players called it annoying. The orb-and-projectile look was also
generic. v1.4 replaces the whole presentation of a spell with one idea:

> **Every spell is a sigil you inscribe and a song you play.**

- **Sigil (visual):** on the first key a faint magic circle appears in front of the wizard. Each correct letter carves one
  segment of its rim and writes that letter onto the rim. The school's sacred geometry draws itself inside as you progress.
  Mistakes crack the rim; a fizzle makes the circle fall apart. On release the sigil seals (flash + spin-up), streaks to the
  target and **stamps a second sigil there**, and the spell erupts *out of that sigil*. No orbs, no projectiles.
- **Song (audio):** each school is an instrument with its own scale and register. Each keystroke plays the next note of a
  rising, dancing melody. Release strums the school's chord; impact is percussion plus a low root; a killing blow plays a
  resolving cadence. **No sustained sound anywhere** — every voice decays on its own.

Rules: v1.2's §12 design rules 1–3 and 5 still apply (cantrips snappy, one flash per cast ≤ 0.32, nothing stuck), plus:
6. **Never drone.** No oscillator may run longer than its natural decay (≤ 1.8 s). No sawtooth or square waves in spell voices.
7. **Soft treble.** Notes above 700 Hz are attenuated (`gain × clamp((700/f)^0.35, 0.55, 1.15)`); melodies span at most two octaves.
8. **Schools must differ** in instrument, scale, register, sigil geometry *and* manifestation.

Combat rules, balance and save data do not change. §12's charge orb, glyph flight, projectile kinds and charge hum are
**removed** (superseded by this section); its impact juice (hit-stop, flash, kick, punch, knockback, slam numbers, tints,
ward dome, release hold) stays.

### 14.1 Data — `src/data/spellFx.js` (replace `SCHOOL_FX`, extend `TIER_FX`)

```js
// seal = sigil geometry layers (unit radius, drawn in order). shapes: poly{n,r,rot°} · star{n,k,r} (n/k star polygon)
// · spokes{n,r0,r1,rot°,branch} · petals{n,r} · eye{r} · ring{r}
export const SCHOOL_FX = {
  arcane: { colors: ['#b48cff', '#efe4ff', '#7b4dff'], tint: 'fx-arcane', manifest: 'collapse',
    seal: [{ shape: 'star', n: 7, k: 3, r: 0.66 }, { shape: 'eye', r: 0.34 }, { shape: 'ring', r: 0.12 }],
    instrument: 'bell', root: 293.66, scale: [0, 2, 3, 7, 8] },          // D4 · hirajoshi
  fire: { colors: ['#ff7a3d', '#ffd166', '#ff3d2e'], tint: 'fx-burn', manifest: 'eruption',
    seal: [{ shape: 'poly', n: 3, r: 0.66, rot: -90 }, { shape: 'poly', n: 3, r: 0.4, rot: 90 }, { shape: 'spokes', n: 3, r0: 0.12, r1: 0.66, rot: -90 }],
    instrument: 'marimba', root: 130.81, scale: [0, 3, 5, 7, 10] },     // C3 · minor pentatonic
  frost: { colors: ['#7fd8ff', '#effbff', '#3fa9ff'], tint: 'fx-frost', manifest: 'crystallize',
    seal: [{ shape: 'poly', n: 6, r: 0.64, rot: -90 }, { shape: 'spokes', n: 6, r0: 0.1, r1: 0.64, rot: -90, branch: true }, { shape: 'poly', n: 6, r: 0.3, rot: 0 }],
    instrument: 'musicbox', root: 440, scale: [0, 4, 6, 7, 11] },        // A4 · lydian colours
  storm: { colors: ['#ffe066', '#ffffff', '#8fd3ff'], tint: 'fx-shock', manifest: 'judgement',
    seal: [{ shape: 'star', n: 8, k: 3, r: 0.66 }, { shape: 'poly', n: 4, r: 0.3, rot: 45 }, { shape: 'spokes', n: 4, r0: 0.3, r1: 0.48, rot: 0 }],
    instrument: 'pluck', root: 220, scale: [0, 2, 3, 7, 9] },            // A3 · kumoi
  nature: { colors: ['#7dffa1', '#e2ffc4', '#ff9ad5'], tint: 'fx-heal', manifest: 'bloom',
    seal: [{ shape: 'petals', n: 5, r: 0.62 }, { shape: 'star', n: 5, k: 2, r: 0.36 }, { shape: 'ring', r: 0.12 }],
    instrument: 'kalimba', root: 329.63, scale: [0, 2, 4, 7, 9] },       // E4 · major pentatonic
  ward: { colors: ['#9fb4ff', '#ffffff', '#c9b8ff'], tint: 'fx-ward', manifest: 'bastion',
    seal: [{ shape: 'poly', n: 4, r: 0.66, rot: 0 }, { shape: 'poly', n: 4, r: 0.66, rot: 45 }, { shape: 'ring', r: 0.4 }, { shape: 'poly', n: 4, r: 0.28, rot: 45 }],
    instrument: 'vibes', root: 174.61, scale: [0, 2, 4, 7, 11] },        // F3 · major 9 / maj7 colours
};
```

`TIER_FX` keeps every v1.2 field and adds `sigilR` (caster sigil radius, px) `{ 1: 40, 2: 52, 3: 64, 4: 80 }` and
`span` (scale steps the melody climbs) `{ 1: 5, 2: 6, 3: 7, 4: 7 }`.

### 14.2 Logic — `src/logic/spellFeel.js` (keep `impactProfile`, replace `chargeLevel`)

```js
const DANCE = [0, 2, 1, 3]; // up-down ornament so the climb never sounds like a plain ramp
/** Scale step of the i-th typed letter (0-based) of an n-letter incantation: climbs `span` steps, dancing. */
export function melodyStep(i, n, tier) {
  const span = (TIER_FX[tier] || TIER_FX[1]).span;
  const base = Math.round((clamp(i, 0, n - 1) / Math.max(1, n - 1)) * span);
  return base + DANCE[((i % 4) + 4) % 4];
}
/** Semitones above the root for a scale step; steps past the end continue in the next octave. */
export function scaleSemitone(scale, step) {
  const len = scale.length;
  return scale[((step % len) + len) % len] + 12 * Math.floor(step / len);
}
/** Release strum: scale steps 0, 2, 4, 5, 7, 9 … (root, "third", "fifth", octave …) → semitones; 2 + tier notes. */
export function sealChord(scale, tier) { const steps = [0, 2, 4, 5, 7, 9]; return steps.slice(0, 2 + tier).map((s) => scaleSemitone(scale, s)); }
/** Rim segment i of n, clockwise from 12 o'clock → { a0, a1, mid } in radians. */
export function rimSegment(i, n) { const w = (Math.PI * 2) / n; const a0 = -Math.PI / 2 + i * w; return { a0, a1: a0 + w, mid: a0 + w / 2 }; }
```

Tests (`tests/spellFeel.test.js`, replace the `chargeLevel` test): every school has `instrument` in the six known names, a
root of 100–500 Hz, an ascending scale starting at 0 with values < 15, a non-empty `seal` and a `manifest`; the six
`instrument`s are all different, and so are the six `manifest`s; `melodyStep` of the last letter > of the first, never
negative, never above `span + 3`; the highest melody note of every school stays within 2 octaves + 2 semitones of its root;
`scaleSemitone([0,3,5,7,10], 5) === 12`; `sealChord` is ascending, starts at 0, has `2 + tier` notes;
rim segments of n tile the full circle.

### 14.3 FX engine — `src/ui/fx/particles.js`

Remove the charge orb (`setCharge`, `chargeJolt`), `glyphs`, the `glyph`/`sigil`/`dome` particle types and the special
projectile kinds (`fireball`, `meteor`, `lance`, `seed` — the plain `orb` projectile stays for generic use). Add:

| API | Behaviour |
|-----|-----------|
| `addLayer(obj)` | `obj = { update(dt) → bool alive, draw(g) }`. Updated after particles (frozen by hit-stop, like particles), drawn in the additive pass **before** particles. Cleared by `clearAll`. Returns `obj`. |
| `setVignette(alpha, color = '#04020c')` | as before plus a tint colour (frost rite uses `#0b2a44`). |
| `get layerCount` | number of live layers (QA). |

`rgba(hex, a)` moves to a tiny shared module `src/ui/fx/color.js` (used by particles and sigils).

### 14.4 Drawables — `src/ui/fx/sigils.js` (new)

All drawables are layers (§14.3), drawn with `'lighter'` compositing as **three strokes** (`glowStroke`): glow (width 5 px,
alpha 0.28, main colour), line (width core + 0.8 px, alpha 0.85, main colour), hot core (width core × 0.5, ≥ 0.6 px,
alpha 0.9, highlight). (A first version used only glow + highlight core: every sigil read as white and the schools lost
their colour.) Geometry is precomputed once per school as polylines in unit
coordinates (`sealPaths(school)`, cached) and drawn with `strokePartial(g, polylines, frac)` (draws the first `frac` of the
total length, polyline after polyline).

**`createSigil({ x, y, R, school, tier, text, mode = 'front', inscribed = false, alpha = 1 })`** →
`{ setTyped(n), crack(i), seal(), dissolve(ms), fizzle(), center, alive }`
- `mode`: `'front'` (facing the viewer), `'ground'` / `'sky'` (flattened: `scale(1, 0.34)`).
- scale-in 0.18 s (0.6 → 1, ease-out) with alpha 0 → 1.
- **Guide ring** (full circle at R, alpha 0.16) so the empty circle is visible from the first key.
- **Rim:** n = `text.length` segments (`rimSegment`). Typed segments are arcs at R (glow + core), freshly carved ones are
  white for 0.15 s. Letters (not spaces) at radius 0.885 R, rotated tangentially (`mid + π/2`), font
  `700 {clamp(2π·0.885R/n·1.15, 7, 15)}px "JetBrains Mono"`, colour highlight; spaces draw a 1.5 px dot. Inner rim ring
  at 0.78 R draws with fraction `min(1, 2p)` (p = typed / n). The rim band rotates at −0.15 rad/s.
- **Seal geometry:** layer j of L draws fraction `clamp((p·(L+1) − j) / 2, 0, 1)`; rotates at `0.25 + 1.2p` rad/s
  (+ seal boost). Centre glow: radial gradient radius 0.32 R, alpha `0.1 + 0.45p`.
- **Tier frame:** tier ≥ 2 — 24 ticks between 1.02 R and 1.08 R, `floor(24p)` shown; tier ≥ 3 — 6 satellite circles
  (r 0.09 R) at 1.2 R, the k-th visible when `p > k/6`, orbiting at 0.3 rad/s; tier 4 — dashed outer ring at 1.32 R
  (dash 6/10) rotating at 0.6 rad/s, alpha p.
- `crack(i)`: a red (`#ff4d5e`) jagged 4-point line across the rim at segment i (persists), shake ±3 px for 0.22 s,
  red tint on the core strokes for 0.15 s.
- `seal()`: 0.3 s white flash on every stroke, scale pulse ×1.12, spin boost +9 rad/s decaying exponentially (rate 3/s).
- `dissolve(ms)`: fades out over `ms` while growing to ×1.15, then dead.
- `fizzle()`: the rim breaks into its segments — each falls with its own velocity (vx ±80, vy −60…0, gravity 600,
  spin ±4) and turns red, letters fall with them; geometry fades in 0.25 s; dead after 0.7 s.
- `inscribed: true` → drawn complete (p = 1) — used for stamped target sigils.

Other drawables (all take `{ x, y, colors, tier, … }`, t = age in s):

| Drawable | Look | Timing |
|----------|------|--------|
| `createStreak({ from, to, color, ms = 90 })` | bright line: head moves from → to in `ms`, tail follows 0.4·`ms` later; small diamond at the head | dead at 1.5·`ms` |
| `createEruption({ x, y, R, colors, tier })` (fire) | `7 + 3·tier` flame tongues standing on the ground sigil: base x ∈ ±0.8 R, height `(60…110)·s`, width `(10…18)·s` (s = `TIER_FX.scale`); quadratic-curve teardrops filled with a vertical gradient (highlight → main → deep, transparent at the tip); tips sway `sin(14t + φ)·0.6w` | rise 0.14 s (ease-out), flicker to 0.35 s, sink + fade to 0.75 s; per-tongue delay 0…0.08 s |
| `createCrystals({ fx, x, y, count, len, colors })` (frost) | `count` elongated hexagonal prisms radiating from the enemy (angles evenly spread ± 0.2 rad jitter, length `len·(0.7…1.2)`, width 0.22·length, starting 10 px out): fill main alpha 0.22, stroke highlight, a facet line base → tip | grow 0.16 s (ease-out); `shatter()` spawns 4 shards along each crystal and kills it; auto-shatter at 0.9 s |
| `createCollapse({ x, y, R, colors, ms, onDone })` (arcane) | triangle, square, hexagon at radii 1.7 R / 1.45 R / 1.2 R contracting to 0 (ease-in t²) while spinning at 3 / −4 / 5 rad/s | `onDone` when finished (`ms`, frozen by hit-stop) |
| `createThorns({ x, y, R, colors, tier })` (nature, damage) | `5 + 2·tier` thin thorns (base 8 px, height `40…90 ·s`) rising from the ground sigil; fill deep → main, stroke highlight | rise 0.1 s, hold to 0.35 s, sink by 0.6 s |
| `createBloom({ x, y, R, colors, tier })` (nature, heal) | `6 + 2·tier` petals (quadratic-curve leaf shapes, length 0.9 R) opening from the bud angle −0.6 rad to their own angle, then drifting up 30 px and fading; tier ≥ 3 adds an inner ring of pink (`colors[2]`) petals at 0.55 length | open 0.3 s, gone at 1.1 s |
| `createBastion({ x, y, R, colors, tier })` (ward) | ring at R + `6` (tier ≥ 3: 8) small hexagonal rune plates (r 0.16 R, a short rune stroke inside) orbiting at 2 rad/s, scaling in; tier ≥ 3 a second counter-rotating plate ring at 1.2 R | scale in 0.2 s, fade 0.7 → 1.0 s |

### 14.5 Audio — `src/ui/audio.js`

> **Superseded by §15 (v1.5 Elemental Voices)** for every spell voice; the instrument recipes below still apply to
> `bell`, `kalimba`, `vibes`, `marimba`, `musicbox` and `pluck`.

Remove `chargeStart`, `chargeSet`, `chargeEnd`, `HUM_GAIN` and `release`. Keep every other method (`key`, `error`,
`heal`, `shield`, … are still used by events, lessons and menus). `cast(school)` becomes an alias of `seal(school, 2)`.

**Instruments** — `play(name, freq, { gain = 1, delay = 0, pan = 0, verb = 0 })`, every voice ends by itself:

| name | recipe (gains before the ×`gain` and treble compensation) |
|------|----------------------------------------------------------|
| `marimba` | sine f (0.4 s, 0.085) + sine 3.9 f (0.08 s, 0.03) + sine 9.2 f click (0.02 s, 0.012) |
| `bell` | FM: carrier f, modulator 3.5 f, index 1.1 (depth = index × modulator Hz) → 0.01 f over 0.6·dur, amplitude 0.45 s, 0.055; + sine 2 f (0.18 s, 0.01) |
| `musicbox` | sine f (0.35 s, 0.05) + sine 2 f (0.25 s, 0.012) + sine 5.02 f (0.06 s, 0.006) |
| `pluck` | Karplus–Strong buffer (`ksBuffer(f)`: ring of `round(sr/f)` samples of soft-picked noise `prev·0.65 + x·0.35`, feedback `0.994·avg`, 0.8 s, cached per rounded Hz, cache cleared above 64 entries) → lowpass 2.5 kHz → gain 0.2 decaying to silence in 0.5 s |
| `kalimba` | sine f (0.45 s, 0.07) + sine 5.95 f tine (0.05 s, 0.02) + triangle f thump (0.03 s, 0.02) |
| `vibes` | sine f (0.45 s, 0.06) through a 5.5 Hz tremolo (gain 0.75 ± 0.25) + sine 4 f (0.15 s, 0.012) |

Decays are deliberately short: the first draft (bell 1.1 s, vibes 1.0 s) piled up at 80 WPM into a ringing wash that
measured *louder* between keystrokes than the v1.2 drone. Rule of thumb: a note must fall ≥ 18 dB before the next key at
80 WPM (150 ms).

Treble compensation for every note: `× clamp((700 / f) ** 0.35, 0.55, 1.15)`.

| Method | Recipe |
|--------|--------|
| `spellNote(school, tier, i, n, comboIndex)` | f = root · 2^(scaleSemitone(scale, melodyStep(i, n, tier))/12); `play(instrument, f, { pan: −0.3, verb: 0.1 })`. comboIndex ≥ 2: + harmony at step + 2 (gain 0.35); ≥ 4: + musicbox sparkle at min(2 f, 1800 Hz) (gain 0.25). Tier ≥ 3 and `i % 4 === 0`: + root an octave down (gain 0.3) — a heartbeat under long casts. Rate limit 12 ms of **audio-context time** (`ctx.currentTime`, not `performance.now()`, so offline renders keep every note). |
| `spellMisnote(school, tier, i, n)` | the would-be note a semitone flat (gain 0.7) + thud sine 120→60 (0.12 s, 0.07) + scrape bandpass noise 900 Hz q 2 (0.08 s, 0.025). |
| `spellFizzle(school)` | scale steps 4, 2, 0 played at ×0.97 (a quarter-tone flat), 70 ms apart (gain 0.6) + lowpass noise puff 800→200 Hz (0.3 s, 0.04). |
| `seal(school, tier, { perfect })` | chord `sealChord` strummed 30 ms apart at the root (×2 if root < 250 Hz), gain 0.8·k (k = `TIER_FX.sound`) + the root itself (gain 0.6) + air: bandpass noise 600→2400 Hz, attack 40 %, 0.3 s, 0.03. `perfect`: 2 musicbox sparkles at 2× the top chord note (halved until ≤ 1800 Hz) and 1.5× that, +120 / +160 ms. |
| `impact(school, tier, { intensity, crit, lethal })` | k = min(1.4, 0.6 + 0.4·I). fire: taiko sine 140→46 (0.35 s, 0.22k) + lowpass noise 2200→160 (0.22 s, 0.12k) + marimba root + crackle ×6 (0.04). frost: 8 glass ticks (0.045) + musicbox at 2·root and 3·root (0.9) + thud 150→60 (0.18 s, 0.19k). storm: highpass crack (0.04 s, 0.2k) + rumble lowpass 500→60 (0.8 + 0.2·tier s, 0.18k, verb 0.4) + sub 90→40 (0.3 s, 0.12k) + pluck root, 1.5·root (0.8). arcane: gong FM(root/2, ratio 1.4, index 3, 1.6 s, 0.09k) + sub 160→48 (0.3 s, 0.16k) + bandpass sweep 1800→300 q 6 (0.25 s, 0.06k). nature: kalimba root/2 (0.8) + sub 150→70 (0.15 s, 0.1k) + rustle highpass noise (0.25 s, 0.025). crit: FM bell 4·root (ratio 3.5, index 1.5, 0.8 s, 0.035) + musicbox 6·root (0.4). tier 4: the instrument plays root/2, root, 1.5 root, 2 root 25 ms apart (0.8) + boom sub 55→24 (1.0 s, 0.18) + lowpass noise 1200→50 (1.3 s, 0.09, verb 0.6). lethal: **cadence** — the instrument plays root, step 2, step 4, step 5 (octave) 60 ms apart (0.9, verb 0.5) + sub 60→28 (0.9 s, 0.16). |

### 14.6 Choreography — `src/ui/fx/spellFx.js` (rewrite, same public interface + 2 methods)

`createSpellFx(game)` → `{ beginCharge, keystroke, misstep, chargeProgress, chargeJolt, endCharge, cast, echo, shatter, tick, charging }`.

- **Caster sigil position:** `casterAt(hand, R) = { x: hand.x + R + 24, y: hand.y − 4 }`, R = `TIER_FX[tier].sigilR`.
- `beginCharge({ school, tier, text, hand })` → new front sigil (replaces a running one, which dissolves in 120 ms);
  tier IV also `fx.setVignette(0.12)`.
- `keystroke({ index, length, comboIndex })` → `sigil.setTyped(index + 1)`; `audio.spellNote(...)` **except for the last
  letter** (the seal chord plays instead); tier IV vignette `0.12 + 0.3·p`.
- `misstep(index)` → `sigil.crack(index)` + `audio.spellMisnote(...)`. `chargeJolt()` = visual-only `crack` of the current index.
- `chargeProgress(p)` → silent `setTyped(round(p·n))` (used when a pause resumes a cast).
- `endCharge(reason)`: `'release'` keeps the sigil for `cast()`; `'fizzle'` → `sigil.fizzle()` + `audio.spellFizzle`;
  `'cancel'` → `dissolve(250)`; `'abort'` → `dissolve(150)`. Vignette back to 0 except on release.
- `cast({ card, result, hand, playerAt, enemyAt, playerSprite, enemySprite, hits, lethal, dmgFrac, comboIndex, onImpact })`:

| t (ms) | everything | damage spells (`hits`) |
|--------|-----------|-------------------------|
| 0 | caster sigil `seal()` (an inscribed one is created if there is none), `audio.seal`, wizard `.thrust`, flare at the sigil (highlight, 30·scale, grow 2); perfect: 10 gold rays at the sigil; tier IV: rite name banner | streak from the sigil centre to the school's **anchor** (90 ms) |
| 0 | heal → ground sigil under the player (inscribed, R·1.1, dissolves after 0.6 s) + `createBloom` + 20 + 10·tier rising motes + `.fx-heal`; shield → `createBastion` around the player (R = 0.75 × sprite height) + front sigil at the player (inscribed, alpha 0.5) | |
| 160 | caster sigil `dissolve(260)` | |
| 90 | | **stamp** the target sigil (inscribed, 1.6 → 1 scale-in) and start the manifestation (below) |
| 90 + m | | **land**: impact juice (v1.2 `impactFx`: hit-stop, flash, shake, kick, punch, flare, school particles, tint, crit rays) + `audio.impact` + target sigil `seal()` then `dissolve(300)` + `onImpact(profile)`; tier IV vignette → 0 after `hitstopMs + 350` |

| school | anchor & target sigil | manifestation (m = time to land) |
|--------|----------------------|----------------------------------|
| fire | enemy feet (centre + 0.42 × sprite height), `ground`, R·1.1 | `createEruption`, m = 140. Rite *Sunfall*: + `sky` sigil 170 px above the enemy and a fire `pillar` (width 70) at the stamp; tongues ×1.5 |
| frost | enemy centre, `front`, R·1.2, alpha 0.7 | `createCrystals` (count `6 + 2·tier`, len `40 + 15·tier`), m = 160; crystals `shatter()` 30 ms after land (after hit-stop). Rite *Absolute Zero*: count 14, `setVignette(0.35, '#0b2a44')`, flash `#bfefff` |
| storm | 145 px above the enemy (never above y = 80), `sky`, R | m = 60: lightning sky sigil → enemy (width 3 + tier, branches 1 + tier) + ring at the feet. Tier III: 2 decorative sky sigils (R·0.6) at x ± 90 with bolts at +100 / +140 ms. Rite *Wrath of the Skies*: 3 sky sigils, 4 bolts 70 ms apart, the big bolt at m = 280 |
| arcane | enemy centre, `front`, R | `createCollapse` (`ms` 180; rite *Singularity* 300 with `setVignette(0.5)` and 40 inward motes) → land |
| nature | enemy feet, `ground` | `createThorns`, m = 100 |

- `echo({ from, to, onImpact })`: pale (`['#e9e0ff', '#ffffff', '#b48cff']`) streak + tier-I arcane stamp + collapse (120 ms) → tier-I impact.
- `shatter(at, colors)` and `tick(dt, { burning, enemyAt })` as in v1.2.

### 14.7 Combat screen wiring — `src/ui/screens/combatScreen.js`

- `castStart`: remove the ring at the player and `audio.castStart()`; call `spell.beginCharge({ school, tier, text: card.text, hand })`.
- `keyCorrect`: `spell.keystroke({ index: ev.index, length: card.text.length, comboIndex: tierOf(ev.combo).index })`
  instead of `spell.chargeProgress` + `audio.key` (the spell plays its own note).
- `keyError`: `spell.misstep(ev.index)` instead of `audio.error()` + `spell.chargeJolt()`.
- `fizzle`: drop `audio.fizzle()` and the red burst at the player (the sigil collapse and `spellFizzle` replace them).
- `onCastComplete`: drop `collectGlyphs` and the `glyphs` argument.
- Both pause-resume paths pass `text: card.text` to `beginCharge`.

CSS: `.ward-dome::before` — a dashed rune ring (`border: 1.5px dashed`, inset 6 %, rotating 14 s linear) so the lasting
ward matches the sigil look.

### 14.8 Milestones

| # | Work | Acceptance |
|---|------|-----------|
| M36 | data + logic + tests (§14.1–14.2) | `npm test` green |
| M37 | `color.js`, particles clean-up + layers, `sigils.js` (§14.3–14.4) | title screen loads without console errors |
| M38 | audio instruments and spell voices (§14.5) | offline render of 12 keystrokes at 80 WPM: the six schools measurably different (brightness spread ≥ 0.1), every note falls ≥ 18 dB before the next key and the level between keys is no higher than v1.2's drone floor (≈ −47 dB); no peak above −6 dBFS |
| M39 | `spellFx.js` rewrite + combat wiring + CSS (§14.6–14.7) | every school × tier I/III/IV casts in the browser; no stuck sigil after cancel, fizzle, pause or victory |
| M40 | docs, pitfalls | this section matches the code |

#### v1.4 manual QA checklist
- [ ] The first key draws a faint circle; each letter carves a rim segment and appears on the rim; the geometry fills in.
- [ ] Each school is recognisable with eyes closed: low marimba / music box / plucked string / bell / kalimba / vibraphone.
- [ ] Typing never produces a sustained tone; a mistake sounds "wrong" without buzzing; fizzle sounds like the song falling apart.
- [ ] Release strums a chord; the sigil seals, streaks to the foe and stamps; the manifestation matches the school.
- [ ] Rites: name banner, unique cinematic, big chord. Killing blows end on a resolving cadence.

### 14.9 Measured result (offline render, volume 0.6, 12 keystrokes at 80 WPM)

| | v1.2 (drone + triangle melody) | v1.4 (instruments) |
|---|---|---|
| brightness (RMS of first difference / RMS) | 0.126 – 0.155, all six schools alike | 0.051 (fire) … 0.252 (storm) |
| peak → level just before the next key | 20 – 22 dB, but the floor is a **continuous** sawtooth drone | 19.5 – 29 dB of natural note decay |
| level just before the next key | −46.5 … −48 dB | −47.8 … −54.5 dB |
| loudest event (tier IV + crit + lethal impact) | peak −16 dBFS | peak −16.2 dBFS |

Typical tier-II impacts match the old `hit(true)` (loudest 300 ms ≈ −41 dB) for fire and arcane; frost (glassy) and storm
sit a few dB lower in RMS by design. `scratchpad/tour.mjs`-style rendering (OfflineAudioContext + `suspend()` at each
keystroke time) is the way to audition changes — it can write a WAV of a whole cast sequence.

### 14.10 Pitfalls found while building v1.4

1. **Scales must stay inside one octave.** Ward's first scale ended on 14 (a ninth); octave wrapping then went *down*
   (step 5 = 12 < 14) and the seal chord was not ascending. Tests now require every scale value < 12.
2. **Rate-limit notes on the audio clock.** A `performance.now()` limiter silently dropped most notes in offline renders
   (the render runs faster than real time), which made measurements lie.
3. **Long-decay instruments recreate the drone.** See §14.5 — measure the level between keystrokes, not just peaks.
4. **Don't apply the ground/sky squash with `ctx.scale`** for line art: the pen squashes too and horizontal strokes go
   thin. Sigils map points through their own `P(ux, uy)` (squash applied to coordinates); only rim *text* is drawn under a
   scaled transform.
5. **`endCharge('release')` must not dissolve the sigil** — `cast()` needs it to seal and to know where the streak starts.
   A stale released sigil (no `cast()` followed) is dissolved by the next `beginCharge`.
6. **Layers are frozen by hit-stop** like particles, so manifestation callbacks (`createCollapse.onDone`) and crystal
   shattering happen in FX time; the crystals hold through the freeze-frame and shatter right after it.
7. **Headless frame times are not a performance signal.** Measure `fx.update + fx.draw` directly: one sigil being
   inscribed ≈ 0.3 ms, the worst rite landing (4 sigils + eruption + crystals + collapse + 300 particles) ≈ 1.4 ms.

**Status: implemented** (M36–M40). 116 tests.

---

## 15. v1.5 — Elemental Voices (spell sound design overhaul)

**Why:** v1.4 made the schools *musically* different but none of them sounded like its element. A lightning spell was a
plucked string plus a click; fire was a marimba. Measured on the v1.4 build with the §15.9 lab: almost no noise texture
(fire impact flatness 0.11), the storm impact's first 60 ms had only 9 % of its energy above 2.5 kHz (a thunder crack
lives there), keystrokes were as loud to the ear as impacts (no mix hierarchy), and the keystroke notes rang into each
other (only 11.5–16.7 dB of decay before the next key at 80 WPM). v1.5 keeps the sigil visuals and the keystroke melody
but rebuilds every spell sound from the **sound of its element**, the way action-game spell SFX are built.

### 15.0 Sound design principles (apply to every recipe below)

1. **Element first, music second.** Each school is built from its element's material: storm = electricity (sparks,
   arcing buzz, thunder crack + tearing rip + rumble); fire = combustion (breathy whoosh, roar, ember crackle, blast);
   frost = ice (glass pings, crunchy cracks, crystallising swish, shatter); arcane = raw energy (shimmer dust, pitch
   warps, implosion, gong); nature = wood and leaves (snaps, creaks, rustle, earthy thud); ward = barrier (deep "thoom",
   ringing metal plate, rising shimmer). Exaggerate: game sounds are hyper-real, not realistic. The melody note stays as a
   quieter *pitched core* inside each keystroke (gain `CORE[school]`) so the charge still audibly climbs.
2. **Layer every big sound** — *transient* (first 5–35 ms, makes it read), *body* (the element), *low end* (weight,
   impacts only), *tail* (what lingers: embers, rumble, tinkling shards, static), *sweetener* (crit, perfect). Each layer
   gets its own frequency slot. The transient is the loudest moment: no tail element may out-peak the hit.
3. **Anticipation → release → impact → tail.** Every damage spell plays four beats in sync with the visuals: keystrokes
   charge (louder and brighter as the incantation fills), `seal` releases (with a travel whoosh panned caster → target),
   `manifest` swells while the school's manifestation grows at the target and ends exactly on the hit, `impact` lands
   on the visual hit; frost's shatter waits for the hit-stop like the crystals do; every extra storm bolt has its own clap.
4. **Proportional feedback.** Tier adds layers and lengthens the rip, the thunder and the roar; damage intensity scales
   the body (`k`); combo adds harmony and sparkle to keystrokes. A cantrip is a snap, a Forbidden Rite is an event.
5. **Universal signals stay universal.** The crit "shing" (fixed pitch), the mistake thud and the killing-blow cadence
   sound the same in every school so players learn them once; only the element layers change.
6. **Variation against repetition fatigue.** Keystrokes play hundreds of times a minute: every foley layer picks one of 4
   pre-rendered texture variants (never the same one twice in a row), with ±8 % playback rate, ±1.5 dB gain and ±0.06
   pan jitter. Melody notes stay in tune. Bigger textures also use 4 variants plus rate/filter differences.
7. **Mix hierarchy and ducking.** Measured A-weighted loudness: keystrokes ≈ −42, releases ≈ −40, impacts ≈ −36, rites ≈
   −24 (lab dB). Keystrokes go to their own `keys` bus; a tier ≥ 2 impact ducks it −8 dB (hold 0.25 s, release 0.35 s)
   so the hit reads while the player already types the next spell; a rite ducks it −14 dB from the build-up until 0.4 s
   after the hit ("the breath before the hit"). Overlapping ducks merge (deeper level, later end).
8. **Comfort rules from §14 still hold:** no drones (every voice ends ≤ 2.5 s, keystroke and mistake voices ≤ 0.35 s), no
   audible raw sawtooth/square oscillators (the electric buzz is noise gated by an inaudible square modulator), soft
   treble for pitched notes, keystrokes fall ≥ 15 dB before the next key at 80 WPM, nothing above −6 dBFS.
9. **Translate to small speakers.** Laptop speakers can't play the 30–80 Hz sub, so every boom also has a body between
   150 and 700 Hz (driven noise, the rumble low-passed at 650 Hz, the roar at 1.1 kHz) — and loudness is judged
   A-weighted, never by raw energy (a 40 Hz sine "measures" loud and is barely heard).

### 15.1 Architecture

| File | Contents |
|------|----------|
| `src/ui/sound/textures.js` (new, DOM-free, Node-tested) | procedural sample generators → `Float32Array` (§15.2) |
| `src/ui/sound/spellVoices.js` (new) | `TEXTURE_SPECS`, `CORE`, `TRAVEL`, `createSpellVoices(kit)` → `{ spellNote, spellMisnote, spellFizzle, seal, manifest, impact, bolt, shatter }` (§15.4–15.6). Each school is an object `{ key(p, f), choke(f), fizzle(root), release(k, tier, root), build(d, tier), impact(k, tier, shatterAt, root), rite(k, root) }` |
| `src/ui/audio.js` | engine: context, buses, primitives (`tone`, `noise` (+ `drive`, `panTo`), `fm` (+ `fFrom`/`glide`, `fTo`, `indexEnd`), `buf`, `buzz`, `duck`), texture cache (`tex`, `variant`, idle `prewarm`), instruments (`play(name, f, { short })`), menu/event sounds (unchanged); spreads the spell voices into its public object; `get buses` for QA |
| `src/data/spellFx.js` | `instrument`: storm `zap`, fire `flame`, frost `glass` (others unchanged); `INSTRUMENTS = ['bell', 'flame', 'glass', 'zap', 'kalimba', 'vibes']` |
| `src/ui/fx/spellFx.js` | `seal(…, { perfect, hits })`; `manifest(school, tier, manifestMs(school, rite))` when the target sigil is stamped (echo: `manifest('arcane', 1, 120)`); `impact(…, { hitstopMs: profile.hitstopMs })`; `bolt()` for each extra storm bolt (tier III side bolts: intensity 0.4; rite volley: 0.6) |
| `tools/audio-lab/` | the measurement lab and the in-game QA script (§15.9) |

Signal chain: voice → (panner, optionally moving) → bus → `master` → compressor → destination, plus an optional reverb
send. Buses: `keys` (keystrokes, mistakes) and `spell` (everything else from the spell voices); menu sounds go straight
to `master`. Reverb: the v1.4 convolver (2.2 s generated impulse, return gain 0.32). `buzz(o)` = looping noise →
bandpass (f0 → f1, Q) → gate gain (0.5 ± 0.5 from a square LFO at `rate` Hz) → envelope. `buf(b, o)` = buffer source
(`rate`) → filters (each `{ type, f0, f1?, q? }`) → optional tanh shaper (`drive`) → gain (`attack`; optional `dur` cut
with an exponential fade). Textures render lazily per `TEXTURE_SPECS` key; after `unlock()` (real context only) the first
variant of every key is pre-rendered one per 30 ms so the first rite never stutters.

### 15.2 Textures — `src/ui/sound/textures.js`

Every generator takes `sr` and an options object with `rand` (default `Math.random`; tests pass a seeded `createRng().next`),
returns a `Float32Array` normalised to peak 1 with the last 4 ms faded to exactly 0.

| Function | Algorithm |
|----------|-----------|
| `crackle(sr, { dur, rate, decay, minMs = 0.3, maxMs = 2.5, first = false, skew = 3 })` | Poisson clicks: at each sample a click starts with probability `rate·e^(−t/decay)/sr`. Click = white noise × `e^(−5k/L)` over L samples (L ∈ [minMs, maxMs]), amplitude `u^skew` with random sign (`skew` 3 = many faint, few loud — embers; ~1.3 = evenly loud — a dense tearing rip). `first` = a full-scale click at sample 0 (a guaranteed transient). |
| `brown(sr, { dur })` | leaky integrated white noise `y = 0.985·y + 0.12·w`. |
| `rumble(sr, { dur, rolls = 3 })` | brown × sum of `rolls` swells (first at 0 with amplitude 1, others at `dur·[0.12, 0.6]`, amplitude 0.35–0.8; each rises linearly over 40–120 ms then decays `e^(−t/τ)`, τ = 0.18–0.45·dur) × flutter (smoothed random 0.85–1.15) × `(1 − t/dur)`. |
| `roar(sr, { dur })` | 0.75·brown + 0.25·white, × flicker (smoothed random target every 25–60 ms, 0.45…1) × (attack 25 ms, then `e^(−t/(0.4·dur))`) × `(1 − t/dur)²` (taper — without it the tail is audibly cut). |
| `grains(sr, { dur, count, fLo, fHi, dLo, dHi })` | sine grains, frequency log-uniform in [fLo, fHi], start `dur·u^1.6`, 1 ms attack, decay `e^(−t/d)`, d ∈ [dLo, dHi], amplitude `(0.35…1)·√(1000/f)·(1 − 0.85·start/dur)`, plus a 2.76× partial at 0.25 decaying 2.5× faster. |
| `creak(sr, { dur, f0, f1 })` | click train gliding f0 → f1 clicks/s (±15 % jitter per period), 1 ms decaying noise clicks under a `sin(πt/dur)` arch. |

### 15.3 Pitched cores (`SCHOOL_FX.instrument`) and `CORE`

Roots, scales, `melodyStep` and `sealChord` are unchanged from §14. `play(name, f, { short })`: `short` (keystrokes,
mistakes, combo layers) shortens decays to 65 % and drops the faint extra partials of `bell` (2 f) and `glass` (4.25 f).

| school | instrument | recipe (gains before `×gain` and treble compensation) | `CORE` |
|--------|-----------|------------------------------------------------------|-------|
| storm | `zap` | FM: carrier glides 1.6 f → f in 18 ms, modulator 0.5 f, index 3 → 0.4 over 60 % of the note; 0.12 s, 0.05 | 0.9 |
| fire | `flame` | white noise → bandpass 2 f, Q 7, 0.3, attack 8 ms, 0.15 s (a pitched "fwup") + sine f 0.03, 0.12 s | 1.4 |
| frost | `glass` | sines f (0.05, 0.32 s), 2.32 f (0.016, 0.12 s), 4.25 f (0.006, 0.05 s) | 0.8 |
| arcane | `bell` | v1.4 FM bell | 0.42 |
| nature | `kalimba` | v1.4 kalimba | 0.42 |
| ward | `vibes` | v1.4 vibes (oscillators stop with the envelope) | 0.6 |

Old names (`marimba`, `musicbox`, `pluck`) still work in `play()`.

### 15.4 Keystrokes, mistakes, fizzles

`p = (i + 1)/n`. Keystroke = pitched core (`CORE` gain, short; combo ≥ 2 harmony at step + 2 × 0.35; combo ≥ 4 `glass`
sparkle at min(2 f, 1800 Hz) × 0.22; tier ≥ 3 and `i % 4 === 0` heartbeat at root/2 × 0.3) **plus the element foley**
with gain × `(0.6 + 0.4p)`, filter × `(0.75 + 0.5p)` and §15.0.6 jitter, all on bus `keys`. Mistake = the would-be note a
semitone flat (0.6, short) + universal thud sine 120 → 60 Hz (0.12 s, 0.05) + the element choke (bus `keys`).
Fizzle = scale steps 4, 2, 0 at ×0.97, 70 ms apart (0.5) + lowpass puff 800 → 200 Hz (0.3 s, 0.04) + the element dying.

| school | keystroke foley | choke (mistake) | dying (fizzle) |
|--------|-----------------|-----------------|----------------|
| storm | `spark` (crackle 60 ms, rate 900, decay 15 ms, first, skew 2) 0.12 → highpass 2 kHz | `spark` 0.2 → highpass 1.5 kHz + `buzz` 0.1 s, 60 Hz, 1.1 kHz, 0.2 | `sputter` (crackle 0.45 s, rate 260) 0.2 → highpass 2 kHz + `buzz` 0.35 s, 70 Hz, 900 → 150 Hz, 0.04 |
| fire | `ember` (crackle 40 ms, rate 160, first) 0.28 → bandpass 2.4 kHz Q 0.8, 0–25 ms late | lowpass puffs 900 Hz (0.06 s, 0.16) and 700 Hz (+50 ms, 0.11) | hiss bandpass 2.5 → 1.2 kHz Q 0.8 (0.45 s, 0.09) + `dying` embers 0.25 |
| frost | `iceTick` (crackle 25 ms, rate 500, first) 0.1 → highpass 4.5 kHz | `crunch` (crackle 50 ms, rate 1500) 0.3 → lowpass 2.5 kHz | `crumble` (crackle 0.35 s, rate 500) 0.22 → lowpass 3 kHz |
| arcane | `dust` (4 grains 2–4.5 kHz) 0.035 + whisper bandpass 1.2 → 2.4 kHz Q 4 (80 ms, attack 60 ms, 0.012) | FM bell bending down 6 % (0.25 s, 0.07) | FM bell gliding root → root/2 (0.5 s, 0.05) |
| nature | `rustle` (crackle 70 ms, rate 700, skew 2) 0.22 → bandpass 3.5 kHz Q 0.6 | `snap` 0.7 → bandpass 1.2 kHz Q 3 | `wilt` (creak 45 → 25) 0.2 → bandpass 800 Hz + `rustleLong` 0.1 |
| ward | plate clink FM at min(3 f, 2.5 kHz), ratio 1.41, index 0.9, 70 ms, 0.035 | clank FM 220 Hz, ratio 1, index 3, 80 ms, 0.1 | `crack` 0.2 → highpass 3 kHz |

### 15.5 Release — `seal(school, tier, { perfect, hits })` (bus `spell`, panned to the caster)

`k = TIER_FX[tier].sound`; the element layers use `kr = 1.33·k` (≈ +2.5 dB, so the release sits between keystrokes and
impact). Chord strum (v1.4 `sealChord`) at `0.55·CORE·k`, 30 ms apart, plus the root at `0.4·CORE·k`. When `hits`, a
travel whoosh (`TRAVEL[school]` = filter type, f0 → f1, Q, gain × kr; 0.14 s, attack 70 ms, +20 ms) pans −0.35 → +0.35
in 0.12 s: storm highpass 3 → 1.5 kHz 0.05; fire lowpass 0.6 → 2.4 kHz 0.08; frost highpass 5 → 2.5 kHz 0.04; arcane
bandpass 1.5 → 3 kHz Q 2 0.08; nature bandpass 0.9 → 3.2 kHz Q 2 0.08. `perfect`: two `glass` sparkles at the top chord
note ×2 (halved until ≤ 1800 Hz) and ×1.5, +120 / +160 ms.

| school | element layers (gains × kr unless fixed) |
|--------|----------------|
| storm | `crack` (crackle 30 ms, rate 3000, first) 0.1 → highpass 1.5 kHz + arc `buzz` (0.14 + 0.03·tier s, 95 Hz, 1.8 → 0.9 kHz, Q 2.5) 0.4 + FM zap sweep 1.8 kHz → 220 Hz (ratio 0.5, index 3 → 0.5, 0.12 s) 0.1 |
| fire | ignition thump sine 110 → 50 Hz (0.18 s) 0.12 + whoosh lowpass 400 → 3200 Hz Q 1 (0.28 s, attack 0.12 s) 0.2 + `roarShort` (0.35 s) 0.16 → lowpass 1.4 kHz + `embers` (cut at 0.5 s) 0.1 fixed |
| frost | freezing swish highpass 7 → 2.5 kHz (0.22 s, attack 80 ms) 0.045 + `crystals` (10 grains 1.5–4.5 kHz) 0.035 + `iceTick` 0.05 fixed |
| arcane | pop sine 900 → 350 Hz (80 ms) 0.08 + swirl bandpass 1.8 → 0.7 kHz Q 5 (0.3 s) 0.1 + `dust` 0.06 |
| nature | vine whip bandpass 0.9 → 3.2 kHz Q 2 (0.16 s, attack 0.11 s) 0.16 + `creakWood` (40 → 70) 0.35 → bandpass 900 Hz Q 3 + `rustleLong` 0.22 fixed + heal-bloom shimmer bandpass 2 → 4.5 kHz Q 3 (0.5 s, attack 0.3 s) 0.025 fixed |
| ward | barrier thoom sine 75 → 52 Hz (0.5 s, attack 15 ms) 0.16 + lowpass 350 Hz noise (0.2 s) 0.06 + metal plate FM 2·root (ratio 1.41, index 1.6, 0.9 s) 0.05 + its 2.76× partial (≤ 2.5 kHz, 0.5 s) 0.015 + rising shimmer bandpass 1.8 → 6 kHz Q 4 (0.35 s, attack 0.24 s) 0.035 |

### 15.6 Build-up and impact (bus `spell`, panned to the target)

`manifest(school, tier, ms)` (d = ms/1000; ms: fire 140, frost 160, storm 60 / rite 280, arcane 180 / rite 300,
nature 100): storm — `buzz` (d, 120 Hz, 2.5 kHz, attack 0.9 d) 0.03 + a `spark` at d/2; fire — lowpass noise 150 →
600 Hz, attack 0.9 d, 0.08; frost — `growth` (creak 50 → 140) 0.12 → bandpass 3 kHz + bandpass noise 2.5 → 6 kHz
swell 0.03; arcane — suction bandpass 3 kHz → 400 Hz Q 3 swell 0.07 + sine 900 → 120 Hz 0.03; nature — `creakThorn`
0.15 → bandpass 700 Hz + `rustle` at 0.4 d. Tier IV adds a reverse swell (lowpass noise 300 → 4000 Hz, attack 0.92 d,
0.1) + sine 40 → 60 Hz (0.05) and ducks `keys` −14 dB until d + 0.4 s.

`impact(school, tier, { intensity, crit, lethal, hitstopMs })`, `k = min(1.5, 0.6 + 0.45·intensity)`; tier ≥ 2 ducks
`keys` −8 dB. `shatterAt = hitstopMs/1000 + 0.03`.

| school | layers (gains × k unless fixed) |
|--------|--------|
| storm (thunderbolt) | crack: highpass 700 Hz noise 35 ms 0.3 · rip: `rip` (crackle 0.34 s, rate 3000, decay 0.14 s, skew 1.3), cut at 0.24 + 0.04·tier s, highpass 500 + lowpass 7 kHz, 0.45 · arc `buzz` 0.14 s, 110 Hz, 1.4 kHz 0.08 · boom sine 85 → 32 Hz 0.35 s 0.11 · driven body lowpass 700 → 160 Hz, drive 2, 0.14 s 0.12 · thunder `thunder{tier}` (rumble 0.9 + 0.25·tier s, 2 rolls, 4 at tier ≥ 3) +90 ms, lowpass 650 Hz 0.13 · two `sizzle` static tails (crackle 0.6 s, rate 70) 0.16 fixed, highpass 3.5 kHz, +50 / +150 ms, scattered pans |
| fire (eruption) | thump sine 140 → 40 Hz 0.32 s 0.2 · blast lowpass 5 kHz → 250 Hz, attack 2 ms, drive 3, 0.3 s 0.2 · `roar{tier}` (0.7 + 0.15·tier s) attack 40 ms, lowpass 1.1 kHz 0.22 · `embers` (crackle 0.9 s, rate 45) 0.16 / 0.12 fixed at +50 / +150 ms, bandpass 2.6 kHz, scattered |
| frost (crystallise → shatter) | `crack` at ×1.2 rate, highpass 3 kHz 0.35 · thud sine 160 → 60 Hz 0.2 s 0.22 · swish bandpass 2.5 → 7 kHz 0.12 s 0.05 · **at shatterAt**: `shards{tier}` (14 + 4·tier grains 1.2–5 kHz) 0.09 + highpass 4 kHz burst 60 ms 0.08 · `tinkles` +0.1 s highpass 5 kHz 0.08 fixed |
| arcane (collapse) | warp: sines 1400 → 110 Hz and 1405 → 111 Hz (0.18 s) 0.06 each, panned ±0.1 · boom sine 150 → 40 Hz 0.35 s 0.2 · gong FM root/2 (ratio 1.4, index 3, 1.1 s) 0.08 · burst bandpass 2.4 kHz → 300 Hz Q 5 0.25 s 0.08 · `dustLong` (18 grains 2–5.5 kHz) 0.07 fixed |
| nature (thorns) | three `snap`s (1.2, 0.95, 0.7) at 0 / 25 / 55 ms, bandpass 1.6 kHz · 4 stabs highpass 2.5 kHz 30 ms 0.16 within 80 ms · thorn burst bandpass 1 → 2.6 kHz 0.12 s 0.22 · thud sine 120 → 48 Hz 0.25 s 0.22 + lowpass 700 Hz noise 0.07 · `creakThorn` 0.3 fixed · `rustleLong` 0.35 fixed |
| ward | never hits; falls back to `hit(false)` |
| crit (all) | FM 1568 Hz (ratio 3.5, index 1.5, 0.6 s) 0.035 + bandpass 5 kHz Q 6 noise 0.12 s 0.04 + `glass` 2093 Hz 0.4 at +40 ms |
| tier IV | storm: bright `rip` (bandpass 3 kHz) 0.4 at +120 ms + three `sizzle`s 0.3 + far `thunder4` (lowpass 500, pan −0.2) 0.16 at +450 ms · fire: sub 55 → 22 Hz 1 s 0.12 + `embers` 0.3 + `bigRoar` (1.6 s) lowpass 900 Hz 0.4 + lowpass noise 1500 → 60 Hz 1.3 s 0.09 · frost: `groan` (creak 18 → 9) bandpass 400 Hz 0.25 + `crack` at half speed, lowpass 1.8 kHz 0.45 + freezing `rip` at ×1.4, highpass 2.5 kHz 0.3 + `crumble` +250 ms 0.3 · arcane: sub 45 → 20 Hz 1.2 s 0.14 + chorused sweep 2.2 kHz → 60 Hz (0.45 s) + gong FM root/4 (index 4, 1.6 s) 0.08 + `dustLong` +0.3 s 0.15 · nature: `quake` (rumble 1.4 s) lowpass 180 Hz 0.35 + five `snap`s 0.3 |
| lethal (all) | cadence: steps 0, 2, 4, 5 on the pitched core, 60 ms apart (0.8, verb 0.5) + sub 60 → 28 Hz 0.9 s 0.1 |

`bolt({ intensity = 0.6, pan = 0.35 })`, `k = 0.5 + 0.5·intensity`: highpass 1 kHz crack 25 ms 0.25 + `boltRip` (crackle
0.16 s) bandpass 2.4 kHz 0.4 + `boltRumble` (rumble 0.6 s, 1 roll) lowpass 300 Hz 0.25 at +30 ms. `shatter()` (barrier or
ward break, centred): `crack` ×1.2 highpass 3.5 kHz 0.16 + thud 140 → 60 Hz 0.1 + `shards2` 0.06 + `tinkles` 0.12.

### 15.7 Tests (124 total)

- `tests/soundTextures.test.js`: each generator returns `round(dur·sr)` samples, peak exactly 1, a linear fade over the
  last 4 ms ending at exactly 0 (not −0), deterministic for a seeded `rand` and different between seeds; `crackle` is
  denser in its first quarter than in its last; `rumble`, `roar`, `grains` decay.
- `tests/audio.test.js`: a recording mock `AudioContext` (sources record start/stop; `AudioParam` rejects exponential
  ramps to ≤ 0 like the real one). For every school × tier: `spellNote`, `spellMisnote`, `spellFizzle`, `seal`,
  `manifest`, `impact` (crit + lethal), plus `bolt` and `shatter`: they make sound (ward's sub-rite build-up is
  allowed to be silent); every source stops ≤ 2.5 s after it starts and keystroke/mistake sources ≤ 0.35 s; no
  sawtooth/square oscillator reaches the destination except through an `AudioParam`; a worst-case keystroke (tier IV
  heartbeat + top combo) creates ≤ 40 nodes; after a rite build-up and its impact the `keys` bus automates back to 1 and
  dipped below 0.25.

### 15.8 Milestones

| # | Work | Acceptance |
|---|------|-----------|
| M41 | textures + tests (§15.2, §15.7) | `npm test` green |
| M42 | engine: buses, `buf`, `buzz`, `duck`, texture cache, instruments (§15.1, §15.3) | menu sounds unchanged; lab renders without errors |
| M43 | spell voices (§15.4–15.6) + choreography hooks | lab targets in §15.9 met; `tools/audio-lab/qa-spells.mjs` shows seal → manifest → impact (+ bolts) for every school × tier with no page errors |
| M44 | audio tests, audition WAVs (`audition/`), docs | `npm test` green; this section matches the code |

**Status: implemented** (M41–M44).

### 15.9 Lab, acceptance targets and measured result

`tools/audio-lab/lab.mjs <scenes> <outdir> [filter]` renders scenes in an `OfflineAudioContext` inside headless Chromium
(dev server on 5199), writes game-level and normalised WAVs, a `sox` spectrogram per scene and `metrics.json`.
`scenes.mjs` = isolated sounds per school (keystroke run at 80 WPM, seal, misnote, fizzle, impact t1/t2, rite =
manifest + tier IV crit lethal impact) and full casts timed like `spellFx.js`; `scenes-audition.mjs` = the audition
files. `qa-spells.mjs` casts every school × tier (with a mistake) in real practice combat and logs the audio calls.
Metrics: peak, loudest 300 ms RMS, **A-weighted loudness** of the loudest 300 ms, attack/ring, spectral centroid,
**local flatness** (geometric/arithmetic mean inside each octave 125 Hz–8 kHz, energy-weighted: 0 = tones, → 1 = noise —
whole-spectrum flatness calls any low-passed noise "tonal"), crest, energy and A-weighted band shares, keystroke floor/drop,
and a **texture** profile: per-region flatness (low/mid/high) and the modulation spectrum of a 1 ms envelope (2–12, 12–40,
40–160, 160–500 Hz: flicker, creak, buzz, crackle). Distinctness = min Euclidean distance between schools over A-weighted
band shares, A-weighted centroid, flatness, crest and the texture profile. Values vary ±0.2 between runs (random textures).

| check (same lab on both builds) | v1.4 | v1.5 | target |
|-------|------|------|--------|
| element noise texture, impact local flatness: storm / fire | 0.33 / 0.11 | 0.59 / 0.50 | ≥ 0.4 (frost and arcane stay tonal by design: glass, gong) |
| storm impact energy above 2.5 kHz in the first 60 ms | 9 % | 30 % | ≥ 25 % |
| distinctness — keystrokes / seals / impacts / rites | 1.38 / 1.36 / 3.27 / 1.33 | 1.6–1.8 / 1.7–2.2 / 2.0–2.2 / 1.75–1.8 | ≥ 1.5 each |
| keystroke drop before the next key (80 WPM), worst school | 11.5 dB | 17.4 dB | ≥ 15 dB |
| A-weighted loudness: keys / releases / impacts (t2) | −34…−39 / −36…−39 / −39…−51 | −41…−43 / −38…−42 / −33…−39 | keys < releases < impacts |
| loudest rite peak (tier IV + crit + lethal) | −13.3 dBFS | −6.7 dBFS | ≤ −6 dBFS |

Audition files (normalised as a whole, so relative levels are the game's): `audition/1-lightning-tiers.wav` (storm
cantrip → spell → incantation with side bolts → Forbidden Rite with crit and kill), `audition/2-all-schools.wav` (a
tier-II cast of each school with mistakes, a fizzle, frost and fire rites), `audition/3-storm-before-after.wav` (the same
storm cast on v1.4, then v1.5).

### 15.10 Pitfalls found while building v1.5

1. **Measure perceived loudness, not energy.** Raw band energy said every impact was 80 % sub-bass; A-weighted, the
   same sounds were mid-heavy. Balancing by energy made the frost shatter 9 dB too loud and nature 5 dB too quiet.
2. **Whole-spectrum flatness lies about filtered noise.** A low-passed rumble has a steep spectral tilt and "measured"
   0.01 (a pure tone). Use flatness inside each octave.
3. **Spectral metrics can't hear texture.** Crackle, creak, buzz and glass can share a spectrum; add a modulation
   spectrum of the envelope (and crest) before trusting a distinctness number.
4. **Don't normalise a dense texture to a forced first click.** The thunder rip with `first: true` and `skew 3` became one
   loud click and near-silence; dense textures need `skew ≈ 1.3` and no forced click.
5. **A tail must never out-peak the hit.** One full-scale static click 270 ms after a thunder impact peaked above the crack
   and read as a second strike.
6. **Every texture needs a taper.** The roar's exponential decay was still at −22 dB when the buffer ended — an audible cut.
7. **Short notes need short oscillators.** `envelope` got shorter but the vibes oscillator kept a hard-coded 0.5 s stop
   (and the mistake note used the long bell); the mock-context test caught both.
8. **A baseline must render the old code.** The lab imports `/src/ui/audio.js`; the v1.4 scenes rendered the *new* engine
   through the old API and produced a fake baseline. Serve the old `src` from a temporary copy (and delete it).
9. **Keep the element above the music.** The first draft's pitched cores (kalimba, bell) were 15–20 dB above the rustle
   and dust; per-school `CORE` gains fixed it.
