/**
 * NOTE:
 * - Heavily inspired by: https://github.com/futomi/node-beacon-scanner
 * TODO:
 * - Refactor into multiple files
 * - Integrate with the rest of YanuX
 */

//const IBeaconAdvertiser = require('./src/Advertiser').IBeaconAdvertiser;
//const noble = require('noble');
const BeaconScanner = require('./src/Scanner').BeaconScanner;

const BEACON_REFRESH_INTERVAL = 250;
const BEACON_INACTIVITY_TIMER = 2500;

function clearConsole() {
    return process.stdout.write('\033c');
}

function errorCallback(error) {
    if (error) {
        console.error('Error:', error);
    }
}

function main() {
    console.log('Welcome to YanuX Indoor Positioning System Desktop Client');
    //let ibeacon_advertiser = new IBeaconAdvertiser('113069ec6e644bd36810de01b36e8a3e', 100, 1);
    //ibeacon_advertiser.startAdvertising(errorCallback);
    let beacon_scanner = new BeaconScanner(BEACON_REFRESH_INTERVAL, BEACON_INACTIVITY_TIMER,
        null, 'iBeacon');
    beacon_scanner.startScanning(errorCallback);
    setInterval(() => {
        clearConsole();
        for (key in beacon_scanner.beacons) {
            console.log(beacon_scanner.beacons[key]);
        }
    }, BEACON_REFRESH_INTERVAL);
}

main();