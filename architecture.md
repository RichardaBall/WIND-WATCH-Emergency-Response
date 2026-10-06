# Project Architecture & AI Guidelines

### Project Overview

A 3D offshore helicopter flight simulation game built using Three.js, WebGL, and modular ES JavaScript. The simulation features a Eurocopter Dauphin helicopter operating around an offshore main base environment with dynamic weather systems, custom flight physics, modular procedural Web Audio sound synthesis, real-time HUD instrumentation, a 3D tactical NDB bearing indicator, a realistic aerial firefighting water/foam drop system, an interactive Search & Rescue (SAR) winch & survivor mission system, an automated aviation searchlight system, an interactive marine shark-catching mechanics system, and pre-compilation asset warmup pipelines.

### File Structure & Module Responsibilities

* **`architecture.md`**: Project documentation mapping file dependencies, system rules, and gameplay specifications.
* **`index.html`**: Main HTML entry point loading the Three.js canvas, HUD overlay elements, fuel test slider, fullscreen controls, and styles.
* **`main.js`**: Central application loop; handles scene orchestration, lighting, model loading, shadow positioning, camera tracking, system integration (including buoy, shark, rotor wash, debris, shark catch, and asset warmup systems), and game state updates.
* **`sceneSetup.js`**: Initializes the Three.js core environment (`Scene`, `Camera`, `WebGLRenderer`, directional/ambient lighting, fog, and the dynamic ocean water plane).
* **`player.js`**: Controls `HelicopterPlayer` flight physics, mass calculations, rotor rotation, autorotation mechanics, landing gear drag, fuel consumption rates, strobe low-fuel warnings (<= 500 kg orange, <= 100 kg rapid flash red), and engine state.
* **`inputManager.js`**: Translates raw user input into flight movement vectors, prioritizing keyboard arrow keys, managing camera distance via mouse scroll, and detecting space bar input for water dispensing.
* **`waterSystem.js`**: Manages the aerial firefighting water/foam drop particle system; generates procedural soft radial canvas textures for aerated mist, handles volumetric particle blending, gravitational acceleration, and aerodynamic slipstream drag.
* **`soundContext.js`**: Manages the core Web Audio API `AudioContext`, master volume gain control, mute states, and user interaction audio-unlock handlers.
* **`UI_Audio.js`**: Manages procedural UI and mechanical sound effects including toggle switches, battery clicks, radio tuning clicks, fuel pump priming, landing gear servos, water splashes, and firefighting spray/foam noise.
* **`helicopterAudio.js`**: Manages procedural helicopter audio synthesis including engine noise, turbine whine pitch modulation, and rotor blade slap ("whop-whop") LFO effects.
* **`weatherAudio.js`**: Manages procedural environmental audio synthesis including rain noise, howling wind/gale dynamics, and randomized thunder sound effects.
* **`SoundManager.js`**: Central audio orchestrator and facade module coordinating `soundContext`, `UI_Audio`, `helicopterAudio`, and `weatherAudio` for seamless backward compatibility.
* **`weather.js`**: Controls `WeatherSystem` (day/night celestial cycle, fog density, wind forces, drag/lift multipliers, and rain particle systems).
* **`navRadio.js`**: NDB Navigation Radio module rendering a compact bottom-right avionics tuning panel (`[N]`) tracking frequency tuning in 10 kHz steps and signal lock to the 210.0 kHz approach buoy / main base, WTG beacons (350.0, 240.0, 290.0 kHz), or dynamic SAR distress frequencies.
* **`navIndicator.js`**: 3D tactical NDB bearing indicator module; attaches a transparent ring bezel and a neon-glowing amber pointer needle directly to the helicopter rotor hub (visible when Nav Radio is powered on and locked to a valid frequency) to display relative bearing to the NDB target.
* **`kneeboard.js`**: Pilot Kneeboard module rendering a styled 4-page interactive kneeboard (`[K]`) featuring flight controls reference, pre-flight/flight checklists, fuel and passenger weight manifests with seating arrangement, and an aviation chart displaying NDB beacon frequencies.
* **`windFarm.js`**: Wind Farm module spawning 3 wind turbines arranged in a circular formation facing inward around the main base origin, equipped with NDB beacons (350.0 kHz, 240.0 kHz, 290.0 kHz), independently rotating rotor blades, and flashing red obstruction warning lights.
* **`mainbase.js`**: Main Base module loading the offshore platform model serving as the primary helipad, spawn point, and 210.0 kHz NDB beacon target.
* **`lighting.js`**: Standalone lighting system module (`LightingSystem`) managing helipad center illumination and platform structure spotlights.
* **`buoy.js`**: Navigation approach buoy module (`BuoySystem`) managing buoy models, wave-floating physics dynamics, and providing positional target references for the 210.0 kHz NDB navigation radio signal.
* **`shark.js`**: Animated 3D shark module (`Shark`) managing circular ocean swimming orbits around the origin, skeletal animation playback, depth bobbing, swimming speeds, and visibility states.
* **`sharkcatch.js`**: Interactive shark catching system (`SharkCatchSystem`) managing winch hook proximity detection, mouth-to-hook attachment and transformation offsets, automated winch cable retraction drops, freefall gravitational acceleration, ocean splash particle effects, and model visibility resetting.
* **`assetWarmup.js`**: Pre-compilation and asset warmup module (`AssetWarmupSystem`) executing pre-spawning shader compilation, matrix updates, and texture uploads to GPU memory for offscreen 3D models (e.g., rescue mission survivors, liferafts, sharks) prior to hiding the loading screen, eliminating runtime frame drops during dynamic entity spawning.
* **`rotorWashSystem.js`**: Manages dynamic ocean surface rotor wash disturbance and spray particle effects under the helicopter during low-altitude flight over water.
* **`helipadDebrisSystem.js`**: Manages helipad downwash dust and debris particle effects during low-altitude hover and touchdown maneuvers on platform surfaces.
* **`liferaft.js`**: Liferaft module managing emergency sea crash deployment and survival raft simulation upon water impacts.
* **`sirenSystem.js`**: Emergency beacon system managing industrial rotating red siren lights and dynamic spotlights on the main base during fire emergencies.
* **`survivor.js`**: Animated human survivor module managing proportional skeletal model scaling ($1.75\text{m}$), winch hook attachment poses (`assets/character/raising.glb`), cabin entry visibility, main base walkway disembarkation (`assets/character/walking.glb`), turning wave animations (`assets/character/wavingbye.glb`), and building interior vanishing.
* **`utilities.js`**: Developer tool module (`DeveloperTool`) providing a UI panel (`[T]`) for toggling day/night time, weather conditions, free camera mode, and a Winch Position Calibrator panel with live X, Y, Z offset sliders.
* **`winch.js`**: Dedicated rescue winch system module managing cable physics, hook deployment/retraction states (`[X]`), operating airspeed thresholds, and real-time helicopter mounting offset transformations.
* **`rescueMission.js`**: Search & Rescue mission module managing emergency SOS distress calls, pager UI alerts, dynamic NDB frequency broadcasts, liferaft spawning with flashing red beacons, winch hook survivor hoisting, platform disembarkation sequences, pre-spawn asset warmups, and configurable auto-repeating mission timers.
* **`searchlight.js`**: Automated aviation searchlight module managing narrow cylinder beam profiling (`Math.PI / 36`), intelligent night/dusk/dawn and storm/fog dynamic range adaptation (80m in storms, 250m clear), and automated target tracking for the main base, wind turbines, and SAR rescue rafts.

