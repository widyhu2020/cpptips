"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
const log4js_1 = require("log4js");
let projectPath = vscode_1.workspace.rootPath;
let cookiepath = projectPath + "/.vscode/cookie.data";
let jsPath = projectPath + "/.vscode/build.js";
const logger = log4js_1.getLogger("cpptips");
function runBuild(path, command) {
    let taskName = "提交编译";
    let kind = {
        type: 'build',
        task: taskName
    };
    let source = "build";
    let execution = new vscode_1.ShellExecution(`cd ${path} && ${command}`, null);
    let task = new vscode_1.Task(kind, taskName, source);
    task.group = vscode_1.TaskGroup.Build;
    task.execution = execution;
    task.problemMatchers = [
        "$cpp_gcc",
        "$cpp_build"
    ];
    vscode_1.tasks.executeTask(task);
}
function reflushErrorMsg(errorMsg) {
    let taskName = "提交编译";
    let kind = {
        type: 'build',
        task: taskName
    };
    let source = "reflush_build";
    let execution = new vscode_1.ProcessExecution(`sleep 1 && echo "${errorMsg}"`, null);
    let task = new vscode_1.Task(kind, taskName, source);
    task.group = vscode_1.TaskGroup.Build;
    task.execution = execution;
    task.isBackground = true;
    task.problemMatchers = [
        "$cpp_gcc",
        "$cpp_build"
    ];
    vscode_1.tasks.executeTask(task);
}
exports.reflushErrorMsg = reflushErrorMsg;
function isExitsFunction(funcName) {
    try {
        if (typeof (eval(funcName)) == "function") {
            return true;
        }
    }
    catch (e) { }
    return false;
}
function reTryBuild(context, isCommd) {
    if (isCommd) {
        build(context);
        return;
    }
    vscode_1.window.showErrorMessage("提交编译发送未知错误，因为发现了循环反复提交编译");
}
function execute(cmd, callback) {
    var exec = require('child_process').exec;
    exec(cmd, function (error, stdout, stderr) {
        if (error) {
            console.error(error);
            callback(500, "");
        }
        else {
            callback(200, stdout);
        }
    });
}
function GetBuildCmd(context, isCommd = true) {
    let hander = {
        ShowH5Page(html, proHander) {
            const dirPath = path.join(context.extensionPath, "webview");
            // const dirPath = path.dirname(resourcePath);
            logger.debug(dirPath);
            html = html.replace(/(<link.+?href="|<script.+?src=")(.+?)"/g, (m, $1, $2) => {
                return $1 + vscode_1.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
            });
            // 创建webview
            const panel = vscode_1.window.createWebviewPanel('indexWebview', // viewType
            "配置分析索引目录", // 视图标题
            vscode_1.ViewColumn.One, // 显示在编辑器的哪个部位
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            });
            let global = { projectPath, panel };
            panel.webview.html = html;
            panel.webview.onDidReceiveMessage(message => {
                if (proHander[message.cmd]) {
                    // cmd表示要执行的方法名称
                    proHander[message.cmd](global, message);
                }
                else {
                    vscode_1.window.showErrorMessage(`未找到名为 ${message.cmd} 的方法!`);
                }
            }, undefined, context.subscriptions);
            panel.onDidChangeViewState(message => {
                if (!panel.visible) {
                    //关闭
                    panel.dispose();
                }
            });
            panel.onDidDispose(e => {
                logger.debug("close webview!");
                // timerHander
            });
            return panel;
        },
        DownloadImg(url, callback) {
            let tmpImgPath = vscode_1.workspace.rootPath + '/.vscode/.tmpimg.png';
            var request = require("request");
            const buf = Buffer.alloc(65535);
            var writeStream = fs.createWriteStream(tmpImgPath);
            var readStream = request(url);
            readStream.pipe(writeStream);
            readStream.on('end', function () {
                logger.debug('文件下载成功');
            });
            readStream.on('error', function (err) {
                logger.debug("错误信息:" + err);
                callback(-1, "");
            });
            writeStream.on("finish", function () {
                logger.debug("文件写入成功");
                writeStream.end();
                let imgData = fs.readFileSync(tmpImgPath);
                callback(0, imgData);
            });
        },
        SetCookie(inCookie, url) {
            let bpos = url.indexOf("://");
            let epos = url.indexOf("/", bpos + 3);
            let domain = url.substring(bpos + 3, epos);
            let strCookies = "{}";
            if (fs.existsSync(cookiepath)) {
                strCookies = fs.readFileSync(cookiepath, { encoding: "utf8" });
            }
            let cookies = JSON.parse(strCookies);
            inCookie.forEach(el => {
                let cookieKV = {};
                let hasDomain = 0;
                let items = el.split(/[;]{1,1}/);
                for (let i = 0; i < items.length; i++) {
                    let kv = items[i].trim().split(/[=]{1,1}/);
                    if (kv.length != 2) {
                        continue;
                    }
                    let key = kv[0].trim();
                    let value = kv[1].trim();
                    if (key != "expires" && key != "domain" && key != "path") {
                        cookieKV[key] = value;
                    }
                    if (key == "domain") {
                        hasDomain = 1;
                        if (!cookies[value]) {
                            cookies[value] = {};
                        }
                        Object.keys(cookieKV).forEach(_k => {
                            cookies[value][_k] = cookieKV[_k];
                        });
                    }
                }
                if (hasDomain == 0) {
                    //如果不带域名
                    if (!cookies[domain]) {
                        cookies[domain] = {};
                    }
                    Object.keys(cookieKV).forEach(_k => {
                        cookies[domain][_k] = cookieKV[_k];
                    });
                }
            });
            strCookies = JSON.stringify(cookies);
            fs.writeFileSync(cookiepath, strCookies, { encoding: "utf8" });
        },
        GetCookie(url) {
            let bpos = url.indexOf("://");
            let epos = url.indexOf("/", bpos + 3);
            let domain = url.substring(bpos + 3, epos);
            let strCookies = "{}";
            if (fs.existsSync(cookiepath)) {
                strCookies = fs.readFileSync(cookiepath, { encoding: "utf8" });
            }
            let cookies = JSON.parse(strCookies);
            let item = domain.split(/[.]{1,1}/);
            let useCookie = "";
            let _domain = "";
            for (let i = item.length - 1; i >= 0; i--) {
                let _TMP_domain_ = item[i] + _domain;
                if (cookies[_TMP_domain_]) {
                    Object.keys(cookies[_TMP_domain_]).forEach(_k => {
                        let kv = _k + "=" + cookies[_TMP_domain_][_k];
                        useCookie = (useCookie == "") ? kv : (useCookie + ";" + kv);
                    });
                }
                _domain = "." + item[i] + _domain;
                if (cookies[_domain]) {
                    Object.keys(cookies[_domain]).forEach(_k => {
                        let kv = _k + "=" + cookies[_domain][_k];
                        useCookie = (useCookie == "") ? kv : (useCookie + ";" + kv);
                    });
                }
            }
            return useCookie;
        },
        GetContext(filename, lifetime = 3600) {
            filename = filename.replace("../", "");
            let _path = projectPath + "/.vscode/" + filename;
            if (!fs.existsSync(_path)) {
                //文件不存在
                return "";
            }
            var timestamp = new Date().getTime();
            let fstat = fs.lstatSync(_path);
            if ((fstat.mtime.getTime() + lifetime * 1000) < timestamp) {
                //过期拉
                console.log("pass time");
                return "";
            }
            let context = fs.readFileSync(_path, { encoding: "utf8" });
            return context;
        },
        SetContext(filename, context) {
            filename = filename.replace("../", "");
            let _path = projectPath + "/.vscode/" + filename;
            return fs.writeFileSync(_path, context, { encoding: "utf8" });
        },
        GetHtml(url, successfunction, count = 0) {
            logger.debug(url);
            try {
                //这个域名比较奇葩，无法使用http读取
                //操作系统必须是mac或者linux
                let systemname = process.platform;
                if ((systemname == "linux" || systemname == "darwin")
                    && /^.*docker.wxpaytest.oa.com.*/.test(url)) {
                    execute("curl " + url, successfunction);
                    return;
                }
                // 参数url和回调函数
                let options = {
                    headers: {
                        'Cookie': hander.GetCookie(url)
                    }
                };
                logger.debug(JSON.stringify(options));
                var http = require('http');
                var request = http.get(url, options, function (res) {
                    logger.debug(res['req']);
                    logger.debug(res.headers);
                    logger.debug(res.statusCode);
                    if (res.headers && res.headers['set-cookie']) {
                        let data = res.headers['set-cookie'];
                        hander.SetCookie(data, url);
                    }
                    if (res.statusCode == 302 && count < 10) {
                        //最多调整10次
                        let headers = res.headers;
                        logger.debug(JSON.stringify(headers));
                        let _url = headers["location"];
                        logger.debug("302:" + _url);
                        if (_url.indexOf("http", 0) !== 0) {
                            let _pos_url = url.indexOf("/", 9);
                            let domin = url.substring(0, _pos_url);
                            _url = domin + _url;
                        }
                        return hander.GetHtml(_url, successfunction, count + 1);
                    }
                    if (res.statusCode != 200) {
                        //http请求出错，返回不是200
                        logger.debug("this http status not 200" + count);
                        successfunction(res.statusCode, "");
                        return false;
                    }
                    res.setEncoding('utf8');
                    var html = '';
                    // 绑定data事件 回调函数 累加html片段
                    res.on('data', function (data) {
                        html += data.toString();
                        logger.debug(html);
                    });
                    //拉取完毕
                    res.on('end', function () {
                        successfunction(res.statusCode, html);
                    });
                }).on('error', function (e) {
                    logger.debug('获取数据错误', e);
                    successfunction(500, "");
                    return false;
                });
                request.setTimeout(10000, function () {
                    logger.debug('请求超时');
                    successfunction(500, "");
                    return false;
                });
                request.end();
            }
            catch (error) {
                logger.debug(JSON.stringify(error) + url);
                successfunction(500, "");
            }
        },
        CallBack(retcode, cmds, buildpath, message = {}) {
            if (retcode == 0) {
                let cmd = cmds;
                if (Object.keys(cmds).length > 1) {
                    let selectItem = [];
                    Object.keys(cmds).forEach(el => {
                        let _item = {
                            label: el,
                            description: "",
                            detail: cmds[el]
                        };
                        selectItem.push(_item);
                    });
                    vscode_1.window.showQuickPick(
                    // 这个对象中所有参数都是可选参数
                    selectItem, {
                        canPickMany: false,
                        ignoreFocusOut: true,
                        matchOnDescription: true,
                        matchOnDetail: true,
                        placeHolder: '请选择编译指令，按esc健取消！'
                    }).then(function (msg) {
                        if (!msg) {
                            return;
                        }
                        if (msg.label.indexOf("指定目录") == -1) {
                            cmd = msg.detail;
                            logger.debug("cmd:" + cmd + " ;buildpath:" + buildpath);
                            runBuild(buildpath, cmd);
                            return;
                        }
                        vscode_1.window.showInputBox({
                            password: false,
                            ignoreFocusOut: true,
                            placeHolder: '../../ ../comm/',
                            prompt: '输入你需要额外指定的路径，指定多个路径时使用空格分隔！',
                        }).then(function (inputMsg) {
                            if (!inputMsg) {
                                return;
                            }
                            cmd = msg.detail + " " + inputMsg;
                            logger.debug("cmd:" + cmd + " ;buildpath:" + buildpath);
                            runBuild(buildpath, cmd);
                            return;
                        });
                    });
                    return;
                }
                else if (Object.keys(cmds).length == 1) {
                    //只有1个，不进行提示
                    cmd = cmds[Object.keys(cmds)[0]];
                }
                logger.debug("cmd:" + cmd + " ;buildpath:" + buildpath);
                runBuild(buildpath, cmd);
            }
            else {
                let items = [];
                if (message['button']) {
                    items.push({ title: message['button'] });
                }
                let showText = "提交编译遇到未知问题，编译无法继续！";
                if (message['showText']) {
                    showText = message['showText'];
                }
                items.push({ title: "使用默认配置编译" });
                vscode_1.window.showErrorMessage("提交编译失败：" + showText, ...items).then((selection) => {
                    if (selection != undefined
                        && message['button']
                        && selection.title == message['button']) {
                        if (message["selectCallback"]) {
                            //回调
                            message["selectCallback"](undefined);
                            return;
                        }
                        if (!message["url"]) {
                            vscode_1.window.showTextDocument(vscode_1.Uri.file(jsPath));
                            return;
                        }
                        const open = require('open');
                        open(message["url"]).catch(_ => { });
                    }
                    else if (selection != undefined
                        && selection.title == "使用默认配置编译") {
                        reTryBuild(context, isCommd);
                    }
                });
            }
        }
    };
    let filepath = vscode_1.window.activeTextEditor.document.fileName;
    logger.debug("form command! filepath:" + filepath);
    let pathinfo = path.parse(filepath);
    let dirname = pathinfo.dir;
    while (true) {
        if (!fs.existsSync(dirname + "/BUILD")
            && !fs.existsSync(dirname + "/makefile")) {
            //查找编译文件
            let _pathinfo = path.parse(dirname);
            dirname = _pathinfo.dir;
            if (dirname == "" || dirname == "/") {
                break;
            }
            logger.debug("try find build:" + dirname);
            continue;
        }
        logger.debug("find build:" + dirname);
        if (fs.existsSync(dirname + "/BUILD")
            || fs.existsSync(dirname + "/makefile")) {
            if (!isExitsFunction('GetBuildCommands')) {
                if (!fs.existsSync(jsPath)) {
                    //未配置编译环境
                    let _items = [];
                    _items.push({ title: '去配置编译脚本' });
                    _items.push({ title: '继续使用默认配置' });
                    vscode_1.window.showErrorMessage("你还未配置编译脚本，默认编译为makefile，你可以自定义编译脚本满足个性话需求，该提示每次重启vscode只提醒一次！", ..._items).then((selection) => {
                        let config = vscode_1.workspace.getConfiguration();
                        logger.debug("config:", config);
                        if (!config
                            || !config['cpptips']
                            || !config['cpptips']['defaultbuildscript']) {
                            logger.debug("not find default build script!");
                            return;
                        }
                        if (selection
                            && selection.title == "去配置编译脚本") {
                            let extensionPath = context.extensionPath;
                            let _helpfile = extensionPath + "/webview/buildHelp.txt";
                            fs.copyFileSync(_helpfile, jsPath);
                            vscode_1.window.showTextDocument(vscode_1.Uri.file(jsPath));
                            return;
                        }
                        let jsText = config['cpptips']['defaultbuildscript'];
                        const vm = require('vm');
                        let script = new vm.Script(jsText);
                        global["hander"] = hander;
                        global["buildPath"] = dirname;
                        script.runInThisContext();
                        eval("GetBuildCommands")(hander, dirname, isCommd);
                    });
                    break;
                }
                else {
                    logger.debug("init script.");
                    let jsText = fs.readFileSync(jsPath, { "encoding": "utf8" });
                    const vm = require('vm');
                    let script = new vm.Script(jsText);
                    global["hander"] = hander;
                    global["buildPath"] = dirname;
                    script.runInThisContext();
                }
            }
            eval("GetBuildCommands")(hander, dirname, isCommd);
            break;
        }
    }
}
exports.GetBuildCmd = GetBuildCmd;
;
function build(context) {
    GetBuildCmd(context, false);
}
exports.build = build;
//# sourceMappingURL=buildProcess.js.map