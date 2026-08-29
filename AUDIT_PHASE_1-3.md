# ULTIMATETANK — Consolidation Audit
## Phases 1–3: Mechanics Reconstruction, Claim Verification, Comparative Defect Catalog

**Audit date:** 2026-08-29
**Scope:** `TankThilteteYt01_v1.4.html`, `TankThilteteYt02_011.html`, `TankThilteteYt03_v1.4.html` + 4 handoff documents
**Method:** Static extraction + evaluation of every data table, function-level diffing, and **live execution** of extracted game logic in Node 22 (`vm` module) and jsdom. No claim in this document rests on inference alone — each carries a file:line citation or a reproduced execution result.

---

## 0. Corpus & Baseline Integrity

| Artifact | Lines | Bytes | Inline `<script>` blocks | Syntax errors |
|---|---|---|---|---|
| `TankThilteteYt01_v1.4.html` | 9,027 | 1,100,108 | 3 | **0** |
| `TankThilteteYt02_011.html` | 9,608 | 1,124,530 | 5 | **0** |
| `TankThilteteYt03_v1.4.html` | 9,792 | 1,123,000 | 3 | **0** |

Verified with the projects' own documented check (`node -e` / `vm.Script` over every inline block):

```
TankThilteteYt01_v1.4.html: inlineBlocks=3 ok=3 err=0 externalSkipped=1
TankThilteteYt02_011.html:  inlineBlocks=5 ok=5 err=0 externalSkipped=1
TankThilteteYt03_v1.4.html: inlineBlocks=3 ok=3 err=0 externalSkipped=1
```

All three diary claims of "0 syntax errors" are **confirmed TRUE**.

**Embedded engine:** Three.js r128, inlined, **byte-identical across all three builds** (MD5 `dec336e6c2912372f401c4559ddf2395`, 603,352 chars). This is ~55% of each file's byte size and is a pure constant — it should be factored out of any consolidation diff.

**Third-party injection (all three):** a Cloudflare Insights beacon (`static.cloudflareinsights.com/beacon.min.js`). Yt02 additionally carries a Cloudflare challenge-platform IIFE that injects a hidden 1×1 iframe (`TankThilteteYt02_011.html:9607`). These contradict every document's "100% offline / no CDN dependencies" claim — see **C-17**.

---

# PHASE 1 — DEEP DIVE & MECHANICS RECONSTRUCTION

## 1.1 Shared Legacy Baseline (identical in all three)

The following are **not** divergence points; they are inherited foundation and must be treated as the single source of truth in any merge:

| System | Verified values | Evidence |
|---|---|---|
| Engine | Three.js r128, WebGL, single scene graph | identical MD5 blob |
| Core constants | `playerSpeed 18`, `bulletSpeed 60`, `fireRate 0.25s`, `baseDamage 22` | `CONFIG` — Yt01:2188, Yt02:2461, Yt03:2549 |
| World streaming | `CHUNK = 48`, `CHUNK_TILES = 5` (240-unit terrain), `CHUNK_ENV_RADIUS = 2`, seeded per-chunk RNG | Yt01:~2255, Yt02:~2530, Yt03:~2610 |
| Enemy roster | **33 `ENEMY_TYPES`** (27 regular + 6 bosses), identical key sets | evaluated & compared |
| Bosses | 6 `BOSS_KINDS`, rotation `BOSS_KINDS[bossCount % 6]` | Yt01:5315, Yt02:5462, Yt03:5962 |
| Biomes | **10**, identical names, `hasWater:false` where present | evaluated & compared |
| Upgrade cards | **16 `CHOICE_UPGRADES`**, identical stats/order | evaluated & compared |
| Shop / meta | 15 `SHOP_ITEMS`, 5 `CONSUMABLES`, 14 `ACHIEVEMENTS`, 4 `DIFFICULTIES`, 6 `SKINS` | evaluated & compared |
| Audio | **25 `SFX` methods, identical inventory**, fully synthesized, no assets | evaluated & compared |
| State machine | `gamePhase: menu \| playing \| paused \| gameover` | all three |
| Cadence | Boss every **5** levels; biome every **3** levels; deferred via `pendingBiome` + `maybeTransitionBiome()` | Yt01:6039/3138, Yt02:6558/3395, Yt03:6942/3500 |
| Revive cost | `Math.round(300 * Math.pow(4, continuesThisRun))` | Yt01:7826, Yt02:8202, Yt03:8548 |
| Card pick guard | `overlay.dataset.picked` idempotency lock, 280 ms settle | byte-identical in all three |
| Renderer | `antialias:true`, `pixelRatio ≤ 1.25`, `PCFSoftShadowMap`, ACES filmic, per-biome `toneMappingExposure` | Yt01:2572, Yt02:2847, Yt03:2954 |
| Persistence | `localStorage['tank_save']` schema `v:3` via a `store` wrapper with in-memory fallback | all three |

**Quantified similarity** (function-name inventory + normalized line diff):

| Pair | Jaccard (functions) | Line similarity |
|---|---|---|
| Yt02 ↔ Yt03 | **0.920** | **85.6 %** |
| Yt01 ↔ Yt03 | 0.871 | 82.6 % |
| Yt01 ↔ Yt02 | 0.877 | 81.9 % |

222 of 264 distinct functions (84 %) are shared by all three. **Yt02 and Yt03 are the closest pair; Yt01 is the outlier.**

## 1.2 Core Game Loop Lifecycle

All three use one `requestAnimationFrame` driver:

```js
function animate() {
    requestAnimationFrame(animate);
    try {
        runChunkTasks(3);                                  // 3 chunk micro-ops/frame
        const dt = Math.min(clock.getDelta(), 0.1);        // dt clamp = 100 ms
        if (state.gamePhase === 'playing') { updatePhysics(dt); needsRender = true; }
        if (needsRender && renderer && scene && camera) { renderer.render(scene, camera); needsRender = false; }
    } catch (err) { console.error(err); }                  // one bad frame must not kill the loop
}
```

Per-build deltas:

| | Yt01 (`:7879`) | Yt02 (`:8266`) | Yt03 (`:8597`) |
|---|---|---|---|
| Signature | `animate()` | **`animate(now)`** | `animate()` |
| Frame limiter | none | **`fpsMode===30` throttle** (`_fpsInterval`) | none |
| Per-frame extra | `refreshCombatMeter()` throttled **0.15 s** | `updateCombatPolish(dt)` | `diagTick(dt)` |
| Render gate | `needsRender` | `(needsRender \|\| gamePhase==='playing')` | `needsRender` |

**Frame budget:** `dt` is clamped, never fixed-step. Physics is therefore **variable-timestep**; the only frame-rate-independent correction is the movement lerp `1 - Math.pow(0.85, dt*60)` (Yt01:4056). Timers mix two clocks — `state.runTime` (pause-safe) and `clock.getElapsedTime()` (not pause-safe). `lastFireTime` uses the *unsafe* clock in all three (Yt01:4686), while `speedBoostUntil`/`overchargeUntil` use the safe one. This is a latent pause-desync class shared by all builds.

## 1.3 State, Scenes & Transitions

Screens are `<div class="screen hidden">` toggled by `setScreenVisibility()`; gameplay *is* the canvas (all screens hidden). No scene graph is torn down between runs — `startGame()` clears arrays and rebuilds the player mesh.

