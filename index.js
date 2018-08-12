/**
 * NOTE:
 * - Heavily inspired by: https://github.com/futomi/node-beacon-scanner
 * TODO:
 * - Refactor into multiple files
 * - Integrate with the rest of YanuX
 */

const noble = require('noble');
const bleno = require('bleno');

const BEACON_REFRESH_INTERVAL = 250;
const BEACON_INACTIVITY_TIMER = 2500;
const EDDYSTONE_SERVICE_UUID = 'feaa';
const EDDYSTONE_URL_SCHEME_PREFIXES = {
    '00': 'http://www.',
    '01': 'https://www.',
    '02': 'http://',
    '03': 'https://'
};
const EDDYSTONE_URL_ENCODINGS = {
    '00': '.com/',
    '01': '.org/',
    '02': '.edu/',
    '03': '.net/',
    '04': '.info/',
    '05': '.biz/',
    '06': '.gov/',
    '07': '.com',
    '08': '.org',
    '09': '.edu',
    '0a': '.net',
    '0b': '.info',
    '0c': '.biz',
    '0d': '.gov'
};

function clearConsole() {
    return process.stdout.write('\033c');
}

function errorCallback(error) {
    if (error) {
        console.error('Error:', error);
    }
}

function advertise() {
    var uuid = '113069ec6e644bd36810de01b36e8a3e';
    var major = 100; // 0x0000 - 0xffff
    var minor = 1; // 0x0000 - 0xffff
    var measuredPower = -59; // -128 - 127
    bleno.on('stateChange', state => {
        console.log('bleno state:', state)
        if (state === 'poweredOn') {
            bleno.startAdvertisingIBeacon(uuid, major, minor, measuredPower, errorCallback);
        }
    });
}

function detectBeaconType(peripheral) {
    let advertisement = peripheral.advertisement;
    let manudacturer = advertisement.manufacturerData;
    // iBeacon
    if (manudacturer &&
        manudacturer.length >= 4 &&
        manudacturer.readUInt32BE(0) === 0x4c000215) {
        return 'ibeacon';
    }
    // Eddystone
    let eddystone_service = advertisement.serviceData.find((el) => {
        return el.uuid === EDDYSTONE_SERVICE_UUID;
    });
    if (eddystone_service && eddystone_service.data) {
        // https://github.com/google/eddystone/blob/master/protocol-specification.md
        let frame_type = eddystone_service.data.readUInt8(0) >>> 4;
        if (frame_type === 0b0000) {
            return 'Eddystone-UID';
        } else if (frame_type === 0b0001) {
            return 'Eddystone-URL';
        } else if (frame_type === 0b0010) {
            return 'Eddystone-TLM';
        } else if (frame_type === 0b0011) {
            return 'Eddystone-EID';
        }
    }
    // Unknown
    return 'unknown';
};


function parseIBeacon(peripheral) {
    let advertisement = peripheral.advertisement;
    let manufacturer = advertisement.manufacturerData;
    if (manufacturer &&
        manufacturer.length >= 4 &&
        manufacturer.readUInt32BE(0) === 0x4c000215) {
        let uuid = [
            manufacturer.slice(4, 8).toString('hex'),
            manufacturer.slice(8, 10).toString('hex'),
            manufacturer.slice(10, 12).toString('hex'),
            manufacturer.slice(12, 14).toString('hex'),
            manufacturer.slice(14, 20).toString('hex')
        ].join('-').toUpperCase();
        return {
            type: 'iBeacon',
            uuid: uuid,
            major: manufacturer.slice(20, 22).readUInt16BE(0),
            minor: manufacturer.slice(22, 24).readUInt16BE(0),
            txPower: manufacturer.slice(24, 25).readInt8(0),
            rssi: peripheral.rssi,
            timestamp: new Date().getTime()
        };
    } else {
        return null;
    }
}

function getEddystoneServiceData(peripheral) {
    let ad = peripheral.advertisement;
    let eddystone_service = ad.serviceData.find((el) => {
        return el.uuid === EDDYSTONE_SERVICE_UUID;
    });
    if (!eddystone_service) {
        return null;
    }
    let data = eddystone_service.data || null;
    return data;
};

function parseEddystoneUid(peripheral) {
    let data = getEddystoneServiceData(peripheral);
    if (!data) {
        return null;
    }
    if (data.length !== 20 && data.length !== 18) {
        return null;
    }
    // Eddystone-UID
    // https://github.com/google/eddystone/tree/master/eddystone-uid
    return {
        type: 'Eddystone-UID',
        namespece: data.slice(2, 12).toString('hex').toUpperCase(),
        instance: data.slice(12, 18).toString('hex').toUpperCase(),
        txPower: data.readInt8(1),
        rssi: peripheral.rssi,
        timestamp: new Date().getTime()
    };
}

