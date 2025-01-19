const { app, protocol, ipcMain, ipcRenderer } = require('electron')
const store = require('electron-store');
const log = require('electron-log');
const config = new store()
const path = require('path')
const fs = require('fs')
let settings = require('./setting');
const { IncomingMessage } = require('http');

//fast log
function logs(val) {
    ipcRenderer.send("log", val)
}
//wait for (num)ms
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function b64Enc(data) {
    return Buffer.from(data).toString('base64');
}

function b64Dec(data) {
    return Buffer.from(data, 'base64').toString('utf-8');
}
// for menuTimer funcs
let menuTimerInterval
let prevTime

exports.clientTools = class {
    flag() {
        app.commandLine.appendSwitch(config.get('unlimitedFps', true) ? 'disable-frame-rate-limit' : '');
        app.commandLine.appendSwitch(config.get('disableGpuVsync', true) ? 'disable-gpu-vsync' : '');
        app.commandLine.appendSwitch(config.get('inProcess', true) ? 'in-process-gpu' : '');
        app.commandLine.appendSwitch(config.get('enableQuic', true) ? 'enable-quic' : '');
        app.commandLine.appendSwitch(config.get('enableGpuRasterization', true) ? 'enable-gpu-rasterization' : '');
        app.commandLine.appendSwitch(config.get('enablePointerLockOptions', true) ? 'enable-pointer-lock-options' : '');
        app.commandLine.appendSwitch(config.get('enableHeavyAdIntervention', true) ? 'enable-heavy-ad-intervention' : '');
        app.commandLine.appendSwitch(config.get('ignoreGpuBlocklist', true) ? 'ignore-gpu-blocklist' : '');
        app.commandLine.appendSwitch(config.get('enableZerocopy', true) ? 'enable-zero-copy' : '');
        app.commandLine.appendSwitch(config.get('webgl2Context', true) ? 'webgl2Context' : '');
        app.commandLine.appendSwitch(config.get('acceleratedCanvas', true) ? 'acceleratedCanvas' : '');
        app.commandLine.appendSwitch('use-angle', config.get('angleBackend', 'default'));
    }
}

