        class Tank {
            constructor(color, isPlayer = false, type = 'soldier') {
                this.mesh = new THREE.Group();
                this.isPlayer = isPlayer;
                this.type = type;
                this.typeData = isPlayer ? null : ENEMY_TYPES[type];
                
                const scale = isPlayer ? 1 : (this.typeData?.size || 1);
                
                this.hp = isPlayer ? state.playerStats.maxHp : (this.typeData?.hp || 50);
                this.maxHp = this.hp;
                this.isDead = false;
                this.lastHealTime = 0;
                
                // Physics-based animation properties
                this.velocity = new THREE.Vector3();
                this.acceleration = new THREE.Vector3();
                this.targetTilt = new THREE.Vector2(0, 0);
                this.currentTilt = new THREE.Vector2(0, 0);
                this.bobPhase = Math.random() * Math.PI * 2;

                const mainColor = new THREE.Color(color);
                const darkColor = mainColor.clone().multiplyScalar(0.6);

                const bodyMat = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.4,
                    metalness: 0.6
                });

                // Hull base
                const hullGeo = new THREE.BoxGeometry(2.6 * scale, 0.9 * scale, 3.8 * scale);
                const hull = new THREE.Mesh(hullGeo, bodyMat);
                hull.position.y = 0.65 * scale;
                hull.castShadow = true;
                hull.receiveShadow = true;
                this.mesh.add(hull);

                // Hull top plate
                const topPlateGeo = new THREE.BoxGeometry(2.2 * scale, 0.35 * scale, 3.2 * scale);
                const topPlate = new THREE.Mesh(topPlateGeo, bodyMat);
                topPlate.position.y = 1.25 * scale;
                topPlate.castShadow = true;
                this.mesh.add(topPlate);

                // Front armor slope
                const frontArmorGeo = new THREE.BoxGeometry(2.4 * scale, 0.6 * scale, 0.8 * scale);
                const frontArmor = new THREE.Mesh(frontArmorGeo, bodyMat);
                frontArmor.position.set(0, 0.85 * scale, 1.85 * scale);
                frontArmor.rotation.x = -0.35;
                frontArmor.castShadow = true;
                this.mesh.add(frontArmor);

                // Tracks with detail
                const trackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.3 });
                
                [-1, 1].forEach(side => {
                    const trackGeo = new THREE.BoxGeometry(0.65 * scale, 0.95 * scale, 4.3 * scale);
                    const track = new THREE.Mesh(trackGeo, trackMat);
                    track.position.set(side * 1.55 * scale, 0.5 * scale, 0);
                    track.castShadow = true;
                    this.mesh.add(track);

                    const guardGeo = new THREE.BoxGeometry(0.75 * scale, 0.18 * scale, 4.5 * scale);
                    const guardMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.5, metalness: 0.5 });
                    const guard = new THREE.Mesh(guardGeo, guardMat);
                    guard.position.set(side * 1.55 * scale, 1.0 * scale, 0);
                    guard.castShadow = true;
                    this.mesh.add(guard);

                    const wheelGeo = new THREE.CylinderGeometry(0.38 * scale, 0.38 * scale, 0.28 * scale, 16);
                    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.4 });
                    
                    for (let i = -1.5; i <= 1.5; i += 0.75) {
                        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                        wheel.rotation.z = Math.PI / 2;
                        wheel.position.set(side * 1.25 * scale, 0.38 * scale, i * scale);
                        wheel.castShadow = true;
                        this.mesh.add(wheel);
                    }
                });

                // Turret pivot
                this.turretPivot = new THREE.Group();
                this.turretPivot.position.y = 1.4 * scale;
                this.mesh.add(this.turretPivot);

                // Turret base ring
                const turretBaseGeo = new THREE.CylinderGeometry(0.95 * scale, 1.05 * scale, 0.45 * scale, 16);
                const turretBase = new THREE.Mesh(turretBaseGeo, bodyMat);
                turretBase.position.y = 0.22 * scale;
                turretBase.castShadow = true;
                this.turretPivot.add(turretBase);

                // Turret body
                const turretGeo = new THREE.BoxGeometry(1.5 * scale, 0.75 * scale, 2.1 * scale);
                const turret = new THREE.Mesh(turretGeo, bodyMat);
                turret.position.set(0, 0.6 * scale, 0.2 * scale);
                turret.castShadow = true;
                this.turretPivot.add(turret);

                // Mantlet
                const mantletGeo = new THREE.CylinderGeometry(0.38 * scale, 0.42 * scale, 0.55 * scale, 12);
                const mantletMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.7 });
                const mantlet = new THREE.Mesh(mantletGeo, mantletMat);
                mantlet.rotation.x = Math.PI / 2;
                mantlet.position.set(0, 0.55 * scale, 1.25 * scale);
                mantlet.castShadow = true;
                this.turretPivot.add(mantlet);

                // Barrel
                const barrelLength = (type === 'sniper' || type === 'picker' || type === 'artillery') ? 4.8 : 3.4;
                const barrelGeo = new THREE.CylinderGeometry(0.13 * scale, 0.16 * scale, barrelLength * scale, 12);
                const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });
                this.barrel = new THREE.Mesh(barrelGeo, barrelMat);
                this.barrel.rotation.x = Math.PI / 2;
                this.barrel.position.set(0, 0.55 * scale, 1.25 * scale + barrelLength * scale / 2);
                this.barrel.castShadow = true;
                this.turretPivot.add(this.barrel);

                // Muzzle brake
                const muzzleGeo = new THREE.CylinderGeometry(0.2 * scale, 0.15 * scale, 0.35 * scale, 8);
                const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
                muzzle.rotation.x = Math.PI / 2;
                muzzle.position.set(0, 0.55 * scale, 1.25 * scale + barrelLength * scale + 0.18 * scale);
                this.turretPivot.add(muzzle);
                this.muzzlePos = muzzle.position.clone();

                // Commander hatch
                const hatchGeo = new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.18 * scale, 12);
                const hatch = new THREE.Mesh(hatchGeo, new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.4, metalness: 0.6 }));
                hatch.position.set(0, 1.0 * scale, -0.35 * scale);
                hatch.castShadow = true;
                this.turretPivot.add(hatch);

                // Antenna
                if (isPlayer || type === 'sniper') {
                    const antennaGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 1.5 * scale, 6);
                    const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
                    antenna.position.set(-0.5 * scale, 1.3 * scale, -0.6 * scale);
                    antenna.rotation.z = 0.15;
                    this.turretPivot.add(antenna);
                }

                // Player indicator ring
                if (isPlayer) {
                    const ringGeo = new THREE.RingGeometry(2.5, 2.8, 32);
                    const ringMat = new THREE.MeshBasicMaterial({
                        color: 0xfde047, // v3: amber ring matches the new tank identity
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide
                    });
                    this.indicator = new THREE.Mesh(ringGeo, ringMat);
                    this.indicator.rotation.x = -Math.PI / 2;
                    this.indicator.position.y = 0.1;
                    this.mesh.add(this.indicator);
                }

                // Healer cross
                if (type === 'healer') {
                    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.25), crossMat);
                    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.8), crossMat);
                    cross1.position.y = 2.5 * scale;
                    cross2.position.y = 2.5 * scale;
                    this.mesh.add(cross1, cross2);
                }
                if (type === 'shieldbearer') {
                    const plate = new THREE.Mesh(
                        new THREE.BoxGeometry(2.1 * scale, 1.15 * scale, 0.22 * scale),
                        new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.75, roughness: 0.32, emissive: 0x1d4ed8, emissiveIntensity: 0.25 })
                    );
                    plate.position.set(0, 1.05 * scale, 2.05 * scale);
                    this.mesh.add(plate);
                }
                if (type === 'minelayer') {
                    const hop = new THREE.Mesh(
                        new THREE.BoxGeometry(0.9 * scale, 0.45 * scale, 0.7 * scale),
                        new THREE.MeshStandardMaterial({ color: 0x4d7c0f, metalness: 0.4, roughness: 0.55 })
                    );
                    hop.position.set(0, 1.35 * scale, -1.5 * scale);
                    this.mesh.add(hop);
                }
                if (type === 'commander') {
                    const flag = new THREE.Mesh(
                        new THREE.BoxGeometry(0.08 * scale, 1.1 * scale, 0.35 * scale),
                        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.35, emissive: 0xca8a04, emissiveIntensity: 0.35 })
                    );
                    flag.position.set(-0.45 * scale, 2.15 * scale, -0.2 * scale);
                    this.turretPivot.add(flag);
                }
                if (type === 'artillery') {
                    const brace = new THREE.Mesh(
                        new THREE.BoxGeometry(0.55 * scale, 0.28 * scale, 0.7 * scale),
                        new THREE.MeshStandardMaterial({ color: 0x7c2d12, metalness: 0.55, roughness: 0.4 })
                    );
                    brace.position.set(0, 0.35 * scale, 0.4 * scale);
                    this.turretPivot.add(brace);
                }

                scene.add(this.mesh);

                // v26.5: canvas sprite — name + real HP fill (planes were drawing the fill behind the track)
                this.hpBar = null;
                this._hpCanvas = null;
                this._hpTex = null;
                const bossTypes = { warlord:1, colossus:1, nova:1, titan:1, tempest:1, fortress:1 };
                if (!isPlayer && !bossTypes[type]) {
                    const canvas = document.createElement('canvas');
                    canvas.width = 384;
                    canvas.height = 96;
                    const tex = new THREE.CanvasTexture(canvas);
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    const mat = new THREE.SpriteMaterial({
                        map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 1
                    });
                    const spr = new THREE.Sprite(mat);
                    const s = Math.max(1, scale);
                    spr.scale.set(4.8 * s, 1.55 * s, 1);
                    spr.renderOrder = 20;
                    this.hpBar = spr;
                    this._hpCanvas = canvas;
                    this._hpTex = tex;
                    this._hpName = (this.typeData && this.typeData.name) || type;
                    this._hpBarLift = 3.4 * scale + 1.2;
                    scene.add(spr);
                    this.updateHpBar();
                }
            }

            move(dt, inputVec) {
                if (this.isDead) return;

                // FIX (Tier 3): all scratch vectors are reused — no per-frame allocations
                const prevVel = _moveV1.copy(this.velocity);
                
                if (inputVec.length() > 0.1) {
                    let speed = CONFIG.playerSpeed;
                    if (this.isPlayer) {
                        speed *= state.playerStats.speed / 100;
                        if ((state._rootSlow || 1) < 1) speed *= state._rootSlow;
                        // Q011: one source of truth, shared with the HUD speed meter
                        speed *= adrenalineSpeedMult();
                    } else {
                        speed *= (this.typeData?.speed || 1) * 0.55 * (this.speedMult || 1); // v26: level scaling
                    }

                    const move = _moveV2.set(inputVec.x, 0, inputVec.y).normalize().multiplyScalar(speed * dt);
                    this.velocity.lerp(move, 1 - Math.pow(0.85, dt * 60)); // FIX (Tier 4): same as 0.15/frame at 60fps
                    
                    const nextPos = _moveV3.copy(this.mesh.position).add(this.velocity);
                    // v17: no boundaries — roam forever
                    this.mesh.position.copy(nextPos);

                    // Smooth rotation
                    const targetRotation = Math.atan2(move.x, move.z);
                    let diff = targetRotation - this.mesh.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    this.mesh.rotation.y += diff * 8 * dt;
                    
                    // Calculate tilt based on turning
                    this.targetTilt.x = -diff * 0.3; // Roll when turning
                    this.targetTilt.y = this.velocity.length() * 0.02; // Pitch when accelerating
                } else {
                    this.velocity.multiplyScalar(Math.pow(0.9, dt * 60)); // FIX (Tier 4): same as 0.9/frame at 60fps
                    this.targetTilt.set(0, 0);
                }
                
                // Apply acceleration-based tilt
                this.acceleration.subVectors(this.velocity, prevVel);
                this.targetTilt.y += this.acceleration.z * 2;
                this.targetTilt.x += this.acceleration.x * 2;

                // Terrain following — v26.6: sit on the surface; extra lift when tilted so hulls don't clip hills
                const terrainY = getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
                const tiltDip = (Math.abs(this.currentTilt.x) + Math.abs(this.currentTilt.y)) * 0.45;
                this.mesh.position.y = terrainY + 0.32 + tiltDip;

                // v2 visuals: dust kick-up behind a moving tank (throttled, cheap)
                if (this.isPlayer && state.quality !== 'low' && this.velocity.length() > 8 && Math.random() < 0.12) { // v25
                    const back = _moveV2.set(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y)).multiplyScalar(2.2);
                    const dustMat = new THREE.MeshBasicMaterial({ color: 0x9a8a70, transparent: true, opacity: 0.35 });
                    const dust = new THREE.Mesh(SHARED_GEO.sphere1, dustMat);
                    dust.scale.setScalar(0.35 + Math.random() * 0.3);
                    dust.position.set(this.mesh.position.x + back.x, terrainY + 0.3, this.mesh.position.z + back.z);
                    particles.push({
                        mesh: dust,
                        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.1 + Math.random(), (Math.random() - 0.5) * 1.5),
                        life: 0.55,
                        isSmoke: true,
                        expansionRate: 2.2
                    });
                    scene.add(dust);
                }
                
                // Apply terrain normal for realistic tilt
                const normal = getTerrainNormal(this.mesh.position.x, this.mesh.position.z, _terrainN); // FIX (Tier 3)
                this.targetTilt.x += Math.atan2(normal.x, normal.y) * 0.5;
                this.targetTilt.y += Math.atan2(normal.z, normal.y) * 0.5;
                
                // Smooth tilt animation
                this.currentTilt.lerp(this.targetTilt, 1 - Math.pow(0.9, dt * 60)); // FIX (Tier 4)
                
                // Apply tilt to tank (but not full rotation)
                const tiltGroup = this.mesh.children[0]; // Hull
                if (tiltGroup) {
                    // We apply slight visual tilt to simulate suspension
                    this.mesh.rotation.x = this.currentTilt.y * 0.14;
                    this.mesh.rotation.z = this.currentTilt.x * 0.14;
                }
            }

            aimAt(targetPos, dt = 1/60) {
                if (this.isDead) return;
                const worldPos = _aimV1; // FIX (Tier 3): scratch vectors
                this.turretPivot.getWorldPosition(worldPos);
                const direction = _aimV2.set(targetPos.x - worldPos.x, 0, targetPos.z - worldPos.z);
                const targetAngle = Math.atan2(direction.x, direction.z);
                const currentAngle = this.turretPivot.rotation.y + this.mesh.rotation.y;
                
                let diff = targetAngle - currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                
                // FIX (Tier 4): frame-rate independent smoothing — identical to the old
                // per-frame factor at 60 fps (1-(1-k)^1 = k), consistent at any fps.
                const k = state.controlAssist ? 0.25 : 0.14; // Assist toggle
                this.turretPivot.rotation.y += diff * (1 - Math.pow(1 - k, dt * 60));
            }

            takeDamage(amount, opts) {
                // v4: brief invulnerability window (after Second Wind)
                if (this.isPlayer && (state.runTime || 0) < (state.invulnUntil || 0)) return;
                if (this.isPlayer && state.shieldUp) { // v24: Shield Generator absorbs a hit
                    state.shieldUp = false;
                    state.shieldReadyAt = (state.runTime || 0) + 18 / (state.playerStats.shield || 1);
                    try{if(state.hapticsEnabled!==false&&navigator&&navigator.vibrate)navigator.vibrate([28,35,45]);}catch(_hv){}
                    SFX.heal();
                    showUpgradeNotification('🛡️ Shield absorbed the hit!');
                    if (state.playerStats.evo_bastion) {
                        state.bastionSoakUntil = (state.runTime || 0) + 2.8;
                        state.shieldReadyAt = (state.runTime || 0) + (18 / (state.playerStats.shield || 1)) * 0.8;
                    }
                    if (player.shieldRing) player.shieldRing.visible = false;
                    try {
                        const p = this.mesh.position;
                        fxRingAt(p.x, p.z, 0x60a5fa, 1.2, 6.5, 0.45, false);
                        fxSparks(p.x, p.y + 1.2, p.z, 0x93c5fd, 8);
                    } catch (err) {}
                    return;
                }
                if (this.isPlayer && (state.runTime || 0) < (state.bastionSoakUntil || 0)) {
                    amount *= 0.75;
                    state.bastionSoakUntil = 0;
                    try { fxSparks(this.mesh.position.x, this.mesh.position.y + 1.2, this.mesh.position.z, 0x93c5fd, 6); } catch (e) {}
                }
                let incoming = amount;
                // v1.5: Armor is a full shield pool — absorbs ALL damage before HP is touched
                if (this.isPlayer) {
                    const armorPool = state.armorHp || 0;
                    if (armorPool > 0) {
                        const absorbed = Math.min(armorPool, incoming);
                        state.armorHp = Math.max(0, armorPool - incoming);
                        incoming -= absorbed;
                        // Visual: orange sparks for armor hit
                        try {
                            const p = this.mesh.position;
                            fxSparks(p.x, p.y + 1.3, p.z, 0xff8a3d, 7);
                            if (armorPool > 0 && state.armorHp === 0) {
                                // Armor just broke — red ring burst
                                fxRingAt(p.x, p.z, 0xef4444, 0.6, 3.5, 0.35, true);
                                showUpgradeNotification('🛡 Armor depleted!');
                            }
                        } catch (err) {}
                    }
                } else {
                    incoming = incoming - (this.armorFlat || 0);
                }
                // Q128: no hidden minimum-damage floor on the player. Previously any hit
                // that armour only PARTLY soaked was silently rounded up to a full point,
                // which quietly buffed swarm enemies and contradicted the shield's own card
                // text. A soaked hit now costs exactly what survives. Enemy tanks keep a
                // 1-point minimum so chip damage always makes progress against them.
                const actualDamage = this.isPlayer ? incoming : Math.max(1, incoming);
                if (this.isPlayer && (opts && opts.silent)) {
                    try { fxRingAt(this.mesh.position.x, this.mesh.position.z, 0xef4444, 0.8, 2.4, 0.22, true); } catch (err) {}
                }
                if (this.isBoss) state._hitStop = Math.max(state._hitStop || 0, 0.04);
                if (this.isPlayer && !(opts && opts.silent)) { SFX.hurt(); SFX.vibrate(35); }
                this.hp -= actualDamage;
                this.updateHpBar();
                if (this.isBoss) try { updateBossBar(); } catch (err) {}

                this.mesh.traverse(c => {
                    if (c.isMesh && c.material.emissive) {
                        c.material.emissive.setHex(0xff8833); // v2 visuals: warm hit flash
                        setTimeout(() => {
                            if (c.material) c.material.emissive.setHex(0x000000);
                        }, 80);
                    }
                });

                if (this.hp <= 0 && !this.isDead) {
                    if (this.isPlayer && state.reviveAvailable) { // v4+v10: Second Wind
                        SFX.revive(); SFX.vibrate([40, 60, 40]); // v23
                        state.reviveAvailable = false;
                        const swFrac = 0.5 + 0.25 * (((state.meta || {}).revive || 1) - 1);
                        this.hp = Math.ceil(this.maxHp * swFrac);
                        state.invulnUntil = (state.runTime || 0) + 2;
                        createHealEffect(this.mesh.position);
                        showUpgradeNotification('✨ SECOND WIND — revived at ' + Math.round(swFrac * 100) + '% HP');
                        updateHUD();
                    } else {
                        this.die();
                    }
                }
            }

            heal(amount) {
                this.hp = Math.min(this.maxHp, this.hp + amount);
                this.updateHpBar();
                createHealEffect(this.mesh.position);
                SFX.heal(); // v23
            }

            updateHpBar() {
                if (!this._hpCanvas || !this._hpTex) return;
                const canvas = this._hpCanvas;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                const w = canvas.width, h = canvas.height;
                ctx.clearRect(0, 0, w, h);
                const frac = Math.max(0, Math.min(1, this.hp / (this.maxHp || 1)));
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const name = this._hpName || 'Tank';
                ctx.fillStyle = 'rgba(0,0,0,0.72)';
                ctx.fillRect(16, 6, w - 32, 44);
                ctx.strokeStyle = 'rgba(255,214,80,0.85)';
                ctx.lineWidth = 2;
                ctx.strokeRect(16, 6, w - 32, 44);
                ctx.font = '800 34px system-ui, sans-serif';
                ctx.lineWidth = 6;
                ctx.strokeStyle = 'rgba(0,0,0,0.95)';
                ctx.strokeText(name, w / 2, 28);
                ctx.fillStyle = '#ffe566';
                ctx.fillText(name, w / 2, 28);
                const bx = 22, by = 58, bw = w - 44, bh = 22;
                ctx.fillStyle = 'rgba(0,0,0,0.78)';
                ctx.fillRect(bx, by, bw, bh);
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(bx, by, bw, 2);
                const col = frac < 0.3 ? '#ef4444' : frac < 0.6 ? '#facc15' : '#4ade80';
                ctx.fillStyle = col;
                ctx.fillRect(bx + 2, by + 2, Math.max(0, (bw - 4) * frac), bh - 4);
                this._hpTex.needsUpdate = true;
            }

            die() {
                this.isDead = true;
                try { fxClearEnemy(this); } catch (err) {}
                stripEnemyBar(this);
                if (this.isBoss && state.bossActive === this) {
                    state.bossActive = null;
                    state.bossCooldownUntil = (state.runTime || 0) + 12;
                    try { updateBossBar(); } catch (err) {}
                }
                if (this.isPlayer) {
                    state.continueX = this.mesh.position.x;
                    state.continueZ = this.mesh.position.z;
                    SFX.engineStop();
                }
                createExplosion(this.mesh.position, this.isPlayer ? 10 : 4, 0xff6600, 'spark');
                scene.remove(this.mesh);
                disposeObject3D(this.mesh); // FIX (Tier 2): free ~20 geometries + materials per tank
            }

            update(dt) {
                // Bob animation
                this.bobPhase += dt * 2;
                
                if (this.indicator) {
                    this.indicator.rotation.z += dt * 0.4;
                    this.indicator.material.opacity = 0.5 + Math.sin(clock.getElapsedTime() * 2) * 0.2;
                }
            }
        }

        // ============================================
        // ENHANCED PROJECTILES - Glowing Plasma Bolts
        // ============================================
        function spawnBullet(source, dir, damage, siegeShot) { // v6(C): one bullet along dir — shared by the player and boss attack patterns
            const shot = source.isPlayer ? null : enemyShotProfile(source);
            const bulletColor = source.isPlayer ? 0x00ffff : shot.color;

            const bulletGroup = new THREE.Group();
            // FIX (Tier 2): bullet geometries/materials are cached & shared (no per-shot leak)
            const res = getBulletResources(bulletColor);
            const core = new THREE.Mesh(SHARED_GEO.bulletCore, res.core);
            bulletGroup.add(core);
            const innerGlow = new THREE.Mesh(SHARED_GEO.bulletInner, res.inner);
            bulletGroup.add(innerGlow);
            const outerGlow = new THREE.Mesh(SHARED_GEO.bulletOuter, res.outer);
            bulletGroup.add(outerGlow);
            const trail = new THREE.Mesh(SHARED_GEO.bulletTrail, res.trail);
            trail.rotation.x = Math.PI / 2;
            trail.position.z = -1.35;
            bulletGroup.add(trail);

            const muzzleWorld = new THREE.Vector3();
            source.barrel.getWorldPosition(muzzleWorld);
            bulletGroup.position.copy(muzzleWorld);

            const d = dir.clone();
            if (!source.isPlayer && player && !player.isDead) {
                const tx = player.mesh.position.x - bulletGroup.position.x;
                const ty = (player.mesh.position.y + 1.2) - bulletGroup.position.y;
                const tz = player.mesh.position.z - bulletGroup.position.z;
                const dist = Math.hypot(tx, ty, tz) || 1;
                const patterned = source.type === 'nova' || source.type === 'fortress';
                if (!patterned) d.set(tx, ty, tz);
                else d.y += ty / Math.max(14, dist);
            }
            d.normalize();
            const speed = source.isPlayer ? CONFIG.bulletSpeed : Math.min(58, shot.speed);
            const life = source.isPlayer ? 1.2 : Math.max(1.25, shot.life);
            const home = source.isPlayer ? 0 : Math.min(0.26, enemyHomeRate(source));
            const style = source.isPlayer ? 'bolt' : shot.style;
            if (source.isPlayer && (state.playerStats.pierce || 0) > 0 && trail.material) {
                try { trail.material = trail.material.clone(); trail.material.color.setHex(0x22d3ee); } catch (err) {}
            }
            if (source.isPlayer && siegeShot) bulletGroup.scale.setScalar(1.55);
            if (!source.isPlayer) {
                if (style === 'slug') bulletGroup.scale.setScalar(1.85);
                else if (style === 'orb') bulletGroup.scale.setScalar(1.75);
                else if (style === 'spark') bulletGroup.scale.setScalar(1.25);
                else if (style === 'lance') { bulletGroup.scale.set(1.05, 1.05, 2.1); trail.scale.set(0.7, 1.8, 0.7); }
                else bulletGroup.scale.setScalar(1.35);
            }
            bulletGroup.lookAt(bulletGroup.position.clone().add(d));
            bulletGroup.userData = {
                vel: d.multiplyScalar(speed),
                speed: speed,
                isPlayer: source.isPlayer,
                damage: source.isPlayer ? damage : damage * (state.diffMult.dmg || 1) * (source.damageMult || 1), // v10: difficulty + v26: level scaling
                pierce: source.isPlayer ? (state.playerStats.pierce || 0) : 0,
                hitList: [],
                life: life,
                home: home,
                style: style,
                color: bulletColor
            };
            scene.add(bulletGroup);
            bullets.push({ group: bulletGroup, innerGlow: innerGlow, outerGlow: outerGlow, trail: trail });
        }

        // v24: homing missile system
        let missiles = [];
        let supplyDrops = []; // v26.8
        let fieldMines = [];
        let artyShots = [];
        let emberPools = [];
        let resoPulses = [];

        function biomeTraitOf(biome) {
            const n = (biome && biome.name) || '';
            if (n.indexOf('Forest') >= 0 || n.indexOf('Autumn') >= 0 || n.indexOf('Sakura') >= 0) return { id: 'roots', label: 'Roots', short: 'ROOT' };
            if (n.indexOf('Volcanic') >= 0 || n.indexOf('Blood Moon') >= 0) return { id: 'heat', label: 'Heat', short: 'HEAT' };
            if (n.indexOf('Crystal') >= 0 || n.indexOf('Neon') >= 0) return { id: 'resonance', label: 'Resonance', short: 'RSN' };
            return null;
        }
        function currentBiomeTrait() {
            try { return biomeTraitOf(BIOMES[(state.currentBiome || 0) % BIOMES.length]); } catch (e) { return null; }
        }
        function biomeBannerText(biome) {
            const t = biomeTraitOf(biome);
            return t ? (biome.name + '  ·  ' + t.label) : biome.name;
        }
        function nearLivingTree(x, z) {
            if (!envChunks) return false;
            for (const ch of envChunks.values()) {
                if (!ch || !ch.colliders) continue;
                for (const c of ch.colliders) {
                    if (!c || c.dead || c.type !== 'tree') continue;
                    const dx = c.x - x, dz = c.z - z;
                    const lim = (c.r || 1.5) + 1.15;
                    if (dx * dx + dz * dz < lim * lim) return true;
                }
            }
            return false;
        }
        function hurtPlayerAt(amount, sx, sz) {
            if (!player || player.isDead) return;
            player.takeDamage(amount);
            if (sx != null) try { showDamageDirection(sx, sz); } catch (e) {}
            try { updateHUD(); } catch (e) {}
            if (player.hp <= 0) endGame();
        }
        function clearTacticalFX() {
            for (const m of fieldMines) {
                try { if (m.mesh) { scene.remove(m.mesh); disposeObject3D(m.mesh); } } catch (e) {}
                try { if (m._tgRing) scene.remove(m._tgRing); } catch (e) {}
            }
            fieldMines = [];
            for (const a of artyShots) {
                try { if (a.group) { scene.remove(a.group); disposeObject3D(a.group); } } catch (e) {}
                try { if (a._tgRing) scene.remove(a._tgRing); } catch (e) {}
            }
            artyShots = [];
            for (const p of emberPools) {
                try { if (p.mesh) { scene.remove(p.mesh); disposeObject3D(p.mesh); } } catch (e) {}
            }
            emberPools = [];
            for (const r of resoPulses) {
                try { if (r._tgRing) scene.remove(r._tgRing); } catch (e) {}
                try { if (r._tgFill) scene.remove(r._tgFill); } catch (e) {}
            }
            resoPulses = [];
        }
        function dropMine(x, z, dmg) {
            if (fieldMines.length >= 10) return;
            const y = (typeof getTerrainHeight === 'function' ? getTerrainHeight(x, z) : 0) + 0.12;
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.62, 0.22, 10),
                new THREE.MeshStandardMaterial({ color: 0x365314, metalness: 0.45, roughness: 0.5, emissive: 0x65a30d, emissiveIntensity: 0.35 })
            );
            mesh.position.set(x, y, z);
            scene.add(mesh);
            fieldMines.push({ mesh: mesh, x: x, z: z, y: y, dmg: dmg, arm: 0.85, life: 22 });
        }
        function fireArtilleryShell(e) {
            if (!player || player.isDead) return;
            const leadX = (player.velocity ? player.velocity.x : 0) * 0.28;
            const leadZ = (player.velocity ? player.velocity.z : 0) * 0.28;
            const tx = player.mesh.position.x + leadX;
            const tz = player.mesh.position.z + leadZ;
            const ty = (typeof getTerrainHeight === 'function' ? getTerrainHeight(tx, tz) : 0);
            const sx = e.mesh.position.x, sz = e.mesh.position.z, sy = e.mesh.position.y + 2.3;
            const g = new THREE.Group();
            const shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfb923c }));
            g.add(shell);
            g.position.set(sx, sy, sz);
            scene.add(g);
            const dmg = (ENEMY_TYPES.artillery.damage || 26) * (state.diffMult.dmg || 1) * (e.damageMult || 1);
            artyShots.push({ group: g, sx: sx, sy: sy, sz: sz, tx: tx, ty: ty, tz: tz, t: 0, life: 1.12, dmg: dmg });
        }
        function titanDoSlam(e, scale) {
            scale = scale || 1;
            const r = 14 * scale;
            try { createExplosion(e.mesh.position.clone(), Math.round(50 * scale), 0x88aaff, 'armor'); } catch (err) {}
            try { SFX.explosion(50 * scale); } catch (err) {}
            state.cameraShake = Math.max(state.cameraShake || 0, 0.7 * scale);
            const slamD = e.mesh.position.distanceTo(player.mesh.position);
            if (slamD < r) {
                const amt = ENEMY_TYPES.titan.damage * (slamD < r * 0.5 ? 1 : 0.6) * (state.diffMult.dmg || 1) * (e.damageMult || 1) * scale;
                hurtPlayerAt(amt, e.mesh.position.x, e.mesh.position.z);
            } else {
                try { showDamageDirection(e.mesh.position.x, e.mesh.position.z); } catch (err) {}
            }
            try {
                const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.8 * scale, side: THREE.DoubleSide });
                const wave = new THREE.Mesh(SHARED_GEO.slamRing, ringMat2);
                wave.rotation.x = -Math.PI / 2;
                wave.position.copy(e.mesh.position); wave.position.y += 0.4;
                scene.add(wave);
                let ws = 1;
                const animW = () => { ws += 1.6; wave.scale.setScalar(ws); ringMat2.opacity -= 0.05;
                    if (ringMat2.opacity > 0) requestAnimationFrame(animW); else { scene.remove(wave); ringMat2.dispose(); } };
                animW();
            } catch (err) {}
        }
        function updateTactical(dt) {
            if (!player || player.isDead) return;
            const trait = currentBiomeTrait();
            const now = state.runTime || 0;
            // Decision 5-B: Biome traits are VISUAL ONLY — no gameplay stat modifiers
            state._rootSlow = 1;      // always 1 (no movement penalty)
            state._traitHot = false;  // no heat damage
            state._traitReso = false; // no resonance effects
            // Visual-only ambient FX still run (sparks, embers) but never deal damage
            if (trait && trait.id === 'roots' && state.quality !== 'low' && Math.random() < 0.04) {
                try { fxSparks(player.mesh.position.x, player.mesh.position.y + 0.3, player.mesh.position.z, 0x854d0e, 1); } catch(e) {}
            }

            for (let i = artyShots.length - 1; i >= 0; i--) {
                const a = artyShots[i];
                a.t += dt;
                const u = Math.min(1, a.t / a.life);
                if (a.group) {
                    a.group.position.x = a.sx + (a.tx - a.sx) * u;
                    a.group.position.z = a.sz + (a.tz - a.sz) * u;
                    a.group.position.y = a.sy + (a.ty - a.sy) * u + Math.sin(u * Math.PI) * 6.2;
                }
                try { fxKeepRing(a, '_tgRing', a.tx, a.tz, 0xfb923c, 1.1 + 3.4 * u, 0.22 + 0.45 * u, false); } catch (e) {}
                if (a.t >= a.life) {
                    try { createExplosion(new THREE.Vector3(a.tx, a.ty + 0.4, a.tz), 18, 0xfb923c, 'spark'); } catch (e) {}
                    try { fxRingAt(a.tx, a.tz, 0xf97316, 0.8, 4.4, 0.28, false); SFX.explosion(18); } catch (e) {}
                    const dx = player.mesh.position.x - a.tx, dz = player.mesh.position.z - a.tz;
                    if (dx * dx + dz * dz < 4.6 * 4.6) hurtPlayerAt(a.dmg, a.tx, a.tz);
                    try { if (a.group) { scene.remove(a.group); disposeObject3D(a.group); } } catch (e) {}
                    try { if (a._tgRing) scene.remove(a._tgRing); } catch (e) {}
                    artyShots.splice(i, 1);
                }
            }

            for (let i = fieldMines.length - 1; i >= 0; i--) {
                const m = fieldMines[i];
                m.arm -= dt; m.life -= dt;
                if (m.mesh) m.mesh.rotation.y += dt * 1.4;
                const ready = m.arm <= 0;
                try { fxKeepRing(m, '_tgRing', m.x, m.z, ready ? 0x84cc16 : 0xa3e635, ready ? 1.6 : 1.1, ready ? 0.45 : 0.22, false); } catch (e) {}
                const dx = player.mesh.position.x - m.x, dz = player.mesh.position.z - m.z;
                if (ready && dx * dx + dz * dz < 3.2 * 3.2) {
                    try { createExplosion(new THREE.Vector3(m.x, m.y, m.z), 16, 0x84cc16, 'spark'); SFX.explosion(16); } catch (e) {}
                    hurtPlayerAt(m.dmg, m.x, m.z);
                    try { if (m.mesh) { scene.remove(m.mesh); disposeObject3D(m.mesh); } } catch (e) {}
                    try { if (m._tgRing) scene.remove(m._tgRing); } catch (e) {}
                    fieldMines.splice(i, 1);
                    continue;
                }
                if (m.life <= 0) {
                    try { if (m.mesh) { scene.remove(m.mesh); disposeObject3D(m.mesh); } } catch (e) {}
                    try { if (m._tgRing) scene.remove(m._tgRing); } catch (e) {}
                    fieldMines.splice(i, 1);
                }
            }
        }
        // Q013: single source of truth for how a Missile Pod stack count turns into a
        // volley. Split out so the release harness can assert the cap and the overload
        // rollover without running the frame loop.
        function missileVolleyPlan(stacks) {
            const MC = CONFIG.missile;
            const n = Math.max(0, stacks || 0);
            return {
                count: Math.min(n, MC.maxPerVolley),
                overload: Math.max(0, n - MC.maxPerVolley)
            };
        }

        function fireHomingMissile(target) {
            const g = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 1.2), new THREE.MeshBasicMaterial({ color: 0xff6644 }));
            g.add(body);
            const flame = new THREE.Mesh(new THREE.SphereGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xffcc55 }));
            flame.position.z = -0.8;
            g.add(flame);
            const start = player.mesh.position.clone(); start.y += 2;
            g.position.copy(start);
            scene.add(g);
            missiles.push({ group: g, target, life: 5, speed: 34,
                vel: new THREE.Vector3(Math.random() - 0.5, 7, (Math.random() - 0.5) * 4) });
        }
        function updateMissiles(dt) {
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i];
                m.life -= dt;
                if (!m.target || m.target.isDead || !enemies.includes(m.target)) {
                    let best = null, bd = 1e9;
                    for (const e of enemies) { if (e.isDead) continue; const d = e.mesh.position.distanceTo(m.group.position); if (d < bd) { bd = d; best = e; } }
                    if (best) m.target = best;
                    else { createExplosion(m.group.position, 10, 0xff6644); scene.remove(m.group); missiles.splice(i, 1); continue; }
                }
                const dir = _tv3.copy(m.target.mesh.position).sub(m.group.position); dir.y += 1;
                dir.normalize().multiplyScalar(m.speed);
                m.vel.lerp(dir, 0.12);
                m.group.position.addScaledVector(m.vel, dt);
                m.group.lookAt(_tv4.copy(m.group.position).add(m.vel));
                if (m.group.position.distanceTo(m.target.mesh.position) < 3) {
                    missileBlast(m.group.position.clone());
                    scene.remove(m.group); missiles.splice(i, 1); continue;
                }
                if (m.life <= 0) { createExplosion(m.group.position, 12, 0xff6644); scene.remove(m.group); missiles.splice(i, 1); }
            }
        }
        function clusterBomblet(pos) {
            if (!state.isPlaying || !pos) return;
            const dmg = CONFIG.baseDamage * (state.playerStats.damage / 100) * 1.05;
            try { createExplosion(pos, 16, 0xffaa66, 'spark'); } catch (e) {}
            try { fxRingAt(pos.x, pos.z, 0xff9f43, 0.5, 2.6, 0.22, false); } catch (e) {}
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (!e || e.isDead) continue;
                if (e.mesh.position.distanceTo(pos) < 3.4) {
                    const isCrit = Math.random() * 100 < (state.playerStats.crit || 0);
                    e.takeDamage(dmg * (isCrit ? 2 : 1));
                    if (!e.isDead) bumpComboFromHit(e);
                    if (e.isDead) {
                        handleEnemyKill(e, isCrit, 'missile');
                        enemies.splice(j, 1);
                    }
                }
            }
        }
        function missileBlast(pos) {
            // Q013: past CONFIG.missile.maxPerVolley the volley stops growing and the blast
            // takes over — each overload stack widens the radius and increases the damage,
            // so Missile Pod stacks never stop mattering. At zero overload this is exactly
            // the legacy 2.5x damage in a 6.5-unit radius.
            const MC = CONFIG.missile;
            const overload = state.missileOverload || 0;
            const radius = 6.5 * (1 + overload * MC.overloadRadiusPerStack);
            const dmg = CONFIG.baseDamage * (state.playerStats.damage / 100) * 2.5
                        * (1 + overload * MC.overloadDamagePerStack);
            createExplosion(pos, 34 * (1 + overload * MC.overloadRadiusPerStack), 0xff8844, 'armor');
            SFX.explosion(34);
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (e.isDead) continue;
                const d = e.mesh.position.distanceTo(pos);
                if (d < radius) {
                    const isCrit = Math.random() * 100 < (state.playerStats.crit || 0);
                    e.takeDamage(dmg * (d < 3 ? 1 : 0.5) * (isCrit ? 2 : 1));
                    if (!e.isDead) bumpComboFromHit(e);
                    if (e.isDead) {
                        handleEnemyKill(e, isCrit, 'missile');
                        enemies.splice(j, 1);
                    }
                }
            }
            if (state.playerStats.evo_cluster) {
                for (let k = 0; k < 3; k++) {
                    const ang = (k / 3) * Math.PI * 2 + Math.random() * 0.35;
                    const bp = pos.clone();
                    bp.x += Math.cos(ang) * 2.3;
                    bp.z += Math.sin(ang) * 2.3;
                    setTimeout(function () { try { clusterBomblet(bp); } catch (e) {} }, 70 + k * 55);
                }
            }
        }
        // v10: difficulty — v26.2: fire rate ramps with the run level (capped at +50%)
        const enemyFireRoll = (base, dt) => Math.random() < base * dt * 60 * (state.diffMult.fire || 1)
            * (1 + Math.min(0.5, Math.max(0, (state.level || 1) - 1) * 0.015));
        let _sfxShootAt = 0, _sfxEnemyAt = 0;
        // Q011: the Adrenaline Rush damage bonus, in ONE place. shoot() multiplies by this
        // and the HUD meter displays this same value, so the number the player reads can
        // never disagree with the number the pipeline applies (audit defect D-05 was exactly
        // that disagreement: Yt01's meter advertised +5%/stack and shoot() had no such term).
        // Returns 1 when the buff is down or no stacks are owned.
        function adrenalineDamageMult() {
            if ((state.runTime || 0) >= (state.speedBoostUntil || 0)) return 1;
            const stacks = Math.max(0, state.playerStats.adrenaline || 0);
            return 1 + CONFIG.adrenaline.damagePerStack * stacks;
        }

        // Q011: the matching speed multiplier. Preserves Yt02's existing in-movement math
        // exactly — 0 stacks = x1.25, 1 = x1.50, 2 = x1.75, plus Afterburner's x1.12 — so
        // this refactor changes where the number is computed, not what it computes.
        // Movement and the HUD speed meter both read this, so they cannot drift apart.
        function adrenalineSpeedMult() {
            if ((state.runTime || 0) >= (state.speedBoostUntil || 0)) return 1;
            const stacks = Math.max(0, state.playerStats.adrenaline || 0);
            let m = 1 + CONFIG.adrenaline.speedPerStack * (stacks + 1);
            if (state.playerStats.evo_afterburner) m *= 1.12;
            return m;
        }

        function shoot(source) {
            const nowS = performance.now();
            if (source.isPlayer) {
                if (nowS - _sfxShootAt > 95) { _sfxShootAt = nowS; SFX.shoot(); }
                if (source.targetTilt) source.targetTilt.y += 0.12;
            } /* v26.8: no enemy gunfire SFX */
            // Recoil animation with smooth return
            const originalZ = source.barrel.position.z;
            source.barrel.position.z -= 0.5;
            
            const recoilReturn = () => {
                if (source.barrel) {
                    source.barrel.position.z += 0.05;
                    if (source.barrel.position.z < originalZ) {
                        requestAnimationFrame(recoilReturn);
                    } else {
                        source.barrel.position.z = originalZ;
                    }
                }
            };
            setTimeout(recoilReturn, 50);

            createMuzzleFlash(source);

            const shotCount = source.isPlayer ? 1 + Math.min(state.playerStats.multishot || 0, 4) : 1; // v4: stacks
            const spreadAngle = 0.12;
            const damage = source.isPlayer
                ? CONFIG.baseDamage * (state.playerStats.damage / 100)
                    * ((state.runTime || 0) < (state.overchargeUntil || 0) ? 1.3 : 1)
                    * ((state.runTime || 0) < (state.blastUntil || 0) ? 1.2 : 1)
                    * adrenalineDamageMult()   // Q011: +5% per Adrenaline stack, now real
                : (ENEMY_TYPES[source.type]?.damage || 12);
            let siegeShot = false;
            if (source.isPlayer && state.playerStats.evo_siege) {
                state.shotIndex = (state.shotIndex || 0) + 1;
                if (state.shotIndex % 4 === 0) {
                    siegeShot = true;
                    try { state.cameraShake = Math.max(state.cameraShake || 0, 0.18); } catch (e) {}
                }
            }

            for (let i = 0; i < shotCount; i++) {
                const dir = new THREE.Vector3(0, 0, 1);
                dir.applyQuaternion(source.turretPivot.getWorldQuaternion(new THREE.Quaternion()));
                if (shotCount > 1) {
                    const angle = (i - (shotCount - 1) / 2) * spreadAngle; // v4: fan centered on aim
                    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                }
                spawnBullet(source, dir, siegeShot ? damage * 1.7 : damage, siegeShot);
            }
        }

        function createMuzzleFlash(source) {
            const flashGroup = new THREE.Group();

            // FIX (Tier 2): shared cached geometries; flash material shared (opacity
            // ignored on it — it is not transparent), ring material is per-flash
            // because its opacity is animated, so it is disposed on removal.
            const flash = new THREE.Mesh(SHARED_GEO.flashSphere, FLASH_RES.flash);
            flashGroup.add(flash);

            // Outer ring
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(SHARED_GEO.flashRing, ringMat);
            ring.rotation.y = Math.PI / 2;
            flashGroup.add(ring);

            const muzzleWorld = new THREE.Vector3();
            source.barrel.getWorldPosition(muzzleWorld);
            flashGroup.position.copy(muzzleWorld);
            
            // Orient flash forward
            const dir = new THREE.Vector3(0, 0, 1);
            dir.applyQuaternion(source.turretPivot.getWorldQuaternion(new THREE.Quaternion()));
            flashGroup.position.add(dir.multiplyScalar(0.5));

            scene.add(flashGroup);

            // FIX (Tier 3): one PERSISTENT shared muzzle light instead of a new PointLight
            // per shot (light count never changes → no shader recompiles).
            initDynamicLights();
            muzzleLight.position.copy(flashGroup.position);
            let lightIntensity = 3;
            muzzleLight.intensity = lightIntensity;

            // Animate out
            let scale = 1;
            const animateFlash = () => {
                scale *= 0.82;
                lightIntensity *= 0.8;
                flashGroup.scale.setScalar(scale);
                flash.material.opacity = scale;
                ring.material.opacity = scale * 0.9;
                muzzleLight.intensity = lightIntensity;
                
                if (scale > 0.05) {
                    requestAnimationFrame(animateFlash);
                } else {
                    scene.remove(flashGroup);
                    disposeObject3D(flashGroup); // FIX (Tier 2): frees the per-flash ring material
                    muzzleLight.intensity = 0;
                }
            };
            animateFlash();
        }

        function createHealEffect(pos) {
            for (let i = 0; i < 10; i++) {
                // FIX (Tier 2): shared unit sphere scaled to 0.25 (identical look, no leak);
                // per-particle material kept because each particle fades independently.
                const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 1 });
                const mesh = new THREE.Mesh(SHARED_GEO.sphere1, mat);
                mesh.scale.setScalar(0.25);
                mesh.position.copy(pos);
                mesh.position.x += (Math.random() - 0.5) * 2;
                mesh.position.z += (Math.random() - 0.5) * 2;
                mesh.position.y += 1;

                particles.push({
                    mesh: mesh,
                    velocity: new THREE.Vector3(0, 3 + Math.random() * 2, 0),
                    life: 1.2,
                    isHeal: true
                });
                scene.add(mesh);
            }
        }

        function createExplosion(pos, count, color = 0xff6600, type = 'default', enemyType = null) {
            const isArmor = type === 'armor';
            const isTree = type === 'tree';
            const isRock = type === 'rock';
            const isGround = type === 'ground';
            
            // Volumetric debris particles
            // FIX (Tier 2): particles use cached UNIT geometries + per-mesh scale
            // instead of a new (never-disposed) geometry per particle.
            // Uniform/scaling math produces identical shapes to the originals.
            // v26.6: cap debris so deaths don't fog the screen
            const debrisN = Math.min(count, type === 'spark' ? 3 : (isArmor ? 5 : 6));
            for (let i = 0; i < debrisN; i++) {
                const size = (0.2 + Math.random() * 0.5) * (isArmor ? 0.8 : 1);
                let geo, mat, sx = size, sy = size, sz = size;

                if (isTree) {
                    if (Math.random() > 0.5) { geo = SHARED_GEO.plane1; sx = size; sy = size; sz = 1; }
                    else { geo = SHARED_GEO.box1; sx = size / 2; sy = size; sz = size / 2; }
                    mat = new THREE.MeshBasicMaterial({
                        color: Math.random() > 0.5 ? 0x2d5a27 : 0x5c4033,
                        side: THREE.DoubleSide
                    });
                } else if (type === 'rock') { // v19: shattered boulders
                     geo = SHARED_GEO.dodeca1;
                     const rr = size * 0.8; sx = rr; sy = rr; sz = rr;
                     mat = new THREE.MeshStandardMaterial({
                        color: Math.random() > 0.5 ? 0x8a8a8a : 0x6a6a6a,
                        roughness: 1.0
                    });
                } else if (isGround) {
                     geo = SHARED_GEO.dodeca1;
                     const r = size * 0.7; sx = r; sy = r; sz = r;
                     mat = new THREE.MeshStandardMaterial({
                        color: Math.random() > 0.5 ? 0x5a4d41 : 0x3d3024,
                        roughness: 1.0
                    });
                } else {
                    // Armor / Default (two independent rolls, matching the original distribution)
                    if (Math.random() < 0.33) { geo = SHARED_GEO.box1; }
                    else if (Math.random() < 0.66) { geo = SHARED_GEO.tetra1; }
                    else { geo = SHARED_GEO.octa1; sx = sy = sz = size * 0.8; }

                    const hitColor = new THREE.Color(color);
                    if (isArmor) hitColor.offsetHSL(0, 0, 0.2); // Brighter for armor

                    mat = new THREE.MeshStandardMaterial({
                        color: hitColor,
                        emissive: isArmor ? hitColor : 0x000000,
                        emissiveIntensity: isArmor ? 0.8 : 0,
                        roughness: isArmor ? 0.3 : 0.9,
                        metalness: isArmor ? 0.8 : 0.1
                    });
                }

                const mesh = new THREE.Mesh(geo, mat);
                mesh.scale.set(sx, sy, sz);
                mesh.position.copy(pos);
                mesh.position.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1.5, 
                    (Math.random() - 0.5) * 1.5, 
                    (Math.random() - 0.5) * 1.5
                ));
                
                if (isTree) mesh.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);

                const speed = isArmor ? 18 : (isGround ? 8 : 12);
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * speed,
                    Math.random() * (speed * 0.8) + 2,
                    (Math.random() - 0.5) * speed
                );

                if (!isTree) mesh.castShadow = true;

                particles.push({
                    mesh: mesh,
                    velocity: vel,
                    life: (0.8 + Math.random() * 0.6) * (isTree ? 1.5 : 1),
                    rotationSpeed: new THREE.Vector3(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10
                    ),
                    gravity: true
                });
                scene.add(mesh);
            }

            // Smoke/Dust
            const smokeCount = (type === 'spark' || isArmor) ? 0 : (isGround ? 1 : 1);
            for (let i = 0; i < smokeCount; i++) {
                const smokeRadius = 0.8 + Math.random() * 0.6; // FIX (Tier 2): shared unit sphere + scale
                let smokeColor = 0x6a6a6a;
                
                if (isArmor) smokeColor = 0x333333;
                else if (isTree) smokeColor = 0x4a3728;
                else if (isGround) smokeColor = 0x8b7355; // Dust color
                
                const smokeMat = new THREE.MeshBasicMaterial({
                    color: smokeColor,
                    transparent: true,
                    opacity: isGround ? 0.4 : 0.6
                });
                const smoke = new THREE.Mesh(SHARED_GEO.sphere1, smokeMat);
                smoke.scale.setScalar(smokeRadius);
                smoke.position.copy(pos);
                smoke.position.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    Math.random() * 1,
                    (Math.random() - 0.5) * 1
                ));

                particles.push({
                    mesh: smoke,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        Math.random() * 3 + 1,
                        (Math.random() - 0.5) * 2
                    ),
                    life: 1.2,
                    isSmoke: true,
                    expansionRate: 1.2
                });
                scene.add(smoke);
            }

            // Special Effects for Enemies
            if (isArmor && enemyType) {
                // Healer - Healing particles burst
                if (enemyType === 'healer') {
                    for(let i=0; i<8; i++) {
                         const mat = new THREE.MeshBasicMaterial({color: 0x00ff00});
                         const p = new THREE.Mesh(SHARED_GEO.box1, mat); // FIX (Tier 2)
                         p.scale.setScalar(0.2);
                         p.position.copy(pos);
                         particles.push({
                             mesh: p,
                             velocity: new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10),
                             life: 0.6,
                             gravity: true
                         });
                         scene.add(p);
                    }
                }
                // Scout - Electrical sparks
                if (enemyType === 'scout') {
                    for(let i=0; i<6; i++) {
                        // Blue sparks
                         const mat = new THREE.MeshBasicMaterial({color: 0xffff00, side: THREE.DoubleSide});
                         const p = new THREE.Mesh(SHARED_GEO.plane1, mat); // FIX (Tier 2)
                         p.scale.set(0.1, 0.5, 1);
                         p.position.copy(pos);
                         particles.push({
                             mesh: p,
                             velocity: new THREE.Vector3((Math.random()-0.5)*15, Math.random()*15, (Math.random()-0.5)*15),
                             life: 0.4,
                             rotationSpeed: new THREE.Vector3(10,10,10),
                             gravity: false
                         });
                         scene.add(p);
                    }
                }
            }

            // Shockwave/Flash for high impact
            if (isArmor || count > 20) {
                const ringMat = new THREE.MeshBasicMaterial({ // FIX (Tier 2): shared ring geometry, per-explosion material
                    color: color,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });
                const shockwave = new THREE.Mesh(SHARED_GEO.shockRing, ringMat);
                shockwave.rotation.x = -Math.PI / 2;
                shockwave.position.copy(pos);
                scene.add(shockwave);

                let ringScale = 1;
                const animateRing = () => {
                    ringScale += 0.4;
                    shockwave.scale.setScalar(ringScale);
                    shockwave.material.opacity -= 0.08;
                    
                    if (shockwave.material.opacity > 0) {
                        requestAnimationFrame(animateRing);
                    } else {
                        scene.remove(shockwave);
                        disposeObject3D(shockwave); // FIX (Tier 2)
                    }
                };
                animateRing();

                // FIX (Tier 3): small pool of persistent explosion lights (round-robin).
                // Same flash of light on kills without per-explosion light churn.
                initDynamicLights();
                const light = acquireExplosionLight(color, pos);
                const ticket = light.userData.ticket;
                let intensity = 3;
                const fadeLight = () => {
                    if (light.userData.ticket !== ticket) return; // reused by a newer explosion
                    intensity -= 0.4;
                    light.intensity = Math.max(0, intensity);
                    if (intensity > 0) requestAnimationFrame(fadeLight);
                    else light.intensity = 0;
                };
                fadeLight();
            }

            state.cameraShake = Math.max(state.cameraShake, count > 30 ? 0.5 : 0.2);
            if (count >= 10) SFX.explosion(count); // v26.8: only chunky blasts
        }

        // ============================================
        // GAME LOGIC
        // ============================================
