/**
 * TODO:
 * - Integrate with the rest of YanuX
 * NOTE:
 * - Some of my code was inspired by: https://github.com/futomi/node-beacon-scanner
 */

const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
const BeaconScanner = require('./src/Scanner').BeaconScanner;
const BeaconMatcher = require('./src/Scanner').BeaconMatcher;

const BEACON_REFRESH_INTERVAL = 1000;
const BEACON_INACTIVITY_TIMER = 2500;

const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const auth = require('@feathersjs/authentication-client');

const socket = io('http://localhost:3030');
const client = feathers();

client.configure(socketio(socket));
client.configure(auth())

const beaconsService = client.service('beacons');

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
        clear === true?clearConsole():console.log('------------------------------------');
        if (title) {
            console.log('------------ ' + title + ' ------------');
        }
        for (key in beacons) {
            console.log(beacons[key]);
        }
    }
}

function bluetoothLe() {
    let ibeacon_advertiser = new IBeaconAdvertiser('113069ec6e644bd36810de01b36e8a3e', 100, 1);
    ibeacon_advertiser.startAdvertising(errorCallback);
    let beacon_scanner = new BeaconScanner(BEACON_REFRESH_INTERVAL, BEACON_INACTIVITY_TIMER);
    beacon_scanner.addMatcher(new BeaconMatcher(null, 'iBeacon', ['113069EC-6E64-4BD3-6810-DE01B36E8A3E']))
    //beacon_scanner.on('beaconsUpdated', printBeacons('beaconsUpdated', false));
    beacon_scanner.on('beaconsCleared', printBeacons('beaconsCleared', false));
    beacon_scanner.startScanning(errorCallback);
    beaconsService.on('created', event => console.log('Created an event', event));
}

function main() {
    console.log('---- Welcome to YanuX Indoor Positioning System Desktop Client ----');
    bluetoothLe();
    // TODO: WiP --- Integration with YanuX Broker, and later with a dedicated YanuX IPS Server. ---
    // Authenticate with the local email/password strategy 
    /* client.authenticate({
        strategy: 'local',
        email: 'test_user_1@yanux.org',
        password: 'topsecret'
    }).then(() => {
        // Logged in
        console.log('Logged in successfully');
        ipsService.create({
            text: 'Event from client 1'
        });
    }).catch(e => {
        // Show login page (potentially with `e.message`)
        console.error('Authentication error', e);
    }); */
}

main();