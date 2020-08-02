"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const path = require("path");
const fs = require("fs");
let projectPath = vscode_1.workspace.rootPath;
let setPath = projectPath + "/.vscode/settings.json";
/**
 * 获取某个扩展文件相对于webview需要的一种特殊路径格式
 * 形如：vscode-resource:/Users/toonces/projects/vscode-cat-coding/media/cat.gif
 * @param context 上下文
 * @param relativePath 扩展中某个文件相对于根目录的路径，如 images/test.jpg
 */
function getExtensionFileVscodeResource(context, relativePath) {
    const diskPath = vscode_1.Uri.file(path.join(context.extensionPath, relativePath));
    return diskPath.with({ scheme: 'vscode-resource' }).toString();
}
/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context, templatePath) {
    const resourcePath = path.join(context.extensionPath, templatePath);
    const dirPath = path.dirname(resourcePath);
    let html = fs.readFileSync(resourcePath, 'utf-8');
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        return $1 + vscode_1.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
    });
    // console.log(html);
    return html;
}
function showGetContainer(context, client) {
    //测试获取容器
    const panel = vscode_1.window.createWebviewPanel('indexWebview1', // viewType
    "配置分析索引目录", // 视图标题
    vscode_1.ViewColumn.One, // 显示在编辑器的哪个部位
    {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    panel.webview.html = getWebViewContent(context, 'webview/getdocker.html');
}
exports.showGetContainer = showGetContainer;
function showIndexConfig(context, client) {
    // 创建webview
    const panel = vscode_1.window.createWebviewPanel('indexWebview', // viewType
    "配置分析索引目录", // 视图标题
    vscode_1.ViewColumn.One, // 显示在编辑器的哪个部位
    {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    panel.webview.html = getWebViewContent(context, 'webview/index.html');
    panel.webview.onDidReceiveMessage(message => {
        if (messageHandler[message.cmd]) {
            // cmd表示要执行的方法名称
            messageHandler[message.cmd](global, message);
        }
        else {
            vscode_1.window.showErrorMessage(`未找到名为 ${message.cmd} 的方法!`);
        }
    }, undefined, context.subscriptions);
    let global = { projectPath, panel };
    /**
     * 存放所有消息回调函数，根据 message.cmd 来决定调用哪个方法，
     * 想调用什么方法，就在这里写一个和cmd同名的方法实现即可
     */
    const messageHandler = {
        // 弹出提示
        alert(global, message) {
            vscode_1.window.showInformationMessage(message.info);
        },
        // 显示错误提示
        error(global, message) {
            vscode_1.window.showErrorMessage(message.info);
        },
        // 回调示例：获取工程名
        getProjectName(global, message) {
            let workspaceRoot = vscode_1.workspace.rootPath;
            invokeCallback(global.panel, message, workspaceRoot);
        },
        getDirNames(global, message) {
            let basePath = projectPath + "/" + message.path;
            let config = this.getConfig();
            let dirname = this.getTreeNode(basePath, config, 0);
            // console.log(dirname);
            invokeCallback(global.panel, message, dirname);
        },
        getConfig() {
            //获取目录名称
            let seting = {};
            if (fs.existsSync(setPath)) {
                let fd = fs.openSync(setPath, 'r');
                const buffer = Buffer.alloc(1024 * 1024 * 2);
                let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, null);
                fs.closeSync(fd);
                let filecontext = buffer.toString('utf8', 0, bytesRead);
                seting = JSON.parse(filecontext);
            }
            if (!seting['cpptips.needLoadDir']) {
                //无配置
                return [];
            }
            let needLoadDir = seting['cpptips.needLoadDir'];
            console.log(seting, needLoadDir);
            console.log(needLoadDir);
            return needLoadDir;
        },
        saveConfig(needLoadDir) {
            let seting = {};
            if (fs.existsSync(setPath)) {
                let fd = fs.openSync(setPath, 'r');
                const buffer = Buffer.alloc(1024 * 1024 * 2);
                let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, null);
                fs.closeSync(fd);
                let filecontext = buffer.toString('utf8', 0, bytesRead);
                seting = JSON.parse(filecontext);
            }
            seting['cpptips.needLoadDir'] = needLoadDir;
            //保存配置文件
            let newSetting = JSON.stringify(seting);
            console.log("newsetting:", newSetting);
            fs.writeFileSync(setPath, newSetting, { encoding: "utf8" });
        },
        checkIsInConfig(config, dirname) {
            for (let i = 0; i < config.length; i++) {
                if (config[i] == dirname) {
                    return true;
                }
            }
            return false;
        },
        getTreeNode(basePath, config, depth = 0) {
            if (depth > 2) {
                return [];
            }
            let dirf = fs.readdirSync(basePath, { 'encoding': 'utf8', 'withFileTypes': true });
            // 这个data数组中装的是当前文件夹下所有的文件名(包括文件夹)
            var that = this;
            let dirname = [];
            console.log(dirf);
            dirf.forEach(function (el, _index) {
                let fullpath = basePath + path.sep + el.name;
                if (/[.]{1,1}.*/.test(el.name) || !el.isDirectory()) {
                    //只取目录
                    return;
                }
                let check = false;
                let relativePath = fullpath.replace(projectPath + "/", "") + "/";
                // console.log("xxxx", relativePath);
                if (that.checkIsInConfig(config, relativePath)) {
                    check = true;
                }
                let node = {
                    'text': el.name,
                    'state': { "opened": false, "checked": check },
                    'children': []
                };
                // console.log("xxxx", node);
                node['children'] = that.getTreeNode(fullpath, config, depth + 1);
                dirname.push(node);
            });
            return dirname;
        },
        showTipMessage(message, titles = ["我知道了"], callback = null) {
            //发送弹窗
            let items = [];
            for (let i = 0; i < titles.length; i++) {
                let item = { title: titles[i] };
                items.push(item);
            }
            vscode_1.window.showInformationMessage(message, ...items).then((selection) => {
                if (callback != null && selection != undefined) {
                    callback(selection.title);
                }
            });
        },
        saveIndexConfig(global, message) {
            console.log(message);
            let indexConfig = message.config;
            console.log("_newIndexConfig:", indexConfig);
            this.saveConfig(indexConfig);
            console.log("save config.");
            this.showTipMessage("配置已经保存成功，请问你现在是否需要增量创建索引（索引分析不能并行，如果当前索引分析中，你可以重启来生效）！", ["重建索引", "不需要拉"], (selection) => {
                if (selection == "重建索引") {
                    //开始重建索引
                    //重新加载配置
                    client.sendNotification("reflushAllIdex", {});
                }
                console.log("close webview.");
                //关掉网页配置
                global.panel.dispose();
            });
        }
    };
    /**
     * 执行回调函数
     * @param {*} panel
     * @param {*} message
     * @param {*} resp
     */
    function invokeCallback(panel, message, resp) {
        console.log('回调消息：', resp);
        // 错误码在400-600之间的，默认弹出错误提示
        if (typeof resp == 'object' && resp.code && resp.code >= 400 && resp.code < 600) {
            vscode_1.window.showErrorMessage(resp.message || '发生未知错误！');
        }
        panel.webview.postMessage({ cmd: 'vscodeCallback', cbid: message.cbid, data: resp });
    }
}
exports.showIndexConfig = showIndexConfig;
;
//判定是否需要强制提示配置
function checkNeedShowDefault() {
    if (!fs.existsSync(setPath)) {
        return true;
    }
    return false;
}
exports.checkNeedShowDefault = checkNeedShowDefault;
//# sourceMappingURL=IndexConfig.js.map