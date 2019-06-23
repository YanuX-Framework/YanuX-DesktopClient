module.exports = class Beacon {
    constructor(id, type, values, txPower, rssi, timestamp = new Date().getTime()) {
        this.id = id;
        this.type = type;
        this.values = values;
        this.txPower = txPower;
        this.rssi = rssi;
        this.timestamp = timestamp;
        Object.defineProperty(this, 'avgRssi', {
            enumerable: true,
            get: function () {
                this.removeInactiveMeasurements();
                return this.measurements.reduce((sum, m) => sum + m.rssi, 0) / this.measurements.length;
            }
        });
        Object.defineProperty(this, 'measurements', {
            enumerable: false,
            writable: true,
            value: []
        });
    }
    static get measurementsInactivityTimer() {
        return this._measurementsInactivityTimer;
    }
    static set measurementsInactivityTimer(measurementsInactivityTimer) {
        this._measurementsInactivityTimer = measurementsInactivityTimer;
    }
    addMeasurement(beacon) {
        this.id = beacon.id;
        this.type = beacon.type;
        this.values = beacon.values;
        this.rssi = beacon.rssi;
        this.timestamp = beacon.timestamp;
        this.measurements.push({
            rssi: beacon.rssi,
            timestamp: beacon.timestamp
        });
        this.removeInactiveMeasurements();
        return this;
    }
    removeInactiveMeasurements() {
        this.measurements = this.measurements.filter(m => new Date() - m.timestamp < Beacon.measurementsInactivityTimer);
    }
    get key() {
        return `${this.id}-${this.type}-${this.values.join('-')}`;
    }
}