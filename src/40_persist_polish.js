const oldUpdateLoop = updatePhysics;
updatePhysics = function(dt){
    if(state.isChoosingUpgrade || state.marketOpen) return;
    if ((state._hitStop || 0) > 0) { state._hitStop -= dt; return; }
    updateCombo(dt);
    oldUpdateLoop(dt);
    try { fxTick(dt); } catch (e) {}
    try { updateCombatTray(); } catch (e) {}
    try { tickBiomeNameAndWander(); } catch (e) {}
};

// difficulty scaling
function getSpawnMultiplier(){
    return 1 + state.level * 0.1;
}

// save/load
function saveGame(){ // (uses the `store` defined at the top of the script)
    try {
        store.set('tank_save', JSON.stringify({
            v: 3,
            coins: state.coins,
            meta: state.meta || {},          // v4: permanent Armory upgrades
            skins: state.skins || { owned: ['amber'], selected: 'amber' }, // v10
            casual: { best: state.bestCasual || 0, auto: state.autoSave || null, saves: state.casualSaves || [] }, // v13
            stats: state.stats || {}, achUnlocked: state.achUnlocked || [], daily: state.daily || null, // v23
            musicEnabled: state.musicEnabled !== false, // v24
            quality: state.quality || 'auto', tutorialTips: state.tutorialTips || {}, // v25
            hapticsEnabled: state.hapticsEnabled !== false,
            leftHanded: !!state.leftHanded,
            reduceShake: !!state.reduceShake,
            reduceFlash: !!state.reduceFlash,
            damageNumbers: state.damageNumbers !== false,
            combatPopups: state.combatPopups !== false,
            fpsMode: state.fpsMode || 60,
            levels: { best: state.bestLevels || 0 },
            progress: { maxCleared: state.maxCleared || 1 }, // v13: level-select unlock
            consumables: state.consumables || { lucky: 0, headstart: 0, reroll: 0, overcharge: 0, aegis: 0 } // v11/v27.3
        }));
    } catch(e) { /* storage unavailable (private mode etc.) — ignore */ }
}

