import * as THREE from 'three';

export class LightingSystem {
    constructor(scene, helipadCenter) {
        this.scene = scene;
        this.helipadCenter = helipadCenter ? helipadCenter.clone() : new THREE.Vector3(3.3690, 5.336, 0.4548);
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.lights = [];

        // Permanent locked helipad configuration
        this.helipadConfig = {
            offsetX: -3.25,
            offsetZ: -0.4,
            radius: 5.9,
            cornerRadius: 12.4,
            height: 4.85,
            intensity: 1.5,
            cornerIntensity: 1.5,
            floodIntensity: 2.5
        };

        // Permanent locked tower lights configuration
        this.towerConfig = {
            t1X: -19.78, t1Y: 24.37, t1Z: 5.57,
            t2X: -14.81, t2Y: 24.37, t2Z: 8.74
        };

        // Permanent locked floodlights configuration (FL4 & FL5 have hidden mesh)
        this.floodConfig = {
            fl1X: -15.28, fl1Y: 8.11,  fl1Z: -0.76,  fl1RotX: 0.01, fl1RotY: 0,    showMesh1: true,
            fl2X: -10.78, fl2Y: 7.97,  fl2Z: -11.92, fl2RotX: 0.65, fl2RotY: 0,    showMesh2: true,
            fl3X: -5.22,  fl3Y: 8.23,  fl3Z: -14.81, fl3RotX: 0.06, fl3RotY: 1.55, showMesh3: true,
            fl4X: 1.64,   fl4Y: 13.16, fl4Z: -10.99, fl4RotX: 1.04, fl4RotY: -0.64, showMesh4: false,
            fl5X: -14.89, fl5Y: 11.17, fl5Z: 2.98,   fl5RotX: 1.07, fl5RotY: 0,    showMesh5: false
        };

        this.createLighting();
    }

