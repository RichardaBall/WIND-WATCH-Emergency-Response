import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export class DeveloperTool {
    constructor(weatherSystem, windFarm = null, mainBase = null, helicopterPlayer = null, camera = null, renderer = null, winchSystem = null, scene = null, rescueMission = null, directionalLight = null) {
        this.weatherSystem = weatherSystem;
        this.windFarm = windFarm;
        this.mainBase = mainBase;
        this.helicopterPlayer = helicopterPlayer;
        this.camera = camera;
        this.renderer = renderer;
        this.winchSystem = winchSystem;
        this.scene = scene || (camera && camera.parent ? camera.parent : null);
        this.rescueMission = rescueMission;
        this.directionalLight = directionalLight;

        this.isVisible = false;
        this.container = null;
        this.isFreeCamActive = false;
        this.orbitControls = null;
        this.isCollisionEnabled = true;
        this.isPaused = false;
        this.isFastForwarding = false;
        this.fastForwardMultiplier = 10.0;

        if (this.camera && this.renderer) {
            this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.enabled = false;
            this.orbitControls.enableDamping = true;
            this.orbitControls.dampingFactor = 0.05;
        }

        this.keysDown = {};
        this.isTransitioning = false;
        this.transitionStartPos = new THREE.Vector3();
        this.transitionTargetPos = new THREE.Vector3();
        this.transitionStartTarget = new THREE.Vector3();
        this.transitionTargetTarget = new THREE.Vector3();
        this.transitionProgress = 0;
        this.transitionDuration = 0.8;

        this.initUI();
        this.initListeners();
        this.startUpdateLoop();
    }

    initUI() {
        this.container = document.createElement('div');
        this.container.id = 'developer-tool-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 320px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(56, 189, 248, 0.4);
            border-radius: 8px;
            padding: 16px;
            color: #f8fafc;
            font-family: monospace;
            font-size: 13px;
            z-index: 10000;
            display: none;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
            user-select: none;
            max-height: 90vh;
            overflow-y: auto;
        `;

        this.container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="font-weight: bold; color: #38bdf8; letter-spacing: 1px;">SETTINGS [T]</span>
                <button id="dev-tool-close" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; font-weight: bold;">&times;</button>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; text-align: center; color: #94a3b8; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Time of Day</label>
                <div style="display: flex; gap: 8px;">
                    <button id="dev-btn-day" style="flex: 1; background: #0284c7; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Day</button>
                    <button id="dev-btn-night" style="flex: 1; background: #334155; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Night</button>
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; text-align: center; color: #94a3b8; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Weather Condition</label>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button id="dev-btn-fine" style="background: #0ea5e9; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; text-align: left; font-weight: bold;">☀ Fine Weather</button>
                    <button id="dev-btn-rain" style="background: #334155; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; text-align: left; font-weight: bold;">🌧️️ Rain</button>
                    <button id="dev-btn-storm" style="background: #334155; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; text-align: left; font-weight: bold;">⚡ Storm</button>
                </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-bottom: 14px;">
                <label style="display: block; text-align: center; color: #38bdf8; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; font-weight: bold;">Camera & Physics</label>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <button id="dev-collision" style="flex: 1; background: #10b981; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">🛡️ Collision: ON</button>
                </div>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <button id="dev-free-cam" style="flex: 1; background: #7c3aed; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">📷 Free Camera: OFF</button>
                </div>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <button id="dev-pause" style="flex: 1; background: #eab308; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">⏸️ Pause Game: OFF</button>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button id="dev-fast-forward" style="flex: 1; background: #0284c7; border: none; color: white; padding: 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">⏩ Hold to Fast Forward (10x)</button>
                </div>
            </div>

            <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 4px;">
                [T] Toggle Menu | [WASD + Q/E] Free-Roam Cam
            </div>
        `;

        document.body.appendChild(this.container);

        document.getElementById('dev-tool-close').addEventListener('click', () => this.toggle());

        document.getElementById('dev-btn-day').addEventListener('click', () => {
            if (this.weatherSystem) {
                this.weatherSystem.dayNightTimer = 0.25 * this.weatherSystem.dayCycleDuration;
                this.updateActiveStates();
            }
        });

        document.getElementById('dev-btn-night').addEventListener('click', () => {
            if (this.weatherSystem) {
                this.weatherSystem.dayNightTimer = 0.75 * this.weatherSystem.dayCycleDuration;
                this.updateActiveStates();
            }
        });

        document.getElementById('dev-btn-fine').addEventListener('click', () => {
            if (this.weatherSystem) {
                this.weatherSystem.setWeather('fine');
                this.updateActiveStates();
            }
        });

        document.getElementById('dev-btn-rain').addEventListener('click', () => {
            if (this.weatherSystem) {
                this.weatherSystem.setWeather('rain');
                this.updateActiveStates();
            }
        });

        document.getElementById('dev-btn-storm').addEventListener('click', () => {
            if (this.weatherSystem) {
                this.weatherSystem.setWeather('storm');
                this.updateActiveStates();
            }
        });

        document.getElementById('dev-collision').addEventListener('click', () => {
            this.toggleCollision();
        });

        document.getElementById('dev-free-cam').addEventListener('click', () => {
            this.toggleFreeCam();
        });

        document.getElementById('dev-pause').addEventListener('click', () => {
            this.togglePause();
        });

        const ffBtn = document.getElementById('dev-fast-forward');
        if (ffBtn) {
            const startFF = (e) => {
                e.preventDefault();
                this.isFastForwarding = true;
                ffBtn.style.background = '#0369a1';
                ffBtn.style.transform = 'scale(0.98)';
            };
            const endFF = (e) => {
                e.preventDefault();
                this.isFastForwarding = false;
                ffBtn.style.background = '#0284c7';
                ffBtn.style.transform = 'scale(1)';
            };

            ffBtn.addEventListener('mousedown', startFF);
            window.addEventListener('mouseup', endFF);
            ffBtn.addEventListener('touchstart', startFF);
            window.addEventListener('touchend', endFF);
        }
    }

    toggleCollision() {
        this.isCollisionEnabled = !this.isCollisionEnabled;

        if (this.helicopterPlayer) {
            this.helicopterPlayer.collisionEnabled = this.isCollisionEnabled;
        }

        const btn = document.getElementById('dev-collision');
        if (btn) {
            btn.style.background = this.isCollisionEnabled ? '#10b981' : '#dc2626';
            btn.textContent = `🛡 Collision: ${this.isCollisionEnabled ? 'ON' : 'OFF'}`;
        }
    }

    toggleFreeCam() {
        if (!this.orbitControls || !this.camera) {
            alert('Free camera controls not available.');
            return;
        }

        this.isFreeCamActive = !this.isFreeCamActive;
        this.orbitControls.enabled = this.isFreeCamActive;

        const btn = document.getElementById('dev-free-cam');
        if (btn) {
            btn.style.background = this.isFreeCamActive ? '#10b981' : '#7c3aed';
            btn.textContent = `📷 Free Camera: ${this.isFreeCamActive ? 'ON' : 'OFF'}`;
        }

        if (this.isFreeCamActive) {
            const targetPos = this.getTargetPosition();
            const endCamPos = targetPos.clone().add(new THREE.Vector3(25, 20, 25));
            this.smoothTransitionTo(endCamPos, targetPos);
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('dev-pause');
        if (btn) {
            btn.style.background = this.isPaused ? '#dc2626' : '#eab308';
            btn.textContent = `⏸️ Pause Game: ${this.isPaused ? 'ON' : 'OFF'}`;
        }
    }

    getTargetPosition() {
        const targetPos = new THREE.Vector3(0, 10, 0);
        if (this.helicopterPlayer && this.helicopterPlayer.model) {
            targetPos.copy(this.helicopterPlayer.model.position);
        } else if (this.mainBase && this.mainBase.group && this.mainBase.group.position) {
            targetPos.copy(this.mainBase.group.position);
            targetPos.y += 10;
        }
        return targetPos;
    }

    smoothTransitionTo(endCamPos, endTarget) {
        if (!this.orbitControls || !this.camera) return;
        this.transitionStartPos.copy(this.camera.position);
        this.transitionTargetPos.copy(endCamPos);
        this.transitionStartTarget.copy(this.orbitControls.target);
        this.transitionTargetTarget.copy(endTarget);
        this.transitionProgress = 0;
        this.isTransitioning = true;
    }

    initListeners() {
        window.addEventListener('keydown', (event) => {
            if (event.code === 'KeyT' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                this.toggle();
            }

            if (this.isFreeCamActive) {
                this.keysDown[event.code] = true;
            }
        });

        window.addEventListener('keyup', (event) => {
            if (this.isFreeCamActive) {
                this.keysDown[event.code] = false;
            }
        });
    }

    startUpdateLoop() {
        let lastTime = performance.now();
        const update = () => {
            requestAnimationFrame(update);
            const currentTime = performance.now();
            let delta = Math.min((currentTime - lastTime) / 1000, 0.1);
            lastTime = currentTime;

            if (this.isPaused) return;

            if (this.isFastForwarding) {
                delta *= this.fastForwardMultiplier;
            }

            if (this.isTransitioning && this.camera && this.orbitControls) {
                this.transitionProgress += delta / this.transitionDuration;
                const t = Math.min(this.transitionProgress, 1.0);
                const easeT = 1 - Math.pow(1 - t, 3);

                this.camera.position.lerpVectors(this.transitionStartPos, this.transitionTargetPos, easeT);
                this.orbitControls.target.lerpVectors(this.transitionStartTarget, this.transitionTargetTarget, easeT);
                this.orbitControls.update();

                if (t >= 1.0) {
                    this.isTransitioning = false;
                }
            }

            if (this.isFreeCamActive && this.camera && this.orbitControls && !this.isTransitioning) {
                const moveSpeed = 35.0 * delta;
                const dir = new THREE.Vector3();
                this.camera.getWorldDirection(dir);
                dir.y = 0;
                dir.normalize();

                const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);

                const moveDelta = new THREE.Vector3();
                if (this.keysDown['KeyW'] || this.keysDown['ArrowUp']) moveDelta.add(dir);
                if (this.keysDown['KeyS'] || this.keysDown['ArrowDown']) moveDelta.sub(dir);
                if (this.keysDown['KeyD'] || this.keysDown['ArrowRight']) moveDelta.add(sideDir);
                if (this.keysDown['KeyA'] || this.keysDown['ArrowLeft']) moveDelta.sub(sideDir);

                if (moveDelta.lengthSq() > 0) {
                    moveDelta.normalize().multiplyScalar(moveSpeed);
                    this.camera.position.add(moveDelta);
                    this.orbitControls.target.add(moveDelta);
                    this.orbitControls.update();
                }

                let vertDelta = 0;
                if (this.keysDown['KeyE'] || this.keysDown['Space']) vertDelta += moveSpeed;
                if (this.keysDown['KeyQ'] || this.keysDown['ControlLeft']) vertDelta -= moveSpeed;
                if (vertDelta !== 0) {
                    this.camera.position.y += vertDelta;
                    this.orbitControls.target.y += vertDelta;
                    this.orbitControls.update();
                }
            }
        };
        requestAnimationFrame(update);
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'block' : 'none';

        if (this.isVisible) {
            this.updateActiveStates();
        }
    }

    updateActiveStates() {
        if (!this.weatherSystem) return;

        const cycleProgress = this.weatherSystem.dayNightTimer / this.weatherSystem.dayCycleDuration;
        const sunAngle = cycleProgress * Math.PI * 2;
        const sunY = Math.sin(sunAngle) * 400;
        const isDay = sunY >= -20;

        const btnDay = document.getElementById('dev-btn-day');
        const btnNight = document.getElementById('dev-btn-night');
        if (btnDay && btnNight) {
            btnDay.style.background = isDay ? '#0284c7' : '#334155';
            btnNight.style.background = !isDay ? '#0284c7' : '#334155';
        }

        const weather = this.weatherSystem.currentWeather;
        const btnFine = document.getElementById('dev-btn-fine');
        const btnRain = document.getElementById('dev-btn-rain');
        const btnStorm = document.getElementById('dev-btn-storm');

        if (btnFine) btnFine.style.background = weather === 'fine' ? '#0ea5e9' : '#334155';
        if (btnRain) btnRain.style.background = weather === 'rain' ? '#0ea5e9' : '#334155';
        if (btnStorm) btnStorm.style.background = weather === 'storm' ? '#0ea5e9' : '#334155';
    }
}