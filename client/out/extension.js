"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
let client;
let myStatusBarItem;
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
    ///Users/widyhu/Library/Application Support/Code/User/workspaceStorage/6e3ddf779f8255ad7c3fc18e0f5d6f69/widyhu.cpptips
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
    client = new vscode_languageclient_1.LanguageClient('languageServerExample', 'Language Server Example', serverOptions, clientOptions);
    client.onReady().then(() => {
        //注册回调事件
        client.onNotification("show_include_process", (data) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "red";
            myStatusBarItem.color;
            if (data.length != 3) {
                myStatusBarItem.text = "$(statuBar) 头文件索引加载中..";
                return;
            }
            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = "$(statuBar) 头文件索引分析中：当前进度" + process + "%，总共：" + total + "，当前处理：" + index;
        });
        client.onNotification("show_source_process", (data) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "white";
            if (data.length != 3) {
                myStatusBarItem.text = "$(statuBar) 源文件分析中..";
                return;
            }
            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = "$(statuBar) 源文件分析中：当前进度" + process + "%，总共：" + total + "，当前处理：" + index;
        });
        client.onNotification("begin_scan", (data) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "red";
            myStatusBarItem.text = "$(statuBar) 工作空间源文件扫描中...";
        });
        client.onNotification("end_scan", (data) => {
            myStatusBarItem.hide();
            myStatusBarItem.text = "$(statuBar) 工作空间源文件扫描完成";
        });
        client.onNotification("scan_ing", (data) => {
            if (data.length <= 0) {
                return;
            }
            myStatusBarItem.text = "正在加载目录：" + data[0];
        });
        client.onNotification("close_show_process", (data) => {
            //关闭状态栏
            myStatusBarItem.hide();
        });
        client.onNotification("show_msg", (message) => {
            //右下脚弹窗提示
            if (message.length <= 0) {
                //无效通知
                return;
            }
            vscode_1.window.showInformationMessage(message[0]);
        });
    });
    //创建状态栏，用于更新加载索引进度
    const errorColor = new vscode_1.ThemeColor('superstatus.cpptips');
    myStatusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 2);
    myStatusBarItem.text = "";
    myStatusBarItem.color = errorColor;
    myStatusBarItem.show();
    // Start the client. This will also launch the server
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