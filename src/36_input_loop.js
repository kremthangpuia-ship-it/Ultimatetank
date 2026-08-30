        let _lastAnimTime = 0;
        function animate(now) {
            requestAnimationFrame(animate);
            try {
            // FPS throttle: drop to 30fps when user selects 30 FPS mode
            const _fpsInterval = state.fpsMode === 30 ? 1000 / 30 : 0;
            if (_fpsInterval > 0 && (now - _lastAnimTime) < _fpsInterval - 1) return;
            _lastAnimTime = now;
            runChunkTasks(3); // v22: chunk micro-ops progress every frame, independent of physics
            const dt = Math.min(clock.getDelta(), 0.1);
            try { if(typeof updateCombatPolish==='function') updateCombatPolish(dt); } catch(e) {}
            if (state.gamePhase === 'playing') { updatePhysics(dt); needsRender = true; }
            // FIX (Tier 3): don't burn GPU/battery rendering a static scene in menus/pause.
            if ((needsRender || state.gamePhase === 'playing') && renderer && scene && camera) { renderer.render(scene, camera); needsRender = false; }
            } catch (err) {
                // v26.3: one bad frame must not kill the loop
                try { console.error(err); } catch (e) {}
            }
        }

        // ============================================
        // INPUT HANDLING
        // ============================================
        function setupInputs() {
            const inputLayer = document.getElementById('input-layer');
            const stickBase = document.getElementById('joystick-base');
            const stickKnob = document.getElementById('joystick-knob');

            let moveTouch = null;
            let fireTouch = null;

            inputLayer.addEventListener('touchstart', (e) => {
                if (state.gamePhase !== 'playing') return;

                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    
                    const moveSide = state.leftHanded ? (t.clientX > window.innerWidth / 2) : (t.clientX < window.innerWidth / 2);
                    if (moveSide) {
                        if (moveTouch === null) {
                            moveTouch = t.identifier;
                            stickBase.style.display = 'block';
                            stickBase.style.left = t.clientX + 'px';
                            stickBase.style.top = t.clientY + 'px';
                            stickKnob.style.transform = 'translate(-50%, -50%)';
                        }
                    } else {
                        fireTouch = t.identifier;
                        state.input.isFiring = true;
                    }
                }
            }, { passive: true });

            inputLayer.addEventListener('touchmove', (e) => {
                if (state.gamePhase !== 'playing') return;
                e.preventDefault();

                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    
                    if (t.identifier === moveTouch) {
                        const rect = stickBase.getBoundingClientRect();
                        const centerX = rect.left + rect.width / 2;
                        const centerY = rect.top + rect.height / 2;
                        
                        let dx = t.clientX - centerX;
                        let dy = t.clientY - centerY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const maxDist = 50;

                        if (dist > maxDist) {
                            dx = (dx / dist) * maxDist;
                            dy = (dy / dist) * maxDist;
                        }

                        stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                        state.input.x = dx / maxDist;
                        state.input.y = dy / maxDist;
                    }
                }
            }, { passive: false });

            // FIX (Tier 1): touchcancel now handled like touchend, so an interrupted
            // touch (incoming call, OS gesture) can no longer leave firing stuck on
            // or the joystick frozen.
            const handleTouchEnd = (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];

                    if (t.identifier === moveTouch) {
                        moveTouch = null;
                        stickBase.style.display = 'none';
                        state.input.x = 0;
                        state.input.y = 0;
                    }

                    if (t.identifier === fireTouch) {
                        fireTouch = null;
                        state.input.isFiring = false;
                    }
                }
            };
            inputLayer.addEventListener('touchend', handleTouchEnd);
            inputLayer.addEventListener('touchcancel', handleTouchEnd);

            // Keyboard
            const keys = {};
            window.addEventListener('keydown', e => {
                keys[e.key.toLowerCase()] = true;
                updateKeyboardInput();
                if (e.key === ' ' && state.gamePhase === 'playing') state.input.isFiring = true;
            });
            
            window.addEventListener('keyup', e => {
                keys[e.key.toLowerCase()] = false;
                updateKeyboardInput();
                if (e.key === ' ') state.input.isFiring = false;
            });

            function updateKeyboardInput() {
                state.input.x = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
                state.input.y = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);
            }
        }

        // Button handlers
        syncHUDControls();

        // v10: mode selection
        
        try { document.getElementById('btn-settings-home').addEventListener('click', () => { openSettings(); }); } catch(e) {}
        try {
            document.getElementById('btn-camera-float').addEventListener('click', () => {
                state.cameraMode = state.cameraMode === 'wide' ? 'follow' : 'wide';
                try{syncHUDControls();}catch(e){}
            });
        } catch(e) {}
        try {
            const brBtn = document.getElementById('btn-bossrush');
            if (brBtn) {
                // Unlock Boss Rush after 5 boss kills OR reaching stage 5
                const ls = lifeStats ? lifeStats() : {};
                const _brUnlocked3 = (ls.bossKills || 0) >= 5 || (ls.maxLevel || 0) >= 5;
                brBtn.style.opacity = _brUnlocked3 ? '1' : '0.42';
                brBtn.style.pointerEvents = _brUnlocked3 ? '' : 'none';
                const _ico3 = brBtn.querySelector('.hb-ico'); if (_ico3) _ico3.textContent = _brUnlocked3 ? '💀' : '🔒';
                const _sub3 = brBtn.querySelector('#bossrush-sub'); if (_sub3) _sub3.textContent = _brUnlocked3 ? 'All 6 bosses. No mercy.' : 'Kill 5 bosses to unlock';
                brBtn.addEventListener('click', () => {
                    setScreenVisibility('start-screen', false);
                    // Start Boss Rush directly — pre-configured hard run
                    startGame('bossrush', { difficulty: 'hard' });
                });
            }
        } catch(e) {}

        document.getElementById('btn-casual').addEventListener('click', (e) => { // v13: casual hub
            e.stopPropagation();
            renderCasualSaves();
            setScreenVisibility('start-screen', false);
            setScreenVisibility('casual-screen', true);
        });
        document.getElementById('btn-casual-new').addEventListener('click', (e) => {
            e.stopPropagation();
            setScreenVisibility('casual-screen', false);
            startGame('casual');
        });
        document.getElementById('btn-casual-back').addEventListener('click', (e) => {
            e.stopPropagation();
            setScreenVisibility('casual-screen', false);
            setScreenVisibility('start-screen', true);
            updateHomeStats();
        });
        document.getElementById('btn-levels').addEventListener('click', (e) => {
            e.stopPropagation();
            updateHomeStats();
            // v13: start level unlocks up to the highest level you've cleared/reached
            const cap = Math.max(1, state.maxCleared || 1);
            const slider = document.getElementById('cfg-level');
            slider.max = cap;
            slider.value = Math.min(parseInt(slider.value, 10) || 1, cap);
            document.getElementById('cfg-level-val').textContent = slider.value;
            document.getElementById('cfg-level-cap').textContent = '(unlocked up to Lv ' + cap + ')';
            setScreenVisibility('start-screen', false);
            setScreenVisibility('levels-screen', true);
        });
        document.getElementById('btn-levels-back').addEventListener('click', (e) => {
            e.stopPropagation();
            setScreenVisibility('levels-screen', false);
            setScreenVisibility('start-screen', true);
        });
        document.getElementById('btn-levels-start').addEventListener('click', (e) => {
            e.stopPropagation();
            const density = parseInt(document.querySelector('#cfg-density .sel').dataset.v, 10);
            const difficulty = document.querySelector('#cfg-difficulty .sel').dataset.v;
            const startLevel = parseInt(document.getElementById('cfg-level').value, 10);
            setScreenVisibility('levels-screen', false);
            startGame('levels', { density, difficulty, startLevel });
        });
        document.querySelectorAll('.cfg-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                chip.parentElement.querySelectorAll('.cfg-chip').forEach(c => c.classList.remove('sel'));
                chip.classList.add('sel');
                playUISound();
            });
        });
        document.getElementById('cfg-level').addEventListener('input', (e) => {
            document.getElementById('cfg-level-val').textContent = e.target.value;
        });
        document.getElementById('btn-save-run').addEventListener('click', (e) => { // v13
            e.stopPropagation();
            quickSaveFromPause();
        });
        document.getElementById('btn-save-confirm').addEventListener('click', (e) => {
            e.stopPropagation();
            const name = (document.getElementById('save-name-input').value || '').trim() || 'Run';
            const saved = saveCurrentRun(name);
            closeSaveDialog();
            showUpgradeNotification(saved ? '💾 Saved as “' + saved + '”' : '💾 Saved');
        });
        document.getElementById('btn-save-cancel').addEventListener('click', (e) => {
            e.stopPropagation();
            closeSaveDialog();
        });

        document.getElementById('btn-continue-run').addEventListener('click', (e) => {
            e.stopPropagation();
            buyContinue();
        });
        document.getElementById('btn-restart').addEventListener('click', (e) => {
            e.stopPropagation();
            startGame(state.mode || 'casual', state.mode === 'levels'
                ? { density: state.levelsCfg.density, difficulty: state.diffMult.label === 'Easy' ? 'easy' : state.diffMult.label === 'Hard' ? 'hard' : state.diffMult.label === 'Nightmare' ? 'nightmare' : 'normal', startLevel: state.startLevelUsed || 1 }
                : {});
        });
        document.getElementById('btn-go-home').addEventListener('click', (e) => {
            e.stopPropagation();
            quitToMenu();
        });
        document.getElementById('btn-save-overwrite').addEventListener('click', (e) => {
            e.stopPropagation();
            const typed = (document.getElementById('save-name-input').value || '').trim();
            const slot = state.activeSaveName;
            const saved = slot ? upsertNamedSave(typed || slot, slot) : saveCurrentRun(typed || 'Run');
            closeSaveDialog();
            showUpgradeNotification(saved ? '💾 Saved as “' + saved + '”' : '💾 Saved');
        });

        document.getElementById('btn-pause').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePause();
        });

        const _el_btn_settings = document.getElementById('btn-settings'); if(_el_btn_settings) _el_btn_settings.addEventListener('click', (e) => {
            e.stopPropagation();
            openSettings();
        });

        const _el_btn_sound = document.getElementById('btn-sound'); if(_el_btn_sound) _el_btn_sound.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSound();
        });

        const _el_btn_camera = document.getElementById('btn-camera'); if(_el_btn_camera) _el_btn_camera.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCameraMode();
        });

        const _el_btn_assist = document.getElementById('btn-assist'); if(_el_btn_assist) _el_btn_assist.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleControlAssist();
        });

        document.getElementById('toggle-sound-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSound();
        });

        document.getElementById('toggle-camera-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCameraMode();
        });

        document.getElementById('toggle-assist-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleControlAssist();
        });
        function persistPrefs() { try { saveGame(); } catch (err) {} playUISound(); syncHUDControls(); }
        document.getElementById('toggle-haptics-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.hapticsEnabled = state.hapticsEnabled === false;
            persistPrefs();
        });
        document.getElementById('toggle-lefty-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.leftHanded = !state.leftHanded;
            persistPrefs();
        });
        document.getElementById('toggle-shake-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.reduceShake = !state.reduceShake;
            persistPrefs();
        });
        document.getElementById('toggle-flash-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.reduceFlash = !state.reduceFlash;
            persistPrefs();
        });
        let _diagTaps = 0, _diagTapAt = 0;
        function tapForDiag() {
            const now = performance.now();
            _diagTaps = (now - _diagTapAt < 700) ? _diagTaps + 1 : 1;
            _diagTapAt = now;
            if (_diagTaps >= 5) {
                _diagTaps = 0;
                state.showDiag = !state.showDiag;
                try { diagTick(0); } catch (err) {}
            }
        }
        const setTitle = document.querySelector('#settings-screen .settings-title');
        if (setTitle) setTitle.addEventListener('click', function (e) { e.stopPropagation(); tapForDiag(); });
        const pbTitle = document.querySelector('.pb-title');
        if (pbTitle) pbTitle.addEventListener('click', function (e) { e.stopPropagation(); tapForDiag(); });

        document.getElementById('toggle-dmgnums-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.damageNumbers = state.damageNumbers === false ? true : false;
            persistPrefs();
        });
        document.getElementById('toggle-combatpopups-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.combatPopups = state.combatPopups === false ? true : false;
            persistPrefs();
        });
        document.getElementById('toggle-fps-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            state.fpsMode = state.fpsMode === 60 ? 30 : 60;
            persistPrefs();
        });
        document.getElementById('btn-reset-data').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm('Reset ALL progress? This cannot be undone.')) return;
            try { store.set('tank_save', null); } catch(_) {}
            state.coins = 0; state.meta = {}; state.skins = { owned: ['amber'], selected: 'amber' };
            state.bestCasual = 0; state.bestLevels = 0; state.maxCleared = 1;
            state.consumables = { lucky: 0, headstart: 0, reroll: 0, overcharge: 0, aegis: 0 };
            state.stats = {}; state.achUnlocked = []; state.daily = null;
            state.casualSaves = []; state.autoSave = null;
            showUpgradeNotification('All data reset.');
            closeSettings();
            // Yt02 called showScreen('home') here, a function that never existed in any
            // build — the navigation threw and raised the red error overlay right after a
            // successful wipe. setScreenVisibility + updateHomeStats is the live idiom.
            setScreenVisibility('start-screen', true);
            try { updateHomeStats(); } catch(e) {}
        });
        document.getElementById('close-settings-panel').addEventListener('click', (e) => {
            e.stopPropagation();
            closeSettings();
        });

        // v1.1: minimap tap-to-toggle
        (function() {
            const radarEl = document.getElementById('radar-bezel-toggle');
            if (radarEl) {
                radarEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    radarEl.classList.toggle('minimap-mini');
                });
                // restore pointer-events on the bezel only (canvas stays none)
                radarEl.style.pointerEvents = 'auto';
            }
        })();

        document.getElementById('btn-resume').addEventListener('click', (e) => {
            e.stopPropagation();
            resumeGame();
        });
        // v1.4: evo detail screen
        document.getElementById('btn-evo-detail').addEventListener('click', (e) => {
            e.stopPropagation();
            openEvoDetail();
        });
        document.getElementById('btn-evo-back').addEventListener('click', (e) => {
            e.stopPropagation();
            closeEvoDetail();
        });

        // v4+v7: Armory — reachable from the game-over screen AND the home screen
        document.getElementById('btn-shop').addEventListener('click', (e) => {
            e.stopPropagation();
            shopReturnTo = 'game-over-screen';
            renderShop();
            setScreenVisibility('game-over-screen', false);
            setScreenVisibility('shop-screen', true);
        });
        document.getElementById('btn-shop-home').addEventListener('click', (e) => { // v7
            e.stopPropagation();
            shopReturnTo = 'start-screen';
            renderShop();
            setScreenVisibility('start-screen', false);
            setScreenVisibility('shop-screen', true);
        });
        document.getElementById('btn-shop-close').addEventListener('click', (e) => {
            e.stopPropagation();
            setScreenVisibility('shop-screen', false);
            setScreenVisibility(shopReturnTo, true);
            if (shopReturnTo === 'start-screen') updateHomeStats(); // v7
        });

        document.getElementById('btn-awards').addEventListener('click', (e) => { // v23
            e.stopPropagation();
            renderAwards();
            setScreenVisibility('start-screen', false);
            setScreenVisibility('awards-screen', true);
        });
        document.getElementById('btn-awards-back').addEventListener('click', (e) => {
            e.stopPropagation();
            updateHomeStats();
            setScreenVisibility('awards-screen', false);
            setScreenVisibility('start-screen', true);
        });

        document.getElementById('toggle-quality-panel').addEventListener('click', (e) => { // v25
            e.stopPropagation();
            cycleQuality();
            syncHUDControls();
        });

        document.getElementById('toggle-music-panel').addEventListener('click', (e) => { // v24
            e.stopPropagation();
            state.musicEnabled = !state.musicEnabled;
            if (!state.musicEnabled) SFX.musicStop();
            else if (state.gamePhase === 'playing') SFX.musicStart();
            try { saveGame(); } catch (err) {}
            playUISound();
            syncHUDControls();
        });

        document.getElementById('btn-pause-settings').addEventListener('click', (e) => { // v2 UI
            e.stopPropagation();
            openSettings();
        });

        document.getElementById('btn-quit').addEventListener('click', (e) => {
            e.stopPropagation();
            // v26: use the canonical quit path — it also disposes enemies/bullets/
            // missiles/particles and stops audio (the inline copy leaked them all)
            quitToMenu();
        });

        document.getElementById('start-screen').classList.remove('hidden');
        lifeStats(); // v23
        updateHomeStats(); // v7
        if (!store.persistent) { // v14: be honest about sandboxed previews
            const warn = document.createElement('div');
            warn.id = 'storage-warning';
            warn.innerHTML = '⚠️ This preview blocks saving — progress is session-only.<br>Open the game in its own browser tab (or install it) for permanent saves.';
            document.getElementById('start-screen').appendChild(warn);
        }
        setPauseUIVisible(false);
        syncHUDControls();
        init();

        // FIX (v2/P1): auto-pause when the app goes to the background (screen off,
        // app switch, incoming call). Previously the game kept running hidden —
        // players returned to find themselves shot "while paused".
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && state.gamePhase === 'playing') {
                pauseGame();
                if (state.mode === 'casual' && player && !player.isDead) { // v13: auto slot only
                    const snap = snapshotRun();
                    if (snap) { snap.savedAt = Date.now(); state.autoSave = snap; }
                    try { saveGame(); } catch (e) {}
                }
            }
        });
        // v3: also auto-pause on focus loss (tapping outside the game / scrolling the
        // host page in an embedded preview) — the last gap in pause coverage.
        window.addEventListener('blur', () => {
            if (state.gamePhase === 'playing') pauseGame();
        });
    
// ===== NEW CORE LOOP SYSTEM =====

// combo system
state.combo = 0;
state.comboTimer = 0;

// coins
state.coins = 0;

// upgrade choice flag
state.isChoosingUpgrade = false;

// v4 (Upgrades-A): level-up card pool — pick 1 of 3 distinct cards each level
