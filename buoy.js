import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export class BuoySystem {
    constructor(scene, loadingManager = null, helipadPosition = null) {
        this.scene = scene;
        this.loadingManager = loadingManager;
        this.helipadCenter = helipadPosition ? helipadPosition.clone() : new THREE.Vector3(0, 0, 0);
        
        this.config = {
            pcd: 30,          
            posY: -2.3,       
            heading: 42,      
            spacing: 25,      
            scale: 1,         
            count: 5,         
            ndbFrequency: 210,
            lightY: 2.5,      
            lightBrightness: 25.0 
        };

        this.buoys = [];
        this.isLoaded = false;
        this.elapsedTime = 0;

        this.bulbGeo = new THREE.SphereGeometry(0.11, 12, 12);

        this.stepDuration = 0.2;
        this.pauseDuration = 0.6;

        this.loader = new GLTFLoader(this.loadingManager);

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
        this.loader.setDRACOLoader(dracoLoader);

        if (window.renderer) {
            const ktx2Loader = new KTX2Loader(this.loadingManager);
            ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
            ktx2Loader.detectSupport(window.renderer);
            this.loader.setKTX2Loader(ktx2Loader);
        }

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

                    // Start light with 0 intensity so it's invisible until flash
                    const light = new THREE.PointLight(0xffaa00, 0, 100);
                    const lightLocalPos = new THREE.Vector3(0, this.config.lightY, 0);
                    light.position.copy(lightLocalPos);
                    buoyMesh.add(light);

                    // Start bulb material completely transparent (opacity 0)
                    const bulbMat = new THREE.MeshBasicMaterial({
                        color: 0xffaa00,
                        transparent: true,
                        opacity: 0.0,
                        fog: false,        
                        toneMapped: false  
                    });
                    
                    const bulbMesh = new THREE.Mesh(this.bulbGeo, bulbMat);
                    bulbMesh.position.copy(lightLocalPos);
                    buoyMesh.add(bulbMesh);

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

        this.buoys.forEach((buoy) => {
            const waveOffset = buoy.index * 0.9;
            const waveY = Math.sin(this.elapsedTime * 1.6 + waveOffset) * 0.15;
            const tiltX = Math.sin(this.elapsedTime * 1.1 + waveOffset) * 0.05;
            const tiltZ = Math.cos(this.elapsedTime * 1.3 + waveOffset) * 0.05;

            buoy.mesh.position.y = buoy.basePosition.y + waveY;
            buoy.mesh.rotation.x = buoy.baseRotation.x + tiltX;
            buoy.mesh.rotation.z = buoy.baseRotation.z + tiltZ;
        });

        const totalCycleDuration = (this.buoys.length * this.stepDuration) + this.pauseDuration;
        const cycleProgress = this.elapsedTime % totalCycleDuration;

        this.buoys.forEach((buoy) => {
            const reversedIndex = (this.buoys.length - 1) - buoy.index;
            const startTime = reversedIndex * this.stepDuration;
            const endTime = startTime + this.stepDuration;
            const shouldBeActive = cycleProgress >= startTime && cycleProgress < endTime;

            if (shouldBeActive && !buoy.isActive) {
                buoy.light.intensity = this.config.lightBrightness;
                buoy.bulbMat.opacity = 1.0;
                buoy.bulbMat.color.setHex(0xffffff);
                buoy.isActive = true;
            } else if (!shouldBeActive && buoy.isActive) {
                buoy.light.intensity = 0;
                buoy.bulbMat.opacity = 0.0;
                buoy.bulbMat.color.setHex(0xffaa00);
                buoy.isActive = false;
            }
        });
    }

    getNDBFrequency() {
        return this.config.ndbFrequency;
    }

    getNDBPosition() {
        if (this.buoys.length > 0) {
            return this.buoys[this.buoys.length - 1].mesh.position.clone();
        }
        return new THREE.Vector3(this.helipadCenter.x, this.config.posY, this.helipadCenter.z);
    }

    getFarthestBuoyPosition() {
        return this.getNDBPosition();
    }
}