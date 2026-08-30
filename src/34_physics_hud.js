        function showScorePopup(x, z, points) {
            const pos = new THREE.Vector3(x, 3, z);
            pos.project(camera);
            
            const screenX = (pos.x + 1) / 2 * window.innerWidth;
            const screenY = (-pos.y + 1) / 2 * window.innerHeight;
            
            const popup = document.createElement('div');
            popup.className = 'score-popup';
            popup.textContent = '+' + points;
            popup.style.left = screenX + 'px';
            popup.style.top = screenY + 'px';
            document.body.appendChild(popup);
            
            setTimeout(() => popup.remove(), 1200);
        }

        function updatePhysics(dt) {
            const _physT0 = performance.now(); // v21: frame cost probe (for morph self-throttling)
            if (!player || player.isDead) return;
            state.runTime = (state.runTime || 0) + dt; // v2: pause-proof run clock
            if (state._blastLive && (state.runTime || 0) >= (state.blastUntil || 0)) {
                state._blastLive = false;
                try { showUpgradeNotification('💥 +20% damage ended'); } catch (err) {}
            } else if ((state.runTime || 0) < (state.blastUntil || 0)) {
                state._blastLive = true;
            }

            // Player movement
            player.move(dt, _sv1.set(state.input.x, state.input.y)); // FIX (Tier 3)
            player.update(dt);
            for (const en of enemies) keepTankSpacing(en);
            // v28.1: standing in a pack always hurts — bullets can miss; presence cannot
            if (player && !player.isDead) {
                let dps = 0;
                for (const e of enemies) {
                    if (!e || e.isDead || !e.mesh) continue;
                    const dx = e.mesh.position.x - player.mesh.position.x;
                    const dz = e.mesh.position.z - player.mesh.position.z;
                    const d2 = dx * dx + dz * dz;
                    if (d2 > 13 * 13) continue;
                    const d = Math.sqrt(d2);
                    const fall = 1 - d / 13;
                    const base = (ENEMY_TYPES[e.type]?.damage || 12) * (e.damageMult || 1) * (state.diffMult.dmg || 1);
                    dps += base * 0.12 * fall;
                }
                if (dps > 0) {
                    state._presenceAcc = (state._presenceAcc || 0) + dps * dt;
                    if (state._presenceAcc >= 2) {
                        const tick = Math.floor(state._presenceAcc);
                        state._presenceAcc -= tick;
                        player.takeDamage(tick, { silent: true });
                        try { updateHUD(); } catch (err) {}
                        if (player.hp <= 0) endGame();
                    }
                }
            }
            updateSupplyDrops(dt);
            try { updateTactical(dt); } catch (e) {}

            // Health regen
            const regenNow = state.playerStats.regen || 0;
            if (regenNow > 0 && player.hp < player.maxHp) {
                player.hp = Math.min(player.maxHp, player.hp + regenNow * dt);
                state._regenHud = (state._regenHud || 0) + dt;
                if (state._regenHud > 0.2) {
                    state._regenHud = 0;
                    try { updateHUD(); } catch (err) {}
                }
            }
            // Q016: armour recharge — Yt03's model. Recharge only starts after
            // CONFIG.armor.regenDelay seconds without taking damage, then refills
            // regenPerSec of the pool per second (with a small floor so a tiny pool still
            // recovers). Replaces Yt02's continuous 0.5 + 0.25*regen trickle, which let
            // armour behave as a second health bar with no reason to ever play carefully.
            if ((state.armorMaxHp || 0) > 0 && (state.armorHp || 0) < state.armorMaxHp) {
                const sinceDmg = (state.runTime || 0) - (state.lastDamagedAt || 0);
                if (sinceDmg >= CONFIG.armor.regenDelay) {
                    const rate = Math.max(CONFIG.armor.regenFloor, state.armorMaxHp * CONFIG.armor.regenPerSec);
                    state.armorHp = Math.min(state.armorMaxHp, (state.armorHp || 0) + rate * dt);
                    state._armorHud = (state._armorHud || 0) + dt;
                    if (state._armorHud > 0.2) {
                        state._armorHud = 0;
                        try { updateHUD(); } catch (err) {}
                    }
                }
            }

            // Enhanced Auto-aim with Sticky Targeting
            let bestTarget = null;
            let minScore = Infinity;

            enemies.forEach(e => {
                if (!e.isDead) {
                    let dist = player.mesh.position.distanceTo(e.mesh.position);
                    
                    // Bias factor: Make the current target "closer" effectively to prevent jittery switching
                    if (state.targetEnemy === e) {
                        dist *= 0.75; // 25% stickiness bias
                    }

                    if (dist < minScore) {
                        minScore = dist;
                        bestTarget = e;
                    }
                }
            });
            
            // Validation: Ensure target is still valid
            if (state.targetEnemy && (state.targetEnemy.isDead || !enemies.includes(state.targetEnemy))) {
                state.targetEnemy = null;
            }
            
            state.targetEnemy = bestTarget;

            if (state.targetEnemy) {
                player.aimAt(state.targetEnemy.mesh.position, dt); // FIX (Tier 4)
            } else if (state.input.x !== 0 || state.input.y !== 0) {
                const tPos = player.mesh.position.clone().add(new THREE.Vector3(state.input.x * 10, 0, state.input.y * 10));
                player.aimAt(tPos);
            }

            // Player shooting
            const fireRate = CONFIG.fireRate * (100 / state.playerStats.fireRate);
            if (state.input.isFiring && clock.getElapsedTime() - state.lastFireTime > fireRate) {
                shoot(player);
                state.lastFireTime = clock.getElapsedTime();
            }

            // Enemy AI
            enemies.forEach(e => {
                if (e.isDead) return;
                if (e._cmdBuffUntil && (state.runTime || 0) >= e._cmdBuffUntil) {
                    e.speedMult = e._baseSpd || e.speedMult || 1;
                    e._cmdBuffUntil = 0;
                }

                // v26.3: one move() per enemy per frame (was a dummy terrain step + AI step)
                let moved = false;
                const step = (vec) => { moved = true; e.move(dt, vec); };

                const toPlayer = _tv4.subVectors(player.mesh.position, e.mesh.position); // FIX (Tier 3): scratch vector
                const dist = toPlayer.length();

                if (e.type === 'healer') {
                    const woundedAlly = enemies.find(ally => !ally.isDead && ally !== e && ally.hp < ally.maxHp);
                    if (woundedAlly && clock.getElapsedTime() - e.lastHealTime > 2) {
                        woundedAlly.heal(ENEMY_TYPES.healer.healAmount);
                        e.lastHealTime = clock.getElapsedTime();
                        try {
                            const a = e.mesh.position, b = woundedAlly.mesh.position;
                            fxAimLine(e, a.x, a.y + 1.6, a.z, b.x, b.y + 1.6, b.z, 0x4ade80, 0.85);
                            e._healBeamUntil = clock.getElapsedTime() + 0.35;
                        } catch (err) {}
                    }
                    if (e._healBeamUntil && clock.getElapsedTime() < e._healBeamUntil && woundedAlly) {
                        try {
                            const a = e.mesh.position, b = woundedAlly.mesh.position;
                            fxAimLine(e, a.x, a.y + 1.6, a.z, b.x, b.y + 1.6, b.z, 0x4ade80, 0.7);
                        } catch (err) {}
                    } else if (e._healBeamUntil && clock.getElapsedTime() >= e._healBeamUntil) {
                        e._healBeamUntil = 0; try { if (e._aimLine) fxClearEnemy(e); } catch (err) {}
                    }
                    if (dist < 20) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize()); // FIX (Tier 3)
                } else if (e.type === 'sniper' || e.type === 'picker') {
                    if (dist < 25) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize().multiplyScalar(0.5));
                    else if (dist > 30) step(_sv1.set(toPlayer.x, toPlayer.z).normalize()); // FIX (Tier 3)
                    e.aimAt(player.mesh.position, dt); // FIX (Tier 4)
                    if (player && !player.isDead && dist < 48) {
                        const pulse = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 7));
                        try {
                            fxAimLine(e, e.mesh.position.x, e.mesh.position.y + 1.8, e.mesh.position.z,
                                player.mesh.position.x, player.mesh.position.y + 1.2, player.mesh.position.z,
                                0xd8b4fe, pulse);
                        } catch (err) {}
                    } else { try { if (e._aimLine) fxClearEnemy(e); } catch (err) {} }
                    if (enemyFireRoll(0.008, dt)) shoot(e); // v10
                } else if (e.isBoss) { // v6(C): boss behaviour
                    if (dist > 24) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    else if (dist < 14) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    const now = clock.getElapsedTime();

                    // Q038: GENERIC ENRAGE FALLBACK, ported from Yt03. Any boss without a
                    // bespoke phase script still escalates at the 60% and 30% thresholds, so
                    // adding a seventh boss never ships a fight that stays flat from start to
                    // finish. The six bespoke bosses are excluded so this does not stack on
                    // top of their tailored phases.
                    if (!BESPOKE_PHASE_BOSSES[e.type]) {
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) {
                            e._phase = 3;
                            showBossBanner(((e.name || e.type) + '').toUpperCase() + ' — PHASE 3: ENRAGED');
                            try { showCombatText('ENRAGED!', e.mesh.position, '#ef4444', 16); } catch (err) {}
                            e.damageMult = (e.damageMult || 1) * 1.25;
                            e.speedMult = (e.speedMult || 1) * 1.15;
                        } else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) {
                            e._phase = 2;
                            showBossBanner(((e.name || e.type) + '').toUpperCase() + ' — PHASE 2');
                            try { showCombatText('PHASE 2!', e.mesh.position, '#f59e0b', 14); } catch (err) {}
                            e.attackInterval = Math.max(0.8, (e.attackInterval || 2.0) * 0.8);
                        }
                    }

                    if (e.type === 'warlord') {
                        // Q038 / Yt01: P2 = fan fires 20% faster · P3 = calls two scouts once
                        // and every fan is followed by a second, offset fan.
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('WARLORD — PHASE 3'); }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('WARLORD — PHASE 2'); }
                        const wInt = e.attackInterval * (((e._phase || 1) >= 2) ? 0.8 : 1);
                        const wFan = () => {
                            createMuzzleFlash(e);
                            const base = _bossDir.set(toPlayer.x, 0, toPlayer.z).normalize();
                            for (let s = -2; s <= 2; s++) {
                                spawnBullet(e, base.clone().applyAxisAngle(_bossAxis, s * 0.3), ENEMY_TYPES.warlord.damage);
                            }
                        };
                        if (now >= e.nextAttackAt) {
                            e.nextAttackAt = now + wInt;
                            wFan();
                            if ((e._phase || 1) >= 3 && !e._p3Summoned) { e._p3Summoned = true; bossSummon(e, 'scout', 2); }
                            if ((e._phase || 1) >= 3) e._dualAt = now + 0.45;
                        }
                        if (e._dualAt && now >= e._dualAt) { e._dualAt = 0; wFan(); }
                    } else if (e.type === 'colossus') {
                        // Q038 / Yt01: P2 = reinforcement wave grows to 3 · P3 = bonus triple
                        // burst every 10s on top of the normal attack.
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('COLOSSUS — PHASE 3'); e._p3BurstAt = now + 10; }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('COLOSSUS — PHASE 2'); }
                        if (e.hp < e.maxHp * 0.66 && !e.summoned1) { e.summoned1 = true; bossSummon(e, 'scout', ((e._phase || 1) >= 2) ? 3 : 2); }
                        if (e.hp < e.maxHp * 0.33 && !e.summoned2) { e.summoned2 = true; bossSummon(e, 'soldier'); }
                        if (now >= e.nextAttackAt) { e.nextAttackAt = now + e.attackInterval; e.burstLeft = 3; }
                        if (e._p3BurstAt && now >= e._p3BurstAt) {
                            e._p3BurstAt = now + 10;
                            e.burstLeft = 3; e.burstTimer = now;
                            showBossBanner('COLOSSUS — EXTRA BURST');
                        }
                        if (e.burstLeft > 0 && now >= e.burstTimer) {
                            e.burstLeft--; e.burstTimer = now + 0.18;
                            if (e.burstLeft === 2) createMuzzleFlash(e);
                            spawnBullet(e, _bossDir.set(toPlayer.x, 0, toPlayer.z).normalize(), ENEMY_TYPES.colossus.damage);
                        }
                    } else if (e.type === 'nova') {
                        // Q038 / Yt01: P2 = double ring · P3 = triple ring.
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('NOVA — PHASE 3'); }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('NOVA — PHASE 2'); }
                        const nRings = (e._phase || 1) >= 3 ? 3 : ((e._phase || 1) >= 2 ? 2 : 1);
                        if (now >= e.nextAttackAt) { // eight-way nova ring, repeated per phase
                            e.nextAttackAt = now + e.attackInterval;
                            e.mesh.traverse(c => { if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = 1; } });
                            createMuzzleFlash(e);
                            for (let r = 0; r < nRings; r++) {
                                for (let s = 0; s < 8; s++) {
                                    const a = (s / 8 * Math.PI * 2) + r * (Math.PI / 8);
                                    spawnBullet(e, _bossDir.set(Math.sin(a), 0, Math.cos(a)), ENEMY_TYPES.nova.damage);
                                }
                            }
                        } else if (e.nextAttackAt - now > 1.2) { // cloaked while charging
                            const cloackO = 0.15 + 0.1 * Math.sin(now * 3);
                            e.mesh.traverse(c => { if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = cloackO; } });
                        }
                    } else if (e.type === 'titan') { // v24: ground-slam shockwaves — HUD 24 phases change rhythm, not rate
                        if (dist > 16) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                        e.aimAt(player.mesh.position, dt);
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('TITAN — PHASE 3'); }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('TITAN — PHASE 2'); }
                        const slamIn = (e.nextAttackAt || 0) - now;
                        if (slamIn > 0 && slamIn < 0.8) {
                            const u = 1 - slamIn / 0.8;
                            try {
                                fxKeepRing(e, '_tgRing', e.mesh.position.x, e.mesh.position.z, 0x93c5fd, 2 + 12 * u, 0.25 + 0.5 * u, false);
                                fxKeepRing(e, '_tgFill', e.mesh.position.x, e.mesh.position.z, 0x60a5fa, 14 * u, 0.12 * u, true);
                            } catch (err) {}
                        } else {
                            if (e._tgRing) { try { scene.remove(e._tgRing); } catch (err) {} e._tgRing = null; }
                            if (e._tgFill) { try { scene.remove(e._tgFill); } catch (err) {} e._tgFill = null; }
                        }
                        if (now >= e.nextAttackAt) {
                            e.nextAttackAt = now + e.attackInterval;
                            titanDoSlam(e, 1);
                            if ((e._phase || 1) >= 2) e._followSlamAt = now + 0.95;
                            if ((e._phase || 1) >= 3) e._pipAt = now + 0.55;
                        }
                        if (e._followSlamAt && now >= e._followSlamAt) {
                            e._followSlamAt = 0;
                            titanDoSlam(e, 0.72);
                        }
                        if (e._pipAt && now >= e._pipAt) {
                            e._pipAt = 0;
                            for (let p = 0; p < 4; p++) {
                                const ang = p * Math.PI * 0.5 + 0.2;
                                const px = e.mesh.position.x + Math.cos(ang) * 10;
                                const pz = e.mesh.position.z + Math.sin(ang) * 10;
                                try { fxRingAt(px, pz, 0x93c5fd, 0.6, 2.8, 0.28, true); } catch (err) {}
                                const dxp = player.mesh.position.x - px, dzp = player.mesh.position.z - pz;
                                if (dxp * dxp + dzp * dzp < 3.2 * 3.2) {
                                    hurtPlayerAt(ENEMY_TYPES.titan.damage * 0.45 * (state.diffMult.dmg || 1) * (e.damageMult || 1), px, pz);
                                }
                            }
                        }
                    } else if (e.type === 'tempest') { // v24: blink strikes — HUD 24 phases add extra blinks/bursts, same cadence
                        step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                        e.aimAt(player.mesh.position, dt);
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('TEMPEST — PHASE 3'); }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('TEMPEST — PHASE 2'); }
                        const blinkIn = (e.nextAttackAt || 0) - now;
                        if (blinkIn > 0 && blinkIn < 0.4) {
                            if (!e._ghostDest) {
                                const a2 = Math.random() * Math.PI * 2;
                                const d2 = 16 + Math.random() * 8;
                                e._ghostDest = { x: player.mesh.position.x + Math.cos(a2) * d2, z: player.mesh.position.z + Math.sin(a2) * d2 };
                            }
                            try { fxKeepRing(e, '_ghost', e._ghostDest.x, e._ghostDest.z, 0x38bdf8, 2.2, 0.35 + 0.4 * (1 - blinkIn / 0.4), false); } catch (err) {}
                        }
                        if (now >= e.nextAttackAt) {
                            e.nextAttackAt = now + e.attackInterval;
                            createExplosion(e.mesh.position.clone(), 16, 0x38bdf8, 'armor');
                            if (!e._ghostDest) {
                                const a2 = Math.random() * Math.PI * 2;
                                const d2 = 16 + Math.random() * 8;
                                e._ghostDest = { x: player.mesh.position.x + Math.cos(a2) * d2, z: player.mesh.position.z + Math.sin(a2) * d2 };
                            }
                            e.mesh.position.set(e._ghostDest.x, 0, e._ghostDest.z);
                            e._ghostDest = null;
                            if (e._ghost) { try { scene.remove(e._ghost); } catch (err) {} e._ghost = null; }
                            SFX.bossAlarm();
                            e.burstLeft = 3; e.burstTimer = 0;
                            e._extraBurst = (e._phase || 1) >= 2;
                            if ((e._phase || 1) >= 3) e._secondBlinkAt = now + 0.55;
                        }
                        if (e._secondBlinkAt && now >= e._secondBlinkAt) {
                            e._secondBlinkAt = 0;
                            const a3 = Math.random() * Math.PI * 2;
                            const d3 = 14 + Math.random() * 8;
                            e.mesh.position.set(player.mesh.position.x + Math.cos(a3) * d3, 0, player.mesh.position.z + Math.sin(a3) * d3);
                            try { createExplosion(e.mesh.position.clone(), 10, 0x38bdf8, 'spark'); } catch (err) {}
                        }
                        if (e.burstLeft > 0 && now >= e.burstTimer) {
                            e.burstLeft--; e.burstTimer = now + 0.14;
                            if (e.burstLeft === 2) createMuzzleFlash(e);
                            spawnBullet(e, _bossDir.set(toPlayer.x, 0, toPlayer.z).normalize(), ENEMY_TYPES.tempest.damage);
                            if (e.burstLeft === 0 && e._extraBurst) {
                                e._extraBurst = false;
                                e.burstLeft = 3;
                                e.burstTimer = now + 0.42;
                            }
                        }
                    } else if (e.type === 'fortress') { // v24: spiral barrage with rest cycles
                        // Q038 / Yt01: P2 = faster spin · P3 = three arms plus a
                        // counter-rotating set, so the safe gaps close up.
                        if (e.hp < e.maxHp * 0.3 && (e._phase || 1) < 3) { e._phase = 3; showBossBanner('FORTRESS — PHASE 3'); }
                        else if (e.hp < e.maxHp * 0.6 && (e._phase || 1) < 2) { e._phase = 2; showBossBanner('FORTRESS — PHASE 2'); }
                        if (dist > 30) step(_sv1.set(toPlayer.x, toPlayer.z).normalize().multiplyScalar(0.5));
                        e.aimAt(player.mesh.position, dt);
                        e.spiralAngle = (e.spiralAngle || 0) + dt * (((e._phase || 1) >= 2) ? 3.0 : 2.4);
                        if (now >= (e.restUntil || 0)) {
                            if (e.firing && now >= (e.nextSpiral || 0)) {
                                e.nextSpiral = now + 0.22;
                                const fArms = ((e._phase || 1) >= 3) ? 3 : 2;
                                for (let s2 = 0; s2 < fArms; s2++) {
                                    const a3 = e.spiralAngle + s2 * (Math.PI * 2 / fArms);
                                    spawnBullet(e, _bossDir.set(Math.sin(a3), 0, Math.cos(a3)), ENEMY_TYPES.fortress.damage);
                                }
                                if ((e._phase || 1) >= 3) { // counter-rotating set
                                    for (let s3 = 0; s3 < 3; s3++) {
                                        const a4 = -e.spiralAngle * 1.15 + s3 * (Math.PI * 2 / 3);
                                        spawnBullet(e, _bossDir.set(Math.sin(a4), 0, Math.cos(a4)), ENEMY_TYPES.fortress.damage);
                                    }
                                }
                                e.spiralShots = (e.spiralShots || 0) + 1;
                                if (e.spiralShots >= 22) { e.spiralShots = 0; e.firing = false; e.restUntil = now + e.attackInterval; }
                            }
                            if (!e.firing && now >= e.restUntil) e.firing = true;
                        }
                    }
                } else if (e.type === 'skirmisher' || e.type === 'squsasher') {
                    if (e.wavePhase === undefined) e.wavePhase = Math.random() * Math.PI * 2;
                    if (dist > 22) {
                        step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    } else if (dist < 16) {
                        step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize().multiplyScalar(1.3)); // back off hard
                    } else {
                        const st = Math.sin(clock.getElapsedTime() * 1.7 + e.wavePhase);
                        step(_sv1.set(-toPlayer.z, toPlayer.x).normalize().multiplyScalar(st)); // strafe
                    }
                    e.aimAt(player.mesh.position, dt);
                    if (enemyFireRoll(0.012 * (ENEMY_TYPES.skirmisher.fireRate || 0.75), dt)) shoot(e);
                } else if (e.type === 'wasp') { // v26: fast weaving swarm
                    if (e.wavePhase === undefined) e.wavePhase = Math.random() * Math.PI * 2;
                    const weave = Math.sin(clock.getElapsedTime() * 3 + e.wavePhase) * 0.85;
                    const inv = 1 / (Math.hypot(toPlayer.x, toPlayer.z) || 1);
                    const fx = toPlayer.x * inv, fz = toPlayer.z * inv;
                    step(_sv1.set(fx - fz * weave, fz + fx * weave).normalize()); // forward + perpendicular weave
                    e.aimAt(player.mesh.position, dt);
                    if (dist < 26 && enemyFireRoll(0.012 * (ENEMY_TYPES.wasp.fireRate || 1.1), dt)) shoot(e);
                } else if (e.type === 'juggernaut' || e.type === 'hammer') {
                    step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if (dist < 40 && enemyFireRoll(0.012 * (ENEMY_TYPES.juggernaut.fireRate || 0.3), dt)) shoot(e);
                } else if (e.type === 'raider' || e.type === 'tombraider') {
                    if (e.raidPhase === undefined) e.raidPhase = 0;
                    if (e.raidPhase === 0) {
                        step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                        if (dist < 16) e.raidPhase = 1;
                    } else if (e.raidPhase === 1) {
                        const st = Math.sin(clock.getElapsedTime() * 4);
                        step(_sv1.set(-toPlayer.z, toPlayer.x).normalize().multiplyScalar(st));
                        if (dist < 22 && enemyFireRoll(0.028, dt)) shoot(e);
                        if (dist < 10) e.raidPhase = 2;
                    } else {
                        step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize());
                        if (dist > 28) e.raidPhase = 0;
                    }
                    e.aimAt(player.mesh.position, dt);
                } else if (e.type === 'bomber' || e.type === 'deathbringer') {
                    step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if (dist < 16) {
                        const u = 1 - dist / 16;
                        const flash = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 14));
                        try {
                            e.mesh.traverse(c => { if (c.isMesh && c.material && c.material.emissive) c.material.emissive.setHex(flash > 0.7 ? 0xff3300 : 0x440000); });
                            fxKeepRing(e, '_tgRing', e.mesh.position.x, e.mesh.position.z, 0xf43f5e, 1.2 + 3.4 * u, 0.2 + 0.45 * u, false);
                        } catch (err) {}
                    } else if (e._tgRing) {
                        try { scene.remove(e._tgRing); } catch (err) {} e._tgRing = null;
                        try { e.mesh.traverse(c => { if (c.isMesh && c.material && c.material.emissive) c.material.emissive.setHex(0x000000); }); } catch (err) {}
                    }
                    if (e.type === 'deathbringer' && dist < 28 && enemyFireRoll(0.014, dt)) shoot(e);
                    if (dist < 4.5) {
                        createExplosion(e.mesh.position.clone(), 6, 0xff4500, 'spark');
                        player.takeDamage((ENEMY_TYPES[e.type]?.damage || 30) * (state.diffMult.dmg || 1) * (e.damageMult || 1));
                        showDamageDirection(e.mesh.position.x, e.mesh.position.z);
                        e.die();
                    }
                } else if (e.type === 'phantom' || e.type === 'phantasm') {
                    if (dist > 20) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if (enemyFireRoll(0.010 * (ENEMY_TYPES.phantom.fireRate || 0.5), dt)) shoot(e); // v10
                    const cloackO = 0.25 + 0.6 * Math.abs(Math.sin(clock.getElapsedTime() * 1.5));
                    e.mesh.traverse(c => {
                        if (c.isMesh && c.material) { c.material.transparent = true; c.material.opacity = cloackO; }
                    });
                } else if (e.type === 'gunnier') {
                    if (dist > 22) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if (enemyFireRoll(0.012 * (ENEMY_TYPES.gunnier.fireRate || 0.55), dt)) shoot(e);
                } else if (e.type === 'gunner') {
                    if (dist > 22) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if ((e.burstLeft || 0) > 0) {
                        if (clock.getElapsedTime() > (e.burstTimer || 0)) {
                            shoot(e);
                            e.burstLeft--;
                            e.burstTimer = clock.getElapsedTime() + 0.12;
                        }
                    } else if (enemyFireRoll(0.003, dt)) {
                        e.burstLeft = 3;
                    }
                } else if (e.type === 'artillery') {
                    if (e.nextAttackAt == null) e.nextAttackAt = clock.getElapsedTime() + 1.6;
                    if (dist < 28) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize());
                    else if (dist > 40) step(_sv1.set(toPlayer.x, toPlayer.z).normalize().multiplyScalar(0.55));
                    e.aimAt(player.mesh.position, dt);
                    if (dist < 52 && clock.getElapsedTime() >= (e.nextAttackAt || 0)) {
                        e.nextAttackAt = clock.getElapsedTime() + 3.2;
                        fireArtilleryShell(e);
                    }
                } else if (e.type === 'shieldbearer') {
                    if (dist > 11) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt);
                    if (dist < 26 && enemyFireRoll(0.010, dt)) shoot(e);
                } else if (e.type === 'minelayer') {
                    if (e.nextAttackAt == null) e.nextAttackAt = clock.getElapsedTime() + 2.2;
                    if (e.wavePhase === undefined) e.wavePhase = Math.random() * Math.PI * 2;
                    if (dist > 24) step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    else if (dist < 14) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize());
                    else {
                        const st = Math.sin(clock.getElapsedTime() * 1.2 + e.wavePhase);
                        step(_sv1.set(-toPlayer.z, toPlayer.x).normalize().multiplyScalar(st));
                    }
                    e.aimAt(player.mesh.position, dt);
                    if (clock.getElapsedTime() >= (e.nextAttackAt || 0)) {
                        e.nextAttackAt = clock.getElapsedTime() + 4.0;
                        const own = fieldMines.filter(function (m) { return m.owner === e; }).length;
                        if (own < 3) {
                            const mineDmg = (ENEMY_TYPES.minelayer.damage || 22) * (state.diffMult.dmg || 1) * (e.damageMult || 1);
                            dropMine(e.mesh.position.x, e.mesh.position.z, mineDmg);
                            if (fieldMines.length) fieldMines[fieldMines.length - 1].owner = e;
                        }
                    }
                    if (dist < 26 && enemyFireRoll(0.008, dt)) shoot(e);
                } else if (e.type === 'commander') {
                    if (e._buffAt == null) e._buffAt = clock.getElapsedTime() + 1.8;
                    if (dist < 18) step(_sv1.set(-toPlayer.x, -toPlayer.z).normalize());
                    else if (dist > 28) step(_sv1.set(toPlayer.x, toPlayer.z).normalize().multiplyScalar(0.7));
                    e.aimAt(player.mesh.position, dt);
                    if (clock.getElapsedTime() >= (e._buffAt || 0)) {
                        e._buffAt = clock.getElapsedTime() + 5;
                        try { fxKeepRing(e, '_tgRing', e.mesh.position.x, e.mesh.position.z, 0xfacc15, 8, 0.4, false); } catch (err) {}
                        for (const ally of enemies) {
                            if (!ally || ally === e || ally.isDead || ally.isBoss) continue;
                            const adx = ally.mesh.position.x - e.mesh.position.x;
                            const adz = ally.mesh.position.z - e.mesh.position.z;
                            if (adx * adx + adz * adz < 16 * 16) {
                                if (!ally._baseSpd) ally._baseSpd = ally.speedMult || 1;
                                ally.speedMult = ally._baseSpd * 1.18;
                                ally._cmdBuffUntil = (state.runTime || 0) + 4;
                            }
                        }
                    }
                    if (dist < 32 && enemyFireRoll(0.010, dt)) shoot(e);
                } else if (e.type === 'berserker') {
                    step(_sv1.set(toPlayer.x, toPlayer.z).normalize());
                    e.aimAt(player.mesh.position, dt); // FIX (Tier 4)
                    if (dist < 18 && enemyFireRoll(0.025, dt)) shoot(e); // v10 // FIX (Tier 3)
                } else {
                    if (dist > 18) step(_sv1.set(toPlayer.x, toPlayer.z).normalize()); // FIX (Tier 3)
                    e.aimAt(player.mesh.position, dt); // FIX (Tier 4)
                    if (enemyFireRoll(0.012 * (ENEMY_TYPES[e.type]?.fireRate || 0.4), dt)) shoot(e); // v10
                }
                if (!moved) e.move(dt, _sv1.set(0, 0)); // idle: terrain follow only
                if (e.hpBar && !e.isDead) {
                    e.hpBar.position.copy(e.mesh.position);
                    e.hpBar.position.y += e._hpBarLift || 3.4;
                }
                keepTankSpacing(e);
            });

            // v5: remove enemies that died outside the bullet path (kamikaze detonations)
            if (enemies.some(en => en.isDead)) enemies = enemies.filter(en => !en.isDead);

            // Bullets
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                const ud = b.group.userData;
                if (!ud.isPlayer && ud.home > 0 && player && !player.isDead) {
                    const turn = Math.min(0.85, ud.home);
                    _shotSeek.set(
                        player.mesh.position.x - b.group.position.x,
                        (player.mesh.position.y + 1.2) - b.group.position.y,
                        player.mesh.position.z - b.group.position.z
                    ).normalize().multiplyScalar(ud.speed || CONFIG.bulletSpeed);
                    ud.vel.lerp(_shotSeek, 1 - Math.pow(1 - turn, dt * 60));
                    b.group.lookAt(_shotLook.copy(b.group.position).add(ud.vel));
                }
                b.group.position.add(_tv1.copy(ud.vel).multiplyScalar(dt)); // FIX (Tier 3): no per-frame allocation
                ud.life -= dt;

                // Pulse effect
                const pulse = 1 + Math.sin(clock.getElapsedTime() * 25) * 0.18;
                b.innerGlow.scale.setScalar(pulse);
                b.outerGlow.scale.setScalar(pulse * 1.1);

                let hit = false;

                // v17: no walls — bullets simply expire by lifetime

                // Environment Object Check (Trees, Rocks)
                // FIX (Tier 3): spatial grid — the bullet now checks only the ~3 cells near
                // it instead of scanning every environment object (incl. 1,250 grass clumps).
                if (!hit) {
                    for (const col of collidersNear(b.group.position.x, b.group.position.z)) {
                        const dx = b.group.position.x - col.x;
                        const dz = b.group.position.z - col.z;
                        const distSq = dx*dx + dz*dz;
                        const rad = col.r;

                        // Simple cylinder collision for environment
                        if (distSq < rad*rad) {
                            hit = true;
                            createExplosion(b.group.position, 8, 0xaaaaaa, col.type);
                            // v19: destructible cover — soak hits, then shatter
                            if (col.hp !== undefined && !col.dead) {
                                // Q047: charge the normalised pool, scaled by how hard this
                                // shell hits relative to the player's current shell damage
                                col.hp -= coverHitCost(b.group.userData.damage);
                                if (col.hp <= 0) {
                                    const ck = chunkKey(Math.floor(col.x / CHUNK), Math.floor(col.z / CHUNK));
                                    const ch2 = envChunks.get(ck);
                                    if (ch2) destroyDestructible(ch2, col);
                                }
                            }
                            break;
                        }
                    }
                }

                if (!hit) {
                    if (b.group.userData.isPlayer) {
                        for (let j = enemies.length - 1; j >= 0; j--) {
                            const enemy = enemies[j];
                            if (!enemy.isDead) {
                                // Cylindrical Hitbox: even more forgiving on elevation for gameplay feel
                                const dx = b.group.position.x - enemy.mesh.position.x;
                                const dz = b.group.position.z - enemy.mesh.position.z;
                                const dy = Math.abs(b.group.position.y - enemy.mesh.position.y);
                                
                                const distSq = dx*dx + dz*dz;
                                const hitRadius = 2.6; // Slightly larger hitbox
                                const heightThreshold = 6.0; // Much more forgiving elevation hit (was 3.8)

                                if (distSq < hitRadius*hitRadius && dy < heightThreshold && !b.group.userData.hitList.includes(enemy)) {
                                    b.group.userData.hitList.push(enemy); // v5: pierce memory
                                    let dmg = b.group.userData.damage; // v4: crits
                                    const isCrit = Math.random() * 100 < (state.playerStats.crit || 0);
                                    if (isCrit) dmg *= 2;
                                    if (isCrit && state.playerStats.evo_prism) {
                                        b.group.userData.pierce = (b.group.userData.pierce || 0) + 1;
                                        try { fxSparks(b.group.position.x, b.group.position.y, b.group.position.z, 0xa5f3fc, 8); } catch (err) {}
                                    }
                                    if (enemy.type === 'shieldbearer' && (b.group.userData.pierce || 0) <= 0) {
                                        const fx = Math.sin(enemy.mesh.rotation.y), fz = Math.cos(enemy.mesh.rotation.y);
                                        const bx = b.group.position.x - enemy.mesh.position.x;
                                        const bz = b.group.position.z - enemy.mesh.position.z;
                                        const bl = Math.hypot(bx, bz) || 1;
                                        if ((fx * bx + fz * bz) / bl > 0.28) {
                                            dmg *= 0.12;
                                            try { fxSparks(b.group.position.x, b.group.position.y, b.group.position.z, 0x60a5fa, 6); } catch (err) {}
                                        }
                                    }
                                    enemy.takeDamage(dmg);
                                    if (!enemy.isDead) bumpComboFromHit(enemy);
                                    if (isCrit) SFX.crit(); else SFX.hit(); // v23
                                    if ((state.playerStats.splash || 0) > 0) { // v24: Shell Shock
                                        const radius = 3.5 + state.playerStats.splash * 1.2;
                                        for (let j = enemies.length - 1; j >= 0; j--) {
                                            const other = enemies[j];
                                            if (other === enemy || other.isDead) continue;
                                            if (other.mesh.position.distanceTo(b.group.position) < radius) {
                                                other.takeDamage(b.group.userData.damage * 0.5);
                                                if (!other.isDead) bumpComboFromHit(other);
                                                if (other.isDead) {
                                                    handleEnemyKill(other, false, 'splash');
                                                    enemies.splice(j, 1);
                                                }
                                            }
                                        }
                                        try { fxRingAt(b.group.position.x, b.group.position.z, 0xff9f43, 1.2, radius * 0.55, 0.28, false); } catch (err) {}
                                    }
                                    if (enemy.isBoss) updateBossBar(); // v6(C)
                                    
                                    const enemyColor = ENEMY_TYPES[enemy.type]?.color || 0xff0000;
                                    // Pass enemy type for specific visual effects
                                    if (isCrit) {
                                        createExplosion(b.group.position, 7, 0xffe566, 'spark');
                                        try { fxSparks(b.group.position.x, b.group.position.y, b.group.position.z, 0xfff7ae, 10); } catch (err) {}
                                    } else {
                                        createExplosion(b.group.position, 2, enemyColor, 'spark');
                                    }
                                    if (b.group.userData.pierce > 0) {
                                        try { fxSparks(b.group.position.x, b.group.position.y, b.group.position.z, 0x22d3ee, 4); } catch (err) {}
                                    }
                                    
                                    if (enemy.isDead) {
                                        handleEnemyKill(enemy, isCrit, 'shell');
                                        enemies.splice(j, 1);
                                    }
                                    if (b.group.userData.pierce > 0) { // v5: keep flying through
                                        b.group.userData.pierce--;
                                    } else {
                                        hit = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } else {
                        // Enemy hitting Player
                        const dx = b.group.position.x - player.mesh.position.x;
                        const dz = b.group.position.z - player.mesh.position.z;
                        const dy = Math.abs(b.group.position.y - player.mesh.position.y);
                        
                        if (dx*dx + dz*dz < 4.6*4.6 && dy < 12) {
                            showDamageDirection(b.group.position.x, b.group.position.z); // v2 UI
                            player.takeDamage(b.group.userData.damage);
                            createExplosion(b.group.position, 3, selectedSkinColor(), 'spark');
                            if (ud.style === 'slug') state.cameraShake = Math.max(state.cameraShake || 0, 0.28);
                            
                            if (!state.reduceFlash) {
                                dom('damage-overlay').style.opacity = '0.5';
                                setTimeout(() => dom('damage-overlay').style.opacity = '0', 150);
                            }
                            
                            updateHUD();
                            if (player.hp <= 0) endGame();
                            hit = true;
                        }
                    }
                }

                if (!hit) {
                    const gy = getTerrainHeight(b.group.position.x, b.group.position.z);
                    if (b.group.position.y < gy + 0.2) {
                        hit = true;
                        createExplosion(b.group.position, 5, 0x6a6a6a, 'ground');
                    }
                }
                if (hit || ud.life <= 0) {
                    scene.remove(b.group);
                    bullets.splice(i, 1);
                }
            }

            // Particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.mesh.position.add(_tv2.copy(p.velocity).multiplyScalar(dt)); // FIX (Tier 3)
                
                if (p.gravity) {
                    p.velocity.y -= 28 * dt;
                    const groundY = getTerrainHeight(p.mesh.position.x, p.mesh.position.z);
                    if (p.mesh.position.y < groundY + 0.1) {
                        p.mesh.position.y = groundY + 0.1;
                        p.velocity.y *= -0.35;
                        p.velocity.x *= 0.7;
                        p.velocity.z *= 0.7;
                    }
                }
                
                if (p.rotationSpeed) {
                    p.mesh.rotation.x += p.rotationSpeed.x * dt;
                    p.mesh.rotation.y += p.rotationSpeed.y * dt;
                    p.mesh.rotation.z += p.rotationSpeed.z * dt;
                }

                if (p.isSmoke) {
                    p.mesh.scale.multiplyScalar(1 + p.expansionRate * dt);
                    p.velocity.y *= 0.98;
                }
                
                p.life -= dt;
                p.mesh.material.opacity = Math.max(0, p.life * 1.2);
                if (!p.isSmoke) p.mesh.scale.multiplyScalar(0.97);
                
                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    disposeObject3D(p.mesh); // FIX (Tier 2): frees per-particle materials (geometries are shared)
                    particles.splice(i, 1);
                }
            }

            // Environment particles
            // FIX (Tier 3): positions live on plain data; the single InstancedMesh's
            // matrices are refreshed once per frame (identical motion, 1 draw call).
            const biome = BIOMES[state.currentBiome];
            if (envParticleMesh) {
                for (let i = 0; i < environmentParticles.length; i++) {
                    const p = environmentParticles[i];
                    p.pos.add(_tv3.copy(p.velocity).multiplyScalar(dt));
                    p.phase += dt;

                    if (p.type === 'fireflies') {
                        p.pos.x += Math.sin(p.phase * 2) * dt * 2;
                        p.pos.y += Math.sin(p.phase * 3) * dt;
                    }

                    if (p.pos.y < 0) p.pos.y = 20;
                    if (p.pos.y > 25) p.pos.y = 0;
                    // v17: ambient particles wrap around the player, not the origin
                    if (p.pos.x - player.mesh.position.x > 80) p.pos.x -= 160;
                    if (player.mesh.position.x - p.pos.x > 80) p.pos.x += 160;
                    if (p.pos.z - player.mesh.position.z > 80) p.pos.z -= 160;
                    if (player.mesh.position.z - p.pos.z > 80) p.pos.z += 160;

                    _dummy.position.copy(p.pos);
                    _dummy.rotation.set(0, 0, 0);
                    _dummy.scale.setScalar(1);
                    _dummy.updateMatrix();
                    envParticleMesh.setMatrixAt(i, _dummy.matrix);
                }
                envParticleMesh.instanceMatrix.needsUpdate = true;
            }

            // Animate lava
            lavaMeshes.forEach(lava => {
                lava.userData.phase += dt * 2;
                lava.material.opacity = 0.8 + Math.sin(lava.userData.phase) * 0.15;
            });

            updateGlowLights(); // v26: pooled crystal/lava glow follows the player

            // Animate water (v26: re-wired to the streamed chunk water planes — the
            // original wave math, applied to every registered water mesh)
            const wTime = clock.getElapsedTime();
            const lowGfx = state.quality === 'low' || (state.quality === 'auto' && _autoApplied === 'low');
            if (!lowGfx) {
                for (const w of waterMeshes) {
                    const positions = w.geometry.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        positions.setZ(i, Math.sin(x * 0.3 + wTime) * 0.3 + Math.cos(y * 0.3 + wTime * 0.7) * 0.2);
                    }
                    positions.needsUpdate = true;
                }
            }

            updateMissiles(dt); // v24
            autoQualityTick(dt); // v25
            updateBiomeMorph(); // v20: morphing realm transition
            // Q013: Missile Pod — fixed launch cadence, stack-driven volley size.
            // Was: interval = 5 / stacks, one missile per launch (stacks made it faster).
            // Now: one volley every CONFIG.missile.launchInterval seconds, containing one
            // missile per stack up to maxPerVolley. Stacks above the cap are recorded as
            // overload and spent in missileBlast() as extra radius and damage, so the
            // upgrade keeps paying past the missile limit.
            if ((state.playerStats.missile || 0) > 0 && state.targetEnemy && !state.targetEnemy.isDead) {
                const MC = CONFIG.missile;
                if ((state.runTime || 0) - (state.lastMissileAt || 0) > MC.launchInterval) {
                    state.lastMissileAt = state.runTime || 0;
                    const plan = missileVolleyPlan(state.playerStats.missile);
                    state.missileOverload = plan.overload;
                    for (let mi = 0; mi < plan.count; mi++) fireHomingMissile(state.targetEnemy);
                }
            }
            // v24: Shield Generator — recharge + ring visual
            if ((state.playerStats.shield || 0) > 0) {
                const sInt = 18 / state.playerStats.shield;
                if (!state.shieldReadyAt) state.shieldReadyAt = (state.runTime || 0) + sInt;
                else if ((state.runTime || 0) >= state.shieldReadyAt && !state.shieldUp) {
                    state.shieldUp = true;
                    /* v26.6: skip the big toast — shield recharge is frequent and distracting */
                }
                if (player.shieldRing) player.shieldRing.visible = !!state.shieldUp;
            } else if (player.shieldRing) player.shieldRing.visible = false;

            // v17: stream the infinite world around the player
            repositionGroundTiles(BIOMES[state.currentBiome], player.mesh.position.x, player.mesh.position.z);
            streamChunks(player.mesh.position.x, player.mesh.position.z, false);
            updateChunkStream();

            // v6(C): boss wave gate — one at a time; v26.4: wait out cards + short cooldown
            if (state.bossActive && (state.bossActive.isDead || !enemies.includes(state.bossActive))) {
                state.bossActive = null;
                try { updateBossBar(); } catch (err) {}
            }
            // Boss Rush: auto-trigger next boss when cooldown expires
            if (state._bossRushActive && !state.bossActive && !state.bossPending &&
                !state.isChoosingUpgrade && (state.runTime || 0) >= (state.bossCooldownUntil || 5)) {
                state.bossPending = true;
            }
            if (state.bossPending && !state.bossActive && !state.isChoosingUpgrade
                && (state.runTime || 0) >= (state.bossCooldownUntil || 0)) {
                state.bossPending = false;
                spawnBoss();
            }

            // Spawner (v10: mode-aware — v26.2: slightly slower cadence, lower ceiling)
            const floor = (state.mode === 'casual' && state.level > 20) ? 1.0 : 1.4;
            const rawRate = Math.max(floor, 3.6 - state.level * 0.12);
            // v27.2: fold the old 1 Hz lastSpawnTime nudge into the visible interval (same cadence)
            const spawnRate = rawRate / (1.1 + 0.01 * (state.level || 1));
            const maxEnemies = getMaxEnemies();
            if (clock.getElapsedTime() - state.lastSpawnTime > spawnRate) {
                if (enemies.filter(e => !e.isDead).length < maxEnemies) {
                    spawnEnemy();
                    state.lastSpawnTime = clock.getElapsedTime();
                }
            }

            // v26: ENEMY SURGE — timed pressure waves on the pause-safe run clock.
            // Survive the window and the run pays out a coin bounty.
            if (state.surgeNextAt === undefined) state.surgeNextAt = (state.runTime || 0) + 70;
            // 5-second pre-warning before surge fires
            if (!state.surgeActive && !state._surgeWarnShown
                && state.surgeNextAt < 999999
                && state.runTime >= state.surgeNextAt - 5) {
                state._surgeWarnShown = true;
                try { showUpgradeNotification('⚠ SURGE INCOMING!'); } catch(e) {}
            }
            if (!state.surgeActive && state.runTime >= state.surgeNextAt) {
                state.surgeActive = true;
                state._surgeWarnShown = false; // reset for next surge
                state.surgeEndsAt = state.runTime + 15;
                state.surgeLastSpawn = 0;
                showBossBanner('⚠ ENEMY SURGE — HOLD THE LINE! ⚠');
                SFX.bossAlarm(); SFX.vibrate([60, 50, 60, 50, 60]);
            }
            if (state.surgeActive) {
                if (state.runTime >= state.surgeEndsAt) {
                    state.surgeActive = false;
                    const bounty = 60 + state.level * 10;
                    state.coins = (state.coins || 0) + bounty;
                    state.runCoins = (state.runCoins || 0) + bounty;
                    showBossBanner('⚔ Surge held! +' + bounty + ' 💰');
                    state.surgeNextAt = state.runTime + 80 + Math.random() * 30;
                state._surgeWarnShown = false; // allow warning before next surge
                    try { saveGame(); } catch (e) {}
                    updateHUD();
                } else if (state.runTime - (state.surgeLastSpawn || 0) > 1.4) {
                    if (enemies.filter(e => !e.isDead).length < maxEnemies + 4) {
                        spawnEnemy();
                        state.surgeLastSpawn = state.runTime;
                    }
                }
            }

            // v26.7: late-run spice — short events so 15+ is not the same fight forever
            if (state.level >= 8 && !state.surgeActive && !state.isChoosingUpgrade) {
                if (state.funUntil && state.runTime >= state.funUntil) {
                    if (state.funKind === 'bounty') state.runCoinBoost = Math.max(0, (state.runCoinBoost || 0) - 0.5);
                    state.funKind = null; state.funUntil = 0;
                    state.nextFunAt = state.runTime + 40 + Math.random() * 25;
                }
                if (!state.funKind && state.runTime >= (state.nextFunAt || 80)) {
                    const kinds = state.level >= 15 ? ['bounty', 'lull', 'raid', 'ambush'] : ['bounty', 'ambush'];
                    state.funKind = kinds[Math.floor(Math.random() * kinds.length)];
                    state.funUntil = state.runTime + (state.funKind === 'lull' ? 12 : 16);
                    state.nextFunAt = state.funUntil + 40 + Math.random() * 25;
                    if (state.funKind === 'bounty') {
                        state.runCoinBoost = (state.runCoinBoost || 0) + 0.5;
                        showBossBanner('💰 BOUNTY — extra coins for 16s');
                    } else if (state.funKind === 'lull') {
                        showBossBanner('🌤 BREATHER — fewer spawns');
                    } else if (state.funKind === 'ambush') {
                        showBossBanner('📦 SUPPLY AMBUSH — the crate is bait');
                        try { spawnSupplyDrop(); } catch (err) {}
                        const drop = supplyDrops[supplyDrops.length - 1];
                        const ax = drop && drop.group ? drop.group.position.x : player.mesh.position.x;
                        const az = drop && drop.group ? drop.group.position.z : player.mesh.position.z;
                        const raidCeil = getMaxEnemies() + 3;
                        for (let i = 0; i < 3; i++) {
                            if (livingEnemyCount() >= raidCeil) break;
                            const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 5;
                            makeScaledEnemy(i === 2 ? 'soldier' : 'scout', ax + Math.cos(a) * d, az + Math.sin(a) * d);
                        }
                    } else {
                        showBossBanner('🏍 RAIDERS INBOUND');
                        const raidCeil = getMaxEnemies() + 4;
                        for (let i = 0; i < 2; i++) {
                            if (livingEnemyCount() >= raidCeil) break;
                            const a = Math.random() * Math.PI * 2, d = 36 + Math.random() * 10;
                            makeScaledEnemy('raider', player.mesh.position.x + Math.cos(a) * d, player.mesh.position.z + Math.sin(a) * d);
                        }
                    }
                }
                if (state.funKind === 'lull') {
                    // skip extra pressure: bump last spawn so cadence idles
                    if (clock.getElapsedTime() - state.lastSpawnTime < 2.2) state.lastSpawnTime = clock.getElapsedTime() - 0.4;
                }

            }

            // v27.8: keep the tank in the lower-middle of the screen so the HUD never eats it.
            // Camera sits south (+Z); "up" on the phone is -Z. Old lookAt(+6) shoved the tank under the chips.
            let nearest = Infinity;
            for (const e of enemies) {
                if (e.isDead) continue;
                const dx = e.mesh.position.x - player.mesh.position.x;
                const dz = e.mesh.position.z - player.mesh.position.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < nearest) nearest = d2;
            }
            nearest = Math.sqrt(nearest);
            let targetF = 1.06;
            if (nearest < 18) targetF = 1.02;
            else if (nearest > 52 || !isFinite(nearest)) targetF = 1.14;
            if (state.bossActive && !state.bossActive.isDead) targetF = Math.max(targetF, 1.18);
            targetF += Math.min(0.05, (player.velocity.length() / CONFIG.playerSpeed) * 0.06);
            targetF = Math.max(1.0, Math.min(1.24, targetF));
            state.camF = (state.camF || 1.06) + (targetF - (state.camF || 1.06)) * Math.min(1, dt * 0.65);
            const wide = state.cameraMode === 'wide';
            const baseY = wide ? 40 : 33;
            const baseZ = wide ? 54 : 42;
            const camOffset = _tv5.set(0, baseY * state.camF, baseZ * state.camF);
            const targetCam = _tv1.copy(player.mesh.position).add(camOffset);
            const camK = wide ? 0.04 : 0.055;
            camera.position.lerp(targetCam, 1 - Math.pow(1 - camK, dt * 60));
            const spd = player.velocity.length();
            let lx = player.mesh.position.x;
            let lz = player.mesh.position.z - 12;
            if (spd > 0.6) {
                const lead = 9 + Math.min(8, spd * 0.35);
                lx = player.mesh.position.x + (player.velocity.x / spd) * lead;
                lz = player.mesh.position.z + (player.velocity.z / spd) * lead;
            }
            camera.lookAt(lx, 1.0, lz);

            if (state.cameraShake > 0) {
                const shakeScale = (state.cameraMode === 'wide' ? 0.55 : 1) * (state.shakeMode === 'off' ? 0 : state.shakeMode === 'reduced' ? 0.22 : 1);
                camera.position.x += (Math.random() - 0.5) * state.cameraShake * shakeScale;
                camera.position.z += (Math.random() - 0.5) * state.cameraShake * shakeScale;
                state.cameraShake = Math.max(0, state.cameraShake - dt * 2);
            }

            // v26: keep the shadow frustum centered on the player. The ±115-unit
            // ortho box used to sit at the origin forever — in the infinite world
            // everything beyond ~115 units from spawn silently lost its shadows.
            // Re-centers in quantized 8-unit steps so shadows don't shimmer while driving.
            const _sx = Math.round(player.mesh.position.x / 8) * 8;
            const _sz = Math.round(player.mesh.position.z / 8) * 8;
            dirLight.position.set(_sx + 50, 80, _sz + 30);
            dirLight.target.position.set(_sx, 0, _sz);

            drawMinimap(); // v2 UI: battlefield awareness on the bigger map
            if ((state._tipTick = (state._tipTick || 0) + 1) % 120 === 0) tutorialTick(); // v25
            SFX.engineSet(Math.min(1, player.velocity.length() / CONFIG.playerSpeed)); // v23
            const __d = player.velocity.length() * dt; // v23: lifetime/run distance
            lifeStats().distance += __d;
            lifeStats().playTime += dt;
            state.runDist = (state.runDist || 0) + __d;
            bumpDaily('runDistBest', state.runDist);
            _lastPhysicsCost = performance.now() - _physT0; // v21
        }

        let _minimapCtx = null;
        function drawMinimap() { // v2 UI: north-up radar — player, enemies, target highlight
            if (!_minimapCtx) {
                const cv = document.getElementById('minimap');
                if (!cv) return;
                _minimapCtx = cv.getContext('2d');
            }
            const ctx = _minimapCtx;
            const W = _minimapCtx.canvas.width, k = W / 130; // v17: player-centered radar (65-unit radius)
            const toMap = (x, z) => [ (x - player.mesh.position.x) * k + W / 2, (z - player.mesh.position.z) * k + W / 2 ];

            ctx.clearRect(0, 0, W, W);
            ctx.save();
            ctx.beginPath();
            ctx.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = '#2a2218';
            ctx.fillRect(0, 0, W, W);
            ctx.strokeStyle = 'rgba(210,180,140,0.25)';
            ctx.lineWidth = 1;
            for (let gi = 1; gi < 4; gi++) {
                const gp = (W * gi) / 4;
                ctx.beginPath(); ctx.moveTo(gp, 0); ctx.lineTo(gp, W); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, gp); ctx.lineTo(W, gp); ctx.stroke();
            }

            const VAR_DOT = { scouter:1, soldierpro:1, heavier:1, picker:1, squsasher:1, deathbringer:1, phantasm:1, gunnier:1, tombraider:1, hammer:1, artillery:1, shieldbearer:1, minelayer:1, commander:1 };
            for (const e of enemies) { // enemies as dots — variants are teal
                if (e.isDead) continue;
                const [mx, mz] = toMap(e.mesh.position.x, e.mesh.position.z);
                const isVar = !!VAR_DOT[e.type];
                if (e.isBoss) {
                    // v1.1: pulsing boss ring + skull glyph
                    const _pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
                    ctx.strokeStyle = `rgba(251,146,60,${0.5 + 0.5 * _pulse})`;
                    ctx.lineWidth = 2 + _pulse * 2;
                    ctx.beginPath(); ctx.arc(mx, mz, 6 + _pulse * 2, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = '#fb923c';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('☠', mx, mz);
                } else {
                    ctx.fillStyle = isVar ? '#22d3ee' : (e === state.targetEnemy ? '#fca5a5' : '#ef4444');
                    ctx.beginPath();
                    ctx.arc(mx, mz, isVar ? 2.7 : (e === state.targetEnemy ? 3 : 2.1), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            if (supplyDrops && supplyDrops.length) {
                for (const d of supplyDrops) {
                    if (!d || !d.group) continue;
                    const [sx, sz] = toMap(d.group.position.x, d.group.position.z);
                    ctx.fillStyle = d.black ? '#c084fc' : '#fbbf24';
                    ctx.fillRect(sx - 3, sz - 3, 6, 6);
                }
            }
            if (fieldMines && fieldMines.length) {
                for (const m of fieldMines) {
                    const [mx, mz] = toMap(m.x, m.z);
                    ctx.fillStyle = '#84cc16';
                    ctx.beginPath(); ctx.arc(mx, mz, 2.2, 0, Math.PI * 2); ctx.fill();
                }
            }

            const [px, pz] = toMap(player.mesh.position.x, player.mesh.position.z); // player arrow
            ctx.save();
            ctx.translate(px, pz);
            ctx.rotate(-player.mesh.rotation.y + Math.PI);
            ctx.fillStyle = '#39ff14';
            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(4.2, 5);
            ctx.lineTo(-4.2, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.restore();
        }

        function showDamageDirection(srcX, srcZ) { // v2 UI: arc pointing toward the shooter
            const arc = document.getElementById('dmg-direction');
            if (!arc || !player) return;
            camera.getWorldDirection(_tv1);
            const camYaw = Math.atan2(_tv1.x, _tv1.z);
            const hitYaw = Math.atan2(srcX - player.mesh.position.x, srcZ - player.mesh.position.z);
            let rel = hitYaw - camYaw;
            const deg = rel * 180 / Math.PI;
            arc.style.transition = 'none';
            arc.style.opacity = '0.9';
            arc.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
            requestAnimationFrame(() => {
                arc.style.transition = 'opacity 0.55s ease';
                arc.style.opacity = '0';
            });
        }

        function addKillFeed(points, name, combo) { // v2 UI: compact kill feed
            const feed = document.getElementById('kill-feed');
            if (!feed) return;
            const entry = document.createElement('div');
            entry.className = 'kill-feed-entry';
            entry.innerHTML = '+' + points + ' ' + name + (combo > 1 ? ' <span class="combo">×' + combo + '</span>' : '');
            feed.appendChild(entry);
            while (feed.children.length > 2) feed.removeChild(feed.firstChild); // v8: tighter
            setTimeout(() => entry.remove(), 1300);
        }

        function updateHUD() {
            const scoreEl = dom('score');
            if (scoreEl) scoreEl.textContent = (state.score || 0).toLocaleString();
            const coinsEl = dom('coins');
            if (coinsEl) coinsEl.textContent = (state.coins || 0).toLocaleString();
            const lvlEl = dom('level');
            if (lvlEl) lvlEl.textContent = state.level;
            
            const _xpCur = Math.floor(state.xp || 0);
            const _xpMax = Math.max(1, state.xpToNext || 1);
            const xpPct = Math.max(0, Math.min(100, Math.round((_xpCur / _xpMax) * 100)));
            const xpBar = dom('xp-bar');
            if (xpBar) xpBar.style.width = xpPct + '%';
            const xpPctEl = document.getElementById('xp-pct');
            if (xpPctEl) xpPctEl.textContent = _xpCur + '/' + _xpMax; // v1.4: numeric xp
            
            dom('stat-speed').textContent = state.playerStats.speed;
            dom('stat-damage').textContent = state.playerStats.damage;
            // Q075: one meter, both hosts. This replaces the separate ⚡ and 💥 pills and
            // the SLOWED label that used to be created and destroyed every frame.
            updatePowerMeter('hud');

            // v1.5: armor shown as current/max shield pool
            const _pauseArmorMax = state.armorMaxHp || state.playerStats.armor || 0;
            const _pauseArmorCur = Math.max(0, Math.floor(state.armorHp || 0));
            if (dom('stat-armor')) dom('stat-armor').textContent = _pauseArmorMax > 0 ? _pauseArmorCur + '/' + _pauseArmorMax : '—';
            dom('stat-regen').textContent = state.playerStats.regen || 0;
            if (dom('stat-crit')) dom('stat-crit').textContent = state.playerStats.crit || 0; // v7
            if (dom('stat-multishot')) dom('stat-multishot').textContent = state.playerStats.multishot || 0;
            if (dom('stat-firerate')) dom('stat-firerate').textContent = state.playerStats.fireRate || 100;
            if (dom('stat-pierce'))   dom('stat-pierce').textContent   = state.playerStats.pierce || 0;
            // Fix5: pause damage cell reflects Overcharge/Blast boost (same as HUD pill)
            const _pauseDmgEl = dom('stat-damage');
            if (_pauseDmgEl) {
                _pauseDmgEl.textContent = _dispDmg; // reuse _dispDmg computed above for HUD pill
                const _pauseDmgCell = _pauseDmgEl.closest ? _pauseDmgEl.closest('.psg-cell') : null;
                if (_pauseDmgCell) _pauseDmgCell.style.borderColor = (_isOverchg || _isBlast)
                    ? '#fbbf24' : 'rgba(255,255,255,0.10)';
            }
            // Fix6: max HP and heal/kill
            if (dom('stat-maxhp'))    dom('stat-maxhp').textContent    = state.playerStats.maxHp || 100;
            if (dom('stat-healkill')) dom('stat-healkill').textContent  = (state.playerStats.healOnKill || 0) > 0
                ? '+' + state.playerStats.healOnKill + ' HP' : '—';
            
            if (player) {
                const _hpCur = Math.max(0, Math.ceil(player.hp));
                const _hpMax = Math.max(1, player.maxHp || 1);
                const hpPct = Math.max(0, Math.min(100, Math.round((_hpCur / _hpMax) * 100)));
                const hpPctEl = document.getElementById('hp-pct');
                if (hpPctEl) hpPctEl.textContent = _hpCur + '/' + _hpMax; // v1.4: numeric hp
                const bar = dom('hp-bar');
                if (bar) {
                    bar.style.width = hpPct + '%';
                    if (hpPct < 30) { bar.style.background = 'linear-gradient(90deg,#dc2626,#f87171)'; }
                    else if (hpPct < 60) { bar.style.background = 'linear-gradient(90deg,#d97706,#fbbf24)'; }
                    else { bar.style.background = 'linear-gradient(90deg,#16a34a,#4ade80)'; }
                }
                const panel = document.getElementById('hp-panel');
                if (panel) panel.classList.toggle('low-hp', hpPct < 25 && hpPct > 0);
                // v1.6: armor — inline tag + bottom strip overlay on the HP bar track
                const _armorMax = state.armorMaxHp || state.playerStats.armor || 0;
                const _armorBar  = document.getElementById('armor-bar');
                const _armorTag  = document.getElementById('armor-tag');
                const _armorPctEl = document.getElementById('armor-pct');
                if (_armorMax > 0) {
                    const _armorCur = Math.max(0, Math.floor(state.armorHp || 0));
                    const _armorPct = Math.round((_armorCur / _armorMax) * 100);
                    if (_armorBar)  {
                        _armorBar.style.display = '';
                        _armorBar.style.width = _armorPct + '%';
                        // Fix 4: pulse animation while armor is regenerating (below max, regen > 0)
                        const _totalRegen = (state.playerStats.regen || 0) + 0.5; // base 0.5/s always
                        const _armorRegenActive = _armorCur > 0 && _armorCur < _armorMax && _totalRegen > 0;
                        _armorBar.style.animation = _armorRegenActive
                            ? 'armorRegen 1.4s ease-in-out infinite' : 'none';
                    }
                    if (_armorTag)  { _armorTag.style.display = ''; }
                    if (_armorPctEl){ _armorPctEl.textContent = _armorCur + '/' + _armorMax; }
                } else {
                    if (_armorBar)  _armorBar.style.display  = 'none';
                    if (_armorTag)  _armorTag.style.display  = 'none';
                }
                const chip = document.querySelector('.level-chip');
                if (chip) chip.classList.toggle('low-hp', !state.reduceFlash && hpPct < 25 && hpPct > 0);
            }
            try { updateCombatTray(); } catch (err) {}
        }

        function updateCombatTray() {
            const comboEl = document.getElementById('hud-combo');
            const c = state.combo || 0;
            if (comboEl) {
                comboEl.textContent = '×' + c;
                comboEl.classList.toggle('hidden', c < 2);
            }
            const row = document.getElementById('buff-row');
            if (!row) return;
            const now = state.runTime || 0;
            const bits = [];
            if (state.shieldUp) bits.push(['SHD', 'buff-shield']);
            else if ((state.playerStats && state.playerStats.shield || 0) > 0 && now >= (state.shieldReadyAt || 0)) bits.push(['RDY', 'buff-ready']);
            if (now < (state.overchargeUntil || 0)) bits.push(['OC', 'buff-oc']);
            if (now < (state.blastUntil || 0)) bits.push(['+20', 'buff-blast']);
            if (now < (state.speedBoostUntil || 0)) bits.push(['HST', 'buff-haste buff-haste-timer']);
            if (state.funKind === 'bounty' && now < (state.funUntil || 0)) bits.push(['$$$', 'buff-bounty']);
            if (state.funKind === 'ambush' && now < (state.funUntil || 0)) bits.push(['AMB', 'buff-bounty']);
            if (state._rootSlow && state._rootSlow < 1) bits.push(['ROOT', 'buff-haste']);
            if (state._traitHot) bits.push(['HEAT', 'buff-blast']);
            if (state._traitReso) bits.push(['RSN', 'buff-oc']);
            const tr = currentBiomeTrait();
            if (tr && bits.every(function (b) { return b[0] !== tr.short; })) bits.push([tr.short, 'buff-ready']);
            const key = bits.map(function (b) { return b[0]; }).join('|');
            if (row.dataset.k !== key) {
                row.dataset.k = key;
                row.innerHTML = bits.map(function (b) { return '<span class="buff-pill ' + b[1] + '">' + b[0] + '</span>'; }).join('');
            }
            // Q011: Adrenaline now lasts a full minute, so the player needs to see how much
            // is left. The row above is cached on the set of active pills to avoid
            // rebuilding innerHTML every frame, so the countdown text is patched onto the
            // existing haste pill instead of being folded into that key.
            if (now < (state.speedBoostUntil || 0)) {
                const hastePill = row.querySelector('.buff-haste-timer');
                if (hastePill) hastePill.textContent = 'HST ' + Math.ceil(state.speedBoostUntil - now) + 's';
            }
        }

        let _fps = 0, _fpsN = 0, _fpsT = 0;
        function diagTick(dt) {
            _fpsN++;
            _fpsT += dt || 0.016;
            if (_fpsT >= 0.45) { _fps = _fpsN / _fpsT; _fpsN = 0; _fpsT = 0; }
            const el = document.getElementById('diag-overlay');
            if (!el) return;
            if (!state.showDiag) { el.classList.add('hidden'); return; }
            el.classList.remove('hidden');
            let chunks = 0;
            try { chunks = envChunks ? envChunks.size : 0; } catch (err) {}
            el.textContent =
                'FPS ' + Math.round(_fps) +
                '\nE ' + (typeof enemies !== 'undefined' ? enemies.length : 0) +
                '  B ' + (typeof bullets !== 'undefined' ? bullets.length : 0) +
                '  P ' + (typeof particles !== 'undefined' ? particles.length : 0) +
                '\nChunks ' + chunks +
                '  phys ' + Math.round(_lastPhysicsCost || 0) + 'ms' +
                '\nLv ' + (state.level || 1) + '  combo ×' + (state.combo || 0);
        }

        function endGame() {
            state.isPlaying = false;
            state.gamePhase = 'gameover';
            bumpDaily('runCoinsBest', state.runCoins || 0); checkAchievements(); // v23
            SFX.engineStop(); SFX.ambientStop(); SFX.musicStop(); // v23+v24
            needsRender = true; // FIX (Tier 3)
            try { saveGame(); } catch(e) {} // FIX (Coins): persist coins between sessions
            try { const modeLabel = document.getElementById('game-over-mode-label'); if(modeLabel) modeLabel.textContent = state._bossRushActive ? '💀 BOSS RUSH' : (state.mode === 'levels' ? '📋 LEVEL MODE' : '🔄 CASUAL'); } catch(e) {}
            document.getElementById('final-score').textContent = state.score;
            document.getElementById('final-level').textContent = state.level;
            // v2: run stats
            document.getElementById('final-kills').textContent = state.kills || 0;
            const m = Math.floor((state.runTime || 0) / 60), s = Math.floor((state.runTime || 0) % 60);
            document.getElementById('final-time').textContent = m + ':' + String(s).padStart(2, '0');
            document.getElementById('final-coins').textContent = state.runCoins || 0;
            try{document.getElementById('final-bosses').textContent=state.runBossKills||0;}catch(e){}
            try{document.getElementById('final-combo').textContent=state.maxRunCombo||0;}catch(e){}
            try{document.getElementById('final-biome').textContent=(typeof BIOMES!=='undefined'&&BIOMES[state.currentBiome])?BIOMES[state.currentBiome].name:'—';}catch(e){}
            try{document.getElementById('final-evos').textContent=(state.evolutions||[]).length;}catch(e){}
            const isCasual = state.mode === 'casual'; // v10: separate bests per mode
            let best = isCasual ? (state.bestCasual || 0) : (state.bestLevels || 0);
            const isBest = state.score > best;
            if (isCasual) {
                if (isBest) state.bestCasual = state.score;
                // v26.8: if this run was loaded from a named save and never saved, keep that slot up to date
                let deathSaveNote = '';
                if (state.activeSaveName && !state.savedThisRun) {
                    const snap = snapshotRun();
                    if (snap) {
                        snap.hp = Math.max(1, Math.ceil((state.playerStats.maxHp || 100) * 0.55));
                        const i = (state.casualSaves || []).findIndex(s => s.name === state.activeSaveName);
                        if (i >= 0) {
                            state.casualSaves[i] = { ...snap, name: state.activeSaveName, savedAt: Date.now() };
                            deathSaveNote = '💾 Save “' + state.activeSaveName + '” was updated';
                            try { saveGame(); } catch (err) {}
                        }
                    }
                }
                state.autoSave = null;
                const noteEl = document.getElementById('death-save-note');
                if (noteEl) { noteEl.textContent = deathSaveNote; noteEl.classList.toggle('hidden', !deathSaveNote); }
            } else if (isBest) state.bestLevels = state.score;
            try { saveGame(); } catch (e) {}
            best = state.score > best ? state.score : best;
            document.getElementById('final-best').textContent = best;
            document.getElementById('new-best-badge').classList.toggle('hidden', !isBest);
            try { renderBuildList(); } catch (e) {}
            document.getElementById('game-over-screen').classList.remove('hidden');
            // Re-evaluate Boss Rush unlock after each run
            try {
                const _brBtn = document.getElementById('btn-bossrush');
                const _ls = lifeStats ? lifeStats() : {};
                const _brUnlocked2 = ((_ls.bossKills || 0) >= 5) || ((_ls.maxLevel || 0) >= 5) || ((state.bossKills || 0) >= 5);
                if (_brBtn) {
                    _brBtn.style.opacity = _brUnlocked2 ? '1' : '0.42';
                    _brBtn.style.pointerEvents = _brUnlocked2 ? '' : 'none';
                    const _ico2 = _brBtn.querySelector('.hb-ico'); if (_ico2) _ico2.textContent = _brUnlocked2 ? '💀' : '🔒';
                    const _sub2 = _brBtn.querySelector('#bossrush-sub'); if (_sub2) _sub2.textContent = _brUnlocked2 ? 'All 6 bosses. No mercy.' : 'Kill 5 bosses to unlock';
                }
            } catch(e) {}
            const cBtn = document.getElementById('btn-continue-run');
            const cCost = continueCost();
            if (cBtn) {
                const el = document.getElementById('continue-cost');
                if (el) el.textContent = cCost.toLocaleString();
                cBtn.disabled = (state.coins || 0) < cCost;
                cBtn.style.opacity = cBtn.disabled ? '0.45' : '1';
            }
            
            state.input = { x: 0, y: 0, isFiring: false };
            document.getElementById('joystick-base').style.display = 'none';
            syncHUDControls();
        }

        function continueCost() {
            return Math.round(300 * Math.pow(4, state.continuesThisRun || 0));
        }
        function buyContinue() { // v27: pay coins on the death screen to keep THIS run
            if (state.gamePhase !== 'gameover' || !state.playerStats) return;
            const cost = continueCost();
            if ((state.coins || 0) < cost) {
                showUpgradeNotification('Not enough coins');
                return;
            }
            state.coins -= cost;
            state.continuesThisRun = (state.continuesThisRun || 0) + 1;
            try { applyMetaDelta(state.playerStats, state.meta || {}, state.metaAtRunStart || {}); } catch (e) {}
            state.metaAtRunStart = Object.assign({}, state.meta || {});
            // Fix 3 (v1.9): arch delta is already baked into playerStats from startGame.
            // Do NOT re-add it on revive — that caused stacking bugs (double/triple arch bonuses).
            // playerStats is preserved through death; revive just rebuilds the Tank mesh + restores HP.
            try {
                const _rvSkinId = skinState().selected;
                const _rvSkin   = SKINS.find(s => s.id === _rvSkinId);
                if (_rvSkin && _rvSkin.arch && _rvSkin.arch.crit) {
                    // Only re-apply crit if it's missing (Void Walker crit fix)
                    if (!state.playerStats.crit) state.playerStats.crit = _rvSkin.arch.crit;
                }
            } catch(e) {}
            try { saveGame(); } catch (e) {}
            const x = state.continueX || 0, z = state.continueZ || 0;
            if (player) {
                try { scene.remove(player.mesh); disposeObject3D(player.mesh); } catch (e) {}
            }
            player = new Tank(selectedSkinColor(), true);
            const sRingGeo = new THREE.RingGeometry(3.1, 3.4, 40);
            const sRingMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            player.shieldRing = new THREE.Mesh(sRingGeo, sRingMat);
            player.shieldRing.rotation.x = -Math.PI / 2;
            player.shieldRing.position.y = 1.2;
            player.shieldRing.visible = false;
            player.mesh.add(player.shieldRing);
            player.maxHp = state.playerStats.maxHp;
            player.hp = Math.ceil(player.maxHp * 0.5);
            // v1.5 + Fix2: restore armor pool using updated stats (now includes archetype)
            // Q016: revive rebuilds the pool from the derived max, full
            recalcArmorPool(false);
            state.armorHp = state.armorMaxHp;
            try { syncPlayerTankParts(); } catch (e) {}
            player.mesh.position.set(x, 0, z);
            state.invulnUntil = (state.runTime || 0) + 3;
            state.shieldUp = false;

            // Q073 / D-08: actually run the revive safety kit. Both helpers existed but had
            // zero call sites, so the "3s safe" toast was a promise the code never kept and
            // spawnBlocked() was permanently false. applyReviveSafety() clears in-flight
            // bullets/missiles and blocks new spawns for 3s; hushHostileFire() stops
            // existing enemies — including bosses — from firing for 5s, so a revived player
            // is not deleted by the volley that was already in the air.
            try { applyReviveSafety(); } catch (e) {}
            try { hushHostileFire(5); } catch (e) {}

            state.isPlaying = true;
            state.gamePhase = 'playing';
            setScreenVisibility('game-over-screen', false);
            setPauseUIVisible(true);
            SFX.revive(); SFX.engineStart(); SFX.musicStart();
            showUpgradeNotification('✨ Revived — 50% HP, 3s no spawns, 5s enemy fire hushed');
            updateHUD();
            needsRender = true;
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            needsRender = true; // FIX (Tier 3)
        }

        // ============================================================
        // Q075 / Q129 — the single 3-lane power meter (SPD / DMG / ARM)
        //
        // Yt03's 3-lane layout is the frame because it is the only one of the three with
        // an armor lane. Yt01 contributes the BOOST / SLOWED status labels and the
        // cap-aware speed number; Yt02 contributes the countdown on the damage lane.
        //
        // ONE component, two hosts (#hud-power-meter and #pause-power-meter) — the
        // decision is explicit about killing duplicate meters. Every value here is read
        // through the same helpers the physics and combat code use, so the meter cannot
        // display a number the simulation does not apply.
        // ============================================================
        const _pmLast = {};   // per-host refresh timestamps

        function powerMeterHTML(prefix) {
            const lane = (id, icon, label, cls) =>
                '<div class="pm-lane' + (cls ? ' ' + cls : '') + '" id="' + prefix + '-pm-' + id + '">'
              +   '<div class="pm-head">'
              +     '<span class="pm-label">' + icon + ' ' + label + '</span>'
              +     '<span class="pm-state" id="' + prefix + '-pm-' + id + '-state"></span>'
              +     '<span class="pm-num" id="' + prefix + '-pm-' + id + '-num">—</span>'
              +   '</div>'
              +   '<div class="pm-track"><div class="pm-fill" id="' + prefix + '-pm-' + id + '-fill"></div></div>'
              + '</div>';
            return '<div class="power-meter">'
                 + lane('spd', '⚡', 'SPD')
                 + lane('dmg', '💥', 'DMG')
                 + lane('arm', '🛡️', 'ARM', 'pm-arm')
                 + '</div>';
        }

        function buildPowerMeter(hostId, prefix) {
            const host = document.getElementById(hostId);
            if (!host) return false;
            host.innerHTML = powerMeterHTML(prefix);
            return true;
        }

        // Read one lane's three elements, tolerating a host that has not been built yet.
        function _pm(prefix, id) {
            return {
                lane:  document.getElementById(prefix + '-pm-' + id),
                state: document.getElementById(prefix + '-pm-' + id + '-state'),
                num:   document.getElementById(prefix + '-pm-' + id + '-num'),
                fill:  document.getElementById(prefix + '-pm-' + id + '-fill')
            };
        }

        // force=true bypasses the 0.15s throttle — used when the pause screen opens, so the
        // embedded lane is never a stale copy of the last HUD frame.
        function updatePowerMeter(prefix, force) {
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (!force && _pmLast[prefix] !== undefined && (now - _pmLast[prefix]) < 150) return false;
            _pmLast[prefix] = now;

            const ps = state.playerStats || {};

            // ---- SPD lane -------------------------------------------------
            const baseSpd  = ps.speed || 100;
            const rootMult = (state._rootSlow || 1) < 1 ? state._rootSlow : 1;
            const isSlowed = rootMult < 1;
            const isHasted = (state.runTime || 0) < (state.speedBoostUntil || 0);
            // Cap-aware: the displayed multiplier is clamped to the same ceiling the
            // movement code enforces (Q010), so a stacked build cannot read 400%.
            const capMult = (typeof CONFIG !== 'undefined' && CONFIG.playerSpeedMaxMult)
                          ? CONFIG.playerSpeedMaxMult : 2.6;
            let spdMult = 1;
            if (isHasted)      spdMult = adrenalineSpeedMult();
            else if (isSlowed) spdMult = rootMult;
            spdMult = Math.min(capMult, spdMult);
            const spd = _pm(prefix, 'spd');
            if (spd.num)   spd.num.textContent = Math.round(spdMult * 100) + '%';
            if (spd.fill)  spd.fill.style.width = Math.max(0, Math.min(100, (spdMult / capMult) * 100)) + '%';
            if (spd.state) {
                spd.state.textContent = isHasted ? '▲ BOOST' : (isSlowed ? '▼ SLOWED' : '');
                spd.state.className = 'pm-state ' + (isHasted ? 'pm-up' : (isSlowed ? 'pm-down' : ''));
            }
            if (spd.lane)  spd.lane.className = 'pm-lane' + (isHasted ? ' pm-boost' : (isSlowed ? ' pm-slow' : ''));

            // ---- DMG lane -------------------------------------------------
            const baseDmg    = ps.damage || 100;
            const isOverchg  = (state.runTime || 0) < (state.overchargeUntil || 0);
            const isBlast    = (state.runTime || 0) < (state.blastUntil || 0);
            let dmgMult = 1;
            if (isOverchg) dmgMult *= 1.3;
            if (isBlast)   dmgMult *= 1.2;
            // Yt02's countdown lives on this lane: seconds remaining on Overcharge.
            const oSecs = isOverchg ? Math.ceil((state.overchargeUntil || 0) - (state.runTime || 0)) : 0;
            const dmg = _pm(prefix, 'dmg');
            if (dmg.num)   dmg.num.textContent = Math.round(dmgMult * 100) + '%' + (isOverchg ? ' ⏱' + oSecs + 's' : (isBlast ? ' ⚡' : ''));
            if (dmg.fill)  dmg.fill.style.width = Math.max(0, Math.min(100, ((dmgMult - 1) / 0.56) * 100)) + '%';
            if (dmg.state) {
                dmg.state.textContent = (isOverchg || isBlast) ? '▲ BOOST' : '';
                dmg.state.className = 'pm-state' + ((isOverchg || isBlast) ? ' pm-up' : '');
            }
            if (dmg.lane)  dmg.lane.className = 'pm-lane' + ((isOverchg || isBlast) ? ' pm-boost' : '');

            // ---- ARM lane (the reason Yt03's layout won) ------------------
            const armMax = state.armorMaxHp || ps.armor || 0;
            const armCur = Math.max(0, Math.floor(state.armorHp || 0));
            const arm = _pm(prefix, 'arm');
            if (arm.num)   arm.num.textContent = armMax > 0 ? (armCur + '/' + Math.floor(armMax)) : '—';
            if (arm.fill)  arm.fill.style.width = armMax > 0
                             ? Math.max(0, Math.min(100, (armCur / armMax) * 100)) + '%' : '0%';
            if (arm.state) { arm.state.textContent = ''; arm.state.className = 'pm-state'; }
            return true;
        }
