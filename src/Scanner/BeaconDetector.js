const Beacon = require('./Beacon')
const IBeaconParser = require('./IBeaconParser');
const Eddystone = require('./EddystoneParser');

module.exports = class BeaconDetector {
    constructor(peripheral = null) {
        this.peripheral = peripheral;
        this.ibeaconParser = new IBeaconParser();
        this.eddystoneUidParser = new Eddystone.EddystoneUidParser();
        this.eddystoneUrlParser = new Eddystone.EddystoneUrlParser();
        this.eddystoneEidParser = new Eddystone.EddystoneEidParser();
        this.eddystoneTlmParser = new Eddystone.EddystoneTlmParser();
    }

    get peripheral() {
        return this._peripheral;
    }

    set peripheral(peripheral) {
        this._peripheral = peripheral;
        this._type = null;
        this._cached_type = false;
        this._beacon = null;
        this._beacon_type = false;
    }

    get type() {
        if (!this._cached_type) {
            let advertisement = this.peripheral.advertisement;
            let manudacturer = advertisement.manufacturerData;
            // iBeacon
            if (manudacturer &&
                manudacturer.length >= 4 &&
                manudacturer.readUInt32BE(0) === 0x4c000215) {
                this._type = 'iBeacon';
                this._cached_type = true;
                return this._type;
            }
            // Eddystone
            let eddystone_service = advertisement.serviceData.find((el) => {
                return el.uuid === Eddystone.EDDYSTONE_SERVICE_UUID;
            });
            if (eddystone_service && eddystone_service.data) {
                // https://github.com/google/eddystone/blob/master/protocol-specification.md
                let frame_type = eddystone_service.data.readUInt8(0) >>> 4;
                if (frame_type === 0b0000) {
                    this._type = 'Eddystone-UID';
                } else if (frame_type === 0b0001) {
                    this._type = 'Eddystone-URL';
                } else if (frame_type === 0b0010) {
                    this._type = 'Eddystone-TLM';
                } else if (frame_type === 0b0011) {
                    this._type = 'Eddystone-EID';
                }
                this._cached_type = true;
                return this._type;
            } else {
                // Unknown/Not a beacon
                this._type = null;
                this._cached_type = true;
                return this._type;
            }
        }
        return this._type;
    }

    get beacon() {
        if (!this._cached_beacon) {
            switch (this.type) {
                case 'iBeacon':
                    this._beacon = this.ibeaconParser.parse(this.peripheral);
                    break;
                case 'Eddystone-UID':
                    this._beacon = this.eddystoneUidParser.parse(this.peripheral);
                    break;
                case 'Eddystone-URL':
                    this._beacon = this.eddystoneUrlParser.parse(this.peripheral);
                    break;
                case 'Eddystone-EID':
                    this._beacon = this.eddystoneEidParser.parse(this.peripheral);
                    break;
                case 'Eddystone-TLM':
                    this._beacon = this.eddystoneTlmParser.parse(this.peripheral);
                    break;
                case null:
                    this._beacon = new Beacon(
                        this.peripheral.id,
                        this.peripheral.address,
                        'Unknown',
                        [this.peripheral.address],
                        null,
                        this.peripheral.rssi
                    );
                    break;
            }
        }
        return this._beacon;
    }
}