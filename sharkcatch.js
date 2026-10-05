import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        this.catchDistanceThreshold = 12.0;

        // Rotated 180 degrees so head/mouth attaches to hook instead of tail
        this.pitchAngle = -Math.PI / 2; 
        this.mouthOffset = new THREE.Vector3(0, -1.2, 0); // Local offset to place hook inside jaws

        this.initModel();
    }

    setWaterSystem(waterSystem) {
        this.waterSystem = waterSystem;
    }

    initModel() {
        const loader = new GLTFLoader(this.loadingManager || undefined);
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
     * Updates shark catching, hook attachment, dropping physics, and water splash logic.
     * @param {number} delta 
     * @param {Object} player 
     * @param {Object} shark 
     * @param {Object} [waterSystem]
     */
    update(delta, player, shark, waterSystem = null) {
        const activeWaterSystem = waterSystem || this.waterSystem || (window.waterSystem || null);

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

                // 1. Trigger water splash particle effect
                if (activeWaterSystem && typeof activeWaterSystem.addSplash === 'function') {
                    activeWaterSystem.addSplash(splashPos, 2.5);
                }

                // 2. Hide caught shark model and reset drop state
                this.sharkCatchMesh.visible = false;
                this.isDropping = false;
                this.isCaught = false;

                // 3. Re-enable original shark visibility along its ongoing path
                if (shark) {
                    if (typeof shark.setVisibility === 'function') {
                        shark.setVisibility(true);
                    } else if (shark.mesh) {
                        shark.mesh.visible = true;
                    }
                }
                console.log("SharkCatchSystem: Shark dropped back into water with splash! Restored shark visibility along its normal route.");
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
                console.log("SharkCatchSystem: Shark caught!");
                this.catchShark(shark);
            }
        }

        // 2. POSITION ATTACHED SHARK TO HOOK AND ORIENT VERTICALLY FROM MOUTH
        if (this.isCaught && this.sharkCatchMesh) {
            const shiftedPos = hookPos.clone().add(this.mouthOffset);
            this.sharkCatchMesh.position.copy(shiftedPos);

            if (player.model) {
                this.sharkCatchMesh.rotation.set(
                    this.pitchAngle,               // -90 deg pitch (head pointing up)
                    player.model.rotation.y,       // Align heading with heli
                    0,
                    'YXZ'
                );
            }

            // Trigger drop when winch cable is retracted past halfway mark or fully UP
            if (currentCableLength <= halfwayCableLength || winch.winchState === 'UP') {
                console.log("SharkCatchSystem: Retracted past halfway, dropping shark back into water!");
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