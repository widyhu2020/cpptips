"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const IndexConfig_1 = require("./IndexConfig");
const menuProcess_1 = require("./menuProcess");
const notifyProcess_1 = require("./notifyProcess");
let client;
const os = require("os");
const log4js_1 = require("log4js");
const buildProcess_1 = require("./buildProcess");
const unzipper = require("unzipper");
function getLoggerPath() {
    let logpath = "/tmp/cpptips.client.log";
    if (os.platform() == "win32") {
        //windows
        if (!fs.existsSync("c:\\cpplog")) {
            fs.mkdirSync("c:\\cpplog");
        }
        logpath = "c:\\cpplog\\cpptips.client.log";
    }
    return logpath;
}
log4js_1.configure({
    appenders: {
        cpptips: {
            type: "dateFile",
            keepFileExt: true,
            filename: getLoggerPath(),
            daysToKeep: 3,
            pattern: '.yyyy-MM-dd'
        }
    },
    categories: {
        default: { appenders: ["cpptips"], level: "debug" }
    }
});
const logger = log4js_1.getLogger("cpptips");
logger.level = "debug";
function initBetterSqlite3(context) {
    let systemname = process.platform;
    let user_better_sqlite3 = "";
    let user_integer = "";
    if (systemname == "linux") {
        user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'better_sqlite3.node'));
        user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'integer.node'));
    }
    else if (systemname == "darwin") {
        user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'better_sqlite3.node'));
        user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'integer.node'));
    }
    else if (systemname == "win32") {
        if (process.arch == "ia32" || process.arch == "x86") {
            user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'better_sqlite3.node'));
            user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'integer.node'));
        }
        else {
            user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'better_sqlite3.node'));
            user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'integer.node'));
        }
    }
    let better_sqlite3 = context.asAbsolutePath(path.join('node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));
    let integer = context.asAbsolutePath(path.join('node_modules', 'integer', 'build', 'Release', 'integer.node'));
    if (fs.existsSync(user_better_sqlite3)) {
        fs.copyFileSync(user_better_sqlite3, better_sqlite3);
    }
    if (fs.existsSync(user_integer)) {
        fs.copyFileSync(user_integer, integer);
    }
}
function initNodeBinary(context, callback) {
    var e_1, _a;
    return __awaiter(this, void 0, void 0, function* () {
        let systemname = process.platform;
        let binPath = "";
        if (systemname == "linux") {
            binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'node'));
        }
        else if (systemname == "darwin") {
            binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'node'));
        }
        else if (systemname == "win32") {
            console.log(process.arch);
            if (process.arch == "ia32" || process.arch == "x86") {
                binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'node.exe'));
            }
            else {
                binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'node.exe'));
            }
        }
        else {
            console.error("该平台目前可能不兼容！");
            return "node";
        }
        console.log(binPath);
        if (!fs.existsSync(binPath)) {
            //解压文件
            let zipfile = context.asAbsolutePath(path.join('bin', 'node-v12.16.1.zip'));
            let zip = fs.createReadStream(zipfile).pipe(unzipper.Parse({ forceStream: true }));
            console.log(zip);
            try {
                for (var zip_1 = __asyncValues(zip), zip_1_1; zip_1_1 = yield zip_1.next(), !zip_1_1.done;) {
                    const entry = zip_1_1.value;
                    console.log(entry);
                    let fileName = entry.path;
                    let type = entry.type; // 'Directory' or 'File'
                    let unzipPath = context.asAbsolutePath(path.join('bin', fileName));
                    if (type == 'Directory') {
                        if (!fs.existsSync(unzipPath)) {
                            fs.mkdirSync(unzipPath);
                        }
                    }
                    else {
                        entry.pipe(fs.createWriteStream(unzipPath));
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (zip_1_1 && !zip_1_1.done && (_a = zip_1.return)) yield _a.call(zip_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            //调整目录权限
            fs.chmodSync(binPath, fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IROTH | fs.constants.S_IWOTH);
        }
        //初始化原生库
        initBetterSqlite3(context);
        return binPath;
    });
}
function activate(context) {
    initNodeBinary(context, bizActivate).then((_binPath) => {
        bizActivate(context, _binPath);
    });
}
exports.activate = activate;
function bizActivate(context, binPath) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions = {
        run: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.pipe,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath],
            runtime: binPath
        },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.pipe,
            options: debugOptions,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath],
        }
    };
    let fileWatcher = [];
    fileWatcher.push(vscode_1.workspace.createFileSystemWatcher('**/*.cpp', false, false, false));
    fileWatcher.push(vscode_1.workspace.createFileSystemWatcher('**/*.h', false, false, false));
    fileWatcher.push(vscode_1.workspace.createFileSystemWatcher('**/*.proto', false, false, false));
    fileWatcher.push(vscode_1.workspace.createFileSystemWatcher('**/*.hpp', false, false, false));
    fileWatcher.push(vscode_1.workspace.createFileSystemWatcher('**/*.c', false, false, false));
    //设置识别的语言类型
    let clientOptions = {
        //注册需要监控的文件后缀
        documentSelector: [{ scheme: 'file', language: 'cpp' }, { scheme: 'file', language: 'payprotobuf' }, { scheme: 'file', language: 'c' }],
        synchronize: {
            //建立文件变更监控
            fileEvents: fileWatcher
        }
    };
    // Create the language client and start the client.
    client = new vscode_languageclient_1.LanguageClient('CpptipslanguageServer', 'Cpptips Language Server', serverOptions, clientOptions, false);
    let bascpath = vscode_1.workspace.workspaceFolders;
    client.onReady().then(() => {
        if (IndexConfig_1.checkNeedShowDefault()) {
            //需要强制提醒
            IndexConfig_1.showIndexConfig(context, client);
        }
        //注册回调事件
        let diagnosic = notifyProcess_1.notifyProcess(context, client);
        //右键菜单处理
        menuProcess_1.menuProcess(context, client);
        let diagnostic = {};
        vscode_1.tasks.onDidEndTask((listener) => {
            if (listener.execution.task.source == "build") {
                setTimeout(() => {
                    let _diagnostic = vscode_1.languages.getDiagnostics();
                    logger.debug(_diagnostic);
                    for (let i = 0; i < _diagnostic.length; i++) {
                        let _path = _diagnostic[i][0];
                        diagnostic[_path.path] = _diagnostic[i][1];
                    }
                    logger.debug(diagnostic);
                    buildProcess_1.reflushErrorMsg("编译完成，你可以关闭该终端");
                }, 500);
            }
            if (listener.execution.task.source == "reflush_build") {
                setTimeout(() => {
                    client.sendNotification("diagnosticInfo", diagnostic);
                    logger.debug(diagnostic);
                    diagnostic = {};
                }, 500);
            }
        });
    });
    //初始化状态呢拦
    notifyProcess_1.initStatusBar();
    context.subscriptions.push(client.start());
}
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map