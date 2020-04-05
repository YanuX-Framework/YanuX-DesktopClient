//Import spawn from the child_process module.
const electron = require('electron');
const { spawn } = require('child_process');

module.exports = class Capabilities {
    constructor() { }
    collect() {
        return new Promise((resolve, reject) => {
            //Launch the electron main process using spawn.
            /** 
             * NOTE:
             * On Windows I need to set "shell: false" for this to work. On Linux both "shell: true" and "shell: false" seem to work fine.
             * I'm keeping this note here in the eventuality that in the future I determine that "shell: true" is required on Linux.
             * This way I know that I must check back the behavior on Windows. 
             **/
            const capabilitiesCollector = spawn(electron, ['./src/Capabilities/main/main.js'], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'], shell: false });
            //Listen for IPC messages coming from the Electron process
            capabilitiesCollector.on('message', capabilities => {
                resolve(capabilities);
            });
        });
    }
}








