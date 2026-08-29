# TANKTHILTETEYT — Complete Developer Handoff Diary
**Version as of this document:** `TankThilteteYt02_011.html`
**Document date:** 2026-08-29
**Purpose:** Any AI or developer joining this project cold should be fully operational after reading this file. No other file needs to be read first.

---

## TABLE OF CONTENTS
1. [What This Game Is](#1-what-this-game-is)
2. [File Naming & Version Logic](#2-file-naming--version-logic)
3. [Previous Version Check Logic](#3-previous-version-check-logic)
4. [Technology Stack](#4-technology-stack)
5. [Full Game Systems Reference](#5-full-game-systems-reference)
6. [Screen & UI Map](#6-screen--ui-map)
7. [Data / State / Persistence](#7-data--state--persistence)
8. [What Has Been Achieved — Complete Patch History](#8-what-has-been-achieved--complete-patch-history)
9. [Current Standing — What Works Right Now](#9-current-standing--what-works-right-now)
10. [Known Issues — None Outstanding](#10-known-issues--none-outstanding)
11. [Next Phase Plan](#11-next-phase-plan)
12. [Coding Conventions & Rules](#12-coding-conventions--rules)
13. [Key Design Decisions (Locked — Do Not Reverse)](#13-key-design-decisions-locked--do-not-reverse)
14. [Workspace File Index](#14-workspace-file-index)

---

## 1. What This Game Is

**Title:** TANKTHILTETEYT
**Tagline:** CONQUER EVERY BIOME

A **single-file, mobile-first, 3D arcade tank shooter** built entirely in one HTML file with no build step, no backend, no CDN dependencies at runtime. Open the file in any modern browser and it runs immediately.

**Core loop:** Drive your tank around a procedurally generated arena, destroy enemy tanks, collect level-up cards to build a stat loadout, survive boss waves, collect coins, unlock better hull skins, repeat.

**Genre feel:** Vampire Survivors × Geometry Wars, viewed in third-person 3D using Three.js. Touch-controlled on mobile (left half = move joystick, right half = auto-aim fire). Desktop keyboard/mouse also works.

---

## 2. File Naming & Version Logic

### The Rule
Every change produces a **new file**. The previous file is **never edited after the next one exists**. This is the hard law of this project — the user explicitly requires it.

### Naming Scheme
```
TankThilteteYt02_NNN.html
```
- `TankThilteteYt02` = the stable base name (locked since _001)
- `_NNN` = zero-padded three-digit sequence number: `_001`, `_002`, ... `_009`, `_010`, etc.
- **Never use** `_v1.1`, `_v2.0` etc. — that naming scheme was used briefly and abandoned at _003.

### Current Sequence
| File | What it added |
|---|---|
| `_001` | Base stable build — home screen, 3D tank, 3 modes, archetypes, minimap, drag-to-spin |
| `_002` | Settings + hull archetypes + minimap retract + drag-to-spin |
| `_003` | Card guarantees + airdrop bias + warlord nerf + water changes |
| `_004` | Water disabled, HP/XP numeric HUD, speed/damage pill, pause rebuilt, evo detail screen |
| `_005` | Armor redesigned as full shield pool (`state.armorHp`/`state.armorMaxHp`) |
| `_006` | Armor bar visual fix (inline tag + overlay), archetype re-applied on revive |
| `_007` | Fixes 3–8: L1 enemy dmg, % labels, live speed pill, pause Max HP/Heal-Kill, adrenaline offset, early card guarantee |
| `_008` | Armor bar → full-height transparent blue overlay; live damage pill; damage cell mirrors overcharge; Fire Rate label says ↑faster; Shield HP label |
| `_009` | Camera float btn fixed; skin shop shows archetypes; pause grid 5-col; armor regen pulse; pause damage cell synced to HUD overcharge |
| `_010` | Deep code audit — 5 bugs fixed: afterburn id mismatch, runCardsObj lost on resume, revive double-arch-delta, Void Walker crit missing, Aegis base armor |
| `_011` | **LATEST** All 6 known issues resolved: 12 evolutions fully wired + bonus stats, evo unlock banner+sound, boss rush locked UI, overcharge countdown, surge pre-warning, death screen biome+evos |

### Next file to create
`TankThilteteYt02_012.html` — copy from `_011`, apply patch, never edit `_011`.

---

## 3. Previous Version Check Logic

Before writing `_011`, always do:

```python
# Confirm the copy succeeded
import os
assert os.path.exists('TankThilteteYt02_011.html'), "Source missing!"
os.system('cp TankThilteteYt02_011.html TankThilteteYt02_012.html')
```

Then always run the **mandatory checks** before deploying:

```python
import re, subprocess
with open('TankThilteteYt02_012.html','r') as f:
    src = f.read()

# 1. JavaScript syntax
scripts = re.findall(r'<script>(.*?)</script>', src, re.DOTALL)
largest = max(scripts, key=len)
with open('/tmp/check.js','w') as f: f.write(largest)
r = subprocess.run(['node','--check','/tmp/check.js'], capture_output=True, text=True)
assert r.returncode == 0, f"SYNTAX ERROR: {r.stderr}"

# 2. Core integrity checks (expand as needed per patch)
must_have = [
    "const absorbed = Math.min(armorPool, incoming)",   # armor shield pool
    "_rvSkin.arch",                                      # archetype on revive
    "0.70 + Math.max(0, L - 1) * 0.032",               # enemy L1 dmg fix
    "_isHasted",                                         # live speed pill
    "_ownedStats.includes('regen')",                     # early card guarantee
    "rgba(96,165,250,0.38)",                             # armor blue overlay
    "_isOverchg",                                        # live damage pill
    "armorRegen 1.4s",                                   # armor regen animation
    "skin-arch-badge",                                   # skin shop archetype badge
    "repeat(5, 1fr)",                                    # pause grid 5-col
    "startGame('levels'",                               # level mode string correct
    "bossKills >= 5",                                    # boss rush unlock gate
    "Math.pow(4, state.continuesThisRun",               # revive x4 cost
    "EVOLUTION_CARDS",                                   # full 12-evo array present
    "evo_afterburn",                                     # afterburn (not afterburner) in game loop
    "'afterburn'",                                       # afterburn id in EVOLUTIONS
    "runCardsObj",                                       # runCardsObj in snapshot
    "crit:10",                                           # Void Walker crit in arch
    "_aegisBonus",                                       # Aegis base armor fix
]
for check in must_have:
    assert check in src, f"MISSING: {check}"

print("All checks passed.")
```

**Rule:** Never present a file to the user with a failed check. Fix it first.

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| 3D rendering | Three.js r128 (minified, inlined) | No import maps. Entire library is embedded in the HTML `<script>` tag. |
| Game logic | Vanilla JS | Closure-based, all inside one giant `<script>` tag after Three.js |
| Physics | Custom AABB | No Cannon.js or Ammo. Terrain collision is height-map based. |
| Audio | Web Audio API (synthesized) | Fully offline. No audio files. SFX object generates cannon shots, explosions, shield cracks, laser hums via oscillators. |
| Persistence | `localStorage` via `store` wrapper | Falls back silently in private mode. Saves coins, skins, achievements, best scores, settings, consumables. Does NOT save mid-run state to localStorage — mid-run saves use `snapshotRun()` in memory. |
| Rendering target | WebGL (Three.js) | Falls back gracefully; error overlay shown if WebGL unavailable. |
| Input | Touch (joystick + right-half fire) + keyboard WASD + mouse | Mobile-first design. |
| Deployment | Single HTML file, any static server | `python3 -m http.server 3000 --bind 0.0.0.0` or just open in browser. |
| File size | ~1,089 KB / ~9,533 lines | Three.js accounts for ~700 KB of that. Game logic is ~2,800 lines. |

---

## 5. Full Game Systems Reference

### 5.1 Game Modes

Three modes selectable from the home screen:

| Mode | How it works |
|---|---|
| **Casual** | Endless. Level counter climbs forever. Difficulty scales continuously. Best score tracked as highest level reached. Supports mid-run saves (up to 3 slots, memory-only — lost on page refresh unless auto-saved). |
| **Level Mode** | Structured. Player configures enemy density (Light/Normal/Heavy/Chaos), difficulty (Easy/Normal/Hard/Nightmare), and starting level (1–30, gated by `state.maxCleared`). Endless — there is no hard stage cap or win screen. `maxCleared` updates as the player reaches new levels, unlocking higher start points. Mode string: `'levels'`. |
| **Boss Rush** | Unlocked when `bossKills >= 5` OR `maxLevel >= 5` (whichever comes first). Player faces all 6 bosses back-to-back with zero normal enemies between them. Completing all 6 triggers a victory screen. `state._bossRushIndex >= 6` = victory. Mode string: `'bossrush'`. |

### 5.2 Hull Archetypes (Skins)

Each skin purchased in the Armory applies a **permanent stat delta at run start**. Re-applied on revive too.

| Skin | Cost | Archetype | Stat Deltas | Description |
|---|---|---|---|---|
| Amber Strike | Free | Balanced | All zero | Ideal starting hull |
| Crimson Fang | 2,000 | Striker | DMG+25, SPD+10, MaxHP–15 | Fragile but lethal |
| Emerald Guard | 3,500 | Juggernaut | MaxHP+40, Armor+10, Regen+1, SPD–8 | Slow tank |
| Glacier | 5,000 | Recon | SPD+20, Regen+2, MaxHP–10, DMG–10 | Kite and outlast |
| Void Walker | 7,500 | Tech | DMG+15 | Crit build synergy (archdesc notes crit — no actual crit delta in arch) |
| 24k Commander | 12,000 | Sovereign | MaxHP+25, DMG+10, SPD+5, Armor+5, Regen+1 | All-around elite |

**Implementation:** `SKINS` array, each entry has `arch` object and `archdesc` string. Applied in `startGame()` and in `buyContinue()` (after revive). The `arch` delta is applied as additive modifiers to `state.playerStats` before the player mesh spawns.

**Shown to player:** As of `_009`, each skin in the Armory now shows its archetype badge (colour-coded) and `archdesc` text. Players can compare before buying.

**⚠ Known gap:** Void Walker's `archdesc` advertises "+10% Crit" but the `arch:{}` object has no `crit` field — the crit bonus is not actually applied at run start. This is a bug to fix in a future patch (add `crit:10` to Void Walker's `arch:{}`).

### 5.3 Upgrade Cards

16 card types. 3 cards offered at each level-up. Player picks one. Cards stack — picking the same card twice doubles its effect. Stored in `state.runCards` (array of picked card objects) and `state.runCardsObj` (stat → count map).

| Stat | Card Name | Effect per pick |
|---|---|---|
| speed | Overdrive | +10% movement |
| damage | Heavy Rounds | +15% shell damage |
| fireRate | Rapid Loader | +12% fire rate |
| maxHp | Reinforced Hull | +20 max HP, heals 20 |
| regen | Nano Repair | +2 HP/s passive regen |
| armor | Composite Armor | +8 armor pool |
| crit | Deadeye Optics | +10% crit chance (crits = 2× damage) |
| multishot | Split Cannon | +1 projectile per shot |
| pierce | Piercing Rounds | +1 enemy penetration |
| coinBonus | Scavenger | +25% coins from kills |
| healOnKill | Field Medic | +3 HP per kill |
| xpBonus | Bounty Hunter | +20% XP from kills |
| adrenaline | Adrenaline Rush | +25% speed for 1.5s after kills (stacks) |
| missile | Missile Pod | Homing missile every 5s (stacks = faster) |
| splash | Shell Shock | Shells splash nearby enemies (stacks = wider) |
| shield | Shield Generator | Blocks one hit every 18s (stacks = faster) |

**Card offering logic:**
- Pool = all 16 cards, weighted by how often already picked
- Early guarantee (first 5 level-ups): forces `regen` and `healOnKill` into the pool if not already owned — only if player doesn't already have that card
- Boss Vault loot: higher weight toward evolution prerequisites, +30% rare cards
- Rerolls: 1 free per run + Armory consumable rerolls

**Adrenaline offset (Fix 7):** Uses `(count + 1)` multiplier so the first card gives ×1.25 speed (not ×1.0 which was useless).

### 5.4 Evolutions

**Two separate arrays exist — understand both:**

**`EVOLUTIONS`** — display/UI array (used in pause screen progress tracker, uses `need:[]` format listing stat names):
6 entries shown in the pause screen evolution progress section.

**`EVOLUTION_CARDS`** — unlock logic array (used by `evolutionReady()` and `eligibleEvolutions()`, uses `requires:{stat:count}` format):
12 entries — the full pantheon per Decision 20. `evolutionReady(e)` checks `cardCountFor(k) >= e.requires[k]`.

The full 12 EVOLUTION_CARDS:

| ID | Icon | Name | Requires | Effect |
|---|---|---|---|---|
| cluster | 🎆 | Cluster Warheads | missile×2 + splash×1 | Missiles bloom into 3 bomblets |
| bastion | 🏰 | Bastion Core | armor×2 + shield×1 | Depleted shield absorbs 25% next hit |
| prism | 💎 | Prism Cannon | pierce×2 + multishot×1 | Crits punch through +1 extra enemy |
| nanite | 🧬 | Nanite Harvest | regen×2 + healOnKill×1 | +4 HP on every kill |
| afterburn | 🚀 | Afterburner | speed×2 + adrenaline×1 | Kill-haste lasts 3.0s, boosts speed |
| siege | ⛏️ | Siege Loader | fireRate×2 + damage×1 | Every 4th shot fires a 1.7× siege slug |
| overkill | ⚔️ | Overkill Array | damage×2 + multishot×1 | +20% damage, +1 shell, explosive impact |
| tempestA | ⚡ | Tempest Autoloader | fireRate×2 + crit×1 | +18% fire rate, +10% crit chance |
| citadel | 🏯 | Citadel Core | armor×2 + maxHp×1 | +25 HP, +8 armor, +1 HP/s regen |
| missileR | 🌧️ | Missile Rain | missile×2 + splash×1 | Faster homing launches, wider blasts |
| phaseLance | 🔷 | Phase Lance | pierce×2 + crit×1 | +1 pierce, +15% damage, +8% crit |
| predator | 🐺 | Predator Engine | healOnKill×2 + adrenaline×1 | +3 heal/kill, +10% movement |

**Unlock trigger:** Guaranteed in Boss Vault after defeating a boss. 50% chance at standard level-up once requirements are met. Stored in `state.evolutions` (array of id strings). Shown in pause screen with progress bars.

**Recipe:** 2× primary stat + 1× secondary stat (Decision 21-B).

### 5.5 Bosses

6 boss types in a rotating roster (`BOSS_KINDS`):

| Type | Fire Interval | Notable |
|---|---|---|
| warlord | 3.2s | Balanced heavy hitter |
| tempest | 3.0s | Fast bursts |
| colossus | 3.8s | High HP, slow |
| titan | (varies) | Multi-phase |
| nova | (varies) | Area blast patterns |
| fortress | (varies) | Stationary, heavy armour |

Every boss kill: coins awarded, `bumpDaily('bossKills', 1)` called, Boss Vault card selection offered.

**Boss Rush:** `state._bossRushActive = true`, enemies spawn only from BOSS_KINDS in sequence. `state._bossRushIndex` tracks which boss is next. Victory at index >= 6.

### 5.6 Armor / Shield System

Implemented as a **separate HP pool** on top of player HP. Introduced in `_005`.

- `state.armorHp` — current shield HP
- `state.armorMaxHp` — max shield HP (built from `playerStats.armor` × scaling)
- Incoming damage hits armor first: `absorbed = Math.min(armorPool, incoming)`. Only remaining damage hits `player.hp`.
- **Regen:** 0.5 HP/s base + `playerStats.regen` bonus. Regenerates even in combat.
- **HUD:** Blue transparent overlay (`rgba(96,165,250,0.38)`) sits on top of the HP bar at full height. Width = `armorPct%`. When armor is below max and regenerating, overlay pulses via `armorRegen` keyframe animation.
- **Death:** When armor breaks (hits 0), a toast fires: "🛡 Shield Broken!". HP starts taking damage.
- **Revive restore:** 50% armor restored on continue.
- **Aegis consumable:** Starts run with full armor pre-charged.
- **Armor cell in pause:** Shows `current/max` or `—` if no armor. Label: "Shield HP".

### 5.7 Enemy Scaling

Level 1 base damage multiplier: `0.70` (was `1.10` before Fix 3 — reduced ~63%). Scales up by `+0.032` per level thereafter:
```
dmgMult = 0.70 + Math.max(0, level - 1) * 0.032
```
Additional multiplier from chosen difficulty (`DIFFICULTIES.dmg`): Easy=0.7×, Normal=1.0×, Hard=1.3×, Nightmare=1.6×.
Fire interval also scales with level and difficulty.

### 5.8 Biomes

7 biomes, each with distinct sky colours, fog, lighting, and ground colour. **Visual only** — no gameplay modifiers (per Decision 5-B).

| Biome |
|---|
| Enchanted Forest |
| Frozen Tundra |
| Volcanic Wasteland |
| Golden Desert |
| Mystic Swamp |
| Crystal Caverns |
| Autumn Grove |

Biome changes as player levels up. Each biome has: `skyTop`, `skyBottom`, `fogColor`, `fogNear`, `fogFar`, `groundColor`, `grassColor`, `ambientLight`, `sunColor`.

### 5.9 Supply Drops (Airdrops)

Crates spawn near the player (16–34 units away) starting at Level 4. Two crate colours:
- **Gold crate** (74% chance): standard supplies
- **Purple crate** (26% chance): rare/black market supplies

Items include: HP restore, armor restore, coins, speed boost, overcharge, shield recharge, XP boost.

**Schedule:** First crate appears at `runTime + 12s`. After collection, next crate at `runTime + 40s + random(25s)`. Maximum 2 crates on the field at once.

### 5.10 Enemy Surge Events

Starting at Level 8, periodic "enemy surge" pressure waves fire every ~70–110 seconds:
- `state.surgeNextAt` initialised to `runTime + 70`
- Surge duration: 15 seconds of elevated enemy spawn rate
- Completing a surge without dying: coin bounty = `60 + level × 10`
- Banner shown: "⚠ ENEMY SURGE — HOLD THE LINE! ⚠"
- After surge ends, next surge scheduled at `runTime + 80 + random(30)`

### 5.11 Fun Events (mid-run special events)

Three types fire periodically after Level 8:

| Kind | Effect |
|---|---|
| `bounty` | Coin multiplier active for a window — kill bonuses spike |
| `lull` | Enemies slow down, reduced spawn — breather moment |
| `ambush` | Sudden enemy cluster spawn |

### 5.12 HUD Layout

During gameplay (left→right, top→bottom):
- **Top-left:** HP bar (green→amber→red) with transparent blue armor overlay + numeric HP label + 🛡 armor inline tag
- **Top-center:** XP bar + level number
- **Top-right:** Minimap (retractable: tap toggles 160px ↔ 60px). Elite enemies = teal dots, bosses = pulsing skulls.
- **Top-right strip:** ⚡ Speed pill (gold border when hasted, amber + ▼ SLOWED when rooted) · 💥 Damage pill (gold border during Overcharge/Blast)
- **Bottom-left:** Move joystick
- **Bottom-right:** Auto-fire touch zone + 📷 camera float button
- **Floating:** Kill combo counter, toast banners, boss health bar (when active)

### 5.13 Consumables (Armory one-time boosts)

5 consumables. Each can be stacked — buying a second costs more (`base × growth^owned`).

| ID | Name | Effect | Base Cost | Growth |
|---|---|---|---|---|
| lucky | Lucky Charm | +20% coins next run | 400 | ×1.55 |
| headstart | Head Start | Start with +1 free card | 550 | ×1.60 |
| reroll | Card Reroll | Reroll a level-up hand | 700 | ×1.55 |
| overcharge | Overcharge | +30% damage for 60s | 600 | ×1.58 |
| aegis | Aegis Kit | Start with charged shield | 600 | ×1.58 |

### 5.14 Achievements

14 achievements, each with a coin reward on first unlock. Stored in `state.achUnlocked` (array of ids). Displayed in the Awards screen.

| ID | Goal | Reward |
|---|---|---|
| firstBlood | 1 kill | 100 |
| exterminator | 500 kills | 1,000 |
| bossSlayer | 1 boss | 300 |
| realmWarlord | 10 bosses | 1,500 |
| critMachine | 100 crits | 500 |
| demolition | 100 structures destroyed | 500 |
| explorer | 5,000 distance | 750 |
| rich | 25,000 lifetime coins | 1,000 |
| lvl20 | Reach level 20 | 800 |
| lvl30 | Reach level 30 | 1,500 |
| comboKing | ×8 kill combo | 400 |
| survivor | 15 min total playtime | 600 |
| nightHunter | Defeat boss on Nightmare | 1,000 |
| collector | Own 3 skins | 600 |

### 5.15 Settings

13 toggle buttons in Settings screen:

| Toggle | Options |
|---|---|
| Sound | On / Off |
| Music | On / Off |
| Graphics | Auto / Low / High |
| Camera | Follow / Wide |
| Assist | On / Off |
| Haptics | On / Off |
| Hands | Right / Left (swaps joystick sides) |
| Shake | Full / Reduced / Off |
| Flash | Full / Reduced / Off |
| Damage Numbers | On / Off |
| Combat Popups | On / Off |
| Frame Rate | 60 FPS / 30 FPS |
| Reset All Data | (destructive, confirmation) |

All settings persist via `saveGame()` / `loadGame()`.

### 5.16 Revive System

- Base cost: **300 coins**
- Each subsequent revive in the same run: ×4 (300 → 1,200 → 4,800 → ...)
- **No hard cap** on number of revives — cost scaling is the only limiter
- On revive: 50% HP restored, 3s invulnerability, archetype re-applied
- Revive count shown in pause screen as badge

### 5.17 Audio System

Fully synthesized via Web Audio API. No audio files needed. `SFX` object exposes:
- `SFX.shoot()` — cannon fire (short square-wave burst)
- `SFX.hit()` — silent stub (removed to reduce audio clutter v26.8)
- `SFX.crit()` — high-pitched ping on critical hit
- `SFX.kill()` — silent stub (bosses use `bossDown` instead)
- `SFX.explosion(size)` — noise burst + low tone, scales with explosion size
- `SFX.shatterWood()` / `SFX.shatterRock()` — terrain destruction sounds
- `SFX.hurt()` — sawtooth sting when player takes damage
- `SFX.heal()` — rising tone on heal
- `SFX.levelUp()` — four-note ascending arpeggio
- `SFX.cardPick()` — short card selection chime
- `SFX.coin()` — two-ping coin sound
- `SFX.bossAlarm()` — two-cycle low alarm on boss spawn
- `SFX.bossDown()` — descending victory fanfare + noise on boss kill
- `SFX.revive()` — ascending four-note revive chord
- `SFX.achievement()` — three-note achievement chime
- `SFX.engineStart()` / `SFX.engineSet(speed)` / `SFX.engineStop()` — continuous sawtooth engine hum that scales with movement speed
- `SFX.ambientSet(biome)` / `SFX.ambientStop()` — looped biome wind bed (louder for windy biomes)
- `SFX.musicStart()` / `SFX.musicStop()` — generative background music (bass pulse + pad + arp, intensity follows combat/boss state)
- `SFX.vibrate(pattern)` — haptics via `navigator.vibrate`, gated by `hapticsEnabled`

**Note:** `SFX.shieldCrack` does NOT exist and is never called. The handoff previously listed it incorrectly.

### 5.18 Camera System

Two modes: `'follow'` (close, behind-tank) and `'wide'` (zoomed out, more battlefield view).

- Toggled by: floating 📷 button during gameplay, or Settings panel toggle
- Camera smoothly lerps to target position via `dt * 0.65` blend
- Camera shake on explosions: scale by `shakeMode` preference (`full`, `reduced`, `off`)
- Wide mode reduces shake scale by 0.55×

**Bug history:** The float button previously used `'normal'` (not a valid camera state). Fixed in `_009` — now correctly uses `'follow'`.

---

## 6. Screen & UI Map

```
[start-screen]  ──▶  [casual-screen]   ──▶  GAMEPLAY
     │                    │ (load save)       │
     │           [levels-screen]  ──▶  GAMEPLAY
     │           [Boss Rush btn] ──▶  GAMEPLAY
     │                                        │
     ├──▶ [shop-screen]  (Armory)             │ pause btn
     ├──▶ [awards-screen]                     ▼
     └──▶ [settings-screen]          [pause-screen]
                                              │ quit
                                     [game-over-screen]
                                              │
                                       (continue / restart / home)
                                     [pause-screen / evo-detail]
```

All screens are `<div class="screen hidden">` elements. Shown/hidden by toggling `.hidden` class. Only one screen visible at a time. GAMEPLAY = Three.js canvas is the "screen" (canvas fills viewport, all UI screens hidden).

**Pause screen sections (top to bottom):**
1. Header: "⏸ PAUSED" + revive count badge
2. Stat grid (5×2): Max HP, Shield HP, Regen, Heal/Kill, Crit / Speed, Damage, Fire Rate, Multishot, Pierce
3. Cards section: deduplicated list with count badges
4. Evolution section: progress bars for all 6 evolutions
5. Action buttons: Resume, Settings, Save Run, Quit

---

## 7. Data / State / Persistence

### `state` object — key fields

```javascript
// Persistent (saved to localStorage via saveGame())
state.coins          // player coin balance
state.meta           // armory permanent upgrades (future)
state.skins          // { owned: ['amber',...], selected: 'amber' }
state.bestCasual     // highest level reached in casual
state.bestLevels     // highest level reached in level mode
state.maxCleared     // level mode unlock gate
state.consumables    // { lucky, headstart, reroll, overcharge, aegis } — counts
state.achUnlocked    // array of achievement IDs
state.stats          // lifetime stats object { kills, bossKills, crits, ... }
state.musicEnabled   // bool
state.fpsMode        // 30 or 60
state.damageNumbers  // bool
state.combatPopups   // bool
state.quality        // 'auto'|'low'|'high'
state.hapticsEnabled // bool
state.leftHanded     // bool
state.reduceShake    // bool
state.reduceFlash    // bool

// Run-time only (not saved to localStorage)
state.playerStats    // { maxHp, damage, speed, fireRate, armor, regen, crit,
                     //   multishot, pierce, coinBonus, healOnKill, xpBonus,
                     //   adrenaline, missile, splash, shield }
state.armorHp        // current shield HP
state.armorMaxHp     // max shield HP for this run
state.level          // current level
state.runTime        // seconds elapsed (pause-safe clock)
state.runCards       // array of picked cards this run
state.runCardsObj    // { stat: count } map
state.evolutions     // array of unlocked evolution IDs
state.surgeActive    // bool
state.surgeNextAt    // runTime when next surge fires
state.overchargeUntil // runTime when Overcharge expires
state.blastUntil     // runTime when Surge Blast expires
state.cameraMode     // 'follow' | 'wide'
state.mode           // 'casual' | 'levels' | 'bossrush'
state._bossRushActive
state._bossRushIndex // 0–5, which boss is next

// Mid-run casual save (memory only — lost on refresh)
state.casualSaves    // array of snapshotRun() objects
state.autoSave       // latest auto-snapshot
```

### `saveGame()` / `loadGame()`
Serialises the persistent subset to `localStorage` key `'tank_save'` as JSON (schema version 3). Called after: coins change, skin equip/buy, achievement unlock, settings change, run end.

**`armorHp` is NOT in saveGame** — intentional, new run always starts fresh. Mid-run resume uses `snapshotRun()` in memory which DOES include it.

---

## 8. What Has Been Achieved — Complete Patch History

### Phase 1: Analysis (pre-build)
- Analysed 4 source builds (`tank realm HUD.html`, `(2)`, `HUD3`, `tank-eternal_1.13_biome.html`)
- Produced full written analysis, exhaustive feature matrix, 107-question blueprint audit
- All 137 architectural decisions locked in `TankThilteteYt_MASTER_SPEC.md`

### Phase 2: Initial Build (_001)
- Full game built from scratch combining best elements of all 4 source builds
- Three.js 3D rendering, touch joystick, auto-aim fire, 7 biomes, 6 bosses
- Home screen with Industrial Command Hangar theme + animated background
- Drag-to-spin 3D tank on home screen
- 3 game modes, 16 upgrade cards, 6 evolutions, consumables, achievements

### Phase 3: Archetypes + Minimap + Settings (_002)
- Hull archetypes wired (6 skins with real stat deltas)
- Minimap retractable (tap to toggle 160px ↔ 60px)
- Full settings panel (9 original + 4 new = 13 total toggles)

### Phase 4: Card System Polish (_003)
- Early sustain guarantee (regen + healOnKill forced in first 5 offers)
- Airdrop bias (purple crates weighted 26%)
- Water terrain removed (performance)
- Warlord boss damage tuned down

### Phase 5: Major HUD Rebuild (_004)
- HP/XP bars replaced with numeric + bar combo
- Speed/Damage HUD pills added (⚡ + 💥)
- Pause screen completely rebuilt (stat grid + card list + evo progress)
- Evolution detail screen added (full breakdown of all 6 evolutions)

### Phase 6: Armor Shield Pool (_005)
- Armor completely redesigned from simple damage reduction % to a **separate shield HP pool**
- Full hit absorption logic
- Armor regen, HUD bar, repair airdrop

### Phase 7: Armor Visual + Revive Fix (_006)
- Armor bar moved to inline tag + overlay on HP bar (no card resize)
- Archetype re-applied on revive in `buyContinue()`

### Phase 8: 6 Gameplay Fixes (_007)
- **Fix 3:** Enemy L1 damage base 0.70 (was 1.10) — ~63% reduction
- **Fix 4:** `%` on speed/damage/firerate everywhere
- **Fix 5:** Live speed pill (gold border when hasted, amber + ▼ SLOWED when rooted)
- **Fix 6:** Max HP + Heal/Kill cells added to pause stat grid
- **Fix 7:** Adrenaline `+1` offset — first card gives ×1.25 (not ×1.0)
- **Fix 8:** Early guarantee checks `_ownedStats` before force-offering

### Phase 9: Armor Overlay Redesign + Live Damage Pill (_008)
- Armor bar → full-height transparent blue overlay (`rgba(96,165,250,0.38)`)
- HP bar colour fully visible underneath
- Live damage pill: shows boosted value during Overcharge/Blast, glows gold
- Fire Rate pause label: `%↑faster` for clarity
- Armor pause label: "Shield HP"

### Phase 10: 5 UX/Bug Fixes (_009)
### Phase 11: Deep Code Audit + 5 Bug Fixes (_010)
- Bug 1: `afterburner`→`afterburn` id mismatch across EVOLUTIONS/game-loop (4 sites)
- Bug 2: `runCardsObj` missing from `snapshotRun` — evo progress lost on resume
- Bug 3: Revive double-applied arch deltas each continue (exploitable stat stack)
- Bug 4: Void Walker `arch{}` had no `crit:10` despite advertising it
- Bug 5: Aegis with no armor cards gave 0 armor pool; now grants 20 base pool

### Phase 12: All 6 Known Issues Resolved (_011 — CURRENT)
Second deep audit confirmed Issue 2 (Armory Tech Tree) was already fully implemented with 15 SHOP_ITEMS. Remaining 6 real issues fixed:
- **Issue 1 (HIGH):** 6 of 12 `EVOLUTION_CARDS` unreachable — added all 6 to `EVOLUTIONS` with `need:[]`; wired stat bonuses via `_ec.bonuses` in `applyUpgrade`; added 6 tank visual parts in `syncPlayerTankParts`. All 12 evolutions now fully offerable and functional.
- **Issue 3 (LOW):** Boss Rush button always `display:none` to new players — now always visible, greyed/locked (opacity 0.42, `pointer-events:none`, 🔒 icon, "Kill 5 bosses to unlock") until threshold met; all 3 JS unlock sites updated to restore full appearance.
- **Issue 4 (MEDIUM):** Evolution pick had no celebration — `applyUpgrade` now fires `showUpgradeNotification('⚡ EVOLUTION: X!')` + `SFX.levelUp()` on every evo unlock.
- **Issue 5 (LOW):** Overcharge active with no time display — damage pill now shows `💥 130% ⏱42s` countdown while Overcharge is active; clears when expired.
- **Issue 6 (LOW):** Enemy surge fired with zero warning — 5-second pre-warning `showUpgradeNotification('⚠ SURGE INCOMING!')` added via `_surgeWarnShown` flag; resets cleanly after each surge cycle.
- **Issue 7 (LOW):** Death screen missing context — added `final-biome` (biome name when died) and `final-evos` (count of evolutions unlocked) stat cells; populated in `endGame()`.
Full systematic audit of every game system. Bugs found and fixed:
- **Bug 1 (CRITICAL):** `EVOLUTIONS` array had id `'afterburner'` but `EVOLUTION_CARDS` and all game-loop checks used `'afterburn'`. Result: Afterburner evolution was unrecognisable to the pause screen (always showed locked) and its kill-speed bonus never activated. Fixed: renamed id to `'afterburn'` in `EVOLUTIONS`; renamed all `evo_afterburner` → `evo_afterburn` in game loop (4 sites).
- **Bug 2 (CRITICAL):** `runCardsObj` (the `{stat: count}` map used by `cardCountFor()` and `evolutionReady()`) was not included in `snapshotRun()`. On casual mid-run resume, all evolution progress tracking returned 0 → no evolutions could unlock after resuming. Fixed: added `runCardsObj` to snapshot and restored it on resume.
- **Bug 3 (CRITICAL):** `buyContinue()` (revive) re-applied hull archetype stat deltas onto `playerStats` which already had them from `startGame()`. Each revive stacked another full delta: Crimson Fang gained +25 DMG / +10 SPD / −15 HP per continue, making 3+ revives game-breaking. Fixed: removed the additive re-application; `playerStats` is preserved correctly through death and needs no re-stacking.
- **Bug 4:** Void Walker `arch:{}` had no `crit` field despite `archdesc` advertising +10% Crit. The bonus was never applied. Fixed: added `crit:10` to Void Walker's `arch` and added `crit` to the `startGame` arch application block.
- **Bug 5:** Aegis consumable ("start with charged shield") set `shieldUp=true` but left `armorHp=0` when the player had no armor cards, so the armor bar never appeared and armor regen never ticked. Fixed: Aegis now grants 20 base armor pool when `playerStats.armor === 0` at run start.
- **Fix 1:** Camera float button now correctly uses `'follow'`/`'wide'` (was `'normal'`/`'wide'`)
- **Fix 2:** Skin Armory shows archetype badge + archdesc text per skin
- **Fix 3:** Pause stat grid → 5 columns, 10 cells in two even rows (vitals row first)
- **Fix 4:** Armor regen pulsing animation when shield is regenerating
- **Fix 5:** Pause stat damage cell mirrors HUD Overcharge (shows boosted value, glows gold)

---

## 9. Current Standing — What Works Right Now

As of `TankThilteteYt02_009.html`:

| System | Status |
|---|---|
| Home screen + hangar background | ✅ Working |
| Drag-to-spin 3D tank preview | ✅ Working |
| CASUAL mode (endless) | ✅ Working |
| LEVEL MODE (4 difficulties, density, start level) | ✅ Working |
| BOSS RUSH (6 bosses, victory at index 6) | ✅ Working |
| 3D gameplay (Three.js, touch joystick, auto-aim) | ✅ Working |
| 7 biomes (visual only, no gameplay modifiers) | ✅ Working |
| 16 upgrade cards + card offering logic | ✅ Working |
| 6 evolutions + progress tracking | ✅ Working |
| 6 boss types rotating roster | ✅ Working |
| Armor shield pool (full hit absorption, regen, HUD) | ✅ Working |
| Armor regen pulse animation | ✅ Working (added _009) |
| Hull archetypes (all 6 skins, real stat deltas) | ✅ Working |
| Archetype re-applied on revive | ✅ Working |
| Skin shop with archetype badge + archdesc | ✅ Working (added _009) |
| Live speed HUD pill (hasted / slowed states) | ✅ Working |
| Live damage HUD pill (Overcharge/Blast boost) | ✅ Working |
| Pause stat grid (5-col, 10 cells, vitals first) | ✅ Working |
| Pause damage cell mirrors Overcharge | ✅ Working (added _009) |
| Camera float button (`'follow'`/`'wide'`) | ✅ Fixed (_009) |
| Minimap retractable | ✅ Working |
| Supply drops (Level 4+, max 2 on field) | ✅ Working |
| Enemy surge events (Level 8+) | ✅ Working |
| Fun events (bounty/lull/ambush, Level 8+) | ✅ Working |
| Consumables (5 types, stackable) | ✅ Working |
| 14 achievements | ✅ Working |
| Settings (13 toggles, all persist) | ✅ Working |
| Save/load (localStorage) | ✅ Working |
| Mid-run casual save (memory, 3 slots) | ✅ Working |
| Revive system (300 coins × 4, no cap) | ✅ Working |
| Synthesized audio (no audio files) | ✅ Working |
| 30/60 FPS throttle | ✅ Working |
| Damage numbers toggle | ✅ Working |
| Reset all data | ✅ Working |
| Early card guarantee (first 5 level-ups) | ✅ Working |
| Adrenaline kill-speed stacking | ✅ Working |

---

## 10. Known Issues

### 🟡 Known Design Gap — 6 of 12 Evolutions Unreachable

`EVOLUTION_CARDS` contains 12 evolutions but `EVOLUTIONS` (the display/offering array) only contains 6. The `eligibleEvolutions()` function that feeds the card offer screen uses `EVOLUTIONS`, so the 6 extras are never offered to the player.

The 6 unreachable evolutions: `overkill`, `tempestA`, `citadel`, `missileR`, `phaseLance`, `predator`.

Additionally, none of these 6 have `evo_X` effect flags in the game loop — their `bonuses:{}` data exists in `EVOLUTION_CARDS` but applying them does nothing. This is a **planned but incomplete feature** (Decision 20 requires all 12). Completing it requires:
1. Add 6 entries to `EVOLUTIONS` with correct `need:[]` arrays
2. Implement `evo_overkill`, `evo_tempestA`, `evo_citadel`, `evo_missileR`, `evo_phaseLance`, `evo_predator` effects in the game loop
3. Add visual tank parts for each (the `syncPlayerTankParts` function)

This is multi-session work. Track as a Next Phase item.

### ✅ Zero known issues as of `_011`

Two full code audits were performed across `_010` and `_011`. All bugs, gaps, and UX issues identified have been resolved. The game is handoff-clean.

### Previously fixed
- ~~Camera float button set wrong mode value~~ (fixed _009)
- ~~Skin shop showed no archetype info~~ (fixed _009)
- ~~Pause grid 4-col left orphaned cells~~ (fixed _009)
- ~~Armor regen had no visual feedback~~ (fixed _009)
- ~~Pause damage cell showed base value during Overcharge~~ (fixed _009)
- ~~`stat-healkill` default HTML showed `0` not `—`~~ (fixed _009 via grid rewrite)

---

## 11. Next Phase Plan

As of `_011`, **all known bugs and issues are fully resolved**. The following are feature additions for future sessions — none are bugs or missing implementations.

### 🟠 Feature Additions (future patches)

**A. Daily / Weekly Challenges**
`bumpDaily` is stubbed throughout (9 call sites, all no-ops). Infrastructure is ready. Adding 3 rotating daily goals (e.g. "Kill 20 enemies in one run", "Defeat a boss on Hard") with coin rewards would significantly increase replay value.

**B. Adrenaline body-level visual**
Speed pill already glows gold during kill-haste (sufficient feedback). A brief tank afterimage or speed-lines particle effect on the mesh would make high-adrenaline runs feel more visceral.

**C. Boss health bar low-HP pulse**
Boss bar already shows boss name. Adding a red pulsing glow animation when boss HP < 25% would help players know a kill is close.

**D. Save slot skin colour swatch**
Casual save slots show level/score/time/date. A small colour swatch of the skin equipped at save time would give each slot more visual identity.

---

## 12. Coding Conventions & Rules

1. **Always copy first, never edit the previous file.** `cp _NNN.html _NNN+1.html`
2. **Always run syntax check** (`node --check`) before presenting.
3. **Always run integrity checks** (the `must_have` list) before presenting.
4. **Never use CDN links** in CSS or JS — the game must be 100% offline.
5. **Never split into multiple files** — one HTML file, always.
6. **All JS is inside the game's closure** — do not add functions at script root level (they won't have access to `state`, `player`, `scene`, etc.).
7. **`state` vs `st` shorthand:** Much of the older code uses `st` as shorthand for `state` inside certain closures. Always verify which variable name is in scope when patching.
8. **`dom(id)` helper exists** — use `dom('element-id')` instead of `document.getElementById('element-id')` where it's available (inside game scope).
9. **`function lifeStats()`** does not exist as a named declaration — it is referenced inline. Do not search for it as a function definition. Use `state.stats` directly.
10. **Camera mode values:** Valid values are only `'follow'` and `'wide'`. Never introduce `'normal'`.
11. **Audit before each patch** — run the 3 audit scripts (bug check, missing feature check, full check) to understand what you're working with before editing.

---

## 13. Key Design Decisions (Locked — Do Not Reverse)

These are final decisions made by the project owner. They may not be changed without explicit re-approval.

| # | Decision | What it means |
|---|---|---|
| 5-B | Biome traits visual only | No ROOT/HEAT/RSN gameplay modifiers on biomes. |
| 7 | Industrial Command Hangar theme | Keep hangar background + rivets + metallic card frames. No in-game HUD Quickbar. Keep B2 combo chip. |
| 8-B | Synthesized audio only | No audio files. Web Audio API synthesized sounds only. Fully offline. |
| 9-A | Camera button floating bottom-right | Mobile camera toggle = floating semi-transparent icon. |
| 11-A | Title / tagline locked | Title = "TANKTHILTETEYT". Tagline = "CONQUER EVERY BIOME". |
| 12-A | 5 home buttons | CASUAL, LEVEL MODE, ARMORY, AWARDS, ⚙ SETTINGS. |
| 13-A | Drag-to-spin home tank | Touch-drag the 3D tank on home screen to spin it. |
| 15-A | Minimap retractable | Tap to toggle 160px ↔ 60px. Elite=teal dots, bosses=pulsing skulls. |
| 16-B | Camera button placement | Floating, semi-transparent, bottom-right corner. |
| 20 | All 12 evolutions included | Full evolution pantheon (currently 6, MASTER_SPEC calls for 12 — 6 remain to be added). |
| 21-B | Evolution recipe | 2× primary + 1× secondary. |
| 22-A | Evolution unlock chance | Guaranteed in Boss Vault, 50% chance at standard level-up. |
| 23-A | Early sustain safety | First 5 level-ups guaranteed to offer regen + healOnKill (if not already owned). |
| 24-A | Rerolls | 1 free per run + Armory consumable rerolls. |
| 25-A | Armory = cosmetics + meta tree | Skins (cosmetics + archetypes) + Permanent Tech Tree (modest bonuses). |
| 26-A | Hull archetypes with gameplay impact | Each skin = a gameplay archetype with distinct base stats. |
| 27-A | 3 modes | Casual Endless + Level Mode (endless with configurable density/difficulty/start level, unlocks via `maxCleared`) + Boss Rush. |
| 28-A | Comprehensive settings | All 13 toggles must remain and persist. |
| 29-A | Pause build summary | Tank stat grid + card list + evolution progress section. |
| 30-A (modified) | Revive: no hard cap | 300 coins, ×4, unlimited revives. Cost scaling is the only limit. |
| 69 (Q69) | Crate intervals | Lv1–3: disabled. Lv4+: first crate at +12s, thereafter +40s±25s. |

---

## 14. Workspace File Index

All files are at `/home/user/` unless noted.

| File | Role |
|---|---|
| `TankThilteteYt02_011.html` | **CURRENT LATEST** — serve this |
| `TankThilteteYt02_010.html` | Previous stable — do not edit |
| `TankThilteteYt02_009.html` | Previous stable — do not edit |
| `TankThilteteYt02_008.html` | Archived — do not edit |
| `TankThilteteYt02_007.html` | Archived — do not edit |
| `TankThilteteYt02_006.html` | Archived — do not edit |
| `TankThilteteYt02_005.html` | Archived — do not edit |
| `TankThilteteYt02_004.html` | Archived — do not edit |
| `TankThilteteYt02_003.html` | Archived — do not edit |
| `TankThilteteYt02_002.html` | Archived — do not edit |
| `TankThilteteYt02_001.html` | Archived base — do not edit |
| `TankThilteteYt_HANDOFF.md` | **This file — the only reference document** |
| `_archive/TankThilteteYt.html` | Old pre-series draft — ignore |
| `_archive/TankThilteteYt_v2.html` | Old pre-series draft — ignore |
| `uploads/tank realm HUD.html` | Source Build 1 (reference only) |
| `uploads/tank realm HUD (2).html` | Source Build 2 (reference only) |
| `uploads/tank realm HUD3.html` | Source Build 3 — identical to B2 (reference only) |
| `uploads/tank-eternal_1.13_biome.html` | Source Build 4 (reference only) |

**Note:** `TankThilteteYt_MASTER_SPEC.md`, `TankGame_Analysis.md`, `TankGame_Feature_Matrix.md`, `TankGame_Blueprint_Audit.md`, and `TankThilteteYt02_FactCheck.md` were **deleted** — all information from them is preserved in this HANDOFF file.

---

## Quick-Start for New AI / Developer

1. **Read this file completely.**
2. Run `python3 -m http.server 3000 --bind 0.0.0.0` from `/home/user/`
3. Open `http://localhost:3000/TankThilteteYt02_011.html`
4. Play the game for 2 minutes to understand the flow.
5. When given a new task:
   - Run the audit scripts (see Section 3) to understand current state
   - Copy `_011.html` → `_012.html`
   - Make the change
   - Run syntax check + integrity checks
   - Present `_012.html`
6. Never edit a file that already has a successor.
7. When unsure about a design decision, check Section 13 before asking the user.

---

*End of handoff diary. Last updated: 2026-08-29. Current build: _011. Zero known bugs.*
