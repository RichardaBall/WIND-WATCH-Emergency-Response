import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export class Shark {
  /**
   * @param {THREE.Scene} scene - The main Three.js scene instance.
   * @param {THREE.LoadingManager|Object} [loadingManager] - Optional central loading manager or options object.
   * @param {Object} [options] - Configuration options for the shark.
   * @param {number} [options.radius=120] - Swimming orbit radius around origin (meters).
   * @param {number} [options.speed=3.2] - Swimming travel speed along path.
   * @param {number} [options.depth=-4.0] - Swimming depth relative to sea level (Y=0).
   * @param {number} [options.scale=1.5] - Scale factor for the shark model.
   * @param {number} [options.animSpeed=1.0] - Speed multiplier for the swimming animation.
   */
  constructor(scene, loadingManager = null, options = {}) {
    this.scene = scene;

    // Handle flexible arguments whether loadingManager is passed or omitted
    let config = options;
    if (loadingManager && typeof loadingManager === 'object' && !loadingManager.itemStart) {
      config = loadingManager;
      this.loadingManager = null;
    } else {
      this.loadingManager = loadingManager;
    }

    this.radius = config.radius !== undefined ? config.radius : 120;
    this.speed = config.speed !== undefined ? config.speed : 3.2;
    this.depth = config.depth !== undefined ? config.depth : -4.0;
    this.scale = config.scale !== undefined ? config.scale : 1.5;
    this.animSpeed = config.animSpeed !== undefined ? config.animSpeed : 1.0;

    this.mesh = null;
    this.mixer = null;
    this.angle = Math.random() * Math.PI * 2;
    this.time = 0;

    this.init();
  }

  init() {
    const loader = new GLTFLoader(this.loadingManager || undefined);
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      'shark.glb',
      (gltf) => {
        this.mesh = gltf.scene;
        this.mesh.scale.setScalar(this.scale);
        
        this.mesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.mesh);
          this.mixer.timeScale = this.animSpeed;
          gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.play();
          });
        }

        this.updatePosition(0);
        this.scene.add(this.mesh);
      },
      undefined,
      (error) => {
        console.error('Error loading shark.glb:', error);
      }
    );
  }

  /**
   * Sets current visibility of shark mesh.
   * @param {boolean} visible 
   */
  setVisibility(visible) {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  /**
   * Returns current world position of shark mesh.
   * @returns {THREE.Vector3|null}
   */
  getPosition() {
    return this.mesh ? this.mesh.position.clone() : null;
  }

  update(delta) {
    if (!this.mesh) return;

    this.time += delta;

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Advance angle along circular swim path based on speed (meters/sec)
    this.angle += (this.speed / this.radius) * delta;
    if (this.angle > Math.PI * 2) {
      this.angle -= Math.PI * 2;
    }

    this.updatePosition(delta);
  }

  updatePosition(delta) {
    const x = Math.cos(this.angle) * this.radius;
    const z = Math.sin(this.angle) * this.radius;

    // Subtle natural vertical sway around target depth
    const verticalBob = Math.sin(this.time * 1.5) * 0.3;
    const y = this.depth + verticalBob;

    this.mesh.position.set(x, y, z);

    // Orient mesh along swimming direction
    const tangentX = -Math.sin(this.angle);
    const tangentZ = Math.cos(this.angle);
    const targetAngle = Math.atan2(tangentX, tangentZ);

    const bodyFlex = !this.mixer ? Math.sin(this.time * 4 * this.animSpeed) * 0.12 : 0;
    const bankAngle = Math.sin(this.time * 2) * 0.05;
    
    this.mesh.rotation.set(0, targetAngle + bodyFlex, bankAngle);
  }
}