const BeaconParser = require('./BeaconParser')
const EddystoneBeacon = require('./EddystoneBeacon');
const InvalidBeaconFormat = require('./InvalidBeaconFormat');

const EDDYSTONE_SERVICE_UUID = 'feaa';
module.exports.EDDYSTONE_SERVICE_UUID = EDDYSTONE_SERVICE_UUID;
const EDDYSTONE_URL_SCHEME_PREFIXES = {
    '00': 'http://www.',
    '01': 'https://www.',
    '02': 'http://',
    '03': 'https://'
};
const EDDYSTONE_URL_ENCODINGS = {
    '00': '.com/',
    '01': '.org/',
    '02': '.edu/',
    '03': '.net/',
    '04': '.info/',
    '05': '.biz/',
    '06': '.gov/',
    '07': '.com',
    '08': '.org',
    '09': '.edu',
    '0a': '.net',
    '0b': '.info',
    '0c': '.biz',
    '0d': '.gov'
};

class EddystoneParser extends BeaconParser {
    constructor(peripheral = null) {
        if (new.target === EddystoneParser) {
            throw new TypeError('Cannot construct EddystoneParser instances directly.');
        }
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
    }
    _getEddystoneServiceData() {
        let eddystone_service = this.advertisement.serviceData.find((el) => {
            return el.uuid === EDDYSTONE_SERVICE_UUID;
        });
        if (!eddystone_service) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone beacon.');
        }
        let data = eddystone_service.data || null;
        return data;
    };
}

module.exports.EddystoneUidParser = class EddystoneUidParser extends EddystoneParser {
    constructor(peripheral = null) {
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
        let data = this._getEddystoneServiceData(this.peripheral);
        if (!data) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone-UID beacon.');
        }
        if (data.length !== 20 && data.length !== 18) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone-UID beacon.');
        }
        // Eddystone-UID
        // https://github.com/google/eddystone/tree/master/eddystone-uid
        return new EddystoneBeacon.EddystoneUid(
            this.peripheral.address,
            data.slice(2, 12).toString('hex').toUpperCase(),
            data.slice(12, 18).toString('hex').toUpperCase(),
            data.readInt8(1),
            this.peripheral.rssi,
            new Date().getTime()
        );
    }
}

module.exports.EddystoneUrlParser = class EddystoneUrlParser extends EddystoneParser {
    constructor(peripheral = null) {
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
        let data = this._getEddystoneServiceData(this.peripheral);
        if (!data) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone-URL beacon.');
        }
        // Eddystone-URL
        // https://github.com/google/eddystone/tree/master/eddystone-url
        if (data.length < 4) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone-URL beacon.');
        }
        let url = EDDYSTONE_URL_SCHEME_PREFIXES[data.slice(2, 3).toString('hex')];
        if (!url) {
            throw new InvalidBeaconFormat('The provided peripheral is not an Eddystone-URL beacon.');
        }
        let encoded_url_buf = data.slice(3);
        for (let i = 0, len = encoded_url_buf.length; i < len; i++) {
            let b = encoded_url_buf.slice(i, i + 1);
            let h = b.toString('hex');
            if (EDDYSTONE_URL_ENCODINGS[h]) {
                url += EDDYSTONE_URL_ENCODINGS[h];
            } else {
                url += b.toString();
            }
        }
        return new EddystoneBeacon.EddystoneUrl(
            this.peripheral.address,
            url,
            data.readInt8(1),
            this.peripheral.rssi,
            new Date().getTime()
        )
    }
}


module.exports.EddystoneTlmParser = class EddystoneTlmParser extends EddystoneParser {
    constructor(peripheral = null) {
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
        if (!data) {
            return null;
        }
        // Eddystone-TLM
        // https://github.com/google/eddystone/blob/master/eddystone-tlm/tlm-plain.md
        if (data.length !== 14) {
            return null;
        }
        let version = data.readUInt8(1);
        if (version !== 0x00) {
            return null;
        }
        return new EddystoneBeacon.EddystoneTlm(
            this.peripheral.address,
            data.readUInt16BE(2),
            data.readInt16BE(4) / 256,
            data.readUInt32BE(6),
            data.readUInt32BE(10),
            this.peripheral.rssi,
            new Date().getTime()
        );
    }
}

module.exports.EddystoneEidParser = class EddystoneEidParser extends EddystoneParser {
    constructor(peripheral = null) {
        super(peripheral);
    }
    parse(peripheral = null) {
        super.parse(peripheral);
        let data = this._getEddystoneServiceData(this.peripheral);
        if (!data) {
            return null;
        }
        if (data.length !== 10) {
            return null;
        }
        // Eddystone-EID
        // https://github.com/google/eddystone/tree/master/eddystone-eid
        return new EddystoneBeacon.EddystoneEid(
            this.peripheral.id,
            this.peripheral.address,
            data.slice(2, 10).toString('hex'),
            data.readInt8(1),
            this.peripheral.rssi,
            new Date().getTime()
        )
    }
}