    createLighting() {
        // Clear existing lights
        while (this.group.children.length > 0) {
            const child = this.group.children[0];
            this.group.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.lights = [];

        const centerX = this.helipadCenter.x + this.helipadConfig.offsetX;
        const centerZ = this.helipadCenter.z + this.helipadConfig.offsetZ;
        const deckHeight = this.helipadConfig.height;

        const bulbGeo = new THREE.SphereGeometry(0.12, 16, 16);
        
        const greenBulbMat = new THREE.MeshStandardMaterial({
            color: 0x4ade80,
            emissive: 0x22c55e,
            emissiveIntensity: 4.0,
            roughness: 0.2,
            metalness: 0.1
        });

        const redBulbMat = new THREE.MeshStandardMaterial({
            color: 0xf87171,
            emissive: 0xef4444,
            emissiveIntensity: 4.0,
            roughness: 0.2,
            metalness: 0.1
        });

        const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.15, 16);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.7,
            metalness: 0.5
        });

        // 1. Create 8 locked green perimeter lights
        const numGreenLights = 8;
        for (let i = 0; i < numGreenLights; i++) {
            const angle = (i / numGreenLights) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * this.helipadConfig.radius;
            const z = centerZ + Math.sin(angle) * this.helipadConfig.radius;
            const y = deckHeight;

            const fixtureGroup = new THREE.Group();
            fixtureGroup.position.set(x, y, z);

            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.075;
            fixtureGroup.add(baseMesh);

            const bulbMesh = new THREE.Mesh(bulbGeo, greenBulbMat.clone());
            bulbMesh.position.y = 0.22;
            fixtureGroup.add(bulbMesh);

            const pointLight = new THREE.PointLight(0x22c55e, this.helipadConfig.intensity, 6.0, 2.0);
            pointLight.position.set(0, 0.25, 0);
            fixtureGroup.add(pointLight);

            this.group.add(fixtureGroup);
            this.lights.push(fixtureGroup);
        }

        // 2. Create 4 locked red corner lights
        const cornerAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
        cornerAngles.forEach(angle => {
            const x = centerX + Math.cos(angle) * this.helipadConfig.cornerRadius;
            const z = centerZ + Math.sin(angle) * this.helipadConfig.cornerRadius;
            const y = deckHeight;

            const fixtureGroup = new THREE.Group();
            fixtureGroup.position.set(x, y, z);

            const baseMesh = new THREE.Mesh(baseGeo, baseMat);
            baseMesh.position.y = 0.075;
            fixtureGroup.add(baseMesh);

            const bulbMesh = new THREE.Mesh(bulbGeo, redBulbMat.clone());
            bulbMesh.position.y = 0.22;
            fixtureGroup.add(bulbMesh);

            const pointLight = new THREE.PointLight(0xef4444, this.helipadConfig.cornerIntensity, 6.0, 2.0);
            pointLight.position.set(0, 0.25, 0);
            fixtureGroup.add(pointLight);

            this.group.add(fixtureGroup);
            this.lights.push(fixtureGroup);
        });

        // 3. Locked central overhead floodlight
        const centerFlood = new THREE.PointLight(0xfffbeb, this.helipadConfig.floodIntensity, 10.0, 1.5);
        centerFlood.position.set(centerX, deckHeight + 4.0, centerZ);
        this.group.add(centerFlood);

        // Helper to create tower lights
        const createTowerLight = (x, y, z) => {
            const towerGroup = new THREE.Group();
            towerGroup.position.set(x, y, z);
            const towerBulbMesh = new THREE.Mesh(bulbGeo, redBulbMat.clone());
            towerGroup.add(towerBulbMesh);
            const towerPointLight = new THREE.PointLight(0xef4444, 2.0, 8.0, 2.0);
            towerPointLight.position.set(0, 0, 0);
            towerGroup.add(towerPointLight);
            this.group.add(towerGroup);
            this.lights.push(towerGroup);
        };

        createTowerLight(this.towerConfig.t1X, this.towerConfig.t1Y, this.towerConfig.t1Z);
        createTowerLight(this.towerConfig.t2X, this.towerConfig.t2Y, this.towerConfig.t2Z);

        // Helper to create doorway floodlights
        const createFloodlight = (x, y, z, rotX, rotY, showMesh) => {
            const floodGroup = new THREE.Group();
            floodGroup.position.set(x, y, z);
            floodGroup.rotation.set(rotX, rotY, 0);

            if (showMesh) {
                const floodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.8 });
                const housing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), floodMat);
                floodGroup.add(housing);
            }

            const spotLight = new THREE.SpotLight(0xfffbeb, 3.0, 15.0, Math.PI / 4, 0.5, 1.0);
            spotLight.position.set(0, 0, 0);
            spotLight.target.position.set(0, -5, 5);
            floodGroup.add(spotLight);
            floodGroup.add(spotLight.target);

            this.group.add(floodGroup);
            this.lights.push(floodGroup);
        };

        // 4. Create all 5 doorway floodlights
        createFloodlight(this.floodConfig.fl1X, this.floodConfig.fl1Y, this.floodConfig.fl1Z, this.floodConfig.fl1RotX, this.floodConfig.fl1RotY, this.floodConfig.showMesh1);
        createFloodlight(this.floodConfig.fl2X, this.floodConfig.fl2Y, this.floodConfig.fl2Z, this.floodConfig.fl2RotX, this.floodConfig.fl2RotY, this.floodConfig.showMesh2);
        createFloodlight(this.floodConfig.fl3X, this.floodConfig.fl3Y, this.floodConfig.fl3Z, this.floodConfig.fl3RotX, this.floodConfig.fl3RotY, this.floodConfig.showMesh3);
        createFloodlight(this.floodConfig.fl4X, this.floodConfig.fl4Y, this.floodConfig.fl4Z, this.floodConfig.fl4RotX, this.floodConfig.fl4RotY, this.floodConfig.showMesh4);
        createFloodlight(this.floodConfig.fl5X, this.floodConfig.fl5Y, this.floodConfig.fl5Z, this.floodConfig.fl5RotX, this.floodConfig.fl5RotY, this.floodConfig.showMesh5);
    }
}