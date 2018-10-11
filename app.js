/**
 * NOTE:
 * - Some of my code for Beacon Scanning was inspired by: https://github.com/futomi/node-beacon-scanner
 */
const fs = require('fs');
const _ = require('lodash');
const express = require('express');
const request = require('request');
const uuidv1 = require('uuid/v1');

const DEFAULT_CONFIG_PATH = './config.json';
const DEFAULT_CONFIG_STRINGIFY_SPACES = 4;
const DEFAULT_BEACON_ADVERTISER_PARAMETERS = ['113069ec6e644bd36810de01b36e8a3e', 100, 100];
const DEFAULT_BEACON_MATCHER_PARAMETERS = [null, 'iBeacon', ['113069EC-6E64-4BD3-6810-DE01B36E8A3E']];
const DEFAULT_BEACONS_PRINT_UPDATED = false;
const DEFAULT_BEACONS_PRINT_CLEARED = false;
const DEFAULT_BEACONS_CLEAR_CONSOLE = false;
const DEFAULT_BEACONS_REFRESH_INTERVAL = 500;
const DEFAULT_BEACONS_INACTIVITY_TIMER = 1000;

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

function validateConfig(config, path) {
    if (!_.isFinite(config.http_port)) {
        throw new Error('"http_port" value is either missing or invalid');
    }
    if (!_.isString(config.client_id)) {
        throw new Error('"client_id" value is either missing or invalid');
    }
    if (!_.isString(config.client_secret)) {
        throw new Error('"client_secret" value is either missing or invalid');
    }
    if (!_.isString(config.redirect_uri)) {
        throw new Error('"redirect_uri" value is either missing or invalid');
    }
    if (!_.isString(config.ips_server_url)) {
        throw new Error('"ips_server_url" value is either missing or invalid');
    }
    if (!_.isString(config.oauth2_authorization_server_url)) {
        throw new Error('"oauth2_authorization_server_url" value is either missing or invalid');
    }
    if (!_.isNil(config.beacon_advertiser_parameters)
        && !_.isArray(config.beacon_advertiser_parameters)
        && !_.isEmpty(config.beacon_advertiser_parameters)) {
        throw new Error('"beacon_advertiser_parameters" value is invalid');
    }
    if (!_.isNil(config.beacon_matcher_parameters)
        && !_.isArray(config.beacon_matcher_parameters)
        && !_.isEmpty(config.beacon_matcher_parameters)) {
        throw new Error('"beacon_matcher_parameters" value is invalid');
    }
    if (!_.isNil(config.beacons_print_updated)
        && !_.isBoolean(config.beacons_print_updated)) {
        throw new Error('"beacons_print_updated" value is invalid');
    }
    if (!_.isNil(config.beacons_print_cleared)
        && !_.isBoolean(config.beacons_print_cleared)) {
        throw new Error('"beacons_print_cleared" value is invalid');
    }
    if (!_.isNil(config.beacons_clear_console)
        && !_.isBoolean(config.beacons_clear_console)) {
        throw new Error('"beacons_clear_console" value is invalid');
    }
    if (!_.isNil(config.beacons_refresh_interval)
        && !_.isFinite(config.beacons_refresh_interval)
        && config.beacons_refresh_interval < 0) {
        throw new Error('"beacons_refresh_interval" value is invalid');
    }
    if (!_.isNil(config.beacons_inactivity_timer)
        && !_.isFinite(config.beacons_inactivity_timer)
        && config.beacons_inactivity_timer < 0) {
        throw new Error('"beacons_inactivity_timer" value is invalid');
    }
    if (_.isNil(config.access_token)) {
        console.log(`Go to http://localhost:3001/oauth2/authorize?client_id=${config.client_id}&response_type=code&redirect_uri=http://localhost:3002 and authorize the application.`);
    }
    if (_.isNil(config.device_uuid)) {
        console.log('Generating a new Device ID because this is the first time you are running the YanuX IPS Desktop Client on this device.');
        config.device_uuid = uuidv1();
        saveConfig(path, config);
    }
    return config;
}

function saveConfig(path, config) {
    fs.writeFile(path, JSON.stringify(config, null, DEFAULT_CONFIG_STRINGIFY_SPACES),
        function (err) {
            if (err) {
                throw err;
            }
        });
}