`state.runTime` is the authoritative gameplay clock. `state.isChoosingUpgrade` and `state.marketOpen` hard-freeze `updatePhysics` (early return at the top of the wrapped `updatePhysics`).

## 1.4 Progression, Damage & Scoring

**XP/Level:** `xpToNext` starts at 250. **Card offer:** 3 picks (Yt01/Yt02 hard-coded; **Yt03 reads `HULL_ARCHETYPES[skin].cards`, so Gold = 4**).

**Player damage** (`shoot()`) is **byte-identical in all three**:

```js
damage = CONFIG.baseDamage * (playerStats.damage/100)
       * (runTime < overchargeUntil ? 1.3 : 1)
       * (runTime < blastUntil     ? 1.2 : 1)
```
Yt01:4749 · Yt02:~4900 · Yt03:~5300

**Enemy damage scaling** (`enemyLevelScale().dmg`) — **three different curves:**

| Level | Yt01 (`:5158`) | Yt02 (`:5308`) | Yt03 (`:5802`) |
|---|---|---|---|
| 1 | 1.000 | **1.050** | 1.000 |
| 10 | 1.288 | 1.482 | 1.432 |
| 20 | 1.768 | 2.122 | 2.072 |
| 30 | 2.468 | 2.982 | 2.932 |
| 50 | 3.868 | 4.702 | 4.652 |

```
Yt01: (1.00 + (L-1)*0.032) + (L-10)*0.016 + (L-20)*0.022
Yt02: (0.70 + (L-1)*0.032) * 1.5 + (L-10)*0.016 + (L-20)*0.022     ← note the ×1.5
Yt03: 1.0 + (L-1)*0.048 + (L-10)*0.016 + (L-20)*0.022
```

HP/Speed/Points scaling curves are identical across all three. Elite multiplier: `×1.15` at spawn (Yt01:6443, Yt02:6890, Yt03:7304) plus `×1.25` on a Yt03-only commander-buff path (`:7455`).

**Coin economy — three incompatible models:**

| | Formula | Evidence |
|---|---|---|
| Yt01 | `coinIncome = floor(base * 0.90)` — pure **10 % tax**, no bonus multipliers | `:8583` |
| Yt02 | `coinIncome = round(n * (1 + coinBonus/100 + runCoinBoost))` — no tax | `:9481` |
| Yt03 | `coinIncome = max(1, round(n * (1+coinBonus/100) * diffMult.coins * (1+runCoinBoost)))` | `:2257` |

Combo multiplier `min(2.2, 1 + combo*0.2)` and the `×0.5` payout rebalance are shared.

## 1.5 The Armor Divergence (the single largest mechanical split)

All three route damage through `hurtPlayerAt() → player.takeDamage()`, but the soak models are **structurally incompatible**:

| | Yt01 (`:4139`) | Yt02 (`:4393`) | Yt03 (`:4520`) |
|---|---|---|---|
| Pool location | `player.armor` | **`state.armorHp`** | `player.armorHp` |
| Pool size | flat `= playerStats.armor` | flat `= playerStats.armor` | **`floor(maxHp × armor/100)`** |
| Absorb | full soak, no floor | full soak | full soak, **early `return`** |
| HP floor | `max(0, incoming)` | **`max(incoming>0 ? 1 : 0, incoming)`** → **1-damage floor** | `max(0, incoming)` |
| Recharge | `regen` stat, 1:1, **no delay** | `0.5 + regen×0.25`, **no delay** | `max(1, maxArmor×0.10)/s` **after 3 s clean** |
| Combat-delay tracker | — | — | `state.lastDamagedAt` |
| Sizing helper | — | — | `armorPoolMax()` / `recalcArmorPool()` / `refillArmorPool()` |
| In-world visual | — | — | **3-D canvas-sprite bar** `updateArmorBar()` (`:4649`) |

Consequence: at 200 max HP with armor 8, Yt01/Yt02 give an **8-point** pool while Yt03 gives **16**. Yt03's pool scales with the HP build; the other two do not. Yt02's 1-damage floor means a 40-point hit fully absorbed by armor still costs 1 HP **if any damage leaks**, and Yt02 additionally plays `SFX.hurt()` unconditionally.

## 1.6 Auto-Aim (second-largest split)

| | Yt01 (`:6621`) | Yt02 (`:6984`) / Yt03 (`:7405`) |
|---|---|---|
| Algorithm | **10 s aim cycle** | **closest-enemy only** |
| Structure | `phase = (runTime - _aimCycleAt) % 10`; phase < 5 → slot alternates `prio`(60 %) / `close`(40 %) re-rolled every **0.85 s**; phase ≥ 5 → closest only | single pass, `min(distance)` |
| Priority | boss → highest threat (dmg → lowest HP → dist) → closest | none |
| Local override | if 1–2 enemies within `NEAR_AIM = 16`, use local boss→threat→closest | none |
| Stickiness | `dist *= 0.75` (25 %) | `dist *= 0.75` (25 %) |

Yt01's implementation matches its documentation exactly. Yt02/Yt03 retain the naive legacy selector — bosses receive no targeting priority.

## 1.7 Input, Events, Resource Lifecycle

**Input:** touch — left/right half split by `state.leftHanded`, joystick on the move half, fire on the other. Keyboard: WASD (+ **arrow keys in Yt03 only**). Space fires. `setupInputs()` registers listeners once at boot.

**Resource lifecycle:** `disposeObject3D()` helper + `SHARED_GEO` cached geometries + `bulletMatCache` material cache + `markShared()` to protect pooled materials. The **menu preview `WebGLRenderer` is never disposed in any build** — two live WebGL contexts persist for the page lifetime (shared legacy debt).

---

# PHASE 2 — CLAIM VERIFICATION & CODE INTEGRITY AUDIT

### Schema
**Claim** → **Verdict** → **Evidence** → **Analysis**

---

## A. Yt01 — `GAME_STATUS.md` / `DEVELOPMENT_DIARY.md`

**C-01** — **Claim:** "added `CONFIG.playerSpeedMaxMult` (2.6× ≈ 260 % of base). Both the player's actual movement speed and the SPD meter are clamped to it."
**Verdict:** `[TRUE]`
**Evidence:** `TankThilteteYt01_v1.4.html:2195` (`playerSpeedMaxMult: 2.6`); movement clamp `:4049-4053`; meter clamp `:7717-7718` (`spdShown = Math.min(spdLive, spdCapPct)`).
**Analysis:** Both sites present and correct. Only Yt01 has a speed ceiling; Yt02/Yt03 `CONFIG` blocks lack the key entirely.

---

**C-02** — **Claim:** "each Adrenaline Rush stack now also grants **+5 % damage** while the burst is active … Card text and the DMG meter reflect it."
**Verdict:** `[FALSE]` — **display-only; the engine does not apply it.**
**Evidence:**
- Card text promises it: `:8295` — `desc:'+25% speed & +5% damage for 1.5s after each kill (stacks)'`
- Meter applies it: `:7709` — `const adrDmg = adrActive ? (1 + 0.05 * adrN) : 1;` → folded into `dmgBoost` at `:7710`
- **Bullet damage does not:** `:4748-4752` — `shoot()` computes `CONFIG.baseDamage * (damage/100) * overcharge * blast`. No adrenaline term. Confirmed identical in Yt02/Yt03.

