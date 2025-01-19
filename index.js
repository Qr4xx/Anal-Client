const { BrowserWindow, app, protocol, session, ipcMain, Menu, autoUpdater } = require('electron');
const path = require('path');
const Store = require('electron-store');
const config = new Store();
const log = require('electron-log');
const fetch = require('node-fetch')
const shortcut = require('electron-localshortcut')
const fs = require('fs');
const tool = require("./src/js/analTools")
anal = new tool.clientTools()
const setting = require('./src/js/setting');

let splash
let game
let social
let appVersion = app.getVersion()

// custom protocol
app.on('ready', () => {
    protocol.registerFileProtocol('anal', (request, callback) =>
        callback(decodeURI(request.url.toString().replace(/^anal:\//, '')))
    )
})
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'anal',
        privileges: {
            secure: true,
            corsEnabled: true
        }
    }
])

//splash window maker + auto update
const splashWM = () => {
    splash = new BrowserWindow({
        height: 320,
        width: 620,
        frame: false,
        alwaysOnTop: true,
        darkTheme: true,
        transparent: true,
        resizable: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, './src/js/splash.js')
        }
    })
    splash.webContents.loadFile(path.join(__dirname, './src/html/splash.html'))
    const update = async () => {
        let updateCheck = null
        autoUpdater.on('checking-for-update', () => {
            splash.webContents.send('status', 'Checking for updates...')
            updateCheck = setTimeout(() => {
                splash.webContents.send('status', 'Update check error!')
                setTimeout(() => {
                    gameWM()
                }, 1000)
            }, 15000)
        })
        autoUpdater.on('update-available', i => {
            if (updateCheck) clearTimeout(updateCheck)
            splash.webContents.send(
                'status',
                `Found new version v${i.version}!`
            )
        })
        autoUpdater.on('update-not-available', () => {
            if (updateCheck) clearTimeout(updateCheck)
            splash.webContents.send(
                'status',
                'You are using the latest version!'
            )
            setTimeout(() => {
                gameWM()
            }, 1000)
        })
        autoUpdater.on('error', e => {
            if (updateCheck) clearTimeout(updateCheck)
            splash.webContents.send('status', 'Error!' + e.name)
            setTimeout(() => {
                gameWM()
            }, 1000)
        })
        autoUpdater.on('download-progress', i => {
            if (updateCheck) clearTimeout(updateCheck)
            splash.webContents.send('status', 'Downloading new version...')
        })
        autoUpdater.on('update-downloaded', i => {
            if (updateCheck) clearTimeout(updateCheck)
            splash.webContents.send('status', 'Update downloaded')
            setTimeout(() => {
                autoUpdater.quitAndInstall()
            }, 1000)
        })
        autoUpdater.autoDownload = 'download'
        autoUpdater.allowPrerelease = false
        autoUpdater.checkForUpdates()
    }
    //run updater
    splash.webContents.on('did-finish-load', () => {
        splash.webContents.send('ver', appVersion)
        splash.show()
        update()
    })
}
//game window maker
const gameWM = () => {
    game = new BrowserWindow({
        show: false,
        height: config.get('windowH', 1080),
        width: config.get('windowW', 1920),
        fullscreen: config.get('fullscreen', true),
        webPreferences: {
            preload: path.join(__dirname, './src/js/game.js')
        }
    })
    game.webContents.loadURL("https://krunker.io")
    // game.webContents.toggleDevTools()
    game.setPosition(config.get('windowX') || 0, config.get('windowY') || 0);
    shortcut.register(game, "F11", () => {
        game.setFullScreen(!game.isFullScreen())
    })
    shortcut.register(game, "Esc", () => {
        game.webContents.send("esc");
    })
    shortcut.register(game, "F6", () => {
        game.webContents.send("quickJoin");
    })
    shortcut.register(game, "F5", () => {
        game.webContents.send("reload");
    })
    shortcut.register(game, 'F12', () => {
        game.webContents.toggleDevTools()
    })
    game.on('ready-to-show', () => {
        splash.destroy();
        game.show()
    })
    game.webContents.on('did-finish-load', () => game.webContents.send('main_did-finish-load'));
    Menu.setApplicationMenu(null)

    game.on("close", () => {
        let { x, y, width, height } = game.getBounds()
        game.isFullScreen() ? '' : config.set('windowH', height || 1080);
        game.isFullScreen() ? '' : config.set('windowW', width || 1920);
        game.isFullScreen() ? '' : config.set('windowX', x || 0);
        game.isFullScreen() ? '' : config.set('windowY', y || 0);
        config.set('fullscreen', game.isFullScreen())
        config.set('maxsize', game.isMaximized())
    })
}

//yyyy-mm-dd-hh-mm-ss
function getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

//Resource Swapper
app.on("ready", async () => {
    let swapPath = path.join(app.getPath("documents"), "./AnalSwapper")
    if (!fs.existsSync(swapPath)) {
        fs.mkdirSync(swapPath)
    }
    let urls = []
    const makeSwapList = async (prefix = "") => {
        try {
            fs.readdirSync(path.join(swapPath, prefix), { withFileTypes: true }).forEach((cPath) => {
                if (cPath.isDirectory()) {
                    makeSwapList(`${prefix}/${cPath.name}`)
                }
                else {
                    const name = `${prefix}/${cPath.name}`;
                    const isAsset = /^\/(models|textures|sound|scares)($|\/)/.test(name);
                    if (isAsset) {
                        urls.push(`*://assets.krunker.io${name}`, `*://assets.krunker.io${name}?*`);
                    } else {
                        urls.push(`*://krunker.io${name}`, `*://krunker.io${name}?*`, `*://comp.krunker.io${name}`, `*://comp.krunker.io${name}?*`);
                    }
                }
            })
        } catch (e) { }
    };
    makeSwapList()
    if (urls.length) {
        session.defaultSession.webRequest.onBeforeRequest({ urls: urls }, (details, callback) => callback({
            redirectURL: 'anal://' + path.join(swapPath, new URL(details.url).pathname),
        }));
    }
})

//Logmaker
ipcMain.on("log", (e, v) => {
    console.log(v)
    log.info(v)
});

//set configs
ipcMain.on("setSetting", (e, name, val) => {
    console.log(name, val)
    config.set(name, val)
    game.send("changeSetting", name, val)
})
//get configs
ipcMain.handle("getSetting", (e, name) => {
    return config.get(name, setting[name].val)
})

// chromium flags setting
anal.flag();

//close client
ipcMain.on("exitClient", () => {
    console.log("exit")
})

app.on('ready', () => {
    splashWM()
})
