#!/usr/bin/env node

/**
 * NOTES:
 * Some of my code for Beacon Scanning was inspired by: https://github.com/futomi/node-beacon-scanner
 */
const _ = require('lodash');
const Config = require('./src/Config');
const CapabilitiesCollector = require('./src/CapabilitiesCollector');
const BrokerConnection = require('./src/BrokerConnection');
const HTTPServer = require('./src/HTTPServer');
const Zeroconf = require('./src/Zeroconf');

function start(config, capabilitiesCollector) {
    const brokerConnection = new BrokerConnection(config, capabilitiesCollector);
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
    require('yargs')
        .option('config', {
            alias: 'c',
            demandOption: true,
            default: Config.DEFAULT_CONFIG_PATH,
            describe: 'Configuration file path',
            type: 'string'
        }).option('extract-capabilities', {
            alias: 'ec',
            type: 'boolean',
            default: true,
            description: 'Enables the automatic extraction of capabilities'
        }).command({
            command: 'run',
            aliases: ['$0', 'r'],
            handler: (argv) => {
                let capabilitiesCollector;
                const prepareConfigAndStart = capabilities => {
                    const configPath = argv.config;
                    new Config(configPath, (err, config) => {
                        if (err) { console.error('Could not load the configuration file:', err); process.exit(1); }
                        else {
                            if (capabilities) {
                                config.default_device_capabilities = config.device_capabilities;
                                config.device_capabilities = _.merge({}, capabilities, config.device_capabilities);
                            }
                            config.validate();
                            start(config, capabilitiesCollector);
                        }
                    });
                }
                if (argv.extractCapabilities) {
                    capabilitiesCollector = new CapabilitiesCollector();
                    capabilitiesCollector.collect().then(capabilities => prepareConfigAndStart(capabilities))
                        .catch(err => { console.error('Could not collect the device\'s capabilities', err); process.exit(1); });
                } else { prepareConfigAndStart() }
            }
        }).command({
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
                    if (err) { console.error('Could not load the configuration file:', err); process.exit(1); }
                    else {
                        const BeaconLogger = require('./src/BeaconLogger');
                        config.beacon_scan_realtime_updates = true;
                        config.beacons_print_updated = true;
                        const beaconLogger = new BeaconLogger(config);
                        beaconLogger.start(argv.logFile, argv.loggingDuration);
                    }
                });
            }
        }).command({
            command: 'advertise',
            aliases: ['a'],
            desc: 'Advertise iBeacon',
            handler: (argv) => {
                const configPath = argv.config;
                new Config(configPath, (err, config) => {
                    if (err) { console.error('Could not load the configuration file:', err); process.exit(1); }
                    else {
                        const IBeaconAdvertiser = require('./src/Advertiser/IBeaconAdvertiser');
                        const iBeaconAdvertiser = new IBeaconAdvertiser(
                            config.beacon_advertiser_parameters[0],
                            config.beacon_advertiser_parameters[1],
                            config.beacon_advertiser_parameters[2]
                        )
                        iBeaconAdvertiser.startAdvertising(e => {
                            if (err) { console.error('Error:', err); process.exit(1); }
                            else { console.log('Advertising iBeacon. Ctrl+C to exit.'); }
                        })
                    }
                });
            }
        }).demandCommand(1, 'You need to choose at least one command before moving on').help().argv;
}
main();