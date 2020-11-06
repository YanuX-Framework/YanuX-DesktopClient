const dnssd = require('dnssd');

module.exports = class Zeroconf {
    constructor(config, brokerConnection) {
        this.config = config;
        this.brokerConnection = brokerConnection;
        this.browser = dnssd.Browser(dnssd.tcp('http'))
            .on('serviceUp', service => {
                console.log("Device up: ", service)
                const url = service.txt.protocol + '://' + service.host + ':' + service.port + '/';
                switch (service.name) {
                    case 'YanuX-Auth':
                        this._oauth2_authorization_server_url = url;
                        break;
                    case 'YanuX-Broker':
                        this._broker_url = url;
                        break;
                    default:
                        break;
                }
                if (this.config.allow_zeroconf === true &&
                    this._broker_url &&
                    this._oauth2_authorization_server_url) {
                    this.config.broker_url = this._broker_url;
                    this.config.oauth2_authorization_server_url = this._oauth2_authorization_server_url;
                    this.config.save(err => {
                        if (err) { throw err; }
                        else {
                            this.stopDiscovery();
                            brokerConnection.connect();
                        }
                    });
                }
            })
    }
    startDiscovery() {
        this.browser.start();
    }
    stopDiscovery() {
        this.browser.stop();
    }
    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    get brokerConnection() {
        return this._brokerConnection;
    }
    set brokerConnection(brokerConnection) {
        this._brokerConnection = brokerConnection;
    }
}
