const fs = require('fs');
const _ = require('lodash');
const JSONStream = require('JSONStream');
const Config = require('./Config');
const BeaconScanner = require('./Scanner/BeaconScanner');
const BeaconMatcher = require('./Scanner/BeaconMatcher');

module.exports = class BeaconLogger {
    constructor(config) {
        this.config = config;
        this.logging = false;
        this.loggingDuration = null;
        this.entryCounter = null;
        this.loggingStartTime = null;
        this.writeStream = null;
        this.jsonStream = null;

        this.beaconScan = config.beacon_scan || Config.DEFAULT_BEACON_SCAN;
        this.beaconScanRealtimeUpdates = config.beacon_scan_realtime_updates || Config.DEFAULT_BEACON_SCAN_REALTIME_UPDATES;
        this.beaconMatcherParameters = config.beacon_matcher_parameters || Config.DEFAULT_BEACON_MATCHER_PARAMETERS;
        this.beaconsPrintUpdated = config.beacons_print_updated || Config.DEFAULT_BEACONS_PRINT_UPDATED;
        this.beaconsPrintCleared = config.beacons_print_cleared || Config.DEFAULT_BEACONS_CLEAR_CONSOLE;
        this.beaconsClearConsole = config.beacons_clear_console || Config.DEFAULT_BEACONS_CLEAR_CONSOLE;
        this.beaconsRefreshInterval = config.beacons_refresh_interval || Config.DEFAULT_BEACONS_REFRESH_INTERVAL;
        this.beaconsInactivityTimer = config.beacons_inactivity_timer || Config.DEFAULT_BEACONS_INACTIVITY_TIMER;
        if (this.beaconScan && _.isArray(this.beaconMatcherParameters)) {
            this.beaconScanner = new BeaconScanner(this.beaconScanRealtimeUpdates, this.beaconsRefreshInterval, this.beaconsInactivityTimer);
            this.beaconMatcherParameters = this.beaconMatcherParameters.slice(0);
            this.beaconMatcherParameters.unshift(null);
            this.beaconScanner.addMatcher(new (Function.prototype.bind.apply(BeaconMatcher, this.beaconMatcherParameters)));
            this.beaconScanner.on('beaconsUpdated', beacons => {
                if (this.beaconsPrintUpdated) {
                    this.printBeacons('beaconsUpdated', this.beaconsClearConsole)(beacons);
                }
                for (let key in beacons) {
                    this.jsonStream.write({
                        id: this.entryCounter++,
                        reading: beacons[key]
                    });
                }
                if (new Date().getTime() > this.loggingStartTime + this.loggingDuration) {
                    this.stop();
                }
            });
            this.beaconScanner.on('beaconsCleared', beacons => {
                if (this.beaconsPrintCleared) {
                    this.printBeacons('beaconsCleared', this.beaconsClearConsole)(beacons)
                }
            });
        }
    }
    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    start(logFile, loggingDuration) {
        if (this.beaconScanner) {
            this.logFile = logFile;
            this.loggingDuration = loggingDuration;
            this.entryCounter = 0;
            this.writeStream = fs.createWriteStream(this.logFile);
            this.jsonStream = JSONStream
                .stringify(`{"creationTimestamp":${new Date().getTime()},"name":"${this.logFile}","sessions":{"entries":[`, ',', `]}}`)
            this.jsonStream.pipe(this.writeStream);
            this.beaconScanner.startScanning(e => {
                if (e) { errorCallback(e); }
                else {
                    this.logging = true;
                    this.loggingStartTime = new Date().getTime();
                    console.log('Logging surrounding BLE Beacons for a total of', this.loggingDuration, 'ms');
                }
            });
        }
    }
    stop() {
        if (this.beaconScanner) {
            if (this.logging) {
                this.logging = false;
                this.beaconScanner.stopScanning(e => {
                    if (e) { errorCallback(e); }
                    else {
                        this.loggingStartTime = null;
                        this.entryCounter = 0;
                        this.jsonStream.end();
                        this.writeStream.end();
                        console.log('Saved the log to disk.');
                    }
                });
            }
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
