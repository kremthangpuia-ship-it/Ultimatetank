        function syncHUDControls() {
            // v2 UI: quickbar retired during play — settings live in the pause menu now
            const quick = document.getElementById('hud-quickbar');
            if (quick) quick.classList.remove('show');

            const btnSound = document.getElementById('btn-sound');
            const btnCamera = document.getElementById('btn-camera');
            const btnAssist = document.getElementById('btn-assist');
            const sndPanel = document.getElementById('toggle-sound-panel');
            const camPanel = document.getElementById('toggle-camera-panel');
            const astPanel = document.getElementById('toggle-assist-panel');
            if (btnSound) btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
            if (btnCamera) btnCamera.textContent = state.cameraMode === 'follow' ? '📷' : '🎥';
            if (btnAssist) btnAssist.textContent = state.controlAssist ? '🎯' : '◌';
            if (sndPanel) sndPanel.textContent = `Sound: ${state.soundEnabled ? 'On' : 'Off'}`;
            const musPanel = document.getElementById('toggle-music-panel'); // v24
            if (musPanel) musPanel.textContent = `Music: ${state.musicEnabled ? 'On' : 'Off'}`;
            const qPanel = document.getElementById('toggle-quality-panel'); // v25
            if (qPanel) qPanel.textContent = `Graphics: ${qualityLabel()}`;
            if (camPanel) camPanel.textContent = `Camera: ${state.cameraMode === 'follow' ? 'Follow' : 'Wide'}`;
            if (astPanel) astPanel.textContent = `Assist: ${state.controlAssist ? 'On' : 'Off'}`;
            const hap = document.getElementById('toggle-haptics-panel');
            if (hap) hap.textContent = 'Haptics: ' + (state.hapticsEnabled === false ? 'Off' : 'On');
            const lefty = document.getElementById('toggle-lefty-panel');
            if (lefty) lefty.textContent = 'Hands: ' + (state.leftHanded ? 'Left' : 'Right');
            const shk = document.getElementById('toggle-shake-panel');
            if (shk) shk.textContent = 'Shake: ' + (state.reduceShake ? 'Low' : 'Full');
            const fl = document.getElementById('toggle-flash-panel');
            if (fl) fl.textContent = 'Flash: ' + (state.reduceFlash ? 'Low' : 'Full');
            const dn = document.getElementById('toggle-dmgnums-panel');
            if (dn) dn.textContent = 'Damage Numbers: ' + (state.damageNumbers === false ? 'Off' : 'On');
            const cp = document.getElementById('toggle-combatpopups-panel');
            if (cp) cp.textContent = 'Combat Popups: ' + (state.combatPopups === false ? 'Off' : 'On');
            const fp = document.getElementById('toggle-fps-panel');
            if (fp) fp.textContent = 'Frame Rate: ' + (state.fpsMode === 30 ? '30 FPS' : '60 FPS');
        }

        function toggleSound() {
            state.soundEnabled = !state.soundEnabled;
            if (state.soundEnabled) ensureAudioContext();
            playUISound();
            syncHUDControls();
        }

        function toggleCameraMode() {
            state.cameraMode = state.cameraMode === 'follow' ? 'wide' : 'follow';
            playUISound();
            syncHUDControls();
        }

        function toggleControlAssist() {
            state.controlAssist = !state.controlAssist;
            playUISound();
            syncHUDControls();
        }

        function openSettings() {
            if (state.gamePhase === 'playing') pauseGame();
            setScreenVisibility('pause-screen', false);
            setScreenVisibility('settings-screen', true);
            syncHUDControls();
        }

        function closeSettings() {
            setScreenVisibility('settings-screen', false);
            if (state.gamePhase === 'paused') setScreenVisibility('pause-screen', true);
            syncHUDControls();
        }

        // ============================================
        // BIOME LOADING - Creates entire environment
        // ============================================
        // v15: cinematic biome transition — dim to dark with the realm's name,
        // rebuild the world behind the curtain, fade back in. Debounced so chained
        // level-ups land on the final biome.
        // v20: persistent sky canvas — redrawn (and blended) without texture churn
