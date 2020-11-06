const wifi = require('node-wifi');

module.exports = class WifiScanner {
    constructor(refreshInterval, iface = null) {
        this.refreshInterval = refreshInterval;
        this.iface = iface;
        this._scanningTimeout = null;
        wifi.init({ iface: this.iface });
    }
    get refreshInterval() {
        return this._refreshInterval;
    }
    set refreshInterval(refreshInterval) {
        this._refreshInterval = refreshInterval;
    }
    get iface() {
        return this._iface;
    }
    set iface(iface) {
        this._iface = iface;
    }
    startScanning(callback, error = null) {
        const scan = () => {
            wifi.scan().then(networks => {
                callback(networks);
                this._scanningTimeout = setTimeout(scan, this.refreshInterval);
            }).catch(error ? error : e => console.error('Error during Wi-Fi Scan:', e));
        }
        scan();
    }
    stopScanning() { clearInterval(this._scanningTimeout); }
}