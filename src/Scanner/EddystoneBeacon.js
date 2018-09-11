const Beacon = require('./Beacon');

module.exports.EddystoneUid = class EddystoneUid extends Beacon {
    constructor(id, namespace, instance, txPower, rssi, timestamp) {
        super(id, 'Eddystone-UID', [namespace, instance], txPower, rssi, timestamp);
    }

    get namespace() {
        return this.values[0];
    }

    get instance() {
        return this.values[1];
    }
}

module.exports.EddystoneUrl = class EddystoneUrl extends Beacon {
    constructor(id, url, txPower, rssi, timestamp) {
        super(id, 'Eddystone-URL', [url], txPower, rssi, timestamp);
    }

    get url() {
        return this.values[0];
    }
}

module.exports.EddystoneTlm = class EddystoneTlm extends Beacon {
    constructor(id, batteryVoltage, temperature, advCnt, secCnt, rssi, timestamp) {
        super(id, 'Eddystone-TLM', [batteryVoltage, temperature, advCnt, secCnt], null, rssi, timestamp);
    }

    get batteryVoltage() {
        return this.values[0];
    }

    get temperature() {
        return this.values[1];
    }

    get advCnt() {
        return this.values[2];
    }

    get secCnt() {
        return this.values[3];
    }
}


module.exports.EddystoneEid = class EddystoneEid extends Beacon {
    constructor(id, eid, txPower, rssi, timestamp) {
        super(id, 'Eddystone-EID', [eid], txPower, rssi, timestamp);
    }

    get eid() {
        return this.values[0];
    }
}