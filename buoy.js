import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class BuoySystem {
    constructor(scene, loadingManager = null, helipadPosition = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.helipadCenter = helipadPosition ? helipadPosition.clone() : new THREE.Vector3(0, 0, 0);
        
        // Final positioning & navigation configuration
        this.config = {
            pcd: 30,          // Pitch Circle Distance / Offset from landing area center axis (meters)
            posY: -2.3,       // Elevation / Y coordinate
            heading: 42,      // Line angle in degrees (0 to 360)
            spacing: 25,      // Spacing between adjacent buoys (meters)
            scale: 1,         // Mesh scale factor
            count: 5,         // Number of buoys
            ndbFrequency: 210,// NDB Radio Navigation Frequency (210 kHz reallocated from Main Base)
            lightY: 2.5,      // Light source and bulb height offset (meters relative to buoy)
            lightBrightness: 25.0 // Active light pulse brightness / intensity
        };

        this.buoys = [];
        this.isLoaded = false;
        this.elapsedTime = 0;

        // Shared bulb geometry
        this.bulbGeo = new THREE.SphereGeometry(0.11, 12, 12);

        // Light sequence parameters (chase effect)
        this.stepDuration = 0.2;
        this.pauseDuration = 0.6;

        this.loader = new GLTFLoader(this.loadingManager);

        // Configure DRACOLoader using jsDelivr CDN for Three.js r160
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
        this.loader.setDRACOLoader(dracoLoader);

        this.init();
    }

    setHelipadPosition(pos) {
        if (!pos) return;
        this.helipadCenter.copy(pos);
        this.repositionBuoys();
    }

    init() {
        this.loader.load(
            'buoy.glb',
            (gltf) => {
                const baseModel = gltf.scene;

                for (let i = 0; i < this.config.count; i++) {
                    const buoyMesh = baseModel.clone(true);

                    // High-range PointLight (100m reach) for sea surface illumination
                    const light = new THREE.PointLight(0xffaa00, 1.5, 100);
                    const lightLocalPos = new THREE.Vector3(0, this.config.lightY, 0);
                    light.position.copy(lightLocalPos);
                    buoyMesh.add(light);

                    // MeshBasicMaterial clean look, with fog bypass for storm visibility
                    const bulbMat = new THREE.MeshBasicMaterial({
                        color: 0xffaa00,
                        transparent: true,
                        opacity: 0.35,
                        fog: false,        // Pierces through heavy storm/night fog at max zoom
                        toneMapped: false  // Maintains clear visual point without HDR dimming
                    });
                    
                    const bulbMesh = new THREE.Mesh(this.bulbGeo, bulbMat);
                    bulbMesh.position.copy(lightLocalPos);
                    buoyMesh.add(bulbMesh);

                    // Pre-warm GPU shaders to prevent takeoff lag spike
                    buoyMesh.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = false;
                            child.frustumCulled = false;
                        }
                    });

                    this.scene.add(buoyMesh);

                    this.buoys.push({
                        mesh: buoyMesh,
                        light: light,
                        bulbMesh: bulbMesh,
                        bulbMat: bulbMat,
                        basePosition: new THREE.Vector3(),
                        baseRotation: new THREE.Euler(),
                        index: i,
                        isActive: false
                    });
                }

                this.isLoaded = true;
                this.repositionBuoys();
            },
            undefined,
            (error) => {
                console.error('Error loading buoy.glb model:', error);
            }
        );
    }

    repositionBuoys() {
        if (!this.isLoaded || this.buoys.length === 0) return;

        const headingRad = THREE.MathUtils.degToRad(this.config.heading);
        const dir = new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad)).normalize();

        this.buoys.forEach((buoy, i) => {
            const totalDistance = this.config.pcd + (i * this.config.spacing);
            const pos = new THREE.Vector3(
                this.helipadCenter.x + dir.x * totalDistance,
                this.config.posY,
                this.helipadCenter.z + dir.z * totalDistance
            );
            
            buoy.basePosition.copy(pos);
            buoy.mesh.position.copy(pos);
            
            buoy.baseRotation.set(0, headingRad, 0);
            buoy.mesh.rotation.copy(buoy.baseRotation);

            buoy.mesh.scale.set(this.config.scale, this.config.scale, this.config.scale);
        });
    }

    updateLightSettings() {
        this.buoys.forEach((buoy) => {
            if (buoy.light) {
                buoy.light.position.y = this.config.lightY;
            }
            if (buoy.bulbMesh) {
                buoy.bulbMesh.position.y = this.config.lightY;
            }
        });
    }

    update(delta) {
        if (!this.isLoaded || this.buoys.length === 0) return;

        this.elapsedTime += delta;

        // Wave animation
        this.buoys.forEach((buoy) => {
            const waveOffset = buoy.index * 0.9;
            const waveY = Math.sin(this.elapsedTime * 1.6 + waveOffset) * 0.15;
            const tiltX = Math.sin(this.elapsedTime * 1.1 + waveOffset) * 0.05;
            const tiltZ = Math.cos(this.elapsedTime * 1.3 + waveOffset) * 0.05;

            buoy.mesh.position.y = buoy.basePosition.y + waveY;
            buoy.mesh.rotation.x = buoy.baseRotation.x + tiltX;
            buoy.mesh.rotation.z = buoy.baseRotation.z + tiltZ;
        });

        // Dynamic light cycle calculated from buoy count
        const totalCycleDuration = (this.buoys.length * this.stepDuration) + this.pauseDuration;
        const cycleProgress = this.elapsedTime % totalCycleDuration;

        // Sequential chase light sequence towards landing area (Outer -> Inner)
        this.buoys.forEach((buoy) => {
            const reversedIndex = (this.buoys.length - 1) - buoy.index;
            const startTime = reversedIndex * this.stepDuration;
            const endTime = startTime + this.stepDuration;
            const shouldBeActive = cycleProgress >= startTime && cycleProgress < endTime;

            if (shouldBeActive && !buoy.isActive) {
                // High-intensity chase flash
                buoy.light.intensity = this.config.lightBrightness;
                buoy.bulbMat.opacity = 1.0;
                buoy.bulbMat.color.setHex(0xffffff);
                buoy.isActive = true;
            } else if (!shouldBeActive && buoy.isActive) {
                // Low-intensity standby light so buoy sequence path remains visible through night & storm fog
                buoy.light.intensity = 1.5;
                buoy.bulbMat.opacity = 0.35;
                buoy.bulbMat.color.setHex(0xffaa00);
                buoy.isActive = false;
            }
        });
    }

    /**
     * Returns the assigned NDB Radio Frequency for navigation radio tuning.
     */
    getNDBFrequency() {
        return this.config.ndbFrequency;
    }

    /**
     * Returns the position of the outermost lead buoy for NDB radio navigation guidance.
     */
    getNDBPosition() {
        if (this.buoys.length > 0) {
            return this.buoys[this.buoys.length - 1].mesh.position.clone();
        }
        return new THREE.Vector3(this.helipadCenter.x, this.config.posY, this.helipadCenter.z);
    }

    /**
     * Returns the position of the outermost buoy on the approach line.
     */
    getFarthestBuoyPosition() {
        return this.getNDBPosition();
    }
}