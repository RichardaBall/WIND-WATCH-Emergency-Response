import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { WinchSystem } from './winch.js';
import { Survivor, SurvivorState } from './survivor.js';

function optimizeAndWarmUpGltf(gltfScene, renderer = null, camera = null) {
    const activeRenderer = renderer || window.renderer || null;
    const activeCamera = camera || window.camera || null;

    gltfScene.traverse(function(child) {
        if (child.isMesh) {
            child.frustumCulled = false;
            child.updateMatrixWorld(true);

            if (child.isSkinnedMesh && child.skeleton) {
                child.skeleton.update();
            }

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
                            if (activeRenderer && typeof activeRenderer.initTexture === 'function') {
                                activeRenderer.initTexture(mat[key]);
                            }
                        }
                    }
                }
            }
        }
    });

    if (activeRenderer && activeCamera) {
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
        
        // Light for liferaft.glb (Index 0)
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

        // Separate light and half-size bulb for liferaft2.glb (Index 1)
        this.flashingLight2 = new THREE.PointLight(0xff5500, 0, 35);
        this.scene.add(this.flashingLight2);

        const smallBulbGeo = new THREE.SphereGeometry(0.05, 16, 16);
        this.flashingMat2 = new THREE.MeshStandardMaterial({ 
            color: 0x220000, 
            emissive: 0xff3300, 
            emissiveIntensity: 6.0 
        });
        this.flashingMesh2 = new THREE.Mesh(smallBulbGeo, this.flashingMat2);
        this.flashingMesh2.position.set(0, -9999, 0);
        this.flashingMesh2.visible = false;
        this.scene.add(this.flashingMesh2);

        // Final tuned offsets for liferaft2.glb light
        this.lightOffset2 = { x: 0.00, y: 0.37, z: -0.67 };

        this.searchlight = null;
        this.searchlightTarget = new THREE.Object3D();
        this.scene.add(this.searchlightTarget);
        this._targetPos = new THREE.Vector3();

        this._initFallbackMesh();
        this._preloadLiferaft();
    }

    setSearchlight(spotLight) {
        this.searchlight = spotLight;
        if (this.searchlight) {
            this.searchlight.target = this.searchlightTarget;
            if (!this.searchlightTarget.parent) {
                this.scene.add(this.searchlightTarget);
            }
        }
    }

    getActiveTargetPosition(outVector = new THREE.Vector3()) {
        if (this.survivorAttached) {
            if (this.survivor && typeof this.survivor.getActivePosition === 'function') {
                return this.survivor.getActivePosition(outVector);
            }
            if (this.survivor && this.survivor.raisingMesh && this.survivor.raisingMesh.visible) {
                this.survivor.raisingMesh.getWorldPosition(outVector);
                return outVector;
            }
            if (this.winchSystem) {
                const hookPos = this.winchSystem.getHookPosition();
                if (hookPos) {
                    outVector.copy(hookPos);
                    return outVector;
                }
            }
        }

        if (this.raftMesh && this.raftMesh.visible) {
            outVector.copy(this.raftPosition);
            outVector.y += 0.5;
            return outVector;
        }

        if (this.survivor && typeof this.survivor.getActivePosition === 'function') {
            return this.survivor.getActivePosition(outVector);
        }

        outVector.copy(this.raftPosition);
        return outVector;
    }

    reset() {
        if (this.raftMesh) {
            this._resetRaftVisibility(this.raftMesh);
            this.raftMesh.visible = false;
            this.raftMesh = null;
        }
        if (this.fallbackMesh) {
            this.fallbackMesh.visible = false;
        }
        this.raftTemplates.forEach(t => { 
            if (t) {
                this._resetRaftVisibility(t);
                t.visible = false; 
            }
        });
        this.state = 'IDLE';
        this.survivorAttached = false;
        this.currentRaftIndex = null;
        if (this.flashingLight) this.flashingLight.intensity = 0;
        if (this.flashingMesh) this.flashingMesh.visible = false;
        if (this.flashingLight2) this.flashingLight2.intensity = 0;
        if (this.flashingMesh2) this.flashingMesh2.visible = false;
        if (this.pagerElement) this.pagerElement.style.display = 'none';
    }

    _hideRaftSurvivor(raftMesh) {
        if (!raftMesh) return;
        if (this.raftMixer) {
            this.raftMixer.stopAllAction();
        }
        let hiddenAny = false;
        raftMesh.traverse((child) => {
            if (child.isMesh || child.isSkinnedMesh) {
                const name = (child.name || '').toLowerCase();
                const isRaftBody = name.includes('raft') || name.includes('boat') || name.includes('tube') || name.includes('hull') || name.includes('canopy') || name.includes('float') || name.includes('floor') || name.includes('ring') || name.includes('base') || name.includes('cylinder');
                if (!isRaftBody) {
                    if (child.isSkinnedMesh || name.includes('survivor') || name.includes('character') || name.includes('person') || name.includes('man') || name.includes('human') || name.includes('guy') || name.includes('body') || name.includes('people') || name.includes('mixamo') || name.includes('armature') || name.includes('avatar') || name.includes('male') || name.includes('female') || name.includes('figure') || name.includes('victim')) {
                        child.visible = false;
                        hiddenAny = true;
                    }
                }
            }
        });
        if (!hiddenAny) {
            raftMesh.traverse((child) => {
                if (child.isSkinnedMesh) {
                    child.visible = false;
                }
            });
        }
    }

    _resetRaftVisibility(raftMesh) {
        if (!raftMesh) return;
        raftMesh.traverse((child) => {
            if (child.isMesh || child.isSkinnedMesh) {
                child.visible = true;
            }
        });
    }

    warmup(renderer, camera) {
        if (!renderer || !camera) return;
        const hiddenObjects = [];
        const culledObjects = [];
        const targets = [this.fallbackMesh, this.flashingMesh, this.flashingMesh2];
        this.raftTemplates.forEach((template) => { if (template) targets.push(template); });
        if (this.survivor) {
            if (this.survivor.mesh) targets.push(this.survivor.mesh);
            if (this.survivor.raisingMesh) targets.push(this.survivor.raisingMesh);
            if (this.survivor.walkingMesh) targets.push(this.survivor.walkingMesh);
            if (this.survivor.wavingMesh) targets.push(this.survivor.wavingMesh);
        }
        targets.forEach((obj) => {
            if (!obj) return;
            obj.traverse((child) => {
                if (!child.visible) {
                    child.visible = true;
                    hiddenObjects.push(child);
                }
                if (child.isMesh) {
                    if (child.frustumCulled) {
                        child.frustumCulled = false;
                        culledObjects.push(child);
                    }
                    child.updateMatrixWorld(true);
                    if (child.isSkinnedMesh && child.skeleton) child.skeleton.update();
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach((m) => { m.needsUpdate = true; });
                    }
                }
            });
        });
        this.raftMixers.forEach((mixer) => { if (mixer) mixer.update(0.01); });
        if (this.survivor && this.survivor.mixer) this.survivor.mixer.update(0.01);
        renderer.compile(this.scene, camera);
        renderer.render(this.scene, camera);
        hiddenObjects.forEach((child) => { child.visible = false; });
        culledObjects.forEach((child) => { child.frustumCulled = true; });
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

        const manager = (this.loadingManager && typeof this.loadingManager.itemStart === 'function') ? this.loadingManager : THREE.DefaultLoadingManager;
        const loader = new GLTFLoader(manager);
        const dracoLoader = new DRACOLoader(manager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
        loader.setMeshoptDecoder(MeshoptDecoder);

        const files = ['liferaft.glb', 'liferaft2.glb'];
        let loadedCount = 0;

        files.forEach((file, index) => {
            if (manager && typeof manager.itemStart === 'function') manager.itemStart(file);
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

                if (manager && typeof manager.itemEnd === 'function') manager.itemEnd(file);
                loadedCount++;
            }, undefined, () => {
                if (manager && typeof manager.itemEnd === 'function') manager.itemEnd(file);
                loadedCount++;
            });
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
                <div style="font-size: 8px; font-weight: bold; color: #ff3333; letter-spacing: 1px;" id="pager-title">PAGER [SOS]</div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 7px; color: #888;">ALERT</span>
                    <div id="pager-led" style="width: 7px; height: 7px; background-color: #ff3333; border-radius: 50%; box-shadow: 0 0 5px #ff3333; border: 1px solid #500;"></div>
                </div>
            </div>

            <div style="background: #111215; border: 1px inset #2a2d32; border-radius: 3px; padding: 8px; text-align: center;">
                <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;" id="pager-call-type">DISTRESS CALL</div>
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
            const titleEl = this.pagerElement.querySelector('#pager-title');
            const callTypeEl = this.pagerElement.querySelector('#pager-call-type');
            if (titleEl) titleEl.textContent = 'PAGER [SOS]';
            if (callTypeEl) callTypeEl.textContent = 'DISTRESS CALL';
            this.freqDisplay.textContent = `${this.rescueFreq.toFixed(1)} kHz`;
            this.statusDisplay.textContent = `NAV TO RAFT`;
            this.pagerElement.style.display = 'block';
        }

        this._selectRaft(false);

        if (this.survivor) {
            const hiddenSurvivorPos = new THREE.Vector3(this.raftPosition.x, -3.0, this.raftPosition.z);
            this.survivor.spawnOnRaft(hiddenSurvivorPos, Math.random() * Math.PI * 2);
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
            this.raftMesh.position.y = -1.2;
            this.raftMesh.visible = true;
            this.currentRaftIndex = null;
            return;
        }

        let chosenOriginalIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
        this.currentRaftIndex = chosenOriginalIndex;
        this.raftMesh = this.raftTemplates[chosenOriginalIndex];
        this._resetRaftVisibility(this.raftMesh);

        this.raftMesh.position.copy(this.raftPosition);
        this.raftMesh.position.y = -1.90;
        this.raftMesh.visible = true;

        this.raftMixer = this.raftMixers[chosenOriginalIndex];
        if (this.raftMixer && this.raftAnimationsList[chosenOriginalIndex] && this.raftAnimationsList[chosenOriginalIndex].length > 0) {
            this.raftMixer.stopAllAction();
            const action = this.raftMixer.clipAction(this.raftAnimationsList[chosenOriginalIndex][0], this.raftMesh);
            action.reset().play();
        }

        const lightY = this.raftPosition.y + 2.0;

        if (chosenOriginalIndex === 0) {
            if (this.flashingLight) this.flashingLight.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
            if (this.flashingMesh) this.flashingMesh.position.set(this.raftPosition.x, lightY, this.raftPosition.z);
            if (this.flashingLight2) this.flashingLight2.position.set(0, -9999, 0);
            if (this.flashingMesh2) this.flashingMesh2.position.set(0, -9999, 0);
        } else if (chosenOriginalIndex === 1) {
            const lightX = this.raftPosition.x + this.lightOffset2.x;
            const customLightY = this.raftPosition.y + this.lightOffset2.y;
            const lightZ = this.raftPosition.z + this.lightOffset2.z;
            if (this.flashingLight2) this.flashingLight2.position.set(lightX, customLightY, lightZ);
            if (this.flashingMesh2) this.flashingMesh2.position.set(lightX, customLightY, lightZ);
            if (this.flashingLight) this.flashingLight.position.set(0, -9999, 0);
            if (this.flashingMesh) this.flashingMesh.position.set(0, -9999, 0);
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

        const activeSpotlight = this.searchlight || (helicopterPlayer ? (helicopterPlayer.searchlight || helicopterPlayer.spotlight) : null);
        if (activeSpotlight && (this.state === 'ACTIVE' || this.state === 'ON_SCENE' || this.state === 'WINCHING' || this.state === 'RETURNING')) {
            if (activeSpotlight.distance < 300) activeSpotlight.distance = 350;
            if (activeSpotlight.target !== this.searchlightTarget) {
                activeSpotlight.target = this.searchlightTarget;
            }
            this.getActiveTargetPosition(this._targetPos);
            this.searchlightTarget.position.copy(this._targetPos);
            this.searchlightTarget.updateMatrixWorld();
        }

        if (this.state === 'IDLE' || this.state === 'RESPAWN_WAIT' || this.state === 'COMPLETED') {
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

        const activeLight = (this.currentRaftIndex === 1) ? this.flashingLight2 : this.flashingLight;
        const activeMesh = (this.currentRaftIndex === 1) ? this.flashingMesh2 : this.flashingMesh;
        const activeMat = (this.currentRaftIndex === 1) ? this.flashingMat2 : this.flashingMat;
        const inactiveLight = (this.currentRaftIndex === 1) ? this.flashingLight : this.flashingLight2;
        const inactiveMesh = (this.currentRaftIndex === 1) ? this.flashingMesh : this.flashingMesh2;

        if (!this.survivorAttached) {
            if (activeLight) activeLight.intensity = flash ? 10.0 : 0.5;
            if (activeMesh && activeMat) {
                activeMesh.visible = true;
                activeMat.emissive.setHex(flash ? 0xff3300 : 0x330f00);
            }
            if (inactiveLight) inactiveLight.intensity = 0;
            if (inactiveMesh) inactiveMesh.visible = false;
        } else {
            if (this.flashingLight) this.flashingLight.intensity = 0;
            if (this.flashingMesh) this.flashingMesh.visible = false;
            if (this.flashingLight2) this.flashingLight2.intensity = 0;
            if (this.flashingMesh2) this.flashingMesh2.visible = false;
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
                if (this.flashingLight) this.flashingLight.intensity = 0;
                if (this.flashingMesh) this.flashingMesh.visible = false;
                if (this.flashingLight2) this.flashingLight2.intensity = 0;
                if (this.flashingMesh2) this.flashingMesh2.visible = false;
                this._hideRaftSurvivor(this.raftMesh);

                if (this.survivor) {
                    this.survivor.attachToWinch();
                }
            }
        }
        
        if (this.survivorAttached && this.state === 'WINCHING') {
            const winchRetracted = this.winchSystem.winchHeight <= 0.15 || this.winchSystem.winchState === 'UP' || this.winchSystem.winchState === 'RETRACTED';
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
            const spawnPos = (this.mainBase && typeof this.mainBase.getSpawnPosition === 'function') ? this.mainBase.getSpawnPosition() : new THREE.Vector3(3.3690, 6.2360, 0.4548);
            const horizDist = Math.hypot(heliPos.x - spawnPos.x, heliPos.z - spawnPos.z);
            const vertDist = Math.abs(heliPos.y - spawnPos.y);

            const isLanded = (horizDist < 35.0 && vertDist < 5.0) && (helicopterPlayer.isGrounded || Math.abs(helicopterPlayer.currentMoveSpeed || 0) < 1.0);
            const engineOff = !helicopterPlayer.isEngineRunning;
            const fuelPumpOff = !helicopterPlayer.isFuelPumpOn;
            const electricalOff = !helicopterPlayer.isElectricalOn;

            if (isLanded && (engineOff && fuelPumpOff && electricalOff)) {
                this.state = 'DISEMBARKING';
                if (this.raftMesh) {
                    this.raftMesh.visible = false;
                    this.raftMesh = null;
                }
                if (this.survivor) {
                    this.survivor.disembarkNextToHelicopter({ x: -14.00, y: 4.80, z: 3.35, rotationY: 1.5533 }, 1.5533, 4.80, true);
                }
            }
        }

        if (this.state === 'DISEMBARKING' && this.survivor && this.survivor.currentState === SurvivorState.COMPLETED) {
            this.state = 'RESPAWN_WAIT';
            if (this.pagerElement) this.pagerElement.style.display = 'none';
        }
    }
}