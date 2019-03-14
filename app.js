/**
 * NOTES:
 * - I feel that the scope of this project is stretching. Perhaps I may end up splitting it into smaller parts,
 * or otherwise I will also incorporate the YanuX Orchestrator into it.
 * - Some of my code for Beacon Scanning was inspired by: https://github.com/futomi/node-beacon-scanner
 */
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const express = require('express');
const request = require('request');
const dnssd = require('dnssd');

const Config = require('./src/Config');
const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
const BeaconScanner = require('./src/Scanner').BeaconScanner;
const BeaconMatcher = require('./src/Scanner').BeaconMatcher;


function clearConsole() {
    return process.stdout.write('\033c');
}

function errorCallback(error) {
    if (error) {
        console.error('Error:', error);
    }
}

function printBeacons(title = null, clear = false) {
    return function (beacons) {
        clear === true ? clearConsole() : console.log('------------------------------------');
        if (title) {
            console.log('------------ ' + title + ' ------------');
        }
        for (key in beacons) {
            console.log(beacons[key]);
        }
    }
}

function bluetoothLe(
    beaconScan = Config.DEFAULT_BEACON_SCAN,
    beaconAdvertise = Config.DEFAULT_BEACON_ADVERTISE,
    beaconAdvertiserParameters = Config.DEFAULT_BEACON_ADVERTISER_PARAMETERS,
    beaconMatcherParameters = Config.DEFAULT_BEACON_MATCHER_PARAMETERS,
    beaconsPrintUpdated = Config.DEFAULT_BEACONS_PRINT_UPDATED,
    beaconsPrintCleared = Config.DEFAULT_BEACONS_PRINT_CLEARED,
    beaconsClearConsole = Config.DEFAULT_BEACONS_CLEAR_CONSOLE,
    beaconsRefreshInterval = Config.DEFAULT_BEACONS_REFRESH_INTERVAL,
    beaconsInactivityTimer = Config.DEFAULT_BEACONS_INACTIVITY_TIMER) {
    if (beaconAdvertise && _.isArray(beaconAdvertiserParameters) && beaconAdvertiserParameters.length === 3) {
        beaconAdvertiserParameters = beaconAdvertiserParameters.slice(0)
        beaconAdvertiserParameters.unshift(null);
        const ibeacon_advertiser = new (Function.prototype.bind.apply(IBeaconAdvertiser, beaconAdvertiserParameters));
        ibeacon_advertiser.startAdvertising(errorCallback);
    }
    if (beaconScan && _.isArray(beaconMatcherParameters)) {
        const beacon_scanner = new BeaconScanner(beaconsRefreshInterval, beaconsInactivityTimer);
        beaconMatcherParameters = beaconMatcherParameters.slice(0);
        beaconMatcherParameters.unshift(null);
        beacon_scanner.addMatcher(new (Function.prototype.bind.apply(BeaconMatcher, beaconMatcherParameters)));
        if (beaconsPrintUpdated) {
            beacon_scanner.on('beaconsUpdated', printBeacons('beaconsUpdated', beaconsClearConsole));
        }
        if (beaconsPrintCleared) {
            beacon_scanner.on('beaconsCleared', printBeacons('beaconsCleared', beaconsClearConsole));
        }
        beacon_scanner.startScanning(errorCallback);
        return beacon_scanner;
    }
}

