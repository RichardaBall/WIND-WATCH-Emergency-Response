import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { Sky } from 'three/addons/objects/Sky.js';

export function setupScene() {
    const scene = new THREE.Scene();
    
    scene.background = new THREE.Color(0x020d1a);
    scene.fog = new THREE.FogExp2(0x020d1a, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x6080a0, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    // --- Setup Sky Shader ---
    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 8;
    skyUniforms['rayleigh'].value = 1.5;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // Initialize Ocean
    const water = createOcean(scene, dirLight);

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { 
        scene, 
        camera, 
        renderer, 
        water, 
        sunLight: dirLight, 
        ambientLight,
        sky
    };
}