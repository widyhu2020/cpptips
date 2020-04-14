/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands, ProgressLocation, window, StatusBarItem, StatusBarAlignment, TextEditor, ThemeColor} from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient';

let client: LanguageClient;
let myStatusBarItem: StatusBarItem;
let showUpdataBarItem: StatusBarItem;

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );

    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
    ///Users/widyhu/Library/Application Support/Code/User/workspaceStorage/6e3ddf779f8255ad7c3fc18e0f5d6f69/widyhu.cpptips
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
        run: { 
            module: serverModule, 
            transport: TransportKind.ipc,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath]
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath]
        }
    };

    let fileWatcher= [];
    fileWatcher.push(workspace.createFileSystemWatcher('**/*.cpp', false, false, false));
    fileWatcher.push(workspace.createFileSystemWatcher('**/*.h', false, false, false));
    fileWatcher.push(workspace.createFileSystemWatcher('**/*.proto', false, false, false));
    fileWatcher.push(workspace.createFileSystemWatcher('**/*.hpp', false, false, false));
    fileWatcher.push(workspace.createFileSystemWatcher('**/*.c', false, false, false));
    //设置识别的语言类型
    let clientOptions: LanguageClientOptions = {
        //注册需要监控的文件后缀
        documentSelector: [{ scheme: 'file', language: 'cpp' }, { scheme: 'file', language: 'payprotobuf' }, { scheme: 'file', language: 'c' }],
        synchronize: {
            //建立文件变更监控
            fileEvents: fileWatcher
        }
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'CpptipslanguageServer',
        'Cpptips Language Server',
        serverOptions,
        clientOptions
    );

    client.onReady().then(()=>{
        //注册回调事件
        client.onNotification("show_include_process", (data: Array<number>) => {
            myStatusBarItem.show();
            if (data.length != 3) {
                myStatusBarItem.text = `$(loading) 头文件索引加载中..`;
                return;
            }

            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = `$(loading) 头文件索引分析中：当前进度` + process + "%，总共：" + total + "，当前处理：" + index;
        });

        client.onNotification("show_source_process", (data: Array<number>) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "white";
            if (data.length != 3) {
                myStatusBarItem.text = `$(loading) 源文件分析中..`;
                return;
            }

            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = `$(loading) 源文件分析中：当前进度` + process + "%，总共：" + total + "，当前处理：" + index;
        });

        client.onNotification("begin_scan", (data: Array<number>) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "red";
            myStatusBarItem.text = `$(loading) 工作空间源文件扫描中...`;
        });

        client.onNotification("end_scan", (data: Array<number>) => {
            myStatusBarItem.hide();
            myStatusBarItem.text = `$(check) 工作空间源文件扫描完成`;
        });

        client.onNotification("scan_ing", (data:Array<string>) =>{
            if(data.length <= 0) {
                return;
            }
            myStatusBarItem.text = `$(loading) 正在加载目录：` + data[0];
        });

        client.onNotification("close_show_process", (data: Array<number>) => {
            //关闭状态栏
            myStatusBarItem.hide();
        });

        client.onNotification("show_msg", (message: Array<string>) => {
            //右下脚弹窗提示
            if (message.length <= 0) {
                //无效通知
                return;
            }
            window.showInformationMessage(message[0]);
        });

        //更新提醒
        client.onNotification("show_update",(message: Array<string>) => {
            if (message.length <= 0 || showUpdataBarItem.text != "") {
                //无效通知
                return;
            }

            //更新提示只提示因1次
            window.showInformationMessage(message[0]);
            showUpdataBarItem.text = `$(repo-sync)Cpptips:重启获取最新版本`;
            showUpdataBarItem.tooltip = message[0];
            showUpdataBarItem.show();
        });
    });

    //创建状态栏，用于更新加载索引进度
    const errorColor = new ThemeColor('superstatus.cpptips');
    
    myStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
    myStatusBarItem.text = "";
    myStatusBarItem.color = errorColor;
    myStatusBarItem.show();

    showUpdataBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 3);
    showUpdataBarItem.text = "";
    showUpdataBarItem.color = "red";
    
    // Start the client. This will also launch the server
    context.subscriptions.push(client.start());
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