**Analysis:** The v1.4 tuning pass changed the *card copy* and the *HUD*, but not `shoot()`. A player holding 1 Adrenaline stack sees **105 %** on the DMG meter and deals **100 %** damage. This re-introduces, in inverted form, the exact defect class that v1.3 ("HUD tells the truth") existed to eliminate. The diary's own verification note — *"live math verified: … adrenaline burst → 125 % spd + 105 % dmg (1 stack)"* — is a verification of `refreshCombatMeter()` against a **stub DOM**, not of the damage pipeline. The claim "syntax-verified" was satisfied; the claim "applied" was not.

---

**C-03** — **Claim:** "the tank's **top speed is capped** (260 % of base) … stacking speed cards + Adrenaline can't make it uncontrollable."
**Verdict:** `[TRUE]`
**Evidence:** `:4049-4053` clamps `speed` before the movement vector; `:7718` clamps the displayed value. Cap = `18 × 2.6 = 46.8 u/s`.
**Analysis:** Correctly implemented in both the simulation and the readout.

---

**C-04** — **Claim:** "Armor … absorbs **all** incoming damage until it is reduced to zero, and **then** the excess hits your health. No % cap, no 3-damage floor."
**Verdict:** `[TRUE]`
**Evidence:** `:4168-4190` — `soaked`/`incoming` split, `actualDamage = Math.max(0, incoming)`.
**Analysis:** Genuine full soak, no floor. Note Yt01's pool is the **flat** `playerStats.armor` value, not a maxHp-derived pool.

---

**C-05** — **Claim:** "armor rebuilds at the same rate as your regen stat (more regen = faster armor back)."
**Verdict:** `[TRUE]`
**Evidence:** `:6608-6612` — `const armorRate = regenNow;`
**Analysis:** Exactly 1:1 with the HP regen stat, and **with no out-of-combat delay** — armor regenerates while being shot, which is materially more forgiving than Yt03's 3-second gate.

---

**C-06** — **Claim:** "a 15-card build system with 6 evolutions."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** `CHOICE_UPGRADES` evaluates to **16** entries (`speed, damage, fireRate, maxHp, regen, armor, crit, multishot, pierce, coinBonus, healOnKill, xpBonus, adrenaline, missile, splash, shield`). `EVOLUTIONS.length === 6` ✔.
**Analysis:** Evolutions correct (6). Card count wrong (16, not 15) — the "15" is the **`SHOP_ITEMS`** count, conflated into the card system in both Yt01 documents. Yt02 and Yt03 documents both correctly say 16.

---

**C-07** — **Claim:** "for your **first 3 upgrades** the hand always includes Health Regen … and Heal-on-Kill … plus one other random card."
**Verdict:** `[TRUE]`
**Evidence:** `:8629-8639` — `earlyCount = runCards.filter(c => !c.evo).length; earlyGuarantee = … earlyCount < 3;` then splices `regen` + `healOnKill` out of the pool.
**Analysis:** Correctly counted by **picks taken**, not by level — more robust than Yt03's level-window approach.

---

**C-08** — **Claim:** "every coin income source … passes through a single **10 % tax**, so the whole economy is tuned from one place."
**Verdict:** `[TRUE]`
**Evidence:** `:8583` — `const coinIncome = base => Math.max(0, Math.floor((Number(base)||0) * 0.90)); // TT: single-place coin tax`. Call sites `:5472`, `:6323`, `:7422`, `:8593`.
**Analysis:** Genuine single choke point. Trade-off: `coinIncome` itself applies **no** `coinBonus`/difficulty multiplier — Scavenger is instead applied upstream at `:8591`. The economy is centralized but split across two layers.

---

**C-09** — **Claim:** "Kept: all 6 bosses, 4 difficulties, save code, embedded Three.js."
**Verdict:** `[TRUE]`
**Evidence:** `BOSS_KINDS.length === 6`; `DIFFICULTIES` = `{easy, normal, hard, nightmare}`; `saveGame()` schema `v:3`.

---

**Analysis:** All four carried forward intact. Boss rotation, difficulty multipliers (`easy 0.7 / normal 1.0 / hard 1.3 / nightmare 1.6`) and the `v:3` save schema are shared legacy code, not Yt01-specific work.

**C-10** — **Claim:** *(implicit)* the build is internally consistent.
**Verdict:** `[FALSE]` — **latent evolution-ID mismatch.**
**Evidence:** `EVOLUTIONS` declares `id:'afterburner'` (`:8308`), so `applyUpgrade` sets `playerStats.evo_afterburner` (`:8719`). The game loop reads `evo_afterburner` correctly at `:4042`, `:5269`, `:5270`, `:7714`. **But the tank-visual sync reads the wrong name:** `:8568` — `if (ps._afterburn || ps.evo_afterburn) { // TT: normalized flag`.
**Analysis:** `evo_afterburn` is never set in Yt01. The Afterburner **gameplay works** (speed ×1.12, 3 s haste) but its **tank-model part never renders**. This is the identical bug class Yt02 catalogued as "Bug 1 (CRITICAL)" and fixed in `_010` — Yt01 never received the fix, and Yt01's diary does not mention it.

---

## B. Yt02 — `TankThilteteYt02_011_HANDOFF.md`

**C-11** — **Claim:** *(§5.7 / Fix 3)* "`dmgMult = 0.70 + Math.max(0, level - 1) * 0.032` … Enemy L1 damage base 0.70 (was 1.10) — **~63 % reduction**."
**Verdict:** `[FALSE]`
**Evidence:** `TankThilteteYt02_011.html:5314` —
```js
dmg: (0.70 + Math.max(0, L - 1) * 0.032) * 1.5
    + Math.max(0, L - 10) * 0.016
    + Math.max(0, L - 20) * 0.022,
```
Executed values: **L1 = 1.050**, L10 = 1.482, L20 = 2.122, L30 = 2.982.
**Analysis:** The `* 1.5` legacy multiplier was **never removed**; the documented formula omits it. Actual L1 damage is **1.05, not 0.70 — 50 % higher than documented**, and the real reduction from the 1.65 baseline is **36.4 %, not 63 %**. Yt02's enemies are the hardest of the three at every level.
**Methodology note (audit-critical):** the handoff's own mandatory `must_have` integrity list contains the string `"0.70 + Math.max(0, L - 1) * 0.032"` — a **substring** match that passes (1 occurrence found) while the executed expression multiplies by 1.5. The project's automated gate cannot detect this class of error.

---

**C-12** — **Claim:** *(§5.8)* "**7 biomes**, each with distinct sky colours … Visual only."
**Verdict:** `[FALSE]`
**Evidence:** `BIOMES.length === 10` in `TankThilteteYt02_011.html`. Names: Enchanted Forest, Frozen Tundra, Volcanic Wasteland, Golden Desert, Mystic Swamp, Crystal Caverns, Autumn Grove, **Sakura Valley, Blood Moon Canyon, Neon Void**.
**Analysis:** The document lists exactly 7 and omits the last three by name. "Visual only" is correct. This is stale documentation from an earlier build generation, carried forward through 11 patches without re-verification.

---