function loadGame(){
    // FIX (Tier 1): try/catch — a corrupt save must never crash boot
    try {
        let d = JSON.parse(store.get('tank_save'));
        if(!d) return;
        state.coins = d.coins || 0;
        state.meta = d.meta || {}; // v4: permanent Armory upgrades
        state.skins = d.skins || { owned: ['amber'], selected: 'amber' };
        state.bestCasual = (d.casual && d.casual.best) || 0;
        state.bestLevels = (d.levels && d.levels.best) || 0;
        state.consumables = d.consumables || { lucky: 0, headstart: 0, reroll: 0, overcharge: 0, aegis: 0 }; // v11/v27.3
        state.stats = d.stats || null; // v23
        state.achUnlocked = d.achUnlocked || [];
        state.daily = d.daily || null;
        if (d.musicEnabled === false) state.musicEnabled = false; // v24
        if (d.quality === 'low' || d.quality === 'high') {
            state.quality = d.quality;
            if (d.quality === 'low') { _autoApplied = 'low'; applyQuality('low'); } // v26: actually apply the saved setting at boot (shadows/pixel-ratio were staying at High)
        } // v25
        if (d.tutorialTips) state.tutorialTips = d.tutorialTips;
        if (d.hapticsEnabled === false) state.hapticsEnabled = false;
        if (d.leftHanded) state.leftHanded = true;
        if (d.reduceShake) state.reduceShake = true;
        if (d.reduceFlash) state.reduceFlash = true;
        if (d.damageNumbers === false) state.damageNumbers = false;
        if (d.combatPopups === false) state.combatPopups = false;
        if (d.fpsMode === 30) state.fpsMode = 30;
        state.maxCleared = (d.progress && d.progress.maxCleared) || 1; // v13
        if (d.v === 3) { // v13: named save slots + auto slot
            state.casualSaves = (d.casual && d.casual.saves) || [];
            state.autoSave = (d.casual && d.casual.auto) || null;
        } else { // migrate v2 single snapshot -> auto slot
            state.casualSaves = [];
            state.autoSave = (d.casual && d.casual.snapshot) || null;
        }
    } catch(e) { /* corrupt save ignored */ }
}


        // ============================================================
        // TANKTHILTETEYT — INJECTED FEATURES
        // ============================================================
        const TY_GOLD = '#D1B87D';
        const TY_CYAN = '#52efff';
        let combatFX = [];
        let trackMarks = [];
        const _combatTextPos = new THREE.Vector3();
        const _trackMarkGeo = new THREE.PlaneGeometry(0.62, 2.24);
        // _aimV1 / _aimV2 are already declared by the B2 engine above

        function showCombatText(text, worldPos, color = '#f7c75d', size = 13) {
            if (state.damageNumbers === false) return;
            if (!worldPos || !camera) return;
            const p = _combatTextPos.copy(worldPos); p.y += 3; p.project(camera);
            if (p.z < -1 || p.z > 1) return;
            const el = document.createElement('div'); el.className = 'combat-text';
            el.textContent = text; el.style.left = ((p.x + 1) * 50) + '%'; el.style.top = ((1 - p.y) * 50) + '%';
            el.style.color = color; el.style.fontSize = size + 'px'; document.body.appendChild(el);
            setTimeout(() => el.remove(), 720);
        }
        function impactPulse(pos, color = 0x52efff, radius = 4, duration = 0.42) {
            if (!pos || !scene) return;
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
            const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), mat);
            mesh.rotation.x = -Math.PI / 2; mesh.position.copy(pos); mesh.position.y = getTerrainHeight(pos.x, pos.z) + 0.32;
            scene.add(mesh); combatFX.push({ kind:'pulse', mesh, mat, age:0, duration, radius });
        }
        function dangerRing(pos, radius, duration, color = 0xff6b35, follow = null, onDone = null) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.72, side:THREE.DoubleSide, depthWrite:false });
            const mesh = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), mat);
            mesh.rotation.x = -Math.PI / 2; mesh.position.copy(pos); mesh.position.y = getTerrainHeight(pos.x,pos.z)+0.28;
            scene.add(mesh); combatFX.push({ kind:'danger', mesh, mat, age:0, duration, radius, follow, onDone });
            return mesh;
        }
        function aimTelegraph(source, duration = 0.72, color = 0xffd166, onDone = null) {
            if (!source || source.isDead || source._telegraphing) return false;
            source._telegraphing = true;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            const mat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.18, depthWrite:false });
            const line = new THREE.Line(geo, mat); scene.add(line);
            combatFX.push({ kind:'aim', mesh:line, mat, geo, age:0, duration, source, onDone:()=>{source._telegraphing=false;if(onDone)onDone();} });
            return true;
        }
        function telegraphedShot(source, duration, color) {
            return aimTelegraph(source, duration, color, () => { if (!source.isDead && enemies.includes(source) && state.gamePhase === 'playing') shoot(source); });
        }
        function dropTrackMarks(tank) {
            if (!tank || !tank.isPlayer || lowGraphicsActive() || !scene) return;
            const now = state.runTime || 0; if (now < (tank._nextTrackAt || 0) || tank.velocity.length() < 0.05) return;
            tank._nextTrackAt = now + 0.16;
            const rightX = Math.cos(tank.mesh.rotation.y), rightZ = -Math.sin(tank.mesh.rotation.y);
            for (const side of [-1,1]) {
                const mat = new THREE.MeshBasicMaterial({ color:0x161a18, transparent:true, opacity:0.22, depthWrite:false });
                const m = new THREE.Mesh(_trackMarkGeo,mat); m.rotation.x=-Math.PI/2; m.rotation.z=-tank.mesh.rotation.y;
                m.position.set(tank.mesh.position.x+rightX*side*1.22,getTerrainHeight(tank.mesh.position.x,tank.mesh.position.z)+0.035,tank.mesh.position.z+rightZ*side*1.22);
                scene.add(m); trackMarks.push({mesh:m,mat,life:3.4});
            }
            while(trackMarks.length>36){const t=trackMarks.shift();scene.remove(t.mesh);t.mat.dispose();}
        }
        function clearCombatPolish() {
            for (const f of combatFX) { if (f.source) f.source._telegraphing=false; if (scene && f.mesh) scene.remove(f.mesh); if (f.geo) f.geo.dispose(); if (f.mat) f.mat.dispose(); }
            combatFX=[];
            for (const t of trackMarks) { if (scene && t.mesh) scene.remove(t.mesh); if (t.mat) t.mat.dispose(); }
            trackMarks=[];
            document.querySelectorAll('.combat-text').forEach(e=>e.remove());
        }

        function updateCombatPolish(dt) {
            for (let i=combatFX.length-1;i>=0;i--) {
                const f=combatFX[i]; f.age+=dt; const t=Math.min(1,f.age/f.duration);
                if (f.kind==='aim') {
                    if (!f.source||f.source.isDead||!player) { f.age=f.duration; }
                    else { try {
                        const a=_aimV1; f.source.barrel.getWorldPosition(a);
                        const b=_aimV2.copy(player.mesh.position); b.y+=1.1;
                        const ar=f.geo.attributes.position.array;
                        ar[0]=a.x;ar[1]=a.y;ar[2]=a.z;ar[3]=b.x;ar[4]=b.y;ar[5]=b.z;
                        f.geo.attributes.position.needsUpdate=true; f.mat.opacity=0.12+0.78*t;
                    } catch(e2) { f.age=f.duration; } }
                } else {
                    if (f.follow&&!f.follow.isDead) {
                        f.mesh.position.x=f.follow.mesh.position.x;
                        f.mesh.position.z=f.follow.mesh.position.z;
                        try{f.mesh.position.y=getTerrainHeight(f.mesh.position.x,f.mesh.position.z)+0.28;}catch(e2){}
                    }
                    const s=f.kind==='danger'?Math.max(.8,f.radius*(.55+.45*t)):Math.max(.1,f.radius*t);
                    f.mesh.scale.setScalar(s); f.mat.opacity=f.kind==='danger'?.25+.55*t:.72*(1-t);
                }
                if (f.age>=f.duration) {
                    if(scene&&f.mesh) scene.remove(f.mesh);
                    if(f.geo)f.geo.dispose(); if(f.mat)f.mat.dispose(); combatFX.splice(i,1);
                    if(f.onDone)try{f.onDone()}catch(e2){}
                }
            }
            for(let i=trackMarks.length-1;i>=0;i--) {
                const tm=trackMarks[i]; tm.life-=dt; tm.mat.opacity=Math.min(.22,tm.life*.09);
                if(tm.life<=0){if(scene&&tm.mesh)scene.remove(tm.mesh);tm.mat.dispose();trackMarks.splice(i,1);}
            }
            if(player) try{dropTrackMarks(player);}catch(e2){}
        }

        function coinIncome(n) {
            const b=(state.playerStats&&state.playerStats.coinBonus)||0;
            return Math.round((n||0)*(1+b/100+(state.runCoinBoost||0)));
        }
        function spawnBlocked() {
            return !!(state.spawnSafeUntil&&(state.runTime||0)<state.spawnSafeUntil);
        }
        function applyReviveSafety() {
            if(!state) return; state.spawnSafeUntil=(state.runTime||0)+3;
            try{bullets.length=0;}catch(e2){} try{missiles.length=0;}catch(e2){}
            if(enemies) enemies.forEach(e=>{if(!e.isDead)e._hushedUntil=(state.runTime||0)+2;});
        }
        function aidDropInterval() {
            const L=state.level||1;
            if(L<=3) return 10+Math.random()*6;
            if(L<=7) return 18+Math.random()*10;
            if(L<=12) return 28+Math.random()*14;
            return 40+Math.random()*20;
        }
        function spawnAidDrop() {
            if(!player) return;
            const roll=Math.random(), L=state.level||1;
            // v1.2: levels 1–5 → 70% repair, 20% shield, 10% haste; levels 6–7 → original odds; levels 8+ → even odds
            let kind;
            if(L<=5)  kind=roll<0.70?'repair':(roll<0.90?'shield':'haste');
            else if(L<=7) kind=roll<0.45?'repair':(roll<0.75?'shield':'haste');
            else      kind=roll<0.34?'repair':(roll<0.67?'shield':'haste');
            const pal={repair:{color:0x22c55e,glow:0x4ade80,label:'❤️ Repair inbound'},
                        shield:{color:0x2563eb,glow:0x60a5fa,label:'🛡️ Shield inbound'},
                        haste: {color:0x0891b2,glow:0x22d3ee,label:'💨 Haste inbound'}}[kind];
            const ang=Math.random()*Math.PI*2, dist=14+Math.random()*16;
            const ox=player.mesh.position.x+Math.cos(ang)*dist, oz=player.mesh.position.z+Math.sin(ang)*dist;
            let ground=0; try{ground=getTerrainHeight(ox,oz);}catch(e2){}
            const g=new THREE.Group();
            const orb=new THREE.Mesh(new THREE.SphereGeometry(.72,16,12),
                new THREE.MeshStandardMaterial({color:pal.color,emissive:pal.glow,emissiveIntensity:.85,metalness:.2,roughness:.35}));
            orb.position.y=.8; g.add(orb);
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.08,8,20),new THREE.MeshBasicMaterial({color:pal.glow}));
            ring.rotation.x=Math.PI/2; ring.position.y=.8; g.add(ring);
            g.position.set(ox,ground+12,oz); scene.add(g);
            supplyDrops.push({group:g,chute:null,beam:null,yLand:ground,falling:true,bob:Math.random()*6,black:false,aid:kind,glowMat:orb.material});
            try{showUpgradeNotification(pal.label);}catch(e2){}
        }
        function quickSaveFromPause() {
            if(state.mode==='casual'){openSaveDialog();return;}
            try{saveGame();}catch(e2){}
            try{showUpgradeNotification('💾 Run saved!');}catch(e2){}
        }
        function hushHostileFire(sec) {
            const s=(sec==null)?1.5:sec; state.enemyFireMuteUntil=(state.runTime||0)+s;
            let untilClock=0; try{untilClock=clock.getElapsedTime()+s;}catch(e2){}
            if(enemies) for(const en of enemies){
                if(!en||en.isDead||!en.isBoss) continue;
                en.nextAttackAt=Math.max(en.nextAttackAt||0,untilClock);
                en._fanCharging=false; en._novaCharging=false; en._slamCharging=false;
            }
        }

