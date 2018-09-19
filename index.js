/**
 * WiP:
 * - Integrate with YanuX Broker/IPS Server
 * NOTE:
 * - Some of my code was inspired by: https://github.com/futomi/node-beacon-scanner
 */
const fs = require('fs');
const http = require('http');
const _ = require('lodash');
const request = require('request');
const queryString = require('query-string');
const uuidv1 = require('uuid/v1');

const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
const BeaconScanner = require('./src/Scanner').BeaconScanner;
const BeaconMatcher = require('./src/Scanner').BeaconMatcher;

const DEFAULT_CONFIG_PATH = './config.json';
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

function initHttpServer(configPath, config, beaconScanner) {
    if (_.isString(config.access_token)) {
        connectYanuxIpsServer(config, beaconScanner);
    }
    return (req, res) => {
        const query = queryString.parseUrl(req.url).query;
        if (query.code) {
            request.post({
                url: config.oauth2_authorization_server_url + '/oauth2/token',
                auth: {
                    user: config.client_id,
                    pass: config.client_secret,
                    sendImmediately: true
                },
                form: {
                    code: query.code,
                    grant_type: 'authorization_code',
                    redirect_uri: config.redirect_uri
                },
                json: true
            }, (err, response, body) => {
                if (err) { return console.log(err); }
                if (_.isNil(body.error)) {
                    res.write('Access Token and Refresh Token retrieved. You may now close this page.');
                    config.access_token = body.access_token;
                    config.refresh_token = body.refresh_token;
                    saveConfig(configPath, config);
                    connectYanuxIpsServer(config, beaconScanner);
                } else {
                    res.write('The following error has occurred:\n');
                    res.write(JSON.stringify(body, null, 4));
                }
                res.end();
            });
        }
    }
}

function bluetoothLe(
    beaconsPrintUpdated = DEFAULT_BEACONS_PRINT_UPDATED,
    beaconsPrintCleared = DEFAULT_BEACONS_PRINT_CLEARED,
    beaconsClearConsole = DEFAULT_BEACONS_CLEAR_CONSOLE,
    beaconsRefreshInterval = DEFAULT_BEACONS_REFRESH_INTERVAL,
    beaconsInactivityTimer = DEFAULT_BEACONS_INACTIVITY_TIMER) {
    const ibeacon_advertiser = new IBeaconAdvertiser('113069ec6e644bd36810de01b36e8a3e', 100, 1);
    ibeacon_advertiser.startAdvertising(errorCallback);
    const beacon_scanner = new BeaconScanner(beaconsRefreshInterval, beaconsInactivityTimer);
    beacon_scanner.addMatcher(new BeaconMatcher(null, 'iBeacon', ['113069EC-6E64-4BD3-6810-DE01B36E8A3E']))
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

    const beaconsService = client.service('beacons');

    client.authenticate({
        strategy: 'yanux',
        accessToken: config.access_token,
    }).then(response => {
        console.log('Logged in successfully with the following JWT: ' + response.accessToken);
        return client.passport.verifyJWT(response.accessToken);
    }).then(payload => {
        console.log('JWT Payload', payload);
        return client.service('users').get(payload.userId);
    }).then(user => {
        client.set('user', user);
        console.log('User', client.get('user'));
        const savedBeaconsObjectIds = {};

        beaconsService.on('created', savedBeacon => {
            console.log('Created a beacon', savedBeacon)
            savedBeaconsObjectIds[savedBeacon.beacon.id] = savedBeacon._id
        });
        beaconsService.on('updated', savedBeacon => {
            console.log('Updated a beacon', savedBeacon)
            savedBeaconsObjectIds[savedBeacon.beacon.id] = savedBeacon._id
        });
        beaconsService.on('removed', savedBeacon => {
            console.log('Removed a beacon', savedBeacon)
            delete savedBeaconsObjectIds[savedBeacon.beacon.id];
        });

        beaconScanner.on('beaconCreated', beacon => beaconsService.create({ beacon: beacon }));
        /**
         * TODO: Maybe I can follow a find and update policy to avoid any duplication between multiple runs.
         * But I have to be careful to avoid any concurrency problems.
         */
        beaconScanner.on('beaconUpdated', beacon => {
            if (savedBeaconsObjectIds[beacon.id]) {
                beaconsService.update(savedBeaconsObjectIds[beacon.id], { beacon: beacon, user: user._id })
            }
        });
        beaconScanner.on('beaconRemoved', beacon => {
            if (savedBeaconsObjectIds[beacon.id]) {
                beaconsService.remove(savedBeaconsObjectIds[beacon.id], { beacon: beacon, user: user._id })
            }
        });
    }).catch(e => {
        console.error('Authentication Error', e);
    });
}

function validateConfig(data) {
    const config = JSON.parse(data);
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
        console.log('Go to http://localhost:3000/oauth2/authorize?client_id=yanux-ips-desktop-client&response_type=code&redirect_uri=http://localhost:3002 and authorize the application.')
    }
    if (_.isNil(config.device_id)) {
        console.log('Generating a new Device ID because this is the first time you are running the YanuX IPS Desktop Client on this device.');
        config.device_id = uuidv1();
    }
    return config;
}

function saveConfig(path, config) {
    fs.writeFile(path, JSON.stringify(config, null, 4),
        function (err) {
            if (err) {
                throw err;
            }
        });
}

function main() {
    console.log('Welcome to YanuX Indoor Positioning System Desktop Client');
    const configPath = DEFAULT_CONFIG_PATH;
    fs.readFile(configPath,
        function (err, data) {
            if (err) {
                throw err;
            }
            const config = validateConfig(data);
            saveConfig(configPath, config);
            const beaconScanner = bluetoothLe(
                config.beacons_print_updated || DEFAULT_BEACONS_PRINT_UPDATED,
                config.beacons_print_cleared || DEFAULT_BEACONS_CLEAR_CONSOLE,
                config.beacons_clear_console || DEFAULT_BEACONS_CLEAR_CONSOLE,
                config.beacons_refresh_interval || DEFAULT_BEACONS_REFRESH_INTERVAL,
                config.beacons_inactivity_timer || DEFAULT_BEACONS_INACTIVITY_TIMER);

            http.createServer(initHttpServer(configPath, config, beaconScanner))
                .listen(config.http_port);
        });
}

main();