### Core Controls & Key Bindings

* **`[Q]`**: Toggle Electrical System (Battery)
* **`[F]`**: Toggle Fuel Pump
* **`[E]`**: Toggle Engine Ignition / Fuel Cutoff
* **`[G]`**: Toggle Landing Gear
* **`[L]`**: Toggle Landing Light
* **`[N]`**: Toggle NDB Navigation Radio Panel
* **`[K]`**: Toggle Pilot Kneeboard Display (and switch pages 1–4 when open)
* **`[T]`**: Toggle Developer Tool UI (Time of Day, Weather, and Winch Calibration Controls)
* **`[X]`**: Deploy / Retract Rescue Winch
* **`Space Bar`**: Hold to continuously dispense aerial firefighting water/foam spray.
* **`Arrow Keys`**: Pitch / Roll / Turn movement
* **`Shift / Ctrl`**: Collective Up / Down (Altitude)
* **`Mouse Wheel`**: Adjust camera follow distance

### Key Gameplay & Simulation Features

* **Aircraft Model**: Eurocopter Dauphin helicopter with animated rotor blades and aerodynamic properties.
* **Environment & Lighting**: Offshore main base platform equipped with helipad and structure lights set against dynamic ocean waves and day/night weather cycles, complemented by navigation approach buoys and a circular wind farm featuring 3 inward-facing wind turbines with NDB radio beacons (350.0, 240.0, 290.0 kHz), synchronized flashing red obstruction lights, and emergency siren systems.
* **Flight Systems**: Modeled autorotation, landing gear drag penalties, dynamic fuel consumption based on mass and weather, and exterior strobe lighting low-fuel warnings (<= 500 kg fast orange blink, <= 100 kg rapid red blink).
* **Firefighting Water Drop System**: High-density volumetric particle system (`waterSystem.js`) featuring procedural aerated white mist/foam textures, gravitational acceleration, and aerodynamic slipstream drag sweep matching real-world helicopter water bucket drops.
* **Modular Audio System**: Cleanly separated Web Audio subsystems (`soundContext.js`, `UI_Audio.js`, `helicopterAudio.js`, `weatherAudio.js`) orchestrated by `SoundManager.js` handling switches, radio clicks, fuel pumps, landing gear servos, splash/spray effects, engine turbine whine, rotor slap ("whop-whop"), rain, howling wind, and thunder.
* **Instrumentation & Navigation**: Real-time HUD, NDB avionics tuning panel (10 kHz steps), 3D cockpit-attached bearing indicator needle pointing toward tuned NDB beacon targets, an interactive 4-page pilot kneeboard with weight/balance manifests and aviation charts, and an SOS pager UI display.
* **Search & Rescue (SAR) & Winch System**: Emergency distress pager alerts with randomized NDB beacon frequencies, sea-based liferaft locate-and-rescue mechanics, dedicated rescue winch module (`winch.js`) with cable physics, speed safety limits, and hook deployment (`[X]`), proportional 3D survivor character hoisting (`survivor.js`), base walkway disembarkation and waving animations, live developer calibration panel (`[T]`), pre-spawn asset compilation, and configurable auto-spawning mission timers.
* **Interactive Marine Shark Catching System**: Dynamic ocean swimming shark model (`shark.js`) orbiting around the marine base environment, fully integrated with the winch hook system (`sharkcatch.js`). Lowering the winch hook within proximity threshold ($12.0\text{m}$) attached to an active shark model triggers biting attachment at calculated mouth offsets, transforming orientation with the helicopter heading, and dropping into freefall acceleration with dynamic ocean water splashes when the winch cable is retracted.
* **Automated Searchlight System**: Intelligent aviation searchlight (`searchlight.js`) that activates during night, dusk, dawn, or storm conditions when electrical and engine systems are active, projecting a focused cylinder-like beam (`Math.PI / 36` angle) to automatically lock onto and illuminate nearby targets including the main base, wind turbines, and rescue liferafts.
* **Shader & Asset Warmup System**: Dedicated asset pre-warming system (`assetWarmup.js`) that pre-compiles all WebGL shaders, materials, textures, and matrix hierarchies for background and mission entities during initial scene load, guaranteeing zero frame stutter when spawning SAR survivors or marine life mid-flight.

