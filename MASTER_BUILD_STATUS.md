# MASTER BUILD STATUS — TankGameAi

Base build: **Yt02** (`TankThilteteYt02_011.html`) — decision **Q001**
Shipped artifact: **`TankGameAi_001.html`** — decision **Q002**
Source layout: **split sources in `src/`, concatenated by `tools/build.js`** — decision **Q123**
Decisions on record: **131** (from `DECISION_CHECKLIST ANSWERED.docx`, commit `44be16b`)

```
node tools/split.js      # one-time: re-extract src/ from the Yt02 base (lossless-verified)
node tools/build.js 001  # assemble TankGameAi_001.html from src/
node tools/check.js      # release harness: 4 smoke checks + 4 behaviour tests
node tools/test-boot.js  # boot the built file in jsdom, report runtime errors
```

---

## Verified right now

`node tools/check.js` → **16/16 checks passed**.

| Check | Result |
|---|---|
| all 4 embedded script blocks parse | PASS |
| no duplicate top-level declarations (D-03) | PASS |
| must-have: crash overlay / diag overlay / damage-direction element | PASS ×3 |
| must-have: `applyReviveSafety`, `hushHostileFire` | PASS ×2 |
| external telemetry + Cloudflare challenge stripped (Q004) | PASS ×2 |
| afterburner spelling unique (Q134) | PASS ×2 |
| boots in jsdom with zero runtime errors | PASS |
| **B1** coin payout applies Scavenger exactly once (Q054) | PASS |
| **B2** evolution needs required COUNTS, not presence (Q131) | PASS |
| **B3** fully soaked armour hit costs 0 HP (Q128) | PASS |
| **B4** revive sets a real spawn pause (Q073/D-08) | PASS |

`tools/split.js` round-trips the Yt02 game script **exactly** (423,170 chars both ways), so the
decomposition into `src/` is provably lossless. The built file differs from Yt02 only by the
intended deltas listed below.

---

## Decisions implemented so far

| Decision | What changed | Where |
|---|---|---|
| **Q001** | Yt02 adopted as the base skeleton | `tools/split.js` source |
| **Q002** | Output named `TankGameAi_001.html`, never overwritten | `tools/build.js` |
| **Q004** | Cloudflare Insights beacon + challenge iframe removed | `tools/split.js` (lines 9606-9607 not carried) |
| **Q007** | `<title>` and home-screen `<h1>` now read `TankGameAi` | `src/00_head_open.html`, `src/06_dom.html` |
| **Q010** | `CONFIG.playerSpeedMaxMult = 2.6` exposed as a tunable constant | `src/10_data.js` |
| **Q054** | Kill-payout chain rewritten; bonuses apply **once**; `CONFIG.killPayoutScale = 0.5` exposed. Fixes **D-01** (Scavenger + Lucky Charm were squared) | `src/40_persist_polish.js` |
| **Q098** | Balance constants begin centralising in `CONFIG` | `src/10_data.js` |
| **Q119 / D-03** | Three duplicate top-level declarations deleted (dead copies of `addKillReward`, `updateCombo`, `quickSaveFromPause`) | `src/38_cards_evos.js`, `src/32_run_flow.js` |
| **Q123** | Split sources + one-command concatenation build | `src/`, `tools/build.js` |
| **Q128 / D-07** | Hidden 1-damage floor removed for the player | `src/26_tank_combat.js` |
| **Q131 / D-02** | `runCardsObj` now incremented in one place; `eligibleEvolutions()` is count-based off `EVOLUTION_CARDS.requires{}`; Missile Rain recipe de-duplicated to `2 missile + 1 multishot` | `src/38_cards_evos.js`, `src/30_meta.js` |
| **Q134** | `afterburn` → `afterburner` everywhere, incl. `evo_afterburner`; grep-enforced | 4 files |
| **Q135** | Evolution card names converted to Title Case | `src/30_meta.js` |
| **Q073 / D-08** | `applyReviveSafety()` and `hushHostileFire(5)` now actually called on revive; toast text corrected | `src/34_physics_hud.js` |
| **Q137 / Q096** | Release harness: syntax + duplicate-decl + must-have greps + the four behaviour tests | `tools/check.js` |

---

## Still to implement

The 131 answers break down as: **~62 "identical, keep as-is"** (no code change) and **~69 requiring
work**. Of the latter, **16 are done**. The remainder, grouped:

**P0 / high impact**
- **Q031** parameterise `CONFIG.enemyDmg = {base, slope, mid, late}`, Yt03 numbers default + Yt01 easy preset — also removes Yt02's stray `*1.5` (**D-04**)
- **Q016/Q017/Q018/Q020** armour merge: Yt03 pool math + 3s-delay recharge as the engine, Yt02 HUD overlay, Yt01 pickup refill, Yt02 Aegis 20-base-pool fix
- **Q115** add `runCardCounts` to `snapshotRun()` and restore on resume
- **Q011** Adrenaline: 60s duration + visible countdown + the +5%/stack made real in `shoot()`
- **Q013** homing missiles stack count up to 10, then blast radius/damage scale
- **Q022** first 5 picks force a card only if not already owned

**P1**
- **Q038** port Yt01's six bespoke boss phase fights + Yt03 generic enrage fallback
- **Q039** Warlord full nerf (projectile speed 18, interval 6.4s)
- **Q044** biome transition: 10s gradual morph, 1.5s fire-hush, 3s no-spawn, no radar tint
- **Q047** destructible cover HP scales — two player hits at any level
- **Q030/Q138** tank-part system: Yt01 framework + Yt03 12-evo parts, single barrel regardless of multishot
- **Q062/Q064/Q116** Armory + Workshop tabs, consumable price loop (×3 every 5, reset at 6), tech tree with save persistence
- **Q075/Q129** 3-lane combat meter + 5-column pause grid merge
- **Q125/Q117** save migrator (`ice`→`glacier`) + load-time validator

**P2**
- **Q003** PWA package (manifest + sw.js + icons)
- **Q049/Q051/Q052** airdrop schedule, 70% repair for first 10 levels, crate table trimmed to 5 kinds
- **Q066** remove daily challenges entirely (9 no-op `bumpDaily` call sites)
- **Q063** remove Second Wind
- **Q037** boss cadence: 10s breather, +50% HP on kill, spawns halved while boss lives
- **Q127** one pause-safe clock everywhere
- **Q081/Q088/Q105/Q118/Q079** HUD and camera polish
- **Q097/Q136** generated-numbers documentation script

---

## Notes for the next pass

- `EVOLUTIONS` (in `src/38_cards_evos.js`) and `EVOLUTION_CARDS` (in `src/30_meta.js`) are still two
  parallel tables. Q131 made `requires{}` authoritative for unlocking, but the presentation table
  should eventually be folded in so there is one list.
- `tools/test-boot.js` and `tools/check.js` both stub `THREE.WebGLRenderer`; jsdom cannot compile
  shaders. This exercises game logic, not rendering.
- `state.runCardStats` is now redundant with `state.runCardsObj`. It is still written by
  `noteRunCard()`; nothing reads it for gating any more.
- `tools/.node/` holds jsdom for the harness and is git-ignored.
