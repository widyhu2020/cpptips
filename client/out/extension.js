"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const IndexConfig_1 = require("./IndexConfig");
const menuProcess_1 = require("./menuProcess");
const notifyProcess_1 = require("./notifyProcess");
let client;
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
    client = new vscode_languageclient_1.LanguageClient('CpptipslanguageServer', 'Cpptips Language Server', serverOptions, clientOptions);
    let bascpath = vscode_1.workspace.rootPath;
    client.onReady().then(() => {
        //showGetContainer(context, client);
        if (IndexConfig_1.checkNeedShowDefault()) {
            //需要强制提醒
            IndexConfig_1.showIndexConfig(context, client);
        }
        //注册回调事件
        notifyProcess_1.notifyProcess(context, client);
        //右键菜单处理
        menuProcess_1.menuProcess(context, client);
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