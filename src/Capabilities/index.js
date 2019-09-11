//Import spawn from the child_process module.
const { spawn } = require('child_process');
//Import the util module.
const util = require('util');

module.exports = class Capabilities {
    constructor() {}
    collect() {
        return new Promise((resolve, reject) => {
            //Launch the electron main process using spawn.
            const capabiltiesCollector = spawn('npx', ['electron', './src/Capabilities/main/main.js'], { shell: true });
            //The empty JSON string that we will fill from the output of the Electron's Main Process.
            let capabilitiesJson = '';
            //A string to be filled by anything that came from Electron's Main Process stderr.
            let error = '';

            //When data comes from the Electron's Main Process stdout.
            capabiltiesCollector.stdout.on('data', data => {
                //Concatenate it into the Capabilities JSON string.
                capabilitiesJson += data;
            });

            //When data comes from the Electron's Main Process stderr.
            capabiltiesCollector.stderr.on('data', data => {
                //Concatenate it into the error string.
                error += data
            });

            //Once the process quits
            capabiltiesCollector.on('close', code => {
                //If there was no error output
                if (!error) {
                    const capabilities = JSON.parse(capabilitiesJson);
                    resolve(capabilities);
                }
                //Otherwise print any error messages.
                else { reject(new Error(error)) }
            });
        });
    }
}








