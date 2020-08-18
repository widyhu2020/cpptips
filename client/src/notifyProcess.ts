import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window, StatusBarItem, StatusBarAlignment, ThemeColor, TextEdit, commands, ViewColumn, Position, Range, MessageOptions, TextDocumentShowOptions, TextDocument, Uri, scm, Terminal, ShellExecution, Task, TaskDefinition, tasks, Disposable, TaskGroup, languages, DiagnosticCollection, Diagnostic} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    VersionedTextDocumentIdentifier
} from 'vscode-languageclient';
import { showIndexConfig } from './IndexConfig';
import { configure, getLogger } from "log4js";
import { reflushErrorMsg } from './buildProcess';
import { pathToFileURL } from 'url';
const logger = getLogger("cpptips");

let myStatusBarItem: StatusBarItem;
let showUpdataBarItem: StatusBarItem;
//创建状态栏，用于更新加载索引进度
let showColor = new ThemeColor('superstatus.cpptips');

export function initStatusBar(){
	myStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
    myStatusBarItem.text = "";
    myStatusBarItem.color = showColor;
    myStatusBarItem.show();

    showUpdataBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 3);
    showUpdataBarItem.text = "";
    showUpdataBarItem.color = "red";
}

export function notifyProcess(context:ExtensionContext, client: LanguageClient) {
    //初始化diagnosic
    let diagnosic:DiagnosticCollection = languages.createDiagnosticCollection("cpp");

    client.onNotification("show_include_process", (data: Array<number>) => {
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

    client.onNotification("show_source_process", (data: Array<number>) => {
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

    client.onNotification("begin_scan", (data: Array<number>) => {
        myStatusBarItem.show();
		myStatusBarItem.color = showColor;
        myStatusBarItem.text = `$(loading) 工作空间源文件扫描中...`;
    });

    client.onNotification("end_scan", (data: Array<number>) => {
        myStatusBarItem.hide();
        myStatusBarItem.text = `$(check) 工作空间源文件扫描完成`;
    });

    client.onNotification("scan_ing", (data: Array<string>) => {
        if (data.length <= 0) {
            return;
        }
		myStatusBarItem.show();
		myStatusBarItem.color = showColor;
		// myStatusBarItem.text = `$(loading) 正在加载目录：` + data[0];
		myStatusBarItem.text = `$(loading) 工作空间源文件扫描中...`;
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

	//打开配置界面
	client.onNotification("open_index_config", (message: Array<string>) => {
		showIndexConfig(context, client);
	});

    //更新提醒
    client.onNotification("show_update", (message: Array<string>) => {
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

    client.onNotification("refresh_tree", (message: Array<string>) => {
        if (message.length <= 1) {
            //无效通知
            return;
        }
    });

    //打开指定路径的文件
    client.onNotification("open_file", (message: Array<string>) => {
        logger.debug("open_file", message);
        if (message.length < 1) {
            //无效通知
            return;
        }
        let options = {
            selection: new Range(0, 0, 0, 0),
            preview: false,
            viewColumn: ViewColumn.Active
        };
        let uri: Uri = Uri.file(message[0]);
        workspace.openTextDocument(uri).then(doc => {
            if (message.length == 2) {
                let text = doc.getText();
                let _pos = text.indexOf(message[1]);
                if (_pos != -1) {
                    let bposition = doc.positionAt(_pos);
                    let eposition = doc.positionAt(_pos + message[1].length);
                    options.selection = new Range(bposition, eposition);
                }
            }
            window.showTextDocument(doc, options);
        });
    });

    client.onNotification("reflushError", (message:Array<string>)=>{
        logger.debug("open_file", message);
        if(message.length <= 1) {
            return;
        }
        let sourceUri:Uri = Uri.file(message[0]);
        let _diagnosic:Diagnostic[] = JSON.parse(message[1]);
        diagnosic.delete(sourceUri);
        if(_diagnosic.length > 0) {
            diagnosic.set(sourceUri, _diagnosic);
        }
    });
}