/**
 * TODO:
 * - Integrate with the rest of YanuX
 * NOTE:
 * - Some of my code was inspired by: https://github.com/futomi/node-beacon-scanner
 */

const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
const BeaconScanner = require('./src/Scanner').BeaconScanner;
const BeaconMatcher = require('./src/Scanner').BeaconMatcher;

const BEACONS_PRINT_UPDATED = false;
const BEACONS_PRINT_CLEARED = false;
const BEACONS_CLEAR_CONSOLE = false;
const BEACONS_REFRESH_INTERVAL = 500;
const BEACONS_INACTIVITY_TIMER = 1000;
const BOGUS_DEVICE_ID = '8f976acc-0ebe-44f8-80b3-289119695a7e';
const YANUX_IPS_SERVER_ADDRESS = 'http://localhost:3030';

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
    beaconsPrintUpdated = BEACONS_PRINT_UPDATED,
    beaconsPrintCleared = BEACONS_PRINT_CLEARED,
    beaconsClearConsole = BEACONS_CLEAR_CONSOLE,
    beaconsRefreshInterval = BEACONS_REFRESH_INTERVAL,
    beaconsInactivityTimer = BEACONS_INACTIVITY_TIMER) {
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

function connectYanuxIpsServer() {
    const io = require('socket.io-client');
    const feathers = require('@feathersjs/feathers');
    const socketio = require('@feathersjs/socketio-client');
    const auth = require('@feathersjs/authentication-client');

    const socket = io(YANUX_IPS_SERVER_ADDRESS);
    const client = feathers();

    client.configure(socketio(socket));
    client.configure(auth())

    return client;
}

function main() {
    console.log('---- Welcome to YanuX Indoor Positioning System Desktop Client ----');
    const beaconScanner = bluetoothLe(false, false, false);
    const client = connectYanuxIpsServer();
    const beaconsService = client.service('beacons');
    beaconsService.on('created', event => console.log('Created an beacon event', event));
    beaconsService.on('updated', event => console.log('Updated an beacon event', event));
    beaconsService.on('removed', event => console.log('Removed an beacon event', event));
    // TODO: WiP --- Integration with YanuX Broker, and later with a dedicated YanuX IPS Server. ---
    // Authenticate with the local email/password strategy 
    client.authenticate({
        strategy: 'yanux',
        accessToken: '6BWzN68KljbEn7wAwQdcBBYlbqp6C3cLBZAICNkg99BDAZj7FIXpEsSz1aKafCrMjtaEw7xIAJJqmB5wPYvmKoQE2rvaQuB7maJPrAvg3PR5uP2wHc4bs4f3Kvv3AkQDajAAaPkiKakd9il4X3kbNN2mqhLPXex5AK6Gy7Q5acW596tQ9sVoNnN0B0fNIlNZgh9Su0ia1etMQpx42HL0QkgaMnenQbjA8p0qVaRm2lf1yOwPIGhP1A9YdwcNX1nt',
    }).then(() => {
        // Logged in
        console.log('Logged in successfully');
        beaconScanner.on('beaconCreated', beacon => beaconsService.create({ beacon: beacon }));
        beaconScanner.on('beaconUpdated', beacon => beaconsService.update(BOGUS_DEVICE_ID + beacon.key, { beacon: beacon }));
        beaconScanner.on('beaconRemoved', beacon => beaconsService.remove(BOGUS_DEVICE_ID + beacon.key, { beacon: beacon }));
    }).catch(e => {
        // Show login page (potentially with `e.message`)
        console.error('Authentication error', e);
    });
}

main();