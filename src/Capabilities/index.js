//Import spawn from the child_process module.
const electron = require('electron');
const { spawn } = require('child_process');

module.exports = class Capabilities {
    constructor() { }
    collect() {
        return new Promise((resolve, reject) => {
            //Launch the electron main process using spawn.
            const capabilitiesCollector = spawn(electron, ['./src/Capabilities/main/main.js'], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'], shell: true });
            //Listen for IPC messages coming from the Electron process
            capabilitiesCollector.on('message', capabilities => {
                resolve(capabilities);
            });
        });
    }
}








