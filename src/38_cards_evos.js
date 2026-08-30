const CHOICE_UPGRADES = [
 {stat:'speed',    amount:10, icon:'⚡', text:'Overdrive',        desc:'Movement speed +10%'},
 {stat:'damage',   amount:15, icon:'💥', text:'Heavy Rounds',     desc:'Shell damage +15%'},
 {stat:'fireRate', amount:12, icon:'🔥', text:'Rapid Loader',     desc:'Fire rate +12%'},
 {stat:'maxHp',    amount:20, icon:'❤️', text:'Reinforced Hull',  desc:'Max HP +20, heal 20'},
 {stat:'regen',    amount:2,  icon:'🔄', text:'Nano Repair',      desc:'Regeneration +2/s'},
 {stat:'armor',    amount:8,  icon:'🛡️', text:'Composite Armor',  desc:'Armor +8 (less damage taken)'},
 {stat:'crit',     amount:10, icon:'🎯', text:'Deadeye Optics', desc:'Crit chance +10% — crits deal 2× damage'},
 {stat:'multishot',amount:1,  icon:'🔱', text:'Split Cannon',     desc:'+1 projectile per shot (stacks)'},
 {stat:'pierce',   amount:1,  icon:'🔩', text:'Piercing Rounds',  desc:'Shells punch through +1 enemy (stacks)'},
 {stat:'coinBonus',amount:25, icon:'🧲', text:'Scavenger',        desc:'+25% coins from kills'},
 {stat:'healOnKill',amount:3, icon:'💗', text:'Field Medic',      desc:'Heal 3 HP on every kill'},
 {stat:'xpBonus',  amount:20, icon:'🎖️', text:'Bounty Hunter',    desc:'+20% XP from kills'},
 {stat:'adrenaline',amount:1, icon:'💨', text:'Adrenaline Rush',   desc:'+25% speed and +5% damage for 60s after each kill (stacks)'},
 {stat:'missile',  amount:1,  icon:'🚀', text:'Missile Pod',       desc:'Auto-fires a homing missile every 5s (stacks: faster)'},
 {stat:'splash',   amount:1,  icon:'💥', text:'Shell Shock',       desc:'Shells splash-damage nearby enemies (stacks: wider)'},
 {stat:'shield',   amount:1,  icon:'🛡️', text:'Shield Generator',  desc:'Blocks one hit every 18s (stacks: faster recharge)'},
];

