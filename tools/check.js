#!/usr/bin/env node
/**
 * tools/check.js — release harness for the master build.
 *
 * Decision Q137: keep syntax + must-have greps as SMOKE checks, and add four behaviour
 * tests that would have caught every P0 found across all three audits. Decision Q096
 * folds in Yt02's must-have list and Yt01's meter-truth rule. Decision Q134 requires the
 * single afterburner spelling to be grep-enforced.
 *
 *   node tools/check.js [TankGameAi_001.html]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.node', 'node_modules', 'jsdom'));

const file = path.resolve(__dirname, '..', process.argv[2] || 'TankGameAi_001.html');
const html = fs.readFileSync(file, 'utf8');
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); };

// ---------------------------------------------------------------- 1. SMOKE: syntax
// Every embedded <script> block must parse. Catches the defect class that three builds
// shipped duplicate top-level declarations through.
const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let syntaxFails = 0;
blocks.forEach((code, i) => {
  try { new vm.Script(code, { filename: `block${i}` }); }
  catch (e) { syntaxFails++; check(`syntax of embedded script block ${i}`, false, e.message.split('\n')[0]); }
});
check(`syntax: all ${blocks.length} embedded script blocks parse`, syntaxFails === 0,
      syntaxFails ? `${syntaxFails} block(s) failed` : 'ok');

// ------------------------------------------- 2. SMOKE: no duplicate top-level decls
// Depth-aware, so function-local variables are not mistaken for collisions. This is the
// check that would have caught Yt02's three duplicate declarations (audit defect D-03).
function topLevelDuplicates(code) {
  const lines = code.split('\n');
  const DECL = /^\s*(?:function\s*\*?\s*|const\s+|let\s+|var\s+|class\s+)([A-Za-z_$][\w$]*)/;
  let depth = 0; const seen = new Map(); const dupes = [];
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    if (depth === 0) {
      const m = DECL.exec(ln);
      if (m) {
        if (seen.has(m[1])) dupes.push(`${m[1]} @${seen.get(m[1])} & @${i + 1}`);
        else seen.set(m[1], i + 1);
      }
    }
    let c = ln.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    c = c.replace(/"(\\.|[^"\\])*"/g, '""').replace(/'(\\.|[^'\\])*'/g, "''").replace(/`(\\.|[^`\\])*`/g, '``');
    depth += (c.match(/[{}]/g) || []).reduce((a, ch) => a + (ch === '{' ? 1 : -1), 0);
    if (depth < 0) depth = 0;
  }
  return dupes;
}
const gameBlocks = blocks.filter(b => b.includes('addKillReward'));
const allDupes = gameBlocks.flatMap(topLevelDuplicates);
check('no duplicate top-level declarations (D-03)', allDupes.length === 0,
      allDupes.length ? allDupes.join(', ') : 'ok');

// ------------------------------------------------------- 3. SMOKE: must-have strings
const MUST_HAVE = [
  ['id="ty-error-overlay"', 'crash overlay element (Q005/Q130 sibling)'],
  ['id="diag-overlay"',     'diagnostics overlay element (Q105/Yt02)'],
  ['id="dmg-direction"',    'damage-direction arc element (Q130)'],
  ['afterburner',           'afterburner id (Q134)'],
  ['function applyReviveSafety', 'revive safety helper (Q073)'],
  ['function hushHostileFire',   'enemy fire hush helper (Q073)'],
];
MUST_HAVE.forEach(([needle, why]) => check(`must-have: ${why}`, html.includes(needle), needle));

const MUST_NOT = [
  ['cloudflareinsights.com', 'external telemetry stripped (Q004)'],
  ['challenge-platform',     'Cloudflare challenge iframe stripped (Q004)'],
];
MUST_NOT.forEach(([needle, why]) => check(`must-NOT-have: ${why}`, !html.includes(needle), needle));

// Q134: exactly one spelling of the afterburner id may exist.
const afterburnerCount = (html.match(/afterburner/g) || []).length;
const afterburnCount   = (html.match(/afterburn(?!er)/g) || []).length;
check('Q134 afterburner spelling is unique (no bare "afterburn")', afterburnCount === 0,
      `afterburner x${afterburnerCount}, afterburn x${afterburnCount}`);

// ------------------------------------------------- 4. BEHAVIOUR: boot + four assertions
const vc = new VirtualConsole();
const bootErrors = [];
vc.on('jsdomError', e => bootErrors.push('jsdomError: ' + (e.message || e)));
vc.on('error', (...a) => bootErrors.push('console.error: ' + a.join(' ')));

const GL_STUB = () => new Proxy({}, { get: (t, k) => {
  if (k === 'getParameter') return () => 'stub';
  if (k === 'getExtension') return () => null;
  if (k === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
  if (typeof k === 'string' && /^[A-Z_]+$/.test(k)) return 0;
  return () => {};
}, set: () => true });
const CTX2D = () => new Proxy({
  canvas: { width: 512, height: 512 },
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => null,
  measureText: () => ({ width: 10 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
}, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });

const RENDERER_STUB = `<script>
(function(){ if (typeof THREE==='undefined') return; var R=THREE.WebGLRenderer;
 THREE.WebGLRenderer=function(o){var c=(o&&o.canvas)||document.createElement('canvas');
 return new Proxy({domElement:c,shadowMap:{enabled:false,type:0},capabilities:{isWebGL2:false,getMaxAnisotropy:function(){return 1;}},
 info:{render:{calls:0,triangles:0},memory:{geometries:0,textures:0}},outputEncoding:0,toneMapping:0,autoClear:true},
 {get:function(t,k){if(k in t)return t[k];if(k==='getSize')return function(v){v=v||{};v.width=800;v.height=600;return v;};
 if(k==='getPixelRatio')return function(){return 1;};return function(){};},set:function(){return true;}});};
 THREE.WebGLRenderer.prototype=R.prototype;})();
</script>`;

const dom = new JSDOM(html.replace('</head>', RENDERER_STUB + '\n</head>'), {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = function (t) {
      if (String(t).indexOf('webgl') === 0) return GL_STUB();
      if (t === '2d') return CTX2D();
      return null;
    };
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  },
});

setTimeout(() => {
  const w = dom.window;
  // Top-level let/const are in the global lexical scope, reachable only via eval.
  const ev = (src) => { try { return { ok: true, v: w.eval(src) }; } catch (e) { return { ok: false, v: e.message }; } };

  const overlay = w.document.getElementById('ty-error-overlay');
  // Behaviour tests return JSON; if a test aborts early it returns a plain reason string.
  const parsed = (r) => { if (!r.ok) return { __err: r.v }; try { return JSON.parse(r.v); } catch (e) { return { __err: String(r.v) }; } };
  check('boots with zero runtime errors', bootErrors.length === 0 && !(overlay && overlay.style.display !== 'none'),
        bootErrors.length ? bootErrors[0].slice(0, 140) : 'ok');

  // --- behaviour 1 (Q054): Scavenger applies exactly once ---
  const b1 = ev(`(function(){
    state.combo = 0; state.runCoins = 0;
    state.playerStats = { coinBonus: 25 };          // one Scavenger
    state.runCoinBoost = 0;                          // no Lucky Charm
    var before = state.coins = 0;
    var paid = addKillReward({ pointValue: 100 });
    // combo increments to 1 -> x1.2 ; floor(120*0.5)=60 ; coinIncome x1.25 -> 75
    return JSON.stringify({ paid: paid, expected: 75, coins: state.coins });
  })()`);
  const r1 = parsed(b1);
  check('B1 (Q054) coin payout applies Scavenger exactly once',
        r1.paid === 75 && r1.coins === 75,
        r1.__err ? r1.__err : `paid ${r1.paid}, expected 75 (doubled bonus would give 94)`);

  // --- behaviour 2 (Q131): evolution unlock requires the stated card COUNTS ---
  // Sets state.runCardsObj, which is the counter eligibleEvolutions() actually reads.
  // Includes a positive control so the test cannot pass by finding nothing eligible.
  const b2 = ev(`(function(){
    try {
      var card = EVOLUTION_CARDS.find(function(e){ return e.id === 'cluster'; });
      if (!card) return 'no cluster evolution';
      state.evolutions = [];
      // ONE of each prerequisite: presence, but not the required counts
      state.runCardsObj = { missile: 1, splash: 1 };
      var underCount = eligibleEvolutions().map(function(e){ return e.id; }).indexOf('cluster') >= 0;
      // exact required counts: must now be eligible
      state.runCardsObj = JSON.parse(JSON.stringify(card.requires));
      var exactCount = eligibleEvolutions().map(function(e){ return e.id; }).indexOf('cluster') >= 0;
      return JSON.stringify({ requires: card.requires, underCount: underCount, exactCount: exactCount });
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r2 = parsed(b2);
  check('B2 (Q131) evolution needs required COUNTS, not mere presence',
        r2.underCount === false && r2.exactCount === true,
        r2.__err ? r2.__err : `requires ${JSON.stringify(r2.requires)}; eligible with 1 of each: ${r2.underCount} (want false); eligible at exact counts: ${r2.exactCount} (want true)`);

  // --- behaviour 3 (Q128): a fully soaked armour hit costs 0 HP ---
  // Calls the REAL Tank.prototype.takeDamage on a minimal stand-in, so the armour soak
  // and the damage-floor line under test are the shipped ones, not a re-implementation.
  const b3 = ev(`(function(){
    try {
      state.shieldUp = false; state.invulnUntil = 0; state.bastionSoakUntil = 0;
      state.armorHp = 50; state.runTime = 100;
      var fake = { isPlayer: true, isDead: false, hp: 100, maxHp: 100,
                   mesh: { position: { x: 0, y: 0, z: 0 }, traverse: function () {} },
                   updateHpBar: function () {} };
      Tank.prototype.takeDamage.call(fake, 10);
      var fullySoaked = { hp: fake.hp, armor: state.armorHp };
      // second hit: 60 damage against 40 armour left -> 20 must reach HP exactly
      state.armorHp = 40; fake.hp = 100;
      Tank.prototype.takeDamage.call(fake, 60);
      var partSoaked = { hp: fake.hp, armor: state.armorHp };
      return JSON.stringify({ full: fullySoaked, part: partSoaked });
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r3 = parsed(b3);
  check('B3 (Q128) fully soaked armour hit costs 0 HP, part soak is exact',
        r3.full && r3.full.hp === 100 && r3.part && r3.part.hp === 80,
        r3.__err ? r3.__err : `full soak HP ${r3.full.hp} (want 100); part soak HP ${r3.part.hp} (want 80, floor would give 80 too)`);

  // --- behaviour 4 (Q073/D-08): revive produces a real spawn pause ---
  const b4 = ev(`(function(){
    state.runTime = 100; state.spawnSafeUntil = 0;
    applyReviveSafety();
    return JSON.stringify({ safeUntil: state.spawnSafeUntil, blocked: spawnBlocked() });
  })()`);
  const r4 = parsed(b4);
  check('B4 (Q073/D-08) applyReviveSafety sets a real spawn pause',
        r4.blocked === true && r4.safeUntil === 103,
        r4.__err ? r4.__err : `spawnSafeUntil ${r4.safeUntil}, spawnBlocked() ${r4.blocked}`);

  // --- behaviour 5 (Q031/Q032): enemy curve reads CONFIG, and presets swap it ---
  const b5 = ev(`(function(){
    try {
      var out = {};
      [1, 10, 20, 30, 50].forEach(function(L){
        state.level = L;
        var s = enemyLevelScale();
        out['L'+L] = { dmg: +s.dmg.toFixed(4), hp: +s.hp.toFixed(4) };
      });
      // preset swap must change the ramp without touching the function
      var saved = CONFIG.enemyDmg;
      CONFIG.enemyDmg = CONFIG.enemyCurvePresets.easy.dmg;
      state.level = 30;
      out.easyL30 = +enemyLevelScale().dmg.toFixed(4);
      CONFIG.enemyDmg = saved;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r5 = parsed(b5);
  // Yt03 numbers: dmg = 1.0 + (L-1)*0.048 + max(0,L-10)*0.016 + max(0,L-20)*0.022
  //   L1 = 1.0000, L10 = 1.4320, L20 = 2.0720, L30 = 2.9320, L50 = 4.6520
  // easy preset at L30 = 1.0 + 29*0.032 + 20*0.016 + 10*0.022 = 2.4680
  const want5 = { L1: 1.0, L10: 1.432, L20: 2.072, L30: 2.932, L50: 4.652 };
  const b5ok = !r5.__err && Object.keys(want5).every(k => Math.abs(r5[k].dmg - want5[k]) < 1e-9)
               && Math.abs(r5.L30.hp - 1.87) < 1e-9 && Math.abs(r5.easyL30 - 2.468) < 1e-9;
  check('B5 (Q031/Q032) enemy damage curve matches Yt03 numbers; presets swap live', b5ok,
        r5.__err ? r5.__err : `dmg ${JSON.stringify(Object.fromEntries(Object.keys(want5).map(k=>[k,r5[k].dmg])))}, hp@L30 ${r5.L30.hp}, easy@L30 ${r5.easyL30}`);

  // --- behaviour 6 (Q115): evolution progress survives a save/resume round trip ---
  const b6 = ev(`(function(){
    try {
      // snapshotRun() guards on a live casual run, so stand one up first
      state.mode = 'casual';
      if (!player) player = { isPlayer: true, isDead: false, hp: 80, maxHp: 100,
                              mesh: { position: { x: 1, y: 0, z: 2 }, traverse: function () {} },
                              updateHpBar: function () {} };
      state.playerStats = state.playerStats || { maxHp: 100 };
      state.runCardsObj = { missile: 2, splash: 1 };
      state.evolutions = ['bastion'];
      var snap = snapshotRun();
      if (!snap) return 'snapshotRun() returned null';
      // a new run wipes the live counters; the snapshot must be unaffected (deep copy)
      state.runCardsObj = {}; state.runCardsObj.missile = 9; state.evolutions = [];
      return JSON.stringify({
        snapObj: snap.runCardsObj, snapEvos: snap.evolutions,
        liveNow: state.runCardsObj
      });
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r6 = parsed(b6);
  check('B6 (Q115) snapshot deep-copies the evolution counter',
        !!r6.snapObj && r6.snapObj.missile === 2 && r6.snapObj.splash === 1
        && Array.isArray(r6.snapEvos) && r6.snapEvos[0] === 'bastion'
        && r6.liveNow.missile === 9,
        r6.__err ? r6.__err : `snapshot ${JSON.stringify(r6.snapObj)}, evos ${JSON.stringify(r6.snapEvos)}, live after wipe ${JSON.stringify(r6.liveNow)}`);

  // --- behaviour 7 (Q022): the early-game force-offer guard has real data to read ---
  // showUpgradeChoices() suppresses the forced regen/healOnKill cards with
  //   !(state.runCardStats || []).includes(stat)
  // so if runCardStats were never populated, every card would look unowned and the first
  // five hands would always be forced. noteRunCard() is the single writer.
  const b7 = ev(`(function(){
    try {
      state.runCards = []; state.runCardStats = []; state.runCardsObj = {}; state.evolutions = [];
      noteRunCard({ stat: 'regen', icon: 'x', text: 'Nano Repair' });
      noteRunCard({ stat: 'healOnKill', icon: 'x', text: 'Scrap Fever' });
      noteRunCard({ stat: 'regen', icon: 'x', text: 'Nano Repair' });
      return JSON.stringify({
        stats: state.runCardStats,
        counts: state.runCardsObj,
        regenOwned: state.runCardStats.indexOf('regen') >= 0,
        hokOwned:   state.runCardStats.indexOf('healOnKill') >= 0
      });
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r7 = parsed(b7);
  check('B7 (Q022) noteRunCard populates the ownership list the force-offer guard reads',
        r7.regenOwned === true && r7.hokOwned === true && r7.counts.regen === 2,
        r7.__err ? r7.__err : `stats ${JSON.stringify(r7.stats)}, counts ${JSON.stringify(r7.counts)}`);

  // --- behaviour 8 (Q013): missile volley cap and overload rollover ---
  const b8 = ev(`(function(){
    try {
      var out = {};
      [0, 1, 3, 10, 11, 15].forEach(function(n){
        var p = missileVolleyPlan(n);
        out['s'+n] = { count: p.count, overload: p.overload };
      });
      out.interval = CONFIG.missile.launchInterval;
      out.cap = CONFIG.missile.maxPerVolley;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r8 = parsed(b8);
  const b8ok = !r8.__err
    && r8.s0.count === 0  && r8.s0.overload === 0
    && r8.s1.count === 1  && r8.s3.count === 3
    && r8.s10.count === 10 && r8.s10.overload === 0
    && r8.s11.count === 10 && r8.s11.overload === 1
    && r8.s15.count === 10 && r8.s15.overload === 5
    && r8.interval === 5 && r8.cap === 10;
  check('B8 (Q013) volley caps at 10, extra stacks become overload, cadence fixed', b8ok,
        r8.__err ? r8.__err : JSON.stringify(r8));

  // --- behaviour 9 (Q011): Adrenaline duration, real damage, meter parity ---
  const b9 = ev(`(function(){
    try {
      var AD = CONFIG.adrenaline, out = {};
      out.duration = AD.duration;
      // buff down: both multipliers must be exactly 1
      state.runTime = 0; state.speedBoostUntil = 0;
      state.playerStats.adrenaline = 3; state.playerStats.evo_afterburner = false;
      out.downDmg = adrenalineDamageMult(); out.downSpd = adrenalineSpeedMult();
      // buff up
      state.speedBoostUntil = 60;
      out.upDmg0 = adrenalineDamageMult();                 // 3 stacks -> but set explicitly below
      state.playerStats.adrenaline = 0; out.spd0 = +adrenalineSpeedMult().toFixed(4);
      state.playerStats.adrenaline = 1; out.spd1 = +adrenalineSpeedMult().toFixed(4);
      state.playerStats.adrenaline = 2; out.spd2 = +adrenalineSpeedMult().toFixed(4);
      out.dmg2 = +adrenalineDamageMult().toFixed(4);       // 1 + 0.05*2
      state.playerStats.adrenaline = 4; out.dmg4 = +adrenalineDamageMult().toFixed(4);
      // afterburner doubles duration and adds x1.12 to speed
      state.playerStats.adrenaline = 1; state.playerStats.evo_afterburner = true;
      out.spdAb = +adrenalineSpeedMult().toFixed(4);
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r9 = parsed(b9);
  const b9ok = !r9.__err
    && r9.duration === 60
    && r9.downDmg === 1 && r9.downSpd === 1
    && r9.spd0 === 1.25 && r9.spd1 === 1.5 && r9.spd2 === 1.75   // Yt02 math preserved
    && Math.abs(r9.dmg2 - 1.10) < 1e-9 && Math.abs(r9.dmg4 - 1.20) < 1e-9
    && Math.abs(r9.spdAb - 1.5 * 1.12) < 1e-9;
  check('B9 (Q011) Adrenaline is 60s, +5%/stack damage is real, meter matches movement', b9ok,
        r9.__err ? r9.__err : JSON.stringify(r9));

  // --- behaviour 10 (Q016/Q017/Q018): armour pool is derived, delayed, refillable ---
  const b10 = ev(`(function(){
    try {
      var out = {};
      if (!player) player = { isPlayer:true, isDead:false, hp:100, maxHp:100,
                              mesh:{position:{x:0,y:0,z:0},traverse:function(){}}, updateHpBar:function(){} };
      player.maxHp = 200;
      state.playerStats.maxHp = 200; state.playerStats.armor = 10;
      out.poolMax = armorPoolMax();                    // floor(200 * 10/100) = 20
      // recalcArmorPool(false) derives the max and CLAMPS; it must not invent pool.
      state.armorHp = 999;                             // over-full, must clamp down to 20
      recalcArmorPool(false);
      out.afterRecalc = { max: state.armorMaxHp, hp: state.armorHp };
      // recalcArmorPool(true) credits growth instead
      state.armorHp = 5; recalcArmorPool(true);
      out.afterRecalcGain = state.armorHp;             // 5 + (20 - 20) = 5, no growth yet
      // taking a hit must stamp the clean-window clock (the recharge delay depends on it)
      state.runTime = 500; state.lastDamagedAt = 0; state.armorHp = 20;
      player.hp = 100; state.shieldUp = false; state.invulnUntil = 0; state.bastionSoakUntil = 0;
      Tank.prototype.takeDamage.call(player, 5);
      out.lastDamagedAt = state.lastDamagedAt;         // must now be 500
      out.armorAfterHit = state.armorHp;               // 20 - 5 = 15
      out.hpAfterHit = player.hp;                      // untouched
      // growing max HP must grow the pool (pool is %-of-maxHp, not a flat number)
      player.maxHp = 400; state.playerStats.maxHp = 400;
      recalcArmorPool(true);
      out.poolAfterHpGrowth = { max: state.armorMaxHp, hp: state.armorHp };  // 40, credited +20
      // pickups top it up
      state.armorHp = 4; refillArmorPool(1);
      out.afterRefill = state.armorHp;                 // back to 40
      out.cfg = CONFIG.armor;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r10 = parsed(b10);
  const b10ok = !r10.__err
    && r10.poolMax === 20
    && r10.afterRecalc.max === 20 && r10.afterRecalc.hp === 20
    && r10.afterRecalcGain === 5
    && r10.lastDamagedAt === 500
    && r10.armorAfterHit === 15 && r10.hpAfterHit === 100
    && r10.poolAfterHpGrowth.max === 40 && r10.poolAfterHpGrowth.hp === 35
    && r10.afterRefill === 40
    && r10.cfg.regenDelay === 3 && r10.cfg.regenPerSec === 0.10 && r10.cfg.aegisBasePool === 20;
  check('B10 (Q016/17/18) armour pool derives from max HP, stamps delay clock, refills', b10ok,
        r10.__err ? r10.__err : JSON.stringify(r10));

  // --- behaviour 11 (Q039): Warlord is nerfed to Yt03's numbers ---
  const b11 = ev(`(function(){
    try {
      var bk = BOSS_KINDS.find(function(b){ return b.type === 'warlord'; });
      return JSON.stringify({
        shotSpeed: ENEMY_SHOT.warlord.speed,
        interval: bk ? bk.interval : null,
        // the other five bosses must be untouched
        others: BOSS_KINDS.filter(function(b){ return b.type !== 'warlord'; })
                          .map(function(b){ return b.type + ':' + b.interval; })
      });
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r11 = parsed(b11);
  check('B11 (Q039) Warlord shells at 18 and interval 6.4s; other bosses untouched',
        !r11.__err && r11.shotSpeed === 18 && r11.interval === 6.4,
        r11.__err ? r11.__err : `shotSpeed ${r11.shotSpeed} (want 18), interval ${r11.interval} (want 6.4), others ${JSON.stringify(r11.others)}`);

  // --- behaviour 12 (Q047): cover breaks in two player shells at any level ---
  const b12 = ev(`(function(){
    try {
      var out = { pool: CONFIG.cover.hitsToBreak };
      // at base damage a player shell is exactly the reference, so it costs 1 unit
      state.playerStats.damage = 100;
      out.ref = coverReferenceDamage();
      out.costNormalShell = +coverHitCost(out.ref).toFixed(4);
      // level-independence: player damage x4 raises the reference and the shell together
      state.playerStats.damage = 400;
      var ref4 = coverReferenceDamage();
      out.costAt4x = +coverHitCost(ref4).toFixed(4);
      // a weak enemy shell scores below 1, so cover survives longer against it
      state.playerStats.damage = 100;
      out.costEnemyShell = +coverHitCost(12).toFixed(4);
      // simulate: two player shells break it, four enemy shells do not break in two
      var hp = CONFIG.cover.hitsToBreak;
      hp -= coverHitCost(coverReferenceDamage()); out.afterOne = +hp.toFixed(4);
      hp -= coverHitCost(coverReferenceDamage()); out.afterTwo = +hp.toFixed(4);
      var hp2 = CONFIG.cover.hitsToBreak;
      hp2 -= coverHitCost(12); hp2 -= coverHitCost(12); out.enemyAfterTwo = +hp2.toFixed(4);
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r12 = parsed(b12);
  const b12ok = !r12.__err
    && r12.pool === 2
    && r12.costNormalShell === 1 && r12.costAt4x === 1        // level-independent
    && Math.abs(r12.afterOne - 1) < 1e-9 && r12.afterTwo <= 0 // two shells break it
    && Math.abs(r12.costEnemyShell - 12 / 22) < 1e-4   // value is reported to 4dp
    && r12.enemyAfterTwo > 0;                                 // enemy needs more hits
  check('B12 (Q047) cover takes exactly two player shells at any level; enemies take longer', b12ok,
        r12.__err ? r12.__err : JSON.stringify(r12));

  // --- behaviour 13 (Q125/Q117): save migration and validation ---
  const b13 = ev(`(function(){
    try {
      var out = {};
      // old save carrying the retired 'ice' skin id, schema v3
      var old = { v: 3, coins: 1200, skins: { owned: ['amber', 'ice'], selected: 'ice' },
                  meta: { hp: 3 }, achUnlocked: ['first_blood'], casual: { best: 500, saves: [], auto: null } };
      var m = sanitizeSave(migrateSave(JSON.parse(JSON.stringify(old))));
      out.renamed = { owned: m.skins.owned, selected: m.skins.selected, v: m.v };
      out.preserved = { coins: m.coins, ach: m.achUnlocked, meta: m.meta };
      // v2 save: a single snapshot must land in the auto slot
      var v2 = { v: 2, coins: 10, casual: { best: 0, snapshot: { level: 7 } } };
      out.v2 = sanitizeSave(migrateSave(v2)).casual.auto;
      // hostile input: wrong types, nulls, negatives — must degrade, never throw
      var bad = { v: 'three', coins: 'lots', meta: null, skins: 42, achUnlocked: 'nope',
                  consumables: { lucky: -5, aegis: 'x' }, fpsMode: 144, quality: 'ultra' };
      var b = sanitizeSave(migrateSave(bad));
      out.bad = { coins: b.coins, meta: b.meta, owned: b.skins.owned, selected: b.skins.selected,
                  ach: b.achUnlocked, lucky: b.consumables.lucky, aegis: b.consumables.aegis,
                  fps: b.fpsMode, quality: b.quality, v: b.v };
      // migrateSave must reject non-objects rather than throw
      out.rejectsNull = migrateSave(null) === null;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r13 = parsed(b13);
  const b13ok = !r13.__err
    && r13.renamed.selected === 'glacier' && r13.renamed.owned.join(',') === 'amber,glacier'
    && r13.renamed.v === 4
    && r13.preserved.coins === 1200 && r13.preserved.ach[0] === 'first_blood' && r13.preserved.meta.hp === 3
    && r13.v2 && r13.v2.level === 7
    && r13.bad.coins === 0 && r13.bad.lucky === 0 && r13.bad.aegis === 0
    && r13.bad.selected === 'amber' && Array.isArray(r13.bad.owned) && r13.bad.owned.length === 0
    && Array.isArray(r13.bad.ach) && r13.bad.fps === 60 && r13.bad.quality === 'auto'
    && r13.rejectsNull === true;
  check('B13 (Q125/Q117) saves migrate ice->glacier, v2 slots carry over, bad fields degrade', b13ok,
        r13.__err ? r13.__err : JSON.stringify(r13));

  // --- behaviour 14 (Q044): biome change is gradual and grants safety windows ---
  const b14 = ev(`(function(){
    try {
      var BC = CONFIG.biome, out = { cfg: BC, biomeCount: BIOMES.length };
      if (!player) player = { isPlayer:true, isDead:false, hp:100, maxHp:100,
                              mesh:{ position:{x:0,y:0,z:0}, traverse:function(){} }, updateHpBar:function(){} };
      state.runTime = 200; state.spawnSafeUntil = 0; state.enemyFireMuteUntil = 0;
      state.currentBiome = 0; state.pendingBiome = null;
      startBiomeMorph(3);
      out.spawnSafeUntil = state.spawnSafeUntil;              // 200 + 3
      out.fireMuteUntil = state.enemyFireMuteUntil;           // 200 + 1.5
      out.morphDur = biomeBlend ? biomeBlend.dur : null;
      out.morphStartDelta = biomeBlend ? null : null;
      out.currentBiome = state.currentBiome;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r14 = parsed(b14);
  const b14ok = !r14.__err
    && r14.biomeCount === 10
    && r14.cfg.changeEveryLevels === 3 && r14.cfg.morphDurationMs === 10000
    && r14.cfg.fireHushSec === 1.5 && r14.cfg.noSpawnSec === 3
    && r14.spawnSafeUntil === 203 && Math.abs(r14.fireMuteUntil - 201.5) < 1e-9
    && r14.morphDur === 10000 && r14.currentBiome === 3;
  check('B14 (Q044) 10 biomes / 3 levels / 10s morph, with fire-hush and spawn pause', b14ok,
        r14.__err ? r14.__err : JSON.stringify(r14));

  // --- behaviour 15 (Q064): consumable price loop ---
  const b15 = ev(`(function(){
    try {
      var C = CONFIG.consumables, out = { cfg: C };
      var lucky = CONSUMABLES.find(function(c){ return c.id === 'lucky'; });
      out.base = lucky.base;
      var costs = [];
      for (var n = 0; n <= 7; n++) {
        consumables().lucky = n;
        costs.push(shopCost(lucky));
      }
      out.costs = costs;
      consumables().lucky = 0;
      // an Armory item must keep its uncapped per-purchase growth
      var arm = SHOP_ITEMS.find(function(i){ return !i.cycle; });
      state.meta = state.meta || {};
      state.meta[arm.id] = 0; var c0 = shopCost(arm);
      state.meta[arm.id] = 3; var c3 = shopCost(arm);
      out.armory = { id: arm.id, at0: c0, at3: c3, grows: c3 > c0 };
      out.armoryIsCycling = !!arm.cycle;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r15 = parsed(b15);
  // base 400, x3 per step, 5-step loop: 400 1200 3600 10800 32400 400 1200 3600
  const want = [400, 1200, 3600, 10800, 32400, 400, 1200, 3600];
  const b15ok = !r15.__err
    && r15.cfg.cycleLength === 5 && r15.cfg.priceMultPerStep === 3
    && JSON.stringify(r15.costs) === JSON.stringify(want)
    && r15.armory.grows === true && r15.armoryIsCycling === false;
  check('B15 (Q064) consumables price x3 per step and reset every 5; Armory unchanged', b15ok,
        r15.__err ? r15.__err : `costs ${JSON.stringify(r15.costs)} want ${JSON.stringify(want)}; armory ${JSON.stringify(r15.armory)}`);

  // --- behaviour 16 (Q038): six bespoke phase bosses + generic fallback + summon count ---
  const b16 = ev(`(function(){
    try {
      var out = {};
      out.bespoke = Object.keys(BESPOKE_PHASE_BOSSES).sort();
      // bossSummon must honour its count argument
      var made = [];
      var orig = makeScaledEnemy;
      makeScaledEnemy = function (kind, x, z) { made.push(kind); };
      try {
        bossSummon({ type: 'colossus', mesh: { position: { x: 0, z: 0 } } }, 'scout', 3);
        out.summon3 = made.length;
        made = [];
        bossSummon({ type: 'colossus', mesh: { position: { x: 0, z: 0 } } }, 'scout');
        out.summonDefault = made.length;
      } finally { makeScaledEnemy = orig; }
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r16 = parsed(b16);
  // all six bespoke bosses must have a PHASE banner in the shipped source
  const sixBanners = ['WARLORD', 'COLOSSUS', 'NOVA', 'TITAN', 'TEMPEST', 'FORTRESS']
    .every(n => html.includes(n + ' \u2014 PHASE 2') && html.includes(n + ' \u2014 PHASE 3'));
  const b16ok = !r16.__err
    && JSON.stringify(r16.bespoke) === JSON.stringify(['colossus','fortress','nova','tempest','titan','warlord'])
    && r16.summon3 === 3 && r16.summonDefault === 2
    && sixBanners
    && html.includes('PHASE 3: ENRAGED');
  check('B16 (Q038) six bespoke phase fights, generic enrage fallback, summon honours count', b16ok,
        r16.__err ? r16.__err : `bespoke ${JSON.stringify(r16.bespoke)}, summon(3)=${r16.summon3}, summon()=${r16.summonDefault}, all six banners=${sixBanners}`);

  // --- behaviour 17 (Q062/Q063/Q116): Workshop tree, Second Wind gone, ranks persist ---
  const b17 = ev(`(function(){
    try {
      var out = {};
      out.nodes = TECH_TREE.length;
      out.ids = TECH_TREE.map(function(t){ return t.id; });
      // Q062/Q063: Second Wind must be gone from the Armory
      out.secondWind = SHOP_ITEMS.some(function(i){ return i.id === 'revive'; });
      // cost ladder: armor base 150 step 150 -> 150, 300, 450, 600, 750
      state.tech = { armor: 0, speed: 0, shield: 0, reroll: 0, damage: 0 };
      out.armorCosts = [0,1,2,3,4].map(function(l){ state.tech.armor = l; return techCost(TECH_TREE[0]); });
      // buyTech respects balance and maxLevel
      state.coins = 1000; state.tech.armor = 0;
      out.bought = buyTech('armor');
      out.coinsAfter = state.coins;                      // 1000 - 150
      out.levelAfter = state.tech.armor;
      state.coins = 0; out.brokeRefused = buyTech('armor');
      state.coins = 999999; state.tech.shield = 1;       // shield maxLevel is 1
      out.maxedRefused = buyTech('shield');
      // Q116: a hand-edited save cannot exceed maxLevel
      var san = sanitizeSave(migrateSave({ v: 4, tech: { armor: 99, speed: -5, bogus: 7 } }));
      out.sanitized = san.tech;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r17 = parsed(b17);
  const b17ok = !r17.__err
    && r17.nodes === 5 && r17.ids.join(',') === 'armor,speed,shield,reroll,damage'
    && r17.secondWind === false
    && JSON.stringify(r17.armorCosts) === JSON.stringify([150,300,450,600,750])
    && r17.bought === true && r17.coinsAfter === 850 && r17.levelAfter === 1
    && r17.brokeRefused === false && r17.maxedRefused === false
    && r17.sanitized.armor === 5 && r17.sanitized.speed === 0 && !('bogus' in r17.sanitized);
  check('B17 (Q062/63/116) Workshop tree works, Second Wind removed, ranks clamped on load', b17ok,
        r17.__err ? r17.__err : JSON.stringify(r17));

  // --- behaviour 18 (Q030/Q138): one barrel whatever the multishot count; 12 evo fittings ---
  const b18 = ev(`(function(){
    try {
      var count = function (root) {
        var n = 0;
        root.traverse(function (o) { if (o.isMesh) n++; });
        return n;
      };
      var mk = function () {
        return { isPlayer: true, mesh: new THREE.Group(), turretPivot: new THREE.Group() };
      };
      var realPlayer = player;
      var realStats = state.playerStats;
      var out = {};
      try {
        // baseline: no evolutions, multishot 0
        player = mk(); player.mesh.add(player.turretPivot);
        state.playerStats = { multishot: 0 };
        syncPlayerTankParts();
        out.ms0 = count(player.turretPivot);
        out.baseline = count(player.mesh);   // hull + turret with no evolutions at all
        // same build but multishot 4 -> must not add a single barrel
        player = mk(); player.mesh.add(player.turretPivot);
        state.playerStats = { multishot: 4 };
        syncPlayerTankParts();
        out.ms4 = count(player.turretPivot);
        // Overkill Array (which genuinely adds a shell) still gets its own fitting
        player = mk(); player.mesh.add(player.turretPivot);
        state.playerStats = { multishot: 0, evo_overkill: 1 };
        syncPlayerTankParts();
        out.overkill = count(player.turretPivot);
        // all 12 evolution flags build at least as much as none
        player = mk(); player.mesh.add(player.turretPivot);
        var all = {}; ['cluster','bastion','prism','nanite','afterburner','siege','overkill',
                       'tempestA','citadel','missileR','phaseLance','predator'].forEach(function (id) { all['evo_' + id] = 1; });
        state.playerStats = all;
        syncPlayerTankParts();
        // count(player.mesh) already includes turretPivot as a child, so this is the
        // whole fitting count and is directly comparable to out.baseline
        out.all12 = count(player.mesh);
        out.all12turret = count(player.turretPivot);
        // rebuild must not accumulate: calling twice leaves the same count
        var first = count(player.mesh);
        syncPlayerTankParts();
        out.afterRebuild = count(player.mesh);
        out.first = first;
      } finally { player = realPlayer; state.playerStats = realStats; }
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r18 = parsed(b18);
  const b18ok = !r18.__err
    && r18.ms0 === r18.ms4              // Q030: single barrel regardless of multishot
    && r18.overkill > r18.ms0           // but a real extra-shell evo is still visible
    && r18.all12 > r18.baseline         // all 12 fittings build more than owning none
    && r18.baseline === 0               // a run with no evolutions wears no fittings
    && r18.afterRebuild === r18.first;  // rebuild does not accumulate
  check('B18 (Q030/Q138) single barrel at any multishot, 12 evo fittings, no accumulation', b18ok,
        r18.__err ? r18.__err : `turret meshes ms0=${r18.ms0} ms4=${r18.ms4} overkill=${r18.overkill}, baseline=${r18.baseline} all12=${r18.all12} (turret ${r18.all12turret}), rebuild ${r18.first}->${r18.afterRebuild}`);

  // --- behaviour 19 (Q075/Q129): one 3-lane meter, labels, cap, countdown, throttle ---
  const b19 = ev(`(function(){
    try {
      var out = {};
      // one component mounted into an arbitrary host
      var host = document.createElement('div');
      host.id = 'test-meter';
      document.body.appendChild(host);
      out.built = buildPowerMeter('test-meter', 't');
      out.lanes = host.querySelectorAll('.pm-lane').length;
      out.ids = ['t-pm-spd','t-pm-dmg','t-pm-arm'].every(function(id){ return !!document.getElementById(id); });

      var realStats = state.playerStats, realRT = state.runTime;
      try {
        // hasted: BOOST label, and the number is clamped to the movement cap
        state.playerStats = { speed: 100, damage: 100, adrenaline: 9 };
        state.speedBoostUntil = 999999; state.runTime = 0;
        state._rootSlow = 1;
        // stacks live on playerStats.adrenaline, not state.adrenalineStacks.
        // 9 stacks -> 1 + 0.25*(9+1) = 3.5 uncapped, which must clamp to the 2.6 ceiling.
        updatePowerMeter('t', true);
        out.spdHasted = document.getElementById('t-pm-spd-num').textContent;
        out.spdState  = document.getElementById('t-pm-spd-state').textContent;
        out.cap       = CONFIG.playerSpeedMaxMult;

        // slowed: SLOWED label
        state.speedBoostUntil = 0; state._rootSlow = 0.5;
        updatePowerMeter('t', true);
        out.spdSlowed = document.getElementById('t-pm-spd-state').textContent;
        out.spdSlowedNum = document.getElementById('t-pm-spd-num').textContent;

        // overcharge: countdown on the damage lane (Yt02's contribution)
        state._rootSlow = 1;
        state.overchargeUntil = 60; state.runTime = 52.4;
        updatePowerMeter('t', true);
        out.dmgNum = document.getElementById('t-pm-dmg-num').textContent;

        // armor lane reads the pool
        state.armorMaxHp = 40; state.armorHp = 25.7;
        updatePowerMeter('t', true);
        out.armNum = document.getElementById('t-pm-arm-num').textContent;

        // throttle: a plain call right after a forced one is refused; force overrides
        out.throttled = updatePowerMeter('t') === false;
        out.forcedAgain = updatePowerMeter('t', true) === true;
      } finally {
        state.playerStats = realStats; state.runTime = realRT;
        state.speedBoostUntil = 0; state.overchargeUntil = 0;
        state._rootSlow = 1;
        delete _pmLast['t'];
        host.remove();
      }
      // Q075 "kill the duplicate meters": the old pills must be gone from the shipped DOM
      out.pillsGone = document.getElementById('hud-speed-pill') === null;
      out.hostsMounted = !!document.getElementById('hud-power-meter') && !!document.getElementById('pause-power-meter');
      out.hudHasLanes = document.querySelectorAll('#hud-power-meter .pm-lane').length;
      out.pauseHasLanes = document.querySelectorAll('#pause-power-meter .pm-lane').length;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + e.message; }
  })()`);
  const r19 = parsed(b19);
  const b19ok = !r19.__err
    && r19.built === true && r19.lanes === 3 && r19.ids === true
    && r19.spdHasted === '260%'                      // 3.5 clamped to the 2.6 cap
    && r19.spdState === '\u25b2 BOOST'
    && r19.spdSlowed === '\u25bc SLOWED' && r19.spdSlowedNum === '50%'
    && r19.dmgNum === '130% \u23f18s'               // 1.3x overcharge, 8s remaining
    && r19.armNum === '25/40'                        // floored, per Q076
    && r19.throttled === true && r19.forcedAgain === true
    && r19.pillsGone === true
    && r19.hostsMounted === true && r19.hudHasLanes === 3 && r19.pauseHasLanes === 3;
  check('B19 (Q075/Q129) one 3-lane meter in both hosts, cap + labels + countdown + throttle', b19ok,
        r19.__err ? r19.__err : JSON.stringify(r19));

  // ----------------------------------------------------------- report
  console.log('\n' + '='.repeat(74));
  console.log('RELEASE HARNESS — ' + path.basename(file));
  console.log('='.repeat(74));
  let pass = 0;
  results.forEach(r => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    if (!r.ok) console.log(`        -> ${r.detail}`);
    if (r.ok) pass++;
  });
  console.log('-'.repeat(74));
  console.log(`${pass}/${results.length} checks passed`);
  process.exit(pass === results.length ? 0 : 1);
}, 1500);
