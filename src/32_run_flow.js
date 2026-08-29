        const DIFFICULTIES = {
            easy:      { dmg: 0.7, fire: 0.75, label: 'Easy' },
            normal:    { dmg: 1.0, fire: 1.0,  label: 'Normal' },
            hard:      { dmg: 1.3, fire: 1.25, label: 'Hard' },
            nightmare: { dmg: 1.6, fire: 1.5,  label: 'Nightmare' }
        };
        state.diffMult = DIFFICULTIES.normal;
        state.levelsCfg = { density: 10, difficulty: 'normal', startLevel: 1 };

        function snapshotRun() { // v10: casual mid-run progress
            if (!player || state.mode !== 'casual') return null;
            return {
                level: state.level, xp: state.xp, xpToNext: state.xpToNext,
                score: state.score, kills: state.kills, runTime: state.runTime, runCoins: state.runCoins,
                playerStats: JSON.parse(JSON.stringify(state.playerStats)),
                hp: player.hp, armorHp: state.armorHp || 0, x: +player.mesh.position.x.toFixed(1), z: +player.mesh.position.z.toFixed(1),
                biome: state.currentBiome,
                biomeStep: state.biomeStep, biomeNextIn: state.biomeNextIn,
                overchargeUntil: state.overchargeUntil || 0,
                runCoinBoost: state.runCoinBoost || 0,
                shieldUp: !!state.shieldUp,
                clocks: 'run',
                lastMissileAt: state.lastMissileAt || 0,
                speedBoostUntil: state.speedBoostUntil || 0,
                invulnUntil: state.invulnUntil || 0,
                shieldReadyAt: state.shieldReadyAt || 0,
                combo: state.combo || 0,
                bossCount: state.bossCount || 0,
                enemiesIntroduced: [...(state.enemiesIntroduced || [])],
                continuesThisRun: state.continuesThisRun || 0,
                nextDropAt: state.nextDropAt,
                nextFunAt: state.nextFunAt,
                funKind: state.funKind || null,
                funUntil: state.funUntil || 0,
                blastUntil: state.blastUntil || 0,
                runCards: state.runCards || [],
                runCardsObj: JSON.parse(JSON.stringify(state.runCardsObj || {})),
                runCardStats: state.runCardStats || [],
                evolutions: state.evolutions || [],
                shotIndex: state.shotIndex || 0,
                bossPending: !!state.bossPending,
                biomeEnteredAt: state.biomeEnteredAt || 0,
                biomeDwellLimit: state.biomeDwellLimit || 360,
                biomeNameReminded: !!state.biomeNameReminded,
                field: serializeField()
            };
        }
        function serializeField() {
            const list = [];
            for (const e of enemies) {
                if (!e || e.isDead || !e.mesh || !e.type) continue;
                list.push({
                    type: e.type,
                    hp: Math.round(e.hp),
                    maxHp: Math.round(e.maxHp),
                    x: +e.mesh.position.x.toFixed(1),
                    z: +e.mesh.position.z.toFixed(1),
                    elite: !!e.isElite,
                    boss: !!e.isBoss,
                    armorFlat: e.armorFlat || 0
                });
                if (list.length >= 22) break;
            }
            return list;
        }
        function restoreField(list) {
            if (!list || !list.length || !ENEMY_TYPES) return;
            state.bossActive = null;
            for (const row of list) {
                if (!row || !ENEMY_TYPES[row.type]) continue;
                if (row.boss) {
                    const boss = new Tank(ENEMY_TYPES[row.type].color, false, row.type);
                    boss.isBoss = true;
                    const kind = (typeof BOSS_KINDS !== 'undefined' && BOSS_KINDS.find(k => k.type === row.type)) || { interval: 3.4 };
                    boss.attackInterval = kind.interval;
                    boss.nextAttackAt = clock.getElapsedTime() + 1.6;
                    boss.damageMult = enemyLevelScale().dmg;
                    boss.maxHp = row.maxHp || boss.maxHp;
                    boss.hp = Math.max(1, Math.min(boss.maxHp, row.hp != null ? row.hp : boss.maxHp));
                    boss.mesh.position.set(row.x || 0, 0, row.z || 0);
                    enemies.push(boss);
                    state.bossActive = boss;
                    try { if (boss.updateHpBar) boss.updateHpBar(); updateBossBar(); } catch (err) {}
                    continue;
                }
                const e = makeScaledEnemy(row.type, row.x || 0, row.z || 0, true);
                if (!e) continue;
                if (row.maxHp) e.maxHp = row.maxHp;
                e.hp = Math.max(1, Math.min(e.maxHp, row.hp != null ? row.hp : e.maxHp));
                if (row.armorFlat) e.armorFlat = row.armorFlat;
                if (row.elite && !e.isElite) {
                    e.isElite = true;
                    e._hpName = 'Elite ' + ((ENEMY_TYPES[row.type] && ENEMY_TYPES[row.type].name) || row.type);
                    e.mesh.traverse(c => {
                        if (c.isMesh && c.material && c.material.color) {
                            c.material.color.offsetHSL(0.08, 0.25, 0.08);
                            if (c.material.emissive) c.material.emissive.setHex(0x664400);
                        }
                    });
                }
                if (e.updateHpBar) e.updateHpBar();
            }
        }

        // Q119 / D-03: a second quickSaveFromPause() used to be declared here. The later
        // declaration in 40_persist_polish.js silently replaced it, making this one dead.
        // The single surviving definition is the one that says "💾 Run saved!".

        function quitToMenu() {
            state._bossRushActive = false;
            state._bossRushIndex = 0; // v13: plain quit (progress already saved where relevant)
            try { saveGame(); } catch (e) {}
            state.isPlaying = false;
            state.gamePhase = 'menu';
            state.input = { x: 0, y: 0, isFiring: false };
            SFX.engineStop(); SFX.ambientStop(); SFX.musicStop(); // v24
            if (player && scene) { scene.remove(player.mesh); disposeObject3D(player.mesh); }
            enemies.forEach(e => { scene.remove(e.mesh); disposeObject3D(e.mesh); }); enemies = [];
            bullets.forEach(b => scene.remove(b.group)); bullets = [];
            missiles.forEach(m => scene.remove(m.group)); missiles = []; // v24
            try { clearTacticalFX(); } catch (e) {}
            particles.forEach(p => { scene.remove(p.mesh); disposeObject3D(p.mesh); }); particles = [];
            document.querySelectorAll('.score-popup').forEach(p => p.remove());
            setScreenVisibility('pause-screen', false);
            setScreenVisibility('settings-screen', false);
            setScreenVisibility('game-over-screen', false);
            setScreenVisibility('start-screen', true);
            try{document.getElementById('btn-camera-float').classList.remove('show');}catch(e){}
            setPauseUIVisible(false);
            syncHUDControls();
            updateHomeStats();
            showUpgradeNotification('💾 Progress saved');
        }

        function startGame(mode = 'casual', opts = {}) {
            lifeStats().runs++; state.runDist = 0; // v23
            lifeStats().skins = Math.max(lifeStats().skins || 1, skinState().owned.length);
            // FIX (Tier 2): dispose GPU resources of everything from the previous run
            // (bullets use shared cached resources, so removing them from the scene is enough)
            if (player) { scene.remove(player.mesh); disposeObject3D(player.mesh); }
            enemies.forEach(e => { scene.remove(e.mesh); disposeObject3D(e.mesh); });
            bullets.forEach(b => scene.remove(b.group));
            missiles.forEach(m => scene.remove(m.group)); // v26: in-flight missiles must not leak into the next run
            particles.forEach(p => { scene.remove(p.mesh); disposeObject3D(p.mesh); });
            supplyDrops.forEach(d => {
                if (d.shadow) { try { scene.remove(d.shadow); disposeObject3D(d.shadow); } catch (e) {} }
                if (d.group) { scene.remove(d.group); disposeObject3D(d.group); }
            });
            enemies = [];
            bullets = [];
            missiles = [];
            particles = [];
            supplyDrops = [];
            try { clearTacticalFX(); } catch (e) {}
            state.nextDropAt = 12;

            state.mode = mode; // v10
            state.diffMult = DIFFICULTIES[(opts && opts.difficulty) || 'normal'] || DIFFICULTIES.normal;
            if (mode === 'levels') state.levelsCfg.density = (opts && opts.density) || 10;
            // Boss Rush: hard difficulty, spawn bosses only, skip regular waves
            if (mode === 'bossrush') {
                state.diffMult = DIFFICULTIES.hard || DIFFICULTIES.normal;
                state._bossRushActive = true;
                state._bossRushIndex = 0; // which boss to fight next
                state.surgeNextAt = 999999; // disable normal surge
                state.nextDropAt = 999999;  // disable crates during boss rush
            } else {
                state._bossRushActive = false;
            }
            const resume = mode === 'casual' && (opts && opts.resume);
            state.activeSaveName = resume && opts.resume.name ? opts.resume.name : null;
            state.savedThisRun = false;
            // v11/v26.6: shop consumables only on a FRESH run — reloading a save must not eat them
            const cons = consumables();
            let freeCards = 0, useOvercharge = false, useAegis = false;
            if (!resume) {
                state.runCoinBoost = 0.2 * (cons.lucky || 0);
                freeCards = cons.headstart || 0;
                useOvercharge = (cons.overcharge || 0) > 0;
                useAegis = (cons.aegis || 0) > 0;
                cons.lucky = 0; cons.headstart = 0;
                if (useOvercharge) cons.overcharge--;
                if (useAegis) cons.aegis--;
                try { saveGame(); } catch (e) {}
            }
            state.score = resume ? opts.resume.score : 0;
            state.kills = resume ? opts.resume.kills : 0; // v2: run stats
            state.runTime = resume ? opts.resume.runTime : 0;
            state.runCoins = resume ? opts.resume.runCoins : 0;
            state.xp = resume ? opts.resume.xp : 0;
            state.level = resume ? opts.resume.level : ((mode === 'levels' && opts.startLevel) || 1);
            state.xpToNext = resume ? opts.resume.xpToNext : 250;
            // v13: named saves are managed in the Casual hub
            state.isPlaying = true;
            state.gamePhase = 'playing';
            state.isChoosingUpgrade = false; // v15: never inherit card state between runs
            state.pendingChoices = 0;
            state.pendingBiome = null;
            document.querySelectorAll('#upgrade-choice').forEach(o => o.remove());
            document.querySelectorAll('#black-market').forEach(o => o.remove());
            state.marketOpen = false;
            state.startLevelUsed = (mode === 'levels' && opts.startLevel) || 1;
            state.input = { x: 0, y: 0, isFiring: false };
            state.lastSpawnTime = (typeof clock !== "undefined" && clock) ? clock.getElapsedTime() : 0;
            state.lastRegenTime = (typeof clock !== "undefined" && clock) ? clock.getElapsedTime() : 0;
            state.enemiesIntroduced = new Set();
            state.playerStats = { speed: 100, damage: 100, fireRate: 100, armor: 0, regen: 0, maxHp: 100, multishot: 0, crit: 0, pierce: 0, coinBonus: 0, healOnKill: 0, xpBonus: 0, adrenaline: 0, missile: 0, splash: 0, shield: 0 };
            const meta = state.meta || {};
            if (resume && opts.resume.playerStats) {
                // v26.6: saved run already includes Armory + every level-up card
                Object.assign(state.playerStats, opts.resume.playerStats);
            } else {
                state.playerStats.maxHp += (meta.hp || 0) * 20;
                state.playerStats.damage += (meta.dmg || 0) * 8;
                state.playerStats.speed += (meta.spd || 0) * 6;
                state.playerStats.armor += (meta.armor || 0) * 4;
                state.playerStats.regen += (meta.regen || 0) * 1;
                state.playerStats.damage += (meta.dmg_inf || 0) * 1;
                state.playerStats.maxHp += (meta.hp_inf || 0) * 2;
                state.playerStats.armor += (meta.armor_inf || 0) * 1;
                state.playerStats.regen += (meta.regen_inf || 0) * 0.5;
                state.playerStats.fireRate += (meta.fire_inf || 0) * 2;
                state.playerStats.crit += (meta.crit_inf || 0) * 1;
                state.playerStats.fireRate += (meta.optics_inf || 0) * 1;
                state.playerStats.maxHp += (meta.door_inf || 0) * 5;
            }
            // v1.1: Hull Archetype — apply per-skin base stat deltas
            if (!resume) {
                const _skinId = skinState().selected;
                const _skinData = SKINS.find(s => s.id === _skinId);
                if (_skinData && _skinData.arch) {
                    const _a = _skinData.arch;
                    state.playerStats.maxHp   += (_a.maxHp  || 0);
                    state.playerStats.damage  += (_a.damage || 0);
                    state.playerStats.speed   += (_a.speed  || 0);
                    state.playerStats.armor   += (_a.armor  || 0);
                    state.playerStats.crit    += (_a.crit   || 0); // Fix 4: Void Walker crit arch delta
                    state.playerStats.regen   += (_a.regen  || 0);
                }
            }
            // v1.5: Armor shield pool — starts full at run start (or resume)
            // Fix 5: Aegis gives 20 base armor pool even if player has no armor cards
            // Q062/Q116: Workshop ranks, applied fresh each run. This must happen before
            // the armour pool is derived below, since armor ranks change the pool size.
            // A resumed run already carries these inside its saved playerStats, so they are
            // only applied on a fresh start.
            if (!resume) {
                const tech = state.tech || {};
                state.playerStats.armor  += (tech.armor  || 0) * 2;
                state.playerStats.speed  += (tech.speed  || 0) * 2;
                state.playerStats.damage += (tech.damage || 0) * 2;
                if (tech.shield) {
                    state.playerStats.shield = Math.max(state.playerStats.shield || 0, 1);
                    state.shieldUp = true;
                }
                state.runRerolls = (state.runRerolls || 0) + (tech.reroll || 0);
            }

            // Q018: Aegis Kit grants a base pool when you own no armour cards, so the bar
            // and the recharge actually have something to work with. Only on a fresh run —
            // Yt03's guard, so resuming a save is never overwritten by the consumable.
            const _aegisBonus = (!resume && useAegis && state.playerStats.armor === 0)
                ? CONFIG.armor.aegisBasePool : 0;
            if (_aegisBonus > 0) { state.playerStats.armor += _aegisBonus; }
            // Q016: the pool is derived (floor(maxHp * armor/100)), not a copy of the stat.
            recalcArmorPool(false);
            if (resume && typeof opts.resume.armorHp === 'number') {
                state.armorHp = Math.min(opts.resume.armorHp, state.armorMaxHp || 0);
            } else if (!resume) {
                // recalcArmorPool(false) deliberately only clamps — it must not invent
                // pool out of nowhere — so a fresh run is filled explicitly here.
                state.armorHp = state.armorMaxHp || 0;
            }
            state.reviveAvailable = (meta.revive || 0) > 0;
            if (!resume) state.continuesThisRun = 0;
            state.surgeActive = false;
            state.surgeNextAt = state.runTime + 70;
            state.surgeEndsAt = 0; state.surgeLastSpawn = 0;
            if (resume) {
                state.biomeStep = opts.resume.biomeStep != null ? opts.resume.biomeStep : Math.floor((state.level - 1) / 3);
                state.biomeNextIn = opts.resume.biomeNextIn != null ? opts.resume.biomeNextIn : 1;
                state.overchargeUntil = opts.resume.overchargeUntil || 0;
                state.runCoinBoost = opts.resume.runCoinBoost || 0;
                state.combo = opts.resume.combo || 0;
                if (opts.resume.enemiesIntroduced) state.enemiesIntroduced = new Set(opts.resume.enemiesIntroduced);
                state.continuesThisRun = opts.resume.continuesThisRun || 0;
                if (opts.resume.nextDropAt != null) state.nextDropAt = opts.resume.nextDropAt;
                if (opts.resume.nextFunAt != null) state.nextFunAt = opts.resume.nextFunAt;
                state.funKind = opts.resume.funKind || null;
                state.funUntil = opts.resume.funUntil || 0;
                state.blastUntil = opts.resume.blastUntil || 0;
                state.runCards = opts.resume.runCards || [];
                state.runCardsObj = opts.resume.runCardsObj ? JSON.parse(JSON.stringify(opts.resume.runCardsObj)) : {};
                state.runCardStats = opts.resume.runCardStats || [];
                state.evolutions = opts.resume.evolutions || [];
                state.shotIndex = opts.resume.shotIndex || 0;
                state.biomeEnteredAt = opts.resume.biomeEnteredAt != null ? opts.resume.biomeEnteredAt : (state.runTime || 0);
                state.biomeDwellLimit = opts.resume.biomeDwellLimit || (300 + Math.random() * 120);
                state.biomeNameReminded = !!opts.resume.biomeNameReminded;
            } else {
                state.biomeStep = Math.floor((state.level - 1) / 3);
                state.biomeNextIn = 3;
                state.overchargeUntil = useOvercharge ? state.runTime + 60 : 0;
                state.funKind = null; state.funUntil = 0; state.nextFunAt = undefined;
                state.blastUntil = 0;
                state.runCards = []; state.runCardsObj = {}; state.evolutions = [];
                state.runCardStats = [];
                state.evolutions = [];
                state.shotIndex = 0;
                state.bastionSoakUntil = 0;
                state.invulnUntil = 0;
                state.regenLockUntil = 0;
                state.biomeEnteredAt = 0;
                state.biomeNameReminded = false;
                state.biomeDwellLimit = 300 + Math.random() * 120;
            }
            if ((state.invulnUntil || 0) > (state.runTime || 0) + 4) state.invulnUntil = 0;
            state.metaAtRunStart = Object.assign({}, meta);
            state.targetEnemy = null;
            state.cameraShake = 0;
            state.bossActive = null; // v6(C)
            state.bossPending = false;
            state.bossCount = state.bossCount || 0;
            state.bossCooldownUntil = 0;
            updateBossBar();
            SFX.engineStart(); // v23+v24: audio lifecycle starts AFTER cleanup
            SFX.ambientSet(BIOMES[(opts && opts.resume && opts.resume.biome) || 0]);
            SFX.musicStart();

            state.runRerolls = resume ? (state.runRerolls || 0) : (freeCards || 0);
            player = new Tank(selectedSkinColor(), true); // v10: equipped skin
            const sRingGeo = new THREE.RingGeometry(3.1, 3.4, 40); // v24: shield ring
            const sRingMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            player.shieldRing = new THREE.Mesh(sRingGeo, sRingMat);
            player.shieldRing.rotation.x = -Math.PI / 2;
            player.shieldRing.position.y = 1.2;
            player.shieldRing.visible = false;
            player.mesh.add(player.shieldRing);
            state.shieldUp = resume ? !!opts.resume.shieldUp : !!useAegis;
            state.shieldReadyAt = 0;
            state.lastMissileAt = 0;
            if (resume && opts.resume.clocks === 'run') {
                state.lastMissileAt = opts.resume.lastMissileAt || 0;
                state.speedBoostUntil = opts.resume.speedBoostUntil || 0;
                state.invulnUntil = opts.resume.invulnUntil || 0;
                if (opts.resume.shieldReadyAt) state.shieldReadyAt = opts.resume.shieldReadyAt;
            }
            if (state.shieldUp) player.shieldRing.visible = true;
            try { syncPlayerTankParts(); } catch (e) {}
            player.maxHp = state.playerStats.maxHp;
            player.hp = player.maxHp;
            if (resume) {
                player.hp = opts.resume.hp;
                player.maxHp = state.playerStats.maxHp;
                player.mesh.position.set(opts.resume.x, 0, opts.resume.z);
                if (typeof opts.resume.bossCount === 'number') state.bossCount = opts.resume.bossCount;
                loadBiome(opts.resume.biome);
                try { restoreField(opts.resume.field); } catch (err) {}
                if (opts.resume.bossPending && !state.bossActive) state.bossPending = true;
                if (opts.resume.biomeEnteredAt != null) state.biomeEnteredAt = opts.resume.biomeEnteredAt;
                if (opts.resume.biomeDwellLimit) state.biomeDwellLimit = opts.resume.biomeDwellLimit;
                state.biomeNameReminded = !!opts.resume.biomeNameReminded;
            } else {
                if (mode === 'bossrush') {
                    loadBiome(2); // Volcanic Wasteland — most dramatic for Boss Rush
                } else {
                    loadBiome(Math.floor((state.level - 1) / 3));
                }
            }
            updateHUD();

            document.getElementById('start-screen').classList.add('hidden');
            setScreenVisibility('casual-screen', false);
            setScreenVisibility('levels-screen', false);
            setScreenVisibility('shop-screen', false);
            setScreenVisibility('awards-screen', false);
            setScreenVisibility('game-over-screen', false);
            setScreenVisibility('pause-screen', false);
            setPauseUIVisible(true);
            syncHUDControls();
        }

        function xpFromPoints(points) { // v27.6: kills feed score/coins at full value; XP is slower
            return Math.max(6, Math.round((points || 0) * 0.17));
        }
        function addXP(amount) {
            amount *= 1 + (state.playerStats.xpBonus || 0) / 100; // v5: Bounty Hunter
            state.xp += amount;
            
            while (state.xp >= state.xpToNext) {
                state.xp -= state.xpToNext;
                state.level++;
                state.xpToNext = Math.floor(state.xpToNext * 1.18);

                // v27.5: exactly one Choose-an-upgrade per level (boss/crate are separate)
                SFX.levelUp(); // v23
                if (state.isChoosingUpgrade) state.pendingChoices = (state.pendingChoices || 0) + 1;
                else showUpgradeChoices();
                state._leveledThisXp = (state._leveledThisXp || 0) + 1;

                // v6(C): a boss arrives every 5th level
                if (state.level % 5 === 0) state.bossPending = true;

                lifeStats().maxLevel = Math.max(lifeStats().maxLevel, state.level); // v23
                bumpDaily('maxLevel', state.level);
                if (state.level > (state.maxCleared || 1)) { // v13: level-select progression
                    state.maxCleared = state.level;
                    try { saveGame(); } catch (e) {}
                }
            }
            if (state._leveledThisXp) {
                state.biomeNextIn = (state.biomeNextIn || 3) - 1;
                if (state.biomeNextIn <= 0) {
                    state.biomeStep = ((state.biomeStep || 0) + 1) % BIOMES.length;
                    state.pendingBiome = state.biomeStep;
                    state.biomeNextIn = 3;
                }
                state._leveledThisXp = 0;
            }
            maybeTransitionBiome(); // v15: if no cards are open, transition now
            updateHUD();
        }

        function showUpgradeNotification(text) {
            const notif = document.getElementById('upgrade-notification');
            document.getElementById('upgrade-text').textContent = text;
            notif.classList.add('show');
            setTimeout(() => notif.classList.remove('show'), 900);
        }

        function showEnemyIntro(type) {
            if (!type || !ENEMY_TYPES[type]) return;
            if (state.enemiesIntroduced.has(type)) return;
            state.enemiesIntroduced.add(type);
            state._introQ = state._introQ || [];
            state._introQ.push(type);
            if (!state._introBusy) drainEnemyIntro();
        }
        function drainEnemyIntro() {
            const q = state._introQ || [];
            if (!q.length) { state._introBusy = false; return; }
            state._introBusy = true;
            const type = q.shift();
            const data = ENEMY_TYPES[type];
            try {
                document.getElementById('enemy-name').textContent = 'NEW  ·  ' + data.name;
                document.getElementById('enemy-desc').textContent = data.desc || '';
                const intro = document.getElementById('enemy-intro');
                intro.classList.add('show');
                clearTimeout(intro._t);
                intro._t = setTimeout(() => {
                    intro.classList.remove('show');
                    setTimeout(drainEnemyIntro, 280);
                }, 2200);
            } catch (err) { state._introBusy = false; }
        }

        function spawnSupplyDrop() {
            if (!player || state.level < 4) return;
            const a = Math.random() * Math.PI * 2;
            const d = 16 + Math.random() * 18;
            const x = player.mesh.position.x + Math.cos(a) * d;
            const z = player.mesh.position.z + Math.sin(a) * d;
            const ground = getTerrainHeight(x, z);
            const g = new THREE.Group();
            const black = !!arguments[0] || Math.random() < 0.26;
            const crate = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 1.1, 1.3),
                new THREE.MeshStandardMaterial({
                    color: black ? 0x7c3aed : 0xfbbf24,
                    emissive: black ? 0x4c1d95 : 0xaa7700,
                    emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.4
                })
            );
            crate.position.y = 0.55;
            g.add(crate);
            const band = new THREE.Mesh(
                new THREE.BoxGeometry(1.38, 0.18, 1.38),
                new THREE.MeshBasicMaterial({ color: 0xfff7cc })
            );
            band.position.y = 0.55;
            g.add(band);
            const chute = new THREE.Mesh(
                new THREE.ConeGeometry(1.6, 1.2, 8),
                new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
            );
            chute.position.y = 1.7;
            chute.rotation.x = Math.PI;
            g.add(chute);
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.55, 18, 8, 1, true),
                new THREE.MeshBasicMaterial({ color: black ? 0xc084fc : 0xfbbf24, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
            );
            beam.position.y = 9;
            g.add(beam);
            const lid = new THREE.Mesh(
                new THREE.BoxGeometry(1.34, 0.16, 1.34),
                new THREE.MeshStandardMaterial({
                    color: black ? 0x6d28d9 : 0xf59e0b, metalness: 0.4, roughness: 0.38,
                    emissive: black ? 0x4c1d95 : 0xaa7700, emissiveIntensity: 0.35
                })
            );
            lid.position.y = 1.18;
            g.add(lid);
            const shadow = new THREE.Mesh(
                new THREE.CircleGeometry(1.55, 22),
                new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
            );
            shadow.rotation.x = -Math.PI / 2;
            shadow.position.set(x, ground + 0.06, z);
            scene.add(shadow);
            g.position.set(x, ground + 16, z);
            scene.add(g);
            supplyDrops.push({ group: g, chute: chute, beam: beam, lid: lid, shadow: shadow, yLand: ground, falling: true, bob: Math.random() * 6, black: black });
            showUpgradeNotification(black ? '☠️ Black Market inbound' : '📦 Supply drop inbound');
        }
        function closeBlackMarket() {
            const el = document.getElementById('black-market');
            if (el) el.remove();
            state.marketOpen = false;
            state.input.isFiring = false;
        }
        function openBlackMarket() {
            closeBlackMarket();
            state.marketOpen = true;
            state.input.isFiring = false;
            const box = document.createElement('div');
            box.id = 'black-market';
            const mk = (label, cost, fn) => {
                const b = document.createElement('button');
                b.className = 'bm-row';
                b.innerHTML = '<span>' + label + '</span><span>💰 ' + cost + '</span>';
                b.onclick = (ev) => {
                    ev.preventDefault(); ev.stopPropagation();
                    if ((state.coins || 0) < cost) { showUpgradeNotification('Not enough coins'); return; }
                    state.coins -= cost;
                    try { fn(); } catch (e) {}
                    try { SFX.coin(); saveGame(); updateHUD(); } catch (e) {}
                    closeBlackMarket();
                };
                return b;
            };
            box.appendChild(Object.assign(document.createElement('div'), { className: 'bm-title', textContent: '☠️ BLACK MARKET' }));
            box.appendChild(Object.assign(document.createElement('div'), { className: 'bm-sub', textContent: 'Pay coins. One deal. Then it vanishes.' }));
            box.appendChild(mk('❤️ Full repair', 400, () => {
                player.hp = player.maxHp;
                try { createHealEffect(player.mesh.position); } catch (e) {}
                showUpgradeNotification('❤️ Fully repaired');
            }));
            box.appendChild(mk('💥 +20% damage 60s', 300, () => {
                state.blastUntil = (state.runTime || 0) + 60;
                showUpgradeNotification('💥 +20% damage — 60s');
            }));
            box.appendChild(mk('🛡️ Shield charge', 350, () => {
                state.shieldUp = true; state.shieldReadyAt = 0;
                if (player.shieldRing) player.shieldRing.visible = true;
                showUpgradeNotification('🛡️ Shield charged');
            }));
            box.appendChild(mk('🃏 Instant bonus card', 800, () => {
                showUpgradeNotification('🌟 Bonus upgrade');
                if (!state.isChoosingUpgrade) showUpgradeChoices();
                else state.pendingChoices = (state.pendingChoices || 0) + 1;
            }));
            const leave = document.createElement('button');
            leave.className = 'bm-leave'; leave.textContent = 'Leave';
            leave.onclick = (ev) => { ev.preventDefault(); closeBlackMarket(); };
            box.appendChild(leave);
            document.body.appendChild(box);
        }
        function detachCrateShadow(drop) {
            if (drop && drop.shadow) {
                try { scene.remove(drop.shadow); disposeObject3D(drop.shadow); } catch (e) {}
                drop.shadow = null;
            }
        }
        function crateOpenFX(drop) {
            if (!drop || !drop.group) return;
            try {
                const col = drop.black ? 0xc084fc : 0xfbbf24;
                const p = drop.group.position;
                fxRingAt(p.x, p.z, col, 0.7, 4.6, 0.3, false);
                fxSparks(p.x, p.y + 0.8, p.z, col, 9);
                if (drop.lid) {
                    drop.lid.position.y += 0.35;
                    drop.lid.rotation.z = 0.7;
                }
            } catch (e) {}
        }
        function collectSupplyDrop(drop) {
            if (!drop || !player) return;
            try { crateOpenFX(drop); } catch (e) {}
            if (drop.black) {
                try { scene.remove(drop.group); disposeObject3D(drop.group); } catch (e) {}
                detachCrateShadow(drop);
                openBlackMarket();
                return;
            }
            const kinds = ['repair', 'overcharge', 'shield', 'coins', 'card', 'haste', 'xp'];
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            if (kind === 'repair') {
                player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.45));
                // Q017: repair kit fully restores the armour pool
                const _am = state.armorMaxHp || 0;
                if (_am > 0) refillArmorPool(1);
                try { createHealEffect(player.mesh.position); } catch (e) {}
                showUpgradeNotification('❤️ Repair kit +45% HP' + (_am > 0 ? ' + Armor restored' : ''));
            } else if (kind === 'overcharge') {
                state.overchargeUntil = (state.runTime || 0) + 15;
                showUpgradeNotification('⚡ Overcharge 15s');
            } else if (kind === 'shield') {
                state.shieldUp = true; state.shieldReadyAt = 0;
                if (player.shieldRing) player.shieldRing.visible = true;
                showUpgradeNotification('🛡️ Shield charged');
            } else if (kind === 'coins') {
                const n = 90 + state.level * 14;
                state.coins = (state.coins || 0) + n;
                state.runCoins = (state.runCoins || 0) + n;
                showUpgradeNotification('💰 Cache +' + n);
            } else if (kind === 'card') {
                showUpgradeNotification('🌟 Bonus upgrade');
                if (!state.isChoosingUpgrade) showUpgradeChoices();
                else state.pendingChoices = (state.pendingChoices || 0) + 1;
            } else if (kind === 'haste') {
                state.speedBoostUntil = (state.runTime || 0) + 10;
                showUpgradeNotification('💨 Haste 10s');
            } else {
                addXP(28 + state.level * 3);
                showUpgradeNotification('🎖️ Intel cache — XP');
            }
            try { SFX.coin(); } catch (e) {}
            try { updateHUD(); } catch (e) {}
            scene.remove(drop.group); disposeObject3D(drop.group);
            detachCrateShadow(drop);
        }
        function updateSupplyDrops(dt) {
            if (!player) return;
            if (state.level >= 1 && !state.isChoosingUpgrade) {
                if (!state.nextAidAt) state.nextAidAt = (state.runTime || 0) + aidDropInterval();
                if ((state.runTime || 0) >= state.nextAidAt) { spawnAidDrop(); state.nextAidAt = (state.runTime || 0) + aidDropInterval(); }
            }
            if (state.level >= 4 && !state.isChoosingUpgrade) {
                if (state.nextDropAt == null) state.nextDropAt = (state.runTime || 0) + 12;
                if ((state.runTime || 0) >= state.nextDropAt && supplyDrops.length < 2) {
                    spawnSupplyDrop();
                    state.nextDropAt = (state.runTime || 0) + 40 + Math.random() * 25;
                }
            }
            for (let i = supplyDrops.length - 1; i >= 0; i--) {
                const d = supplyDrops[i];
                if (!d.group) { supplyDrops.splice(i, 1); continue; }
                if (d.shadow) {
                    const h = Math.max(0, d.group.position.y - d.yLand);
                    const s = 0.55 + Math.min(1.55, h / 12);
                    d.shadow.scale.set(s, s, 1);
                    if (d.shadow.material) d.shadow.material.opacity = 0.16 + (1 - Math.min(1, h / 16)) * 0.28;
                }
                if (d.falling) {
                    d.group.position.y -= 9 * dt;
                    if (d.group.position.y <= d.yLand + 0.05) {
                        d.group.position.y = d.yLand;
                        d.falling = false;
                        if (d.chute) d.chute.visible = false;
                        if (d.shadow) { d.shadow.scale.set(1, 1, 1); if (d.shadow.material) d.shadow.material.opacity = 0.22; }
                        try {
                            const col = d.black ? 0xc084fc : 0xfbbf24;
                            fxRingAt(d.group.position.x, d.group.position.z, col, 0.6, 4.2, 0.34, false);
                            state.cameraShake = Math.max(state.cameraShake || 0, 0.14);
                            SFX.shatterRock();
                        } catch (e) {}
                    }
                } else {
                    d.bob += dt * 2;
                    d.group.position.y = d.yLand + Math.sin(d.bob) * 0.12;
                    d.group.rotation.y += dt * 0.7;
                }
                if (d.beam && d.beam.material) d.beam.material.opacity = 0.18 + 0.14 * Math.sin(clock.getElapsedTime() * 3 + d.bob);
                const dx = d.group.position.x - player.mesh.position.x;
                const dz = d.group.position.z - player.mesh.position.z;
                if (dx * dx + dz * dz < 16) {
                    collectSupplyDrop(d);
                    supplyDrops.splice(i, 1);
                }
            }
        }
        function spawnEnemy() {
            if (state._bossRushActive) return; // Boss Rush: only bosses, no regular enemies
            if (state.bossActive && !state.bossActive.isDead && Math.random() < 0.5) return;
            if (spawnBlocked()) return;
            if (!state.isPlaying || !player) return;

            // v17: enemies spawn in a ring around the PLAYER — works anywhere in the infinite world
            const a = Math.random() * Math.PI * 2;
            const d = 38 + Math.random() * 26;
            const x = player.mesh.position.x + Math.cos(a) * d;
            const z = player.mesh.position.z + Math.sin(a) * d;

            const type = getEnemyTypeForLevel(state.level);
            showEnemyIntro(type);

            const enemy = makeScaledEnemy(type, x, z);

            // v26.2: wasps never travel alone — one spawn brings a pack of three (2 wingmen)
            if (type === 'wasp') {
                const packCeil = getMaxEnemies() + 4;
                for (let w = 0; w < 2; w++) {
                    if (livingEnemyCount() >= packCeil) break;
                    const wa = Math.random() * Math.PI * 2;
                    const wd = 3 + Math.random() * 4;
                    makeScaledEnemy('wasp', x + Math.cos(wa) * wd, z + Math.sin(wa) * wd);
                }
            }
        }

        // v26: single place where an enemy is built and level-scaled, so every spawn
        // path (spawner, wasp packs, boss reinforcements) ramps identically.
        function makeScaledEnemy(type, x, z, fromSave) {
            if (!fromSave) { try { showEnemyIntro(type); } catch (err) {} }
            const sc = enemyLevelScale();
            const enemy = new Tank(ENEMY_TYPES[type].color, false, type);
            let hpMult = sc.hp;
            if (state.mode === 'casual' && state.level > 20) { // v10: endless ramp
                hpMult *= 1 + (state.level - 20) * 0.04;
            }
            enemy.hp = enemy.maxHp = Math.round(enemy.maxHp * hpMult);
            if (enemy.updateHpBar) enemy.updateHpBar();
            enemy.damageMult = sc.dmg;
            enemy.speedMult = sc.spd;
            enemy.pointValue = Math.round((ENEMY_TYPES[type].points || 100) * sc.pts);
            if (type === 'juggernaut' || type === 'hammer') enemy.armorFlat = 3 + state.level * 0.12;
            // v26.7: elites from lv15 — a gold-tinted tougher twin, extra coins, still fair
            if (!fromSave && state.level >= 15 && type !== 'juggernaut' && type !== 'hammer' && Math.random() < 0.14) {
                enemy.isElite = true;
                enemy.hp = enemy.maxHp = Math.round(enemy.maxHp * 1.4);
                enemy.damageMult = (enemy.damageMult || 1) * 1.15;
                enemy.pointValue = Math.round((enemy.pointValue || 100) * 1.7);
                enemy._hpName = 'Elite ' + ((ENEMY_TYPES[type] && ENEMY_TYPES[type].name) || type);
                enemy.mesh.traverse(c => {
                    if (c.isMesh && c.material && c.material.color) {
                        c.material.color.offsetHSL(0.08, 0.25, 0.08);
                        if (c.material.emissive) c.material.emissive.setHex(0x664400);
                    }
                });
                if (enemy.updateHpBar) enemy.updateHpBar();
            }
            enemy.shotHome = (enemyShotProfile(enemy).home || 0) > 0;
            enemy.mesh.position.set(x, 0, z);
            enemies.push(enemy);
            return enemy;
        }

