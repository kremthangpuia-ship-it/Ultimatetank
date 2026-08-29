        function setPauseUIVisible(visible) {
            const btnPause = document.getElementById('btn-pause');
            if (btnPause) btnPause.classList.toggle('show', visible);
            const qb = document.getElementById('hud-quickbar');
            if (qb) qb.classList.toggle('show', visible);
        }

        function setScreenVisibility(screenId, visible) {
            const el = document.getElementById(screenId);
            if (!el) return;
            el.classList.toggle('hidden', !visible);
            try { syncMenuTankPreview(); } catch (e) {}
        }

        function pauseGame() {
            if (state.isChoosingUpgrade || state.marketOpen) return;
            if (!state.isPlaying || state.gamePhase !== 'playing') return;
            const rv = document.getElementById('pause-revive-count');
            if (rv) rv.textContent = state.continuesThisRun || 0;
            try { renderBuildList(); } catch (e) {}
            SFX.engineStop(); SFX.musicStop(); // v23+v24
            state.gamePhase = 'paused';
            needsRender = true; // FIX (Tier 3): one final render for the pause backdrop
            // FIX (v2/P1): kill lingering combat feedback so pause feels truly frozen
            dom('damage-overlay').style.opacity = '0';
            dom('heal-overlay').style.opacity = '0';
            document.querySelectorAll('.score-popup').forEach(p => p.remove());
            document.querySelectorAll('.kill-feed-entry').forEach(p => p.remove());
            state.input = { x: 0, y: 0, isFiring: false };
            document.getElementById('joystick-base').style.display = 'none';
            const saveBtn = document.getElementById('btn-save-run'); // v15: save is Casual-only
            if (saveBtn) saveBtn.style.display = state.mode === 'casual' ? '' : 'none';
            syncHUDControls();
            setScreenVisibility('pause-screen', true);
            setPauseUIVisible(true);
            try{document.getElementById('btn-camera-float').classList.add('show');}catch(e){}
            syncHUDControls();
        }

        function resumeGame() {
            if (state.gamePhase !== 'paused') return;
            state.gamePhase = 'playing';
            needsRender = true; // FIX (Tier 3)
            SFX.engineStart(); SFX.musicStart(); // v23+v24
            // FIX (v2/P1): re-arm timed gates so nothing bursts on the first frame back
            const now = clock.getElapsedTime();
            state.lastFireTime = now;
            state.lastSpawnTime = now;
            state.lastRegenTime = now;
            setScreenVisibility('pause-screen', false);
            setScreenVisibility('settings-screen', false);
            setPauseUIVisible(true);
            syncHUDControls();
        }

        function togglePause() {
            if (state.gamePhase === 'playing') pauseGame();
            else if (state.gamePhase === 'paused') resumeGame();
        }

        // v26.2: enemies scale with the run level — HP, damage, speed and score all ramp.
        // Breakpoints at 10/12/20/22 keep the early game gentle and make deep runs bite.
        function keepTankSpacing(e) {
            if (!player || player.isDead || !e || e.isDead || !e.mesh) return;
            const sizes = { berserker: 3.7, bomber: 3.3, deathbringer: 3.4, juggernaut: 5.1, hammer: 5.3, raider: 3.5, tombraider: 3.6, titan: 5.6, heavy: 4.1, heavier: 4.4, fortress: 5.2, warlord: 4.7, colossus: 5.1, tempest: 3.8, shieldbearer: 4.2, artillery: 3.6, commander: 3.7, minelayer: 3.4 };
            const min = sizes[e.type] || 3.05;
            const dx = e.mesh.position.x - player.mesh.position.x;
            const dz = e.mesh.position.z - player.mesh.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.04) { e.mesh.position.x += min; return; }
            if (d >= min) return;
            const k = (min - d) / d;
            e.mesh.position.x += dx * k;
            e.mesh.position.z += dz * k;
            if (sizes[e.type] && ((state.runTime || 0) - (e._clanged || -9) > 0.45)) {
                e._clanged = state.runTime || 0;
                try { createExplosion(e.mesh.position.clone(), 2, 0xffaa66, 'spark'); } catch (err) {}
            }
        }
        function livingEnemyCount() {
            return enemies.filter(e => !e.isDead).length;
        }
        function getMaxEnemies() {
            let n = state.mode === 'levels'
                ? ((state.levelsCfg && state.levelsCfg.density) || 10) + Math.floor((state.level || 1) / 8)
                : Math.min(13, 3 + (state.level || 1));
            if (state.mode === 'casual' && state.level > 20) n = Math.min(22, 14 + Math.floor((state.level - 20) / 4));
            return n;
        }
    // Q031/Q032: every number now comes from CONFIG.enemyDmg / CONFIG.enemyHp rather than
    // being baked into the expression. Swapping CONFIG.enemyCurvePresets.easy in changes
    // the whole difficulty ramp without touching this function. Speed and points are
    // unchanged across all three legacy builds, so they stay literal.
    function enemyLevelScale() {
        const L = state.level || 1;
        const d = CONFIG.enemyDmg, h = CONFIG.enemyHp;
        return {
            hp:  h.base + Math.max(0, L - 1) * h.perLevel,
            dmg: d.base + Math.max(0, L - 1) * d.slope
                        + Math.max(0, L - 10) * d.mid
                        + Math.max(0, L - 20) * d.late,
            spd: 1 + Math.min(0.35, Math.max(0, L - 1) * 0.01),
            pts: 1 + Math.max(0, L - 1) * 0.05  + Math.max(0, L - 12) * 0.03
        };
    }

        function getEnemyTypeForLevel(level) {
            const types = ['scout', 'soldier'];
            if (level >= 2) types.push('scouter');
            if (level >= 3) types.push('heavy');
            if (level >= 3) types.push('soldierpro');
            if (level >= 4) types.push('sniper');
            if (level >= 4) types.push('heavier');
            if (level >= 5) types.push('healer');
            if (level >= 5) types.push('picker');
            if (level >= 7) types.push('berserker');
            if (level >= 6) types.push('bomber');
            if (level >= 6) types.push('squsasher');
            if (level >= 7) types.push('deathbringer');
            if (level >= 8) types.push('phantom');
            if (level >= 9) types.push('phantasm');
            if (level >= 10) types.push('gunner');
            if (level >= 11) types.push('gunnier');
            if (level >= 5) types.push('skirmisher');
            if (level >= 6) types.push('skirmisher');
            if (level >= 12) { types.push('wasp'); types.push('wasp'); }
            if (level >= 14) types.push('raider');
            if (level >= 15) types.push('tombraider');
            if (level >= 16) types.push('raider');
            if (level >= 16) types.push('juggernaut');
            if (level >= 17) types.push('hammer');
            if (level >= 18) types.push('raider');
            if (level >= 7) types.push('shieldbearer');
            if (level >= 8) types.push('artillery');
            if (level >= 9) types.push('minelayer');
            if (level >= 13) types.push('commander');
            // v28.7: keep Scout / Soldier / Heavy in the teens so the field is not only variants
            const basics = ['scout', 'soldier'];
            if (level >= 3) basics.push('heavy');
            const basicOdds = level >= 15 ? 0.40 : (level >= 10 ? 0.32 : (level >= 6 ? 0.22 : 0));
            if (basicOdds && Math.random() < basicOdds) {
                return basics[Math.floor(Math.random() * basics.length)];
            }
            return types[Math.floor(Math.random() * types.length)];
        }

        // v6(C): BOSSES — every 5th level one arrives; three kinds rotate
        // Q038: bosses with a hand-written phase script in the enemy AI dispatch. Anything
        // not listed here falls through to the generic enrage escalation, so a new boss can
        // never ship without phases by accident.
        const BESPOKE_PHASE_BOSSES = {
            warlord: 1, colossus: 1, nova: 1, titan: 1, tempest: 1, fortress: 1
        };

        const BOSS_KINDS = [ // v24: roster of six, rotating
            { type: 'warlord',  interval: 6.4 },   // Q039: doubled from 3.2 (Yt03's nerf)
            { type: 'tempest',  interval: 3.0 },
            { type: 'colossus', interval: 3.8 },
            { type: 'titan',    interval: 4.6 },
            { type: 'nova',     interval: 4.2 },
            { type: 'fortress', interval: 3.4 },
        ];
        const _bossDir = new THREE.Vector3();
        const _bossAxis = new THREE.Vector3(0, 1, 0);

        function showBossBanner(text) {
            const el = document.getElementById('boss-banner');
            if (!el) return;
            el.textContent = text;
            el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim');
            clearTimeout(el._t);
            el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
        }

        function bumpComboFromHit(enemy) { // v27.3: boss hits keep the combo window alive
            if (!enemy || enemy.isDead || !enemy.isBoss) return;
            state.combo = (state.combo || 0) + 1;
            state.comboTimer = 3;
            if (state.combo > (state.maxRunCombo||0)) state.maxRunCombo = state.combo;
        }
        function stripEnemyBar(enemy) {
            if (!enemy || !enemy.hpBar) return;
            try {
                scene.remove(enemy.hpBar);
                if (enemy._hpTex) enemy._hpTex.dispose();
                disposeObject3D(enemy.hpBar);
            } catch (err) {}
            enemy.hpBar = null;
            enemy._hpCanvas = null;
            enemy._hpTex = null;
        }
        function handleEnemyKill(enemy, isCrit, via) {
            // v26.4: one kill path so Field Medic / boss-bar / XP always fire
            if (!enemy || enemy._killHandled) return;
            enemy._killHandled = true;
            try { stripEnemyBar(enemy); } catch (err) {}
            const points = enemy.pointValue || ENEMY_TYPES[enemy.type]?.points || 100;
            state.score += points;
            state.kills++;
            if ((state.playerStats.healOnKill || 0) > 0 && player && !player.isDead) {
                player.hp = Math.min(player.maxHp, player.hp + state.playerStats.healOnKill);
                try { createHealEffect(player.mesh.position); } catch (err) {}
            }
            if (state.playerStats.evo_nanite && player && !player.isDead) {
                player.hp = Math.min(player.maxHp, player.hp + 4);
                try {
                    createHealEffect(player.mesh.position);
                    fxRingAt(player.mesh.position.x, player.mesh.position.z, 0x4ade80, 0.7, 2.8, 0.28, true);
                } catch (err) {}
            }
            // Q011: Adrenaline Rush is now a minute-long buff, refreshed by every kill,
            // instead of a 1.5s flicker. Afterburner doubles the duration, keeping the
            // legacy 1.5s -> 3s ratio intact at the new timescale.
            if (state.playerStats.adrenaline || state.playerStats.evo_afterburner) {
                const AD = CONFIG.adrenaline;
                const dur = AD.duration * (state.playerStats.evo_afterburner ? AD.afterburnerMultiplier : 1);
                state.speedBoostUntil = (state.runTime || 0) + dur;
            }
            try { trackKill(!!enemy.isBoss, !!isCrit, Math.floor(points * 0.5)); } catch (err) {}
            try { addKillReward(enemy); } catch (err) {}
            const tag = via === 'missile' ? ' 🚀' : (isCrit ? ' ⚡CRIT' : '');
            try { addKillFeed(points, (ENEMY_TYPES[enemy.type]?.name || 'Tank') + tag, state.combo); } catch (err) {}
            try { addXP(xpFromPoints(points)); } catch (err) {}
            if (enemy.mesh) try { showScorePopup(enemy.mesh.position.x, enemy.mesh.position.z, points); } catch (err) {}
            if (enemy.isBoss) {
                try {
                    if (enemy.mesh) createExplosion(enemy.mesh.position.clone(), 8, 0xffaa00, 'spark');
                    state.cameraShake = 0.8;
                    showBossBanner('🏆 ' + (ENEMY_TYPES[enemy.type]?.name || 'BOSS') + ' DEFEATED!');
                    SFX.bossDown(); SFX.vibrate([60, 40, 60, 40, 120]);
                    if (player && !player.isDead) player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.25));
                } catch (err) {}
                state.bossActive = null;
                state.bossCooldownUntil = (state.runTime || 0) + 12;
                try { updateBossBar(); } catch (err) {}
                try {
                    if (state.isChoosingUpgrade) {
                        state.pendingChoices = (state.pendingChoices || 0) + 1;
                        state.nextChoiceIsBoss = true;
                    } else {
                        showUpgradeChoices('boss');
                    }
                } catch (err) {}
            }
            try { updateHUD(); } catch (err) {}
        }

        function updateBossBar() {
            const bar = document.getElementById('boss-bar');
            if (!bar) return;
            if (!state.bossActive || state.bossActive.isDead) { bar.classList.remove('show'); return; }
            bar.classList.add('show');
            document.getElementById('boss-bar-name').textContent = ENEMY_TYPES[state.bossActive.type]?.name || 'BOSS';
            document.getElementById('boss-bar-fill').style.width =
                Math.max(0, (state.bossActive.hp / state.bossActive.maxHp) * 100) + '%';
        }

        function spawnBoss() {
            if (!state.isPlaying || !player) return;
            const kind = BOSS_KINDS[(state.bossCount || 0) % BOSS_KINDS.length];
            // v17: spawn in a ring around the player — works anywhere in the infinite world
            const a = Math.random() * Math.PI * 2;
            const bx = (player ? player.mesh.position.x : 0) + Math.cos(a) * 45;
            const bz = (player ? player.mesh.position.z : 0) + Math.sin(a) * 45;
            const boss = new Tank(ENEMY_TYPES[kind.type].color, false, kind.type);
            boss.hp = boss.maxHp = Math.round(boss.maxHp * (1 + state.level * 0.035 + Math.max(0, state.level - 15) * 0.02)); // v26.2: slightly gentler boss HP
            boss.damageMult = enemyLevelScale().dmg; // v26
            boss.isBoss = true;
            boss.attackInterval = kind.interval;
            boss.nextAttackAt = clock.getElapsedTime() + 2;
            boss.burstLeft = 0; boss.burstTimer = 0;
            boss.spiralAngle = 0; boss.spiralShots = 0; boss.firing = true; boss.restUntil = 0; // v24
            boss.summoned1 = false; boss.summoned2 = false;
            boss._phase = 1;
            boss.mesh.position.set(bx, 0, bz);
            enemies.push(boss);
            state.bossActive = boss;
            state.bossCount = (state.bossCount || 0) + 1;
            showEnemyIntro(kind.type);
            showBossBanner('⚠ ' + ENEMY_TYPES[kind.type].name + ' INCOMING ⚠');
            SFX.bossAlarm(); SFX.vibrate([80, 60, 80]); // v23
            updateBossBar();
        }

        // Q038: count parameter added. It previously always summoned exactly two, so
        // Yt01's "reinforcement wave grows to 3 at phase 2" would have been a silent no-op
        // — the call site would have passed 3 and been ignored. Default stays 2 so every
        // existing caller behaves exactly as before.
        function bossSummon(boss, kind, count) { // Colossus reinforcement waves
            const n = (typeof count === 'number' && count > 0) ? count : 2;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * Math.PI * 2;
                // v26: minions scale exactly like normal spawns
                makeScaledEnemy(kind, boss.mesh.position.x + Math.cos(a) * 7, boss.mesh.position.z + Math.sin(a) * 7);
            }
            showBossBanner('⚔ ' + (ENEMY_TYPES[boss.type]?.name || 'BOSS') + ' CALLS REINFORCEMENTS!');
        }

        // v4/v10: the Armory — permanent upgrades, exponential cost curve, deep sink
