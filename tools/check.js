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
