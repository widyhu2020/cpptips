/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';
import { workspace, Location, Range, ExtensionContext, window, languages, TextEditor, DiagnosticCollection, TextDocument, Diagnostic, Position, DiagnosticSeverity, DiagnosticRelatedInformation, DiagnosticChangeEvent, tasks, TaskEndEvent, Uri} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    VersionedTextDocumentIdentifier,
} from 'vscode-languageclient';

import { showIndexConfig, checkNeedShowDefault} from './IndexConfig';
import { menuProcess } from './menuProcess';
import { notifyProcess, initStatusBar } from './notifyProcess';
let client: LanguageClient;
import * as os from 'os';
import { configure, getLogger } from "log4js";
import { reflushErrorMsg } from './buildProcess';
import { time } from 'console';
function getLoggerPath(){
    let logpath = "/tmp/cpptips.server.log";
    if(os.platform() == "win32"){
        //windows
        if(!fs.existsSync("c:\\cpplog")) {
            fs.mkdirSync("c:\\cpplog");
        }
        logpath = "c:\\cpplog\\cpptips.server.log";
    }
    return logpath;
}
configure({
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
        default: { appenders: ["cpptips"], level: "debug"  } 
    }
});
const logger = getLogger("cpptips");
logger.level = "all";

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );

    // languages.getDiagnostics();
    // languages.onDidChangeDiagnostics()

    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
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
        clientOptions,
        true
    );

    let bascpath = workspace.rootPath;
    client.onReady().then(()=>{
       
        if(checkNeedShowDefault()){
            //需要强制提醒
            showIndexConfig(context, client);
        }

        //注册回调事件
        notifyProcess(context, client);

        //右键菜单处理
        menuProcess(context, client);

        tasks.onDidEndTask((listener:TaskEndEvent)=>{
            if(listener.execution.task.source == "build"){
                setTimeout(() => {
                    let _diagnostic = languages.getDiagnostics();
                    logger.debug(_diagnostic);
                    let diagnostic = {};
                    for(let i = 0; i < _diagnostic.length; i++){
                        let _path = _diagnostic[i][0];
                        diagnostic[_path.path] = _diagnostic[i][1];
                    }
                    client.sendNotification("diagnosticInfo", diagnostic);
                    logger.debug(diagnostic);
                }, 3000); 
            }
        });
    });
    
    //初始化状态呢拦
    initStatusBar();
    context.subscriptions.push(client.start());
}



export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
