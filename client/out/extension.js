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
let client;
let myStatusBarItem;
let showUpdataBarItem;
//创建状态栏，用于更新加载索引进度
let showColor = new vscode_1.ThemeColor('superstatus.cpptips');
function activate(context) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
    //let data = '{"ns":"","name":"","type":1,"child":[],"function":[],"variable":[],"defines":[]}';
    //const nodeDependenciesProvider = new DepNodeProvider(data);
    //window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
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
    client = new vscode_languageclient_1.LanguageClient('CpptipslanguageServer', 'Cpptips Language Server', serverOptions, clientOptions);
    let bascpath = vscode_1.workspace.rootPath;
    client.onReady().then(() => {
        //注册回调事件
        client.onNotification("show_include_process", (data) => {
            myStatusBarItem.show();
            myStatusBarItem.color = showColor;
            if (data.length != 3) {
                myStatusBarItem.text = `$(loading) 头文件索引加载中..`;
                return;
            }
            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = `$(loading) 正在分析头文件(不影响使用)：进度` + process + "%，共：" + total;
        });
        client.onNotification("show_source_process", (data) => {
            myStatusBarItem.show();
            myStatusBarItem.color = "white";
            if (data.length != 3) {
                myStatusBarItem.text = `$(loading) 源文件分析中..`;
                return;
            }
            let process = data[0];
            let total = data[1];
            let index = data[2];
            //更新状态栏
            myStatusBarItem.text = `$(loading) 正在分析源文件(不影响使用)：进度` + process + "%，共：" + total;
        });
        client.onNotification("begin_scan", (data) => {
            myStatusBarItem.show();
            //myStatusBarItem.color = "red";
            myStatusBarItem.text = `$(loading) 工作空间源文件扫描中...`;
        });
        client.onNotification("end_scan", (data) => {
            myStatusBarItem.hide();
            myStatusBarItem.text = `$(check) 工作空间源文件扫描完成`;
        });
        client.onNotification("scan_ing", (data) => {
            if (data.length <= 0) {
                return;
            }
            myStatusBarItem.show();
            myStatusBarItem.text = `$(loading) 正在加载目录：` + data[0];
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
        //更新提醒
        client.onNotification("show_update", (message) => {
            if (message.length <= 0 || showUpdataBarItem.text != "") {
                //无效通知
                return;
            }
            //更新提示只提示因1次
            vscode_1.window.showInformationMessage(message[0]);
            showUpdataBarItem.text = `$(repo-sync)Cpptips:重启获取最新版本`;
            showUpdataBarItem.tooltip = message[0];
            showUpdataBarItem.show();
        });
        client.onNotification("refresh_tree", (message) => {
            if (message.length <= 1) {
                //无效通知
                return;
            }
        });
        //打开指定路径的文件
        client.onNotification("open_file", (message) => {
            console.log("open_file", message);
            if (message.length < 1) {
                //无效通知
                return;
            }
            let options = {
                selection: new vscode_1.Range(0, 0, 0, 0),
                preview: false,
                viewColumn: vscode_1.ViewColumn.Active
            };
            let uri = vscode_1.Uri.file(message[0]);
            vscode_1.workspace.openTextDocument(uri).then(doc => {
                if (message.length == 2) {
                    let text = doc.getText();
                    let _pos = text.indexOf(message[1]);
                    if (_pos != -1) {
                        let bposition = doc.positionAt(_pos);
                        let eposition = doc.positionAt(_pos + message[1].length);
                        options.selection = new vscode_1.Range(bposition, eposition);
                    }
                }
                vscode_1.window.showTextDocument(doc, options);
            });
        });
        //右键菜单处理
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.changeType', (uri) => {
            let select = vscode_1.window.activeTextEditor.selection;
            let filename = vscode_1.window.activeTextEditor.document.uri.path;
            let data = JSON.stringify({ select: select, filename: filename });
            client.sendNotification("change_name_type", [[data]]);
            let document = vscode_1.window.activeTextEditor.document;
            let word = document.getText(select);
            let newWord = word;
            //如果原来是_隔开的则转换为驼峰说
            if (newWord.indexOf("_") != -1) {
                let items = newWord.split("_");
                let _tmpWord = "";
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let begin = item.substring(0, 1).toLowerCase();
                    _tmpWord += begin.toUpperCase() + item.substring(1);
                }
                newWord = _tmpWord;
            }
            else {
                //如果原来是驼峰写法转换为_隔开的
                if (/^Is([A-Z]{1,1}[a-z0-9]{1,128}){1,10}Set$/g.test(word)) {
                    newWord = newWord.substring(2, newWord.length - 3);
                    newWord = newWord.replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                    newWord = "has" + newWord;
                }
                else if (/^Get([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(word)) {
                    newWord = newWord.substring(3);
                    let begin = newWord.substring(0, 1).toLowerCase();
                    newWord = begin + newWord.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                }
                else if (/^Set([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(word)) {
                    let begin = word.substring(0, 1).toLowerCase();
                    newWord = begin + word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                }
                else {
                    let begin = word.substring(0, 1).toLowerCase();
                    newWord = begin + word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                }
            }
            if (word == newWord) {
                //无需替换
                return;
            }
            vscode_1.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(select, newWord);
            });
        }));
        //智能提醒，需要改变光标
        context.subscriptions.push(vscode_1.commands.registerCommand('cpptips.service.move_cursor', (params) => {
            let line = params[1];
            let bcol = params[2];
            let ecol = params[3];
            const options = {
                selection: new vscode_1.Range(line, bcol, line, ecol),
                preview: false,
                viewColumn: vscode_1.ViewColumn.Active
            };
            let document = vscode_1.window.activeTextEditor.document;
            vscode_1.window.showTextDocument(document, options);
        }));
        //appplatform迁移结构体处理
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.appplatformtosvrkit', (uri) => {
            let document = vscode_1.window.activeTextEditor.document;
            let select = vscode_1.window.activeTextEditor.selection;
            let word = document.getText(select);
            let newWord = word.replace(/[a-z0-9]{1,64}\.Set[a-z0-9]{1,64}\([a-z0-9]{1,64}\.Get[a-z0-9]{1,64}\(\)[\s\t]{0,4},[\s\t]{0,4}[a-z0-9]{1,64}\.Is[a-z0-9]{1,64}Set\(\)\);/ig, (_kw) => {
                let data = _kw.split(",");
                if (data.length != 2) {
                    return _kw;
                }
                let code = "if(" + data[1].replace(";", "").trim() + "{ " + data[0] + "); }";
                return code;
            });
            newWord = newWord.replace(/[.]{1,1}(Set|Get|Is)(([A-Z]{1,1}[0-9a-z]{1,32}){1,20})/g, (_kw) => {
                //如果原来是驼峰写法转换为_隔开的
                let _word = _kw;
                _word = _word.replace(".", "");
                if (/^Is([A-Z]{1,1}[a-z0-9]{1,128}){1,10}Set$/g.test(_word)) {
                    _word = _word.substring(2, _word.length - 3);
                    _word = _word.replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                    _word = "has" + _word;
                }
                else if (/^Get([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(_word)) {
                    _word = _word.substring(3);
                    let begin = _word.substring(0, 1).toLowerCase();
                    _word = begin + _word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                }
                else if (/^Set([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(_word)) {
                    let begin = _word.substring(0, 1).toLowerCase();
                    _word = begin + _word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
                        return "_" + kw.toLowerCase();
                    });
                }
                return "." + _word;
            });
            vscode_1.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(select, newWord);
            });
        }));
        //转换为大些
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.transferToUpper', (uri) => {
            let document = vscode_1.window.activeTextEditor.document;
            let select = vscode_1.window.activeTextEditor.selection;
            let word = document.getText(select);
            let newWord = word.toLocaleUpperCase();
            vscode_1.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(select, newWord);
            });
        }));
        //转换为小些
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.transferToLower', (uri) => {
            let document = vscode_1.window.activeTextEditor.document;
            let select = vscode_1.window.activeTextEditor.selection;
            let word = document.getText(select);
            let newWord = word.toLocaleLowerCase();
            vscode_1.window.activeTextEditor.edit(editBuilder => {
                editBuilder.replace(select, newWord);
            });
        }));
        //索引处理
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.addIndexDir', (infos) => {
            console.log(infos);
            client.sendNotification("addDirToIndex", infos);
        }));
        //索引处理
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.delIndexDir', (infos) => {
            console.log(infos);
            client.sendNotification("delDirToIndex", infos);
        }));
        //刷新所有索引
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.reflushAllIdex', (infos) => {
            console.log(infos);
            client.sendNotification("reflushAllIdex", infos);
        }));
        //刷新该文件的索引
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.reflushOneIdex', (infos) => {
            console.log(infos);
            client.sendNotification("reflushOneIdex", infos);
        }));
        //复制文件名称处理
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.copyfilename', (infos) => {
            console.log(infos);
            let filepath = infos.path;
            let pathinfo = path.parse(filepath);
            console.log(pathinfo.base);
            let filename = pathinfo.base;
            const os = require('os');
            let systemname = process.platform;
            if (systemname == "linux") {
                //linux操作系统
                let exec = require('child_process').exec;
                exec('printf "' + filename + '" | xsel --input --clipboard');
                return;
            }
            if (systemname == "darwin") {
                //linux操作系统
                let exec = require('child_process').exec;
                let cmd = 'printf "' + filename + '" | pbcopy';
                console.log(cmd);
                exec(cmd);
                return;
            }
            if (systemname == "win32") {
                //windows操作系统
                let exec = require('child_process').exec;
                exec('<nul (set/p z="' + filename + '") | clip');
                return;
            }
        }));
        //提交编译
        context.subscriptions.push(vscode_1.commands.registerCommand('cpp.build', (infos) => {
            console.log(infos);
            let filepath = infos.path;
            let pathinfo = path.parse(filepath);
            let dirname = pathinfo.dir;
            let terminal = vscode_1.window.activeTerminal;
            if (terminal == undefined) {
                terminal = vscode_1.window.createTerminal("编译");
            }
            terminal.show(false);
            while (true) {
                if (!fs.existsSync(dirname + "/BUILD")
                    && !fs.existsSync(dirname + "/makefile")) {
                    let _pathinfo = path.parse(dirname);
                    dirname = _pathinfo.dir;
                    if (dirname == "" || dirname == "/") {
                        break;
                    }
                    continue;
                }
                if (fs.existsSync(dirname + "/BUILD")) {
                    //patchbuild 编译
                    terminal.sendText("cd " + dirname);
                    terminal.sendText("patchbuild build -d .");
                }
                if (fs.existsSync(dirname + "/makefile")) {
                    //makefile编译
                    terminal.sendText("cd " + dirname);
                    terminal.sendText("make -j 2");
                }
                return;
            }
            terminal.sendText("echo \"未找到可编译的目录！\"");
        }));
    });
    myStatusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 2);
    myStatusBarItem.text = "";
    myStatusBarItem.color = showColor;
    myStatusBarItem.show();
    showUpdataBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 3);
    showUpdataBarItem.text = "";
    showUpdataBarItem.color = "red";
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