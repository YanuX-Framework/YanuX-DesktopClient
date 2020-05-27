const fs = require('fs');
const _ = require('lodash');
const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const auth = require('@feathersjs/authentication-client');
const request = require('request');
const jose = require('jose');
const fetch = require('node-fetch');

module.exports = class BrokerConnection {
    constructor(config, beaconsBLE, capabilitiesCollector) {
        this.config = config;
        this.beaconsBLE = beaconsBLE;
        this.capabilitiesCollector = capabilitiesCollector;
    }
    get config() {
        return this._config;
    }
    set config(config) {
        this._config = config;
    }
    get beaconsBLE() {
        return this._beaconsBLE;
    }
    set beaconsBLE(beaconsBLE) {
        this._beaconsBLE = beaconsBLE;
    }
    get jwtAccessToken() {
        return this._jwtAccessToken;
    }
    set jwtAccessToken(jwtAccessToken) {
        this._jwtAccessToken = jwtAccessToken;
    }
    connect() {
        this.socket = io(this.config.broker_url, {
            transports: ['websocket'],
            forceNew: true
        });
        this.client = feathers();
        this.client.configure(socketio(this.socket));
        this.client.configure(auth());

        this.usersService = this.client.service('users')
        this.devicesService = this.client.service('devices');
        this.beaconsService = this.client.service('beacons');

        if (this.capabilitiesCollector) {
            this.capabilitiesCollector.subcribe(capabilities => {
                this.devicesService.patch(null,
                    { capabilities: _.merge({}, capabilities, this.config.default_device_capabilities) },
                    { query: { deviceUuid: this.config.device_uuid } }
                ).catch(e => console.error('Could not update device capabilities:', e));
            })
        }

        this.client.io.on('connect', () => {
            this.beaconsBLE.startScanning();
            this.authenticate();
        });

        this.client.io.on('reconnect', attempt => {
            console.log(`Reconnected after ${attempt} attempts`);
            this.beaconsBLE.startScanning();
            this.authenticate();
        });

        this.client.io.on('disconnect', reason => {
            this.beaconsBLE.stopScanning();
        });

        this.client.on('reauthentication-error', err => {
            console.error('Reauthentication error:', err);
            this.jwtAccessToken = null;
            this.authenticate();
        });
    }
    authenticate() {
        let credentials;
        if (!this.jwtAccessToken) {
            credentials = {
                strategy: 'yanux',
                clientId: this.config.client_id,
                accessToken: this.config.access_token
            }
        } else {
            credentials = {
                strategy: 'jwt',
                accessToken: this.jwtAccessToken,
            }
        }
        if (credentials.accessToken) {
            this.client.authenticate(credentials)
                .then(response => {
                    const accessToken = response.accessToken;
                    console.log('Logged in successfully with the following JWT:\n' + accessToken + '\n');
                    const decodedToken = jose.JWT.decode(accessToken, { complete: true });
                    return new Promise((resolve, reject) => {
                        if (decodedToken.header && decodedToken.header.jku && decodedToken.header.jku.startsWith(this.config.broker_url)) {
                            //TODO: Perhaps I should cache the JKU URL contents and corresponding KeyStore for better performance.
                            fetch(decodedToken.header.jku).then(response => response.json()).then(json => {
                                const keys = (json.keys || []).map(k => jose.JWK.asKey(k))
                                const keyStore = new jose.JWKS.KeyStore(keys);
                                resolve(jose.JWT.verify(accessToken, keyStore));
                            }).catch(e => reject(e));
                        } else { reject(new Error('"jku" is either missing from the token header or points to a an untrusted URL')) }
                    });
                }).then(payload => {
                    console.log('Payload:', payload);
                    return this.usersService.get(payload.user._id);
                })
                .then(user => {
                    this.client.set('user', user);
                    console.log('User', this.client.get('user'));
                    process.on('SIGINT', () => {
                        this.tidyUpBeacons()
                            .then(() => {
                                this.socket.close();
                                process.exit();
                            }).catch(e => {
                                console.error(e);
                                process.exit();
                            });
                    });
                    this.tidyUpBeacons().then(() => {
                        if (this.beaconsBLE && this.beaconsBLE.beaconScanner) {
                            this.beaconsBLE.beaconScanner.beaconsCreated = {};
                            this.beaconsBLE.beaconScanner.beaconsUpdated = {};
                            this.beaconsBLE.beaconScanner.removeAllListeners();
                            this.beaconsBLE.beaconScanner.on('beaconCreated', beacon => {
                                this.beaconsService.create({
                                    user: user._id,
                                    deviceUuid: this.config.device_uuid,
                                    beaconKey: beacon.key,
                                    beacon: beacon
                                }).then(beacon => {
                                    console.log('Beacon Created:', beacon);
                                }).catch(e => this.handleError(e));
                            });
                            this.beaconsBLE.beaconScanner.on('beaconUpdated', beacon => {
                                this.beaconsService.patch(null, { beacon: beacon }, {
                                    query: {
                                        user: user._id,
                                        deviceUuid: this.config.device_uuid,
                                        beaconKey: beacon.key
                                    }
                                }).then(beacons => {
                                    console.log('Beacons Patched:', beacons);
                                }).catch(e => this.handleError(e));
                            });
                            this.beaconsBLE.beaconScanner.on('beaconRemoved', beacon => {
                                this.beaconsService.remove(null, {
                                    query: {
                                        user: user._id,
                                        deviceUuid: this.config.device_uuid,
                                        beaconKey: beacon.key
                                    }
                                }).then(beacons => {
                                    console.log('Beacons Removed:', beacons);
                                }).catch(e => this.handleError(e));
                            });
                        }
                        console.log('Device Capabilities:', this.config.device_capabilities);
                        return this.devicesService.patch(null, {
                            deviceUuid: this.config.device_uuid,
                            name: this.config.device_name,
                            beaconValues: this.config.beacon_advertiser_parameters || Config.DEFAULT_BEACON_ADVERTISER_PARAMETERS,
                            capabilities: this.config.device_capabilities
                        }, { query: { deviceUuid: this.config.device_uuid } });
                    }).then(devices => {
                        console.log('Devices:', devices);
                    }).catch(e => this.handleError(e));
                }).catch(e => this.handleError(e));
        }
    }
    tidyUpBeacons() {
        return this.beaconsService
            .remove(null, { query: { user: this.client.get('user'), deviceUuid: this.config.device_uuid } })
            .then(beacons => console.log('Removed any outstanding beacons:', beacons))
            .catch(e => this.handleError(e));
    }
    handleError(e) {
        if (e.name === 'NotAuthenticated') {
            if (e.message === 'jwt expired') {
                this.jwtAccessToken = null;
                this.authenticate();
            } else if (e.message === 'The provided access token is not valid.') {
                if (this.config.refresh_token) {
                    console.log('Trying to get a new token using the Refresh Token');
                    request.post({
                        url: this.config.oauth2_authorization_server_url + 'oauth2/token',
                        auth: {
                            user: this.config.client_id,
                            pass: this.config.client_secret,
                            sendImmediately: true
                        },
                        form: {
                            refresh_token: this.config.refresh_token,
                            grant_type: 'refresh_token',
                            redirect_uri: this.config.redirect_uri
                        },
                        json: true
                    }, (err, resp, body) => {
                        if (err) { return console.log(err); }
                        if (_.isNil(body.error)) {
                            console.log('Access and Refresh Tokens retrieved.');
                            this.config.access_token = body.access_token;
                            this.config.refresh_token = body.refresh_token;
                            this.config.save(err => {
                                if (err) { throw err; }
                                else { this.connect(); }
                            });
                        } else {
                            console.log("Invalid Refresh Token:", body.error);
                            this.config.deleteTokens();
                            this.config.validate();
                        }
                    });
                }
            } else {
                this.config.deleteTokens();
                this.config.validate();
            }
            this.authenticate();
        } else { console.error('Unknown Error:', e); }
    }
}
