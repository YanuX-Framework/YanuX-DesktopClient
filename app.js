/**
 * NOTES:
 * Some of my code for Beacon Scanning was inspired by: https://github.com/futomi/node-beacon-scanner
 */
const _ = require('lodash');
const Config = require('./src/Config');
const Zeroconf = require('./src/Zeroconf');
const BrokerConnection = require('./src/BrokerConnection');
const BeaconsBLE = require('./src/BeaconsBLE');
const HTTPServer = require('./src/HTTPServer');

function start(config) {
    const beaconsBLE = new BeaconsBLE(config);
    beaconsBLE.start();
    const brokerConnection = new BrokerConnection(config, beaconsBLE)
    if (_.isString(config.access_token)) {
        brokerConnection.connect();
    }
    const httpServer = new HTTPServer(config, brokerConnection);
    httpServer.listen();
    const zeroconf = new Zeroconf(config, brokerConnection);
    if (_.isBoolean(config.allow_zeroconf) && config.zeroconf) {
        zeroconf.startDiscovery();
    }
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
    new Config(configPath, (err, config) => {
        if (err) { throw err; }
        config.validate();
        start(config);
    });
}
main();