// HUD 23: boss-only Evolutions — appear in the 3-card pick when both recipe cards are owned this run
const EVOLUTIONS = [
 {evo:true, id:'cluster',     icon:'✴️', text:'Cluster Warheads', desc:'Missiles burst into 3 bomblets',           need:['missile','splash']},
 {evo:true, id:'bastion',     icon:'🏯', text:'Bastion Core',     desc:'Broken shield still soaks the next hit 25%', need:['armor','shield']},
 {evo:true, id:'prism',       icon:'🔷', text:'Prism Cannon',     desc:'Crits punch through +1 extra tank',         need:['pierce','crit']},
 {evo:true, id:'nanite',      icon:'🧬', text:'Nanite Harvest',   desc:'Kills heal +4 more HP',                     need:['regen','healOnKill']},
 {evo:true, id:'afterburner',   icon:'🚀', text:'Afterburner',      desc:'Kill haste lasts twice as long and runs hotter',       need:['speed','adrenaline']},
 {evo:true, id:'siege',       icon:'💣', text:'Siege Loader',     desc:'Every 4th volley is a heavy slug (+70%)',   need:['damage','fireRate']},
 // v1.9: remaining 6 evolutions — now fully offered and wired
 {evo:true, id:'overkill',    icon:'⚔️', text:'Overkill Array',   desc:'+20% dmg, +1 shell, auto-splash on hit',   need:['damage','multishot']},
 {evo:true, id:'tempestA',    icon:'⚡', text:'Tempest Autoloader',desc:'+18% fire rate and +10% crit chance',      need:['fireRate','crit']},
 {evo:true, id:'citadel',     icon:'🏯', text:'Citadel Core',     desc:'+25 HP, +8 armor, +1 HP/s regen',          need:['armor','maxHp']},
 {evo:true, id:'missileR',    icon:'🌧️', text:'Missile Rain',     desc:'Faster homing launches, wider blasts',     need:['missile','splash']},
 {evo:true, id:'phaseLance',  icon:'🔷', text:'Phase Lance',      desc:'+1 pierce, +15% dmg, +8% crit',            need:['pierce','crit']},
 {evo:true, id:'predator',    icon:'🐺', text:'Predator Engine',  desc:'+3 heal/kill, kill haste, +10% speed',     need:['healOnKill','adrenaline']},
];
// Q131: the count-based engine is canonical. The old gate tested mere PRESENCE
// (have.indexOf(stat) >= 0), so 1× Missile Pod + 1× Splash unlocked both Cluster Warheads
// and Missile Rain even though each recipe asks for TWO missiles (audit defect D-02).
// Eligibility is now derived from EVOLUTION_CARDS.requires{} via evolutionReady(), the
// same count-based source of truth that drives the pause-screen progress bars — one
// rule, one counter, no second opinion. EVOLUTIONS[].need is kept only as the
// presentation table (icon/text/desc) and is no longer consulted for unlocking.
function eligibleEvolutions(){
    const owned = state.evolutions || [];
    return EVOLUTION_CARDS.filter(function(card){
        if (owned.indexOf(card.id) >= 0) return false;
        return evolutionReady(card);
    }).map(function(card){
        // hand back the EVOLUTIONS record the offer UI expects, matched by id
        return EVOLUTIONS.find(function(ev){ return ev.id === card.id; }) || card;
    }).filter(Boolean);
}
// Q131: THIS is the single place a picked card is recorded, and therefore the single
// place the evolution counter is incremented. state.runCardsObj is the count-based
// source of truth that cardCountFor(), evolutionReady() and the pause progress bars all
// read from. Previously runCardsObj was declared, saved into snapshots and restored on
// resume but never incremented, so cardCountFor() was permanently 0 (audit defect D-02).
function noteRunCard(up){
    if (!up) return;
    state.runCards = state.runCards || [];
    state.runCardStats = state.runCardStats || [];
    state.runCardsObj = state.runCardsObj || {};
    state.evolutions = state.evolutions || [];

    const stat = up.stat || up.id;
    state.runCards.push({ stat: stat, icon: up.icon, text: up.text, evo: !!up.evo });

    if (up.evo) {
        if (ownedMissing(state.evolutions, up.id)) state.evolutions.push(up.id);
    } else if (up.stat) {
        state.runCardStats.push(up.stat);
        state.runCardsObj[stat] = (state.runCardsObj[stat] || 0) + 1;   // the one counter
    }
}
function ownedMissing(list, id){ return !list || list.indexOf(id) < 0; }
// v1.4: Stat name → label/desc lookup for pause kit
const _STAT_META = {
    speed:      { icon:'⚡', label:'Overdrive',       desc:'Movement speed +10% per stack' },
    damage:     { icon:'💥', label:'Heavy Rounds',    desc:'Shell damage +15% per stack' },
    fireRate:   { icon:'🔥', label:'Rapid Loader',    desc:'Fire rate +12% per stack' },
    maxHp:      { icon:'❤️', label:'Reinforced Hull', desc:'Max HP +20 per stack' },
    regen:      { icon:'🔄', label:'Nano Repair',     desc:'Regeneration +2 HP/s per stack' },
    armor:      { icon:'🛡️', label:'Composite Armor', desc:'Armor +8 per stack' },
    crit:       { icon:'🎯', label:'Deadeye Optics',  desc:'Crit chance +10% per stack' },
    multishot:  { icon:'🔱', label:'Split Cannon',    desc:'+1 projectile per stack' },
    pierce:     { icon:'🔩', label:'Piercing Rounds', desc:'+1 pierce per stack' },
    coinBonus:  { icon:'🧲', label:'Scavenger',       desc:'+25% coins per stack' },
    healOnKill: { icon:'💗', label:'Field Medic',     desc:'+3 HP on kill per stack' },
    xpBonus:    { icon:'🎖️', label:'Bounty Hunter',   desc:'+20% XP per stack' },
    adrenaline: { icon:'💨', label:'Adrenaline Rush', desc:'+25% speed and +5% damage per stack while hasted' },
    missile:    { icon:'🚀', label:'Missile Pod',     desc:'Homing missile every 5s per stack' },
    splash:     { icon:'💣', label:'Shell Shock',     desc:'Splash damage per stack' },
    shield:     { icon:'🛡', label:'Shield Generator',desc:'Block 1 hit per stack' },
};

