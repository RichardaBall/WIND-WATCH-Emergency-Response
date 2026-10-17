export class StateMachine {
    constructor(context = null) {
        this.context = context;
        this.states = new Map();
        this.currentStateKey = null;
        this.currentState = null;
        this.previousStateKey = null;
    }

    addState(key, stateConfig) {
        this.states.set(key, {
            enter: stateConfig.enter || (() => {}),
            update: stateConfig.update || (() => {}),
            exit: stateConfig.exit || (() => {})
        });
        return this;
    }

    changeState(key, ...args) {
        if (!this.states.has(key)) {
            console.warn(`[StateMachine] State '${key}' is not registered.`);
            return false;
        }

        if (this.currentState && typeof this.currentState.exit === 'function') {
            this.currentState.exit(this.context);
        }

        this.previousStateKey = this.currentStateKey;
        this.currentStateKey = key;
        this.currentState = this.states.get(key);

        console.log(`[StateMachine] State Transition: ${this.previousStateKey} -> ${this.currentStateKey}`);

        if (this.currentState && typeof this.currentState.enter === 'function') {
            this.currentState.enter(this.context, ...args);
        }

        return true;
    }

    update(delta, ...args) {
        if (this.currentState && typeof this.currentState.update === 'function') {
            this.currentState.update(this.context, delta, ...args);
        }
    }

    getCurrentState() {
        return this.currentStateKey;
    }
}