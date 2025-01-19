const { app, ipcRenderer, protocol, ipcMain } = require('electron')
const path = require("path")
const analTools = require("./analTools")
const tool = new analTools.gameTools()
const Store = require("electron-store")
const setting = require('./setting')
const config = new Store()

//set client setting tab
const regionOptionsRegex = new RegExp('s*<option value=.*(de-fra).*(us-ca-sv).*</option>', 'gu');
function patchSetting() {
    //Create a function for the part that displays the settings when the client tab is clicked.
    // I made this while doing my own research, so as a reminder, I will summarize it while using comment-outs as much as possible.
    function hookSetting() {
        const settingsWindow = window.windows[0];
        let selectedTab = settingsWindow.tabIndex;
        //Check to see if the client tab has been opened.
        // Return value is true/false
        function isCTab() {
            const allTabCount = settingsWindow.tabs[settingsWindow.settingType].length - 1;
            return selectedTab === allTabCount
        }
        //Gets the name of the configuration.
        // Prevents the client tab from being opened twice if it is clicked again when the client tab is already displayed.
        safeRenderSettings = () => {
            const settHolder = document.getElementById('settHolder');
            if (!isCTab() && settHolder !== null) {
                settHolder.classList.remove('anal-settings');
            }
            if (isCTab()) {
                renderSettings();
            }
        }
        const showWindowHook = window.showWindow.bind(window);
        const getSettingsHook = settingsWindow.getSettings.bind(settingsWindow);
        const changeTabHook = settingsWindow.changeTab.bind(settingsWindow);

        window.showWindow = function (...args) {
            const result = showWindowHook.apply(null, args);
            if (args[0] === 1) {
                if (settingsWindow.settingType === 'basic') {
                    settingsWindow.toggleType({ checked: true });
                }
                const advSliderElem = document.querySelector('.advancedSwitch input#typeBtn');
                advSliderElem.disabled = true;
                advSliderElem.nextElementSibling.setAttribute('title', 'Crankshaft auto-enables advanced settings mode');
                if (isCTab()) {
                    renderSettings();
                }
            }
            return result;
        };
        // whenever we change tabs, if it's client tab, run renderSettings, otherwise remove our class
        settingsWindow.changeTab = function (...args) {
            const result = changeTabHook.apply(null, args);
            selectedTab = settingsWindow.tabIndex;
            safeRenderSettings();
            return result;
        };
        //func getSettings
        //... is spread operator
        settingsWindow.getSettings = function (...args) {
            const result = getSettingsHook.apply(null, args);
            if (result.includes('window.setSetting("defaultRegion"') && result.match(regionOptionsRegex).length > 0) {
                const optionsHTML = result.match(regionOptionsRegex)[0];
                const tempElement = document.createElement('div');
                tempElement.innerHTML = optionsHTML;
                const optionElements = Array.from(tempElement.children);
                const tempHolder = document.createElement('div');
                optionElements.forEach(opt => tempHolder.appendChild(opt));
                const patchedHTML = tempHolder.innerHTML;
                return result.replace(optionsHTML, patchedHTML);
            }
            return result;
        };
        safeRenderSettings();
    };
    hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    function waitForWindow0() {
        if (
            hasOwn(window, 'showWindow')
            && typeof window.showWindow === 'function'
            && hasOwn(window, 'windows')
            && Array.isArray(window.windows)
            && window.windows.length >= 0
            && typeof window.windows[0] !== 'undefined'
            && typeof window.windows[0].changeTab === 'function'
        ) {
            clearInterval(interval);
            hookSetting();
        }
    }
    interval = setInterval(waitForWindow0, 10);
    //render client setting tab
    async function renderSettings() {
        document.getElementById("settHolder").innerHTML = await tool.settingMenu()
    }
}
ipcRenderer.on('main_did-finish-load', (event, _userPrefs) => {
    patchSetting()
})
//onload eval
document.addEventListener('DOMContentLoaded', () => {
    getSettings()
    // tool.test()
    tool.clientCss()
    tool.addAltMgr()
    window.closeClient = () => {
        ipcRenderer.send('exitClient');
    };
    window.gt = tool
});

// Checks if the renderer needs to switch the display when the settings are changed
ipcRenderer.on("changeSetting", (e, n, v) => {
    switch (n) {
        case "menuTimer":
            tool.menuTimerF(v)
            break
        case "quickCompHost":
            tool.quickCompHostF(v)
            break;
        case "defaultCss":
            tool.defaultCssF(v)
            break;
    }
})

ipcRenderer.on("reload", () => {
    location.reload()
})
//Calls up settings for items that should be displayed on the renderer's side
let getSettings = async () => {
    let menuTimer = await ipcRenderer.invoke("getSetting", "menuTimer");
    tool.menuTimerF(menuTimer)
    let quickCompHost = await ipcRenderer.invoke("getSetting", "quickCompHost");
    tool.quickCompHostF(quickCompHost)
    let defaultCss = await ipcRenderer.invoke("getSetting", "defaultCss");
    tool.defaultCssF(defaultCss)
}

ipcRenderer.on("quickJoin", () => {
    tool.quickJoin()
})
ipcRenderer.on("esc", () => {
    document.exitPointerLock()
})

//rpc
document.addEventListener("DOMContentLoaded", () => {
    setInterval(function () {
        let val = window.getGameActivity()
        console.log(val)
        ipcRenderer.send("rpc", val.map, val.mode, val.time, config.get("discordRpc", setting.discordRpc.val))
    }, 5000);

})
