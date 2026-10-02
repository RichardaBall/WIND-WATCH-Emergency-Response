import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { WinchSystem } from './winch.js';
import { Survivor, SurvivorState } from './survivor.js';

function optimizeAndWarmUpGltf(gltfScene) {
    const activeRenderer = window.renderer || null;
    const activeCamera = window.camera || new THREE.PerspectiveCamera(60, 1, 0.1, 5000);

    gltfScene.traverse(function(child) {
        if (child.isMesh) {
            child.frustumCulled = false;
            child.updateMatrixWorld(true);

            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                for (let i = 0; i < materials.length; i++) {
                    const mat = materials[i];
                    const mapKeys = ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap'];
                    for (let j = 0; j < mapKeys.length; j++) {
                        const key = mapKeys[j];
                        if (mat[key]) {
                            mat[key].generateMipmaps = false;
                            mat[key].minFilter = THREE.LinearFilter;
                            mat[key].needsUpdate = true;
                            if (activeRenderer && typeof activeRenderer.initTexture === 'function') {
                                activeRenderer.initTexture(mat[key]);
                            }
                        }
                    }
                    mat.needsUpdate = true;
                }
            }
        }
    });

    if (activeRenderer) {
        activeRenderer.compile(gltfScene, activeCamera);
    }
}