function renderBuildList(){
    // ── Upgrade kit (deduplicated) ──────────────────────────────────
    const cards = state.runCards || [];
    const nonEvo = cards.filter(function(c){ return !c.evo; });

    // Count occurrences per stat
    const counts = {};
    const order = [];
    nonEvo.forEach(function(c){
        const k = c.stat || c.id || c.text;
        if (!counts[k]) { counts[k] = 0; order.push(k); }
        counts[k]++;
    });

    const pk = document.getElementById('pause-kit');
    if (pk) {
        if (order.length === 0) {
            pk.innerHTML = '<div class="pkit-row"><span class="pkit-name" style="color:#475569">No upgrades yet — go fight!</span></div>';
        } else {
            pk.innerHTML = order.map(function(k){
                const meta = _STAT_META[k] || { icon:'✦', label: k, desc:'' };
                const n = counts[k];
                return '<div class="pkit-row">' +
                    '<span class="pkit-icon">' + meta.icon + '</span>' +
                    '<span class="pkit-name">' + meta.label + '</span>' +
                    '<span class="pkit-desc">' + meta.desc + '</span>' +
                    '<span class="pkit-count">' + (n > 1 ? '×' + n : '×1') + '</span>' +
                    '</div>';
            }).join('');
        }
    }

    // ── Death screen (legacy flat list) ─────────────────────────────
    const dk = document.getElementById('death-kit');
    if (dk) {
        const html = cards.length
            ? cards.map(function(c){
                return '<span class="pb-chip' + (c.evo ? ' pb-evo' : '') + '">' + (c.icon || '') + ' ' + (c.text || '') + '</span>';
            }).join('')
            : '<span class="pb-chip">Stock hull — no cards yet</span>';
        dk.innerHTML = html;
    }

    // ── Evolution summary list in pause ─────────────────────────────
    renderEvoList();
}

// Stat display name for requirements
const _STAT_LABEL = {
    missile:'Missile Pod', splash:'Shell Shock', armor:'Composite Armor', shield:'Shield Generator',
    pierce:'Piercing Rds', multishot:'Split Cannon', regen:'Nano Repair', healOnKill:'Field Medic',
    speed:'Overdrive', adrenaline:'Adrenaline', damage:'Heavy Rounds', fireRate:'Rapid Loader',
    crit:'Deadeye', maxHp:'Hull Plate'
};

function renderEvoList(){
    const el = document.getElementById('pause-evo-list');
    if (!el) return;
    // Build list: use the 12-entry EVOLUTION_CARDS (requires-based) for progress
    const allEvoIds = (state.evolutions || []);
    // Gather all 12 evolutions
    const evoSrc = (typeof EVOLUTION_CARDS !== 'undefined') ? EVOLUTION_CARDS : [];
    // Fallback to EVOLUTIONS (6-entry need-based)
    const evoFallback = (typeof EVOLUTIONS !== 'undefined') ? EVOLUTIONS : [];
    const combined = evoSrc.length ? evoSrc : evoFallback;

    if (!combined.length) { el.innerHTML = '<div style="font-size:11px;color:#475569;padding:4px 10px">No evolution data</div>'; return; }

    el.innerHTML = combined.map(function(ev){
        const isActive = allEvoIds.indexOf(ev.id) >= 0;
        // Removed: a dead local here picked an evo-active / evo-partial / evo-locked class.
        // It was computed and then discarded — the template uses rowCls, worked out
        // separately below. It also had a live bug: it tested the evolutionProgress
        // *function* for truthiness, which is always true, so its locked branch was
        // unreachable. (B20 asserts this expression is gone from the shipped build.)

        // Progress fraction
        let prog = isActive ? '✓ ACTIVE' : '';
        if (!isActive && typeof evolutionProgress === 'function') {
            try { prog = evolutionProgress(ev); } catch(e) { prog = '?'; }
        }
        if (!isActive && prog === '0/0') prog = '—';

        const rowCls = isActive ? 'pevo-row evo-active' : (prog && prog !== '—' ? 'pevo-row evo-partial' : 'pevo-row evo-locked');
        // Q129: each row is the entry point to Yt01's detail page, so it carries the
        // evolution id for the delegated handler and announces itself as clickable.
        return '<div class="' + rowCls + '" data-evo="' + ev.id + '" role="button" tabindex="0">' +
            '<span class="pevo-icon">' + (ev.icon || '⚗') + '</span>' +
            '<span class="pevo-name">' + (ev.text || ev.id) + '</span>' +
            '<span class="pevo-prog">' + prog + '</span>' +
            '</div>';
    }).join('');

    // Q129: one delegated listener rather than twelve, wired once. Delegating also means
    // the rows stay clickable after every re-render without re-binding anything.
    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', function (e) {
            const row = e.target.closest ? e.target.closest('[data-evo]') : null;
            if (row) { try { openEvoDetail(row.getAttribute('data-evo')); } catch (err) {} }
        });
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const row = e.target.closest ? e.target.closest('[data-evo]') : null;
            if (row) { e.preventDefault(); try { openEvoDetail(row.getAttribute('data-evo')); } catch (err) {} }
        });
    }
}