function parseEddystoneUrl(peripheral) {
    let data = getEddystoneServiceData(peripheral);
    if (!data) {
        return null;
    }
    // Eddystone-URL
    // https://github.com/google/eddystone/tree/master/eddystone-url
    if (data.length < 4) {
        return null;
    }
    let url = EDDYSTONE_URL_SCHEME_PREFIXES[data.slice(2, 3).toString('hex')];
    if (!url) {
        return null;
    }
    let encoded_url_buf = data.slice(3);
    for (let i = 0, len = encoded_url_buf.length; i < len; i++) {
        let b = encoded_url_buf.slice(i, i + 1);
        let h = b.toString('hex');
        if (EDDYSTONE_URL_ENCODINGS[h]) {
            url += EDDYSTONE_URL_ENCODINGS[h];
        } else {
            url += b.toString();
        }
    }
    return {
        type: 'Eddystone-URL',
        txPower: data.readInt8(1),
        url: url,
        rssi: peripheral.rssi,
        timestamp: new Date().getTime()
    };
};

function parseEddystoneTlm(peripheral) {
    let data = getEddystoneServiceData(peripheral);
    if (!data) {
        return null;
    }
    // Eddystone-TLM
    // https://github.com/google/eddystone/blob/master/eddystone-tlm/tlm-plain.md
    if (data.length !== 14) {
        return null;
    }
    let version = data.readUInt8(1);
    if (version !== 0x00) {
        return null;
    }
    return {
        type: 'Eddystone-TLM',
        batteryVoltage: data.readUInt16BE(2),
        temperature: data.readInt16BE(4) / 256,
        advCnt: data.readUInt32BE(6),
        secCnt: data.readUInt32BE(10),
        rssi: peripheral.rssi,
        timestamp: new Date().getTime()
    };
};

function parseEddystoneEid(peripheral) {
    let data = getEddystoneServiceData(peripheral);
    if (!data) {
        return null;
    }
    if (data.length !== 10) {
        return null;
    }
    // Eddystone-EID
    // https://github.com/google/eddystone/tree/master/eddystone-eid
    return {
        type: 'Eddystone-EID',
        txPower: data.readInt8(1),
        eid: data.slice(2, 10).toString('hex'),
        rssi: peripheral.rssi,
        timestamp: new Date().getTime()
    };
}

let beacons = {};
function scan() {
    bleno.on('stateChange', state => {
        console.log('noble state:', state)
        let clearUnseenBeaconsPolling;
        if (state === 'poweredOn') {
            noble.startScanning([], true, errorCallback);
            clearUnseenBeaconsPolling = setInterval(() => {
                let nowTimestamp = new Date().getTime();
                let nowBeacons = Object.entries(beacons);
                clearConsole();
                console.log('YanuX IPS Desktop Client - Beacons');
                for (const uuid in beacons) {
                    console.log(beacons[uuid]);
                }
                nowBeacons.forEach(beacon => {
                    if (nowTimestamp - beacon[1].timestamp > BEACON_INACTIVITY_TIMER) {
                        delete beacons[beacon[0]];
                    }
                });
            }, BEACON_REFRESH_INTERVAL);
        } else {
            clearInterval(clearUnseenBeaconsPolling);
            noble.stopScanning();
        }
    });
    noble.on('discover', peripheral => {
        let beaconType = detectBeaconType(peripheral)
        switch (beaconType) {
            case 'ibeacon':
                let ibeacon = parseIBeacon(peripheral);
                beacons[peripheral.uuid + '-' + ibeacon.type] = ibeacon;
                break;
            case 'Eddystone-UID':
                let eddystoneUid = parseEddystoneUid(peripheral);
                beacons[peripheral.uuid + '-' + eddystoneUid.type] = eddystoneUid;
                break;
            case 'Eddystone-TLM':
                let eddystoneTlm = parseEddystoneTlm(peripheral);
                beacons[peripheral.uuid + '-' + eddystoneTlm.type] = eddystoneTlm;
                break;
            default:
                beacons[peripheral.uuid] = {
                    type: beaconType,
                    peripheral: peripheral,
                    rssi: peripheral.rssi,
                    timestamp: new Date().getTime()
                };
                break;
        }
    });
}

function advertise() {
    var uuid = '113069ec6e644bd36810de01b36e8a3e';
    var major = 100; // 0x0000 - 0xffff
    var minor = 1; // 0x0000 - 0xffff
    var measuredPower = -59; // -128 - 127
    bleno.on('stateChange', state => {
        console.log('bleno state:', state)
        if (state === 'poweredOn') {
            bleno.startAdvertisingIBeacon(uuid, major, minor, measuredPower, errorCallback);
        }
    });
}

function main() {
    console.log('Welcome to YanuX Indoor Positioning System Desktop Client');
    //advertise();
    scan();
}

main();