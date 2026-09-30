import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { WinchSystem } from './winch.js';
import { Survivor, SurvivorState } from './survivor.js';

function optimizeAndWarmUpGltf(gltfScene) {
    const activeRenderer = window.renderer || null;
    const activeCamera = window.camera || new THREE.PerspectiveCamera(60, 1, 0.1, 5000);

    gltfScene.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
            child.updateMatrixWorld(true);

            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    const mapKeys = ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap'];
                    mapKeys.forEach(key => {
                        if (mat[key]) {
                            mat[key].generateMipmaps = false;
                            mat[key].minFilter = THREE.LinearFilter;
                            mat[key].needsUpdate = true;
                            if (activeRenderer && typeof activeRenderer.initTexture === 'function') {
                                activeRenderer.initTexture(mat[key]);
                            }
                        }
                    });
                    mat.needsUpdate = true;
                });
            }
        }
    });

    if (activeRenderer) {
        // Force WebGL shader compilation and GPU buffer upload immediately on load
        activeRenderer.compile(gltfScene, activeCamera);
    }
}

export class RescueMission {
    constructor(scene, loadingManager, mainBase = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.mainBase = mainBase;
        
        this.state = 'IDLE'; // IDLE, ACTIVE, ON_SCENE, WINCHING, RETURNING, DISEMBARKING, COMPLETED
        this.raftMesh = null;
        this.fallbackMesh = null;
        this.raftPosition = new THREE.Vector3();
        this.flashingLight = null;
        this.flashTimer = 0;
        this.rescueFreq = 270.0;
        this.raftTemplate = null;
        this.raftMixer = null;
        this.isRaftLoading = false;
        this.usingFallback = false;
        
        this.winchSystem = new WinchSystem(scene, loadingManager);
        this.survivor = new Survivor(scene, loadingManager);
        this.survivor.loadModels();
        
        this.survivorAttached = false;
        
        this.pagerElement = null;
        this.freqDisplay = null;
        this.statusDisplay = null;
        this._initUI();
        
        this.flashingLight = new THREE.PointLight(0xff0000, 0, 35);
        this.scene.add(this.flashingLight);

        this._initFallbackMesh();
        this._preloadLiferaft();
        
        const initialDelay = 10000 + Math.random() * 20000;
        setTimeout(() => {
            this.startMission();
        }, initialDelay);
    }

