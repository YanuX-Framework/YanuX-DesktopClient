const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    onExtractCapabilities: fn => ipcRenderer.on('extract-capabilities', fn),
    extractedCapabilities: capabilities => ipcRenderer.send('extracted-capabilities', capabilities)
});