function openEvoDetail(focusId){
    setScreenVisibility('evo-detail-screen', true);
    renderEvoDetailBody();
    // Q129: when opened from a specific pause row, mark and scroll to that evolution.
    state.evoDetailFocus = focusId || null;
    if (!focusId) return;
    const target = document.querySelector('[data-evo-detail="' + focusId + '"]');
    if (target) {
        target.classList.add('ec-focused');
        try { target.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
    }
}
function closeEvoDetail(){
    setScreenVisibility('evo-detail-screen', false);
}

function renderEvoDetailBody(){
    const el = document.getElementById('evo-detail-body');
    if (!el) return;
    const allEvoIds = (state.evolutions || []);
    const evoSrc = (typeof EVOLUTION_CARDS !== 'undefined') ? EVOLUTION_CARDS : [];
    const evoFallback = (typeof EVOLUTIONS !== 'undefined') ? EVOLUTIONS : [];
    const combined = evoSrc.length ? evoSrc : evoFallback;

    el.innerHTML = combined.map(function(ev){
        const isActive = allEvoIds.indexOf(ev.id) >= 0;

        // Build requirements display
        let reqsHtml = '';
        if (ev.requires) {
            reqsHtml = Object.entries(ev.requires).map(function(pair){
                const stat = pair[0], need = pair[1];
                const have = typeof cardCountFor === 'function' ? cardCountFor(stat) : 0;
                const met = have >= need;
                const partial = have > 0 && !met;
                const cls = isActive ? 'req-met' : (met ? 'req-met' : (partial ? 'req-partial' : 'req-unmet'));
                const lbl = _STAT_LABEL[stat] || stat;
                return '<span class="ec-req-chip ' + cls + '">' + lbl + ' ' + Math.min(have, need) + '/' + need + '</span>';
            }).join('');
        } else if (ev.need) {
            // Simple need array (EVOLUTIONS fallback)
            reqsHtml = ev.need.map(function(stat){
                const have = typeof cardCountFor === 'function' ? (state.runCardStats||[]).indexOf(stat) >= 0 ? 1 : 0 : 0;
                const met = have >= 1;
                const lbl = _STAT_LABEL[stat] || stat;
                return '<span class="ec-req-chip ' + (isActive || met ? 'req-met' : 'req-unmet') + '">' + lbl + ' ' + (met||isActive ? '1/1' : '0/1') + '</span>';
            }).join('');
        }

        // Bonuses
        let bonusHtml = '';
        if (ev.bonuses) {
            const parts = Object.entries(ev.bonuses).map(function(p){
                return (_STAT_LABEL[p[0]] || p[0]) + ' +' + p[1];
            });
            bonusHtml = '<div class="ec-bonuses">Grants: ' + parts.join(' · ') + '</div>';
        }

        const cardCls = isActive ? 'evo-card ec-active' : (reqsHtml.includes('req-partial') || reqsHtml.includes('req-met') ? 'evo-card ec-partial' : 'evo-card ec-locked');
        const badgeCls = isActive ? 'ec-badge badge-active' : (cardCls.includes('partial') ? 'ec-badge badge-partial' : 'ec-badge badge-locked');
        const badgeText = isActive ? '✓ ACTIVE' : (cardCls.includes('partial') ? 'IN PROGRESS' : 'LOCKED');

        // Q129: the id lets openEvoDetail() highlight whichever row opened this page.
        return '<div class="' + cardCls + '" data-evo-detail="' + ev.id + '">' +
            '<div class="ec-top">' +
                '<span class="ec-icon">' + (ev.icon || '⚗') + '</span>' +
                '<span class="ec-name">' + (ev.text || ev.id) + '</span>' +
                '<span class="' + badgeCls + '">' + badgeText + '</span>' +
            '</div>' +
            '<div class="ec-desc">' + (ev.desc || '') + '</div>' +
            '<div class="ec-reqs">' + reqsHtml + '</div>' +
            bonusHtml +
            '</div>';
    }).join('');
}
function kitBox(parent, w, h, d, x, y, z, mat, rx, ry, rz){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
}
function kitCyl(parent, rt, rb, h, x, y, z, mat, rx, ry, rz){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 8), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    parent.add(m);
    return m;
}
function syncPlayerTankParts(){
    if (!player || !player.mesh || !player.turretPivot) return;
    const ps = state.playerStats || {};
    if (player.kitHull) {
        try { player.mesh.remove(player.kitHull); disposeObject3D(player.kitHull); } catch (e) {}
        player.kitHull = null;
    }
    if (player.kitTurret) {
        try { player.turretPivot.remove(player.kitTurret); disposeObject3D(player.kitTurret); } catch (e) {}
        player.kitTurret = null;
    }
    const hull = new THREE.Group();
    const tur = new THREE.Group();
    player.kitHull = hull;
    player.kitTurret = tur;
    player.mesh.add(hull);
    player.turretPivot.add(tur);
    const steel = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.74, roughness: 0.36 });
    const dark  = new THREE.MeshStandardMaterial({ color: 0x2a3036, metalness: 0.62, roughness: 0.46 });
    const gold  = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.82, roughness: 0.28 });
    const cyan  = new THREE.MeshStandardMaterial({ color: 0x22d3ee, metalness: 0.7, roughness: 0.28, emissive: new THREE.Color(0x0e7490), emissiveIntensity: 0.35 });
    const green = new THREE.MeshStandardMaterial({ color: 0x4ade80, metalness: 0.42, roughness: 0.44, emissive: new THREE.Color(0x166534), emissiveIntensity: 0.32 });
    const red   = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.4, emissive: new THREE.Color(0x7f1d1d), emissiveIntensity: 0.28 });
    const purp  = new THREE.MeshStandardMaterial({ color: 0xa78bfa, metalness: 0.66, roughness: 0.3, emissive: new THREE.Color(0x5b21b6), emissiveIntensity: 0.3 });
    const orange= new THREE.MeshStandardMaterial({ color: 0xfb923c, metalness: 0.55, roughness: 0.4, emissive: new THREE.Color(0x9a3412), emissiveIntensity: 0.28 });
    if ((ps.armor || 0) > 0) {
        kitBox(hull, 0.18, 0.55, 3.2,  1.72, 0.95, 0.05, steel, 0, 0, 0.08);
        kitBox(hull, 0.18, 0.55, 3.2, -1.72, 0.95, 0.05, steel, 0, 0, -0.08);
    }
    if ((ps.maxHp || 100) > 100) {
        kitBox(hull, 2.15, 0.28, 0.55, 0, 1.05, 2.05, steel, -0.2, 0, 0);
    }
    if ((ps.speed || 100) > 100) {
        kitCyl(hull, 0.09, 0.12, 0.7,  0.38, 0.72, -2.05, dark, Math.PI / 2, 0, 0);
        kitCyl(hull, 0.09, 0.12, 0.7, -0.38, 0.72, -2.05, dark, Math.PI / 2, 0, 0);
    }
    if ((ps.regen || 0) > 0) {
        kitCyl(hull, 0.16, 0.16, 0.55, 0.55, 1.35, -1.35, green, 0, 0, 0);
        kitCyl(hull, 0.16, 0.16, 0.55, -0.55, 1.35, -1.35, green, 0, 0, 0);
    }
    if ((ps.coinBonus || 0) > 0) kitBox(hull, 0.55, 0.38, 0.45, 0, 1.35, -1.7, gold);
    if ((ps.healOnKill || 0) > 0) kitBox(hull, 0.42, 0.28, 0.32, 0.85, 1.38, -0.2, new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.2, roughness: 0.5 }));
    if ((ps.xpBonus || 0) > 0) kitBox(hull, 0.08, 0.7, 0.22, -0.15, 1.7, -1.55, gold);
    if ((ps.adrenaline || 0) > 0) {
        kitBox(hull, 0.12, 0.18, 2.4,  1.38, 1.18, 0, red);
        kitBox(hull, 0.12, 0.18, 2.4, -1.38, 1.18, 0, red);
    }
    if ((ps.fireRate || 100) > 100) kitBox(tur, 0.55, 0.32, 0.42, 0.95, 0.55, -0.15, dark);
    if ((ps.damage || 100) > 100) kitCyl(tur, 0.22, 0.2, 0.42, 0, 0.55, 2.55, dark, Math.PI / 2, 0, 0);
    if ((ps.crit || 0) > 0) kitCyl(tur, 0.08, 0.1, 0.55, 0.42, 1.05, 0.35, dark, Math.PI / 2, 0, 0.15);
    if ((ps.pierce || 0) > 0) kitCyl(tur, 0.14, 0.11, 0.32, 0, 0.55, 3.15, cyan, Math.PI / 2, 0, 0);
    // Q030: ONE barrel regardless of multishot count. Multishot is a spread stat, not a
    // second cannon. This loop used to add up to four extra barrels as multishot climbed,
    // which made a wide-spread build look like a different tank entirely and contradicted
    // the decision outright. Overkill Array (which really does add a shell) gets its own
    // distinct fitting below, so that one is still readable.
    //   const extraBarrels = Math.min(4, ps.multishot || 0);
    //   for (let i = 0; i < extraBarrels; i++) { ... kitCyl(tur, ...) }
    if ((ps.missile || 0) > 0) {
        kitBox(tur, 0.55, 0.22, 0.85, -0.95, 0.85, 0.15, orange);
        kitCyl(tur, 0.07, 0.07, 0.7, -1.08, 0.85, 0.2, orange, Math.PI / 2, 0, 0);
        kitCyl(tur, 0.07, 0.07, 0.7, -0.82, 0.85, 0.2, orange, Math.PI / 2, 0, 0);
    }
    if ((ps.splash || 0) > 0) {
        kitCyl(tur, 0.12, 0.12, 0.28, 0.72, 0.42, 0.55, orange, 0, 0, 0);
        kitCyl(tur, 0.12, 0.12, 0.28, 0.72, 0.42, 0.22, orange, 0, 0, 0);
    }
    if ((ps.shield || 0) > 0) kitBox(hull, 0.5, 0.32, 0.4, 0, 1.42, 0.15, cyan);
    if (ps.evo_cluster) {
        kitCyl(tur, 0.06, 0.06, 0.55, -0.95, 1.05, 0.55, orange, Math.PI / 2, 0, 0);
        kitCyl(tur, 0.06, 0.06, 0.55, -0.72, 1.05, 0.55, orange, Math.PI / 2, 0, 0);
        kitCyl(tur, 0.06, 0.06, 0.55, -1.18, 1.05, 0.55, orange, Math.PI / 2, 0, 0);
    }
    if (ps.evo_bastion) kitCyl(hull, 0.55, 0.72, 0.35, 0, 1.55, 0.1, steel, 0, 0, 0);
    if (ps.evo_prism) kitCyl(tur, 0.16, 0.05, 0.55, 0, 0.55, 3.45, cyan, Math.PI / 2, 0, 0);
    if (ps.evo_nanite) kitCyl(hull, 0.22, 0.22, 0.4, 0, 1.55, -0.9, green, 0, 0, 0);
    if (ps.evo_afterburner) {
        kitCyl(hull, 0.14, 0.2, 0.55,  0.55, 0.7, -2.2, red, Math.PI / 2, 0, 0);
        kitCyl(hull, 0.14, 0.2, 0.55, -0.55, 0.7, -2.2, red, Math.PI / 2, 0, 0);
    }
    if (ps.evo_siege)      kitBox(tur,  0.7,  0.38, 0.55,  0,     1.05, -0.35, steel);
    // v1.9: 6 new evolution visual parts
    if (ps.evo_overkill)   { kitCyl(tur, 0.07, 0.07, 0.6, -0.5, 1.05, 0.65, red, Math.PI/2, 0, 0);
                             kitCyl(tur, 0.07, 0.07, 0.6,  0.5, 1.05, 0.65, red, Math.PI/2, 0, 0); }
    if (ps.evo_tempestA)   kitCyl(tur,  0.04, 0.04, 0.7,  0,    1.05, 3.55, cyan, Math.PI/2, 0, 0);
    if (ps.evo_citadel)    { kitBox(hull, 0.6, 0.18, 0.55, 0, 1.68, 0, steel);
                             kitBox(hull, 0.18, 0.5, 0.18, 0.7, 1.3, 0, steel);
                             kitBox(hull, 0.18, 0.5, 0.18,-0.7, 1.3, 0, steel); }
    if (ps.evo_missileR)   { kitCyl(hull, 0.06, 0.06, 0.42, 0.85, 1.3,  0.35, orange, 0, 0, Math.PI/2);
                             kitCyl(hull, 0.06, 0.06, 0.42, 0.85, 1.05, 0.35, orange, 0, 0, Math.PI/2);
                             kitCyl(hull, 0.06, 0.06, 0.42,-0.85, 1.3,  0.35, orange, 0, 0, Math.PI/2); }
    if (ps.evo_phaseLance) kitCyl(tur,  0.20, 0.04, 0.65,  0,    0.5,  3.55, cyan, Math.PI/2, 0, 0);
    if (ps.evo_predator)   { kitCyl(hull, 0.12, 0.16, 0.5,  0.6, 0.7, -2.0, green, Math.PI/2, 0, 0);
                             kitCyl(hull, 0.12, 0.16, 0.5, -0.6, 0.7, -2.0, green, Math.PI/2, 0, 0); }
}

