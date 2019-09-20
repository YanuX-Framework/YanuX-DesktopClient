const _ = require('lodash');
const noble = require('@abandonware/noble');
const EventEmitter = require('events');
const BeaconDetector = require('./BeaconDetector');
const BeaconMatcher = require('./BeaconMatcher');
const Beacon = require('./Beacon');

module.exports = class BeaconScanner extends EventEmitter {
    constructor(beaconScanRealtimeUpdates, refreshInterval, inactivityTimer) {
        super();
        this.beaconsCreated = {};
        this.beaconsUpdated = {};
        this._beaconDetector = new BeaconDetector();
        this._beaconScanRealtimeUpdates = beaconScanRealtimeUpdates;
        this._refreshInterval = refreshInterval;
        this._inactivityTimer = inactivityTimer;
        this.clearExpiredBeaconsPolling = null;
        this._defaultMatcher = new BeaconMatcher();
        this.matchers = [this._defaultMatcher];
        /*
         * TODO: 
         * Perhaps I should add separate configuration variable only for the masurements inactivity timer!
         * Moreover, I'm not so sure that building this stuff into the Beacon class is the best idea ever.
         * The class is also used for other things that don't require that added complexity.
         * However, the way it is implemented now I don't think that the basic purposes are being hurt that much.
         */
        Beacon.measurementsInactivityTimer = this._inactivityTimer;
    }
    startScanning(callback) {
        const _startScanning = () => {
            noble.startScanning([], true, callback);
            this.clearExpiredBeaconsPolling = setInterval(() => {
                let currentTime = new Date().getTime();
                const clearExpiredBeacons = beaconsCollection => beacon => {
                    if (currentTime - beacon.timestamp > this._inactivityTimer) {
                        beaconsCollection[beacon.key].addMeasurement(beacon);
                        this.emit('beaconRemoved', beaconsCollection[beacon.key]);
                        return true;
                    } else {
                        return false;
                    }
                };

                this.beaconsCreated = _.omitBy(this.beaconsCreated, clearExpiredBeacons(this.beaconsCreated));
                this.beaconsUpdated = _.omitBy(this.beaconsUpdated, clearExpiredBeacons(this.beaconsUpdated));
                this.emit('beaconsCleared', _.assign({}, this.beaconsCreated, this.beaconsUpdated));
                /*
                 * NOTE:
                 * This is just a stopgap the approach I'm using to avoid being TOO sensitive.
                 * Beacons were just accidentally being removed from the beacon scanner.
                 * Moreover, contacting the YanuX Broker whenever a new beacon packet is detected should provide better latency.
                 * However, such an approach was also very resource intensive.
                 * Both approaches pros and cons and I'm still not sure which one I'll end up sticking with.
                 * I'll probably have to mix both up to find a good compromise.
                 * I'll need real time updates to determine distance from signal strength.
                 * Such measurements will be needed for determining a running average and to feed a regression algorithm.  
                 * Instead of doing it on the server side I may end up doing it on the client-side to share the load.
                 */
                if (!this._beaconScanRealtimeUpdates) {
                    Object.values(this.beaconsCreated).forEach(beacon => this.emit('beaconCreated', beacon));
                    Object.values(this.beaconsUpdated).forEach(beacon => this.emit('beaconUpdated', beacon));
                    this.emit('beaconsUpdated', _.assign({}, this.beaconsCreated, this.beaconsUpdated));
                }
            }, this._refreshInterval);
        }
        if (noble.state === 'poweredOn') {
            _startScanning();
        }
        noble.on('stateChange', state => {
            if (state === 'poweredOn') {
                _startScanning();
            }
        });
        noble.on('discover', peripheral => {
            this._beaconDetector.peripheral = peripheral;
            const beacon = this._beaconDetector.beacon;
            this.matchers.forEach(matcher => {
                if (matcher.match(beacon)) {
                    if (beacon.key in this.beaconsCreated || beacon.key in this.beaconsUpdated) {
                        if (beacon.key in this.beaconsCreated) {
                            this.beaconsUpdated[beacon.key] = this.beaconsCreated[beacon.key];
                            delete this.beaconsCreated[beacon.key];
                        }
                        this.beaconsUpdated[beacon.key].addMeasurement(beacon);
                        if (this._beaconScanRealtimeUpdates) {
                            this.emit('beaconUpdated', this.beaconsUpdated[beacon.key]);
                        }
                    } else {
                        this.beaconsCreated[beacon.key] = beacon;
                        this.beaconsCreated[beacon.key].addMeasurement(beacon);
                        if (this._beaconScanRealtimeUpdates) {
                            this.emit('beaconCreated', this.beaconsCreated[beacon.key])
                        }
                    }
                    if (this._beaconScanRealtimeUpdates) {
                        this.emit('beaconsUpdated', _.assign({}, this.beaconsCreated, this.beaconsUpdated));
                    }
                }
            });
        });
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