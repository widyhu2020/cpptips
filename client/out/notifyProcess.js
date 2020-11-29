"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyProcess = exports.initStatusBar = void 0;
const vscode_1 = require("vscode");
const IndexConfig_1 = require("./IndexConfig");
const log4js_1 = require("log4js");
const logger = log4js_1.getLogger("cpptips");
let myStatusBarItem;
let showUpdataBarItem;
//创建状态栏，用于更新加载索引进度
let showColor = new vscode_1.ThemeColor('superstatus.cpptips');
function initStatusBar() {
    myStatusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 2);
    myStatusBarItem.text = "";
    myStatusBarItem.color = showColor;
    myStatusBarItem.show();
    showUpdataBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, 3);
    showUpdataBarItem.text = "";
    showUpdataBarItem.color = "red";
}
exports.initStatusBar = initStatusBar;
function notifyProcess(context, client) {
    //初始化diagnosic
    let diagnosic = vscode_1.languages.createDiagnosticCollection("cpp1");
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
        myStatusBarItem.text = `$(loading) 进度:` + process + "%";
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
        myStatusBarItem.text = `$(loading) 进度:` + process + "%";
    });
    client.onNotification("begin_scan", (data) => {
        myStatusBarItem.show();
        myStatusBarItem.color = showColor;
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
        myStatusBarItem.color = showColor;
        // myStatusBarItem.text = `$(loading) 正在加载目录：` + data[0];
        myStatusBarItem.text = `$(loading) 工作空间源文件扫描中...`;
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
    //打开配置界面
    client.onNotification("open_index_config", (message) => {
        IndexConfig_1.showIndexConfig(context, client);
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
        logger.debug("open_file", message);
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
    client.onNotification("reflushError", (message) => {
        logger.debug("open_file", message);
        if (message.length <= 1) {
            return;
        }
        let sourceUri = vscode_1.Uri.file(message[0]);
        let _diagnosic = JSON.parse(message[1]);
        diagnosic.delete(sourceUri);
        if (_diagnosic.length > 0) {
            diagnosic.set(sourceUri, _diagnosic);
        }
    });
    client.onNotification("reloadWindow", (message) => {
        //重启vscode
        vscode_1.commands.executeCommand("workbench.action.reloadWindow");
    });
    return diagnosic;
}
exports.notifyProcess = notifyProcess;
//# sourceMappingURL=notifyProcess.js.map