function renderBuildSummary(targetId){
    const el=document.getElementById(targetId);if(!el)return;
    const owned=(state.evolutions||[]).map(id=>EVOLUTION_CARDS.find(e=>e.id===id)).filter(Boolean);
    const nearest=EVOLUTION_CARDS.filter(e=>!owned.includes(e)).sort((a,b)=>{const pa=evolutionProgress(a).split('/').map(Number),pb=evolutionProgress(b).split('/').map(Number);return (pb[0]/pb[1])-(pa[0]/pa[1]);}).slice(0,2);
    const cards=Object.entries(state.runCards||{}).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
    const names=Object.fromEntries(CHOICE_UPGRADES.map(u=>[u.stat,u.icon+' '+u.text]));
    el.innerHTML='<div class="build-phase2-title">EVOLUTIONS & CARD LOADOUT</div><div class="build-phase2-evo">'+
      (owned.length?owned.map(e=>'<span class="build-evo-chip">'+e.icon+' '+e.text+'</span>').join(''):nearest.map(e=>'<span class="build-evo-chip locked">◇ '+e.text+' '+evolutionProgress(e)+'</span>').join(''))+
      '</div><div class="build-card-grid">'+(cards.length?cards.map(([k,n])=>'<span class="build-card-row"><b>'+((names[k])||k)+'</b><em>×'+n+'</em></span>').join(''):'<span class="build-card-row"><b>No cards yet</b><em>—</em></span>')+'</div>';
}

