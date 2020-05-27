//Import spawn from the child_process module.
const electron = require('electron');
const { spawn } = require('child_process');

module.exports = class CapabilitiesCollector {
    constructor() {
        //Launch the electron main process using spawn.
        /** 
         * NOTE:
         * On Windows I need to set "shell: false" for this to work. On Linux both "shell: true" and "shell: false" seem to work fine.
         * I'm keeping this note here in the eventuality that in the future I determine that "shell: true" is required on Linux.
         * This way I know that I must check back the behavior on Windows. 
         **/
        this.capabilitiesCollector = spawn(electron, ['./src/CapabilitiesCollector/main/main.js'], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'], shell: false });
    }
    collect() {
        return new Promise((resolve, reject) => {
            //Listen for IPC messages coming from the Electron process
            this.capabilitiesCollector.once('message', capabilities => {
                this.capabilitiesCollector.removeAllListeners();
                resolve(capabilities);
            });
        });
    }
    subcribe(subscriber) {
        if (this.subscriber) { this.capabilitiesCollector.off(this.subcriber) }
        this.subcriber = subscriber;
        this.capabilitiesCollector.on('message', this.subcriber);
    }
}








