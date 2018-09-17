const _ = require('lodash');
const noble = require('noble');
const EventEmitter = require('events');
const BeaconDetector = require('./BeaconDetector');
const BeaconMatcher = require('./BeaconMatcher');

module.exports = class BeaconScanner extends EventEmitter {
    constructor(refreshInterval, inactivityTimer) {
        super();
        this.beacons = {};
        this._beaconDetector = new BeaconDetector();
        this._refreshInterval = refreshInterval;
        this._inactivityTimer = inactivityTimer;
        this.clearExpiredBeaconsPolling = null;
        this._defaultMatcher = new BeaconMatcher();
        this.matchers = [this._defaultMatcher];
    }
    startScanning(callback) {
        noble.on('stateChange', state => {
            if (state === 'poweredOn') {
                noble.startScanning([], true, callback);
                this.clearExpiredBeaconsPolling = setInterval(() => {
                    let currentTime = new Date().getTime();
                    this.beacons = _.omitBy(this.beacons, beacon => {
                        if (currentTime - beacon.timestamp > this._inactivityTimer) {
                            this.emit('beaconRemoved', beacon);
                            return true;
                        } else {
                            return false;
                        }
                    });
                    this.emit('beaconsCleared', this.beacons);
                }, this._refreshInterval);
            }
        });
        noble.on('discover', peripheral => {
            this._beaconDetector.peripheral = peripheral;
            const beacon = this._beaconDetector.beacon;
            this.matchers.forEach(matcher => {
                if (matcher.match(beacon)) {
                    if (beacon.key in this.beacons) {
                        this.beacons[beacon.key] = beacon;
                        this.emit('beaconUpdated', beacon, peripheral);
                    } else {
                        this.beacons[beacon.key] = beacon;
                        this.emit('beaconCreated', beacon, peripheral);
                    }
                }
            })
            this.emit('beaconsUpdated', this.beacons);
        })
    }
    stopScanning(callback) {
        clearInterval(this.clearExpiredBeaconsPolling);
        noble.stopScanning(callback);
    }
    addMatcher(matcher) {
        this.removeMatcher(this._defaultMatcher);
        this.matchers.push(matcher);
    }
    removeMatcher(matcher) {
        this.matchers = this.matchers.filter(currMatcher => {
            currMatcher !== matcher;
        })
    }
}