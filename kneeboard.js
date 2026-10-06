export class Kneeboard {
    constructor() {
        this.visible = true; // Open by default at the start of the game
        this.playerRef = null;
        this.navRadioRef = null;
        this.windFarmRef = null;
        this.currentPage = 0;
        this.totalPages = 4;
        this.isFuelDragging = false;
        this.isWaterDragging = false;
        this.createElement();
        this.initListeners();
    }

    setWindFarmRef(windFarm) {
        this.windFarmRef = windFarm;
    }

    createElement() {
        this.container = document.createElement('div');
        this.container.id = 'pilot-kneeboard';
        this.container.style.cssText = `
            position: absolute;
            bottom: 65px;
            left: 30px;
            width: 350px;
            background: #d8d0b0;
            border: 4px solid #4a4532;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,0,0,0.08);
            font-family: 'Courier New', Courier, monospace;
            color: #222;
            padding: 14px 18px 14px 18px;
            display: block;
            z-index: 1000;
            user-select: none;
            pointer-events: auto;
        `;

        // Prevent all pointer/mouse/touch/wheel events from bubbling to canvas or orbit controls
        const stopEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mousemove', 'mouseup', 'click', 'input', 'wheel', 'touchstart', 'touchmove', 'touchend'];
        stopEvents.forEach(eventType => {
            this.container.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
        });

        // Metallic binder clip at the top
        const clip = document.createElement('div');
        clip.style.cssText = `
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 15px;
            background: linear-gradient(to bottom, #a0a0a0, #505050);
            border: 1px solid #333;
            border-radius: 3px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        `;
        this.container.appendChild(clip);

        // Header title
        const header = document.createElement('div');
        header.style.cssText = `
            font-weight: bold;
            font-size: 14px;
            border-bottom: 2px dashed #6b634b;
            padding-bottom: 6px;
            margin-bottom: 10px;
            text-align: center;
            letter-spacing: 1px;
            color: #1a1a1a;
        `;
        header.innerText = 'PILOT KNEEBOARD';
        this.container.appendChild(header);

        // Pages container
        this.pagesWrapper = document.createElement('div');
        this.pagesWrapper.style.cssText = `
            position: relative;
            min-height: 400px;
            overflow: hidden;
        `;

        // Page 1: Controls Reference
        this.page1El = document.createElement('div');
        this.page1El.style.cssText = this.getPageStyle(0);
        this.page1El.innerHTML = `
            <div style="font-weight: bold; text-align: center; text-decoration: underline; font-size: 12px; margin-bottom: 8px; color: #3a3525; letter-spacing: 0.5px;">CONTROLS</div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">1. SYSTEMS</div>
                <div style="display: flex; justify-content: space-between;"><span>Battery Switch:</span><strong>[Q]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Fuel Pump Prime:</span><strong>[F]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Engine Ignition:</span><strong>[E]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Navigation Radio:</span><strong>[N]</strong></div>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">2. FLIGHT CONTROLS</div>
                <div style="display: flex; justify-content: space-between;"><span>Pitch / Roll / Yaw:</span><strong>Arrow Keys</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Collective Up/Dn:</span><strong>Shift/Ctrl</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Camera Zoom:</span><strong>Mouse Wheel</strong></div>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">3. LIGHTING & GEAR</div>
                <div style="display: flex; justify-content: space-between;"><span>Landing Gear:</span><strong>[G]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Landing Light:</span><strong>[L]</strong></div>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">4. FIREFIGHTING & UI</div>
                <div style="display: flex; justify-content: space-between;"><span>Water Spray:</span><strong>Hold [Space]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>Toggle Kneeboard:</span><strong>[K]</strong></div>
            </div>

            <div style="margin-bottom: 6px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">5. LIFTING OPERATIONS</div>
                <div style="display: flex; justify-content: space-between;"><span>Winch Up/Down:</span><strong>[X]</strong></div>
            </div>

            <div style="font-size: 10.5px; border-top: 1px dashed #6b634b; padding-top: 4px; margin-top: 4px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">IN-FLIGHT NOTES:</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <div><strong>Fuel QTY</strong><br><span style="font-size: 9.5px; color: #4a4532;">(Tail Strobe)</span></div>
                    <div style="text-align: left;">
                        <div style="text-align: left;">White (50-100%)</div>
                        <div style="text-align: left;">Amber (10-50%)</div>
                        <div style="text-align: left;">Red (&lt;10%)</div>
                    </div>
                </div>
                <div style="margin-top: 4px;">• ADF: Yellow arrow on rotor hub indicates relative NDB station bearing.</div>
            </div>
        `;

        // Page 2: Flight Checklist
        this.page2El = document.createElement('div');
        this.page2El.style.cssText = this.getPageStyle(1);
        this.page2El.innerHTML = `
            <div style="font-weight: bold; text-align: center; text-decoration: underline; font-size: 12px; margin-bottom: 8px; color: #3a3525; letter-spacing: 0.5px;">CHECKLIST</div>

            <div style="margin-bottom: 7px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">1. PRE-FLIGHT / GROUND</div>
                <div style="display: flex; justify-content: space-between;"><span>• Refuel & Water Fill:</span><strong>[Page 3]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Fuel OFF:</span><strong>(F)</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Engine OFF:</span><strong>(E)</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Battery Switch OFF:</span><strong>(Q)</strong></div>
            </div>

            <div style="margin-bottom: 7px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">2. STARTUP</div>
                <div style="display: flex; justify-content: space-between;"><span>• Battery Switch:</span><strong>ON [Q]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Fuel Pump Prime:</span><strong>ON [F]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Engine Starter:</span><strong>ON [E]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Nav Radio Tuned:</span><strong>VERIFY [N]</strong></div>
            </div>

            <div style="margin-bottom: 7px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">3. AFTER TAKEOFF</div>
                <div style="display: flex; justify-content: space-between;"><span>• Landing Gear:</span><strong>UP [G]</strong></div>
            </div>

            <div style="margin-bottom: 7px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">4. BEFORE LANDING</div>
                <div style="display: flex; justify-content: space-between;"><span>• Landing Gear:</span><strong>DOWN [G]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Landing Light:</span><strong>AS REQ [L]</strong></div>
            </div>

            <div style="margin-bottom: 7px; font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">5. SHUTDOWN</div>
                <div style="display: flex; justify-content: space-between;"><span>• Fuel Pump:</span><strong>OFF [F]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Engine Cutoff:</span><strong>OFF [E]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Battery Switch:</span><strong>OFF [Q]</strong></div>
            </div>

            <div style="font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px;">6. LIFTING EQUIPMENT</div>
                <div style="display: flex; justify-content: space-between;"><span>• Gear Up:</span><strong>[G]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Winch Up:</span><strong>[X]</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>• Winch Down:</span><strong>[X]</strong></div>
            </div>
        `;

        // Page 3: Fuel & Water Tank Manifest
        this.page3El = document.createElement('div');
        this.page3El.style.cssText = this.getPageStyle(2);
        this.page3El.innerHTML = `
            <div style="font-weight: bold; text-align: center; text-decoration: underline; font-size: 12px; margin-bottom: 6px; color: #3a3525; letter-spacing: 0.5px;">MANIFEST</div>

            <div style="margin-bottom: 5px; font-size: 10px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">REFUEL MANIFEST (Max 1000 kg)</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Fuel Load:</span><span><strong id="kb-fuel-val">1000</strong> kg</span>
                </div>
                <input type="range" id="kb-fuel-slider" min="0" max="1000" value="1000" step="10" style="width: 100%; accent-color: #4a4532; cursor: pointer; height: 14px;">
            </div>

            <div style="margin-bottom: 5px; font-size: 10px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">WATER TANK MANIFEST (Max 1000 kg)</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 1px;">
                    <span>Water Load:</span><span><strong id="kb-water-val">1000</strong> kg</span>
                </div>
                <input type="range" id="kb-water-slider" min="0" max="1000" value="1000" step="10" style="width: 100%; accent-color: #2675b4; cursor: pointer; height: 14px;">
            </div>

            <div style="margin-bottom: 5px; font-size: 10px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">WATER TANK STATUS</div>
                <div style="background: #c9bf9b; border: 2px solid #4a4532; border-radius: 4px; padding: 4px; text-align: center;">
                    <div style="font-size: 9px; font-weight: bold; margin-bottom: 3px; color: #1c4e80;">[ FIREFIGHTING TANK ]</div>
                    <div style="width: 100%; background: #b0a682; height: 12px; border: 1px solid #4a4532; border-radius: 3px; overflow: hidden; position: relative;">
                        <div id="kb-water-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #38bdf8, #0284c7); transition: width 0.1s ease-out;"></div>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
                            <span id="kb-water-pct">100</span>%
                        </div>
                    </div>
                </div>
            </div>

            <div style="font-size: 10px; font-weight: bold; border-top: 1px dashed #6b634b; padding-top: 3px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>Total Gross Mass:</span><span><strong id="kb-total-mass">6600</strong> kg</span>
            </div>

            <div style="font-size: 10px; border-top: 1px dashed #6b634b; padding-top: 3px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2px; color: #111111;">PILOT'S NOTES:</div>
                <div style="font-family: 'Brush Script MT', 'Comic Sans MS', cursive, sans-serif; font-size: 20px; color: #000000; line-height: 1.15; transform: rotate(-0.5deg);">
                    Platform workers reporting large marine life circling the base again. Keep winching cables clear during ops—had a near miss with a greedy apex predator taking a bite at the hook last Tuesday.
                </div>
            </div>
        `;

        // Page 4: Aviation Chart & Nav Frequencies
        this.page4El = document.createElement('div');
        this.page4El.style.cssText = this.getPageStyle(3);
        this.page4El.innerHTML = `
            <div style="font-weight: bold; text-align: center; text-decoration: underline; font-size: 12px; margin-bottom: 6px; color: #3a3525; letter-spacing: 0.5px;">AVIATION CHART</div>

            <div style="position: relative; background: #cebfa0; border: 2px solid #4a4532; border-radius: 4px; height: 185px; box-sizing: border-box; margin-bottom: 6px; overflow: hidden;">
                <svg width="100%" height="100%" viewBox="0 0 320 185" style="display: block;">
                    <!-- Background Grid / Compass Rings -->
                    <circle cx="160" cy="92" r="60" fill="none" stroke="#b5ac8c" stroke-width="1" stroke-dasharray="3,3" />
                    <circle cx="160" cy="92" r="110" fill="none" stroke="#b5ac8c" stroke-width="1" stroke-dasharray="3,3" />
                    <line x1="160" y1="10" x2="160" y2="175" stroke="#b5ac8c" stroke-width="1" stroke-dasharray="2,2" />
                    <line x1="20" y1="92" x2="300" y2="92" stroke="#b5ac8c" stroke-width="1" stroke-dasharray="2,2" />

                    <!-- North Arrow -->
                    <text x="295" y="20" font-family="'Courier New', monospace" font-size="12" font-weight="bold" fill="#4a4532" text-anchor="end">N ▲</text>

                    <!-- Connection Lines -->
                    <line x1="160" y1="92" x2="240" y2="55" stroke="#4a4532" stroke-width="1.5" stroke-dasharray="4,3" />
                    <line x1="160" y1="92" x2="200" y2="135" stroke="#4a4532" stroke-width="1.5" stroke-dasharray="4,3" />
                    <line x1="160" y1="92" x2="90" y2="70" stroke="#4a4532" stroke-width="1.5" stroke-dasharray="4,3" />

                    <!-- Base (Center) -->
                    <g transform="translate(160, 92)">
                        <circle cx="0" cy="0" r="7" fill="#000000" stroke="#fff" stroke-width="2" />
                        <text x="0" y="24" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="#000000" text-anchor="middle">BASE</text>
                    </g>

                    <!-- WTG 1 (NE) -->
                    <g transform="translate(240, 55)">
                        <circle id="chart-wtg-dot-0" cx="0" cy="0" r="6" fill="#222" stroke="#fff" stroke-width="2" />
                        <text id="chart-wtg-text-0" x="0" y="-10" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="#222" text-anchor="middle">WTG 1</text>
                    </g>

                    <!-- WTG 2 (SE) -->
                    <g transform="translate(200, 135)">
                        <circle id="chart-wtg-dot-1" cx="0" cy="0" r="6" fill="#222" stroke="#fff" stroke-width="2" />
                        <text id="chart-wtg-text-1" x="0" y="24" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="#222" text-anchor="middle">WTG 2</text>
                    </g>

                    <!-- WTG 3 (NW) -->
                    <g transform="translate(90, 70)">
                        <circle id="chart-wtg-dot-2" cx="0" cy="0" r="6" fill="#222" stroke="#fff" stroke-width="2" />
                        <text id="chart-wtg-text-2" x="0" y="-10" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="#222" text-anchor="middle">WTG 3</text>
                    </g>
                </svg>
            </div>

            <div style="font-size: 11px;">
                <div style="font-weight: bold; text-decoration: underline; margin-bottom: 3px; color: #3a3525;">NAV & OBSTRUCTION FREQUENCIES</div>
                <div style="background: #c9bf9b; border: 1px solid #4a4532; border-radius: 3px; padding: 5px 8px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #b5ac8c; padding-bottom: 2px; margin-bottom: 2px;">
                        <span><strong>BASE:</strong></span>
                        <span><strong>210.0 kHz</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #b5ac8c; padding-bottom: 2px; margin-bottom: 2px;">
                        <span><strong>WTG 1:</strong></span>
                        <span><strong>350.0 kHz</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #b5ac8c; padding-bottom: 2px; margin-bottom: 2px;">
                        <span><strong>WTG 2:</strong></span>
                        <span><strong>240.0 kHz</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span><strong>WTG 3:</strong></span>
                        <span><strong>290.0 kHz</strong></span>
                    </div>
                </div>
            </div>
        `;

        this.pagesWrapper.appendChild(this.page1El);
        this.pagesWrapper.appendChild(this.page2El);
        this.pagesWrapper.appendChild(this.page3El);
        this.pagesWrapper.appendChild(this.page4El);
        this.container.appendChild(this.pagesWrapper);

        // Bottom Tab Bar
        const tabFooter = document.createElement('div');
        tabFooter.style.cssText = `
            display: flex;
            gap: 4px;
            border-top: 2px dashed #6b634b;
            padding-top: 8px;
            margin-top: 8px;
        `;

        this.tab1Btn = document.createElement('button');
        this.tab1Btn.innerText = 'CONTROLS';
        this.tab1Btn.style.cssText = this.getTabStyle(true);
        this.tab1Btn.addEventListener('click', () => this.switchPage(0));

        this.tab2Btn = document.createElement('button');
        this.tab2Btn.innerText = 'CHECKLIST';
        this.tab2Btn.style.cssText = this.getTabStyle(false);
        this.tab2Btn.addEventListener('click', () => this.switchPage(1));

        this.tab3Btn = document.createElement('button');
        this.tab3Btn.innerText = 'MANIFEST';
        this.tab3Btn.style.cssText = this.getTabStyle(false);
        this.tab3Btn.addEventListener('click', () => this.switchPage(2));

        this.tab4Btn = document.createElement('button');
        this.tab4Btn.innerText = 'CHART';
        this.tab4Btn.style.cssText = this.getTabStyle(false);
        this.tab4Btn.addEventListener('click', () => this.switchPage(3));

        tabFooter.appendChild(this.tab1Btn);
        tabFooter.appendChild(this.tab2Btn);
        tabFooter.appendChild(this.tab3Btn);
        tabFooter.appendChild(this.tab4Btn);
        this.container.appendChild(tabFooter);

        const styleTag = document.createElement('style');
        styleTag.innerHTML = `
            input[type=range]:disabled { opacity: 0.5; cursor: not-allowed !important; }
        `;
        document.head.appendChild(styleTag);

        document.body.appendChild(this.container);

        // Slider listeners with explicit drag state tracking & bounds clamping
        const fuelSlider = this.container.querySelector('#kb-fuel-slider');
        if (fuelSlider) {
            fuelSlider.addEventListener('pointerdown', (e) => { 
                e.stopPropagation();
                this.isFuelDragging = true; 
            });
            fuelSlider.addEventListener('pointerup', () => { this.isFuelDragging = false; });
            fuelSlider.addEventListener('pointercancel', () => { this.isFuelDragging = false; });
            fuelSlider.addEventListener('change', () => { this.isFuelDragging = false; });

            fuelSlider.addEventListener('input', (e) => {
                if (this.playerRef && this.isConfigAllowed(this.playerRef)) {
                    const val = parseFloat(e.target.value);
                    const maxFuel = this.playerRef.maxFuelKg || 1000;
                    this.playerRef.fuelKg = Math.max(0, Math.min(val, maxFuel));
                    const valEl = document.getElementById('kb-fuel-val');
                    if (valEl) valEl.innerText = Math.round(this.playerRef.fuelKg);
                    this.updateManifestDisplay();
                }
            });
        }

        const waterSlider = this.container.querySelector('#kb-water-slider');
        if (waterSlider) {
            waterSlider.addEventListener('pointerdown', (e) => { 
                e.stopPropagation();
                this.isWaterDragging = true; 
            });
            waterSlider.addEventListener('pointerup', () => { this.isWaterDragging = false; });
            waterSlider.addEventListener('pointercancel', () => { this.isWaterDragging = false; });
            waterSlider.addEventListener('change', () => { this.isWaterDragging = false; });

            waterSlider.addEventListener('input', (e) => {
                if (this.playerRef && this.isConfigAllowed(this.playerRef)) {
                    const val = parseFloat(e.target.value);
                    const maxWater = this.playerRef.maxWaterTankKg || 1000;
                    this.playerRef.waterTankKg = Math.max(0, Math.min(val, maxWater));
                    const waterValEl = document.getElementById('kb-water-val');
                    if (waterValEl) waterValEl.innerText = Math.round(this.playerRef.waterTankKg);
                    this.updateWaterBarVisuals(this.playerRef.waterTankKg);
                    this.updateManifestDisplay();
                }
            });
        }
    }

    getPageStyle(index) {
        const isDefault = index === 0;
        return `
            position: absolute;
            width: 100%;
            transition: transform 0.35s ease-in-out, opacity 0.35s ease-in-out;
            opacity: ${isDefault ? '1' : '0'};
            transform: translateX(${index * 100}%);
        `;
    }

    getTabStyle(active) {
        return `
            flex: 1;
            background: ${active ? '#4a4532' : '#b8b090'};
            color: ${active ? '#d8d0b0' : '#4a4532'};
            border: 1px solid #4a4532;
            padding: 6px 2px;
            font-family: inherit;
            font-size: 9.5px;
            font-weight: bold;
            border-radius: 3px;
            cursor: pointer;
            text-align: center;
            transition: background 0.2s, color 0.2s;
        `;
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyK') {
                this.toggle();
            } else if (this.visible) {
                if (e.code === 'Digit1') this.switchPage(0);
                else if (e.code === 'Digit2') this.switchPage(1);
                else if (e.code === 'Digit3') this.switchPage(2);
                else if (e.code === 'Digit4') this.switchPage(3);
            }
        });
    }

    switchPage(pageIndex) {
        if (pageIndex === this.currentPage) return;
        this.currentPage = pageIndex;

        const tabs = [this.tab1Btn, this.tab2Btn, this.tab3Btn, this.tab4Btn];
        const pages = [this.page1El, this.page2El, this.page3El, this.page4El];

        tabs.forEach((tab, idx) => {
            tab.style.cssText = this.getTabStyle(idx === this.currentPage);
        });

        pages.forEach((page, idx) => {
            const diff = idx - this.currentPage;
            page.style.transform = `translateX(${diff * 100}%)`;
            page.style.opacity = (diff === 0) ? '1' : '0';
        });
    }

    toggle() {
        this.visible = !this.visible;
        this.container.style.display = this.visible ? 'block' : 'none';
    }

    isConfigAllowed(player) {
        if (!player) return true;
        
        const qOff = !player.batteryOn && !player.isElectricalOn && !player.powerOn && !player.isBatteryOn;
        const fOff = !player.fuelPumpOn && !player.isFuelPumpOn && !player.fuelPump;
        const eOff = !player.engineRunning && !player.isEngineRunning && !player.engineOn && !player.isEngineOn && !player.isStarterOn && !player.starterOn && !player.ignitionOn;
        
        return qOff && fOff && eOff;
    }

    updateWaterBarVisuals(waterKg) {
        const maxWater = this.playerRef ? (this.playerRef.maxWaterTankKg || 1000) : 1000;
        const pct = Math.max(0, Math.min(100, Math.round((waterKg / maxWater) * 100)));
        const waterBar = document.getElementById('kb-water-bar');
        const waterPct = document.getElementById('kb-water-pct');
        if (waterBar) waterBar.style.width = `${pct}%`;
        if (waterPct) waterPct.innerText = pct;
    }

    updateManifestDisplay() {
        const fuelSlider = document.getElementById('kb-fuel-slider');
        const waterSlider = document.getElementById('kb-water-slider');
        const fuelVal = fuelSlider ? parseFloat(fuelSlider.value) : (this.playerRef ? this.playerRef.fuelKg : 1000);
        const waterVal = waterSlider ? parseFloat(waterSlider.value) : (this.playerRef ? this.playerRef.waterTankKg : 1000);

        const totalMassEl = document.getElementById('kb-total-mass');
        if (totalMassEl && this.playerRef) {
            const emptyWeight = this.playerRef.dryWeightKg || 4600;
            const total = emptyWeight + fuelVal + waterVal;
            totalMassEl.innerText = Math.round(total);
        }
    }

    update(player, weatherData, navRadio) {
        this.playerRef = player;
        if (!this.visible) return;

        if (!this.windFarmRef && window.windFarm) {
            this.windFarmRef = window.windFarm;
        }
        if (!this.windFarmRef && player && player.model && player.model.parent) {
            player.model.parent.traverse((child) => {
                if (child.activeFireIndex !== undefined || child.burningIndex !== undefined || child.fireIndex !== undefined || child.turbines || (child.userData && child.userData.activeFireIndex !== undefined)) {
                    this.windFarmRef = child;
                }
            });
        }

        if (player) {
            const allowed = this.isConfigAllowed(player);
            const fuelSlider = document.getElementById('kb-fuel-slider');
            const waterSlider = document.getElementById('kb-water-slider');

            if (fuelSlider) fuelSlider.disabled = !allowed;
            if (waterSlider) waterSlider.disabled = !allowed;

            // Only update slider values from game state if user is NOT actively dragging them
            if (allowed && fuelSlider && !this.isFuelDragging && player.fuelKg !== undefined) {
                fuelSlider.value = player.fuelKg;
                const fuelVal = document.getElementById('kb-fuel-val');
                if (fuelVal) fuelVal.innerText = Math.round(player.fuelkg);
            }

            if (allowed && waterSlider && !this.isWaterDragging && player.waterTankKg !== undefined) {
                waterSlider.value = player.waterTankKg;
                const waterVal = document.getElementById('kb-water-val');
                if (waterVal) waterVal.innerText = Math.round(player.waterTankKg);
                this.updateWaterBarVisuals(player.waterTankKg);
            }

            this.updateManifestDisplay();

            if (allowed) {
                const wf = this.windFarmRef;
                const activeFireIdx = wf ? (
                    wf.activeFireIndex !== undefined ? wf.activeFireIndex :
                    wf.burningIndex !== undefined ? wf.burningIndex :
                    wf.fireIndex !== undefined ? wf.fireIndex :
                    (wf.userData && wf.userData.activeFireIndex !== undefined ? wf.userData.activeFireIndex : -1)
                ) : (window.windFarm && window.windFarm.activeFireIndex !== undefined ? window.windFarm.activeFireIndex : -1);

                for (let i = 0; i < 3; i++) {
                    const dotEl = document.getElementById(`chart-wtg-dot-${i}`);
                    const textEl = document.getElementById(`chart-wtg-text-${i}`);
                    const isOnFire = (i === activeFireIdx);

                    if (dotEl) {
                        dotEl.style.fill = isOnFire ? '#c05000' : '#222222';
                    }
                    if (textEl) {
                        textEl.style.fill = isOnFire ? '#c05000' : '#222222';
                    }
                }
            }
        }
    }
}