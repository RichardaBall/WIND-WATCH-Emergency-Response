// fishermanRescue.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class FishermanRescueMission {
    constructor(scene, loadingManager, mainBase = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.mainBase = mainBase;
        
        this.state = 'IDLE'; 

        this.boatModel = null;
        this.boatMixer = null;

        this.petewaterActions = [];
        this.petewaterObject = null;
        this.peteraisingModel = null;
        this.peteraisingMixer = null;

        this.petewavingActions = [];
        this.petewavingObject = null;
        this.raisingModel = null;
        this.raisingMixer = null;

        this.petewavingbyeModel = null;
        this.petewavingbyeMixer = null;
        this.bothRescuedAndLanded = false;
        this.disembarkTimer = 0;
        this.disembarkDuration = 9.0;

        this.goodbyeWorldPosition = new THREE.Vector3(-14.00, 4.80, 3.35);
        this.goodbyeWorldRotationY = 1.5533;

        this.activeRescue = null; 
        this.rescuedCount = 0;
        this.catchDistanceThreshold = 4.0;

        this.hasActiveFire = true;
        this.currentWaterHits = 0;
        this.waterHitsRequired = 30;
        this.fireParticleSystem = null;
        this.smokeParticleSystem = null;
        this.fireParticlesCount = 600;
        this.smokeParticlesCount = 600;
        
        this.fireParticleGeo = null;
        this.smokeParticleGeo = null;
        this.fireMat = null;
        this.smokeMat = null;
        this.baseFireSize = 16.0;
        this.baseSmokeSize = 32.0;

        this.fireVelocities = new Float32Array(this.fireParticlesCount * 3);
        this.smokeVelocities = new Float32Array(this.smokeParticlesCount * 3);
        this.fireLifetimes = new Float32Array(this.fireParticlesCount);
        this.fireMaxLifetimes = new Float32Array(this.fireParticlesCount);
        this.smokeLifetimes = new Float32Array(this.smokeParticlesCount);
        this.smokeMaxLifetimes = new Float32Array(this.smokeParticlesCount);

        this.fireOffset = new THREE.Vector3(-1.3, 1.2, -0.8);
        this.fireScale = 0.2;

        this.attachmentOffset = new THREE.Vector3(0, -1.0, 0);
        this.pitchAngle = THREE.MathUtils.degToRad(0.0);
        this.yawAngle = THREE.MathUtils.degToRad(0.0);
        this.rollAngle = THREE.MathUtils.degToRad(0.0);
        
        this.animationSpeed = 2.0;
        this.boatPosition = new THREE.Vector3(0, -1.84, -30);
        this.rescueFreq = 210.0;
        this.baseFreq = 210.0;

        this.redLightOffset = new THREE.Vector3(0.55, 2.38, -1.33);
        this.greenLightOffset = new THREE.Vector3(0.57, 2.37, 1.40);
        this.yellowLightOffset = new THREE.Vector3(-2.41, 6.12, 0.04);

        // Searchlight target setup for mission illumination
        this.searchlightTarget = new THREE.Object3D();
        this.scene.add(this.searchlightTarget);

        this._initUI();
        this._setupBoatLights();
        this._loadAssets();
    }

    _initUI() {
        const div = document.createElement('div');
        div.id = 'fisherman-pager-panel';
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 0 2px;">
                <div style="font-size: 8px; font-weight: bold; color: #ff3333; letter-spacing: 1px;">PAGER [SOS]</div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 7px; color: #888;">SOS</span>
                    <div id="fisherman-pager-led" style="width: 7px; height: 7px; background-color: #ff3333; border-radius: 50%; box-shadow: 0 0 5px #ff3333; border: 1px solid #500;"></div>
                </div>
            </div>
            <div style="background: #111215; border: 1px inset #2a2d32; border-radius: 3px; padding: 8px; text-align: center;">
                <div style="font-size: 7px; color: #9ca3af; letter-spacing: 0.5px; margin-bottom: 2px;">FISHING BOAT SOS</div>
                <div id="fisherman-pager-freq" style="font-size: 15px; font-weight: bold; color: #ff3333; text-shadow: 0 0 6px rgba(255,51,51,0.6); letter-spacing: 1px;">210.0 kHz</div>
            </div>
            <div style="margin-top: 8px; font-size: 7px; color: #9ca3af; text-align: center; line-height: 1.3;">
                <div id="fisherman-pager-status">EXTINGUISH FIRE</div>
            </div>
        `;
        document.body.appendChild(div);
        this.pagerElement = div;
        this.freqDisplay = div.querySelector('#fisherman-pager-freq');
        this.statusDisplay = div.querySelector('#fisherman-pager-status');

        ['wheel', 'mousedown', 'mouseup', 'click', 'pointerdown'].forEach(eventType => {
            div.addEventListener(eventType, (e) => e.stopPropagation());
        });
    }

    _setupBoatLights() {
        const bulbGeo = new THREE.SphereGeometry(0.12, 16, 16);

        this.redLight = new THREE.PointLight(0xff3300, 15.0, 40);
        this.redLight.position.copy(this.redLightOffset);
        this.redBulbMat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff3300, emissiveIntensity: 8.0 });
        this.redBulbMesh = new THREE.Mesh(bulbGeo, this.redBulbMat);
        this.redBulbMesh.position.copy(this.redLightOffset);
        this.redBulbMesh.scale.set(0.5, 0.5, 0.5);

        this.greenLight = new THREE.PointLight(0x00ff55, 15.0, 40);
        this.greenLight.position.copy(this.greenLightOffset);
        this.greenBulbMat = new THREE.MeshStandardMaterial({ color: 0x00ff55, emissive: 0x00ff55, emissiveIntensity: 8.0 });
        this.greenBulbMesh = new THREE.Mesh(bulbGeo, this.greenBulbMat);
        this.greenBulbMesh.position.copy(this.greenLightOffset);
        this.greenBulbMesh.scale.set(0.5, 0.5, 0.5);

        this.yellowLight = new THREE.PointLight(0xffcc00, 15.0, 40);
        this.yellowLight.position.copy(this.yellowLightOffset);
        this.yellowBulbMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 8.0 });
        this.yellowBulbMesh = new THREE.Mesh(bulbGeo, this.yellowBulbMat);
        this.yellowBulbMesh.position.copy(this.yellowLightOffset);
        this.yellowBulbMesh.scale.set(0.25, 0.25, 0.25);
    }

    _loadAssets() {
        const loader = new GLTFLoader(this.loadingManager);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);
        loader.setMeshoptDecoder(MeshoptDecoder);

        loader.load('fishingboat.glb', (gltf) => {
            this.boatModel = gltf.scene;
            this.boatModel.position.copy(this.boatPosition);
            this.boatModel.scale.set(1, 1, 1);
            this.boatModel.visible = (this.state !== 'IDLE');

            this.boatModel.add(this.redLight);
            this.boatModel.add(this.redBulbMesh);
            this.boatModel.add(this.greenLight);
            this.boatModel.add(this.greenBulbMesh);
            this.boatModel.add(this.yellowLight);
            this.boatModel.add(this.yellowBulbMesh);

            this.scene.add(this.boatModel);

            this._initFireVFX();

            this.boatModel.traverse((child) => {
                const nameLower = child.name.toLowerCase();
                if (nameLower.includes('petewater')) {
                    this.petewaterObject = child;
                } else if (nameLower.includes('petewaving')) {
                    this.petewavingObject = child;
                }
            });

            if (gltf.animations && gltf.animations.length > 0) {
                this.boatMixer = new THREE.AnimationMixer(this.boatModel);
                this.petewaterActions = [];
                this.petewavingActions = [];

                gltf.animations.forEach((clip) => {
                    const action = this.boatMixer.clipAction(clip);
                    action.play();
                    const clipNameLower = clip.name.toLowerCase();
                    if (clipNameLower.includes('petewater')) {
                        action.setEffectiveTimeScale(this.animationSpeed);
                        this.petewaterActions.push(action);
                    } else if (clipNameLower.includes('petewaving')) {
                        action.setEffectiveTimeScale(this.animationSpeed);
                        this.petewavingActions.push(action);
                    }
                });
            }
        }, undefined, (error) => { console.error('Error loading fishingboat.glb:', error); });

        loader.load('peteraising.glb', (gltf) => {
            this.peteraisingModel = gltf.scene;
            this.peteraisingModel.visible = false;
            this.peteraisingModel.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
            this.scene.add(this.peteraisingModel);
            if (gltf.animations && gltf.animations.length > 0) {
                this.peteraisingMixer = new THREE.AnimationMixer(this.peteraisingModel);
                gltf.animations.forEach(clip => this.peteraisingMixer.clipAction(clip).play());
            }
        }, undefined, (error) => { console.error('Error loading peteraising.glb:', error); });

        loader.load('raising.glb', (gltf) => {
            this.raisingModel = gltf.scene;
            this.raisingModel.visible = false;
            this.raisingModel.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
            this.scene.add(this.raisingModel);
            if (gltf.animations && gltf.animations.length > 0) {
                this.raisingMixer = new THREE.AnimationMixer(this.raisingModel);
                gltf.animations.forEach(clip => this.raisingMixer.clipAction(clip).play());
            }
        }, undefined, (error) => { console.error('Error loading raising.glb:', error); });

        loader.load('petewavingbye.glb', (gltf) => {
            this.petewavingbyeModel = gltf.scene;
            this.petewavingbyeModel.visible = false;
            this.petewavingbyeModel.scale.set(1, 1, 1);
            this.petewavingbyeModel.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
            this.scene.add(this.petewavingbyeModel);

            if (gltf.animations && gltf.animations.length > 0) {
                this.petewavingbyeMixer = new THREE.AnimationMixer(this.petewavingbyeModel);
                gltf.animations.forEach(clip => {
                    const action = this.petewavingbyeMixer.clipAction(clip);
                    action.setEffectiveTimeScale(1.0);
                    action.play();
                });
            }
        }, undefined, (error) => { console.error('Error loading petewavingbye.glb:', error); });
    }

    _initFireVFX() {
        this.fireParticleGeo = new THREE.BufferGeometry();
        const firePositions = new Float32Array(this.fireParticlesCount * 3);
        
        for (let i = 0; i < this.fireParticlesCount; i++) {
            firePositions[i * 3] = (Math.random() - 0.5) * 3.0;
            firePositions[i * 3 + 1] = Math.random() * 6.0;
            firePositions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;

            this.fireVelocities[i * 3] = (Math.random() - 0.5) * 1.5;
            this.fireVelocities[i * 3 + 1] = 8.0 + Math.random() * 6.0;
            this.fireVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

            this.fireMaxLifetimes[i] = 0.7 + Math.random() * 0.6;
            this.fireLifetimes[i] = Math.random() * this.fireMaxLifetimes[i];
        }
        this.fireParticleGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));

        const fireCanvas = document.createElement('canvas');
        fireCanvas.width = 256; fireCanvas.height = 256;
        const fireCtx = fireCanvas.getContext('2d');
        const fireGrad = fireCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        fireGrad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
        fireGrad.addColorStop(0.2, 'rgba(255, 180, 50, 0.9)');
        fireGrad.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
        fireGrad.addColorStop(0.8, 'rgba(150, 10, 0, 0.1)');
        fireGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        fireCtx.fillStyle = fireGrad;
        fireCtx.fillRect(0, 0, 256, 256);
        const fireTexture = new THREE.CanvasTexture(fireCanvas);

        this.fireMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.baseFireSize * this.fireScale,
            map: fireTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.95
        });

        this.fireParticleSystem = new THREE.Points(this.fireParticleGeo, this.fireMat);
        this.fireParticleSystem.frustumCulled = false;
        this.fireParticleSystem.position.copy(this.fireOffset);
        this.boatModel.add(this.fireParticleSystem);

        this.smokeParticleGeo = new THREE.BufferGeometry();
        const smokePositions = new Float32Array(this.smokeParticlesCount * 3);

        for (let i = 0; i < this.smokeParticlesCount; i++) {
            smokePositions[i * 3] = (Math.random() - 0.5) * 4.0;
            smokePositions[i * 3 + 1] = 2.0 + Math.random() * 16.0;
            smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.0;

            this.smokeVelocities[i * 3] = (Math.random() - 0.5) * 2.5;
            this.smokeVelocities[i * 3 + 1] = 9.0 + Math.random() * 7.0;
            this.smokeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.5;

            this.smokeMaxLifetimes[i] = 3.0 + Math.random() * 1.5;
            this.smokeLifetimes[i] = Math.random() * this.smokeMaxLifetimes[i];
        }
        this.smokeParticleGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

        const smokeCanvas = document.createElement('canvas');
        smokeCanvas.width = 256; smokeCanvas.height = 256;
        const smokeCtx = smokeCanvas.getContext('2d');
        const smokeGrad = smokeCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        smokeGrad.addColorStop(0.0, 'rgba(70, 70, 70, 0.7)');
        smokeGrad.addColorStop(0.35, 'rgba(50, 50, 50, 0.45)');
        smokeGrad.addColorStop(0.7, 'rgba(25, 25, 25, 0.15)');
        smokeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        smokeCtx.fillStyle = smokeGrad;
        smokeCtx.fillRect(0, 0, 256, 256);
        const smokeTexture = new THREE.CanvasTexture(smokeCanvas);

        this.smokeMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: this.baseSmokeSize * this.fireScale,
            map: smokeTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false,
            opacity: 0.65,
            vertexColors: false
        });

        this.smokeParticleSystem = new THREE.Points(this.smokeParticleGeo, this.smokeMat);
        this.smokeParticleSystem.frustumCulled = false;
        this.smokeParticleSystem.position.copy(this.fireOffset);
        this.boatModel.add(this.smokeParticleSystem);
    }

    startMission() {
        if (window.navRadio && window.navRadio.stations) {
            if (window.navRadio.stations[this.rescueFreq]) {
                delete window.navRadio.stations[this.rescueFreq];
            }
            if (window.navRadio.stations[this.baseFreq]) {
                delete window.navRadio.stations[this.baseFreq];
            }
        }

        const fixedFrequencies = [210.0, 240.0, 290.0, 350.0];
        let candidateFreq;
        do {
            const steps = Math.floor(Math.random() * ((400 - 200) / 10 + 1));
            candidateFreq = 200 + steps * 10;
        } while (fixedFrequencies.includes(candidateFreq));
        
        this.rescueFreq = candidateFreq;

        this.state = 'ACTIVE';
        this.activeRescue = null;
        this.rescuedCount = 0;
        this.bothRescuedAndLanded = false;
        this.disembarkTimer = 0;
        this.hasActiveFire = true;
        this.currentWaterHits = 0;

        const angle = Math.random() * Math.PI * 2;
        const distance = 950 + Math.random() * 600;

        let centerPos = new THREE.Vector3(0, 0, 0);
        if (this.mainBase && typeof this.mainBase.getSpawnPosition === 'function') {
            centerPos = this.mainBase.getSpawnPosition();
        } else if (this.mainBase && this.mainBase.position) {
            centerPos = this.mainBase.position;
        }

        const x = centerPos.x + Math.cos(angle) * distance;
        const z = centerPos.z + Math.sin(angle) * distance;
        this.boatPosition.set(x, -1.84, z);

        if (this.boatModel) {
            this.boatModel.position.copy(this.boatPosition);
            this.boatModel.visible = true;
        }

        if (this.searchlightTarget) {
            this.searchlightTarget.position.copy(this.boatPosition);
            if (!this.scene.getObjectById(this.searchlightTarget.id)) {
                this.scene.add(this.searchlightTarget);
            }
        }

        if (this.petewaterObject) this.petewaterObject.visible = true;
        if (this.petewavingObject) this.petewavingObject.visible = true;

        if (this.peteraisingModel) this.peteraisingModel.visible = false;
        if (this.raisingModel) this.raisingModel.visible = false;
        if (this.petewavingbyeModel) this.petewavingbyeModel.visible = false;

        this.petewaterActions.forEach(action => action.play());
        this.petewavingActions.forEach(action => action.play());

        if (window.navRadio && window.navRadio.stations) {
            window.navRadio.stations[this.rescueFreq] = {
                name: `Fishing Boat SOS (${this.rescueFreq.toFixed(1)} kHz)`,
                position: this.boatPosition
            };
            window.navRadio.stations[this.baseFreq] = {
                name: `Main Base (${this.baseFreq.toFixed(1)} kHz)`,
                position: centerPos
            };
        }

        if (this.pagerElement && this.statusDisplay && this.freqDisplay) {
            this.freqDisplay.textContent = `${this.rescueFreq.toFixed(1)} kHz`;
            this.statusDisplay.textContent = `EXTINGUISH FIRE`;
            this.pagerElement.style.display = 'block';
        }
    }

    triggerRescue(type) {
        if (this.activeRescue !== null) return;
        this.activeRescue = type;

        if (type === 'water') {
            if (this.petewaterObject) this.petewaterObject.visible = false;
            this.petewaterActions.forEach(action => action.stop());
            if (this.peteraisingModel) this.peteraisingModel.visible = true;
        } else if (type === 'waving') {
            if (this.petewavingObject) this.petewavingObject.visible = false;
            this.petewavingActions.forEach(action => action.stop());
            if (this.raisingModel) this.raisingModel.visible = true;
        }
    }

    extinguishFire() {
        if (!this.hasActiveFire) return;
        this.hasActiveFire = false;
        if (this.fireParticleSystem) this.fireParticleSystem.visible = false;
        if (this.smokeParticleSystem) this.smokeParticleSystem.visible = false;
        if (this.statusDisplay) {
            this.statusDisplay.textContent = `RESCUE PETE & PETE`;
        }
    }

    reset() {
        this.state = 'IDLE';
        this.activeRescue = null;
        this.rescuedCount = 0;
        this.bothRescuedAndLanded = false;
        this.disembarkTimer = 0;
        this.hasActiveFire = true;
        this.currentWaterHits = 0;

        if (this.pagerElement) {
            this.pagerElement.style.display = 'none';
        }
        if (this.fireParticleSystem) this.fireParticleSystem.visible = true;
        if (this.smokeParticleSystem) this.smokeParticleSystem.visible = true;
        if (this.boatModel) this.boatModel.visible = false;
        if (this.searchlightTarget) {
            this.scene.remove(this.searchlightTarget);
        }

        if (this.petewaterObject) this.petewaterObject.visible = true;
        if (this.petewavingObject) this.petewavingObject.visible = true;

        if (this.peteraisingModel) this.peteraisingModel.visible = false;
        if (this.raisingModel) this.raisingModel.visible = false;
        if (this.petewavingbyeModel) this.petewavingbyeModel.visible = false;

        this.petewaterActions.forEach(action => action.play());
        this.petewavingActions.forEach(action => action.play());

        if (window.navRadio && window.navRadio.stations) {
            if (window.navRadio.stations[this.rescueFreq]) {
                delete window.navRadio.stations[this.rescueFreq];
            }
            if (window.navRadio.stations[this.baseFreq]) {
                delete window.navRadio.stations[this.baseFreq];
            }
            window.navRadio.stations[210.0] = {
                name: "Buoy System (210.0 kHz)",
                position: (window.buoySystem && window.buoySystem.getBuoyPosition) ? window.buoySystem.getBuoyPosition() : new THREE.Vector3(0, 0, 0)
            };
        }
    }

    warmup(renderer, camera) {
        if (!renderer || !camera || !this.boatModel) return;
        this.boatModel.traverse((child) => {
            if (child.isMesh) child.updateMatrixWorld(true);
        });
        [this.peteraisingModel, this.raisingModel, this.petewavingbyeModel].forEach(model => {
            if (model) {
                model.traverse((child) => {
                    if (child.isMesh) child.updateMatrixWorld(true);
                });
            }
        });
        renderer.compile(this.scene, camera);
        renderer.render(this.scene, camera);
    }

    update(delta, player, mainBase, waterSystem = null) {
        if (this.state === 'IDLE' || this.state === 'COMPLETED') return;

        if (mainBase && !this.mainBase) {
            this.mainBase = mainBase;
        }

        // Synchronize searchlight target with the boat model position
        if (this.searchlightTarget) {
            if (this.boatModel && this.boatModel.visible) {
                this.searchlightTarget.position.copy(this.boatModel.position);
            } else {
                this.searchlightTarget.position.copy(this.boatPosition);
            }
            this.searchlightTarget.updateMatrixWorld(true);

            if (player) {
                const searchlight = player.searchlight || (player.helicopter && player.helicopter.searchlight);
                if (searchlight) {
                    searchlight.target = this.searchlightTarget;
                }
            }
        }

        if (this.boatMixer) this.boatMixer.update(delta);
        if (this.peteraisingMixer) this.peteraisingMixer.update(delta);
        if (this.raisingMixer) this.raisingMixer.update(delta);
        if (this.petewavingbyeMixer) this.petewavingbyeMixer.update(delta);

        if (this.hasActiveFire && this.fireParticleSystem && this.smokeParticleSystem) {
            this.fireParticleSystem.position.copy(this.fireOffset);
            this.smokeParticleSystem.position.copy(this.fireOffset);

            const firePosArr = this.fireParticleGeo.attributes.position.array;
            for (let i = 0; i < this.fireParticlesCount; i++) {
                const idx = i * 3;
                const age = this.fireLifetimes[i];
                
                const waveX = Math.sin(firePosArr[idx + 1] * 0.3 + age * 5.0) * 0.8 * this.fireScale;
                const waveZ = Math.cos(firePosArr[idx + 1] * 0.3 + age * 5.0) * 0.8 * this.fireScale;

                firePosArr[idx] += (this.fireVelocities[idx] * this.fireScale + waveX) * delta;
                firePosArr[idx + 1] += this.fireVelocities[idx + 1] * this.fireScale * delta;
                firePosArr[idx + 2] += (this.fireVelocities[idx + 2] * this.fireScale + waveZ) * delta;

                this.fireLifetimes[i] += delta;

                if (this.fireLifetimes[i] >= this.fireMaxLifetimes[i] || firePosArr[idx + 1] > 15.0 * this.fireScale) {
                    firePosArr[idx] = (Math.random() - 0.5) * 2.5 * this.fireScale;
                    firePosArr[idx + 1] = (Math.random() - 0.5) * 1.0;
                    firePosArr[idx + 2] = (Math.random() - 0.5) * 2.5 * this.fireScale;
                    this.fireLifetimes[i] = 0;
                }
            }
            this.fireParticleGeo.attributes.position.needsUpdate = true;

            const smokePosArr = this.smokeParticleGeo.attributes.position.array;
            for (let i = 0; i < this.smokeParticlesCount; i++) {
                const idx = i * 3;
                const age = this.smokeLifetimes[i];
                const maxLife = this.smokeMaxLifetimes[i];
                const lifeRatio = age / maxLife;

                const expansion = 1.0 + lifeRatio * 1.5;
                const rollX = Math.sin(smokePosArr[idx + 1] * 0.15 + age * 2.5) * 1.5 * expansion * this.fireScale;
                const rollZ = Math.cos(smokePosArr[idx + 1] * 0.15 + age * 2.5) * 1.5 * expansion * this.fireScale;

                smokePosArr[idx] += (this.smokeVelocities[idx] * this.fireScale * 0.7 + rollX) * delta;
                smokePosArr[idx + 1] += (this.smokeVelocities[idx + 1] * this.fireScale * (1.0 + lifeRatio * 0.8)) * delta;
                smokePosArr[idx + 2] += (this.smokeVelocities[idx + 2] * this.fireScale * 0.7 + rollZ) * delta;

                this.smokeLifetimes[i] += delta;

                if (this.smokeLifetimes[i] >= maxLife || smokePosArr[idx + 1] > 45.0 * this.fireScale) {
                    smokePosArr[idx] = (Math.random() - 0.5) * 3.5 * this.fireScale;
                    smokePosArr[idx + 1] = 1.0 + Math.random() * 3.0;
                    smokePosArr[idx + 2] = (Math.random() - 0.5) * 3.5 * this.fireScale;
                    this.smokeLifetimes[i] = 0;
                }
            }
            this.smokeParticleGeo.attributes.position.needsUpdate = true;

            if (waterSystem && waterSystem.particleGeometry && this.boatModel) {
                const fireWorldPos = new THREE.Vector3();
                this.fireParticleSystem.getWorldPosition(fireWorldPos);

                const waterPosArr = waterSystem.particleGeometry.attributes.position.array;
                const hitRadius = 15.0 * this.fireScale;

                for (let p = 0; p < waterSystem.particlesCount; p++) {
                    const pIdx = p * 3;
                    const wy = waterPosArr[pIdx + 1];
                    if (wy > -4000) {
                        const wx = waterPosArr[pIdx];
                        const wz = waterPosArr[pIdx + 2];
                        const dx = wx - fireWorldPos.x;
                        const dy = wy - fireWorldPos.y;
                        const dz = wz - fireWorldPos.z;
                        const distSq = dx * dx + dy * dy + dz * dz;

                        if (distSq < hitRadius * hitRadius) {
                            this.currentWaterHits++;
                            waterPosArr[pIdx + 1] = -5000;
                            waterSystem.lifetimes[p] = 0;

                            if (this.currentWaterHits >= this.waterHitsRequired) {
                                this.extinguishFire();
                                break;
                            }
                        }
                    }
                }
                waterSystem.particleGeometry.attributes.position.needsUpdate = true;
            }
        }

        const winch = player ? (player.winchSystem || (player.rescueMission ? player.rescueMission.winchSystem : null)) : null;
        if (!winch) return;

        const hookPos = winch.getHookWorldPosition ? winch.getHookWorldPosition() : (winch.getHookPosition ? winch.getHookPosition() : null);
        if (!hookPos) return;

        const currentCableLength = winch.currentCableLength || 0.0;

        if (this.activeRescue === null && this.rescuedCount < 2 && this.boatModel && !this.hasActiveFire) {
            if (this.petewaterObject && this.petewaterObject.visible) {
                const pos = new THREE.Vector3();
                this.petewaterObject.getWorldPosition(pos);
                if (Math.hypot(hookPos.x - pos.x, hookPos.z - pos.z) <= 4.0 && Math.abs(hookPos.y - pos.y) <= 3.0) {
                    this.triggerRescue('water');
                }
            }
            if (this.activeRescue === null && this.petewavingObject && this.petewavingObject.visible) {
                const pos = new THREE.Vector3();
                this.petewavingObject.getWorldPosition(pos);
                if (Math.hypot(hookPos.x - pos.x, hookPos.z - pos.z) <= 4.0 && Math.abs(hookPos.y - pos.y) <= 3.0) {
                    this.triggerRescue('waving');
                }
            }
        }

        if (this.activeRescue !== null) {
            const activeModel = (this.activeRescue === 'water') ? this.peteraisingModel : this.raisingModel;

            if (activeModel) {
                if (currentCableLength <= 0.2 || winch.winchState === 'UP') {
                    activeModel.visible = false;
                    this.activeRescue = null;
                    this.rescuedCount++;
                    
                    if (this.rescuedCount >= 2 && this.pagerElement) {
                        this.pagerElement.style.display = 'none';
                    } else if (this.rescuedCount < 2 && this.statusDisplay) {
                        this.statusDisplay.textContent = `RESCUE NEXT PETE`;
                    }
                    return;
                }

                const worldOffset = this.attachmentOffset.clone();
                if (player && player.model) {
                    worldOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.model.rotation.y);
                }

                activeModel.position.copy(hookPos.clone().add(worldOffset));

                if (player && player.model) {
                    activeModel.rotation.copy(new THREE.Euler(
                        this.pitchAngle,
                        player.model.rotation.y + this.yawAngle,
                        this.rollAngle,
                        'YXZ'
                    ));
                }
            }
        }

        let hasResurrectedAtSpawn = false;
        if (player && player.model && (this.rescuedCount > 0 || this.activeRescue !== null)) {
            const heliPos = player.model.position;
            const spawnPos = (this.mainBase && typeof this.mainBase.getSpawnPosition === 'function') 
                ? this.mainBase.getSpawnPosition() 
                : new THREE.Vector3(3.3690, 6.2360, 0.4548);
            const distToSpawn = Math.hypot(heliPos.x - spawnPos.x, heliPos.z - spawnPos.z);
            
            if (distToSpawn < 10.0 && (player.isCrashed || player.hasCrashed || player.isResawning || (player.verticalSpeed === 0 && Math.abs(player.currentMoveSpeed || 0) < 0.1))) {
                hasResurrectedAtSpawn = true;
            }
        }

        const isFullyRescued = (this.rescuedCount >= 2) || hasResurrectedAtSpawn;

        if (isFullyRescued && !this.bothRescuedAndLanded && player && player.model) {
            if (hasResurrectedAtSpawn) {
                this.rescuedCount = 2;
                if (this.peteraisingModel) this.peteraisingModel.visible = false;
                if (this.raisingModel) this.raisingModel.visible = false;
                if (this.pagerElement) {
                    this.pagerElement.style.display = 'none';
                }
            }

            const heliPos = player.model.position;
            const spawnPos = (this.mainBase && typeof this.mainBase.getSpawnPosition === 'function') 
                ? this.mainBase.getSpawnPosition() 
                : new THREE.Vector3(3.3690, 6.2360, 0.4548);
            const horizDist = Math.hypot(heliPos.x - spawnPos.x, heliPos.z - spawnPos.z);
            const vertDist = Math.abs(heliPos.y - spawnPos.y);

            const isLanded = hasResurrectedAtSpawn || ((horizDist < 35.0 && vertDist < 5.0) && 
                             (player.isGrounded || Math.abs(player.currentMoveSpeed || 0) < 1.0 || (player.verticalSpeed !== undefined && Math.abs(player.verticalSpeed) < 0.5)));

            const engineOff = hasResurrectedAtSpawn || player.engineOn === false || 
                              player.isEngineRunning === false || 
                              player.engineState === 'OFF' || 
                              (!player.engineOn && !player.isEngineRunning && player.engineState !== 'RUNNING');

            const fuelPumpOff = hasResurrectedAtSpawn || player.fuelPumpOn === false || 
                                 player.fuelPump === false || 
                                 player.isFuelPumpOn === false || 
                                 (!player.fuelPumpOn && !player.fuelPump);

            const electricalOff = hasResurrectedAtSpawn || player.electricalOn === false || 
                                  player.batteryOn === false || 
                                  player.battery === false || 
                                  player.isElectricalOn === false || 
                                  (!player.electricalOn && !player.batteryOn && !player.battery);

            const allSystemsOff = engineOff && fuelPumpOff && electricalOff;

            if (isLanded && allSystemsOff) {
                this.bothRescuedAndLanded = true;
                this.disembarkTimer = this.disembarkDuration;
                if (this.petewavingbyeModel) {
                    this.petewavingbyeModel.position.copy(this.goodbyeWorldPosition);
                    this.petewavingbyeModel.rotation.y = this.goodbyeWorldRotationY;
                    this.petewavingbyeModel.visible = true;
                }
                if (window.navRadio && window.navRadio.stations) {
                    if (window.navRadio.stations[this.rescueFreq]) {
                        delete window.navRadio.stations[this.rescueFreq];
                    }
                    if (window.navRadio.stations[this.baseFreq]) {
                        delete window.navRadio.stations[this.baseFreq];
                    }
                    window.navRadio.stations[210.0] = {
                        name: "Buoy System (210.0 kHz)",
                        position: (window.buoySystem && window.buoySystem.getBuoyPosition) ? window.buoySystem.getBuoyPosition() : new THREE.Vector3(0, 0, 0)
                    };
                }
            }
        }

        if (this.bothRescuedAndLanded && this.petewavingbyeModel) {
            if (this.disembarkTimer > 0) {
                this.disembarkTimer -= delta;
                if (this.disembarkTimer <= 0) {
                    this.petewavingbyeModel.visible = false;
                    this.state = 'COMPLETED';
                }
            }
        }

        if (this.boatModel) {
            const allTasksAccomplished = this.bothRescuedAndLanded && !this.hasActiveFire;
            if (allTasksAccomplished) {
                this.boatModel.visible = false;
            }
        }
    }
}