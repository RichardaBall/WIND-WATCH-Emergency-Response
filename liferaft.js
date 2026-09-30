import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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
        activeRenderer.compile(gltfScene, activeCamera);
    }
}

export class LiferaftManager {
    constructor(scene, loadingManager = null) {
        this.scene = scene;
        this.raftGroup = new THREE.Group();
        this.isDeployed = false;
        this.raftGroup.visible = false;
        this.scene.add(this.raftGroup);

        this.mixer = null;

        this.restartBtn = document.createElement('button');
        this.restartBtn.id = 'restart-flight-btn';
        this.restartBtn.innerHTML = 'RESTART FLIGHT';
        this.restartBtn.style.cssText = `
            position: fixed;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(17, 24, 39, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #ffffff;
            padding: 12px 28px;
            font-family: monospace;
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            border-radius: 4px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            transition: background 0.2s, transform 0.2s, border-color 0.2s;
            display: none;
        `;

        this.restartBtn.addEventListener('mouseenter', () => {
            this.restartBtn.style.background = 'rgba(31, 41, 55, 0.7)';
            this.restartBtn.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            this.restartBtn.style.transform = 'translateX(-50%) scale(1.05)';
        });

        this.restartBtn.addEventListener('mouseleave', () => {
            this.restartBtn.style.background = 'rgba(17, 24, 39, 0.5)';
            this.restartBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            this.restartBtn.style.transform = 'translateX(-50%) scale(1.0)';
        });

        this.restartBtn.addEventListener('click', () => {
            location.reload();
        });

        document.body.appendChild(this.restartBtn);

        const manager = (loadingManager && typeof loadingManager.itemStart === 'function') 
            ? loadingManager 
            : THREE.DefaultLoadingManager;

        const loader = new GLTFLoader(manager);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            './liferaft.glb',
            (gltf) => {
                optimizeAndWarmUpGltf(gltf.scene);
                const model = gltf.scene;
                model.scale.set(1, 1, 1);
                this.raftGroup.add(model);

                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(model);
                    const action = this.mixer.clipAction(gltf.animations[0]);
                    action.play();
                }

                console.log("liferaft.glb loaded successfully.");
            },
            undefined,
            (error) => {
                console.error("An error occurred while loading liferaft.glb:", error);
            }
        );
    }

    deploy(crashPosition) {
        if (this.isDeployed) return;
        this.isDeployed = true;

        this.raftGroup.position.set(crashPosition.x, 0.0, crashPosition.z);
        this.raftGroup.visible = true;
        
        if (this.restartBtn) {
            this.restartBtn.style.display = 'block';
        }

        console.log("Custom liferaft deployed successfully at:", crashPosition);
    }

    showRestart() {
        if (this.restartBtn) {
            this.restartBtn.style.display = 'block';
        }
    }

    update(delta) {
        if (!this.isDeployed || !this.raftGroup) return;

        if (this.mixer) {
            this.mixer.update(delta);
        }

        const time = Date.now() * 0.002;
        this.raftGroup.position.y = Math.sin(time) * 0.15;
        this.raftGroup.rotation.z = Math.cos(time * 0.7) * 0.03;
        this.raftGroup.rotation.x = Math.sin(time * 0.5) * 0.03;
    }
}