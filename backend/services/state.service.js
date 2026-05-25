/**
 * StateService manages the global system state for the guard system.
 * It's the single source of truth for the backend and synchronized with frontends via WebSockets.
 */
class StateService {
    constructor() {
        this.state = {
            mode: 'INSECURE', // 'INSECURE' or 'SECURE'
            doorState: 'LOCKED', // 'LOCKED' or 'OPEN'
            alarmStatus: 'IDLE', // 'IDLE' or 'ACTIVE'
            rfidRequired: false,
            rfidStatus: 'READY', // 'READY' or 'ERROR'
            cardStatus: 'NONE', // 'REGISTERED' or 'NONE'
            networkStatus: 'CONNECTING',
            serialConnected: false,
            lastEvent: 'BOOT',
            lastCardUid: null,
            failedAttempts: 0,
            lockout: false,
            cardRegistered: false,
            isWaitingForCard: false,
            lastSniffedPin: null,
            availablePorts: [],
            rfidVersion: '0x00',
            activePort: null,
            lastDisplayPin: null,
            actualPin: null,
            pendingPin: null,
            isSniffedPinValid: null,
            serialLogs: []
        };
        this.logs = [];
        this.maxLogs = 100;
        this.callbacks = [];
    }

    getState() {
        return this.state;
    }

    getLogs() {
        return this.logs;
    }

    updateState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyUpdate();
    }

    addLog(msg, type = 'INFO', source = 'SYSTEM', meta = {}) {
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString(),
            message: msg,
            type: type.toUpperCase(),
            source,
            meta
        };

        this.logs.unshift(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        // Auto-update lastEvent if it's relevant
        if (meta.eventType) {
            this.state.lastEvent = meta.eventType;
        }

        this.notifyUpdate(logEntry);
        return logEntry;
    }

    onUpdate(callback) {
        this.callbacks.push(callback);
    }

    notifyUpdate(newLog = null) {
        this.callbacks.forEach(cb => cb(this.state, newLog));
    }

    reset() {
        this.state = {
            ...this.state,
            doorState: 'LOCKED',
            alarmStatus: 'IDLE',
            failedAttempts: 0,
            lockout: false,
            isWaitingForCard: false,
            lastSniffedPin: null,
            cardStatus: 'NONE',
            cardRegistered: false,
            networkStatus: 'CONNECTING',
            actualPin: null,
            pendingPin: null,
            isSniffedPinValid: null,
            lastEvent: 'RESET'
        };
        this.logs = [];
        this.addLog("System reset requested. All security flags cleared.", "INFO");
    }
}

module.exports = new StateService();
