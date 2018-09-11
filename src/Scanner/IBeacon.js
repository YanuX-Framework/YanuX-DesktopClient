const Beacon = require('./Beacon');

module.exports = class IBeacon extends Beacon {
    constructor(id, uuid, major, minor, txPower, rssi, timestamp) {
        super(id, 'iBeacon', [uuid, major, minor], txPower, rssi, timestamp);
    }

    get uuid() {
        return this.values[0];
    }

    get major() {
        return this.values[1];
    }

    get minor() {
        return this.values[2];
    }
}