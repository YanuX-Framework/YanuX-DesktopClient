//Load the top secret keys
//This file MUST BE KEPT OUT of the repository for security reasons.
const keys = require('./keys');
//Set the process's Google API Key.
process.env.GOOGLE_API_KEY = keys.google_api_key;

//A few imports from the electron module.
const { app, BrowserWindow, ipcMain } = require('electron');

function createWindow () {
  //Create the browser window.
  let win = new BrowserWindow({
    //window width
    width: 1280,
    //window height
    height: 800,
    webPreferences: {
      //Enable node integration.
      nodeIntegration: true,
      //Needed to get a few extra types of sensors from the Generic Sensors API.
      enableBlinkFeatures: 'SensorExtraClasses'
    },
    //Hide the window since this is supposed to be used on CLI application.
    //However, I many eventually convert the whole YanuX Desktop Client application to an Electron based desktop application.
    show: false
  });
  //Load the internal window/index.html page.
  win.loadFile('../window/index.html');
  //Wait for an asynchronous message from the window process.
  ipcMain.on('asynchronous-message', (event, arg) => {
    //The message should contain the capabilities object.
    //Convert it to a JSON string and print in the console.
    //This output should then be read by another process to rebuild the object.
    console.log(JSON.stringify(arg));
    //We no longer need the application. Just quit!
    app.quit();
  });
}

app.allowRendererProcessReuse = true;
//Execute the createWindow function once the application is launched and ready.
app.on('ready', createWindow);