// Q054 — the entire kill-payout chain lives HERE and nowhere else:
//     base points -> combo bonus (capped 2.2) -> CONFIG.killPayoutScale -> coinIncome()
// coinIncome() is the single place that applies Scavenger (playerStats.coinBonus) and
// Lucky Charm (state.runCoinBoost). Previously this function applied coinBonus itself
// and THEN called coinIncome(), which applied coinBonus and runCoinBoost a second time,
// so both bonuses were squared (audit defect D-01). Bonuses now apply exactly once.
function addKillReward(enemy){
    state.combo++;
    state.comboTimer = 3;

    const base = enemy.pointValue || (enemy.typeData ? enemy.typeData.points : 50);
    const withCombo = base * Math.min(2.2, 1 + state.combo * 0.2);
    const payout = coinIncome(Math.floor(withCombo * CONFIG.killPayoutScale));
    state.coins += payout;
    state.runCoins = (state.runCoins || 0) + payout;
    return payout;
}

function syncComboChip(){
    const el = document.getElementById('combo-chip');
    const n = document.getElementById('combo-count');
    if (!el || !n) return;
    const c = state.combo || 0;
    if (c < 2 || state.gamePhase !== 'playing' || state.combatPopups === false) {
        el.style.display = 'none';
        return;
    }
    el.style.display = '';
    const tLeft = Math.max(0, state.comboTimer || 0);
    n.textContent = '×' + c + ' · ' + tLeft.toFixed(1) + 's';
}
function updateCombo(dt){
    if(state.combo > 0){
        state.comboTimer -= dt;
        if(state.comboTimer <= 0){
            state.combo = 0;
        }
    }
    syncComboChip();
}


loadGame();
try { updateHUD(); } catch (e) {}
try { updateHomeStats(); } catch (e) {}

