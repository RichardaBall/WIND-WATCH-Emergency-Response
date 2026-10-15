import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class SharkCatchSystem {
    constructor(scene, loadingManager = null, waterSystem = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.waterSystem = waterSystem;

        this.sharkCatchMesh = null;
        this.isCaught = false;

        this.isDropping = false;
        this.dropVelocityY = 0;
        this.gravity = 25.0; 

        this.catchDistanceThreshold = 3.0;

        this.mouthOffset = new THREE.Vector3(-0.23, -5.54, -0.63);
        this.pitchAngle = THREE.MathUtils.degToRad(-90.0);
        this.yawAngle = THREE.MathUtils.degToRad(0.0);
        this.rollAngle = THREE.MathUtils.degToRad(0.0);

        this.activeSplashes = [];

        this.initModel();
    }

    setWaterSystem(waterSystem) {
        this.waterSystem = waterSystem;
    }

    setOffsets(x = -0.23, y = -5.54, z = -0.63, pitchDeg = -90, yawDeg = 0, rollDeg = 0) {
        this.mouthOffset.set(x, y, z);
        this.pitchAngle = THREE.MathUtils.degToRad(pitchDeg);
        this.yawAngle = THREE.MathUtils.degToRad(yawDeg);
        this.rollAngle = THREE.MathUtils.degToRad(rollDeg);
    }

    initModel() {
        const manager = this.loadingManager || undefined;
        const loader = new GLTFLoader(manager);

        const dracoLoader = new DRACOLoader(manager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        if (window.renderer) {
            const ktx2Loader = new KTX2Loader(manager);
            ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
            ktx2Loader.detectSupport(window.renderer);
            loader.setKTX2Loader(ktx2Loader);
        }

        loader.setMeshoptDecoder(MeshoptDecoder);

        loader.load(
            'sharkcatch.glb',
            (gltf) => {
                this.sharkCatchMesh = gltf.scene;
                this.sharkCatchMesh.visible = false;

                this.sharkCatchMesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.scene.add(this.sharkCatchMesh);
            },
            undefined,
            (err) => {
                console.error('Error loading sharkcatch.glb:', err);
            }
        );
    }

    createSplashEffect(pos) {
        if (window.soundManager && typeof window.soundManager.playSplash === 'function') {
            window.soundManager.playSplash();
        } else if (window.UI_Audio && typeof window.UI_Audio.playSplash === 'function') {
            window.UI_Audio.playSplash();
        }

        const splashGroup = new THREE.Group();
        splashGroup.position.copy(pos);

        const dropletCount = 32;
        const droplets = [];
        const dropletGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const dropletMat = new THREE.MeshBasicMaterial({ color: 0xddf0ff, transparent: true, opacity: 0.9 });

        for (let i = 0; i < dropletCount; i++) {
            const droplet = new THREE.Mesh(dropletGeo, dropletMat);
            
            const isCentral = i < 8;
            const angle = Math.random() * Math.PI * 2;
            const speed = isCentral ? (2.0 + Math.random() * 3.0) : (5.0 + Math.random() * 7.0);
            const vx = isCentral ? (Math.cos(angle) * speed * 0.2) : (Math.cos(angle) * speed * 0.6);
            const vz = isCentral ? (Math.sin(angle) * speed * 0.2) : (Math.sin(angle) * speed * 0.6);
            const vy = isCentral ? (8.0 + Math.random() * 6.0) : (4.0 + Math.random() * 6.0);

            droplet.position.set(0, 0.1, 0);
            splashGroup.add(droplet);
            droplets.push({ mesh: droplet, velocity: new THREE.Vector3(vx, vy, vz) });
        }

        this.scene.add(splashGroup);
        this.activeSplashes.push({
            group: splashGroup,
            droplets: droplets,
            age: 0,
            maxAge: 0.9
        });
    }

    update(delta, player, shark, waterSystem = null) {
        const activeWaterSystem = waterSystem || this.waterSystem || (window.waterSystem || null);

        for (let i = this.activeSplashes.length - 1; i >= 0; i--) {
            const splash = this.activeSplashes[i];
            splash.age += delta;
            const progress = splash.age / splash.maxAge;

            if (progress >= 1.0) {
                this.scene.remove(splash.group);
                splash.droplets.forEach(d => {
                    d.mesh.geometry.dispose();
                });
                this.activeSplashes.splice(i, 1);
            } else {
                splash.droplets.forEach(d => {
                    d.velocity.y -= 20.0 * delta; 
                    d.mesh.position.addScaledVector(d.velocity, delta);
                    const scaleFactor = Math.max(0.05, 1.0 - progress);
                    d.mesh.scale.setScalar(scaleFactor);
                    if (d.mesh.material) {
                        d.mesh.material.opacity = 0.9 * (1.0 - progress);
                    }
                });
            }
        }

        if (this.isDropping && this.sharkCatchMesh) {
            this.dropVelocityY += this.gravity * delta;
            this.sharkCatchMesh.position.y -= this.dropVelocityY * delta;

            this.sharkCatchMesh.rotation.x = this.pitchAngle;

            if (this.sharkCatchMesh.position.y <= 0.0) {
                const splashPos = this.sharkCatchMesh.position.clone();
                splashPos.y = 0.0;

                this.createSplashEffect(splashPos);

                if (activeWaterSystem && typeof activeWaterSystem.addSplash === 'function') {
                    activeWaterSystem.addSplash(splashPos, 3.0);
                }

                this.sharkCatchMesh.visible = false;
                this.isDropping = false;
                this.isCaught = false;

                if (shark) {
                    if (typeof shark.setVisibility === 'function') {
                        shark.setVisibility(true);
                    } else if (shark.mesh) {
                        shark.mesh.visible = true;
                    }
                }
            }
            return;
        }

        const winch = player ? (player.winchSystem || (player.rescueMission ? player.rescueMission.winchSystem : null)) : null;
        if (!winch) return;

        const hookPos = winch.getHookWorldPosition ? winch.getHookWorldPosition() : winch.getHookPosition();
        if (!hookPos || !shark) return;

        const maxCableLength = winch.maxCableLength || 30.0;
        const currentCableLength = winch.currentCableLength || 0.0;
        const halfwayCableLength = maxCableLength * 0.5;

        const sharkPos = shark.getPosition ? shark.getPosition() : (shark.mesh ? shark.mesh.position.clone() : null);

        if (!this.isCaught && !this.isDropping && hookPos.y <= 1.0 && shark.mesh && shark.mesh.visible && sharkPos) {
            const horizontalDist = Math.hypot(hookPos.x - sharkPos.x, hookPos.z - sharkPos.z);
            const verticalDist = Math.abs(hookPos.y - sharkPos.y);

            if (horizontalDist <= this.catchDistanceThreshold && verticalDist <= 10.0) {
                this.catchShark(shark);
            }
        }

        if (this.isCaught && this.sharkCatchMesh) {
            const worldOffset = this.mouthOffset.clone();
            if (player && player.model) {
                worldOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.model.rotation.y);
            }

            const shiftedPos = hookPos.clone().add(worldOffset);
            this.sharkCatchMesh.position.copy(shiftedPos);

            if (player && player.model) {
                const euler = new THREE.Euler(
                    this.pitchAngle,
                    player.model.rotation.y + this.yawAngle,
                    this.rollAngle,
                    'YXZ'
                );
                this.sharkCatchMesh.rotation.copy(euler);
            }

            if (currentCableLength <= halfwayCableLength || winch.winchState === 'UP') {
                this.detachAndDrop();
            }
        }
    }

    catchShark(shark) {
        this.isCaught = true;
        this.isDropping = false;
        this.dropVelocityY = 0;

        if (shark && typeof shark.setVisibility === 'function') {
            shark.setVisibility(false);
        } else if (shark && shark.mesh) {
            shark.mesh.visible = false;
        }

        if (this.sharkCatchMesh) {
            this.sharkCatchMesh.visible = true;
        }
    }

    detachAndDrop() {
        this.isCaught = false;
        this.isDropping = true;
        this.dropVelocityY = 0;
    }

    releaseShark(shark) {
        this.isCaught = false;
        this.isDropping = false;

        if (this.sharkCatchMesh) {
            this.sharkCatchMesh.visible = false;
        }

        if (shark && typeof shark.setVisibility === 'function') {
            shark.setVisibility(true);
        } else if (shark && shark.mesh) {
            shark.mesh.visible = true;
        }
    }

    reset(shark) {
        this.isDropping = false;
        this.dropVelocityY = 0;
        if (this.isCaught) {
            this.releaseShark(shark);
        }
    }
}