exports.gameTools = class {
    settingMenu() {
        let prevcat = null;
        let dom = '';
        Object.values(settings).forEach((v) => {
            if (prevcat != v.cat) {
                if (prevcat !== null) {
                    dom += '</div>';
                }
                //make header
                dom += `<div class="setHed" id="setHed_${v.cat}" onclick="window.windows[0].collapseFolder(this)"><span class="material-icons plusOrMinus">keyboard_arrow_down</span> ${v.cat} ${v.restart ? '<span id="requiresRestart"><span style="color: #eb5656">*</span> requires restart</span>' : ''}</div>`
                //make body container
                dom += `<div class="setBodH" id="setBod_${v.cat}" style>`
                //make setting items
                prevcat = v.cat
            }
            switch (v.type) {
                case ("checkbox"): {
                    dom += `<div class="settName">
                        ${v.title} 
                        ${v.restart ? `<span style="color: #eb5656">*</span>` : ""}
                        <label class="switch" style="margin-left:10px">
                            <input type="checkbox" onclick="window.gt.setSetting('${v.id}', this.checked)" ${config.get(v.id, v.val) ? "checked" : ""}>
                                <span class="slider">
                                    <span class="grooves">
                                </span>
                            </span>
                        </label>
                    </div>`
                    break
                }
                case ("slider"): { }
                case ("color"): { }
                case ("select"): {
                    dom += `<div class="settName" title="${v.title}">
                        ${v.title}
                        <select onchange="window.gt.setSetting('${v.id}',this.value)" class="inputGrey2">`
                    Object.keys(v.options).forEach(keys => {
                        if (keys == config.get(v.id, v.val)) {
                            dom += `<option value="${keys}" selected>${v.options[keys]}</option>`
                        } else {
                            dom += `<option value="${keys}">${v.options[keys]}</option>`
                        }
                    });
                    dom += `</select></div>`
                    break
                }
            }
        })
        return dom + "</div>"
    };
    setSetting(e, v) {
        ipcRenderer.send("setSetting", e, v)
    };
    //Add the CSS needed to display the client's features.
    clientCss() {
        if (document.getElementById("clientCss") === null || !document.getElementById("clientCss")) {
            document.head.insertAdjacentHTML("afterbegin", `<link rel="stylesheet" href="anal://${path.join(__dirname, '../css/client.css')}">`)
        }
    };
    //add menutimer
    menuTimerF(val) {
        if (!document.getElementById("menuTimer")) {
            let dom = "<div id='menuTimer' class></div>"
            document.getElementById("instructionHolder").insertAdjacentHTML("afterbegin", dom)
        }
        if (val) {
            document.getElementById("menuTimer").classList.contains("hidden") ? document.getElementById("menuTimer").classList.toggle("hidden") : ""
            startLoop()
        } else if (!val) {
            document.getElementById("menuTimer").classList.contains("hidden") ? "" : document.getElementById("menuTimer").classList.add("hidden")
            stopLoop()
        }
        function startLoop() {
            if (!menuTimerInterval) { // only not looping
                menuTimerInterval = setInterval(() => {
                    if (window.getGameActivity) {
                        let gAct = window.getGameActivity()
                        if (gAct["time"] !== prevTime) {
                            const toMMSS = sec => {
                                const m = String(Math.floor(sec / 60)).padStart(2, '0'); //format min
                                const s = String(sec % 60).padStart(2, '0'); // format sec
                                return `${m}:${s}`;
                            };
                            let time = toMMSS(gAct["time"]);
                            document.getElementById("menuTimer") ? document.getElementById("menuTimer").innerText = time : "";
                            prevTime = gAct["time"]
                        }
                    }
                }, 100);
            }
        }
        function stopLoop() {
            prevTime = null
            if (menuTimerInterval) {
                clearInterval(menuTimerInterval);
                menuTimerInterval = null; // reset to allow restart
            }
        }
        //end of menutimer func
    };
    //Enable CSS, which is included by default
    defaultCssF = (v) => {
        // console.log(v)
        if ((document.getElementById("defaultCss") === null) || !document.getElementById("defaultCss")) {
            document.body.insertAdjacentHTML('afterbegin', `<link id="defaultCss" rel="stylesheet" href=" ">`)
        }
        // console.log(document.getElementById("defaultCss"))
        if (v) {
            document.getElementById("defaultCss").href = `anal://${path.join(__dirname, '../css/game.css')}`
            // console.log(`anal://${path.join(__dirname, '../css/game.css')}`)
        } else if (!v) {
            document.getElementById("defaultCss").href = ""
        }
    };
    // Host comp with one click
    quickCompHostF = (v) => {
        if (!document.getElementById("compHostSS")) {
            let infHolder = document.getElementById("mapInfoHld")
            let dom = `
            <div class="button small smallSS hidden" id="compHostSS" onmouseenter="playTick()" onclick="playSelect(),window.gt.hostComp('ss')">Host SS</div>
            <div class="button small smallUG hidden" id="compHostUG" onmouseenter="playTick()" onclick="playSelect(),window.gt.hostComp('ug')">Host UG</div>
            `
            infHolder.insertAdjacentHTML("afterend", dom)
        }
        if (v) {
            document.getElementById("compHostSS").classList.contains("hidden") ? document.getElementById("compHostSS").classList.remove("hidden") : "";
            document.getElementById("compHostUG").classList.contains("hidden") ? document.getElementById("compHostUG").classList.remove("hidden") : "";
        } else if (!v) {
            document.getElementById("compHostSS").classList.contains("hidden") ? "" : document.getElementById("compHostSS").classList.add("hidden");
            document.getElementById("compHostUG").classList.contains("hidden") ? "" : document.getElementById("compHostUG").classList.add("hidden");
        }
    };
    //host comp with one click function
    hostComp = (val) => {
        switch (val) {
            case "ss":
                document.getElementById("menuBtnHost").click();
                for (let v of document.getElementsByClassName("serverHostOp")) {
                    if (v.innerText === "Comp") {
                        v.click()
                        for (let c of document.getElementsByClassName("hostMap")) {
                            if (c.innerText === "Sandstorm") {
                                c.click()
                                document.getElementById("startServBtn").click()
                            }
                        }
                    }
                }
                break
            case "ug":
                document.getElementById("menuBtnHost").click();
                for (let v of document.getElementsByClassName("serverHostOp")) {
                    if (v.innerText === "Comp") {
                        v.click()
                        for (let c of document.getElementsByClassName("hostMap")) {
                            if (c.innerText === "Undergrowth") {
                                c.click()
                                document.getElementById("startServBtn").click()
                            }
                        }
                    }
                }
                break
        }
    };
    quickJoin = () => {
        try {
            let enabled = config.get("moreQuickJoin", settings.moreQuickJoin.val);
            if (enabled) {
                let chats = document.getElementById('chatList');
                if (chats.childNodes.length > 0) {
                    let lastMsgId = chats.childNodes[chats.childNodes.length - 1].id;
                    let num = lastMsgId.split("_")[1] - 0 + 1;
                    let dom = `<div data-tab="-1" id="chatMsg_${num}"><div class="chatItem"><span class="chatMsg" style="color:#df75ff">&lrm;Fetching match list...&lrm;</span></div><br></div>`;
                    chats.insertAdjacentHTML("beforeend", dom);
                } else if (chats.childNodes.length === 0) {
                    let dom = `<div data-tab="-1" id="chatMsg_0"><div class="chatItem"><span class="chatMsg" style="color:#df75ff">&lrm;Fetching match list...&lrm;</span></div><br></div>`;
                    chats.insertAdjacentHTML("beforeend", dom)
                }
                document.getElementById("chatList").scrollTo({
                    top: 100000,
                    left: 0,
                    behavior: "smooth",
                });
                async function fetchData() {
                    let list = []
                    try {
                        const url = 'https://matchmaker.krunker.io/game-list?hostname=krunker.io'; // 取得したいURL
                        const response = await fetch(url);
                        // HTTPステータスが正常かチェック
                        if (!response.ok) {
                            let dom = `<div data-tab="-1" id="chatMsg_0"><div class="chatItem"><span class="chatMsg" style="color:#f00">&lrm;HTTP err : ${response.status}&lrm;</span></div><br></div>`;
                            document.getElementById("chatList").insertAdjacentHTML("beforeend", dom);
                            await sleep(1000);
                            location.href = "https://krunker.io/"
                            throw new Error(`HTTP err : ${response.status}`);
                        }
                        // JSONデータを取得
                        const data = await response.json();
                        // データを使って何かをする
                        for (let v of data.games) {
                            let region = config.get("qjRegion", settings.qjRegion.val);
                            let mode = config.get("qjMode", settings.qjMode.val);
                            if (v[4].g === mode && v[1] === region) {
                                if (v[2] < v[3]) {
                                    if (v[2] > 0) {
                                        location.href = "https://krunker.io/?game=" + v[0];
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        let dom = `<div data-tab="-1" id="chatMsg_0"><div class="chatItem"><span class="chatMsg" style="color:#f00">&lrm;Failed to get data:: ${error}&lrm;</span></div><br></div>`;
                        document.getElementById("chatList").insertAdjacentHTML("beforeend", dom);
                        await sleep(1000);
                        location.href = "https://krunker.io/"
                    }
                }
                fetchData()
            } else if (!enabled) {
                location.href = "https://krunker.io/"
            }
        } catch (error) {
            logs(error)
        }
    };
    addAltMgr = () => {
        let inHeader = document.getElementById("signedInHeaderBar");
        let outHeader = document.getElementById("signedOutHeaderBar");
        let dom = `<div class="button buttonO" id="altManager" onmouseenter="playTick()" onclick="playSelect(),window.gt.showAltMgr()">Alt Manager</div>`
        inHeader.insertAdjacentHTML("beforeend", dom)
        outHeader.insertAdjacentHTML("beforeend", dom)
    };
    showAltMgr = () => {
        document.getElementById("windowHolder").setAttribute('style', "display: block;");
        document.getElementById("windowHolder").setAttribute('class', "popupWin");
        document.getElementById("windowHeader").textContent = "Alt Manager";
        document.getElementById("menuWindow").setAttribute("class", "dark altM")
        let accList = config.get("alts", "")
        let dom = `<div id="altH">Alt Manager</div><div id="altB">`
        if (accList !== null && accList.length > 0) {
            for (let i = 0; i < accList.length; i++) {
                dom += `<div id="altAcc" data-index="${accList[i][0]}">
                <div id="name" onclick="window.gt.loginAlt(${accList[i][0]})">${accList[i][1]}</div>
                <div id="altBtns">
                    <div id="edit" class="matList" onclick="window.gt.editAlt(this.parentNode)">edit</div>
                    <div id="remove" class="matList" onclick="window.gt.removeAlt(this.parentNode)">delete</div>
                </div>
            </div>`
            }
            dom += `
            </div>
        <div id="altF">
            <div id="logoutAcc" onclick="window.logoutAcc()">Logout</div>
            <div id="addAcc" onclick="window.gt.addAltShow()">Add account</div>
        </div>`
        } else if (accList === null || accList.length == 0 || accList[0] == null) {
            dom += `<div id="noAcc">No alt found!</div> </div>
            <div id="altF">
            <div id="logoutAcc" onclick="window.logoutAcc()">Logout</div>
            <div id="addAcc" onclick="window.gt.addAltShow()">Add account</div>
        </div>`
        }
        document.getElementById("menuWindow").innerHTML = dom
    };
    addAlt = () => {
        let nameHolder = document.getElementById('username')
        let passHolder = document.getElementById('password')
        let name = nameHolder.value;
        let pass = passHolder.value;
        let index
        let alts = config.get("alts", []);
        if (alts.length > 0) {
            index = alts[alts.length - 1][0] + 1
        } else {
            index = 1
        }
        let val = [index, name, b64Enc(pass)]
        alts.push(val)
        config.set("alts", alts)
        this.showAltMgr()
    };
    addAltShow = () => {
        let dom = `<div style="position:relative;z-index:9">
    <div id="referralHeader">Add Alt</div>
    <div style="height:20px;"></div>
    <input id="username" type="text" placeholder="Username" class="accountInput" style="margin-top:0" value="">
    <input id="password" type="password" placeholder="Password" class="accountInput">
    <div class="setBodH" style="margin-left:0px;width:calc(100% - 40px)">
        <label for="pwDisp">Show Password
            <input type="checkbox" name="pwDisp" id="pwDisp" onclick="window.gt.pwDisp(this.checked)">
        </label>
    </div>
    <div class="accBtn button buttonP"
        onclick="window.gt.addAlt()">
        Add Alt</div>
</div>`
        document.getElementById("menuWindow").innerHTML = dom
    };
    removeAlt = (v) => {
        let alts = config.get("alts")
        let index = v.parentNode.getAttribute("data-index")
        for (let arr of alts) {
            if (arr[0] == index) {
                document.getElementById('popupHolder').setAttribute("style", "z-index: 2147483645; display: block;");
                document.getElementById('genericPop').setAttribute("style", "display: block;")
                document.getElementById('genericPop').setAttribute('class', 'confPop')
                document.getElementById('genericPop').innerHTML = `
                        <div style="color: rgb(255, 255, 255); font-size: 20px; position: relative; margin-bottom: 15px;">
                            Are you sure you want to remove alt ${arr[1]} ?
                        </div><div id="confirmBtn" onclick="window.gt.removeAltConfirm(${index})">YES</div>
                        <div id="declineBtn" onclick="clearPops()">NO</div>`
            };
        }
    }
    removeAltConfirm = (index) => {
        let newAlts = []
        let newIndex = 1
        let alts = config.get('alts');
        for (let val of alts) {
            if (val[0] != index) {
                val[0] = newIndex
                newAlts.push(val)
                newIndex++;
            }
        }
        config.set('alts', newAlts)
        document.getElementById('genericPop').innerHTML = ''
        window.clearPops()
        this.showAltMgr()
    }
    editAlt = (v) => {
        let mW = document.getElementById("menuWindow");
        let index = v.parentNode.getAttribute("data-index")
        let alts = config.get("alts")
        for (let alt of alts) {
            if (alt[0] == index) {
                mW.innerHTML = `<div style="position:relative;z-index:9">
                <div id="referralHeader">Edit Alt</div>
                <div style="height:20px;"></div>
                <input id="username" type="text" placeholder="Username" class="accountInput" style="margin-top:0" value="${alt[1]}">
                <input id="password" type="password" placeholder="Password" class="accountInput" value="${b64Dec(alt[2])}">
                <div class="setBodH" style="margin-left:0px;width:calc(100% - 40px)">
                <label for="pwDisp">Show Password
                <input type="checkbox" name="pwDisp" id="pwDisp" onclick="window.gt.pwDisp(this.checked)">
                </label>
                </div>
                <div class="accBtn button buttonP" onclick="window.gt.editConf(${alt[0]})">
                    Edit alt</div>
                </div>`
            }
        }
    };
    editConf = (val) => {
        let alts = config.get("alts")
        for (let alt of alts) {
            if (alt[0] == val) {
                alt[1] = document.getElementById('username').value
                alt[2] = b64Enc(document.getElementById('password').value)
            }
        }
        config.set("alts", alts);
        this.showAltMgr()
    }
    loginAlt = (v) => {
        let alts = config.get("alts")
        for (let alt of alts) {
            if (alt[0] == v) {
                window.loginOrRegister()
                document.getElementById("accName").value = alt[1]
                document.getElementById("accPass").value = b64Dec(alt[2])
                window.loginAcc()
            }
        }
    };
    pwDisp = (v) => {
        if (v) {
            document.getElementById("password").type = "text"
        } else if (!v) {
            document.getElementById("password").type = "password"
        }
    }
}

