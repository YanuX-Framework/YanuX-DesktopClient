const fs = require('fs');
const _ = require('lodash');
const Config = require('./Config');
const BeaconScanner = require('./Scanner/BeaconScanner');
const BeaconMatcher = require('./Scanner/BeaconMatcher');

module.exports = class BeaconLogger {
    constructor(config, logFile) {
        this.config = config;
        this.logFile = logFile;
        this.log = {
            creationTimestamp: new Date().getTime(),
            name: logFile,
            sessions: { entries: [] }
        };
        this.loggingDuration = null;
        this.loggingStartTime = null;
        this.entryCounter = 0;
        this.beaconScan = config.beacon_scan || Config.DEFAULT_BEACON_SCAN;
        this.beaconMatcherParameters = config.beacon_matcher_parameters || Config.DEFAULT_BEACON_MATCHER_PARAMETERS;
        this.beaconsPrintUpdated = config.beacons_print_updated || Config.DEFAULT_BEACONS_PRINT_UPDATED;
        this.beaconsPrintCleared = config.beacons_print_cleared || Config.DEFAULT_BEACONS_CLEAR_CONSOLE;
        this.beaconsClearConsole = config.beacons_clear_console || Config.DEFAULT_BEACONS_CLEAR_CONSOLE;
        this.beaconsRefreshInterval = config.beacons_refresh_interval || Config.DEFAULT_BEACONS_REFRESH_INTERVAL;
        this.beaconsInactivityTimer = config.beacons_inactivity_timer || Config.DEFAULT_BEACONS_INACTIVITY_TIMER;
        if (this.beaconScan && _.isArray(this.beaconMatcherParameters)) {
            this.beaconScanner = new BeaconScanner(this.beaconsRefreshInterval, this.beaconsInactivityTimer);
            this.beaconMatcherParameters = this.beaconMatcherParameters.slice(0);
            this.beaconMatcherParameters.unshift(null);
            this.beaconScanner.addMatcher(new (Function.prototype.bind.apply(BeaconMatcher, this.beaconMatcherParameters)));
            this.beaconScanner.on('beaconsUpdated', beacons => {
                if (this.beaconsPrintUpdated) {
                    this.printBeacons('beaconsUpdated', this.beaconsClearConsole)(beacons);
                }
                for(let key in beacons) {
                    this.log.sessions.entries.push({
                        id: this.entryCounter++,
                        beacon: beacons[key]
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
    start(loggingDuration) {
        if (this.beaconScanner) {
            this.beaconScanner.startScanning(this.errorCallback);
            this.loggingDuration = loggingDuration;
            this.loggingStartTime = new Date().getTime();
            console.log('Logging surrounding BLE Beacons for a total of', this.loggingDuration, 'ms');
        }
    }
    stop() {
        if (this.beaconScanner) {
            this.beaconScanner.stopScanning(this.errorCallback);
            this.loggingStartTime = null;
            this.entryCounter = 0;
            fs.writeFile(this.logFile, JSON.stringify(this.log), e => {
                if(e) {
                    console.error('Could not save the log to disk.')
                } else {
                    console.log('Saved the log to disk.');
                }
            });
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
