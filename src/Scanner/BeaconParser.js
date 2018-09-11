module.exports = class BeaconParser {
    constructor(peripheral = null) {
        if (new.target === BeaconParser) {
            throw new TypeError('Cannot construct BeaconParser instances directly.');
        }
        this.peripheral = peripheral;
    }
    parse(peripheral = null) {
        if (peripheral) {
            this.peripheral = peripheral;
        }
        this.advertisement = this.peripheral.advertisement;
        this.manufacturer = this.advertisement.manufacturerData;
    }
}