// combo logic
// Q119 / D-03: the duplicate addKillReward() and updateCombo() that used to live here
// have been removed. Two top-level function declarations with the same name meant the
// later one silently won, so these were dead code that read as if it were live. The
// surviving definitions are in 40_persist_polish.js:
//   addKillReward() — the single kill-payout chain (Q054)
//   updateCombo()   — combo decay plus the HUD chip sync

// FIX (Coins): the old enemies.push die-wrapper was dead code (startGame() reassigns
// the array before any enemy spawns, discarding the patch). Rewards are now wired
// directly at the kill site in updatePhysics.

// v4 (Upgrades-A): level-up choice overlay — gameplay freezes until a card is picked
function showUpgradeChoices(kind){
    state.isChoosingUpgrade = true;
    state.input.isFiring = false;
    try {

    const isBossLoot = kind === 'boss' || state.nextChoiceIsBoss;
    state.nextChoiceIsBoss = false;
    const pool = [...CHOICE_UPGRADES];
    // v1.1: evolutions guaranteed in Boss Vault; 50% chance at standard level-up if recipe satisfied
    const _eligible = eligibleEvolutions();
    const evoAvail = isBossLoot ? _eligible : ((_eligible.length && Math.random() < 0.5) ? _eligible : []);
    const cardCount = 3; // v27.5: always 3 cards, pick one
    const picks = [];
    if (evoAvail.length) picks.push(evoAvail[Math.floor(Math.random() * evoAvail.length)]);

    // v1.2: during the first 5 upgrades (non-boss), always include regen + healOnKill
    const _upgradesDone = (state.runCards || []).filter(c => !c.evo).length;
    if (!isBossLoot && _upgradesDone < 5) {
        const _ownedStats  = state.runCardStats || [];
        const _regenCard   = CHOICE_UPGRADES.find(c => c.stat === 'regen');
        const _hokCard     = CHOICE_UPGRADES.find(c => c.stat === 'healOnKill');
        // Fix8: only force-offer if the player doesn't already own that card
        const _needRegen   = !_ownedStats.includes('regen');
        const _needHok     = !_ownedStats.includes('healOnKill');
        if (_regenCard && _needRegen && !picks.find(p => p.stat === 'regen')) {
            picks.push(_regenCard);
            const _ri = pool.findIndex(c => c.stat === 'regen');
            if (_ri >= 0) pool.splice(_ri, 1);
        }
        if (_hokCard && _needHok && !picks.find(p => p.stat === 'healOnKill')) {
            picks.push(_hokCard);
            const _hi = pool.findIndex(c => c.stat === 'healOnKill');
            if (_hi >= 0) pool.splice(_hi, 1);
        }
    }

    while (picks.length < cardCount && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    for (let si = picks.length - 1; si > 0; si--) {
        const sj = Math.floor(Math.random() * (si + 1));
        const tmp = picks[si]; picks[si] = picks[sj]; picks[sj] = tmp;
    }

    const metaRR = isBossLoot ? 0 : ((state.meta || {}).cards || 0);
    const overlay = document.createElement('div');
    overlay.id = 'upgrade-choice';
    overlay.innerHTML = '<div class="uc-title">' + (isBossLoot ? '🏆 BOSS REWARD' : ('🌟 LEVEL ' + state.level)) + '</div>' +
                        '<div class="uc-subtitle">' + (isBossLoot ? (evoAvail.length ? 'Choose one bonus — Evolution ready' : 'Choose one bonus') : 'Choose an upgrade') + '</div>' +
                        '<div class="uc-cards"></div>';
    const cards = overlay.querySelector('.uc-cards');
    picks.forEach(up => {
        const card = document.createElement('button');
        card.className = 'uc-card' + (up.evo ? ' uc-evo' : '');
        card.innerHTML = '<div class="uc-icon">' + up.icon + '</div>' +
                          '<div class="uc-name">' + up.text + '</div>' +
                          (up.evo ? '<div class="uc-tag">EVOLUTION</div>' : '') +
                          '<div class="uc-desc">' + up.desc + '</div>';
        const pick = (ev) => { if (ev) { ev.preventDefault(); ev.stopPropagation(); } pickUpgradeCard(card, up, overlay, cards); };
        card.addEventListener('pointerup', pick);
        card.addEventListener('click', pick);
        cards.appendChild(card);
    });
    const rrLeft = (consumables().reroll || 0) + (state.runRerolls || 0) + (metaRR || 0);
    if (rrLeft > 0) {
        const rr = document.createElement('button');
        rr.className = 'uc-reroll';
        rr.textContent = '🎲 Reroll (' + rrLeft + ')';
        rr.onclick = () => {
            if ((state.runRerolls || 0) > 0) state.runRerolls--;
            else if ((consumables().reroll || 0) > 0) { consumables().reroll--; try { saveGame(); } catch (e) {} }
            playUISound();
            overlay.remove();
            state.isChoosingUpgrade = false;
            showUpgradeChoices(kind);
        };
        overlay.appendChild(rr);
    }
    document.body.appendChild(overlay);
    } catch (err) {
        try { console.error(err); } catch (e) {}
        state.isChoosingUpgrade = false; // v26.4: never freeze the run if cards fail to open
    }
}

function pickUpgradeCard(card, up, overlay, cards){
    if (overlay && overlay.dataset && overlay.dataset.picked) return;
    if (overlay && overlay.dataset) overlay.dataset.picked = '1';
    try { SFX.cardPick(); } catch (err) {}
    try { applyUpgrade(up); } catch (err) { try { console.error(err); } catch (e) {} }
    try { card.classList.add('picked'); [...cards.children].forEach(c => { if (c !== card) c.classList.add('dismissed'); }); } catch (err) {}
    const finish = () => {
        try { if (overlay && overlay.parentNode) overlay.remove(); } catch (err) {}
        if ((state.pendingChoices || 0) > 0) {
            state.pendingChoices--;
            showUpgradeChoices();
        } else {
            state.isChoosingUpgrade = false;
            try {
                const now = clock.getElapsedTime();
                state.lastFireTime = now;
                state.lastSpawnTime = now;
                state.lastRegenTime = now;
                maybeTransitionBiome();
            } catch (err) {}
        }
    };
    setTimeout(finish, 280);
}

function applyUpgrade(up){
    if (up && up.evo) {
        noteRunCard(up);
        state.playerStats['evo_' + up.id] = 1;
        // v1.9: apply stat bonuses from EVOLUTION_CARDS bonuses:{} if present
        try {
            const _ecSrc = (typeof EVOLUTION_CARDS !== 'undefined') ? EVOLUTION_CARDS : [];
            const _ec = _ecSrc.find(e => e.id === up.id);
            if (_ec && _ec.bonuses) {
                const _b = _ec.bonuses;
                if (_b.damage)    state.playerStats.damage    = (state.playerStats.damage    || 100) + _b.damage;
                if (_b.fireRate)  state.playerStats.fireRate  = (state.playerStats.fireRate  || 100) + _b.fireRate;
                if (_b.crit)      state.playerStats.crit      = (state.playerStats.crit      || 0)   + _b.crit;
                // Q016/Q017: an armour grant re-derives the pool and credits the growth
                if (_b.armor)     { state.playerStats.armor   = (state.playerStats.armor     || 0)   + _b.armor;
                                    recalcArmorPool(true); }
                if (_b.maxHp)     { state.playerStats.maxHp   = (state.playerStats.maxHp    || 100) + _b.maxHp;
                                    if (player) { player.maxHp = state.playerStats.maxHp; player.hp = Math.min(player.hp + _b.maxHp, player.maxHp); }
                                    recalcArmorPool(true); }   // Q016: pool is %-of-maxHp
                if (_b.regen)     state.playerStats.regen     = (state.playerStats.regen     || 0)   + _b.regen;
                if (_b.pierce)    state.playerStats.pierce    = (state.playerStats.pierce    || 0)   + _b.pierce;
                if (_b.multishot) state.playerStats.multishot = (state.playerStats.multishot || 0)   + _b.multishot;
                if (_b.splash)    state.playerStats.splash    = (state.playerStats.splash    || 0)   + _b.splash;
                if (_b.missile)   state.playerStats.missile   = (state.playerStats.missile   || 0)   + _b.missile;
                if (_b.healOnKill)state.playerStats.healOnKill= (state.playerStats.healOnKill|| 0)   + _b.healOnKill;
                if (_b.adrenaline)state.playerStats.adrenaline= (state.playerStats.adrenaline||0)    + _b.adrenaline;
                if (_b.speed)     state.playerStats.speed     = (state.playerStats.speed     || 100) + _b.speed;
            }
        } catch(e) {}
        try { syncPlayerTankParts(); } catch (e) {}
        try { renderBuildList(); } catch (e) {}
        updateHUD();
        try { showUpgradeNotification('⚡ EVOLUTION: ' + (up.text || up.id) + '!'); } catch (e) {}
        try { SFX.levelUp(); } catch (e) {}
        return;
    }
    if (up.stat === 'maxHp') {
        state.playerStats.maxHp += up.amount;
        if (player) {
            player.maxHp = state.playerStats.maxHp;
            player.hp = Math.min(player.hp + up.amount, player.maxHp);
        }
    } else if (up.stat === 'armor') {
        // Q016/Q017: an armour card grows the pool and the growth is credited immediately
        state.playerStats.armor += up.amount;
        recalcArmorPool(true);
    } else if (up.stat === 'maxHp') {
        state.playerStats.maxHp = (state.playerStats.maxHp || 100) + up.amount;
        recalcArmorPool(true);   // Q016: a bigger hull means a bigger pool
    } else {
        state.playerStats[up.stat] = (state.playerStats[up.stat] || 0) + up.amount;
    }
    noteRunCard(up);
    try { syncPlayerTankParts(); } catch (e) {}
    try { renderBuildList(); } catch (e) {}
    updateHUD();
}

// update loop hook
// FIX (Tier 1): the original wrapped a global `update` which never existed,
// throwing "ReferenceError: update is not defined" on every page load.
// updatePhysics is the real per-frame function called by animate().
