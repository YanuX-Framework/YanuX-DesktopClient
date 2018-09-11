const noble = require('noble');
const BeaconDetector = require('./BeaconDetector');

module.exports = class BeaconScanner {
    constructor(refreshInterval, inactivityTimer,
        id = null, type = null, values = []) {
        this.beacons = {};
        this._beaconDetector = new BeaconDetector();
        this._refreshInterval = refreshInterval;
        this._inactivityTimer = inactivityTimer;
        this.id = id;
        this.type = type;
        this.values = values
        this.clearUnseenBeaconsPolling = null;
    }
    startScanning(callback) {
        noble.on('stateChange', state => {
            if (state === 'poweredOn') {
                noble.startScanning([], true, callback);
                this.clearUnseenBeaconsPolling = setInterval(() => {
                    let currentTime = new Date().getTime();
                    let currentBeacons = Object.entries(this.beacons);
                    currentBeacons.forEach(beacon => {
                        if (currentTime - beacon[1].timestamp > this._inactivityTimer) {
                            delete this.beacons[beacon[0].key];
                        }
                    });
                }, this._refreshInterval);
            }
        });
        noble.on('discover', peripheral => {
            this._beaconDetector.peripheral = peripheral;
            const beacon = this._beaconDetector.beacon;
            if ((!this.id
                || (this.id && beacon.id === this.id))
                && (!this.type
                    || (this.type && beacon.type === this.type))
                && (!this.values
                    || this.values.length === 0
                    || (this.values && beacon.values.join() === this.values.join()))) {
                this.beacons[beacon.key] = beacon;
            }
        })
    }
    stopScanning(callback) {
        clearInterval(this.clearUnseenBeaconsPolling);
        noble.stopScanning(callback);
    }
}