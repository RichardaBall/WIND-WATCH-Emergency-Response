import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class SharkCatchSystem {
    /**
     * @param {THREE.Scene} scene 
     * @param {THREE.LoadingManager} [loadingManager] 
     * @param {Object} [waterSystem]
     */
    constructor(scene, loadingManager = null, waterSystem = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.waterSystem = waterSystem;

        this.sharkCatchMesh = null;
        this.isCaught = false;

        // Falling state properties
        this.isDropping = false;
        this.dropVelocityY = 0;
        this.gravity = 25.0; // Acceleration due to gravity (m/s^2)

        // Proximity threshold in meters (horizontal & vertical margin) to trigger bite/attachment
        this.catchDistanceThreshold = 3.0;

        // --- POSITION & ORIENTATION OFFSETS ---
        this.mouthOffset = new THREE.Vector3(-0.23, -5.54, -0.63);
        this.pitchAngle = THREE.MathUtils.degToRad(-90.0);
        this.yawAngle = THREE.MathUtils.degToRad(0.0);
        this.rollAngle = THREE.MathUtils.degToRad(0.0);

        // Active visual splash effects list
        this.activeSplashes = [];

        this.initModel();
    }

    setWaterSystem(waterSystem) {
        this.waterSystem = waterSystem;
    }

    /**
     * Programmatically update mouth offsets and orientation angles.
     */
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

    /**
     * Creates a realistic 3D splash effect with multi-tier water spray droplets and mist particles (no ripple ring).
     * @param {THREE.Vector3} pos 
     */
    createSplashEffect(pos) {
        // Play audio splash if available via sound manager or UI audio
        if (window.soundManager && typeof window.soundManager.playSplash === 'function') {
            window.soundManager.playSplash();
        } else if (window.UI_Audio && typeof window.UI_Audio.playSplash === 'function') {
            window.UI_Audio.playSplash();
        }

        const splashGroup = new THREE.Group();
        splashGroup.position.copy(pos);

        // Upward spray droplets and mist particles
        const dropletCount = 32;
        const droplets = [];
        const dropletGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const dropletMat = new THREE.MeshBasicMaterial({ color: 0xddf0ff, transparent: true, opacity: 0.9 });

        for (let i = 0; i < dropletCount; i++) {
            const droplet = new THREE.Mesh(dropletGeo, dropletMat);
            
            // Mix radial spray and central upward jets
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

    /**
     * Updates shark catching, hook attachment, dropping physics, and water splash logic.
     * @param {number} delta 
     * @param {Object} player 
     * @param {Object} shark 
     * @param {Object} [waterSystem]
     */
    update(delta, player, shark, waterSystem = null) {
        const activeWaterSystem = waterSystem || this.waterSystem || (window.waterSystem || null);

        // --- UPDATE ACTIVE VISUAL SPLASH EFFECTS ---
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
                // Update droplet ballistic trajectory, fade scale, and opacity
                splash.droplets.forEach(d => {
                    d.velocity.y -= 20.0 * delta; // Gravity
                    d.mesh.position.addScaledVector(d.velocity, delta);
                    const scaleFactor = Math.max(0.05, 1.0 - progress);
                    d.mesh.scale.setScalar(scaleFactor);
                    if (d.mesh.material) {
                        d.mesh.material.opacity = 0.9 * (1.0 - progress);
                    }
                });
            }
        }

        // --- HANDLE FALLING ANIMATION ONCE RELEASED FROM HOOK ---
        if (this.isDropping && this.sharkCatchMesh) {
            this.dropVelocityY += this.gravity * delta;
            this.sharkCatchMesh.position.y -= this.dropVelocityY * delta;

            // Maintain vertical tilt while dropping
            this.sharkCatchMesh.rotation.x = this.pitchAngle;

            // Check for water surface impact (Y <= 0)
            if (this.sharkCatchMesh.position.y <= 0.0) {
                const splashPos = this.sharkCatchMesh.position.clone();
                splashPos.y = 0.0;

                // 1. Trigger robust 3D particle splash effect & audio
                this.createSplashEffect(splashPos);

                // 2. Trigger water system splash if available
                if (activeWaterSystem && typeof activeWaterSystem.addSplash === 'function') {
                    activeWaterSystem.addSplash(splashPos, 3.0);
                }

                // 3. Hide caught shark model and reset drop state
                this.sharkCatchMesh.visible = false;
                this.isDropping = false;
                this.isCaught = false;

                // 4. Re-enable original shark visibility along its ongoing path
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

        // --- RESOLVE WINCH HOOK POSITION ---
        const winch = player ? (player.winchSystem || (player.rescueMission ? player.rescueMission.winchSystem : null)) : null;
        if (!winch) return;

        const hookPos = winch.getHookWorldPosition ? winch.getHookWorldPosition() : winch.getHookPosition();
        if (!hookPos || !shark) return;

        const maxCableLength = winch.maxCableLength || 30.0;
        const currentCableLength = winch.currentCableLength || 0.0;
        const halfwayCableLength = maxCableLength * 0.5;

        const sharkPos = shark.getPosition ? shark.getPosition() : (shark.mesh ? shark.mesh.position.clone() : null);

        // 1. CHECK FOR CATCH CONDITIONS
        if (!this.isCaught && !this.isDropping && hookPos.y <= 1.0 && shark.mesh && shark.mesh.visible && sharkPos) {
            const horizontalDist = Math.hypot(hookPos.x - sharkPos.x, hookPos.z - sharkPos.z);
            const verticalDist = Math.abs(hookPos.y - sharkPos.y);

            if (horizontalDist <= this.catchDistanceThreshold && verticalDist <= 10.0) {
                this.catchShark(shark);
            }
        }

        // 2. POSITION ATTACHED SHARK TO HOOK AND ORIENT VERTICALLY FROM MOUTH
        if (this.isCaught && this.sharkCatchMesh) {
            // Transform local mouth offset to world space using player's Y heading rotation
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

            // Trigger drop when winch cable is retracted past halfway mark or fully UP
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