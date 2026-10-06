import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

function optimizeAndWarmUpGltf(gltfScene, renderer = null, mixer = null) {
    const activeRenderer = renderer || window.renderer || null;
    const activeCamera = window.camera || new THREE.PerspectiveCamera(60, 1, 0.1, 5000);

    const prevVisible = gltfScene.visible;
    gltfScene.visible = true;

    if (mixer) {
        mixer.update(0.016);
    }

    gltfScene.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
            child.frustumCulled = false;
            child.updateMatrixWorld(true);
            
            if (child.skeleton) {
                child.skeleton.update();
            }

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
        activeRenderer.compile(gltfScene, activeCamera);
    }

    gltfScene.visible = prevVisible;
}

export const SurvivorState = {
    IDLE: 'IDLE',
    ON_RAFT: 'ON_RAFT',
    WINCHING: 'WINCHING',
    IN_CABIN: 'IN_CABIN',
    DISEMBARKING: 'DISEMBARKING',
    WAVING: 'WAVING',
    COMPLETED: 'COMPLETED'
};

export class Survivor {
    constructor(scene, loadingManager = null, renderer = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.renderer = renderer;
        
        this.meshes = {
            raising: null,
            wavingbye: null
        };
        this.mixers = {
            raising: null,
            wavingbye: null
        };
        this.actions = {
            raising: null,
            wavingbye: null
        };

        this.activeKey = null;
        this.mesh = null;
        this.mixer = null;
        this.currentAction = null;
        this.currentState = SurvivorState.IDLE;
        
        this.targetHeight = 1.75 * 1.25;  
        this.fadeDuration = 2.5;   
        this.fadeTimer = 0;
        this.isFading = false;
        this.handOffset = 0.55 * 1.25;    

        this.raftPosition = null;
        this.raftRotationY = 0;
        this.pendingDisembarkPos = null;
        this.pendingHeliRotY = 0;
        this.pendingDeckY = null;
        this.pendingAutoFade = true;
    }