function bluetoothLe(
    beaconAdvertiserParameters = DEFAULT_BEACON_ADVERTISER_PARAMETERS,
    beaconMatcherParameters = DEFAULT_BEACON_MATCHER_PARAMETERS,
    beaconsPrintUpdated = DEFAULT_BEACONS_PRINT_UPDATED,
    beaconsPrintCleared = DEFAULT_BEACONS_PRINT_CLEARED,
    beaconsClearConsole = DEFAULT_BEACONS_CLEAR_CONSOLE,
    beaconsRefreshInterval = DEFAULT_BEACONS_REFRESH_INTERVAL,
    beaconsInactivityTimer = DEFAULT_BEACONS_INACTIVITY_TIMER) {

    const BeaconScanner = require('./src/Scanner').BeaconScanner;
    const BeaconMatcher = require('./src/Scanner').BeaconMatcher;

    if (_.isArray(beaconAdvertiserParameters)) {
        const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
        beaconAdvertiserParameters.unshift(null);
        const ibeacon_advertiser = new (Function.prototype.bind.apply(IBeaconAdvertiser, beaconAdvertiserParameters));
        ibeacon_advertiser.startAdvertising(errorCallback);
    }

    const beacon_scanner = new BeaconScanner(beaconsRefreshInterval, beaconsInactivityTimer);
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

function connectYanuxIpsServer(config, beaconScanner) {
    const io = require('socket.io-client');
    const feathers = require('@feathersjs/feathers');
    const socketio = require('@feathersjs/socketio-client');
    const auth = require('@feathersjs/authentication-client');

    const socket = io(config.ips_server_url);
    const client = feathers();

    client.configure(socketio(socket));
    client.configure(auth());

    client.authenticate({
        strategy: 'yanux',
        accessToken: config.access_token,
        clientId: config.client_id
    }).then(response => {
        console.log('Logged in successfully with the following JWT: ' + response.accessToken);
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
                .then(beacons => console.log('Removing any outstanding beacons:', beacons));
        }
        tidyUpBeacons().then(() => {
            /**
             * NOTE: Should I use the deviceUuid or the device's ObjectId as the
             * reference key for detected beacons? I'd say that it doesn't matter
             * much, but I maybe I'm missing something! 
             */
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
            const devicesService = client.service('devices');
            devicesService.patch(null, {
                deviceUuid: config.device_uuid,
                status: "online"
            }, { query: { deviceUuid: config.device_uuid } })
                .then(devices => console.log('Devices:', devices))
                .catch(e => console.error(e));
            process.on('SIGINT', () => {
                devicesService.patch(null, {
                    deviceUuid: config.device_uuid,
                    status: "offline"
                }, { query: { deviceUuid: config.device_uuid } })
                    .then(devices => {
                        console.log('Devices:', devices);
                        return tidyUpBeacons();
                    }).then(() => process.exit()).catch(e => { console.error(e); process.exit(); });
            });
            /** 
             * TODO:
             * Remove this! I don't need to listen to proxemic events here.
             * It is up to each application/YanuX Coordinator implementation
             * to do it. 
             */
            const eventsService = client.service('events');
            eventsService.on('proxemics', proxemics => {
                console.log('[[[ Proxemics ]]]:\n', proxemics)
            });
        }).catch(e => console.error(e));
    }).catch(e => console.error('Authentication Error', e));
}

function initHttpServer(configPath, config, beaconScanner) {
    const app = express();
    app.listen(config.http_port, () => console.log(`Started YanuX IPS Desktop Client HTTP Server on port ${config.http_port}!`))
    app.get('/', (req, res) => {
        if (req.query.code) {
            request.post({
                url: config.oauth2_authorization_server_url + '/oauth2/token',
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
                    res.write('Access and Refresh Tokens retrieved. You may now close this page.');
                    config.access_token = body.access_token;
                    config.refresh_token = body.refresh_token;
                    saveConfig(configPath, config);
                    connectYanuxIpsServer(config, beaconScanner);
                } else {
                    res.write('The following error has occurred:\n');
                    res.write(JSON.stringify(body, null, DEFAULT_CONFIG_STRINGIFY_SPACES));
                }
                res.end();
            });
        } else {
            res.write('It was not possible retrieve the Access and Refresh Tokens. Please try again later.');
            res.end();
        }
    });
}

function main() {
    const configPath = DEFAULT_CONFIG_PATH;
    fs.readFile(configPath,
        function (err, data) {
            if (err) {
                throw err;
            }
            const config = validateConfig(JSON.parse(data), configPath);
            const beaconScanner = bluetoothLe(
                config.beacon_advertiser_parameters || DEFAULT_BEACON_ADVERTISER_PARAMETERS,
                config.beacon_matcher_parameters || DEFAULT_BEACON_MATCHER_PARAMETERS,
                config.beacons_print_updated || DEFAULT_BEACONS_PRINT_UPDATED,
                config.beacons_print_cleared || DEFAULT_BEACONS_CLEAR_CONSOLE,
                config.beacons_clear_console || DEFAULT_BEACONS_CLEAR_CONSOLE,
                config.beacons_refresh_interval || DEFAULT_BEACONS_REFRESH_INTERVAL,
                config.beacons_inactivity_timer || DEFAULT_BEACONS_INACTIVITY_TIMER);
            if (_.isString(config.access_token)) {
                connectYanuxIpsServer(config, beaconScanner);
            }
            initHttpServer(configPath, config, beaconScanner);
        });
}

main();