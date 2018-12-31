const bleno = require('@abandonware/bleno');

module.exports = class IBeaconAdvertiser {
    constructor(uuid, major, minor, measuredPower = -59) {
        this.uuid = uuid;
        this.major = major;
        this.minor = minor;
        this.measuredPower = measuredPower;
    }
    startAdvertising(callback) {
        let self = this;
        if (bleno.state === 'poweredOn') {
            bleno.on('advertisingStart', callback);
            bleno.on('advertisingStartError', callback);
            bleno.startAdvertisingIBeacon(this.uuid, this.major, this.minor, this.measuredPower, callback);
        } else {
            bleno.once('stateChange', state => {
                self.startAdvertising(callback);
            });
        }
    }
    stopAdvertising(callback) {
        bleno.stopAdvertising(callback);
    }
}