function connectToBroker(config, beaconScanner) {
    const io = require('socket.io-client');
    const feathers = require('@feathersjs/feathers');
    const socketio = require('@feathersjs/socketio-client');
    const auth = require('@feathersjs/authentication-client');

    const socket = io(config.broker_url);
    const client = feathers();
    let jwtAccessToken = null;

    client.configure(socketio(socket));
    client.configure(auth());

    const authenticate = () => {
        let credentials;
        if (!jwtAccessToken) {
            credentials = {
                strategy: 'yanux',
                clientId: config.client_id,
                accessToken: config.access_token
            }
        } else {
            credentials = {
                strategy: 'jwt',
                accessToken: jwtAccessToken,
            }
        }
        client.authenticate(credentials)
            .then(response => {
                jwtAccessToken = response.accessToken;
                console.log('Logged in successfully with the following JWT: ' + response.accessToken);
                //TODO: Customize verification so that it checks if the JWT signature is valid just like I'm doing on Android.
                return client.passport.verifyJWT(response.accessToken);
            }).then(payload => {
                console.log('JWT Payload', payload);
                return client.service('users').get(payload.userId);
            }).then(user => {
                client.set('user', user);
                console.log('User', client.get('user'));
                const beaconsService = client.service('beacons');
                /**
                 * Server-side events
                 */
                /*
                beaconsService.on('created', beacon => {
                    console.log('Event Beacon Created', beacon)
                });
                beaconsService.on('patched', beacon => {
                    console.log('Event Beacon Patched', beacon)
                });
                beaconsService.on('removed', beacon => {
                    console.log('Event Beacon Removed', beacon)
                });
                */
                const tidyUpBeacons = () => {
                    return beaconsService
                        .remove(null, { query: { deviceUuid: config.device_uuid } })
                        .then(beacons => console.log('Removed any outstanding beacons:', beacons));
                }
                process.on('SIGINT', () => {
                    tidyUpBeacons()
                        .then(() => {
                            socket.close();
                            process.exit();
                        }).catch(e => {
                            console.error(e);
                            process.exit();
                        });
                });
                tidyUpBeacons().then(() => {
                    if (beaconScanner) {
                        beaconScanner.removeAllListeners();
                        beaconScanner.beacons.length = 0;
                        beaconScanner.on('beaconCreated', beacon => {
                            beaconsService.create({
                                user: user._id,
                                deviceUuid: config.device_uuid,
                                beaconKey: beacon.key,
                                beacon: beacon
                            }).then(beacon => {
                                console.log('Beacon Created:', beacon);
                            }).catch(e => console.error(e));
                        });
                        beaconScanner.on('beaconUpdated', beacon => {
                            beaconsService.patch(null, { beacon: beacon }, {
                                query: {
                                    user: user._id,
                                    deviceUuid: config.device_uuid,
                                    beaconKey: beacon.key
                                }
                            }).then(beacons => {
                                console.log('Beacons Patched:', beacons);
                            }).catch(e => console.error(e));
                        });
                        beaconScanner.on('beaconRemoved', beacon => {
                            beaconsService.remove(null, {
                                query: {
                                    user: user._id,
                                    deviceUuid: config.device_uuid,
                                    beaconKey: beacon.key
                                }
                            }).then(beacons => {
                                console.log('Beacons Removed:', beacons);
                            }).catch(e => console.error(e));
                        });
                    }
                    const devicesService = client.service('devices');
                    const beaconValues = config.beacon_advertiser_parameters || Config.DEFAULT_BEACON_ADVERTISER_PARAMETERS;
                    return devicesService.patch(null, {
                        deviceUuid: config.device_uuid,
                        beaconValues: beaconValues,
                        capabilities: config.device_capabilities
                    }, { query: { deviceUuid: config.device_uuid } });
                }).then(devices => {
                    console.log('Devices:', devices);
                }).catch(e => console.error(e));
            }).catch(e => {
                console.error('Authentication Error', e);
                if (e.message === 'The provided access token is not valid.') {
                    if (config.refresh_token) {
                        console.log('Trying to get a new token using the Refresh Token');
                        request.post({
                            url: config.oauth2_authorization_server_url + 'oauth2/token',
                            auth: {
                                user: config.client_id,
                                pass: config.client_secret,
                                sendImmediately: true
                            },
                            form: {
                                refresh_token: config.refresh_token,
                                grant_type: 'refresh_token',
                                redirect_uri: config.redirect_uri
                            },
                            json: true
                        }, (err, resp, body) => {
                            if (err) { return console.log(err); }
                            if (_.isNil(body.error)) {
                                console.log('Access and Refresh Tokens retrieved.');
                                config.access_token = body.access_token;
                                config.refresh_token = body.refresh_token;
                                config.save();
                                connectToBroker(config, beaconScanner);
                            } else {
                                console.log("Invalid Refresh Token:", body.error);
                                config.deleteTokens();
                                config.validate();
                            }
                        });
                    } else {
                        config.deleteTokens();
                        config.validate();
                    }
                }
            });
    }
    /** TODO: Port the re-authentication logic to YanuX Coordinator and Scavenger!
     *  In fact, I should finish implementing it here because I noted that if the connections is kept open beyond the JWT expiration time a NotAuthenticated error arises. */
    authenticate();
    client.io.on('reconnect', attempt => {
        console.log(`Reconnected after ${attempt} attempts`);
        authenticate();
    })
    client.on('reauthentication-error', err => {
        console.error(err);
        jwtAccessToken = null;
        authenticate();
    });
}

