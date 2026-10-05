import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class MainBase {
    constructor(scene, loadingManager, onLoadedCallback) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Your exact locked spawn position for the helicopter
        this.explicitSpawnPosition = new THREE.Vector3(3.3690, 6.2360, 0.4548);
        this.helipadCenter = new THREE.Vector3(this.explicitSpawnPosition.x, 5.336, this.explicitSpawnPosition.z);

        this.model = null;
        this.bboxMeshes = [];

        this.loadBase(loadingManager, onLoadedCallback);
    }

    loadBase(loadingManager, onLoadedCallback) {
        const dracoLoader = new DRACOLoader(loadingManager);
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

        const loader = loadingManager ? new GLTFLoader(loadingManager) : new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load('mainbase.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.set(0, 0, 0);

            // Traverse the loaded model to disable/hide any original Blender lights or old bulbs
            this.model.traverse((child) => {
                // Disable embedded Three.js light objects
                if (child.isLight) {
                    child.intensity = 0;
                    child.visible = false;
                }
                // Hide old Blender light meshes / bulbs (matching typical naming conventions)
                if (child.isMesh) {
                    const nameLower = child.name.toLowerCase();
                    if (
                        nameLower.includes('light') || 
                        nameLower.includes('lamp') || 
                        nameLower.includes('bulb') || 
                        nameLower.includes('beacon') ||
                        nameLower.includes('green') ||
                        nameLower.includes('red')
                    ) {
                        child.visible = false;
                    }
                }
            });

            this.group.add(this.model);

            // Custom multi-box configuration for main base structure and platform deck
            const defaultBboxConfig = {
                boxes: [
                    { offsetX: 0, offsetY: 1, offsetZ: 0, sizeX: 22, sizeY: 5, sizeZ: 20 },
                    { offsetX: -17, offsetY: 12, offsetZ: 7, sizeX: 4, sizeY: 27, sizeZ: 4 },
                    { offsetX: -2, offsetY: 2, offsetZ: -16, sizeX: 20, sizeY: 11, sizeZ: 7 },
                    { offsetX: -12, offsetY: 7, offsetZ: -15, sizeX: 13, sizeY: 9, sizeZ: 6 },
                    { offsetX: -15, offsetY: 0, offsetZ: 4, sizeX: 8, sizeY: 10, sizeZ: 10 },
                    { offsetX: -16, offsetY: 4, offsetZ: -10, sizeX: 8, sizeY: 9, sizeZ: 18 }
                ]
            };
            this.applyBoundingBox(defaultBboxConfig, false);

            this.model.updateMatrixWorld(true);

            if (onLoadedCallback) {
                onLoadedCallback(this.explicitSpawnPosition.clone());
            }
        }, undefined, (error) => {
            console.error("mainbase.glb failed to load:", error);
        });
    }

    createBoundingBoxMesh(config, visible = false) {
        const geo = new THREE.BoxGeometry(config.sizeX, config.sizeY, config.sizeZ);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            wireframe: true,
            transparent: true,
            opacity: 0.4
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(config.offsetX, config.offsetY, config.offsetZ);
        mesh.visible = false; // Forced invisible to player
        return mesh;
    }

    applyBoundingBox(config, visible = false) {
        // Clear existing bounding box meshes and dispose geometries
        this.bboxMeshes.forEach(mesh => {
            this.group.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.bboxMeshes = [];

        // Support both single box configs and multi-box configs
        const boxes = config.boxes || [config];
        boxes.forEach(boxCfg => {
            const mesh = this.createBoundingBoxMesh(boxCfg, false);
            this.group.add(mesh);
            this.bboxMeshes.push(mesh);
        });

        this.group.updateMatrixWorld(true);
    }

    setBoundingBoxVisibility(visible) {
        this.bboxMeshes.forEach(mesh => {
            mesh.visible = false; // Forced invisible
        });
    }

    getCollisionBoxes() {
        const boxes = [];
        this.bboxMeshes.forEach(mesh => {
            const box = new THREE.Box3();
            mesh.updateMatrixWorld(true);
            box.setFromObject(mesh);
            boxes.push(box);
        });
        return boxes;
    }
}