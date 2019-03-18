const _ = require('lodash');
const Config = require('./Config');
const IBeaconAdvertiser = require('./Advertiser/IBeaconAdvertiser');
const BeaconScanner = require('./Scanner/BeaconScanner');
const BeaconMatcher = require('./Scanner/BeaconMatcher');

module.exports = class BeaconsBLE {
    constructor(config) {
        this.config = config;
        this.beaconScan = config.beacon_scan || Config.DEFAULT_BEACON_SCAN,
            this.beaconAdvertise = config.beacon_advertise || Config.DEFAULT_BEACON_ADVERTISE,
            this.beaconAdvertiserParameters = config.beacon_advertiser_parameters || Config.DEFAULT_BEACON_ADVERTISER_PARAMETERS,
            this.beaconMatcherParameters = config.beacon_matcher_parameters || Config.DEFAULT_BEACON_MATCHER_PARAMETERS,
            this.beaconsPrintUpdated = config.beacons_print_updated || Config.DEFAULT_BEACONS_PRINT_UPDATED,
            this.beaconsPrintCleared = config.beacons_print_cleared || Config.DEFAULT_BEACONS_CLEAR_CONSOLE,
            this.beaconsClearConsole = config.beacons_clear_console || Config.DEFAULT_BEACONS_CLEAR_CONSOLE,
            this.beaconsRefreshInterval = config.beacons_refresh_interval || Config.DEFAULT_BEACONS_REFRESH_INTERVAL,
            this.beaconsInactivityTimer = config.beacons_inactivity_timer || Config.DEFAULT_BEACONS_INACTIVITY_TIMER
        if (this.beaconAdvertise && _.isArray(this.beaconAdvertiserParameters) && this.beaconAdvertiserParameters.length === 3) {
            this.beaconAdvertiserParameters = this.beaconAdvertiserParameters.slice(0)
            this.beaconAdvertiserParameters.unshift(null);
            this.iBeaconAdvertiser = new (Function.prototype.bind.apply(IBeaconAdvertiser, this.beaconAdvertiserParameters));
        }
        if (this.beaconScan && _.isArray(this.beaconMatcherParameters)) {
            this.beaconScanner = new BeaconScanner(this.beaconsRefreshInterval, this.beaconsInactivityTimer);
            this.beaconMatcherParameters = this.beaconMatcherParameters.slice(0);
            this.beaconMatcherParameters.unshift(null);
            this.beaconScanner.addMatcher(new (Function.prototype.bind.apply(BeaconMatcher, this.beaconMatcherParameters)));
            if (this.beaconsPrintUpdated) {
                this.beaconScanner.on('beaconsUpdated', this.printBeacons('beaconsUpdated', this.beaconsClearConsole));
            }
            if (this.beaconsPrintCleared) {
                this.beaconScanner.on('beaconsCleared', this.printBeacons('beaconsCleared', this.beaconsClearConsole));
            }
        }
    }
    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    start() {
        if (this.iBeaconAdvertiser) {
            this.iBeaconAdvertiser.startAdvertising(this.errorCallback);
        }
        if (this.beaconScanner) {
            this.beaconScanner.startScanning(this.errorCallback);
        }
    }
    stop() {
        if (this.iBeaconAdvertiser) {
            this.iBeaconAdvertiser.stopAdvertising(this.errorCallback);
        }
        if (this.beaconScanner) {
            this.beaconScanner.stopScanning(this.errorCallback);
        }
    }
    printBeacons(title = null, clear = false) {
        return function (beacons) {
            clear === true ? thos.clearConsole() : console.log('------------------------------------');
            if (title) {
                console.log('------------ ' + title + ' ------------');
            }
            for (key in beacons) {
                console.log(beacons[key]);
            }
        }
    }
    clearConsole() {
        return process.stdout.write('\x1B[2J\x1B[0f');;
    }
    errorCallback(error) {
        if (error) {
            console.error('Error:', error);
        }
    }
}
