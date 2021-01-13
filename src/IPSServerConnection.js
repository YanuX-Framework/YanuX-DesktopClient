const { writeFileSync } = require('fs');
const fetch = require('node-fetch');
const BeaconsBLE = require('./BeaconsBLE');
const WifiScanner = require('./Scanner/WifiScanner');

module.exports = class IPSServerConnection {
    constructor(config, user) {
        this.config = config;
        this.user = user;
        this.beaconsBLE = this.config.ips_server_url ? new BeaconsBLE(this.config) : null;
        this.wifiScanner = this.config.wifi_scan && this.config.ips_server_url ?
            new WifiScanner(this.config.wifi_refresh_interval || this.config.beacons_refresh_interval) : null;
        this.currentBeacons = {};
        this.currentNetworks = [];
        this.timeBetweenUpdates = Math.min(this.config.wifi_refresh_interval, this.config.beacons_refresh_interval);
        this.lastUpdateTime = null;
        this._updateInterval = null;
    }

    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    get user() {
        return this._user;
    }
    set user(user) {
        this._user = user;
    }
    get beaconsBLE() {
        return this._beaconsBLE;
    }
    set beaconsBLE(beaconsBLE) {
        this._beaconsBLE = beaconsBLE;
    }
    get wifiScanner() {
        return this._wifiScanner;
    }
    set wifiScanner(wifiScanner) {
        this._wifiScanner = wifiScanner;
    }
    get currentBeacons() {
        return this._currentBeacons;
    }
    set currentBeacons(currentBeacons) {
        this._currentBeacons = currentBeacons;
    }
    get currentNetworks() {
        return this._currentNetworks;
    }
    set currentNetworks(currentNetworks) {
        this._currentNetworks = currentNetworks;
    }
    set timeBetweenUpdates(timeBetweenUpdates) {
        this._timeBetweenUpdates = timeBetweenUpdates;
    }
    get timeBetweenUpdates() {
        return this._timeBetweenUpdates;
    }
    get lastUpdateTime() {
        return this._lastUpdateTime;
    }
    set lastUpdateTime(lastUpdateTime) {
        this._lastUpdateTime = lastUpdateTime;
    }


    init() {
        if (this.beaconsBLE) {
            this.beaconsBLE.beaconScanner.on('beaconsUpdated', beacons => {
                this.currentBeacons = beacons;
                this.updateServer();
            });

            this.beaconsBLE.beaconScanner.on('beaconsCleared', beacons => {
                this.currentBeacons = beacons;
                this.updateServer();
            });

            this.beaconsBLE.start();
        }

        if (this.wifiScanner) {
            this.wifiScanner.startScanning(networks => {
                this.currentNetworks = networks;
                this.updateServer();
            });
        }

        if (this.beaconsBLE || this.wifiScanner) {
            this._updateInterval = setInterval(() => this.updateServer(), this.timeBetweenUpdates)
        }
    }

    updateServer() {
        const currentTime = new Date();
        if (currentTime - this.lastUpdateTime >= this.timeBetweenUpdates) {
            this.lastUpdateTime = currentTime;
            clearInterval(this._updateInterval);
            const scanningUpdate = {
                username: this.user.email,
                uuid: this.config.device_uuid,
                mAccessPoints: this.currentNetworks.map(network => ({
                    isChecked: false,
                    name: network.bssid.toLowerCase(),
                    singleValue: network.signal_level
                })),
                mBeaconsList: Object.values(this.currentBeacons).map(beacon => ({
                    mac: beacon.address.toUpperCase(),
                    name: beacon.values.join('-').toLowerCase(),
                    singleValue: beacon.rssi,
                    values: beacon.measurements.map(m => m.rssi)
                })),
                mSensorInformationList: [{
                    name: 'ORIENTATION',
                    x_value: (this.config.orientation > 180 ? -360 + this.config.orientation : this.config.orientation) * (Math.PI / 180),
                    //x_value: this.config.orientation * (Math.PI / 180),
                    y_value: 0, z_value: 0
                }]
            };
            fetch(this.config.ips_server_url + 'scanning/', {
                method: 'post',
                body: JSON.stringify(scanningUpdate),
                headers: { 'Content-Type': 'application/json' },
            }).then(res => {
                console.log(`Updated IPS Server [${this.lastUpdateTime}]:`, scanningUpdate, '\nStatus:', res.status);
                this._updateInterval = setInterval(() => this.updateServer(), this.timeBetweenUpdates)
            }).catch(e => {
                console.log(`Error Updating IPS Server [${this.lastUpdateTime}]:`, e);
                this._updateInterval = setInterval(() => this.updateServer(), this.timeBetweenUpdates)
            });
        }
    }
}