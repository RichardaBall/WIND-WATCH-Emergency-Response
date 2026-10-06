import * as THREE from 'three';

/**
 * AssetWarmupSystem
 * Eliminates gameplay lag spikes by pre-compiling WebGL shaders,
 * skinning matrices, and GPU texture VRAM buffers before flight begins.
 * Ensures animated SkinnedMeshes (shark, sharkcatch, liferafts, survivors)
 * are fully warmed up in VRAM before entering the viewport.
 */
export class AssetWarmupSystem {
  /**
   * Pre-compiles all scene objects and extra GLTF models into WebGL GPU state.
   * @param {THREE.WebGLRenderer} renderer 
   * @param {THREE.Scene} scene 
   * @param {THREE.Camera} camera 
   * @param {Array<THREE.Object3D|Object>} [extraModels=[]] - Standalone GLTF models or system meshes.
   */
  static async warmup(renderer, scene, camera, extraModels = []) {
    if (!renderer || !scene || !camera) return;

    const hiddenObjects = [];
    const culledObjects = [];
    const temporarilyAdded = [];

    // 1. Temporarily attach any extra unattached subsystem models to the scene graph
    if (Array.isArray(extraModels)) {
      extraModels.forEach((item) => {
        if (!item) return;
        const obj = item.scene || item.mesh || item.model || (item.isObject3D ? item : null);
        if (obj && !scene.getObjectById(obj.id)) {
          scene.add(obj);
          temporarilyAdded.push(obj);
        }
      });
    }

    // 2. Traverse scene graph to force visibility, disable culling, & update bone/skinning matrices
    scene.traverse((obj) => {
      if (!obj.visible) {
        obj.visible = true;
        hiddenObjects.push(obj);
      }

      if (obj.isMesh) {
        if (obj.frustumCulled) {
          obj.frustumCulled = false;
          culledObjects.push(obj);
        }

        // Force matrix transform calculations
        obj.updateMatrixWorld(true);

        // Force bone transform matrix updates for SkinnedMeshes (shark, characters)
        if (obj.isSkinnedMesh && obj.skeleton) {
          obj.skeleton.update();
        }

        // Force texture uploads to GPU VRAM
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => {
            const maps = ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap', 'aoMap', 'alphaMap'];
            maps.forEach((key) => {
              if (mat[key] && typeof renderer.initTexture === 'function') {
                renderer.initTexture(mat[key]);
              }
            });
            mat.needsUpdate = true;
          });
        }
      }
    });

    // Yield to the browser UI thread to keep the page responsive
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 3. Force WebGL shader compilation across all models & skinning shader combinations
    renderer.compile(scene, camera);

    // Yield after compilation pass
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 4. Execute off-screen render pass to finalize GPU pipeline state creation
    renderer.render(scene, camera);

    // 5. Restore original visibility states
    for (let i = 0; i < hiddenObjects.length; i++) {
      hiddenObjects[i].visible = false;
    }

    // 6. Restore original frustum culling states
    for (let i = 0; i < culledObjects.length; i++) {
      culledObjects[i].frustumCulled = true;
    }

    // 7. Remove temporarily attached extra models
    for (let i = 0; i < temporarilyAdded.length; i++) {
      scene.remove(temporarilyAdded[i]);
    }

    console.log(`AssetWarmupSystem: Successfully pre-compiled all GLB models and character skinning shaders into VRAM.`);
  }
}