function initHttpServer(config, beaconScanner) {
    const app = express();
    app.listen(config.http_server_port, () => console.log(`Started YanuX IPS Desktop Client HTTP Server on port ${config.http_server_port}!`));
    /** TODO: Refine the CORS policy! */
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        next();
    });
    /** 
     * NOTE: 
     * Perhaps the device UUID generator and webserver could be placed on a separate component.
     ** I'm still not sure! **
     */
    app.get('/', (req, res) => {
        if (req.query.code) {
            request.post({
                url: config.oauth2_authorization_server_url + 'oauth2/token',
                auth: {
                    user: config.client_id,
                    pass: config.client_secret,
                    sendImmediately: true
                },
                form: {
                    code: req.query.code,
                    grant_type: 'authorization_code',
                    redirect_uri: config.redirect_uri
                },
                json: true
            }, (err, resp, body) => {
                if (err) { return console.log(err); }
                if (_.isNil(body.error)) {
                    res.sendFile(path.join(__dirname + '/public/success.html'));
                    config.access_token = body.access_token;
                    config.refresh_token = body.refresh_token;
                    config.save();
                    connectToBroker(config, beaconScanner);
                } else {
                    res.sendFile(path.join(__dirname + '/public/error.html'));
                    console.log("The following error has occurred while trying to exchange and authorization code for an access and refresh tokens:",
                        JSON.stringify(body, null, Config.DEFAULT_STRINGIFY_SPACES));
                }
            });
        } else {
            res.sendFile(path.join(__dirname + '/public/index.html'));
        }
    });
    app.get('/deviceInfo', (req, res) => {
        res.json({ deviceUuid: config.device_uuid });
        res.end();
    });
}

function start(config) {
    const beaconScanner = bluetoothLe(
        config.beacon_scan || Config.DEFAULT_BEACON_SCAN,
        config.beacon_advertise || Config.DEFAULT_BEACON_ADVERTISE,
        config.beacon_advertiser_parameters || Config.DEFAULT_BEACON_ADVERTISER_PARAMETERS,
        config.beacon_matcher_parameters || Config.DEFAULT_BEACON_MATCHER_PARAMETERS,
        config.beacons_print_updated || Config.DEFAULT_BEACONS_PRINT_UPDATED,
        config.beacons_print_cleared || Config.DEFAULT_BEACONS_CLEAR_CONSOLE,
        config.beacons_clear_console || Config.DEFAULT_BEACONS_CLEAR_CONSOLE,
        config.beacons_refresh_interval || Config.DEFAULT_BEACONS_REFRESH_INTERVAL,
        config.beacons_inactivity_timer || Config.DEFAULT_BEACONS_INACTIVITY_TIMER);
    if (_.isString(config.access_token)) {
        connectToBroker(config, beaconScanner);
    }
    initHttpServer(config, beaconScanner);
}

function main() {
    const argv = require('yargs').option('config', {
        alias: 'c',
        demandOption: true,
        default: Config.DEFAULT_CONFIG_PATH,
        describe: 'Config file path',
        type: 'string'
    }).argv;
    const configPath = argv.config;
    fs.readFile(configPath,
        function (err, data) {
            if (err) {
                throw err;
            }
            const config = new Config(JSON.parse(data), configPath);
            config.validate();
            if (config.allow_zeroconf) {
                let broker_url, oauth2_authorization_server_url;
                const browser = dnssd.Browser(dnssd.tcp('http'))
                    .on('serviceUp', service => {
                        console.log("Device up: ", service)
                        const url = service.txt.protocol + '://' + service.host + ':' + service.port + '/';
                        switch (service.name) {
                            case 'YanuX-Auth':
                                oauth2_authorization_server_url = url;
                                break;
                            case 'YanuX-Broker':
                                broker_url = url;
                                break;
                            default:
                                break;
                        }
                        if (broker_url && oauth2_authorization_server_url) {
                            config.broker_url = broker_url;
                            config.oauth2_authorization_server_url = oauth2_authorization_server_url;
                            config.save();
                            start(config);
                            browser.stop();
                        }
                    }).start();
            } else {
                start(config);
            }
        });
}

main();