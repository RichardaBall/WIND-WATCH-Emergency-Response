import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export function createOcean(scene, sunLight) {
    const config = {
        size: 2000,
        widthSegments: 128,
        heightSegments: 128,
        textureWidth: 512,
        textureHeight: 512,
        waterNormalsUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
        normalRepeat: 4,
        sunColor: 0x336699,      
        waterColor: 0x001122,    
        distortionScale: 0.4,    
        positionY: -2.0,
        waveHeight: 0,     
        waveFrequency: 0.008, 
        waveSpeed: 0.7       
    };

    const waterGeometry = new THREE.PlaneGeometry(config.size, config.size, config.widthSegments, config.heightSegments);
    
    const waterNormals = new THREE.TextureLoader().load(config.waterNormalsUrl, (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(config.normalRepeat, config.normalRepeat);
    });

    const water = new Water(waterGeometry, {
        textureWidth: config.textureWidth,
        textureHeight: config.textureHeight,
        waterNormals: waterNormals,
        sunDirection: sunLight ? sunLight.position.clone().normalize() : new THREE.Vector3(0, 1, 0).normalize(),
        sunColor: config.sunColor,
        waterColor: config.waterColor,
        distortionScale: config.distortionScale,
        fog: scene.fog !== undefined
    });

    water.rotation.x = -Math.PI / 2;
    water.position.y = config.positionY;
    scene.add(water);

    // --- Night Factor Uniform ---
    water.material.uniforms['uNightFactor'] = { value: 0.0 };

    water.material.onBeforeCompile = (shader) => {
        shader.uniforms.uNightFactor = water.material.uniforms['uNightFactor'];

        shader.fragmentShader = `
            uniform float uNightFactor;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            `gl_FragColor = vec4( outgoingLight, alpha );`,
            `
            vec3 dayWater = vec3(0.0, 0.06, 0.18);
            vec3 nightWater = vec3(0.0005, 0.0015, 0.005);
            vec3 dynamicOceanColor = mix(dayWater, nightWater, uNightFactor);
            
            float blendStrength = mix(0.7, 0.95, uNightFactor);
            outgoingLight = mix(outgoingLight, dynamicOceanColor, blendStrength);
            
            gl_FragColor = vec4( outgoingLight, alpha );
            `
        );
    };

    const posAttribute = waterGeometry.attributes.position;
    const initialZ = new Float32Array(posAttribute.count);
    for (let i = 0; i < posAttribute.count; i++) {
        initialZ[i] = posAttribute.getZ(i);
    }

    water.updateWaves = function(time) {
        if (water.material.uniforms['time']) {
            water.material.uniforms['time'].value += 0.004; 
        }

        const scaledTime = time * config.waveSpeed;
        const positions = waterGeometry.attributes.position;
        
        for (let i = 0; i < positions.count; i++) {
            const u = positions.getX(i);
            const v = positions.getY(i);

            const wave1 = Math.sin(u * config.waveFrequency + scaledTime * 1.5) * Math.cos(v * config.waveFrequency + scaledTime * 1.2);
            const wave2 = Math.sin((u * 1.4 - v * 1.1) * config.waveFrequency * 1.6 + scaledTime * 2.5);
            const wave3 = Math.cos((u * 0.7 + v * 1.5) * config.waveFrequency * 0.8 + scaledTime * 1.0);

            const totalDisplacement = (wave1 * 0.6 + wave2 * 0.3 + wave3 * 0.1) * config.waveHeight;
            
            positions.setZ(i, initialZ[i] + totalDisplacement);
        }
        
        positions.needsUpdate = true;
        waterGeometry.computeVertexNormals();
    };

    return water;
}