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
    if (_.isBoolean(config.allow_zeroconf) && config.allow_zeroconf) {
        zeroconf.startDiscovery();
    }
}

function main() {
    const argv = require('yargs')
        .option('config', {
            alias: 'c',
            demandOption: true,
            default: Config.DEFAULT_CONFIG_PATH,
            describe: 'Configuration file path',
            type: 'string'
        })
        .command({
            command: 'run',
            aliases: ['$0', 'r'],
            handler: (argv) => {
                const configPath = argv.config;
                new Config(configPath, (err, config) => {
                    if (err) { throw err; }
                    config.validate();
                    start(config);
                });
            }
        })
        .command({
            command: 'log [logFile] [loggingDuration]',
            aliases: ['l'],
            desc: 'Log surrounding BLE beacons',
            builder: (yargs) => {
                yargs.default('logFile', './beacons.json');
                yargs.default('loggingDuration', 5000);
            },
            handler: (argv) => {
                const configPath = argv.config;
                new Config(configPath, (err, config) => {
                    if (err) { throw err; }
                    const BeaconLogger = require('./src/BeaconLogger');
                    const beaconLogger = new BeaconLogger(config, argv.logFile);
                    beaconLogger.start(argv.loggingDuration);
                });
            }
        })
        .demandCommand(1, 'You need to choose at least one command before moving on')
        .help().argv;
}
main();