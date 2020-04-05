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
        try {
            if (bleno.state === 'poweredOn') {
                bleno.on('advertisingStart', callback);
                bleno.on('advertisingStartError', callback);
                bleno.startAdvertisingIBeacon(this.uuid, this.major, this.minor, this.measuredPower, callback);
            } else {
                bleno.once('stateChange', state => {
                    if (state === 'poweredOn') {
                        self.startAdvertising(callback);
                    }
                });
            }
        } catch (e) {
            if (e.message === 'LIBUSB_ERROR_NOT_SUPPORTED') {
                console.error('WARNING: You device does not support libusb. The program will continue to execute but without performing iBeacon Advertisement:', e);
            } else { throw e; }
        }
    }
    stopAdvertising(callback) {
        bleno.stopAdvertising(callback);
    }
}