### Assets

* **`helicopter.glb`**: Primary 3D Eurocopter Dauphin helicopter model with rotor animation mixers.
* **`mainbase.glb`**: Offshore platform 3D model serving as the primary helipad, spawn point, and NDB beacon target (210.0 kHz).
* **`WTG.glb`**: 3D wind turbine model utilized by the wind farm module.
* **`liferaft.glb`**: 3D liferaft model utilized by the rescue mission and liferaft manager modules.
* **`shark.glb`**: 3D swimming shark model with skeletal animation mixers (`Armature|Swim`, `Armature|Sharkswim`, etc.) utilized by the shark module (`shark.js`).
* **`sharkcatch.glb`**: 3D caught shark model utilized by the shark catch system (`sharkcatch.js`) during winch hook attachment.
* **`assets/character/raising.glb`**: Animated 3D survivor character model in winch holding pose.
* **`assets/character/walking.glb`**: Animated 3D survivor character model in forward walk cycle.
* **`assets/character/wavingbye.glb`**: Animated 3D survivor character model in standing wave gesture.

---

### Strict AI Coding Rules

1. **Full File Outputs Only**: ALWAYS provide complete, ready-to-use updated code files. NEVER use placeholders, truncation, or partial snippets like `// ... rest of code stays the same ...`.
2. **Strict Modular Isolation**: Keep features in separate modules. Do NOT mix new, unrelated functionality into existing modules. If a requested feature does not cleanly fit into an existing file, instruct me to create a NEW module file and provide that code separately alongside minimal imports.
3. **Preserve Existing Features**: Do NOT remove or refactor unmentioned game objects, lights, controls, shadow mechanics, or camera lerp systems unless explicitly instructed.
4. **Maintain Code Cleanliness**: Keep code well-organized, clean, and commented to prevent codebase degradation over time.
5. **Ask for Missing Code**: If a requested feature requires modifying an existing file and I have not provided that file in the chat, ask me to paste it before generating updated code.
6. **Scope Isolation & Zero Unrequested Changes**: Strictly no unprompted edits to working code, key bindings, or core flight mechanics. If a change impacts outside systems, you must explicitly notify me of the side effects before generating code.
7. **Strict User Code Retention**: When a modification is requested for an existing module file, the AI MUST use the exact user-supplied source code as the baseline. The AI is strictly prohibited from substituting generic or placeholder class implementations when updating code, and must patch or integrate requested additions directly into the user's provided file structure.