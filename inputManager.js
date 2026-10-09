export class InputManager {
    constructor(soundManager = null) {
        this.soundManager = soundManager;
        this.keys = {};
        this.cameraDistance = 60;
        this.landingLightOn = false;

        window.addEventListener('keydown', (e) => {
            // --- NEW: Force unlock the Web Audio API on the first keystroke ---
            if (this.soundManager) {
                const ctx = this.soundManager.ctxMgr?.audioCtx || this.soundManager.audioCtx;
                if (ctx && ctx.state === 'suspended') {
                    ctx.resume().catch(() => {});
                }
            }
            // ------------------------------------------------------------------

            if (e.target.closest && e.target.closest('#pilot-kneeboard')) return;

            if ([
                'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 
                'KeyQ', 'KeyF', 'KeyE', 'KeyG', 'KeyL', 'Space',
                'Digit8', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit9',
                'Numpad8', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad9',
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
            ].includes(e.code)) {
                e.preventDefault();
            }

            this.keys[e.code] = true;

            if (e.code === 'KeyL') {
                if (e.repeat) return;
                this.landingLightOn = !this.landingLightOn;
                console.log("Landing Light: " + (this.landingLightOn ? "ON" : "OFF"));
                if (this.soundManager) {
                    if (typeof this.soundManager.playBatterySwitchSound === 'function') {
                        this.soundManager.playBatterySwitchSound(this.landingLightOn);
                    } else if (typeof this.soundManager.playToggleSwitchSound === 'function') {
                        this.soundManager.playToggleSwitchSound(this.landingLightOn);
                    }
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('wheel', (e) => {
            if (e.target.closest && e.target.closest('#pilot-kneeboard')) return;

            this.cameraDistance += e.deltaY * 0.05;
            this.cameraDistance = Math.max(10, Math.min(60, this.cameraDistance));
        });
    }
}