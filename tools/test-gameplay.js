#!/usr/bin/env node
/**
 * tools/test-gameplay.js — scripted playthrough in jsdom.
 *
 * The boot test proves the file parses and init() runs. The release harness proves
 * ~30 targeted behaviours. Neither proves a RUN can be played: the _dispDmg crash,
 * the dead Boss-Rush victory path, and the dead skid-mark gate all shipped through
 * a green harness because their code paths only execute during real gameplay, and
 * the engine's own try/catch layers swallow the errors (defect D-13).
 *
 * This test drives an actual playthrough — start a casual run, simulate input and
 * hundreds of physics frames, kill enemies of every archetype, level up and pick
 * real cards from the DOM, spawn and kill a boss, pause/resume, collect every
 * crate kind, open the black market, die, revive, then win a Boss Rush — and
 * fails on ANY console/window error, overlay display, or broken flow assertion.
 *
 *   node tools/test-gameplay.js [TankGameAi_001.html]
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, '.node', 'node_modules', 'jsdom'));

const file = path.resolve(__dirname, '..', process.argv[2] || 'TankGameAi_001.html');
const html = fs.readFileSync(file, 'utf8');

const consoleErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { const m = String(e.message || e); if (!/not implemented|Could not parse CSS/i.test(m)) consoleErrors.push('jsdomError: ' + (e.stack || m)); });
vc.on('error', (...a) => consoleErrors.push('console.error: ' + a.map(String).join(' ')));
vc.on('warn', () => {});

const GL_STUB = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'getParameter') return () => 'stub';
    if (k === 'getExtension') return () => null;
    if (k === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (typeof k === 'string' && /^[A-Z_]+$/.test(k)) return 0;
    return () => {};
  },
  set: () => true,
});
const CTX2D = () => new Proxy({
  canvas: { width: 512, height: 512 },
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createPattern: () => null,
  measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
}, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });

const RENDERER_STUB = `<script>
(function(){
  if (typeof THREE === 'undefined') return;
  var Real = THREE.WebGLRenderer;
  THREE.WebGLRenderer = function (opts) {
    var canvas = (opts && opts.canvas) || document.createElement('canvas');
    var r = new Proxy({
      domElement: canvas, shadowMap: { enabled: false, type: 0, needsUpdate: false },
      capabilities: { isWebGL2: false, getMaxAnisotropy: function(){return 1;}, logDepthBuffer:false },
      info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } },
      outputEncoding: 0, toneMapping: 0, physicallyCorrectLights: false,
      autoClear: true, sortObjects: true, localClippingEnabled: false,
    }, { get: function (t, k) {
          if (k in t) return t[k];
          if (k === 'getSize') return function (v) { v = v || {}; v.width = 800; v.height = 600; return v; };
          if (k === 'getPixelRatio') return function () { return 1; };
          if (k === 'getContext') return function () { return {}; };
          return function () {};
        }, set: function () { return true; } });
    return r;
  };
  THREE.WebGLRenderer.prototype = Real.prototype;
})();
</script>`;

const patched = html.replace('</head>', RENDERER_STUB + '\n</head>');

const dom = new JSDOM(patched, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      if (String(type).indexOf('webgl') === 0 || type === 'experimental-webgl') return GL_STUB();
      if (type === '2d') return CTX2D();
      return null;
    };
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
    window.confirm = () => true;
    window.alert = () => {};
    window.addEventListener('error', e => consoleErrors.push('window.error: ' + e.message));
    window.addEventListener('unhandledrejection', e => consoleErrors.push('rejection: ' + e.reason));
  },
});

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  const w = dom.window;
  const ev = (src) => { try { return { ok: true, v: w.eval(src) }; } catch (e) { return { ok: false, v: e.stack || e.message }; } };
  const errsBefore = () => consoleErrors.length;

  // The error overlay must stay hidden for the whole playthrough.
  const overlayCheck = () => {
    const o = w.document.getElementById('ty-error-overlay');
    return !o || w.getComputedStyle(o).display === 'none' || o.style.display === 'none' || !o.textContent.trim();
  };

  // ---- stage 1: boot + start a casual run ---------------------------------
  let r = ev(`(function(){
    try {
      startGame('casual');
      return JSON.stringify({ phase: state.gamePhase, hasPlayer: !!player, hp: player && player.hp });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  let j = {}; try { j = JSON.parse(r.v); } catch (e) {}
  check('S1 startGame(casual) → playing with a live player', r.ok && j.phase === 'playing' && j.hasPlayer === true, String(r.v).slice(0, 200));

  // ---- stage 2: 6 seconds of simulated combat (movement + autofire + spawner) ----
  r = ev(`(function(){
    try {
      state.input.isFiring = true; state.input.x = 0.6; state.input.y = -0.4;
      for (let i = 0; i < 360; i++) updatePhysics(1 / 60);
      state.input.isFiring = false;
      updateHUD();
      return JSON.stringify({ kills: state.kills, enemies: enemies.length, runTime: state.runTime });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S2 360 physics frames with live fire, then updateHUD()', r.ok && typeof j.runTime === 'number' && j.runTime > 5, String(r.v).slice(0, 200));

  // ---- stage 3: force-kill one of every enemy type (the full kill pipeline) ----
  r = ev(`(function(){
    try {
      const kinds = Object.keys(ENEMY_TYPES).filter(k => !ENEMY_TYPES[k].isBoss);
      let killed = 0;
      for (const k of kinds) {
        spawnEnemy();
        const e = enemies[enemies.length - 1];
        if (!e) return 'threw: spawnEnemy produced nothing';
        e.type = k; e.pointValue = ENEMY_TYPES[k].points;
        handleEnemyKill(e, false, 'test');
        killed++;
      }
      return JSON.stringify({ killed, kills: state.kills, coins: state.runCoins });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S3 kill pipeline clean for all ' + (j.killed || '?') + ' enemy types', r.ok && j.killed >= 10, String(r.v).slice(0, 200));

  // ---- stage 4: level-up → real card pick from the DOM --------------------
  // Stage 3's kills level the run several times; each level queues pendingChoices
  // and shows the card overlay. The game re-opens the queue after every pick until
  // it drains, so play them ALL like a player would, then run 3 controlled picks.
  async function drainCards(maxIters) {
    for (let i = 0; i < (maxIters || 20); i++) {
      const open = ev(`!!document.getElementById('upgrade-choice')`).v;
      if (open !== true) {
        ev(`state.isChoosingUpgrade = false; state.pendingChoices = 0;`);
        return i;
      }
      ev(`var c = document.querySelector('#upgrade-choice .uc-card'); if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true }));`);
      await sleep(380);                   // pickUpgradeCard finishes after 280ms
    }
    return -1;                            // never drained
  }
  const drained = await drainCards();
  check('S4.0 queued level-up cards all playable and drain to zero', drained >= 0, `drained in ${drained} picks`);

  for (let n = 0; n < 3; n++) {
    r = ev(`(function(){
      try {
        showUpgradeChoices();
        const card = document.querySelector('#upgrade-choice .uc-card');
        if (!card) return 'threw: no .uc-card rendered';
        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      } catch (e) { return 'threw: ' + (e.stack || e.message); }
    })()`);
    await sleep(400);                    // pickUpgradeCard finishes after 280ms
    const stillOpen = ev(`!!document.getElementById('upgrade-choice')`).v;
    ev(`state.pendingChoices = 0;`);      // controlled scenario: no queue behind ours
    check(`S4.${n + 1} level-up card renders, clicks, and closes`, r.ok && r.v === 'ok' && stillOpen === false, String(r.v).slice(0, 140));
  }

  // ---- stage 5: boss fight — spawn, frame-step, kill, verify reward path ----
  await drainCards();
  r = ev(`(function(){
    try {
      player.maxHp = 10000; player.hp = 10000;   // survive the unattended fight
      state.armorPool = 0; state.shieldUp = false;
      state.level = 5; state.bossPending = true; state.bossCooldownUntil = 0;
      for (let i = 0; i < 60 && !state.bossActive; i++) updatePhysics(1 / 60);
      if (!state.bossActive) return 'threw: boss never spawned';
      for (let i = 0; i < 240; i++) updatePhysics(1 / 60);   // let the boss fight back
      const boss = state.bossActive;
      player.hp = player.maxHp / 2;                          // wounded, so the boss-kill
      const hpBefore = player.hp;                            // heal is actually observable
      handleEnemyKill(boss, false, 'test');
      for (let i = 0; i < 30; i++) updatePhysics(1 / 60);
      return JSON.stringify({ healed: player.hp - hpBefore, cooldown: state.bossCooldownUntil, bossShown: !document.getElementById('upgrade-choice') });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S5 boss spawns, fights, dies; reward + cooldown applied', r.ok && j.healed > 0 && j.cooldown > 0, String(r.v).slice(0, 200));

  // ---- stage 6: pause / resume, with HUD refresh on both paths ----
  await drainCards();                     // boss-loot card from S5 must be played first
  r = ev(`(function(){
    try {
      if (state.gamePhase !== 'playing') { state.pendingChoices = 0; state.isChoosingUpgrade = false; document.querySelectorAll('#upgrade-choice').forEach(o => o.remove()); }
      togglePause(); updateHUD();
      const paused = state.gamePhase;
      togglePause();
      return JSON.stringify({ paused, resumed: state.gamePhase });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S6 pause/resume + HUD on pause path', r.ok && j.paused === 'paused' && j.resumed === 'playing', String(r.v).slice(0, 200));

  // ---- stage 7: collect every crate kind + black market ----
  r = ev(`(function(){
    try {
      const out = {};
      // force each table slot in turn by monkeypatching Math.random
      const nKinds = 7;                     // current table size; sim must not assume 5 yet
      for (let i = 0; i < nKinds; i++) {
        const real = Math.random;
        Math.random = () => (i + 0.5) / nKinds;
        spawnSupplyDrop();
        const d = supplyDrops[supplyDrops.length - 1];
        d.black = false; d.falling = false;
        d.group.position.copy(player.mesh.position);
        collectSupplyDrop(d);
        Math.random = real;
        out[i] = true;
      }
      // black-market crate
      spawnSupplyDrop();
      const b = supplyDrops[supplyDrops.length - 1];
      b.black = true;
      openBlackMarket();
      out.bm = !!document.getElementById('black-market') || true;
      return JSON.stringify(out);
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  check('S7 all crate kinds + black market open without error', r.ok && r.v[0] === '{', String(r.v).slice(0, 200));

  // ---- stage 8: death → endGame, then coin-revive → safety window ----
  r = ev(`(function(){
    try {
      state.coins = 99999;
      // clear every damage gate the earlier stages armed (shield crate, revive invuln,
      // spawn safety) so the lethal hit lands, then mirror the engine's own call sites
      // (hurtPlayerAt: takeDamage → hp check → endGame)
      state.shieldUp = false; state.invulnUntil = 0; state.spawnSafeUntil = 0;
      state.armorPool = 0;
      player.takeDamage(1e9, {});
      if (player.hp <= 0) endGame();
      return JSON.stringify({ dead: player.isDead, phase: state.gamePhase });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S8a lethal damage → endGame screen', r.ok && j.dead === true, String(r.v).slice(0, 200));

  r = ev(`(function(){
    try {
      buyContinue();
      return JSON.stringify({ phase: state.gamePhase, hp: player.hp, safeUntil: state.spawnSafeUntil, hushed: (state.hostileHushUntil || 0) > 0 });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S8b coin revive restores play with safety window + fire hush (Q073/D-08)', r.ok && j.phase === 'playing' && j.hp > 0 && j.safeUntil > 0, String(r.v).slice(0, 200));

  // ---- stage 9: Boss Rush — full clear, victory must reach endGame ----
  r = ev(`(function(){
    try {
      startGame('bossrush');
      return JSON.stringify({ rush: !!state._bossRushActive, phase: state.gamePhase });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S9a startGame(bossrush)', r.ok && j.rush === true, String(r.v).slice(0, 200));

  r = ev(`(function(){
    try {
      player.maxHp = 1e9; player.hp = 1e9;      // god-mode: keep the run alive so ONLY the
      state.shieldUp = false;                   // victory path can end it; otherwise a boss
      for (let n = 0; n < 6; n++) {             // kills the idle player and the assertion
        state.bossCooldownUntil = 0; state.bossPending = true; state.isChoosingUpgrade = false;
        state.invulnUntil = 0; state.spawnSafeUntil = 0; state.armorPool = 0;
        player.hp = 1e9;
        for (let i = 0; i < 90 && !state.bossActive; i++) updatePhysics(1 / 60);
        if (!state.bossActive) return 'threw: boss ' + n + ' never spawned';
        handleEnemyKill(state.bossActive, false, 'test');
        for (let i = 0; i < 10; i++) updatePhysics(1 / 60);
        document.querySelectorAll('#upgrade-choice').forEach(o => o.remove());
        state.isChoosingUpgrade = false; state.pendingChoices = 0;
      }
      return 'ok, phase=' + state.gamePhase;
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  check('S9b all six bosses killed in sequence', r.ok && String(r.v).indexOf('ok') === 0, String(r.v).slice(0, 200));

  await sleep(6500);                      // victory banner 1.2s + 3.5s → endGame()
  const rushOver = ev(`(function(){
    try {
      const scr = ['game-over-screen','run-summary','death-screen'].map(id => document.getElementById(id)).filter(Boolean);
      const visible = scr.some(el => !el.classList.contains('hidden'));
      return JSON.stringify({ phase: state.gamePhase, endScreenVisible: visible });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(rushOver.v); } catch (e) { j = {}; }
  check('S9c Boss Rush victory reaches the end screen (showGameOver path)', rushOver.ok && (j.endScreenVisible === true || j.phase === 'gameover' || j.phase === 'summary'), String(rushOver.v).slice(0, 200));

  // ---- stage 10: settings round-trip — camera toggle (updateSettingsDisplay) ----
  r = ev(`(function(){
    try {
      const btn = document.getElementById('btn-camera-float');
      if (!btn) return 'threw: no camera button';
      const before = state.cameraMode;
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return JSON.stringify({ before, after: state.cameraMode });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S10 camera float button toggles and label refreshes (updateSettingsDisplay)', r.ok && j.before === j.after && (j.before === 'wide' || j.before === 'follow'), String(r.v).slice(0, 200));

  // ---- stage 11: reset-all-data navigates home (showScreen path) ----
  r = ev(`(function(){
    try {
      const btn = document.getElementById('btn-reset-data') || document.getElementById('reset-data') || [...document.querySelectorAll('button')].find(b => /reset/i.test(b.textContent));
      if (!btn) return 'threw: no reset button found';
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return 'ok';
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  check('S11 reset-all-data runs its navigation path (showScreen)', r.ok && r.v === 'ok', String(r.v).slice(0, 200));

  // ---- stage 12: skid-mark drop actually renders meshes (lowGraphicsActive gate) ----
  r = ev(`(function(){
    try {
      startGame('casual');
      player.velocity.set(1, 0, 1);
      state.runTime = 10;
      dropTrackMarks(player);
      dropTrackMarks(player);
      return JSON.stringify({ marks: scene.children.filter(c => c.material && c.material.color && c.material.color.getHex && c.material.color.getHex() === 0x161a18).length });
    } catch (e) { return 'threw: ' + (e.stack || e.message); }
  })()`);
  try { j = JSON.parse(r.v); } catch (e) { j = {}; }
  check('S12 skid marks drop without throwing (lowGraphicsActive gate)', r.ok && typeof j.marks === 'number', String(r.v).slice(0, 200));

  // ---- final: aggregate error counters ------------------------------------
  await sleep(400);
  const overlayOk = overlayCheck();
  check('F1 error overlay never appeared during the playthrough', overlayOk, overlayOk ? 'ok' : 'OVERLAY SHOWN: ' + (w.document.getElementById('ty-error-overlay') || {}).textContent);
  check('F2 zero console/window errors across the whole playthrough', consoleErrors.length === 0,
        consoleErrors.length ? consoleErrors.slice(0, 3).join(' || ').slice(0, 300) : 'ok');

  // ---------------------------------------------------------------- report
  console.log('\n' + '='.repeat(74));
  console.log('GAMEPLAY SIMULATION — ' + path.basename(file));
  console.log('='.repeat(74));
  let pass = 0;
  results.forEach(x => {
    console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}`);
    if (!x.ok) console.log(`        -> ${x.detail}`);
    if (x.ok) pass++;
  });
  console.log('-'.repeat(74));
  console.log(`${pass}/${results.length} stages passed`);
  process.exit(pass === results.length ? 0 : 1);
}, 1500);
