import { GAME_CONFIG } from './config.js';
import { StateMachine } from './stateMachine.js';

export class MissionManager {
    constructor(scene, rescueMission, windFarm, fishermanRescueMission, navRadio, pager) {
        this.scene = scene;
        this.rescueMission = rescueMission;
        this.windFarm = windFarm;
        this.fishermanRescueMission = fishermanRescueMission;
        this.navRadio = navRadio;
        this.pager = pager;

        this.missionPool = ['rescue', 'windfarm', 'fisherman'];
        this.activeMissionType = null;
        this.lastMissionType = null;
        this.cooldownTimer = 0;
        this.initialDelayTimer = GAME_CONFIG.missions.initialDelay;

        // Initialize FSM for Mission Manager
        this.fsm = new StateMachine(this);
        this._setupStates();
        this.fsm.changeState('INITIAL_DELAY');

        window.missionManager = this;
    }

    _setupStates() {
        this.fsm.addState('INITIAL_DELAY', {
            update: (ctx, delta) => {
                ctx.initialDelayTimer -= delta;
                if (ctx.initialDelayTimer <= 0) {
                    ctx.fsm.changeState('IDLE');
                }
            }
        })
        .addState('IDLE', {
            enter: (ctx) => {
                ctx.startRandomMission();
            }
        })
        .addState('ACTIVE', {
            update: (ctx, delta, helicopterPlayer, mainBase, waterSystem) => {
                // Delegate update to active mission module
                if (ctx.activeMissionType === 'rescue' && ctx.rescueMission) {
                    ctx.rescueMission.update(delta, helicopterPlayer, mainBase);
                    if (['RESPAWN_WAIT', 'COMPLETED'].includes(ctx.rescueMission.state)) {
                        ctx.fsm.changeState('COOLDOWN');
                    }
                } else if (ctx.activeMissionType === 'windfarm' && ctx.windFarm) {
                    if (ctx.windFarm.activeFireIndex === -1) {
                        ctx.fsm.changeState('COOLDOWN');
                    }
                } else if (ctx.activeMissionType === 'fisherman' && ctx.fishermanRescueMission) {
                    ctx.fishermanRescueMission.update(delta, helicopterPlayer, mainBase, waterSystem);
                    if (ctx.fishermanRescueMission.state === 'COMPLETED') {
                        ctx.fsm.changeState('COOLDOWN');
                    }
                }
            }
        })
        .addState('COOLDOWN', {
            enter: (ctx) => {
                if (ctx.activeMissionType) {
                    ctx.lastMissionType = ctx.activeMissionType;
                }
                ctx.activeMissionType = null;
                ctx.cooldownTimer = GAME_CONFIG.missions.cooldownDuration;
                if (ctx.pager) ctx.pager.hide();
            },
            update: (ctx, delta) => {
                ctx.cooldownTimer -= delta;
                if (ctx.cooldownTimer <= 0) {
                    ctx.fsm.changeState('IDLE');
                }
            }
        });
    }

    startRandomMission() {
        let availableMissions = this.missionPool;
        if (this.lastMissionType !== null && this.missionPool.length > 1) {
            availableMissions = this.missionPool.filter(m => m !== this.lastMissionType);
        }

        const randomIndex = Math.floor(Math.random() * availableMissions.length);
        this.activeMissionType = availableMissions[randomIndex];

        console.log(`[MissionManager] Spawning mission: ${this.activeMissionType}`);

        if (this.activeMissionType === 'rescue' && this.rescueMission) {
            this.rescueMission.startMission();
        } else if (this.activeMissionType === 'windfarm' && this.windFarm) {
            this.windFarm.spawnRandomFire();
        } else if (this.activeMissionType === 'fisherman' && this.fishermanRescueMission) {
            this.fishermanRescueMission.startMission();
        }

        this.fsm.changeState('ACTIVE');
    }

    handleCrash() {
        console.log('[MissionManager] Crash detected. Resetting active missions.');
        if (this.activeMissionType) {
            this.lastMissionType = this.activeMissionType;
        }
        this.activeMissionType = null;

        if (this.rescueMission) this.rescueMission.reset();
        if (this.windFarm) this.windFarm.extinguishFire();
        if (this.fishermanRescueMission) this.fishermanRescueMission.reset();
        if (this.pager) this.pager.hide();

        this.fsm.changeState('COOLDOWN');
    }

    update(delta, helicopterPlayer, mainBase, waterSystem) {
        this.fsm.update(delta, helicopterPlayer, mainBase, waterSystem);
    }
}