export class RescueMission {
    constructor(scene, loadingManager, mainBase = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.mainBase = mainBase;
        
        this.state = 'IDLE'; 
        this.missionTimer = 0;
        this.isWaitingForMission = false;

        this.raftMesh = null;
        this.fallbackMesh = null;
        this.raftPosition = new THREE.Vector3();
        this.flashTimer = 0;
        this.rescueFreq = 270.0;
        this.raftTemplates = [];
        this.raftMixers = [];
        this.raftAnimationsList = [];
        this.raftMixer = null;
        this.isRaftLoading = false;
        this.usingFallback = false;
        this.currentRaftIndex = null;
        
        this.winchSystem = new WinchSystem(scene, loadingManager);
        this.survivor = new Survivor(scene, loadingManager);
        this.survivor.loadModels();
        
        this.survivorAttached = false;
        
        this.pagerElement = null;
        this.freqDisplay = null;
        this.statusDisplay = null;
        this._initUI();
        
        this.flashingLight = new THREE.PointLight(0xff5500, 0, 35);
        this.scene.add(this.flashingLight);

        const bulbGeo = new THREE.SphereGeometry(0.1, 16, 16);
        this.flashingMat = new THREE.MeshStandardMaterial({ 
            color: 0x220000, 
            emissive: 0xff3300, 
            emissiveIntensity: 6.0 
        });
        this.flashingMesh = new THREE.Mesh(bulbGeo, this.flashingMat);
        this.flashingMesh.position.set(0, -9999, 0);
        this.flashingMesh.visible = false;
        this.scene.add(this.flashingMesh);

        this._initFallbackMesh();
        this._preloadLiferaft();
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
        this.raftTemplates = [];
        this.raftMixers = [];
        this.raftAnimationsList = [];

        const manager = (this.loadingManager && typeof this.loadingManager.itemStart === 'function') 
            ? this.loadingManager 
            : THREE.DefaultLoadingManager;
        const loader = new GLTFLoader(manager);
        
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        const files = ['liferaft.glb', 'liferaft2.glb'];
        let loadedCount = 0;

        files.forEach((file, index) => {
            if (manager && typeof manager.itemStart === 'function') {
                manager.itemStart(file);
            }

            loader.load(file, (gltf) => {
                optimizeAndWarmUpGltf(gltf.scene);
                const template = gltf.scene;
                template.scale.set(2.0, 2.0, 2.0);
                template.position.set(0, -9999, 0);
                template.visible = false;
                
                let mixer = null;
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(template);
                    const action = mixer.clipAction(gltf.animations[0]);
                    action.play();
                }

                this.scene.add(template);
                this.raftTemplates[index] = template;
                this.raftMixers[index] = mixer;
                this.raftAnimationsList[index] = gltf.animations;

                if (manager && typeof manager.itemEnd === 'function') {
                    manager.itemEnd(file);
                }

                loadedCount++;
                if (loadedCount === files.length) {
                    this.isRaftLoading = false;
                    // Once loaded during loading screen, schedule the initial mission timer to start right after
                    this._scheduleInitialMission();
                }
            }, undefined, (err) => {
                console.warn(`Failed to preload ${file}:`, err);
                if (manager && typeof manager.itemEnd === 'function') {
                    manager.itemEnd(file);
                }
                loadedCount++;
                if (loadedCount === files.length) {
                    this.isRaftLoading = false;
                    this._scheduleInitialMission();
                }
            });
        });
    }

    _scheduleInitialMission() {
        if (this.state !== 'IDLE') return;
        this.missionTimer = 5.0 + Math.random() * 5.0; // Short delay after game starts
        this.isWaitingForMission = true;
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

        this._selectRaft(false);

        if (this.survivor) {
            this.survivor.spawnOnRaft(
                this.raftPosition, 
                Math.random() * Math.PI * 2
            );
        }
    }

    _selectRaft(isUpgrade = false) {
        const validIndices = [];
        this.raftTemplates.forEach((template, idx) => {
            if (template) validIndices.push(idx);
        });

        if (validIndices.length === 0) {
            this.usingFallback = true;
            this.raftMesh = this.fallbackMesh;
            this.raftMesh.position.copy(this.raftPosition);
            this.raftMesh.visible = true;

            const lightY = this.raftPosition.y + 3.9;
            if (this.flashingLight) this.flashingLight.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
            if (this.flashingMesh) this.flashingMesh.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
            return;
        }

        let chosenOriginalIndex;
        if (this.currentRaftIndex === null) {
            const randomPos = Math.floor(Math.random() * validIndices.length);
            chosenOriginalIndex = validIndices[randomPos];
            this.currentRaftIndex = validIndices.indexOf(chosenOriginalIndex);
        } else if (!isUpgrade) {
            this.currentRaftIndex = (this.currentRaltIndex || this.currentRaftIndex + 1) % validIndices.length;
            chosenOriginalIndex = validIndices[this.currentRaftIndex];
        } else {
            chosenOriginalIndex = validIndices[this.currentRaftIndex];
        }

        if (this.fallbackMesh) {
            this.fallbackMesh.visible = false;
        }
        this.usingFallback = false;
        this.raftMesh = this.raftTemplates[chosenOriginalIndex];
        this.raftMesh.position.copy(this.raftPosition);
        this.raftMesh.visible = true;

        this.raftMixer = this.raftMixers[chosenOriginalIndex];
        if (this.raftMixer && this.raftAnimationsList[chosenOriginalIndex] && this.raftAnimationsList[chosenOriginalIndex].length > 0) {
            this.raftMixer.stopAllAction();
            const action = this.raftMixer.clipAction(this.raftAnimationsList[chosenOriginalIndex][0], this.raftMesh);
            action.reset().play();
        }

        const lightHeights = [3.9, 2.1];
        const heightOffset = lightHeights[chosenOriginalIndex] !== undefined ? lightHeights[chosenOriginalIndex] : 3.9;

        const lightY = this.raftPosition.y + heightOffset;
        if (this.flashingLight) {
            this.flashingLight.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
        }
        if (this.flashingMesh) {
            this.flashingMesh.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
        }
    }

    toggleWinch(helicopterPlayer) {
        this.winchSystem.toggleWinch(helicopterPlayer);
        
        if (this.winchSystem.winchState === 'DOWN' && this.statusDisplay && this.state !== 'IDLE' && this.state !== 'COMPLETED' && this.state !== 'RESPAWN_WAIT') {
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

        if (this.state === 'IDLE') {
            if (this.isWaitingForMission) {
                this.missionTimer -= delta;
                if (this.missionTimer <= 0) {
                    this.isWaitingForMission = false;
                    this.startMission();
                }
            }

            if (this.pagerElement) {
                const led = this.pagerElement.querySelector('#pager-led');
                if (led) {
                    led.style.backgroundColor = '#550000';
                    led.style.boxShadow = 'none';
                }
            }
            return;
        }

        if (this.state === 'RESPAWN_WAIT') {
            this.missionTimer -= delta;
            if (this.missionTimer <= 0) {
                this.state = 'IDLE';
                this._scheduleInitialMission();
            }
            if (this.pagerElement) {
                const led = this.pagerElement.querySelector('#pager-led');
                if (led) {
                    led.style.backgroundColor = '#550000';
                    led.style.boxShadow = 'none';
                }
            }
            return;
        }

        if (this.state === 'COMPLETED') {
            if (this.pagerElement) {
                const led = this.pagerElement.querySelector('#pager-led');
                if (led) {
                    led.style.backgroundColor = '#550000';
                    led.style.boxShadow = 'none';
                }
            }
            return;
        }
        
        this.flashTimer += delta * 7;
        const flash = Math.sin(this.flashTimer) > 0 ? 1 : 0;

        if (!this.survivorAttached) {
            if (this.flashingLight) {
                this.flashingLight.intensity = flash ? 10.0 : 0.5;
            }
            if (this.flashingMesh && this.flashingMat) {
                this.flashingMesh.visible = true;
                this.flashingMat.emissive.setHex(flash ? 0xff3300 : 0x330f00);
                this.flashingMat.emissiveIntensity = flash ? 6.0 : 0.5;
            }
        } else {
            if (this.flashingLight) {
                this.flashingLight.intensity = 0;
            }
            if (this.flashingMesh) {
                this.flashingMesh.visible = false;
            }
        }

        if (this.pagerElement && this.pagerElement.style.display === 'block') {
            const led = this.pagerElement.querySelector('#pager-led');
            if (led) {
                const isOn = flash === 1;
                led.style.backgroundColor = isOn ? '#ff3333' : '#550000';
                led.style.boxShadow = isOn ? '0 0 5px #ff3333' : 'none';
            }
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
                if (this.flashingMesh) {
                    this.flashingMesh.visible = false;
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
            this.state = 'RESPAWN_WAIT';

            if (this.pagerElement) {
                this.pagerElement.style.display = 'none';
            }

            if (this.flashingLight) {
                this.flashingLight.intensity = 0;
            }
            if (this.flashingMesh) {
                this.flashingMesh.visible = false;
            }

            this.missionTimer = 120 + Math.random() * 180;
        }
    }
}