    async loadModels(files = null, renderer = null) {
        const manager = (this.loadingManager && typeof this.loadingManager.itemStart === 'function') 
            ? this.loadingManager 
            : THREE.DefaultLoadingManager;

        const loader = new GLTFLoader(manager);

        const dracoLoader = new DRACOLoader(manager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        const ktx2Loader = new KTX2Loader(manager);
        ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
        const activeRenderer = renderer || this.renderer || window.renderer;
        if (activeRenderer) {
            ktx2Loader.detectSupport(activeRenderer);
        }
        loader.setKTX2Loader(ktx2Loader);

        const tryPathsForModel = (filename) => {
            const candidates = [
                filename,
                `assets/character/${filename}`,
                `assets/${filename}`,
                `./assets/character/${filename}`,
                `./assets/${filename}`,
                `./${filename}`
            ];

            return new Promise((resolve) => {
                let attemptIndex = 0;

                const attemptNext = () => {
                    if (attemptIndex >= candidates.length) {
                        console.error(`[Survivor] All candidate paths failed for model '${filename}'.`);
                        resolve(null);
                        return;
                    }

                    const currentPath = candidates[attemptIndex];
                    attemptIndex++;

                    if (manager && typeof manager.itemStart === 'function') {
                        manager.itemStart(currentPath);
                    }

                    loader.load(
                        currentPath,
                        (gltf) => {
                            console.log(`[Survivor] Successfully loaded character model from: ${currentPath}`);
                            if (manager && typeof manager.itemEnd === 'function') {
                                manager.itemEnd(currentPath);
                            }
                            resolve(gltf);
                        },
                        undefined,
                        (err) => {
                            if (manager && typeof manager.itemEnd === 'function') {
                                manager.itemEnd(currentPath);
                            }
                            attemptNext();
                        }
                    );
                };

                attemptNext();
            });
        };

        try {
            const [raisingGltf, wavingbyeGltf] = await Promise.all([
                tryPathsForModel('raising.glb'),
                tryPathsForModel('wavingbye.glb')
            ]);

            const processGltf = (gltf, key) => {
                if (!gltf) return null;
                const mesh = gltf.scene;

                const mixer = new THREE.AnimationMixer(mesh);
                let action = null;
                if (gltf.animations && gltf.animations.length > 0) {
                    action = mixer.clipAction(gltf.animations[0]);
                }

                optimizeAndWarmUpGltf(mesh, activeRenderer, mixer);

                mesh.updateMatrixWorld(true);
                const bbox = new THREE.Box3().setFromObject(mesh);
                const size = new THREE.Vector3();
                bbox.getSize(size);

                if (size.y > 0.05 && size.y < 100) {
                    const scale = (this.targetHeight / size.y);
                    mesh.scale.set(scale, scale, scale);
                } else {
                    mesh.scale.set(1.25, 1.25, 1.25);
                }

                mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(m => {
                                    const cloned = m.clone();
                                    cloned.transparent = true;
                                    cloned.opacity = 1.0;
                                    cloned.needsUpdate = true;
                                    return cloned;
                                });
                            } else {
                                child.material = child.material.clone();
                                child.material.transparent = true;
                                child.material.opacity = 1.0;
                                child.material.needsUpdate = true;
                            }
                        }
                    }
                });

                mesh.visible = false;
                this.scene.add(mesh);

                this.meshes[key] = mesh;
                this.mixers[key] = mixer;
                this.actions[key] = action;
                return mesh;
            };

            processGltf(raisingGltf, 'raising');
            processGltf(wavingbyeGltf, 'wavingbye');

            const fallbackMesh = this.meshes['raising'] || this.meshes['wavingbye'];
            const fallbackMixer = this.mixers['raising'] || this.mixers['wavingbye'];
            const fallbackAction = this.actions['raising'] || this.actions['wavingbye'];

            if (!this.meshes['raising']) { this.meshes['raising'] = fallbackMesh; this.mixers['raising'] = fallbackMixer; this.actions['raising'] = fallbackAction; }
            if (!this.meshes['wavingbye']) { this.meshes['wavingbye'] = fallbackMesh; this.mixers['wavingbye'] = fallbackMixer; this.actions['wavingbye'] = fallbackAction; }

            if (this.currentState === SurvivorState.DISEMBARKING || this.currentState === SurvivorState.WAVING) {
                this.disembarkNextToHelicopter(this.pendingDisembarkPos, this.pendingHeliRotY, this.pendingDeckY, this.pendingAutoFade);
            } else if (this.currentState === SurvivorState.ON_RAFT && this.raftPosition) {
                this.spawnOnRaft(this.raftPosition, this.raftRotationY);
            }

            return true;
        } catch (error) {
            console.error('[Survivor] Error loading survivor models:', error);
            return false;
        }
    }

    setOpacity(val) {
        Object.values(this.meshes).forEach(mesh => {
            if (!mesh) return;
            mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat) => {
                            mat.transparent = true;
                            mat.opacity = val;
                            mat.needsUpdate = true;
                        });
                    } else {
                        child.material.transparent = true;
                        child.material.opacity = val;
                        child.material.needsUpdate = true;
                    }
                }
            });
        });
    }

    setActiveModel(key, loop = true, playImmediately = true) {
        this.activeKey = key;
        
        Object.keys(this.meshes).forEach(k => {
            if (this.meshes[k]) {
                this.meshes[k].visible = (k === key);
            }
        });

        this.mesh = this.meshes[key];
        this.mixer = this.mixers[key];
        const nextAction = this.actions[key];

        if (nextAction && this.mixer) {
            this.mixer.stopAllAction();
            if (playImmediately) {
                nextAction
                    .reset()
                    .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
                    .setEffectiveTimeScale(1)
                    .setEffectiveWeight(1)
                    .play();

                nextAction.clampWhenFinished = !loop;
            }
            this.currentAction = nextAction;
        } else {
            this.currentAction = null;
        }
    }

    spawnOnRaft(raftPosition, raftRotationY = 0) {
        this.raftPosition = raftPosition.clone();
        this.raftRotationY = raftRotationY;
        this.currentState = SurvivorState.ON_RAFT;
        this.isFading = false;
        this.fadeTimer = 0;
        this.setOpacity(1.0);

        this.setActiveModel('raising', true, true);
        if (this.mesh) {
            this.mesh.visible = true;
            this.mesh.position.copy(this.raftPosition);
            this.mesh.rotation.set(0, this.raftRotationY, 0);
            this.mesh.updateMatrixWorld(true);
        }
    }

    attachToWinch() {
        this.currentState = SurvivorState.WINCHING;
        this.isFading = false;
        this.fadeTimer = 0;
        this.setOpacity(1.0);

        this.setActiveModel('raising', true, true);
        if (this.mesh) {
            this.mesh.visible = true;
        }
    }

    enterCabin() {
        this.currentState = SurvivorState.IN_CABIN;
        Object.values(this.meshes).forEach(m => {
            if (m) m.visible = false;
        });
    }

    disembarkNextToHelicopter(posOrHeliPos = { x: 5.869, y: 6.236, z: 1.4548 }, helicopterRotationY = 0, deckY = null, autoFade = true) {
        this.currentState = SurvivorState.DISEMBARKING;
        this.pendingDisembarkPos = posOrHeliPos;
        this.pendingHeliRotY = helicopterRotationY;
        this.pendingDeckY = deckY;
        this.pendingAutoFade = autoFade;

        this.setOpacity(1.0);
        this.isFading = false;
        this.fadeTimer = 0;

        this.setActiveModel('wavingbye', true, true);
        if (!this.mesh) return;

        if (posOrHeliPos && typeof posOrHeliPos === 'object' && ('x' in posOrHeliPos) && ('z' in posOrHeliPos) && !posOrHeliPos.isVector3) {
            const x = posOrHeliPos.x !== undefined ? posOrHeliPos.x : 5.869;
            const y = posOrHeliPos.y !== undefined ? posOrHeliPos.y : 6.236;
            const z = posOrHeliPos.z !== undefined ? posOrHeliPos.z : 1.4548;
            const rotY = posOrHeliPos.rotationY !== undefined ? posOrHeliPos.rotationY : (Math.PI / 2);

            this.mesh.position.set(x, y, z);
            this.mesh.rotation.set(0, rotY, 0);
        } else if (posOrHeliPos && posOrHeliPos.isVector3) {
            const offsetDistance = 3.0;
            const sideAngle = helicopterRotationY - Math.PI / 2;
            const offsetX = Math.sin(sideAngle) * offsetDistance;
            const offsetZ = Math.cos(sideAngle) * offsetDistance;

            const targetY = (deckY !== null && deckY !== undefined) ? deckY : posOrHeliPos.y;

            this.mesh.position.set(
                posOrHeliPos.x + offsetX,
                targetY,
                posOrHeliPos.z + offsetZ
            );

            this.mesh.lookAt(posOrHeliPos.x, targetY, posOrHeliPos.z);
        } else {
            this.mesh.position.set(5.869, 6.236, 1.4548);
            this.mesh.rotation.set(0, Math.PI / 2, 0);
        }

        this.mesh.visible = true;
        this.mesh.updateMatrixWorld(true);
        this.currentState = SurvivorState.WAVING;

        if (autoFade) {
            setTimeout(() => {
                if (this.currentState === SurvivorState.WAVING) {
                    this.isFading = true;
                    this.fadeTimer = 0;
                }
            }, 7500);
        }
    }

    update(deltaTime, hookPosition = null) {
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.isFading && this.mesh && this.mesh.visible) {
            this.fadeTimer += deltaTime;
            const alpha = Math.max(0, 1.0 - (this.fadeTimer / this.fadeDuration));
            this.setOpacity(alpha);

            if (alpha <= 0) {
                this.isFading = false;
                Object.values(this.meshes).forEach(m => { if (m) m.visible = false; });
                this.currentState = SurvivorState.COMPLETED;
            }
        }

        switch (this.currentState) {
            case SurvivorState.ON_RAFT:
                if (this.mesh && this.raftPosition) {
                    this.mesh.position.copy(this.raftPosition);
                    this.mesh.visible = true;
                }
                break;
            case SurvivorState.WINCHING:
                if (hookPosition && this.mesh) {
                    this.mesh.position.copy(hookPosition);
                    this.mesh.position.y -= this.handOffset;
                    this.mesh.visible = true;
                }
                break;
        }
    }
}