"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkNeedShowDefault = exports.showIndexConfig = void 0;
const vscode_1 = require("vscode");
const path = require("path");
const fs = require("fs");
const log4js_1 = require("log4js");
const logger = log4js_1.getLogger("cpptips");
var cookite = "";
let projectPath = vscode_1.workspace.rootPath;
let setPath = projectPath + "/.vscode/settings.json";
let dbpath = projectPath + "/.vscode/db/cpptips.db";
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
    // logger.debug(html);
    return html;
}
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
            let linkconfig = this.getLinkDir();
            let dirname = this.getTreeNode(basePath, config, linkconfig, 0);
            invokeCallback(global.panel, message, dirname['list']);
        },
        ignoreFileAndDir(global, message) {
            let configuration = vscode_1.workspace.getConfiguration();
            let config = configuration["cpptips"];
            logger.debug(config);
            invokeCallback(global.panel, message, config['ignoreFileAndDir']);
        },
        addIgnoreRegx(global, message) {
            let configuration = vscode_1.workspace.getConfiguration();
            let config = configuration["cpptips"];
            config['ignoreFileAndDir'].push(message.path);
            logger.debug(config);
            if (vscode_1.workspace.getConfiguration().update('cpptips.ignoreFileAndDir', config['ignoreFileAndDir'], vscode_1.ConfigurationTarget.Workspace)) {
                invokeCallback(global.panel, message, "success");
            }
            else {
                invokeCallback(global.panel, message, "faild");
            }
        },
        removeIgnoreRegx(global, message) {
            let configuration = vscode_1.workspace.getConfiguration();
            let config = configuration["cpptips"]['ignoreFileAndDir'];
            let newConfig = [];
            for (let i = 0; i < config.length; i++) {
                if (config[i] != message.path) {
                    newConfig.push(config[i]);
                }
            }
            logger.debug(config);
            if (vscode_1.workspace.getConfiguration().update('cpptips.ignoreFileAndDir', newConfig, vscode_1.ConfigurationTarget.Workspace)) {
                invokeCallback(global.panel, message, "success");
            }
            else {
                invokeCallback(global.panel, message, "faild");
            }
        },
        getConfig() {
            //获取目录名称
            let configuration = vscode_1.workspace.getConfiguration();
            let needLoadDir = configuration['cpptips']['needLoadDir'];
            logger.debug("needLoadDir:", needLoadDir);
            return needLoadDir;
        },
        getLinkDir() {
            //cpptips.needLoadLinkDir
            let configuration = vscode_1.workspace.getConfiguration();
            let needLoadDir = configuration['cpptips']['needLoadLinkDir'];
            logger.debug("needLoadLinkDir:", needLoadDir);
            return needLoadDir;
        },
        saveConfig(needLoadDir) {
            vscode_1.workspace.getConfiguration().update('cpptips.needLoadDir', needLoadDir, vscode_1.ConfigurationTarget.Workspace);
        },
        checkIsInConfig(config, dirname) {
            //console.log(config);
            if (config.length <= 0) {
                //如果没有配置，则默认全部配置
                //让用户作减法
                return true;
            }
            for (let i = 0; i < config.length; i++) {
                if (config[i] == dirname) {
                    return true;
                }
            }
            return false;
        },
        getTreeNode(basePath, config, linkconfig, depth = 0) {
            if (depth > 64) {
                return { 'total': 0, 'list': [] };
            }
            let dirf = fs.readdirSync(basePath, { 'encoding': 'utf8', 'withFileTypes': true });
            // 这个data数组中装的是当前文件夹下所有的文件名(包括文件夹)
            var that = this;
            let dirname = [];
            //logger.debug(dirf);
            let child_count = 0;
            dirf.forEach(function (el, _index) {
                if (el.isFile && /(\.cpp$)|(\.h$)|(\.hpp$)|(\.proto$)/.test(el.name)) {
                    //文件才累加
                    child_count++;
                }
                let fullpath = basePath + path.sep + el.name;
                if (/[.]{1,1}.*/.test(el.name)
                    || el.isFile()
                    || el.isSocket()
                    || el.isFIFO()
                    || el.isCharacterDevice()
                    || el.isBlockDevice()) {
                    //只取目录
                    return;
                }
                if (el.isSymbolicLink()) {
                    logger.debug("isSymbolicLink:", fullpath);
                    let statinfo = null;
                    try {
                        statinfo = fs.statSync(fullpath);
                    }
                    catch (error) {
                        logger.debug("catch(error):", fullpath);
                        return;
                    }
                    if (statinfo && !statinfo.isDirectory()) {
                        logger.debug("isDirectory:", fullpath);
                        return;
                    }
                    let _relativePath = fullpath.replace(projectPath + "/", "") + "/";
                    if (linkconfig.length <= 0
                        || !that.checkIsInConfig(linkconfig, _relativePath)) {
                        //没有配置的连接
                        logger.debug("checkIsInConfig", _relativePath);
                        return;
                    }
                }
                let check = false;
                let relativePath = fullpath.replace(projectPath + "/", "") + "/";
                if (that.checkIsInConfig(config, relativePath)) {
                    check = true;
                }
                let node = {
                    'text': el.name,
                    'data': "",
                    'state': { "opened": false, "checked": check },
                    'children': []
                };
                let _data = that.getTreeNode(fullpath, config, linkconfig, depth + 1);
                child_count += _data['total'];
                if (depth < 3) {
                    //只展示3层目录
                    node['children'] = _data['list'];
                    node['data'] = _data['total'].toString();
                    dirname.push(node);
                }
            });
            return { 'total': child_count, 'list': dirname };
            ;
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
            logger.debug(message);
            let indexConfig = message.config;
            logger.debug("_newIndexConfig:", indexConfig);
            this.saveConfig(indexConfig);
            logger.debug("save config.");
            this.showTipMessage("配置已经保存成功，请问你现在是否需要增量创建索引（索引分析不能并行，如果当前索引分析中，你可以重启来生效）！", ["重建索引", "不需要拉"], (selection) => {
                if (selection == "重建索引") {
                    //开始重建索引
                    //重新加载配置
                    client.sendNotification("reflushAllIdex", {});
                }
                logger.debug("close webview.");
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
        logger.debug('回调消息：', resp);
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
    if (!fs.existsSync(setPath)
        || !fs.existsSync(dbpath)) {
        return true;
    }
    return false;
}
exports.checkNeedShowDefault = checkNeedShowDefault;
//# sourceMappingURL=IndexConfig.js.map