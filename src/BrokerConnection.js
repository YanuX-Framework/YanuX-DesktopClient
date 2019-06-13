const _ = require('lodash');
const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const auth = require('@feathersjs/authentication-client');
const request = require('request');

module.exports = class BrokerConnection {
    constructor(config, beaconsBLE) {
        this.config = config;
        this.beaconsBLE = beaconsBLE;
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
        this.socket = io(this.config.broker_url);
        this.client = feathers();
        this.client.configure(socketio(this.socket));
        this.client.configure(auth());
        /** TODO: Port the re-authentication logic to YanuX Coordinator and Scavenger!
         *  In fact, I should finish implementing it here because I noted that if the connections is kept open beyond the JWT expiration time a NotAuthenticated error arises. */
        this.authenticate();
        this.usersService = this.client.service('users')
        this.devicesService = this.client.service('devices');
        this.beaconsService = this.client.service('beacons');
        this.client.io.on('reconnect', attempt => {
            console.log(`Reconnected after ${attempt} attempts`);
            this.authenticate();
        })
        this.client.on('reauthentication-error', err => {
            console.error(err);
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
                    this.jwtAccessToken = response.accessToken;
                    console.log('Logged in successfully with the following JWT: ' + response.accessToken);
                    //TODO: Customize verification so that it checks if the JWT signature is valid just like I'm doing on Android.
                    return this.client.passport.verifyJWT(response.accessToken);
                }).then(payload => {
                    console.log('JWT Payload', payload);
                    return this.usersService.get(payload.userId);
                }).then(user => {
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
                            this.beaconsBLE.beaconScanner.removeAllListeners();
                            this.beaconsBLE.beaconScanner.beaconsCreated = {};
                            this.beaconsBLE.beaconScanner.beaconsUpdated = {};
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
                        return this.devicesService.patch(null, {
                            deviceUuid: this.config.device_uuid,
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
            .then(beacons => console.log('Removed any outstanding beacons:', beacons));
    }
    handleError(e) {
        console.error('Error', e);
        if (e.name === 'NotAuthenticated') {
            if (e.message === 'jwt expired') {
                this.jwtAccessToken = null;
            }
            this.authenticate();
        } else if (e.message === 'The provided access token is not valid.') {
            console.error('Authentication Error', e);
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
            } else {
                this.config.deleteTokens();
                this.config.validate();
            }
        }
    }
}
