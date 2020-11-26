"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
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
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions = {
        run: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath]
        },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath]
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
exports.activate = activate;
function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map