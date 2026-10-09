import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class WindFarm {
    constructor(scene, loadingManager) {
        this.scene = scene;
        this.turbines = [];

        window.windFarm = this;

        this.activeFireIndex = -1;
        this.fireParticleSystem = null;
        this.smokeParticleSystem = null;
        this.fireParticlesCount = 600;
        this.smokeParticlesCount = 600;
        
        this.fireParticleGeo = null;
        this.smokeParticleGeo = null;
        this.fireVelocities = new Float32Array(this.fireParticlesCount * 3);
        this.smokeVelocities = new Float32Array(this.smokeParticlesCount * 3);
        this.fireLifetimes = new Float32Array(this.fireParticlesCount);
        this.fireMaxLifetimes = new Float32Array(this.fireParticlesCount);
        this.smokeLifetimes = new Float32Array(this.smokeParticlesCount);
        this.smokeMaxLifetimes = new Float32Array(this.smokeParticlesCount);

        this.waterHitsRequired = 30;
        this.currentWaterHits = 0;

        // Fixed navigation frequencies for each WTG
        this.wtgFrequencies = [350.0, 240.0, 290.0];

        const dracoLoader = new DRACOLoader(loadingManager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

        const loader = loadingManager ? new GLTFLoader(loadingManager) : new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load('WTG.glb', (gltf) => {
            const baseModel = gltf.scene;

            baseModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = false;
                    child.receiveShadow = false;
                    child.frustumCulled = false;
                }
            });

            const baseRadius = 750;
            const radiusIncrement = 180;
            const angleStep = (Math.PI * 2) / 3;

            for (let i = 0; i < 3; i++) {
                const turbineGroup = baseModel.clone(true);
                turbineGroup.frustumCulled = false;

                const currentRadius = baseRadius + (i * radiusIncrement);
                const currentAngle = i * angleStep;

                const xPos = Math.cos(currentAngle) * currentRadius;
                const zPos = Math.sin(currentAngle) * currentRadius;
                const yPos = -0.95;

                turbineGroup.position.set(xPos, yPos, zPos);
                turbineGroup.scale.set(0.5, 0.5, 0.5);
                
                const targetX = 0;
                const targetZ = 0;
                const dx = targetX - xPos;
                const dz = targetZ - zPos;
                turbineGroup.rotation.y = Math.atan2(dx, dz);

                turbineGroup.updateMatrixWorld(true);
                this.scene.add(turbineGroup);

                let rotorMesh = null;
                const meshes = [];

                turbineGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.frustumCulled = false;
                        meshes.push(child);
                        const name = child.name.toLowerCase();
                        if (name.includes('rotor') || name.includes('blade') || name.includes('fan') || name.includes('propeller') || name.includes('spin')) {
                            rotorMesh = child;
                        }
                    }
                });

                if (!rotorMesh && meshes.length > 1) {
                    rotorMesh = meshes[1];
                } else if (!rotorMesh && meshes.length === 1) {
                    rotorMesh = meshes[0];
                }

                if (rotorMesh) {
                    rotorMesh.rotation.z = Math.random() * Math.PI * 2;
                }

                const lightGroup = new THREE.Group();
                const light = new THREE.PointLight(0xff4400, 4.0, 18);
                light.position.set(0, 85, 0);
                light.castShadow = false;
                lightGroup.add(light);

                const bulbGeo = new THREE.SphereGeometry(0.5, 6, 6);
                const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
                const bulb = new THREE.Mesh(bulbGeo, bulbMat);
                bulb.position.copy(light.position);
                lightGroup.add(bulb);

                turbineGroup.add(lightGroup);

                const defaultBboxConfig = { offsetX: 0, offsetY: 42.5, offsetZ: 0, sizeX: 6, sizeY: 85, sizeZ: 6 };
                const bboxMesh = this.createBoundingBoxMesh(defaultBboxConfig, false);
                turbineGroup.add(bboxMesh);

                this.turbines.push({
                    group: turbineGroup,
                    rotor: rotorMesh,
                    light: light,
                    bulb: bulb,
                    bboxMesh: bboxMesh,
                    rotationSpeed: 1.2 + (i * 0.2) + Math.random() * 0.4,
                    timeOffset: i * 2.5 + Math.random() * 5,
                    frequency: this.wtgFrequencies[i]
                });
            }

            this.initFireVFX();
            console.log("Successfully loaded 3 wind turbines with fixed navigation frequencies.");

        }, undefined, (error) => {
            console.error("WTG model failed to load for wind farm:", error);
        });
    }

    createBoundingBoxMesh(config, visible = false) {
        const geo = new THREE.BoxGeometry(config.sizeX, config.sizeY, config.sizeZ);
        const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.4 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(config.offsetX, config.offsetY, config.offsetZ);
        mesh.visible = false;
        return mesh;
    }

    getCollisionBoxes() {
        const boxes = [];
        this.turbines.forEach((turbine) => {
            if (turbine.bboxMesh) {
                const box = new THREE.Box3();
                box.setFromObject(turbine.bboxMesh);
                boxes.push(box);
            }
        });
        return boxes;
    }

    initFireVFX() {
        this.fireParticleGeo = new THREE.BufferGeometry();
        const firePositions = new Float32Array(this.fireParticlesCount * 3);
        
        for (let i = 0; i < this.fireParticlesCount; i++) {
            firePositions[i * 3] = (Math.random() - 0.5) * 3.0;
            firePositions[i * 3 + 1] = Math.random() * 10.0;
            firePositions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;

            this.fireVelocities[i * 3] = (Math.random() - 0.5) * 1.5;
            this.fireVelocities[i * 3 + 1] = 8.0 + Math.random() * 6.0;
            this.fireVelocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;

            this.fireMaxLifetimes[i] = 0.7 + Math.random() * 0.6;
            this.fireLifetimes[i] = Math.random() * this.fireMaxLifetimes[i];
        }
        this.fireParticleGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));

        const fireCanvas = document.createElement('canvas');
        fireCanvas.width = 256;
        fireCanvas.height = 256;
        const fireCtx = fireCanvas.getContext('2d');
        const fireGrad = fireCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        fireGrad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
        fireGrad.addColorStop(0.2, 'rgba(255, 180, 50, 0.9)');
        fireGrad.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
        fireGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        fireCtx.fillStyle = fireGrad;
        fireCtx.fillRect(0, 0, 256, 256);
        const fireTexture = new THREE.CanvasTexture(fireCanvas);

        const fireMat = new THREE.PointsMaterial({ color: 0xffffff, size: 16.0, map: fireTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 });
        this.fireParticleSystem = new THREE.Points(this.fireParticleGeo, fireMat);
        this.fireParticleSystem.frustumCulled = false;
        this.fireParticleSystem.visible = false;
        this.scene.add(this.fireParticleSystem);

        this.smokeParticleGeo = new THREE.BufferGeometry();
        const smokePositions = new Float32Array(this.smokeParticlesCount * 3);

        for (let i = 0; i < this.smokeParticlesCount; i++) {
            smokePositions[i * 3] = (Math.random() - 0.5) * 4.0;
            smokePositions[i * 3 + 1] = 2.0 + Math.random() * 18.0;
            smokePositions[i * 3 + 2] = (Math.random() - 0.5) * 4.0;

            this.smokeVelocities[i * 3] = (Math.random() - 0.5) * 2.5;
            this.smokeVelocities[i * 3 + 1] = 6.0 + Math.random() * 5.0;
            this.smokeVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.5;

            this.smokeMaxLifetimes[i] = 1.8 + Math.random() * 1.2;
            this.smokeLifetimes[i] = Math.random() * this.smokeMaxLifetimes[i];
        }
        this.smokeParticleGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));

        const smokeCanvas = document.createElement('canvas');
        smokeCanvas.width = 256;
        smokeCanvas.height = 256;
        const smokeCtx = smokeCanvas.getContext('2d');
        const smokeGrad = smokeCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
        smokeGrad.addColorStop(0.0, 'rgba(70, 70, 70, 0.7)');
        smokeGrad.addColorStop(0.35, 'rgba(50, 50, 50, 0.45)');
        smokeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        smokeCtx.fillStyle = smokeGrad;
        smokeCtx.fillRect(0, 0, 256, 256);
        const smokeTexture = new THREE.CanvasTexture(smokeCanvas);

        const smokeMat = new THREE.PointsMaterial({ color: 0xffffff, size: 32.0, map: smokeTexture, transparent: true, blending: THREE.NormalBlending, depthWrite: false, opacity: 0.65 });
        this.smokeParticleSystem = new THREE.Points(this.smokeParticleGeo, smokeMat);
        this.smokeParticleSystem.frustumCulled = false;
        this.smokeParticleSystem.visible = false;
        this.scene.add(this.smokeParticleSystem);
    }

    spawnRandomFire() {
        if (this.turbines.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.turbines.length);
        this.spawnSpecificFire(randomIndex);
    }

    spawnSpecificFire(index) {
        this.activeFireIndex = index;
        this.currentWaterHits = 0;
        if (this.scene) {
            this.scene.userData.activeFireIndex = index;
        }

        if (this.fireParticleSystem) this.fireParticleSystem.visible = true;
        if (this.smokeParticleSystem) this.smokeParticleSystem.visible = true;

        const turbine = this.turbines[index];
        const freq = turbine.frequency;

        // Trigger pager notification popup matching rescue mission implementation
        const pagerEl = document.getElementById('rescue-pager-panel');
        const freqDisplay = document.getElementById('pager-freq');
        const statusDisplay = document.getElementById('pager-status');
        const titleEl = document.getElementById('pager-title');
        const callTypeEl = document.getElementById('pager-call-type');

        if (pagerEl && freqDisplay && statusDisplay) {
            if (titleEl) titleEl.textContent = 'PAGER [WTG FIRE]';
            if (callTypeEl) callTypeEl.textContent = `WTG #${index + 1} ALARM`;
            freqDisplay.textContent = `${freq.toFixed(1)} kHz`;
            statusDisplay.textContent = `WTG FIRE! EXTINGUISH`;
            pagerEl.style.display = 'block';
        }

        console.log(`[WindFarm] WTG #${index + 1} fire started! Navigation frequency: ${freq} kHz`);
    }

    extinguishFire() {
        console.log(`[WindFarm] Fire on turbine #${this.activeFireIndex + 1} successfully extinguished!`);
        this.activeFireIndex = -1;
        if (this.scene) {
            this.scene.userData.activeFireIndex = -1;
        }
        if (this.fireParticleSystem) this.fireParticleSystem.visible = false;
        if (this.smokeParticleSystem) this.smokeParticleSystem.visible = false;

        const pagerEl = document.getElementById('rescue-pager-panel');
        if (pagerEl) {
            pagerEl.style.display = 'none';
        }
    }

    update(delta, helicopterPosition, waterSystem) {
        const cullDistanceSq = 500.0 * 500.0;

        if (this.scene) {
            this.scene.userData.activeFireIndex = this.activeFireIndex;
        }

        if (this.activeFireIndex !== -1 && this.turbines[this.activeFireIndex]) {
            const turbine = this.turbines[this.activeFireIndex];
            const hubWorldPos = new THREE.Vector3();
            
            if (turbine.rotor) {
                turbine.rotor.getWorldPosition(hubWorldPos);
            } else {
                turbine.group.getWorldPosition(hubWorldPos);
                hubWorldPos.y += 42.5;
            }

            if (this.fireParticleSystem && this.smokeParticleSystem) {
                this.fireParticleSystem.position.copy(hubWorldPos);
                this.smokeParticleSystem.position.copy(hubWorldPos);

                const firePosArr = this.fireParticleGeo.attributes.position.array;
                for (let i = 0; i < this.fireParticlesCount; i++) {
                    const idx = i * 3;
                    const age = this.fireLifetimes[i];
                    
                    const waveX = Math.sin(firePosArr[idx + 1] * 0.3 + age * 5.0) * 0.8;
                    const waveZ = Math.cos(firePosArr[idx + 1] * 0.3 + age * 5.0) * 0.8;

                    firePosArr[idx] += (this.fireVelocities[idx] + waveX) * delta;
                    firePosArr[idx + 1] += this.fireVelocities[idx + 1] * delta;
                    firePosArr[idx + 2] += (this.fireVelocities[idx + 2] + waveZ) * delta;

                    this.fireLifetimes[i] += delta;

                    if (this.fireLifetimes[i] >= this.fireMaxLifetimes[i] || firePosArr[idx + 1] > 20.0) {
                        firePosArr[idx] = (Math.random() - 0.5) * 2.5;
                        firePosArr[idx + 1] = (Math.random() - 0.5) * 1.0;
                        firePosArr[idx + 2] = (Math.random() - 0.5) * 2.5;
                        this.fireLifetimes[i] = 0;
                    }
                }
                this.fireParticleGeo.attributes.position.needsUpdate = true;

                const smokePosArr = this.smokeParticleGeo.attributes.position.array;
                for (let i = 0; i < this.smokeParticlesCount; i++) {
                    const idx = i * 3;
                    const age = this.smokeLifetimes[i];

                    const rollX = Math.sin(smokePosArr[idx + 1] * 0.2 + age * 3.0) * 1.2;
                    const rollZ = Math.cos(smokePosArr[idx + 1] * 0.2 + age * 3.0) * 1.2;

                    smokePosArr[idx] += (this.smokeVelocities[idx] + rollX) * delta;
                    smokePosArr[idx + 1] += this.smokeVelocities[idx + 1] * delta;
                    smokePosArr[idx + 2] += (this.smokeVelocities[idx + 2] + rollZ) * delta;

                    this.smokeLifetimes[i] += delta;

                    if (this.smokeLifetimes[i] >= this.smokeMaxLifetimes[i] || smokePosArr[idx + 1] > 45.0) {
                        smokePosArr[idx] = (Math.random() - 0.5) * 3.5;
                        smokePosArr[idx + 1] = 2.0 + Math.random() * 3.0;
                        smokePosArr[idx + 2] = (Math.random() - 0.5) * 3.5;
                        this.smokeLifetimes[i] = 0;
                    }
                }
                this.smokeParticleGeo.attributes.position.needsUpdate = true;
            }

            if (waterSystem && waterSystem.particleGeometry) {
                const waterPosArr = waterSystem.particleGeometry.attributes.position.array;
                const hitRadius = 18.0;

                for (let p = 0; p < waterSystem.particlesCount; p++) {
                    const pIdx = p * 3;
                    const wy = waterPosArr[pIdx + 1];
                    if (wy > -4000) {
                        const wx = waterPosArr[pIdx];
                        const wz = waterPosArr[pIdx + 2];
                        const dx = wx - hubWorldPos.x;
                        const dy = wy - hubWorldPos.y;
                        const dz = wz - hubWorldPos.z;
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

        this.turbines.forEach((turbine) => {
            if (helicopterPosition) {
                const distSq = turbine.group.position.distanceToSquared(helicopterPosition);
                if (distSq > cullDistanceSq) return;
            }

            if (turbine.rotor) {
                turbine.rotor.rotation.z += delta * turbine.rotationSpeed;
            }

            if (turbine.light && turbine.bulb) {
                turbine.timeOffset += delta;
                const flicker = Math.sin(turbine.timeOffset * 25.0) * 0.8;
                const cycle = turbine.timeOffset % 1.0;
                const isOn = cycle < 0.4;
                
                turbine.light.intensity = isOn ? Math.max(1.0, 4.0 + flicker) : 0.0;
                turbine.bulb.visible = isOn;
            }
        });
    }
}