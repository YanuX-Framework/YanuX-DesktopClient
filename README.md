# YanuX Desktop Client
This is part of the [__YanuX Frameworl__](https://yanux-framework.github.io/). 

It is the __Desktop Client__ for the [__YanuX Framework__](https://yanux-framework.github.io/). It incorporates both the __YanuX Orchestrator__ component, by extracting the capabilities of the devices where it runs, and of the role of an __Indoor Positioning Client__ by continuously scanning for __Wi-Fi Access Points__ and __Bluetooth Low Energy Beacons__ (iBeacons) and submitting that information to the [__Indoor Positioning Server__](https://github.com/YanuX-Framework/YanuX-IPSServer) so that the devices can be positioned.

This is CLI application that is built using [__Node.js__](https://nodejs.org/), [__Electron__](https://www.electronjs.org/), [__noble__](https://github.com/abandonware/noble), [__node wifi__](https://github.com/friedrith/node-wifi) and many [other packages](package.json).

## Documentation
The application is configured by passing it a [__config.json__](config.json) file. Some examples can be found in the [__configs__](configs) folder.

This is the result of running the application with the `--help` argument:
```
Commands:
  app.js log [logFile] [loggingDuration]  Log surrounding BLE beacons
                                                                    [aliases: l]
  app.js advertise                        Advertise iBeacon         [aliases: a]

Options:
      --version                     Show version number                [boolean]
  -c, --config                      Configuration file path
                                  [string] [required] [default: "./config.json"]
      --extract-capabilities, --ec  Enables the automatic extraction of
                                    capabilities       [boolean] [default: true]
      --help                        Show help                          [boolean]

```
### TODO:
- Provide additional documentation.

## License
This work is licensed under [__GNU General Public License Version 3__](LICENSE)