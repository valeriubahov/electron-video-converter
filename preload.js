const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
    'vapi',
    {
        onVideoLoaded: function (func) {
            ipcRenderer.on('videoLoaded', (event, fileData) => func(fileData));
        }
    }
)