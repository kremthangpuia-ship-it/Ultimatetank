        const SHOP_ITEMS = [
            { id:'hp',     icon:'❤️', name:'Reinforced Chassis', desc:'+20 starting Max HP (per level)',  base:250,  growth:1.6, max:12 },
            { id:'dmg',    icon:'💥', name:'Machined Barrels',   desc:'+8% base damage (per level)',      base:300,  growth:1.6, max:12 },
            { id:'spd',    icon:'⚡', name:'Turbine Engine',     desc:'+6% base speed (per level)',       base:250,  growth:1.5, max:8 },
            { id:'armor',  icon:'🛡️', name:'Spacer Plating',     desc:'+4 starting armor (per level)',    base:350,  growth:1.5, max:6 },
            { id:'regen',  icon:'🔄', name:'Repair Kit',         desc:'+1 HP/s regen (per level)',        base:400,  growth:1.5, max:6 },
            // Q062/Q063: 'Second Wind' (the once-per-run auto-revive) is removed entirely.
            // Reviving is determined by coins at the death screen, so a purchasable
            // auto-revive was a second, competing answer to the same question.
            { id:'cards',  icon:'🃏', name:'Extra Choice',       desc:'+1 reroll each level-up (still pick only one card)', base:2500, growth:3.2, max:2 },
            // v26: endless coin sinks — these never max out
            { id:'dmg_inf', icon:'🔧', name:'Master Gunsmith',   desc:'+1% base damage (UNLIMITED — price rises fast)',   base:500, growth:1.34, max:Infinity },
            { id:'hp_inf',  icon:'🧱', name:'Reinforced Alloy',  desc:'+2 starting Max HP (UNLIMITED — price rises fast)', base:450, growth:1.32, max:Infinity },
            { id:'armor_inf', icon:'🪨', name:'Layered Plate',   desc:'+1 starting armor (UNLIMITED — price rises fast)',  base:600, growth:1.38, max:Infinity },
            { id:'regen_inf', icon:'💚', name:'Nano Forge',      desc:'+0.5 HP/s regen (UNLIMITED — price rises fast)',    base:700, growth:1.40, max:Infinity },
            { id:'fire_inf',  icon:'🔥', name:'Autoloader',      desc:'+2% fire rate (UNLIMITED — price rises fast)',      base:550, growth:1.36, max:Infinity },
            { id:'crit_inf',  icon:'🎯', name:'Lucky Optics',    desc:'+1% crit chance (UNLIMITED — price rises fast)',    base:650, growth:1.40, max:Infinity },
            { id:'optics_inf', icon:'🔭', name:'Precision Optics', desc:'+1% fire rate (UNLIMITED — steep)', base:480, growth:1.33, max:Infinity },
            { id:'door_inf',   icon:'🚪', name:'Blast Door',       desc:'+5 starting Max HP (UNLIMITED — steep)', base:520, growth:1.32, max:Infinity },
        ];

        // ============================================================
        // TANKTHILTETEYT — 12 EVOLUTION CARDS
        // ============================================================
        const EVOLUTION_CARDS = [
            // Q131: EVOLUTION_CARDS.requires{} is the SINGLE source of truth for unlocking.
            // Q134: this id is spelled with the full trailing "-er" everywhere in the build.
            //       A truncated spelling of it is what silently broke Yt01's tank part, so
            //       the release harness grep-enforces that only one spelling exists.
            // Q135: Title Case — ALL CAPS in a small card frame reads as shouting.
            // Q131: Missile Rain's recipe is de-duplicated. It used to be byte-identical to
            //       Cluster Warheads ({missile:2,splash:1}), so one hand could satisfy both.
            //       It is now 2 Missile + 1 Multishot, matching "rain = many launchers".
            {id:'cluster',    icon:'🎆', text:'Cluster Warheads',   requires:{missile:2,splash:1},      bonuses:{splash:1,missile:1},           desc:'Missiles bloom into 3 cluster bomblets.'},
            {id:'bastion',    icon:'🏰', text:'Bastion Core',       requires:{armor:2,shield:1},        bonuses:{armor:10,shield:1},            desc:'Depleted shield absorbs 25% of next hit for 2.8s.'},
            {id:'prism',      icon:'💎', text:'Prism Cannon',       requires:{pierce:2,multishot:1},    bonuses:{pierce:1,multishot:1},         desc:'Critical hits punch through +1 extra enemy.'},
            {id:'nanite',     icon:'🧬', text:'Nanite Harvest',     requires:{regen:2,healOnKill:1},    bonuses:{regen:1,healOnKill:3},         desc:'+4 HP on every kill.'},
            {id:'afterburner',icon:'🚀', text:'Afterburner',        requires:{speed:2,adrenaline:1},    bonuses:{speed:8,adrenaline:1},         desc:'Kill-haste lasts 3.0s, boosts speed.'},
            {id:'siege',      icon:'⛏️', text:'Siege Loader',       requires:{fireRate:2,damage:1},     bonuses:{fireRate:8,damage:10},         desc:'Every 4th shot fires a 1.7× siege slug.'},
            {id:'overkill',   icon:'⚔️', text:'Overkill Array',     requires:{damage:2,multishot:1},    bonuses:{damage:20,multishot:1,splash:1},desc:'+20% damage, +1 shell and explosive impact.'},
            {id:'tempestA',   icon:'⚡', text:'Tempest Autoloader', requires:{fireRate:2,crit:1},       bonuses:{fireRate:18,crit:10},          desc:'+18% fire rate and +10% critical chance.'},
            {id:'citadel',    icon:'🏯', text:'Citadel Core',       requires:{armor:2,maxHp:1},         bonuses:{armor:8,maxHp:25,regen:1},     desc:'+25 HP, +8 armor, +1 HP/s.'},
            {id:'missileR',   icon:'🌧️', text:'Missile Rain',       requires:{missile:2,multishot:1},   bonuses:{missile:1,splash:1},           desc:'Faster homing launches, wider blasts.'},
            {id:'phaseLance', icon:'🔷', text:'Phase Lance',        requires:{pierce:2,crit:1},         bonuses:{pierce:1,damage:15,crit:8},    desc:'+1 pierce, +15% damage, +8% crit.'},
            {id:'predator',   icon:'🐺', text:'Predator Engine',    requires:{healOnKill:2,adrenaline:1},bonuses:{healOnKill:3,adrenaline:1,speed:10},desc:'+3 heal/kill, +10% movement.'}
        ];
        const cardCountFor = stat => (state.runCardsObj && state.runCardsObj[stat]) || 0;
        function evolutionReady(e) { return !(state.evolutions||[]).includes(e.id) && Object.entries(e.requires).every(([k,n])=>cardCountFor(k)>=n); }
        function evolutionProgress(e) { const got=Object.entries(e.requires).reduce((a,[k,n])=>a+Math.min(n,cardCountFor(k)),0),total=Object.values(e.requires).reduce((a,n)=>a+n,0); return got+'/'+total; }

        const SKINS = [
            // v1.1: Hull Archetypes — each skin applies base stat deltas at run start
            { id:'amber',   name:'Amber Strike',  color:0xf59e0b, cost:0,     archetype:'Balanced',    arch:{ maxHp:0,  damage:0,   speed:0,   armor:0,  regen:0   }, archdesc:'Balanced stats — ideal starting hull.' },
            { id:'crimson', name:'Crimson Fang',  color:0xef4444, cost:2000,  archetype:'Striker',     arch:{ maxHp:-15,damage:25,  speed:10,  armor:0,  regen:0   }, archdesc:'+25% DMG, +10% SPD — fragile but lethal.' },
            { id:'emerald', name:'Emerald Guard', color:0x10b981, cost:3500,  archetype:'Juggernaut',  arch:{ maxHp:40, damage:0,   speed:-8,  armor:10, regen:1   }, archdesc:'+40 HP, +10 Armor, +1 Regen — slow tank.' },
            // Q125: this id was 'ice' in Yt01/Yt02 and 'glacier' in Yt03. Standardised on
            // 'glacier'; migrateSave() renames the old id in existing saves.
            { id:'glacier', name:'Glacier',       color:0x60a5fa, cost:5000,  archetype:'Recon',       arch:{ maxHp:-10,damage:-10, speed:20,  armor:0,  regen:2   }, archdesc:'+20% SPD, +2 Regen — kite and outlast.' },
            { id:'void',    name:'Void Walker',   color:0x8b5cf6, cost:7500,  archetype:'Tech',        arch:{ maxHp:0,  damage:15,  speed:0,   armor:0,  regen:0,  crit:10 }, archdesc:'+15% DMG, +10% Crit — crit build synergy.' },
            { id:'gold',    name:'24k Commander', color:0xfcd34d, cost:12000, archetype:'Sovereign',   arch:{ maxHp:25, damage:10,  speed:5,   armor:5,  regen:1   }, archdesc:'+25 HP, +10 DMG, +5 Armor — all-around elite.' },
        ];
        // Q062/Q116: the Workshop tree, ported from Yt03. These ranks are deliberately
        // small and cheap next to the Armory's big steps, so the two shops complement
        // rather than duplicate each other: the Armory is "get substantially stronger",
        // the Workshop is "shave the edges and unlock a perk".
        const TECH_TREE = [
            { id: 'armor',  name: 'Reinforced Hull Armor', icon: '🛡️', maxLevel: 5, baseCost: 150, stepCost: 150, desc: '+2 Armor per rank' },
            { id: 'speed',  name: 'Turbocharger Unit',     icon: '⚡', maxLevel: 5, baseCost: 150, stepCost: 150, desc: '+2% Movement speed per rank' },
            { id: 'shield', name: 'Auxiliary Shield Gen',  icon: '🌐', maxLevel: 1, baseCost: 600, stepCost: 0,   desc: 'Start every run with 1 active Shield' },
            { id: 'reroll', name: 'Tactical Reroll Cache', icon: '🎲', maxLevel: 3, baseCost: 250, stepCost: 200, desc: '+1 Free card reroll per rank every run' },
            { id: 'damage', name: 'High-Caliber Breach',   icon: '💥', maxLevel: 5, baseCost: 150, stepCost: 150, desc: '+2% Base shell damage per rank' }
        ];

        const CONSUMABLES = [ // v27: next-run boosts — unlimited, each extra copy costs more
            { id:'lucky',     icon:'🍀', name:'Lucky Charm',  desc:'+20% coins next run',                 base:400, cycle:true },
            { id:'headstart', icon:'🚀', name:'Head Start',   desc:'Next run starts with +1 free card',   base:550, cycle:true },
            { id:'reroll',    icon:'🎲', name:'Card Reroll',  desc:'Reroll a level-up hand (next run)',   base:700, cycle:true },
            { id:'overcharge',icon:'⚡', name:'Overcharge',   desc:'Next run: +30% damage for 60s',       base:600, cycle:true },
            { id:'aegis',     icon:'🛡️', name:'Aegis Kit',    desc:'Next run: start with a charged shield', base:600, cycle:true },
        ];
        const consumables = () => state.consumables || (state.consumables = { lucky: 0, headstart: 0, reroll: 0, overcharge: 0, aegis: 0 });
        // Q064: consumables price in a repeating cycle; Armory items keep their original
        // per-purchase growth, since those are permanent and meant to plateau.
        const shopCost = (item) => {
            if (item.cycle) {
                const owned = consumables()[item.id] || 0;
                const pos = owned % CONFIG.consumables.cycleLength;
                return Math.round(item.base * Math.pow(CONFIG.consumables.priceMultPerStep, pos));
            }
            return Math.round(item.base * Math.pow(item.growth || 1.5, ((state.meta || {})[item.id] || 0)));
        };
        function applyMetaDelta(stats, toMeta, fromMeta) { // v27.2: Armory bought on the death screen must hit Field Revive
            const t = toMeta || {}, f = fromMeta || {};
            const d = (id) => (t[id] || 0) - (f[id] || 0);
            stats.maxHp += d('hp') * 20 + d('hp_inf') * 2 + d('door_inf') * 5;
            stats.damage += d('dmg') * 8 + d('dmg_inf') * 1;
            stats.speed += d('spd') * 6;
            stats.armor += d('armor') * 4 + d('armor_inf') * 1;
            stats.regen += d('regen') * 1 + d('regen_inf') * 0.5;
            stats.fireRate += d('fire_inf') * 2 + d('optics_inf') * 1;
            stats.crit += d('crit_inf') * 1;
        }
        const skinState = () => state.skins || (state.skins = { owned: ['amber'], selected: 'amber' });
        const selectedSkinColor = () => { const s = SKINS.find(k => k.id === skinState().selected); return s ? s.color : 0xf59e0b; };

        let _menuTank = null;
        let menuArmorTexture = null;
        let menuTankPreview = null;
        function getMenuArmorTexture() {
            if (menuArmorTexture) return menuArmorTexture;
            const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
            x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, 96, 96);
            const g = x.createLinearGradient(0, 0, 96, 96);
            g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(.5, 'rgba(80,80,80,.18)'); g.addColorStop(1, 'rgba(255,255,255,.08)');
            x.fillStyle = g; x.fillRect(0, 0, 96, 96);
            for (let i = 0; i < 80; i++) {
                const v = 120 + Math.random() * 90;
                x.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.05 + Math.random() * 0.13) + ')';
                x.lineWidth = Math.random() < 0.8 ? 1 : 2;
                x.beginPath();
                const y = Math.random() * 96;
                x.moveTo(Math.random() * 72, y);
                x.lineTo(55 + Math.random() * 41, y + (Math.random() - 0.5) * 3);
                x.stroke();
            }
            x.strokeStyle = 'rgba(45,45,45,.35)'; x.lineWidth = 2; x.strokeRect(4, 4, 88, 88);
            x.fillStyle = 'rgba(255,255,255,.28)';
            [[9, 9], [87, 9], [9, 87], [87, 87]].forEach(function (pt) { x.beginPath(); x.arc(pt[0], pt[1], 2, 0, Math.PI * 2); x.fill(); });
            menuArmorTexture = new THREE.CanvasTexture(c);
            menuArmorTexture.wrapS = menuArmorTexture.wrapT = THREE.RepeatWrapping;
            menuArmorTexture.repeat.set(1.4, 1.8);
            if (THREE.sRGBEncoding) menuArmorTexture.encoding = THREE.sRGBEncoding;
            return menuArmorTexture;
        }
        function buildShowcaseTank(color) {
            const root = new THREE.Group();
            const main = new THREE.Color(color);
            const militaryTone = { h: 0, s: 0, l: 0 };
            main.getHSL(militaryTone);
            main.setHSL(militaryTone.h, Math.min(0.58, militaryTone.s * 0.65), Math.max(0.3, Math.min(0.47, militaryTone.l * 0.72)));
            const dark = main.clone().multiplyScalar(0.48);
            const armorTex = getMenuArmorTexture();
            const Phys = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
            const bodyMat = new Phys({ color: main, bumpMap: armorTex, bumpScale: 0.018, roughness: 0.64, metalness: 0.3, clearcoat: 0.06, clearcoatRoughness: 0.82 });
            const darkMat = new THREE.MeshStandardMaterial({ color: dark, bumpMap: armorTex, bumpScale: 0.014, roughness: 0.7, metalness: 0.34 });
            const edgeMat = new THREE.MeshStandardMaterial({ color: 0x343b3f, roughness: 0.48, metalness: 0.68 });
            const trackMat = new THREE.MeshStandardMaterial({ color: 0x111518, roughness: 0.82, metalness: 0.55 });
            const rubberMat = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.92, metalness: 0.12 });
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3f484e, roughness: 0.48, metalness: 0.8 });
            const gunMat = new THREE.MeshStandardMaterial({ color: 0x343b40, roughness: 0.27, metalness: 0.9 });
            const add = function (parent, geo, mat, x, y, z, rx, ry, rz) {
                const m = new THREE.Mesh(geo, mat);
                m.position.set(x, y, z);
                m.rotation.set(rx || 0, ry || 0, rz || 0);
                m.castShadow = true; m.receiveShadow = true;
                parent.add(m); return m;
            };
            const frustum = function (wb, db, wt, dt, h, topZ) {
                topZ = topZ || 0;
                const v = [-wb/2,0,-db/2, wb/2,0,-db/2, wb/2,0,db/2, -wb/2,0,db/2, -wt/2,h,-dt/2+topZ, wt/2,h,-dt/2+topZ, wt/2,h,dt/2+topZ, -wt/2,h,dt/2+topZ];
                const i = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
                g.setIndex(i); g.computeVertexNormals(); return g;
            };
            add(root, frustum(3.25, 4.55, 2.72, 3.86, 0.82, 0.08), bodyMat, 0, 0.28, 0);
            add(root, frustum(2.7, 3.55, 2.15, 2.72, 0.5, -0.16), bodyMat, 0, 1.08, -0.02);
            add(root, new THREE.BoxGeometry(2.18, 0.18, 1.22), darkMat, 0, 1.52, -1.18);
            add(root, new THREE.BoxGeometry(0.46, 0.11, 3.82), darkMat, -1.5, 1.08, -0.03);
            add(root, new THREE.BoxGeometry(0.46, 0.11, 3.82), darkMat, 1.5, 1.08, -0.03);
            add(root, new THREE.BoxGeometry(2.45, 0.13, 0.92), darkMat, 0, 0.94, 1.77, -0.42);
            [-0.83, 0.83].forEach(function (x) { add(root, new THREE.TorusGeometry(0.16, 0.045, 7, 14, Math.PI * 1.55), edgeMat, x, 0.54, 2.22); });
            [-1, 1].forEach(function (side) {
                const sx = side * 1.63;
                add(root, new THREE.BoxGeometry(0.54, 0.72, 4.38), trackMat, sx, 0.58, 0);
                add(root, new THREE.BoxGeometry(0.62, 0.13, 4.24), trackMat, sx, 1.03, 0);
                add(root, new THREE.BoxGeometry(0.62, 0.13, 4.16), trackMat, sx, 0.13, 0);
                for (let n = 0; n < 6; n++) {
                    const z = -1.72 + n * 0.69, r = (n === 0 || n === 5) ? 0.43 : 0.36;
                    add(root, new THREE.CylinderGeometry(r, r, 0.25, 20), rubberMat, sx, 0.55, z, 0, 0, Math.PI / 2);
                    add(root, new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.27, 16), wheelMat, sx, 0.55, z, 0, 0, Math.PI / 2);
                    add(root, new THREE.CylinderGeometry(0.09, 0.09, 0.29, 12), edgeMat, sx, 0.55, z, 0, 0, Math.PI / 2);
                }
                for (let n = 0; n < 11; n++) {
                    const z = -1.98 + n * 0.395;
                    add(root, new THREE.BoxGeometry(0.68, 0.12, 0.30), trackMat, sx, 1.12, z);
                    add(root, new THREE.BoxGeometry(0.68, 0.12, 0.30), trackMat, sx, 0.04, z);
                }
                [-2.12, 2.12].forEach(function (z) {
                    for (let n = 0; n < 3; n++) add(root, new THREE.BoxGeometry(0.68, 0.12, 0.3), trackMat, sx, 0.28 + n * 0.27, z, 0, 0, z < 0 ? -0.18 : 0.18);
                });
                for (let n = 0; n < 4; n++) add(root, new THREE.BoxGeometry(0.1, 0.47, 0.82), bodyMat, side * 1.94, 0.89, -1.28 + n * 0.86, 0, 0, side * 0.025);
            });
            const turretPivot = new THREE.Group();
            turretPivot.name = 'turretPivot';
            turretPivot.position.y = 1.48;
            root.add(turretPivot);
            add(turretPivot, new THREE.CylinderGeometry(1.03, 1.08, 0.24, 32), edgeMat, 0, 0.06, 0);
            const turretShell = add(turretPivot, new THREE.CylinderGeometry(0.92, 1.14, 0.68, 10), bodyMat, 0, 0.5, -0.03);
            turretShell.scale.z = 1.24;
            add(turretPivot, new THREE.BoxGeometry(1.42, 0.42, 0.78), bodyMat, 0, 0.5, -1.05);
            add(turretPivot, new THREE.BoxGeometry(0.62, 0.5, 0.74), bodyMat, -0.67, 0.48, 0.55, 0, -0.16, 0);
            add(turretPivot, new THREE.BoxGeometry(0.62, 0.5, 0.74), bodyMat, 0.67, 0.48, 0.55, 0, 0.16, 0);
            const mantlet = add(turretPivot, new THREE.SphereGeometry(0.52, 20, 12), darkMat, 0, 0.56, 1.13);
            mantlet.scale.set(1.16, 0.82, 0.52);
            add(turretPivot, new THREE.CylinderGeometry(0.15, 0.19, 3.35, 16), gunMat, 0, 0.57, 2.83, Math.PI / 2);
            add(turretPivot, new THREE.CylinderGeometry(0.23, 0.19, 0.48, 12), gunMat, 0, 0.57, 4.73, Math.PI / 2);
            add(turretPivot, new THREE.BoxGeometry(0.42, 0.08, 0.24), edgeMat, 0, 0.57, 4.78);
            add(turretPivot, new THREE.CylinderGeometry(0.34, 0.39, 0.22, 16), darkMat, -0.42, 1.0, -0.25);
            const hatch = add(turretPivot, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 16), edgeMat, -0.42, 1.15, -0.25);
            hatch.rotation.z = -0.1;
            const opticMat = new THREE.MeshStandardMaterial({ color: 0x112a31, emissive: 0x1e9eb7, emissiveIntensity: 0.42, roughness: 0.2, metalness: 0.55 });
            add(turretPivot, new THREE.BoxGeometry(0.24, 0.28, 0.27), opticMat, 0.48, 0.89, 0.44);
            [-1, 1].forEach(function (side) {
                for (let n = 0; n < 3; n++) add(turretPivot, new THREE.CylinderGeometry(0.055, 0.075, 0.42, 8), gunMat, side * 0.92, 0.58, 0.22 + n * 0.19, 0, 0, side * 0.72);
            });
            add(turretPivot, new THREE.CylinderGeometry(0.018, 0.018, 1.48, 6), gunMat, -0.63, 1.7, -0.55, 0, 0, 0.12);
            const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1bd, emissive: 0xffb52e, emissiveIntensity: 1.75, roughness: 0.16 });
            [-0.76, 0.76].forEach(function (x) {
                add(root, new THREE.CylinderGeometry(0.17, 0.17, 0.11, 16), edgeMat, x, 0.84, 2.12, Math.PI / 2);
                add(root, new THREE.CircleGeometry(0.13, 16), lampMat, x, 0.84, 2.19);
            });
            for (let n = -2; n <= 2; n++) add(root, new THREE.BoxGeometry(0.3, 0.065, 0.88), trackMat, n * 0.39, 1.66, -1.2);
            [-0.72, 0.72].forEach(function (x) { add(root, new THREE.CylinderGeometry(0.14, 0.18, 0.66, 12), gunMat, x, 0.73, -2.13, Math.PI / 2); });
            [-1, 1].forEach(function (side) {
                for (let n = 0; n < 5; n++) add(root, new THREE.SphereGeometry(0.035, 7, 5), edgeMat, side * 1.37, 1.19, -1.42 + n * 0.72);
            });
            root.userData.bodyMat = bodyMat;
            root.userData.darkMat = darkMat;
            root.userData.turret = turretPivot;
            return root;
        }
        function tintShowcaseTank(color) {
            const tank = (_menuTank && _menuTank.mesh) || (menuTankPreview && menuTankPreview.tank);
            if (!tank || !tank.userData) return;
            const c = new THREE.Color(color);
            const tone = { h: 0, s: 0, l: 0 };
            c.getHSL(tone);
            c.setHSL(tone.h, Math.min(0.58, tone.s * 0.65), Math.max(0.3, Math.min(0.47, tone.l * 0.72)));
            if (tank.userData.bodyMat) tank.userData.bodyMat.color.copy(c);
            if (tank.userData.darkMat) tank.userData.darkMat.color.copy(c.clone().multiplyScalar(0.48));
        }
        function menuTankVisible() {
            const start = document.getElementById('start-screen');
            const pause = document.getElementById('pause-screen');
            return !!(start && !start.classList.contains('hidden')) || !!(pause && !pause.classList.contains('hidden'));
        }
        function syncMenuTankPreview() {
            const preview = menuTankPreview || _menuTank;
            if (!preview) return;
            const canvas = preview.canvas || document.getElementById('menu-tank-view');
            if (!canvas) return;
            const start = document.getElementById('start-screen');
            const home = document.querySelector('#start-screen .tank-mark');
            const pauseBox = document.querySelector('#pause-screen .pause-tank-mark');
            if (start && !start.classList.contains('hidden') && home) home.appendChild(canvas);
            else if (pauseBox && !document.getElementById('pause-screen').classList.contains('hidden')) pauseBox.appendChild(canvas);
            tintShowcaseTank(selectedSkinColor());
        }
        function startMenuTankPreview() {
            if (menuTankPreview || _menuTank || typeof THREE === 'undefined') return;
            const canvas = document.getElementById('menu-tank-view');
            if (!canvas) return;
            try {
                const studio = new THREE.Scene();
                studio.background = null;
                studio.fog = new THREE.Fog(0x080d11, 11, 26);
                const cam = new THREE.PerspectiveCamera(35, 340 / 200, 0.1, 60);
                cam.position.set(8.1, 5.15, 9.45);
                cam.lookAt(0, 1.02, 0.12);
                const previewRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
                previewRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
                previewRenderer.setSize(340, 200, false);
                previewRenderer.setClearColor(0x000000, 0);
                previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
                previewRenderer.toneMappingExposure = 0.92;
                if (THREE.sRGBEncoding) previewRenderer.outputEncoding = THREE.sRGBEncoding;
                previewRenderer.shadowMap.enabled = true;
                previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
                studio.add(new THREE.HemisphereLight(0xaec9d6, 0x17100b, 0.52));
                const key = new THREE.DirectionalLight(0xffdda0, 1.28);
                key.position.set(5, 10, 7); key.castShadow = true; key.shadow.mapSize.set(512, 512); studio.add(key);
                const rim = new THREE.DirectionalLight(0x45d7ff, 0.56);
                rim.position.set(-7, 5, -5); studio.add(rim);
                const topSpot = new THREE.SpotLight(0xffd27a, 1.25, 24, Math.PI / 6, 0.55, 1.4);
                topSpot.position.set(0, 10, 1);
                topSpot.target.position.set(0, 0, 0);
                topSpot.castShadow = true;
                studio.add(topSpot); studio.add(topSpot.target);
                const trimMat = new THREE.MeshStandardMaterial({ color: 0x303a42, roughness: 0.46, metalness: 0.82 });
                const mkScreen = function (x, y, w, h, color) {
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.18), trimMat);
                    frame.position.set(x, y, -5.24); studio.add(frame);
                    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 }));
                    scr.position.set(x, y, -5.13); studio.add(scr);
                };
                mkScreen(-3.4, 3.6, 2.5, 1.25, 0x164f62);
                mkScreen(0, 4.1, 2.8, 1.4, 0x705321);
                mkScreen(3.4, 3.6, 2.5, 1.25, 0x164f62);
                [-4.8, -2.2, 2.2, 4.8].forEach(function (x) {
                    const lamp = new THREE.PointLight(0x42d9ff, 0.32, 6);
                    lamp.position.set(x, 3.4, -4.6); studio.add(lamp);
                });
                const platform = new THREE.Group();
                const p0 = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.5, 0.45, 64), new THREE.MeshStandardMaterial({ color: 0x171c20, roughness: 0.5, metalness: 0.86 }));
                p0.position.y = -0.38; p0.receiveShadow = true; platform.add(p0);
                const p1 = new THREE.Mesh(new THREE.CylinderGeometry(3.72, 3.95, 0.26, 64), new THREE.MeshStandardMaterial({ color: 0x414a50, roughness: 0.38, metalness: 0.9 }));
                p1.position.y = -0.12; p1.receiveShadow = true; platform.add(p1);
                const p2 = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.5, 0.13, 64), new THREE.MeshStandardMaterial({ color: 0x1d2428, roughness: 0.42, metalness: 0.85, emissive: 0x2b210e, emissiveIntensity: 0.28 }));
                p2.position.y = 0.06; platform.add(p2);
                const serviceRing = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.075, 10, 64), new THREE.MeshBasicMaterial({ color: 0xc8a86b }));
                serviceRing.rotation.x = Math.PI / 2; serviceRing.position.y = 0.08; platform.add(serviceRing);
                studio.add(platform);
                const tank = buildShowcaseTank(selectedSkinColor());
                const spinner = new THREE.Group();
                tank.position.z = -1.05;
                tank.scale.setScalar(1.04);
                spinner.rotation.y = 0.48;
                spinner.add(tank);
                studio.add(spinner);
                menuTankPreview = { studio: studio, cam: cam, renderer: previewRenderer, tank: tank, spinner: spinner, platform: platform, canvas: canvas, color: selectedSkinColor(), last: performance.now() };
                _menuTank = { renderer: previewRenderer, scene: studio, camera: cam, mesh: tank, canvas: canvas, raf: 1 };
                const frame = function (now) {
                    if (!menuTankPreview) return;
                    requestAnimationFrame(frame);
                    if (!menuTankVisible()) return;
                    const p = menuTankPreview;
                    const dt = Math.min(0.04, (now - p.last) / 1000);
                    p.last = now;
                    const cw = Math.max(1, Math.round(canvas.clientWidth));
                    const ch = Math.max(1, Math.round(canvas.clientHeight));
                    if (cw !== p.cssW || ch !== p.cssH) {
                        p.cssW = cw; p.cssH = ch;
                        p.cam.aspect = cw / ch; p.cam.updateProjectionMatrix();
                        p.renderer.setSize(cw, ch, false);
                    }
                    const chosen = selectedSkinColor();
                    if (chosen !== p.color) { p.color = chosen; tintShowcaseTank(chosen); }
                    // v1.1: only auto-spin when not being dragged
                    if (p._autoSpin !== false) p.spinner.rotation.y += dt * 0.28;
                    else if (!p._dragActive && p._dragVel) p.spinner.rotation.y += p._dragVel;
                    if (p.platform) p.platform.rotation.y -= dt * 0.045;
                    if (p.tank.userData.turret) p.tank.userData.turret.rotation.y = Math.sin(now * 0.00055) * 0.2;
                    p.spinner.position.y = 0;
                    p.renderer.render(p.studio, p.cam);
                };
                requestAnimationFrame(frame);
                // v1.1: drag-to-spin — pointer drag rotates the tank
                let _mtDragActive = false, _mtLastX = 0, _mtVel = 0;
                let _mtAutoSpin = true;
                canvas.addEventListener('pointerdown', (ev) => {
                    _mtDragActive = true; _mtLastX = ev.clientX; _mtVel = 0;
                    _mtAutoSpin = false;
                    canvas.setPointerCapture(ev.pointerId);
                    canvas.style.cursor = 'grabbing';
                });
                canvas.addEventListener('pointermove', (ev) => {
                    if (!_mtDragActive || !menuTankPreview) return;
                    const dx = ev.clientX - _mtLastX;
                    _mtLastX = ev.clientX;
                    _mtVel = dx * 0.014;
                    menuTankPreview.spinner.rotation.y += _mtVel;
                });
                canvas.addEventListener('pointerup', () => {
                    _mtDragActive = false;
                    canvas.style.cursor = 'grab';
                    // Resume auto-spin after 3s of no drag
                    setTimeout(() => { _mtAutoSpin = true; }, 3000);
                });
                canvas.addEventListener('pointercancel', () => { _mtDragActive = false; });
                // Patch the frame loop to respect drag override
                const _origSpinnerUpdate = () => {};
                const _framePatch = setInterval(() => {
                    if (!menuTankPreview) { clearInterval(_framePatch); return; }
                    menuTankPreview._dragActive = _mtDragActive;
                    menuTankPreview._autoSpin = _mtAutoSpin;
                    menuTankPreview._dragVel = _mtVel;
                    _mtVel *= 0.88; // inertia decay
                }, 16);
                syncMenuTankPreview();
            } catch (err) {
                try { canvas.style.display = 'none'; } catch (e) {}
            }
        }

        // ============================================
        // v23: LIFETIME STATS + ACHIEVEMENTS
        // Q066: the daily-challenge system is removed outright. It was a no-op stub in
        // all three legacy builds (bumpDaily did nothing), and the decision is to drop
        // it rather than finish it, so both the stub and its 8 call sites are gone.
        // ============================================
        const ACHIEVEMENTS = [
            { id:'firstBlood', icon:'🩸', name:'First Blood',      desc:'Destroy your first enemy tank', goal:1,    stat:'kills',      reward:100 },
            { id:'exterminator', icon:'💀', name:'Exterminator',   desc:'Destroy 500 enemy tanks',        goal:500,  stat:'kills',      reward:1000 },
            { id:'bossSlayer', icon:'👑', name:'Boss Slayer',      desc:'Defeat your first boss',         goal:1,    stat:'bossKills',  reward:300 },
            { id:'realmWarlord', icon:'⚔️', name:'Realm Warlord', desc:'Defeat 10 bosses',               goal:10,   stat:'bossKills',  reward:1500 },
            { id:'critMachine', icon:'🎯', name:'Crit Machine',    desc:'Land 100 critical hits',         goal:100,  stat:'crits',      reward:500 },
            { id:'demolition', icon:'🪓', name:'Demolition Crew', desc:'Destroy 100 trees & rocks',      goal:100,  stat:'destroyed',  reward:500 },
            { id:'explorer', icon:'🧭', name:'Explorer',           desc:'Travel 5,000 units total',       goal:5000, stat:'distance',   reward:750 },
            { id:'rich', icon:'💰', name:"Warmonger Wealth",    desc:'Earn 25,000 coins (lifetime)',   goal:25000, stat:'coinsEarned', reward:1000 },
            { id:'lvl20', icon:'🌟', name:'Veteran',               desc:'Reach level 20 in a run',        goal:20,   stat:'maxLevel',   reward:800 },
            { id:'lvl30', icon:'🔥', name:'Legend',                desc:'Reach level 30 in a run',        goal:30,   stat:'maxLevel',   reward:1500 },
            { id:'comboKing', icon:'⛓️', name:'Combo King',        desc:'Reach a ×8 kill combo',          goal:8,    stat:'maxCombo',   reward:400 },
            { id:'survivor', icon:'⏱️', name:'Survivor',           desc:'Play 15 minutes total',          goal:900,  stat:'playTime',   reward:600 },
            { id:'nightHunter', icon:'😈', name:'Nightmare Hunter',desc:'Defeat a boss on Nightmare',     goal:1,    stat:'bossNightmare', reward:1000 },
            { id:'collector', icon:'🎨', name:'Collector',         desc:'Own 3 tank skins',               goal:3,    stat:'skins',      reward:600 },
        ];
        const lifeStats = () => state.stats || (state.stats = { kills:0, bossKills:0, crits:0, destroyed:0, distance:0, coinsEarned:0, maxLevel:1, maxCombo:0, playTime:0, bossNightmare:0, skins:1, runs:0 });
        const dailyState = () => ({ date: '', picks: [], progress: {}, done: [] }); // v26.9: dailies removed
        // v25: first-run tutorial tips — contextual, once each, persisted
        function tutorialTip(id, text, ms) {
            if ((state.tutorialTips || {})[id]) return;
            state.tutorialTips = state.tutorialTips || {};
            state.tutorialTips[id] = true;
            try { saveGame(); } catch (e) {}
            const el = document.createElement('div');
            el.className = 'game-toast';
            el.style.animation = 'toastIn 0.3s ease, toastOut 0.4s ease ' + ((ms || 7000) / 1000) + 's forwards';
            el.innerHTML = text;
            document.getElementById('toast-stack').appendChild(el);
            setTimeout(() => el.remove(), ms || 7000);
        }
        function tutorialTick() { // fires contextual tips on a fresh save (first run)
            if ((lifeStats().runs || 0) > 1) return;
            tutorialTip('move', '🕹️ <b>Drag the LEFT half</b> of the screen to drive', 8000);
            tutorialTip('fire', '🔥 <b>Touch &amp; hold the RIGHT half</b> — your cannon auto-aims', 8000);
            if (state.level >= 2) tutorialTip('cards', '🃏 <b>Level up!</b> Pick a card — each makes you stronger', 6000);
            if (state.bossActive && !state.bossActive.isDead) tutorialTip('boss', '👑 <b>BOSS!</b> Use trees as cover — they block shells', 6000);
            if (player.hp < player.maxHp * 0.3) tutorialTip('lowhp', '❤️ <b>Low health!</b> Break line of sight behind rocks', 6000);
        }
        function gameToast(html) { // v23: stacked toasts (achievements, dailies)
            const stack = document.getElementById('toast-stack');
            if (!stack) return;
            const el = document.createElement('div');
            el.className = 'game-toast';
            el.innerHTML = html;
            stack.appendChild(el);
            while (stack.children.length > 3) stack.removeChild(stack.firstChild);
            setTimeout(() => el.remove(), 4000);
        }
        function checkAchievements() { // v23: unlock + reward + toast
            const st = lifeStats();
            const unlocked = state.achUnlocked || (state.achUnlocked = []);
            for (const a of ACHIEVEMENTS) {
                if (unlocked.includes(a.id)) continue;
                if ((st[a.stat] || 0) >= a.goal) {
                    unlocked.push(a.id);
                    state.coins = (state.coins || 0) + a.reward;
                    SFX.achievement(); SFX.coin();
                    gameToast(a.icon + ' <b>' + a.name + '!</b> &nbsp;<span class="t-reward">+' + a.reward + ' 💰</span>');
                    try { saveGame(); } catch (e) {}
                }
            }
        }
        function trackKill(isBoss, isCrit, payout) { // v23
            const st = lifeStats();
            st.kills++; st.coinsEarned += payout;
            if (isCrit) st.crits++;
            if (state.combo > st.maxCombo) st.maxCombo = state.combo;
            if (isBoss) { st.bossKills++; if (state.diffMult && state.diffMult.dmg >= 1.6) st.bossNightmare++; }
            if (isBoss) {
                state.runBossKills = (state.runBossKills || 0) + 1;
                // Boss Rush mode progression
                if (state._bossRushActive) {
                    state._bossRushIndex = (state._bossRushIndex || 0) + 1;
                    if (state._bossRushIndex >= 6) {
                        // All 6 bosses defeated — Victory!
                        setTimeout(() => {
                            try { showBossBanner('🏆 BOSS RUSH COMPLETE! All 6 Bosses Defeated!'); } catch(e2) {}
                            // Yt02 called showGameOver(), another name that exists nowhere in
                            // the shipped code — the victory run hung in the arena forever.
                            // endGame() is the real run-summary path (it already labels the
                            // mode as BOSS RUSH when an element carries that id).
                            setTimeout(() => { try { endGame(); } catch(e2) {} }, 3500);
                        }, 1200);
                    } else {
                        state.bossCooldownUntil = (state.runTime || 0) + 5;
                        state.bossPending = true;
                    }
                }
            }
            checkAchievements();
        }
        function renderAwards() { // v23 / v26.9: achievements only
            const st = lifeStats();
            const unlocked = state.achUnlocked || [];
            const al = document.getElementById('ach-list');
            al.innerHTML = '';
            for (const a of ACHIEVEMENTS) {
                const done = unlocked.includes(a.id);
                const prog = Math.min(a.goal, st[a.stat] || 0);
                const row = document.createElement('div');
                row.className = 'award-row' + (done ? '' : ' locked');
                row.innerHTML = '<div class="aw-icon">' + a.icon + '</div><div class="aw-body"><div class="aw-name">' + a.name +
                    '</div><div class="aw-desc">' + a.desc + ' · ' + (a.stat === 'playTime' ? Math.round(prog / 60) + ' min' : prog + '/' + a.goal) + '</div>' +
                    '<div class="aw-bar"><div style="width:' + Math.round(prog / a.goal * 100) + '%"></div></div></div>' +
                    (done ? '<div class="aw-done">✓</div>' : '<div class="aw-reward">+' + a.reward + '</div>');
                al.appendChild(row);
            }
            const achDone = unlocked.length;
            document.getElementById('awards-sub').textContent = achDone + '/' + ACHIEVEMENTS.length + ' achievements';
        }

        function updateHomeStats() { // v7+v13: home screen bests/coins
            const bc = document.getElementById('home-best-casual');
            const bl = document.getElementById('home-best-levels');
            const c = document.getElementById('home-coins');
            if (bc) bc.textContent = (state.bestCasual || 0).toLocaleString();
            if (bl) bl.textContent = (state.bestLevels || 0).toLocaleString();
            if (c) c.textContent = (state.coins || 0).toLocaleString();
        
            // Show Boss Rush if player has earned it
            try {
                const _br = document.getElementById('btn-bossrush');
                if (_br) {
                    const _st = lifeStats();
                    const _brUnlocked = (_st.bossKills || 0) >= 5 || (_st.maxLevel || 0) >= 5;
                    _br.style.opacity = _brUnlocked ? '1' : '0.42';
                    _br.style.pointerEvents = _brUnlocked ? '' : 'none';
                    const _brIco = _br.querySelector('.hb-ico');
                    if (_brIco) _brIco.textContent = _brUnlocked ? '💀' : '🔒';
                    const _brSub = _br.querySelector('#bossrush-sub');
                    if (_brSub) _brSub.textContent = _brUnlocked ? 'All 6 bosses. No mercy.' : 'Kill 5 bosses to unlock';
                }
            } catch(e) {}
        }

        // v13: named casual saves — never overwrite, multiple records
        function fmtTime(t) {
            const m = Math.floor((t || 0) / 60), s = Math.floor((t || 0) % 60);
            return m + ':' + String(s).padStart(2, '0');
        }
        function renderCasualSaves() {
            const wrap = document.getElementById('casual-saves');
            if (!wrap) return;
            const saves = state.casualSaves || [];
            document.getElementById('casual-best-label').textContent = (state.bestCasual || 0).toLocaleString();
            document.getElementById('casual-save-count').textContent = '(' + (saves.length + (state.autoSave ? 1 : 0)) + ')';
            wrap.innerHTML = '';
            const mkRow = (name, snap, isAuto, onDelete, onLoad) => {
                const row = document.createElement('div');
                row.className = 'save-row';
                const when = snap.savedAt ? new Date(snap.savedAt).toLocaleDateString() : '';
                row.innerHTML = '<div class="sr-body"><div class="sr-name">' + (isAuto ? '🔄 ' : '💾 ') + name + '</div>' +
                    '<div class="sr-meta">Lv ' + snap.level + ' · ' + (snap.score || 0).toLocaleString() + ' pts · ' + fmtTime(snap.runTime) + (when ? ' · ' + when : '') + '</div></div>';
                const load = document.createElement('button');
                load.className = 'sr-load'; load.textContent = 'Load';
                load.onclick = (e) => { e.stopPropagation(); onLoad(); };
                const del = document.createElement('button');
                del.className = 'sr-del'; del.textContent = '🗑';
                del.onclick = (e) => { e.stopPropagation(); onDelete(); };
                row.appendChild(load); row.appendChild(del);
                wrap.appendChild(row);
            };
            if (state.autoSave) mkRow('Autosave', state.autoSave, true,
                () => { state.autoSave = null; try { saveGame(); } catch (e) {} renderCasualSaves(); },
                () => { setScreenVisibility('casual-screen', false); startGame('casual', { resume: state.autoSave }); });
            saves.forEach((s) => mkRow(s.name, s, false,
                () => { state.casualSaves = state.casualSaves.filter(x => x !== s); try { saveGame(); } catch (e) {} renderCasualSaves(); },
                () => { setScreenVisibility('casual-screen', false); startGame('casual', { resume: s }); }));
            if (!saves.length && !state.autoSave) {
                const empty = document.createElement('div');
                empty.className = 'save-empty';
                empty.textContent = 'No saved runs yet — pause during a run and press 💾 Save.';
                wrap.appendChild(empty);
            }
        }
        function upsertNamedSave(name, overwriteName) {
            const snap = snapshotRun();
            if (!snap) return false;
            snap.savedAt = Date.now();
            state.casualSaves = state.casualSaves || [];
            if (overwriteName) {
                const i = state.casualSaves.findIndex(s => s.name === overwriteName);
                if (i >= 0) {
                    let final = (name || overwriteName).trim() || overwriteName;
                    if (final !== overwriteName) {
                        let n = 2, base = final;
                        while (state.casualSaves.some((s, idx) => idx !== i && s.name === final)) final = base + ' (' + (n++) + ')';
                    }
                    state.casualSaves[i] = { ...snap, name: final };
                    state.activeSaveName = final;
                    state.savedThisRun = true;
                    try { saveGame(); } catch (e) {}
                    return final;
                }
            }
            snap.name = name;
            let final = name, n = 2;
            while (state.casualSaves.some(s => s.name === final)) final = name + ' (' + (n++) + ')';
            state.casualSaves.push({ ...snap, name: final });
            if (state.casualSaves.length > 12) state.casualSaves.shift();
            state.activeSaveName = final;
            state.savedThisRun = true;
            try { saveGame(); } catch (e) {}
            return final;
        }
        function saveCurrentRun(name) { // v13 / v26.8
            return upsertNamedSave(name, null);
        }
        function openSaveDialog() { // v13: name your save — v26.8: offer overwrite if this run was loaded
            const snap = snapshotRun();
            if (!snap) return;
            const loaded = state.activeSaveName;
            document.getElementById('save-dialog-info').textContent = loaded
                ? ('Loaded “' + loaded + '”. Overwrite it, or save as a new run.  ·  Lv ' + snap.level + ' · ' + fmtTime(snap.runTime))
                : ('Lv ' + snap.level + ' · ' + (snap.score || 0).toLocaleString() + ' pts · ' + fmtTime(snap.runTime));
            const input = document.getElementById('save-name-input');
            input.value = loaded || ('Run Lv' + snap.level);
            const ow = document.getElementById('btn-save-overwrite');
            if (ow) ow.style.display = loaded ? '' : 'none';
            const conf = document.getElementById('btn-save-confirm');
            if (conf) conf.textContent = loaded ? '💾 Save as new' : '💾 Save';
            document.getElementById('save-dialog').classList.remove('hidden');
            setTimeout(() => { input.focus(); input.select(); }, 50);
        }
        function closeSaveDialog() { document.getElementById('save-dialog').classList.add('hidden'); }

        let shopReturnTo = 'game-over-screen'; // v7: the Armory remembers where it was opened from
        // Q062: Workshop cost for the next rank. Linear step, so the price ladder is
        // predictable next to the Armory's exponential one.
        function techCost(node) {
            const cur = (state.tech && state.tech[node.id]) || 0;
            return node.baseCost + cur * node.stepCost;
        }

        function renderTechTree() {
            const wrap = document.getElementById('tech-items');
            if (!wrap) return;
            state.tech = state.tech || { armor: 0, speed: 0, shield: 0, reroll: 0, damage: 0 };
            const coins = state.coins || 0;
            wrap.innerHTML = TECH_TREE.map(t => {
                const lvl = state.tech[t.id] || 0;
                const maxed = lvl >= t.maxLevel;
                const cost = techCost(t);
                const afford = coins >= cost;
                return '<div class="shop-row" style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(255,255,255,0.08);">'
                    + '<div style="font-size:20px;">' + t.icon + '</div>'
                    + '<div style="flex:1;min-width:0;">'
                    +   '<div style="font-weight:600;">' + t.name + ' <span style="opacity:.6;font-weight:400;">' + lvl + '/' + t.maxLevel + '</span></div>'
                    +   '<div style="font-size:11px;opacity:.65;">' + t.desc + '</div>'
                    + '</div>'
                    + '<button class="hud-icon-btn" data-tech="' + t.id + '"'
                    +   (maxed || !afford ? ' disabled style="opacity:.45;"' : '') + '>'
                    +   (maxed ? 'MAX' : ('\ud83d\udcb0 ' + cost)) + '</button>'
                    + '</div>';
            }).join('');
            wrap.querySelectorAll('[data-tech]').forEach(btn => {
                btn.addEventListener('click', () => buyTech(btn.getAttribute('data-tech')));
            });
        }

        // Q062: purchase one Workshop rank. Bounded by maxLevel and by the balance, and it
        // persists immediately so a closed tab can never cost the player a purchase.
        function buyTech(id) {
            const node = TECH_TREE.find(t => t.id === id);
            if (!node) return false;
            state.tech = state.tech || { armor: 0, speed: 0, shield: 0, reroll: 0, damage: 0 };
            const lvl = state.tech[id] || 0;
            if (lvl >= node.maxLevel) return false;
            const cost = techCost(node);
            if ((state.coins || 0) < cost) return false;
            state.coins -= cost;
            state.tech[id] = lvl + 1;
            try { playTone({ frequency: 880, duration: 0.12, type: 'triangle' }); } catch (e) {}
            try { saveGame(); } catch (e) {}
            try { renderTechTree(); renderShop(); updateHomeStats(); } catch (e) {}
            return true;
        }

        // Q062: Armory / Workshop tab switching. Wired once; renderShop() calls it because
        // that is the single entry point for opening the shop.
        function wireShopTabs() {
            const ta = document.getElementById('tab-armory');
            const tw = document.getElementById('tab-workshop');
            const items = document.getElementById('shop-items');
            const tech = document.getElementById('tech-items');
            if (!ta || !tw || !items || !tech || ta.dataset.wired) return;
            ta.dataset.wired = '1';
            const show = (which) => {
                const armory = which === 'armory';
                items.classList.toggle('hidden', !armory);
                tech.classList.toggle('hidden', armory);
                ta.classList.toggle('active', armory);
                tw.classList.toggle('active', !armory);
                if (!armory) renderTechTree();
            };
            ta.addEventListener('click', () => show('armory'));
            tw.addEventListener('click', () => show('workshop'));
            show('armory');
        }

        function renderShop() {
            try { wireShopTabs(); } catch (e) {}
            const wrap = document.getElementById('shop-items');
            wrap.innerHTML = '';
            document.getElementById('shop-coins').textContent = state.coins || 0;
            document.getElementById('shop-coins-go').textContent = state.coins || 0;
            const hc = document.getElementById('home-coins');
            if (hc) hc.textContent = (state.coins || 0).toLocaleString(); // v7
            // v10: skins section first (pure coin sinks)
            const skinTitle = document.createElement('div');
            skinTitle.className = 'cfg-label'; skinTitle.textContent = 'Tank Skins';
            wrap.appendChild(skinTitle);
            for (const skin of SKINS) {
                const row = document.createElement('div');
                row.className = 'skin-row';
                const owned = skinState().owned.includes(skin.id);
                const equipped = skinState().selected === skin.id;
                const _archBadgeColor = {
                    Balanced:'#f59e0b', Striker:'#ef4444', Juggernaut:'#10b981',
                    Recon:'#60a5fa', Tech:'#8b5cf6', Sovereign:'#fcd34d'
                }[skin.archetype] || '#aaa';
                row.innerHTML = '<div class="skin-swatch" style="background:#' + skin.color.toString(16).padStart(6, '0') + '"></div>' +
                                '<div class="skin-info">' +
                                  '<div class="skin-name">' + skin.name +
                                    ' <span class="skin-arch-badge" style="background:' + _archBadgeColor + '22;color:' + _archBadgeColor + ';border:1px solid ' + _archBadgeColor + '55;">' + skin.archetype + '</span>' +
                                  '</div>' +
                                  '<div class="skin-archdesc">' + (skin.archdesc || '') + '</div>' +
                                '</div>';
                const btn = document.createElement('button');
                if (equipped) { btn.textContent = '✓'; btn.disabled = true; row.innerHTML += '<span class="equipped">EQUIPPED</span>'; }
                else if (owned) { btn.textContent = 'Equip'; btn.onclick = () => { skinState().selected = skin.id; try { saveGame(); } catch (e) {} playUISound(); renderShop(); }; }
                else { btn.textContent = '💰 ' + skin.cost.toLocaleString(); btn.disabled = (state.coins || 0) < skin.cost;
                       btn.onclick = () => { if ((state.coins || 0) < skin.cost) return; state.coins -= skin.cost; skinState().owned.push(skin.id); skinState().selected = skin.id; lifeStats().skins = skinState().owned.length; checkAchievements(); try { saveGame(); } catch (e) {} playUISound(); renderShop(); }; } // v23
                row.appendChild(btn);
                wrap.appendChild(row);
            }
            const cTitle = document.createElement('div'); // v11: consumables
            cTitle.className = 'cfg-label'; cTitle.textContent = 'Consumables (next run)';
            wrap.appendChild(cTitle);
            for (const con of CONSUMABLES) {
                const row = document.createElement('div');
                row.className = 'shop-item';
                const owned = consumables()[con.id] || 0;
                row.innerHTML = '<div class="si-icon">' + con.icon + '</div>' +
                    '<div class="si-body"><div class="si-name">' + con.name + ' <span style="color:#fbbf24">×' + owned + '</span></div>' +
                    '<div class="si-desc">' + con.desc + '</div>' +
                    '<div class="si-pips">owned ×' + owned + ' · next costs more</div></div>';
                const btn = document.createElement('button');
                const ccost = Math.round((con.base || 400) * Math.pow(con.growth || 1.55, owned));
                {
                    btn.textContent = '💰 ' + ccost.toLocaleString();
                    btn.disabled = (state.coins || 0) < ccost;
                    btn.onclick = () => {
                        if ((state.coins || 0) < ccost) return;
                        state.coins -= ccost;
                        consumables()[con.id] = owned + 1;
                        try { saveGame(); } catch (e) {}
                        playUISound(); renderShop();
                    };
                }
                row.appendChild(btn);
                wrap.appendChild(row);
            }
            const upTitle = document.createElement('div');
            upTitle.className = 'cfg-label'; upTitle.textContent = 'Permanent Upgrades';
            wrap.appendChild(upTitle);
            for (const item of SHOP_ITEMS) {
                const lvl = ((state.meta || {})[item.id] || 0);
                const cost = shopCost(item);
                const row = document.createElement('div');
                row.className = 'shop-item';
                row.innerHTML =
                    '<div class="si-icon">' + item.icon + '</div>' +
                    '<div class="si-body"><div class="si-name">' + item.name + '</div>' +
                    '<div class="si-desc">' + item.desc + '</div>' +
                    // v26: unlimited tracks have no empty pips to draw ('○'.repeat(Infinity) throws)
                    '<div class="si-pips">' + (isFinite(item.max)
                        ? ('●'.repeat(lvl) + '○'.repeat(Math.max(0, item.max - lvl)) + ' level ' + lvl + '/' + item.max)
                        : ('●'.repeat(Math.min(lvl, 12)) + ' level ' + lvl + ' (∞)')) + '</div></div>';
                const btn = document.createElement('button');
                if (lvl >= item.max) { btn.textContent = 'MAX'; btn.disabled = true; }
                else {
                    btn.textContent = '💰 ' + cost;
                    btn.disabled = (state.coins || 0) < cost;
                    btn.onclick = () => {
                        if ((state.coins || 0) < cost) return;
                        state.coins -= cost;
                        state.meta = state.meta || {};
                        state.meta[item.id] = (state.meta[item.id] || 0) + 1;
                        try { saveGame(); } catch (e) {}
                        playUISound();
                        renderShop();
                    };
                }
                row.appendChild(btn);
                wrap.appendChild(row);
            }
        }

        // v10: game modes