    _initFallbackMesh() {
        const geo = new THREE.CylinderGeometry(2, 2, 0.8, 16);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff5500 });
        this.fallbackMesh = new THREE.Mesh(geo, mat);
        this.fallbackMesh.position.set(0, -9999, 0);
        this.fallbackMesh.visible = false;
        this.scene.add(this.fallbackMesh);
    }

    _preloadLiferaft() {
        this.isRaftLoading = true;
        const manager = (this.loadingManager && typeof this.loadingManager.itemStart === 'function') 
            ? this.loadingManager 
            : THREE.DefaultLoadingManager;
        const loader = new GLTFLoader(manager);
        
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        loader.load('liferaft.glb', (gltf) => {
            optimizeAndWarmUpGltf(gltf.scene);
            this.raftTemplate = gltf.scene;
            this.raftTemplate.scale.set(2.0, 2.0, 2.0);
            this.raftTemplate.position.set(0, -9999, 0);
            this.raftTemplate.visible = false;
            
            this.raftAnimations = gltf.animations;
            if (gltf.animations && gltf.animations.length > 0) {
                this.raftMixer = new THREE.AnimationMixer(this.raftTemplate);
                const action = this.raftMixer.clipAction(gltf.animations[0]);
                action.play();
            }

            this.scene.add(this.raftTemplate);
            this.isRaftLoading = false;

            if (this.state === 'ACTIVE' && this.usingFallback) {
                this._upgradeToGltfRaft();
            }
        }, undefined, (err) => {
            this.isRaftLoading = false;
            console.warn("Failed to preload liferaft.glb, will use fallback mesh:", err);
        });
    }

    _initUI() {
        const div = document.createElement('div');
        div.id = 'rescue-pager-panel';
        div.style.cssText = `
            position: fixed;
            bottom: 193px;
            right: 20px;
            width: 170px;
            background: linear-gradient(135deg, #282a2d, #191a1c);
            border: 2px solid #3a3d42;
            border-radius: 5px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08);
            font-family: 'Courier New', Courier, monospace;
            color: #d1d5db;
            padding: 10px;
            z-index: 10000;
            display: none;
            user-select: none;
            pointer-events: auto;
        `;

        div.innerHTML = `
            <div style="position: absolute; top: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; top: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; left: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>
            <div style="position: absolute; bottom: 4px; right: 6px; font-size: 7px; color: #555; font-weight: bold;">⊗</div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px;">
                <div style="font-size: 8px; font-weight: bold; color: #ff3333; letter-spacing: 1px;">PAGER [SOS]</div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 7px; color: #888;">SOS</span>
                    <div id="pager-led" style="width: 7px; height: 7px; background-color: #ff3333; border-radius: 50%; box-shadow: 0 0 5px #ff3333; border: 1px solid #500;"></div>
                </div>
            </div>

            <div style="background: #111215; border: 1px inset #2a2d32; border-radius: 3px; padding: 8px; text-align: center;">
                <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;">DISTRESS CALL</div>
                <div id="pager-freq" style="font-size: 15px; font-weight: bold; color: #ff3333; text-shadow: 0 0 6px rgba(255,51,51,0.6); letter-spacing: 1px;">---.- kHz</div>
            </div>

            <div style="margin-top: 8px; font-size: 7px; color: #9ca3af; text-align: center; line-height: 1.3;">
                <div id="pager-status">SEARCHING...</div>
            </div>
        `;
        document.body.appendChild(div);
        this.pagerElement = div;
        this.freqDisplay = div.querySelector('#pager-freq');
        this.statusDisplay = div.querySelector('#pager-status');

        ['wheel', 'mousedown', 'mouseup', 'click', 'pointerdown'].forEach(eventType => {
            div.addEventListener(eventType, (e) => e.stopPropagation());
        });
    }

    startMission() {
        if (this.state !== 'IDLE') return;
        
        this.survivorAttached = false;
        this.usingFallback = false;
        
        const excluded = [210, 240, 290, 350];
        const possible = [];
        for (let f = 200; f <= 400; f += 10) {
            if (!excluded.includes(f)) {
                possible.push(f);
            }
        }
        this.rescueFreq = possible[Math.floor(Math.random() * possible.length)];
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 900 + Math.random() * 600;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        this.raftPosition.set(x, 0, z);
        
        this.state = 'ACTIVE';

        if (window.navRadio) {
            window.navRadio.stations[this.rescueFreq] = {
                name: `SOS (${this.rescueFreq} kHz)`,
                position: this.raftPosition
            };
        }

        if (this.pagerElement && this.freqDisplay && this.statusDisplay) {
            this.freqDisplay.textContent = `${this.rescueFreq.toFixed(1)} kHz`;
            this.statusDisplay.textContent = `NAV TO RAFT`;
            this.pagerElement.style.display = 'block';
        }

        if (this.flashingLight) {
            this.flashingLight.position.set(this.raftPosition.x, 1.8, this.raftPosition.z);
        }

        if (this.raftTemplate) {
            this.raftMesh = this.raftTemplate;
            this.raftMesh.position.copy(this.raftPosition);
            this.raftMesh.visible = true;
            if (this.raftMixer && this.raftAnimations.length > 0) {
                this.raftMixer.stopAllAction();
                const action = this.raftMixer.clipAction(this.raftAnimations[0], this.raftMesh);
                action.reset().play();
            }
        } else {
            this.usingFallback = true;
            this.raftMesh = this.fallbackMesh;
            this.raftMesh.position.copy(this.raftPosition);
            this.raftMesh.visible = true;
        }

        if (this.survivor) {
            this.survivor.spawnOnRaft(
                this.raftPosition, 
                Math.random() * Math.PI * 2
            );
        }
    }

    _upgradeToGltfRaft() {
        if (!this.raftTemplate || !this.usingFallback) return;
        if (this.fallbackMesh) {
            this.fallbackMesh.visible = false;
        }
        this.usingFallback = false;
        this.raftMesh = this.raftTemplate;
        this.raftMesh.position.copy(this.raftPosition);
        this.raftMesh.visible = true;
        if (this.raftMixer && this.raftAnimations.length > 0) {
            this.raftMixer.stopAllAction();
            const action = this.raftMixer.clipAction(this.raftAnimations[0], this.raftMesh);
            action.reset().play();
        }
    }

    toggleWinch(helicopterPlayer) {
        this.winchSystem.toggleWinch(helicopterPlayer);
        
        if (this.winchSystem.winchState === 'DOWN' && this.statusDisplay && this.state !== 'IDLE' && this.state !== 'COMPLETED') {
            this.statusDisplay.textContent = `HOOK DOWN. HOVER`;
        }
    }

    update(delta, helicopterPlayer, mainBase) {
        if (mainBase && !this.mainBase) {
            this.mainBase = mainBase;
        }

        if (this.winchSystem) {
            this.winchSystem.update(delta, helicopterPlayer);
        }

        if (this.raftMixer) {
            this.raftMixer.update(delta);
        }

        const hookPos = this.winchSystem ? this.winchSystem.getHookPosition() : null;

        if (this.survivor) {
            this.survivor.update(delta, hookPos);
        }

        if (this.state === 'IDLE' || this.state === 'COMPLETED') return;
        
        if (this.flashingLight && !this.survivorAttached) {
            this.flashTimer += delta * 7;
            this.flashingLight.intensity = Math.sin(this.flashTimer) > 0 ? 10.0 : 0.5;
        } else if (this.flashingLight) {
            this.flashingLight.intensity = 0;
        }
        
        if (!helicopterPlayer || !helicopterPlayer.model) return;
        
        const heliPos = helicopterPlayer.model.position;
        const distToRaft = heliPos.distanceTo(this.raftPosition);
        
        if (this.state === 'ACTIVE' && distToRaft < 150) {
            this.state = 'ON_SCENE';
            if (this.statusDisplay) {
                this.statusDisplay.textContent = `SIGHTED. HOVER & [X]`;
            }
        }
        
        if (!this.survivorAttached && this.raftMesh && this.raftMesh.visible && hookPos) {
            const distHookToRaft = hookPos.distanceTo(this.raftPosition);
            if (distHookToRaft < 4.5) {
                this.survivorAttached = true;
                this.state = 'WINCHING';
                if (this.statusDisplay) {
                    this.statusDisplay.textContent = `HOOKED! RETRACT WINCH`;
                }
                if (this.raftMesh) {
                    this.raftMesh.visible = false;
                    this.raftMesh = null;
                }
                if (this.flashingLight) {
                    this.flashingLight.intensity = 0;
                }
                if (this.survivor) {
                    this.survivor.attachToWinch();
                }
            }
        }
        
        if (this.survivorAttached && this.state === 'WINCHING') {
            const winchRetracted = this.winchSystem.winchHeight <= 0.15 || 
                                   this.winchSystem.winchState === 'UP' || 
                                   this.winchSystem.winchState === 'RETRACTED';
            if (winchRetracted) {
                this.state = 'RETURNING';
                if (this.statusDisplay) {
                    this.statusDisplay.textContent = `SURVIVOR ONBOARD! RETURN BASE`;
                }

                if (this.pagerElement) {
                    this.pagerElement.style.display = 'none';
                }

                if (this.survivor) {
                    this.survivor.enterCabin();
                }
                
                if (window.navRadio && window.navRadio.stations[this.rescueFreq]) {
                    delete window.navRadio.stations[this.rescueFreq];
                }
            }
        }

        if (this.state === 'RETURNING' && helicopterPlayer && helicopterPlayer.model) {
            const spawnPos = (this.mainBase && typeof this.mainBase.getSpawnPosition === 'function') 
                ? this.mainBase.getSpawnPosition() 
                : new THREE.Vector3(3.3690, 6.2360, 0.4548);
            const horizDist = Math.hypot(heliPos.x - spawnPos.x, heliPos.z - spawnPos.z);
            const vertDist = Math.abs(heliPos.y - spawnPos.y);

            const isLanded = (horizDist < 35.0 && vertDist < 5.0) && 
                             (helicopterPlayer.isGrounded || Math.abs(helicopterPlayer.currentMoveSpeed || 0) < 1.0 || (helicopterPlayer.verticalSpeed !== undefined && Math.abs(helicopterPlayer.verticalSpeed) < 0.5));

            const engineOff = helicopterPlayer.engineOn === false || 
                              helicopterPlayer.isEngineRunning === false || 
                              helicopterPlayer.engineState === 'OFF' || 
                              (!helicopterPlayer.engineOn && !helicopterPlayer.isEngineRunning && helicopterPlayer.engineState !== 'RUNNING');

            const fuelPumpOff = helicopterPlayer.fuelPumpOn === false || 
                                 helicopterPlayer.fuelPump === false || 
                                 helicopterPlayer.isFuelPumpOn === false || 
                                 (!helicopterPlayer.fuelPumpOn && !helicopterPlayer.fuelPump);

            const electricalOff = helicopterPlayer.electricalOn === false || 
                                  helicopterPlayer.batteryOn === false || 
                                  helicopterPlayer.battery === false || 
                                  helicopterPlayer.isElectricalOn === false || 
                                  (!helicopterPlayer.electricalOn && !helicopterPlayer.batteryOn && !helicopterPlayer.battery);

            const allSystemsOff = engineOff && fuelPumpOff && electricalOff;

            if (isLanded && allSystemsOff) {
                this.state = 'DISEMBARKING';

                if (this.survivor) {
                    this.survivor.disembarkNextToHelicopter(
                        { x: -14.00, y: 4.80, z: 3.35, rotationY: 1.5533 },
                        1.5533,
                        4.80,
                        true
                    );
                }
            }
        }

        if (this.state === 'DISEMBARKING' && this.survivor && this.survivor.currentState === SurvivorState.COMPLETED) {
            this.state = 'COMPLETED';

            if (this.pagerElement) {
                this.pagerElement.style.display = 'none';
            }

            if (this.flashingLight) {
                this.flashingLight.intensity = 0;
            }

            const randomDelay = 120000 + Math.random() * 180000;
            setTimeout(() => {
                this.state = 'IDLE';
                this.startMission();
            }, randomDelay);
        }
    }
}