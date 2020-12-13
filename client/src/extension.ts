/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, languages, DiagnosticCollection, tasks, TaskEndEvent} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient';

import { showIndexConfig, checkNeedShowDefault} from './IndexConfig';
import { menuProcess } from './menuProcess';
import { notifyProcess, initStatusBar } from './notifyProcess';
let client: LanguageClient;
import * as os from 'os';
import { configure, getLogger } from "log4js";
import { reflushErrorMsg } from './buildProcess';
import { CpptipsRepository } from './cpptipsRepository';
const unzipper = require("unzipper");

let cpptipsRepostory : CpptipsRepository = null;

function getLoggerPath(){
    let logpath = "/tmp/cpptips.client.log";
    if(os.platform() == "win32"){
        //windows
        if(!fs.existsSync("c:\\cpplog")) {
            fs.mkdirSync("c:\\cpplog");
        }
        logpath = "c:\\cpplog\\cpptips.client.log";
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
logger.level = "debug";

function initBetterSqlite3(context: ExtensionContext) {
    let systemname = process.platform;
    let user_better_sqlite3 = "";
    let user_integer = "";
    if(systemname == "linux") {
        user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'better_sqlite3.node'));
        user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'integer.node'));
    } else if(systemname == "darwin") {
        user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'better_sqlite3.node'));
        user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'integer.node'));
    } else if(systemname == "win32"){
        if(process.arch == "ia32" || process.arch == "x86"){
            user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'better_sqlite3.node'));
            user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'integer.node')); 
        } else {
            user_better_sqlite3 = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'better_sqlite3.node'));
            user_integer = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'integer.node'));
        }
    }

    let better_sqlite3 = context.asAbsolutePath(path.join('node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));
    let integer =  context.asAbsolutePath(path.join('node_modules', 'integer', 'build', 'Release', 'integer.node'));
 
    if(fs.existsSync(user_better_sqlite3)){
        fs.copyFileSync(user_better_sqlite3, better_sqlite3);
    }
    if(fs.existsSync(user_integer)){
        fs.copyFileSync(user_integer, integer);
    }
}

async function initNodeBinary(context: ExtensionContext, callback) {
    let systemname = process.platform;
    let binPath = "";
    if(systemname == "linux") {
        binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-linux-x64', 'node'));
    } else if(systemname == "darwin") {
        binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-darwin-x64', 'node'));
    } else if(systemname == "win32"){
        console.log(process.arch);
        if(process.arch == "ia32" || process.arch == "x86"){
            binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x86', 'node.exe')); 
        } else {
            binPath = context.asAbsolutePath(path.join('bin', 'node-v12.16.1-win-x64', 'node.exe'));
        }
    } else{
        console.error("该平台目前可能不兼容！");
        return "node";
    }

    console.log(binPath);
    if(!fs.existsSync(binPath)){
        //解压文件
        let zipfile = context.asAbsolutePath(path.join('bin', 'node-v12.16.1.zip'));
        
        let zip = fs.createReadStream(zipfile).pipe(unzipper.Parse({forceStream: true}));
        console.log(zip);
        for await (const entry of zip) {
            console.log(entry);
            let fileName = entry.path;
            let type = entry.type;// 'Directory' or 'File'
            let unzipPath = context.asAbsolutePath(path.join('bin', fileName));
            if(type == 'Directory'){
                if(!fs.existsSync(unzipPath)){
                    fs.mkdirSync(unzipPath);
                }
            } else {
                entry.pipe(fs.createWriteStream(unzipPath));
            }
        }
        //调整目录权限
        fs.chmodSync(binPath, fs.constants.S_IRWXU | fs.constants.S_IRWXG | fs.constants.S_IROTH | fs.constants.S_IWOTH);
    } 

    //初始化原生库
    initBetterSqlite3(context);
    return binPath;
}

export function activate(context: ExtensionContext) {
    initNodeBinary(context, bizActivate).then((_binPath)=>{
        bizActivate(context, _binPath);
    });
}

function bizActivate(context: ExtensionContext, binPath:string) {
    
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    let extensionPath = context.extensionPath;
    let storagePath = context.storagePath;
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
    let serverOptions: ServerOptions = {
        run: { 
            module: serverModule, 
            transport: TransportKind.pipe,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath],
            runtime: binPath
        },
        debug: {
            module: serverModule,
            transport: TransportKind.pipe,
            options: debugOptions,
            args: ["--extpath=" + extensionPath, "--storepath=" + storagePath],
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
        false
    );

    let bascpath = workspace.workspaceFolders;
    client.onReady().then(()=>{
       
        if(checkNeedShowDefault()){
            //需要强制提醒
            showIndexConfig(context, client);
        }

        //注册回调事件
        let diagnosic:DiagnosticCollection = notifyProcess(context, client);

        //右键菜单处理
        menuProcess(context, client);

        let diagnostic = {};
        tasks.onDidEndTask((listener:TaskEndEvent)=>{
            if(listener.execution.task.source == "build"){
                setTimeout(() => {
                    let _diagnostic = languages.getDiagnostics();
                    logger.debug(_diagnostic);
                    for(let i = 0; i < _diagnostic.length; i++){
                        let _path = _diagnostic[i][0];
                        diagnostic[_path.path] = _diagnostic[i][1];
                    }
                    logger.debug(diagnostic);
                    reflushErrorMsg("编译完成，你可以关闭该终端");
                }, 500); 
            }

            if(listener.execution.task.source == "reflush_build"){
                setTimeout(() => {
                    client.sendNotification("diagnosticInfo", diagnostic);
                    logger.debug(diagnostic);
                    diagnostic = {};
                }, 500); 
            }
        });
    });

    //初始化状态呢拦
    initStatusBar();
    context.subscriptions.push(client.start());
 
    //变更提醒
    cpptipsRepostory = new CpptipsRepository(context);
}

export function deactivate(): Thenable<void> | undefined {
    if(!cpptipsRepostory){
        cpptipsRepostory.unconstructor();
    }
    if (!client) {
        return undefined;
    }
    return client.stop();
}
