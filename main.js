const { app, BrowserWindow, Menu, dialog } = require('electron');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static-electron');
const ffprobeStatic = require('ffprobe-static-electron');
const ProgressBar = require('electron-progressbar');

// Load ffprobe static and ffmpeg static into fluent ffmpeg passing only the path property
ffmpeg.setFfmpegPath(ffmpegStatic.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Is on MAC or no?
const isMac = process.platform === 'darwin';

// variable used to save the original file path
let originalFile = null;

let mainWindow = null;

// Create the main window containing the video, width 1000 - height 605 no resizable
app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 606,
        resizable: false,
        webPreferences: {
            preload: `${__dirname}/preload.js`
        }
    });
    mainWindow.loadURL(`file://${__dirname}/index.html`);
});


// Generate the custom menu template containing the voices:
// File -> (Video -> Load...)
//      |-> Separator _________
//      |-> Quit
// Developer -> Toggle Developer Tools
const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Video',
                submenu: [
                    {
                        label: 'Load...',
                        click() {
                            loadVideo();
                        }
                    },
                    { type: 'separator', },
                    {
                        // AVI FILE NOT SUPPORTED WITH HTML5
                        id: 'avi',
                        label: 'Convert to avi...',
                        click() {
                            convertFile('avi');
                        },
                        enabled: false
                    },
                    {
                        id: 'mp4',
                        label: 'Convert to mp4...',
                        click() {
                            convertFile('mp4');
                        },
                        enabled: false
                    },
                    {
                        id: 'webm',
                        label: 'Convert to webm...',
                        click() {
                            convertFile('webm');
                        },
                        enabled: false
                    }
                ]
            },
            {
                type: 'separator',
            },
            isMac ?
                {
                    label: 'Quit',
                    role: 'close'
                } :
                {
                    label: 'Quit',
                    role: 'quit'
                },
        ]
    },
    {
        label: 'Developer',
        submenu: [
            {
                label: 'Toggle Developer Tools',
                role: 'toggleDevTools'
            }
        ]
    }
];

// If on Mac remove add empty element at the beggining of the menu
if (isMac) {
    menuTemplate.unshift({ label: 'empty' });
}

// Add the template to the menu
const menu = Menu.buildFromTemplate(menuTemplate);
// Set the menu into the application
Menu.setApplicationMenu(menu);


function loadVideo() {
    lockMenu();
    dialog.showOpenDialog(
        {
            properties: ['openFile', 'multipleSelections'],
            filters: [
                { name: 'Media', extensions: ['mkv', 'avi', 'mp4', 'mov', 'wmv', 'flv', 'f4v', 'swf', 'webm', 'avchd'] }
            ]
        }
    ).then((result) => {
        if (!result.canceled) {
            // Result is an array - even if you have selected 1 file it will be served like [...something...]
            result.filePaths.forEach(path => {
                // Send the file to the renderer
                mainWindow.webContents.send('videoLoaded', path);

                // Save the original file path
                originalFile = path;

                // Enable menu based of file extension
                unlockMenu(path);
            });
        }
    });
}

//Unlock the menu voices based on the file extension
function unlockMenu(path) {
    if (!path.endsWith('.avi')) {
        Menu.getApplicationMenu().getMenuItemById('avi').enabled = true;
    }
    else {
        //Inform the user that AVI files are not supported in HTML 5 but the conversion still work
        dialog.showMessageBox({
            message: "AVI format not supported in HTML5.\nPlease play the video using other video players.\nNote - It is possible to load and convert AVI video.",
            type: 'warning'
        })
    }

    if (!path.endsWith('.mp4')) {
        Menu.getApplicationMenu().getMenuItemById('mp4').enabled = true;
    }

    if (!path.endsWith('.webm')) {
        Menu.getApplicationMenu().getMenuItemById('webm').enabled = true;
    }
}

// Lock the entire menu
function lockMenu() {
    Menu.getApplicationMenu().getMenuItemById('avi').enabled = false;
    Menu.getApplicationMenu().getMenuItemById('mp4').enabled = false;
    Menu.getApplicationMenu().getMenuItemById('webm').enabled = false;
}

// Method that converts the video in the given extension
function convertFile(extension) {
    dialog.showSaveDialog({
        properties: ['openFile', 'multipleSelections'],
        filters: [
            { name: 'Media', extensions: [extension] }
        ]
    }).then((result) => {
        if (!result.canceled) {

            // Creating the custom ProgressBar... standard Progressbar can't be closed bu the user
            var progressBar = new ProgressBar({
                indeterminate: false,
                text: 'Video conversion in progress...',
                detail: '0% complete',
                title: 'Conversion in progress...',
                abortOnError: false,
                browserWindow: {
                    parent: mainWindow, //set the parent
                    modal: true,
                    resizable: false,
                    closable: true, // make it closable
                    minimizable: false,
                    maximizable: false,
                    width: 500,
                    height: 170
                }
            });

            //Starting the conversion - saved into a variable because need to kill the process in case the user cancel the conversion
            let command = ffmpeg(originalFile)
                .withOutputFormat(extension)

                .on("progress", (stdout, stderr) => {  // on PROGRESS update the ProgressBar
                    console.log(stdout); // Print progress in console
                    if (!progressBar.isCompleted()) {
                        progressBar.value = Math.round(stdout.percent);
                    }
                    // PROGRESS BAR STATUS
                    progressBar.on('completed', () => {
                        progressBar.detail = 'Conversion completed. Exiting...';
                    }).on('aborted', (value) => { // If user close PROGRESS BAR it will abort and kill the ffmpeg process
                        console.info(`aborted... ${value}`);
                        command.kill(); // Kill ffmpeg
                    }).on('progress', (value) => { // On PROGRESS update the percentage value of the progressbar
                        progressBar.detail = `${value}% completed`;
                    });
                }).on("end", (stdout, stderr) => {  // on END show message and ask if the user wants to load the new video
                    progressBar.close();
                    const response = dialog.showMessageBox({
                        message: `Conversion to ${extension} format completed.\nDo you want to load the converted video?`,
                        type: 'info',
                        buttons: ["Yes", "No"],
                    }).then(response => {
                        if (response.response === 0) { // 0 = buttons[0] = Yes - 1 = buttons[1] = No
                            lockMenu();
                            mainWindow.webContents.send('videoLoaded', result.filePath); // Send to renderer the new file to be loaded
                            unlockMenu(result.filePath);
                        }
                    });
                }).on("error", (err) => { // This will cath the error when the ffmpeg is killed aka closed by the user
                    console.log("an error happened: " + err.message);
                    dialog.showMessageBox({
                        message: `The conversion has been cancelled.`,
                        type: 'info'
                    })
                }).on("close", () => {
                    console.log("closed");
                }).saveToFile(result.filePath); // Save the file
        }
    });
}