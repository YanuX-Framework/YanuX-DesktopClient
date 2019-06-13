const fs = require('fs');
const _ = require('lodash');
const uuidv1 = require('uuid/v1');

module.exports = class Config {
    constructor(path, callback) {
        const self = this;
        Object.defineProperty(this, 'path', {
            configurable: false,
            enumerable: false,
            value: path,
            writable: true
        });
        fs.readFile(path, (err, data) => {
            if (!err) { Object.assign(this, JSON.parse(data)); }
            callback(err, this);
        });
    }
    static get DEFAULT_CONFIG_PATH() { return './config.json'; }
    static get DEFAULT_STRINGIFY_SPACES() { return 4; }
    static get DEFAULT_BEACON_SCAN() { return false; }
    static get DEFAULT_BEACON_SCAN_REALTIME_UPDATES() { return false; }
    static get DEFAULT_BEACON_ADVERTISE() { return false; }
    static get DEFAULT_BEACON_MATCHER_PARAMETERS() { return null; }//[null, "iBeacon", ["113069EC-6E64-4BD3-6810-DE01B36E8A3E"]];
    static get DEFAULT_BEACON_ADVERTISER_PARAMETERS() { return null }//["113069ec6e644bd36810de01b36e8a3e", 100, 100];
    static get DEFAULT_BEACONS_PRINT_UPDATED() { return false; }
    static get DEFAULT_BEACONS_PRINT_CLEARED() { return false; }
    static get DEFAULT_BEACONS_CLEAR_CONSOLE() { return false; }
    static get DEFAULT_BEACONS_REFRESH_INTERVAL() { return 500; }
    static get DEFAULT_BEACONS_INACTIVITY_TIMER() { return 1000; }

    save(callback) {
        let writeCallback;
        if (!callback) {
            writeCallback = err => {
                if (err) { throw err; }
            }
        } else {
            writeCallback = callback;
        }
        fs.writeFile(this.path, JSON.stringify(this, null, Config.DEFAULT_STRINGIFY_SPACES), writeCallback);
    }
    validate(path) {
        if (!_.isBoolean(this.allow_zeroconf)) {
            throw new Error('"allow_zeroconf" value is either missing or invalid');
        }
        if (!_.isFinite(this.http_server_port)) {
            throw new Error('"http_server_port" value is either missing or invalid');
        }
        if (!_.isString(this.client_id)) {
            throw new Error('"client_id" value is either missing or invalid');
        }
        if (!_.isString(this.client_secret)) {
            throw new Error('"client_secret" value is either missing or invalid');
        }
        if (!_.isString(this.redirect_uri)) {
            throw new Error('"redirect_uri" value is either missing or invalid');
        }
        if (!_.isString(this.broker_url)) {
            throw new Error('"broker_url" value is either missing or invalid');
        }
        if (!_.isString(this.oauth2_authorization_server_url)) {
            throw new Error('"oauth2_authorization_server_url" value is either missing or invalid');
        }
        if (!_.isNil(this.beacon_scan) &&
            !_.isBoolean(this.beacon_scan)) {
            throw new Error('"beacon_scan" value is invalid');
        }
        if (!_.isNil(this.beacon_scan_realtime_updates) &&
            !_.isBoolean(this.beacon_scan_realtime_updates)) {
            throw new Error('"beacon_scan_realtime_updates" value is invalid');
        }
        if (!_.isNil(this.beacon_advertise) &&
            !_.isBoolean(this.beacon_advertise)) {
            throw new Error('"beacon_advertise" value is invalid');
        }
        if (!_.isNil(this.beacon_advertiser_parameters)
            && !(_.isArray(this.beacon_advertiser_parameters)
                && (this.beacon_advertiser_parameters.length === 0 ||
                    this.beacon_advertiser_parameters.length === 3))) {
            throw new Error('"beacon_advertiser_parameters" value is invalid');
        }
        if (!_.isNil(this.beacon_matcher_parameters) &&
            !_.isArray(this.beacon_matcher_parameters)) {
            throw new Error('"beacon_matcher_parameters" value is invalid');
        }
        if (!_.isNil(this.beacons_print_updated) &&
            !_.isBoolean(this.beacons_print_updated)) {
            throw new Error('"beacons_print_updated" value is invalid');
        }
        if (!_.isNil(this.beacons_print_cleared) &&
            !_.isBoolean(this.beacons_print_cleared)) {
            throw new Error('"beacons_print_cleared" value is invalid');
        }
        if (!_.isNil(this.beacons_clear_console) &&
            !_.isBoolean(this.beacons_clear_console)) {
            throw new Error('"beacons_clear_console" value is invalid');
        }
        if (!_.isNil(this.beacons_refresh_interval) &&
            !_.isFinite(this.beacons_refresh_interval) &&
            this.beacons_refresh_interval < 0) {
            throw new Error('"beacons_refresh_interval" value is invalid');
        }
        if (!_.isNil(this.beacons_inactivity_timer)
            && !_.isFinite(this.beacons_inactivity_timer)
            && this.beacons_inactivity_timer < 0) {
            throw new Error('"beacons_inactivity_timer" value is invalid');
        }
        if (_.isNil(this.access_token)) {
            //TODO: Check if a 'refresh_token' is available before requesting a new 'access_token'. Only do that if there's no 'refresh_token' available, or if it is no longer valid! 
            console.log(`Go to ${this.oauth2_authorization_server_url}oauth2/authorize?client_id=${this.client_id}&response_type=code&redirect_uri=${this.redirect_uri} and authorize the application.`);
        }
        if (_.isNil(this.device_uuid)) {
            console.log('Generating a new Device ID because this is the first time you are running the YanuX IPS Desktop Client on this device.');
            this.device_uuid = uuidv1();
            this.save();
        }
        if (!_.isObject(this.device_capabilities)) {
            throw new Error('"device_capabilities" value is either missing or invalid');
        }
    }
    deleteTokens() {
        delete this.access_token;
        delete this.refresh_token;
    }
}
