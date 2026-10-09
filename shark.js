import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class Shark {
  /**
   * @param {THREE.Scene} scene - The main Three.js scene instance.
   * @param {THREE.LoadingManager|Object} [loadingManager] - Central loading manager or options object.
   * @param {Object} [options] - Configuration options for the shark.
   */
  constructor(scene, loadingManager = null, options = {}) {
    this.scene = scene;

    let config = options;
    if (loadingManager && typeof loadingManager === 'object' && !loadingManager.itemStart) {
      config = loadingManager;
      this.loadingManager = null;
    } else {
      this.loadingManager = loadingManager;
    }

    this.radius = config.radius !== undefined ? config.radius : 120;
    this.speed = config.speed !== undefined ? config.speed : 3.2;
    this.depth = config.depth !== undefined ? config.depth : -7.25;
    this.scale = config.scale !== undefined ? config.scale : 1.5;
    this.animSpeed = config.animSpeed !== undefined ? config.animSpeed : 1.0;

    // --- MODEL ORIENTATION CORRECTION OFFSETS ---
    // Pitch (X): Math.PI flips upright if loaded upside down
    // Yaw (Y): Math.PI turns 180 degrees if swimming backwards
    // Roll (Z): 0
    this.rotationOffset = {
      x: Math.PI, // Flip right-side up
      y: 0, // Flip forward facing direction
      z: 0
    };

    // Main world object container
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);

    this.modelGroup = null;
    this.mixer = null;
    this.angle = Math.random() * Math.PI * 2;
    this.time = 0;

    this.init();
  }

  async init() {
    // 1. Ensure Meshopt WebAssembly decoder is fully compiled and ready
    if (MeshoptDecoder.ready) {
      await MeshoptDecoder.ready;
    }

    const manager = this.loadingManager || undefined;
    const loader = new GLTFLoader(manager);

    // 2. Configure Draco and Meshopt decoders
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    // 3. Fallback path search
    const candidatePaths = [
      'shark.glb',
      './shark.glb',
      'assets/shark.glb',
      './assets/shark.glb'
    ];

    const tryLoadPath = (index) => {
      if (index >= candidatePaths.length) {
        console.error('[Shark] Failed to load shark.glb from all candidate paths.');
        return;
      }

      const path = candidatePaths[index];
      loader.load(
        path,
        (gltf) => {
          this.modelGroup = gltf.scene;

          // Apply scale and local orientation adjustments to the child GLTF container
          this.modelGroup.scale.setScalar(this.scale);
          this.modelGroup.rotation.set(
            this.rotationOffset.x,
            this.rotationOffset.y,
            this.rotationOffset.z
          );

          this.modelGroup.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Animation setup
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.modelGroup);
            this.mixer.timeScale = this.animSpeed;
            gltf.animations.forEach((clip) => {
              const action = this.mixer.clipAction(clip);
              action.play();
            });
          }

          // Attach loaded GLTF model into the moving parent mesh
          this.mesh.add(this.modelGroup);
          this.updatePosition(0);
          console.log(`[Shark] Successfully loaded and oriented model from: ${path}`);
        },
        undefined,
        () => {
          tryLoadPath(index + 1);
        }
      );
    };

    tryLoadPath(0);
  }

  setVisibility(visible) {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  getPosition() {
    return this.mesh ? this.mesh.position.clone() : null;
  }

  update(delta) {
    if (!this.mesh) return;

    this.time += delta;

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Advance angle along circular swim path based on speed
    this.angle += (this.speed / this.radius) * delta;
    if (this.angle > Math.PI * 2) {
      this.angle -= Math.PI * 2;
    }

    this.updatePosition(delta);
  }

  updatePosition(delta) {
    const x = Math.cos(this.angle) * this.radius;
    const z = Math.sin(this.angle) * this.radius;
    const verticalBob = Math.sin(this.time * 1.5) * 0.3;
    const y = this.depth + verticalBob;

    // Move the root group along the world swim path
    this.mesh.position.set(x, y, z);

    // Compute heading along path tangent
    const tangentX = -Math.sin(this.angle);
    const tangentZ = Math.cos(this.angle);
    const targetAngle = Math.atan2(tangentX, tangentZ);

    const bodyFlex = !this.mixer ? Math.sin(this.time * 4 * this.animSpeed) * 0.12 : 0;
    const bankAngle = Math.sin(this.time * 2) * 0.05;
    
    // Apply world-space heading & roll to root group
    this.mesh.rotation.set(0, targetAngle + bodyFlex, bankAngle);
  }
}