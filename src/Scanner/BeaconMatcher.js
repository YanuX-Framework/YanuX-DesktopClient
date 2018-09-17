const _ = require('lodash');
const Beacon = require('./Beacon');

module.exports = class BeaconMatcher extends Beacon {
    constructor(
        id = null,
        type = null,
        values = [],
        txPower = null,
        rssi = null,
        timestamp = null) {
        super(id, type, values, txPower, rssi, timestamp);
    }
    match(beacon) {
        if ((_.isNil(this.id) || _.isEqual(this.id, beacon.id))
            && (_.isNil(this.type) || _.isEqual(this.type, beacon.type))
            && (_.isNil(this.values)
                || _.isEqual(this.values, this.values.map((value, index) => value === null ? null : beacon.values[index]))
                || _.isEmpty(this.values))
            && (_.isNil(this.txPower) || _.isEqual(this.txPower, beacon.txPower))
            && (_.isNil(this.rssi) || _.isEqual(this.txPower, beacon.rssi))
            && (_.isNil(this.timestamp) || _.isEqual(this.timestamp, beacon.timestamp))) {
            return true;
        } else {
            return false;
        }
    }
}