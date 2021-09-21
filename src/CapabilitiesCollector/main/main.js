//Load the top secret keys
//This file MUST BE KEPT OUT of the repository for security reasons.
const keys = require('./keys');
//Set the process's Google API Key.
process.env.GOOGLE_API_KEY = keys.google_api_key;

const path = require('path')
//A few imports from the electron module.
const { app, screen, ipcMain, BrowserWindow } = require('electron');

let currentCapabilities = {};

const getDisplayCapabilities = () => {
  const capabilities = {};
  //** DISPLAY ***************************************************************
  //Get the information about all the displays from the Electron's Main Process.
  //NOTE: We could probably do something similar using the "screen" object (e.g., "screen.width" and "screen.height"), "devicePixelRatio", etc.
  const displays = screen.getAllDisplays();
  //TODO: Listen to events and update the capabilities accordingly: 
  //https://www.electronjs.org/docs/api/screen#events

  //A variable that stores the current device's type.
  let deviceType = 'unknown';
  //Map the displays to the an array on the capabilities object
  capabilities.display = displays.map(d => {
    //Check if the display is internal. If the property is not available consider it internal/primary if the bounds start at (0,0). 
    //Otherwise consider it external/secondary.
    const type = d.internal || (!d.bounds.x && !d.bounds.y) ? 'internal' : 'external';
    //Get the orientation and consider it to be landscaoe if rotation mod 180 = 0. Otherwisem it's portrait.
    //TODO: Perhaps I should just change this property to a numeric value that hold 0, 90, 180 or 270.
    const orientation = d.rotation % 180 ? 'portrait' : 'landscape';
    //Get the width and height from the bounds. This is actually the virtual resolution because electron automatically applies scaling to the values.
    const virtualResolution = [d.bounds.width, d.bounds.height];
    //Get the color bit-depth.
    const bitDepth = d.colorDepth;
    //Get an estimated pixelDensity from the scaleFactor. This is probably underestimating the PPI, especially on handheld device.
    const pixelDensity = d.scaleFactor * 96;
    //The scaleFactor is our pixelRatio.
    const pixelRatio = d.scaleFactor;
    //Conver the virtualResolution to the resolution using the pixelRatio.      
    const resolution = virtualResolution.map(r => r * pixelRatio);

    //Calculate the device's diagonal resolution from the resolution.
    const diagonalResolution = Math.sqrt(Math.pow(resolution[0], 2) + Math.pow(resolution[1], 2))
    //Estimate the diagonal size of the device from the diagonalResolution and pixelDensity.
    const diagonalSize = diagonalResolution / pixelDensity;
    //Calculate the aspect ratio from the resolution width and height.
    const aspectRatio = resolution[0] / resolution[1];
    //Calculate the height from the diagonal size (convert to millimeters first) and from the aspect ratio.
    const height = (diagonalSize * 25.4) / Math.sqrt(Math.pow(aspectRatio, 2) + 1);
    //Calculate the width from the aspectRatio and height.
    const width = aspectRatio * height;
    //Save the two width and height sizes.
    const size = [width, height];

    //Infer the device type from its internal display size
    if (type === 'internal') {
      //If it's smaller than 2 inches it's probably a smartwatch.
      if (diagonalSize < 2.0) {
        deviceType = 'smartwatch';
        //If it's smaller than 7 inches it's probably a smartphone.
      } else if (diagonalSize < 7.0) {
        deviceType = 'smartphone';
        //Otherwise, it's hard to be sure.
        //I could combine screen size with input types to try to infer a more concrete device type, but I'll leave as other for now!
      } else {
        deviceType = 'other';
      }
    }

    //Return all the information regarding the display.
    return { type, size, orientation, resolution, bitDepth, pixelDensity, pixelRatio, virtualResolution }
  });
  //Store the current device's type in the capabilities object.
  capabilities.type = deviceType;

  return capabilities;
}

const updateDisplayCapabilities = () => {
  currentCapabilities = Object.assign(getDisplayCapabilities(), currentCapabilities);
  process.send(currentCapabilities);
}

function createWindow() {
  //Create the browser window.
  let win = new BrowserWindow({
    //window width
    width: 1280,
    //window height
    height: 800,
    webPreferences: {
      //Needed to get a few extra types of sensors from the Generic Sensors API.
      enableBlinkFeatures: 'SensorExtraClasses',
      preload: path.join(__dirname, "preload.js")
    },
    //Hide the window since this is supposed to be used on CLI application.
    //However, I many eventually convert the whole YanuX Desktop Client application to an Electron based desktop application.
    show: false
  });

  //Load the internal window/index.html page.
  win.loadFile('../window/index.html');
  //Wait for an asynchronous message from the window process.
  ipcMain.on('extracted-capabilities', (event, arg) => {
    currentCapabilities = Object.assign(getDisplayCapabilities(), arg);
    //The message should contain the capabilities object which can then be sent to the parent process.
    process.send(currentCapabilities);
    //We no longer need the application. Just quit!
    //app.quit();
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('extract-capabilities')
  })

  screen.on('display-added', updateDisplayCapabilities);
  screen.on('display-removed', updateDisplayCapabilities);
  screen.on('display-metrics-changed', updateDisplayCapabilities);
}

//app.allowRendererProcessReuse = true;
//Execute the createWindow function once the application is launched and ready.
app.on('ready', createWindow);