**C-13** — **Claim:** *(§5.4 / Decision 21-B)* "**Recipe:** 2× primary stat + 1× secondary stat." and `EVOLUTION_CARDS` lists `requires:{missile:2, splash:1}` etc.
**Verdict:** `[FALSE]` — **the entire `requires` table is inert; real gating is 1+1 presence.**
**Evidence:**
- `state.runCardsObj` is written at **only two sites**: `:6449` (restore from a snapshot that is itself always `{}`) and `:6462` (reset). **It is never incremented anywhere in the file.**
- `:5533` — `const cardCountFor = stat => (state.runCardsObj && state.runCardsObj[stat]) || 0;` → **always returns 0**.
- `:5534` — `function evolutionReady(e) { … cardCountFor(k)>=n … }` → **defined and never called** (0 call sites).
- The live path is `eligibleEvolutions()` at `:8792`: `const have = state.runCardStats || []; return ev.need.every(s => have.indexOf(s) >= 0);` — a **presence** test, not a count.

**Executed proof** (each build's real `eligibleEvolutions()` run under `vm`):

| Owned cards | Yt01 | **Yt02** | Yt03 |
|---|---|---|---|
| 1× missile + 1× splash | `["cluster"]` | **`["cluster","missileR"]`** | `[]` |
| 2× missile + 1× splash | `["cluster"]` | **`["cluster","missileR"]`** | `["cluster"]` |
| 1× pierce + 1× crit | `["prism"]` | **`["prism","phaseLance"]`** | `[]` |

**Analysis:** All 12 evolutions become reachable with a **single copy of each of two cards**, at roughly one-third the documented investment. Worse, `EVOLUTIONS` contains **two recipe collisions** — `cluster`/`missileR` both `need:['missile','splash']`, and `prism`/`phaseLance` both `need:['pierce','crit']` (10 distinct recipes for 12 evolutions) — so two different evolutions are simultaneously and indistinguishably eligible. Note the `bonuses:{}` half of `EVOLUTION_CARDS` **is** live (applied via `_ec.bonuses` in `applyUpgrade`, `:9241-9268`), so players receive the stat rewards; only the gating is broken.
**Collateral finding:** handoff "Bug 2 (CRITICAL)" claims the fix was to add `runCardsObj` to `snapshotRun()`. That fix is **inert** — it snapshots an object that is never populated. The reported symptom (evolution progress lost on resume) had a different root cause that was never addressed.

---

**C-14** — **Claim:** *(§5.6)* "**Regen:** 0.5 HP/s base + `playerStats.regen` bonus."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** `:6980` — `const armorRegenRate = 0.5 + (regenNow * 0.25);`
**Analysis:** Base 0.5/s is correct; the regen contribution is **0.25× per point, not 1×** — four times weaker than documented. "Regenerates even in combat" is correct (no delay gate).

---

**C-15** — **Claim:** *(§5.6)* "**Revive restore:** 50 % armor restored on continue."
**Verdict:** `[FALSE]`
**Evidence:** `buyContinue()` `:~8238` — `state.armorMaxHp = state.playerStats.armor; state.armorHp = state.playerStats.armor;`
**Analysis:** Armor is restored to **100 %**, not 50 %. (HP *is* correctly restored to 50 %: `player.hp = Math.ceil(player.maxHp * 0.5)`.)

---

**C-16** — **Claim:** *(§5.6)* "Incoming damage hits armor first: `absorbed = Math.min(armorPool, incoming)`. Only remaining damage hits `player.hp`."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** absorption `:4425-4428` is correct. But `:4441` — `const actualDamage = Math.max(this.isPlayer ? (incoming > 0 ? 1 : 0) : 1, incoming);`
**Analysis:** A **1-damage floor** applies to the player whenever any damage survives absorption. Undocumented, and it contradicts the "armor absorbs ALL damage" design intent stated in §5.6 and in Decision 5-B-adjacent text. Yt01 and Yt03 both use `Math.max(0, …)`.

---

**C-17** — **Claim:** *(§4 / §12 rule 4)* "no CDN dependencies at runtime … **Never use CDN links** in CSS or JS — the game must be 100 % offline."
**Verdict:** `[FALSE]`
**Evidence:** `TankThilteteYt02_011.html:9606` — Cloudflare Insights beacon `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/…">`; `:9607` — a Cloudflare challenge-platform IIFE injecting a hidden iframe that loads `/cdn-cgi/challenge-platform/scripts/jsd/main.js`. (Yt01:9025 and Yt03:9790 carry the beacon too.)
**Analysis:** Game *logic* is offline-capable, but the shipped files are **not** CDN-free. These are hosting-injected artifacts from a Cloudflare-fronted deploy that were saved back into the deliverable. They also constitute an analytics/tracking surface the documents never disclose.

---

**C-18** — **Claim:** *(§12 rule 9)* "`function lifeStats()` does not exist as a named declaration — it is referenced inline. Do not search for it as a function definition. **Use `state.stats` directly.**"
**Verdict:** `[PARTIALLY TRUE / MISLEADING]`
**Evidence:** `:5868` — `const lifeStats = () => state.stats || (state.stats = { kills:0, bossKills:0, … });`
**Analysis:** It is an arrow-function `const`, not a `function` declaration, so the literal statement holds. But it **is** a definition, it **is** searchable, and the advice to "use `state.stats` directly" is actively harmful: `lifeStats()` is what **lazily initialises** `state.stats`. Bypassing it risks `undefined` property access.

---

**C-19** — **Claim:** *(§11-A)* "`bumpDaily` is stubbed throughout (**9 call sites**, all no-ops)."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** `:5915` — `function bumpDaily(stat, value) { /* v26.9: daily challenges removed */ }`. Occurrences of `bumpDaily(`: 9 lines = **1 definition + 8 call sites**.
**Analysis:** "All no-ops" is TRUE; the count is 8, not 9.

---

**C-20** — **Claim:** *(§8 / §9)* "Zero known issues as of `_011`. The game is handoff-clean."
**Verdict:** `[FALSE]` — see the Yt02 defect register in Phase 3. Three duplicate top-level function declarations, a double-applied coin economy, and a fully dead evolution-gating table all ship in `_011`.

---

**Evidence:** D-01 (`:9102` vs `:9550` + `:9481`), D-02 (`:5533`/`:5534`/`:8792`), D-03 (dup scan), D-04 (`:5314`), D-07 (`:4441`), D-08 (`:9488`), D-11 (`:9539`), D-12 (`:8134`). Eight live defects, zero disclosed.

**Analysis:** Three separate classes of defect ship in `_011` and none appear in the document: a double-applied coin economy (D-01), a fully inert evolution-gating table (D-02), and three duplicate top-level function declarations (D-03). The claim is not merely optimistic — the document's own §10 simultaneously asserts a design gap and "zero known issues", an internal contradiction that survives to the final line ("Zero known bugs").

**C-21** — **Claim:** *(§5.1 / Issue 3)* "Boss Rush … Unlocked when `bossKills >= 5` OR `maxLevel >= 5` … always visible, greyed/locked (opacity 0.42, `pointer-events:none`, 🔒 icon)."
**Verdict:** `[TRUE]`
**Evidence:** `:1986` (markup, `opacity:0.42;pointer-events:none`), `:5978-5984` and `:8406-8411` (three unlock sites, all consistent).

---

**Analysis:** Correctly implemented and — unlike Yt03 — re-evaluated at three separate points, so the lock clears the moment the threshold is met without a reload.

**C-22** — **Claim:** *(Issues 4–7)* "Evolution pick had no celebration" · "Overcharge active with no time display" · "Enemy surge fired with zero warning" · "Death screen missing context".
**Verdict:** `[TRUE]` (all four)
**Evidence:** banner `:9271-9272` (`showUpgradeNotification('⚡ EVOLUTION: …')` + `SFX.levelUp()`); countdown `:8003-8004` (`' ⏱' + _overchgSecs + 's'`); surge warn `:7693-7701` (`_surgeWarnShown`); death cells `:2063-2064` (markup) + `:8144-8145` (population).

---

**Analysis:** All four `_011` UX items are genuinely present and wired. This is the strongest section of the Yt02 document and the clearest evidence that its defects are omissions rather than fabrications.

**C-23** — **Claim:** *(`_010` Bugs 4–5)* "Void Walker `arch:{}` had no `crit` field despite `archdesc` advertising +10 % Crit … Fixed" and "Aegis now grants 20 base armor pool when `playerStats.armor === 0` at run start."
**Verdict:** `[TRUE]` (both)
**Evidence:** `SKINS[4].arch.crit === 10` (evaluated); applied at `:6417`; `_aegisBonus` at `:6424-6425`.

---

## C. Yt03 — `TankThilteteYt03_v1.4_HANDOFF_DIARY.md`

**Analysis:** Both `_010` fixes are real. Note the revive-time crit patch (`:~8226`) is defensive only — it re-applies `arch.crit` if missing — which is a workaround for the archetype model rather than a fix to it.

**C-24** — **Claim:** *(§4.3)* "Pool size = `floor(maxHp × (armorStat / 100))`."
**Verdict:** `[TRUE]`
**Evidence:** `:2904-2907` — `armorPoolMax()` returns `Math.floor(base * ((state.playerStats.armor || 0) / 100))`.

---

**Analysis:** This is the defining Yt03 mechanic and it is implemented exactly as specified. It makes armor scale with the HP build, so a Juggernaut hull with 140 HP gets a 1.75× larger pool than an 80 HP hull at the same armor stat — a design the other two builds cannot express.

**C-25** — **Claim:** *(§4.3)* "after **3 seconds** without taking damage, the pool refills at **~10 %/s** (own rate, independent of HP regen)."
**Verdict:** `[TRUE]`
**Evidence:** `:7393-7400` — `if (_sinceDmg >= 3) { const _armRate = Math.max(1, player.maxArmor * 0.10); … }`; `state.lastDamagedAt` set in `takeDamage` at `:4549`.

---

**Analysis:** Exact match, including the `Math.max(1, …)` floor that keeps small pools from recharging imperceptibly slowly. The 3-second gate makes Yt03's armor materially harder to sustain under pressure than Yt01's ungated regen-coupled pool.

**C-26** — **Claim:** *(§5 v1.3)* evolutions 7–12 apply `overkill` (+20 % dmg, +1 multishot), `tempest` (+20 % fire rate, +12 % crit), `citadel` (+35 max HP, +8 armor, +1 regen), `phaseLance` (+2 pierce, +15 % dmg, +8 % crit), `predator` (+4 heal/kill, +15 % speed, +1 adrenaline).
**Verdict:** `[TRUE]` — exact match, all five.
**Evidence:** `applyEvolutionEffect()` `:9436-9450`; invoked from `applyUpgrade` `:9457`.

---

**Analysis:** Every number matches the executed source, including the `citadel` branch's paired `player.maxHp`/`player.hp` update. `missileRain` is correctly excluded from the switch and handled at fire time.

**C-27** — **Claim:** *(§1 / §4.5)* "Evolutions: 12 defined · **all 12 wired into gameplay**", with real 3-card recipes.
**Verdict:** `[TRUE]` — **Yt03 is the only build whose evolution gating is correct.**
**Evidence:** `cardCountFor` reads `state.runCardCounts` (`:9037`), which **is** incremented in `noteRunCard` (`:9069`); `evolutionReady` (`:9039`) is live via `eligibleEvolutions()` (`:9055`). Executed: 1×missile+1×splash → `[]`; 2×missile+1×splash → `["cluster"]`. **0 recipe collisions** (12 distinct recipes / 12 evolutions).

---

**Analysis:** Yt03 is the **only** build where the documented recipe and the executed gate agree. Its `runCardCounts` map is a single authoritative counter incremented in exactly one place — the pattern Yt02 attempted with `runCardsObj` and failed to wire.

**C-28** — **Claim:** *(§5 v1.4, Polish 3)* "**Arrow keys** now drive movement alongside WASD."
**Verdict:** `[TRUE]`
**Evidence:** `:8713-8714`. Verified by executing the extracted `updateKeyboardInput()` under `vm` with browser-normalised keys (`e.key.toLowerCase()`):

```
yt01: ArrowRight->(0,0)   ArrowUp->(0,0)    D->(1,0)  W->(0,-1)
yt02: ArrowRight->(0,0)   ArrowUp->(0,0)    D->(1,0)  W->(0,-1)
yt03: ArrowRight->(1,0)   ArrowLeft->(-1,0) ArrowUp->(0,-1) ArrowDown->(0,1)
```
**Analysis:** Implemented via lowercased key names (`keys['arrowright']`), which is why a case-sensitive search for `ArrowUp` finds nothing. Functionally correct; Yt03-exclusive.

---

**C-29** — **Claim:** *(§5 v1.4, Polish 1/2)* 3-D floating armor bar; `SLAM!` on heavy hits.
**Verdict:** `[TRUE]` (both)
**Evidence:** `updateArmorBar()` `:4649-4674` (canvas sprite, blue fill, `current/max` label, hidden when `maxA <= 0`); `SLAM!` `:7923-7924` gated on `damage >= 45 || siege`, flag set at `:4762`.

---

**Analysis:** Both implemented and reachable. The armor sprite correctly self-hides when `maxA <= 0`, and the `SLAM!` trigger threshold (45 damage or a siege slug) is documented in-code at `:4762`.

**C-30** — **Claim:** *(§5 v1.4, Polish 4)* "**Death-screen live meters** show final ⚡ SPD / 💥 DMG / 🛡️ ARM."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** `:8494-8502` — writes `'⚡ SPD ' + sp + '%  ·  💥 DMG ' + dmg + '%  ·  🛡️ ARM ' + arm` into `#death-stats`, where `sp = state.playerStats.speed`, `dmg = state.playerStats.damage`.
**Analysis:** The readout exists. It is **not "live"** — it reports raw base stat percentages, ignoring Overcharge/Blast/Adrenaline/roots-slow, unlike Yt01's `refreshCombatMeter()`. Calling them "live meters" overstates the feature.

---

**C-31** — **Claim:** *(§6 ⚠️ 1)* "Biome traits are inert (`biomeTraitOf` → `null`). Intentional … the `_rootSlow`/`_traitHot` code is now dead — safe to ignore or remove."
**Verdict:** `[TRUE]`
**Evidence:** `:4783-4785` — `function biomeTraitOf(biome) { … return null; }`.
**Analysis:** Correctly self-reported. Note the knock-on: Yt01's SPD meter has a `SLOWED` branch keyed on `state._rootSlow`; in Yt03 that branch is unreachable.

---

**C-32** — **Claim:** *(§1 / §4)* "Modes: Casual (endless w/ saves), Level Select, **Boss Rush**."
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** `startGame('bossrush')` `:9724`; progression `:5930-5937` (victory at `bossCount >= BOSS_KINDS.length`); cooldown shortened to 4 s `:5928`.
**Analysis:** Boss Rush exists and completes, but the unlock gate is evaluated **once at page load** (`const isUnlocked = …` `:9710`), so the label never refreshes after the player earns it without a reload. Gating also uses a **blocking `alert()`** (`:9722`) — a mobile anti-pattern. Yt02's implementation (three live unlock sites, non-blocking locked styling) is materially better.

---

**C-33** — **Claim:** *(§2.1)* file-size table, e.g. "`TankThilteteYt03_v1.4.html` | ~1,121,894".
**Verdict:** `[PARTIALLY TRUE]`
**Evidence:** actual = **1,123,000 bytes**.
**Analysis:** Minor drift; all nine listed predecessor files are absent from this repository (see C-35).

---

**C-34** — **Claim:** *(§6 ✅)* "Full compile of all inline scripts (0 syntax errors) … ~50 checks passing … 🔴 Known bugs: **None currently known.**"
**Verdict:** `[FALSE]`
**Evidence:** the syntax claim is TRUE (verified). But Yt03 ships two fully dead UI features — see **D-09 / D-10** in Phase 3 — neither of which appears in the known-limitations list.

---

**Analysis:** The compile claim holds. The "no known bugs" claim does not: two UI features are fully wired in JS (one with CSS) but have no HTML element, so both are permanently inert. Neither appears in the document's otherwise candid known-limitations list.

**C-35** — **Claim:** *(all three docs)* elaborate file inventories listing `TankThilteteYt01.html` … `_v1.3.html`, `TankThilteteYt02_001…_010.html`, `TankThilteteYt03.html … _v1.3.html`, plus `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, and `/home/user/uploads/`.
**Verdict:** `[UNVERIFIABLE — artifacts absent]`
**Evidence:** this repository contains **exactly 8 files**: `README.md`, the three HTML builds, and four Markdown docs.
**Analysis:** Every versioning/"never overwrite" convention, every PWA claim, and every rollback guarantee is **unfalsifiable against this repo**. Notably, Yt01's `GAME_STATUS.md` and `DEVELOPMENT_DIARY.md` both state the game "ships with a **PWA shell**" (`manifest.webmanifest`, `sw.js`, two icons, `index.html`) — **none of which exist here**. The PWA claim is `[UNVERIFIABLE]` and should be treated as unmet for consolidation purposes.

---

## D. Phase 2 Summary

35 documented claims tested.

| Verdict | Count |
|---|---|
| `[TRUE]` | 17 |
| `[PARTIALLY TRUE]` | 8 |
| `[FALSE]` | 9 |
| `[UNVERIFIABLE]` | 1 |

**Documentation reliability by build** (grouped by which build's document the claim appears in — note C-17 and C-35 concern all three builds but are filed once):

| Build | Claims tested | TRUE | PARTIAL | **FALSE** | UNVERIF | Assessment |
|---|---|---|---|---|---|---|
| Yt01 (C-01…C-10) | 10 | 7 | 1 | **2** (C-02, C-10) | 0 | Mechanics accurately described; one shipped display-only feature, one latent ID mismatch |
| Yt02 (C-11…C-23) | 13 | 3 | 4 | **6** (C-11, C-12, C-13, C-15, C-17, C-20) | 0 | **Lowest reliability.** Numbers, formulas and "zero known issues" all wrong |
| Yt03 (C-24…C-35) | 12 | 7 | 3 | **1** (C-34) | 1 (C-35) | **Highest reliability.** Self-reports its own dead code honestly |

**Accuracy rate:** Yt03 83 % fully-true · Yt01 70 % · Yt02 23 %.

---

# PHASE 3 — CROSS-BUILD COMPARATIVE MATRIX & DEFECT CATALOG

## 3.1 Legacy Baseline (inherited by all three)

Identical across builds and therefore **not** a merge decision:

- Three.js r128 blob (MD5-identical), renderer configuration, ACES tone mapping, pixel-ratio cap
- Chunk streaming (`CHUNK 48`, seeded per-chunk RNG, `runChunkTasks(3)`)
- 33 `ENEMY_TYPES` + 6 `BOSS_KINDS` + 10 `BIOMES` + 16 `CHOICE_UPGRADES` + 15 `SHOP_ITEMS` + 5 `CONSUMABLES` + 14 `ACHIEVEMENTS` + 4 `DIFFICULTIES`
- All 25 `SFX` methods (procedural audio, no assets)
- `gamePhase` state machine, screen visibility model, `setScreenVisibility()`
- Boss-every-5 / biome-every-3 cadence, `pendingBiome` deferral, `maybeTransitionBiome()`
- Revive cost `300 × 4ⁿ`; `pickUpgradeCard` idempotency guard; `noteRunCard`; `lifeStats()`
- `store` localStorage wrapper with in-memory fallback; save schema `v:3`
- Joystick/fire-half touch model, `leftHanded` swap
- `SHARED_GEO` / `bulletMatCache` / `markShared()` / `disposeObject3D()` resource pooling
- Boot guard: `try { … } catch (err) { console.error('Tank Realms boot error', err); }`

Headless boot test (jsdom + stubbed WebGL): **all three execute their full top-level scope and define the entire function layer cleanly** (`typeof startGame/animate/updatePhysics === 'function'`), failing only at canvas attachment — an artifact of the WebGL stub, not a build defect.

## 3.2 Divergence Tree

```
                    ┌──────────────────────────────────────────┐
                    │  COMMON ANCESTOR ("tank realm HUD" era)  │
                    │  naive closest-only auto-aim · flat      │
                    │  armor · 6 evolutions · 9 settings       │
                    └───────────────────┬──────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   ┌────▼─────┐                    ┌────▼─────┐                         │
   │  Yt01    │                    │  Yt02    │                         │
   │ "vX.Y"   │                    │ "_NNN"   │                         │
   └────┬─────┘                    └────┬─────┘                         │
        │                               │                               │
  • 10s aim cycle                 • FPS limiter (30/60)                 │
  • speed cap 2.6×                • window.onerror overlay              │
  • refreshCombatMeter 0.15s      • Boss Rush (3 live unlock sites)     │
  • ELITE boss-vault ×1.32        • 12 EVOLUTIONS + EVOLUTION_CARDS     │
  • coin 10% tax chokepoint       • damage-numbers / combat-popups      │
  • spawn-safe revive             • armor pool on `state`               │
  • armor = regen, no delay       • armor regen 0.5+0.25×regen          │
  • evolutionRoleFor UI hints     • home-tank canvas reparenting        │
  • 6 evolutions (correct gate)   • 12 evolutions (BROKEN gate)         │
  • NO Boss Rush                  • duplicate fn block appended         │
        │                               │                               │
        │                               └───────────────┬───────────────┘
        │                                               │  (85.6% line similarity)
        │                                          ┌────▼─────┐
        └──────────────────────────────────────────│  Yt03    │
                                                   │ "_NN_vX.Y"│
                                                   └────┬─────┘
                                                        │
                                          • armor pool = floor(maxHp × armor%)
                                          • 3s out-of-combat recharge @10%/s
                                          • 3D canvas-sprite armor bar
                                          • TECH_TREE (5) + HULL_ARCHETYPES (6)
                                          • archetypes are ABSOLUTE (=), not deltas
                                          • per-skin card count (Gold = 4)
                                          • 12 evolutions, CORRECT count gate
                                          • applyEvolutionEffect() stat evos
                                          • arrow keys · SLAM! text
                                          • starting-shield preservation
                                          • NO spawn-safe revive, NO boss rush
                                            polish, 2 dead UI features
```

**Rationale reconstruction:** Yt01 pursued *feel and honesty* (aim AI, HUD truthfulness, speed cap, revive fairness). Yt02 pursued *feature breadth and tooling* (modes, settings, error overlay, FPS cap) at the cost of code hygiene. Yt03 pursued *systemic depth* (scaling armor, tech tree, hull identity) on top of Yt02's structure.

## 3.3 Subsystem Matrix

Scores: **5** best-in-class … **1** unacceptable. Weighted equally across the four axes.

### Rendering
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | 3 | 3 | 3 | 3 | **12** |
| Yt02 | 3 | **4** | 3 | **4** | **14** |
| Yt03 | 3 | 3 | 3 | 3 | **12** |

Shared renderer config. Yt02 wins on the 30 FPS cap (battery/thermal headroom on mid-range phones) and on the global `window.onerror`/`unhandledrejection` overlay. All three leak the preview `WebGLRenderer`. **Best in class: Yt02.**

### Input
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | 3 | 3 | 3 | 3 | **12** |
| Yt02 | 3 | 3 | 3 | 3 | **12** |
| Yt03 | **4** | 3 | **4** | 3 | **14** |

Identical touch layer. Yt03 adds arrow-key support (executed-verified) with a clear comment. **Best in class: Yt03.**

### Physics / Collision
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | **4** | **4** | **4** | 3 | **15** |
| Yt02 | 3 | 3 | 3 | 2 | **11** |
| Yt03 | 3 | 3 | 3 | 3 | **12** |

Sphere-distance collision is shared. Yt01 wins on the aim/targeting layer (boss and threat priority, 16-unit local override, timed cycle) and on the speed cap that keeps the movement model bounded. Yt02 loses points for the undocumented 1-damage floor and the uncapped speed stack. **Best in class: Yt01.**

### UI / HUD
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | **4** | 3 | **4** | 3 | **14** |
| Yt02 | **4** | 3 | 3 | 3 | **13** |
| Yt03 | 3 | 2 | 3 | 2 | **10** |

Yt01: `refreshCombatMeter()` on a clean 0.15 s throttle, bar-width matched to value, `BOOST`/`SLOWED` labels, capped SPD, evolution-role hints on cards — the most honest HUD. Yt02: 5-column pause grid, live damage pill with countdown, retractable minimap, damage-number and combat-popup toggles — the most configurable. Yt03: 3-D armor bar and `SLAM!` are strong, but two wired features are dead (D-09/D-10) and the death-screen "live" meters are base-value only. **Best in class: Yt01.**

### Audio
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | 3 | 3 | 3 | 3 | **12** |
| Yt02 | 3 | 3 | 3 | 3 | **12** |
| Yt03 | 3 | 3 | 3 | 3 | **12** |

**Byte-for-byte identical 25-method `SFX` inventory.** No divergence. **Best in class: tie** — carry any one forward unchanged.

### Entity Management
| | Mod | Perf | Read | ErrH | **Total** |
|---|---|---|---|---|---|
| Yt01 | 3 | 3 | **4** | 3 | **13** |
| Yt02 | 2 | 3 | 2 | 2 | **9** |
| Yt03 | **4** | 3 | **4** | 3 | **14** |

Yt03 wins: `armorPoolMax()`/`recalcArmorPool()`/`refillArmorPool()` centralise derived state; `runCardCounts` is a single authoritative counter; `applyEvolutionEffect()` is one explicit switch instead of scattered flags; `HULL_ARCHETYPES` + `TECH_TREE` separate identity from progression. Yt02 loses heavily: `runCardsObj` vs `runCardStats` duplicate card-count state (one permanently empty), and three duplicate top-level function declarations. **Best in class: Yt03.**

### Subsystem winners

| Subsystem | Best in class | Rationale |
|---|---|---|
| Rendering | **Yt02** | FPS limiter + global error overlay |
| Input | **Yt03** | Only build with arrow keys (verified) |
| Physics / Collision | **Yt01** | Aim priority AI + bounded top speed |
| UI / HUD | **Yt01** | Honest, throttled, capped meters |
| Audio | **Tie** | Identical — no decision needed |
| Entity Management | **Yt03** | Centralised derived state, no duplication |

## 3.4 Tech Debt & Vulnerability Registry

Severity: **P0** blocks release · **P1** ships wrong behaviour · **P2** maintainability/robustness · **P3** cosmetic.

| ID | Sev | Build(s) | Defect | Evidence | Impact |
|---|---|---|---|---|---|
| **D-01** | **P0** | Yt02 | **Coin economy double-applies Scavenger and Lucky Charm.** `addKillReward` is declared twice; the winner wraps its payout in `coinIncome()`, which re-applies both multipliers. | decls `:9102` & `:9550`; `coinIncome` `:9481` | Executed: 1× Scavenger → **1.253×** intended; 4× Scavenger → **exactly 2.000×**; Lucky Charm → 1.194×. Baseline (no bonuses) is correct, so the bug is invisible until a player invests in coin upgrades |
| **D-02** | **P0** | Yt02 | **Evolution gating table is dead.** `runCardsObj` is never incremented → `cardCountFor()` ≡ 0 → `evolutionReady()` never called. Live path is a 1+1 presence check. | `:5533`, `:5534`, `:8792`; writes only at `:6449`/`:6462` | All 12 evolutions unlock at ~⅓ intended cost; 2 recipe collisions make 4 evolutions mutually ambiguous |
| **D-03** | **P1** | Yt02 | **Three duplicate top-level function declarations** — `quickSaveFromPause` (`:6284`/`:9524`), `addKillReward` (`:9102`/`:9550`), `updateCombo` (`:9116`/`:9577`). Later silently wins. | dup scan | Edits to the earlier copy have **zero effect**. Root cause of D-01 |
| **D-04** | **P1** | Yt02 | **Enemy damage curve mis-documented and mis-shipped** — stray `* 1.5` never removed. | `:5314` | L1 = 1.05 (doc says 0.70); hardest build at every level; the project's own substring integrity check cannot detect it |
| **D-05** | **P1** | Yt01 | **Adrenaline +5 % damage is display-only.** Card text and DMG meter promise it; `shoot()` does not apply it. | `:8295`, `:7709` vs `:4749` | Player-visible stat fraud; re-opens the v1.3 "HUD lies" defect class |
| **D-06** | **P1** | Yt01 | **Afterburner evolution ID mismatch.** Data says `afterburner`; the tank-visual sync reads `evo_afterburn`. | `:8308` vs `:8568` | Gameplay works, cosmetic model part never renders. Same bug Yt02 fixed in `_010` |
| **D-07** | **P1** | Yt02 | **Undocumented 1-damage floor** on the player whenever damage survives armor. | `:4441` | Contradicts the stated "armor absorbs ALL" design; trivial chip damage through a full pool |
| **D-08** | **P1** | Yt02 | **`applyReviveSafety()` is never called.** `spawnSafeUntil` is therefore never set, so `spawnBlocked()` (`:6844`) always returns false. | def `:9488`, 0 call sites | No spawn grace, no bullet/missile clear, no fire-hush after revive — while the toast still claims "3s safe" |
| **D-09** | **P1** | Yt03 | **`#diag-overlay` element does not exist.** `diagTick()` runs every frame, computes FPS/entity/chunk stats, then early-returns. | JS `:8456-8460`, called `:8602`; 0 HTML matches | Diagnostics feature dead + wasted per-frame work. Works in Yt02, which has the element |
| **D-10** | **P1** | Yt03 | **`#dmg-direction` element does not exist** (CSS `:810` and JS `:8333` both present). | 0 HTML matches; Yt02 has it at `:1919` | Damage-direction indicator arc silently dead across 4 call sites, including every `hurtPlayerAt` |
| **D-11** | **P2** | Yt02 | **`renderBuildSummary()` is dead and buggy** — `Object.entries(state.runCards\|\|{})` treats an **array** as a count map; `.filter(([,n])=>n>0)` always drops everything. | def `:9539`, 0 call sites | Would render "No cards yet" permanently if ever wired |
| **D-12** | **P2** | Yt02 | **`game-over-mode-label` element does not exist**; `if(modeLabel)` guard makes it a silent no-op. | `:8134` | Death screen never shows the mode label |
| **D-13** | **P2** | all | **~200 empty `catch {}` blocks per build** (Yt01 203, Yt02 197, Yt03 200) | regex scan | Systematic exception swallowing; the single largest obstacle to diagnosing any field issue |
| **D-14** | **P2** | all | **Listener asymmetry:** 54/69/70 `addEventListener` vs **1** `removeEventListener` | scan | Benign today (all registrations are boot-time or on discarded nodes), but any future re-render path leaks immediately |
| **D-15** | **P2** | all | **Preview `WebGLRenderer` never disposed** — 2 live WebGL contexts for the page lifetime | Yt01 `:8932`, Yt02 `:5734`, Yt03 `:6211` | Browsers cap ~16 contexts; a repeated menu rebuild would exhaust them |
| **D-16** | **P2** | all | **Mixed clock domains.** `lastFireTime` uses `clock.getElapsedTime()` (not pause-safe) while buff timers use `state.runTime`. | Yt01 `:6689`, Yt02 `:7022`, Yt03 `:7443` | Fire-rate timing drifts across pause/resume; contradicts Yt03's own convention §9.8 |
| **D-17** | **P2** | all | **CDN/telemetry injection** in shipped files (Cloudflare beacon; Yt02 also a challenge-platform iframe) | Yt01 `:9025`, Yt02 `:9606-9607`, Yt03 `:9790` | Contradicts "100 % offline"; undisclosed analytics surface |
| **D-18** | **P2** | Yt03 | **Boss Rush unlock evaluated once at page load**; uses blocking `alert()` | `:9710`, `:9722` | Lock label goes stale until reload; modal blocks the render loop on mobile |
| **D-19** | **P2** | Yt03 | **Early-card guarantee gates on `state.level` (2–6), not picks taken**, and never checks ownership | `:9337` | Force-reoffers Nano Repair/Field Medic repeatedly; desyncs after revive or Head Start. Self-reported as "user choice" |
| **D-20** | **P3** | all | **`#hp-panel` referenced, never defined** in any build | dom-id scan | Dead lookup; Yt01's diary acknowledges it |
| **D-21** | **P3** | Yt02, Yt03 | **Stale HUD-quickbar references** (`btn-assist`, `btn-camera`, `btn-settings`, `btn-sound`, `hud-quickbar`) — elements exist only in Yt01 | dom-id scan | Dead branches from the pre-Decision-7 HUD |
| **D-22** | **P3** | Yt01 | **`evo-detail` overlay has no open-guard** — repeated triggers stack multiple `#evo-detail` nodes | `:8398-8412` | Cosmetic stacking; listeners are GC'd with each node |
| **D-23** | **P3** | all | **No true concurrency, but two ordering hazards:** (a) `pickUpgradeCard`'s 280 ms `setTimeout(finish)` can outlive a rapid restart; (b) `takeDamage`'s 80 ms emissive-reset `setTimeout` fires after mesh disposal (null-guarded by `if (c.material)`) | Yt01 `:8713` / `:4214`; Yt02 `:9235` / `:4456`; Yt03 `:9433` / `:4589` | Guarded; low risk, worth hardening in the merge |

### Race conditions
No true concurrency exists (single-threaded, no `Worker`, no `await` in gameplay). The two ordering hazards in **D-23** are the only temporal defects. **Memory leaks:** **D-15** (preview renderer) is the only confirmed leak; **D-14** is latent. **Unhandled exceptions:** none escape — every loop body is wrapped; the cost is **D-13**'s silence. **Stale listeners:** none active; **D-21** documents the stale *element* references.

---

## 3.5 Consolidation Recommendation (preliminary — for Phase 4 ratification)

The evidence does **not** support adopting any single build wholesale.

**Recommended skeleton: Yt03**, because it has (a) the only correct evolution gating, (b) the most coherent entity/state model, (c) the highest documentation reliability (1 FALSE of 12 claims), and (d) 85.6 % line parity with Yt02, so Yt02-only features port cheaply.

**Mandatory transplants:**

| From | Take | Replaces / fixes |
|---|---|---|
| **Yt01** | 10 s aim cycle + boss/threat priority (`:6621-6670`) | Yt03's naive closest-only aim |
| **Yt01** | `CONFIG.playerSpeedMaxMult` + movement & meter clamp (`:2195`, `:4049`, `:7717`) | Unbounded speed stacking in Yt03 |
| **Yt01** | `refreshCombatMeter()` on a 0.15 s throttle (`:7705-7731`) | Yt03's base-value-only death meters |
| **Yt01** | Spawn-safe revive: `spawnSafeUntil` + bullet clear + missile-timer reset (`:7855-7859`) | Yt03 has none of this |
| **Yt02** | `fpsMode` 30/60 limiter (`:8266-8272`) | Yt03 has no frame cap |
| **Yt02** | `window.onerror` / `unhandledrejection` overlay (`:1836-1844`) | Yt03 fails silently |
| **Yt02** | Boss Rush unlock wiring — three live sites, non-blocking locked styling (`:5975-5986`) | Yt03's load-time-only + `alert()` |
| **Yt02** | `#dmg-direction` + `#diag-overlay` **markup** (`:1919`, and the diag element) | Yt03's D-09 / D-10 dead features |
| **Yt02** | Damage-number & combat-popup toggles | Yt03 has 9 settings vs Yt02's 12 |

**Mandatory fixes regardless of skeleton:** D-01/D-03 (delete the duplicate block), D-02 (wire real counts — Yt03 already solves this), D-04 (delete `* 1.5`), D-05 (apply `adrDmg` in `shoot()` **or** revert the card text), D-06 (rename `evo_afterburn` → `evo_afterburner`), D-07 (drop the 1-damage floor), D-08 (call `applyReviveSafety()` or delete it), D-17 (strip CDN injection).

**Armor model must be a single explicit Phase 4 decision** — Yt03's `floor(maxHp × armor%)` with a 3 s recharge gate is the most defensible design, but it is not a drop-in for Yt01's regen-coupled flat pool, and every armor-adjacent HUD, save field and pickup refill differs between them.

---

# 🛑 CRITICAL STOPPING POINT

**Phases 1, 2 and 3 are complete.** Execution is halted here.

Awaiting explicit confirmation to proceed to **Phase 4 — Interactive Architecture Decision Framework**.

Phase 4 will present a numbered decision checklist running from foundational engine architecture down to micro-mechanics, visual/UI treatment and naming conventions. Each entry will state how **Yt01**, **Yt02** and **Yt03** each handle it, in plain language, with a recommendation and a `Your Call` line for your decision.
