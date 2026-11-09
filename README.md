# Spellstroke

A touch-typing RPG. Every spell is an incantation you type: pick a spell by typing its glowing first
letter, then type the rest. Speed and accuracy are your damage; mistakes destabilise the spell. The world
map is the keyboard curriculum — each region teaches new keys, from the home row to `{ [ ] }`.

**The Glyphdeep** is an endless roguelike mode, playable from the very first launch (`D` on the title screen):
pick any set of keys and see how deep your fingers can take you.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # logic tests (node --test)
npm run build      # static build in dist/
npm run release    # build + package spellstroke-itch.zip for itch.io
```

## Controls

| Where | Keys |
|-------|------|
| Combat | type a card's glowing first character to cast it · `Esc` cancel the spell / pause |
| Camp | `1`–`5` tabs · `Enter` hunt · `B` boss · `P` practice shrine · `←/→` select region |
| Victory | `1`–`3` pick a boon and continue · `←/→` select · `Enter` take the highlighted boon and continue · `E` equip the best ▲ upgrade · `Esc` return to camp and bank your gold |
| Defeat | `Enter` hunt again / rematch the boss · `Esc` return to camp |
| Hunt events | type the phrase (Wayshrine, Restless Chest, Moonlit Spring, Rune-Sealed Door) · `1`/`2` choose (Cursed Altar) · `1`/`2` buy, `3` leave (Wandering Trader) · `Esc` leave the event · after the result: `Enter` continue, `Esc` camp, `E` equip |
| Chests | `E` equip the item if it is an upgrade |
| Title | `D` the Glyphdeep (or continue the descent in progress) |
| Glyphdeep tab (`6`) | `↑/↓` choose a rune circle · `Enter` descend / continue · `X` abandon the descent in progress · click a Scriptorium upgrade to buy it |
| Glyphdeep map | type a door's word to open it · `←/→` + `Enter` · `Esc` cancel the word, else menu (`C` camp — the run is saved · `A` abandon) |
| Glyphdeep rewards | `1`–`4` pick a boon / relic · `←/→` select · `Enter` take the highlighted one · `R` reroll (🎲) |
| Glyphdeep rooms | Campfire: `1` rest · `2` temper → `1`–`3` choose the rune · Shop: `1`–`8` buy, `Enter` leave · Treasure: `1`–`3` relic, `4` coins · after any room or event: `Enter` descend |
| Chronicle (run over) | `Enter` descend again on the same circle · `Esc` camp |

When a journey starts you choose a difficulty: **Apprentice** (new to touch typing), **Adept**, or
**Archmage** (for typists who want to get faster: a pace rune rewards beating your own average WPM, and
you can skip straight past the letter lessons). Settings let you change it later and switch between
**QWERTY (US)** and **QWERTZ (DE)**, the keyboard guide mode (hints / always / off), volume and screen
shake & flashes. Progress is saved in `localStorage`.

**Hunts** get tougher the longer they run (*hunt heat*), but after every win you pick one of three **boons** that
last until you return to camp. Chains of 3, 5, 7 and 10 wins (then every 5th) pay out free chests or lure a
Glimmerkin, and from chain 2 a hunt sometimes turns up an **event** instead of a fight. Keep your combo alive for
up to +20 % spell power, and watch for rune mastery pop-ups when a key reaches a new level.

**The Glyphdeep** (endless mode): choose a *rune circle* — any key set from the home row to the full keyboard — and
descend room by room until you fall. Your score is the depth you reach; records are kept per circle. Campaign level and
gear stay at camp: a run's power comes from your typing, its boons and relics, and real key mastery.
- **Doors you type:** every depth offers 2–3 doors (battle, elite, mystery, campfire, shop, treasure, glimmerkin);
  type a door's word to open it. Every 5th depth a **guardian** — a region boss — bars the way, and the scenery and foes
  move on to the next region.
- **Bane runes:** each foe is weak to one of *your* weakest keys. Its letters glow red in your spells and channel ×2 power.
- **Golden runes:** a few letters glow gold. Type one without a mistake on it to earn coins for the Ink Merchant.
- **Relics** that reward technique: Metronome (steady rhythm = +35 % damage), Pinky Promise / Ringbearer (finger power),
  Racing Wisp (a ghost of your own average pace runs ahead of your caret), Blind Oath (no keyboard guide, +30 % damage),
  Space Between (every space shields you), and 19 more. Dark Pacts trade a strong relic for a **curse** such as Ink Blots
  (some letters are hidden — you must know the word).
- **Campfires:** rest, or **temper** one of your weakest keys with a short drill — 90 % accuracy makes that key stronger
  for the rest of the run.
- **Trials:** race the Racing Wisp, cross the Glass Bridge (three mistakes and you fall), and the hunt events.
- **Chronicle:** when the run ends you see your WPM per fight, the keys that got faster during the run and your build,
  and earn **Ink** for the **Scriptorium** (6 permanent upgrades, e.g. start with a relic of your choice).

**Every spell is a sigil you inscribe and a song you play.** Each letter you type carves a segment of a magic circle in
front of the wizard and writes itself onto the rim, while the school's geometry draws itself inside. Every key also
charges the element you are casting: sparks crackle for storm, embers pop for fire, ice ticks for frost, arcane dust
shimmers, leaves rustle for nature, barrier plates clink for wards — each around the next note of the school's rising
melody. Mistakes crack the circle and make the element choke; a fizzle makes it fall apart. On the last key the element
bursts from the sigil, which seals and stamps onto the foe, and the spell erupts from it in sync with its sound — flames
rise from the ground with a roar, ice crystals grow and shatter, a bolt strikes from a sigil in the sky with a thunder
crack and a rolling rumble, arcane shapes collapse inward into a gong. Forbidden Rites get their own cinematic finish, and
a killing blow ends the song on a resolving cadence. All sound is synthesized live (see PLAN.md §15) — no audio files.

## Layout

- `src/logic` — pure, DOM-free game rules (combat engine, text generation, loot, progression), unit-tested in `tests/`
- `src/data` — zones, words, sentences, code lines, items, balance numbers
- `src/ui` — screens, components, canvas FX, synthesized audio

The full design and step-by-step implementation plan is in [PLAN.md](PLAN.md).
