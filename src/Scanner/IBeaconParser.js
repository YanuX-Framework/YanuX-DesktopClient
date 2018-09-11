const BeaconParser = require('./BeaconParser')
const InvalidBeaconFormat = require('./InvalidBeaconFormat');
const IBeacon = require('./IBeacon')

module.exports = class IBeaconParser extends BeaconParser {
    constructor(peripheral = null) {
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
        if (this.manufacturer &&
            this.manufacturer.length >= 4 &&
            this.manufacturer.readUInt32BE(0) === 0x4c000215) {
            let uuid = [
                this.manufacturer.slice(4, 8).toString('hex'),
                this.manufacturer.slice(8, 10).toString('hex'),
                this.manufacturer.slice(10, 12).toString('hex'),
                this.manufacturer.slice(12, 14).toString('hex'),
                this.manufacturer.slice(14, 20).toString('hex')
            ].join('-').toUpperCase();
            return new IBeacon(
                this.peripheral.id,
                uuid,
                this.manufacturer.slice(20, 22).readUInt16BE(0),
                this.manufacturer.slice(22, 24).readUInt16BE(0),
                this.manufacturer.slice(24, 25).readInt8(0),
                this.peripheral.rssi,
                new Date().getTime()
            );
        } else {
            throw new InvalidBeaconFormat('The provided peripheral is not an iBeacon.');
        }
    }
}