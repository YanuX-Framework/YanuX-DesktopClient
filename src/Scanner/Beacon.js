module.exports = class Beacon {
    constructor(id, type, values, txPower, rssi, timestamp = new Date().getTime()) {
        this.id = id;
        this.type = type;
        this.values = values;
        this.txPower = txPower;
        this.rssi = rssi;
        this.timestamp = timestamp;
    }
    get key() {
        return `${this.id}-${this.type}-${this.values.join('-')}`;
    }
}