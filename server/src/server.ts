import {
    createConnection,
    ProposedFeatures,
    InitializeParams,
    CompletionItem,
    CompletionItemKind,
    DidChangeTextDocumentParams,
    TextDocumentSyncKind,
    DidCloseTextDocumentParams,
    DidOpenTextDocumentParams,
    DidSaveTextDocumentParams,
    CompletionParams,
    CompletionTriggerKind,
    TextDocumentPositionParams,
    Hover,
    Definition,
    Range,
    Location,
    LocationLink,
    DefinitionLink,
    MarkupKind,
    SignatureHelp,
    ParameterInformation,
    SignatureInformation,
    DidChangeWatchedFilesParams,
    FileEvent,
    FileChangeType,
    CompletionList,
    InsertTextFormat,
    DocumentSymbolParams,
    SymbolKind,
    DocumentSymbol,
    TextDocument,
    Position,
    Diagnostic,
    TextEdit,
    Command,
    MessageActionItem,
} from 'vscode-languageserver';
const path = require('path');

import { CodeAnalyse, NodeItem, ShowItem, CaConfig, PointInfo} from '../../libs/codeAnalyse';
import * as fs from 'fs';
import { URL } from 'url';
import { clearTimeout } from 'timers';
let basepath:string = "/";
let openFile:{[key: string]: string} = {};
let treeData:{[key: string]: string} = {};
let changefile: FileEvent[] = [];
let dependentfiles:Set<string> = new Set();
let extpath = "";
let rebuildTimeout:NodeJS.Timeout|null = null;

getExtBasePath(process.argv);

var TypeEnum = {
    AIR_IN_FUNCTION: 0,
    NAMESPACE: 1,
    CALSS: 2,
    ENUM: 3,
    STRUCT: 4,
    INTERFACE: 5,
    VARIABLE: 6,
    FUNCTION: 7,
    DEFINE: 8,
    ENUMITEM: 9,
    TYPEDEF: 10
};

let hasConfigurationCapability: boolean = false;
//  settings
interface Settings {
    needLoadLinkDir: Array<string>;
    ignoreFileAndDir: Array<string>;
    ignorDir:Array<string>;
    needLoadDir:Array<string>;
    updateCheckIntervalTime:Number;
    updateCheckUrl:string;
}

//配置
let documentSettings: Map<string, Thenable<Settings>> = new Map();

const defaultSettings: Settings = { 
    needLoadLinkDir: [],
    ignoreFileAndDir: [
    ],
    ignorDir:[
    ],
    needLoadDir:[
    ],
    updateCheckIntervalTime:10000,
    updateCheckUrl:"http://9.134.38.144:8888"
};
let globalSettings: Settings = defaultSettings;

//创建连接
let connection = createConnection(ProposedFeatures.all);

//获取插件根目录
function getExtBasePath(argv: string[]) {
    console.debug(argv);
    for (let i = 0; i < argv.length; i++) {
        let args = argv[i];
        if (/--extpath=/g.test(args)) {
            extpath = args.replace(/--extpath=/g, "");
            console.debug("find extpath:", extpath);
            break;
        }
    }
}

function sendMsgToVscode(msgname:string, data:any[]) {
    //发送通知
    //console.log(msgname, data);
    connection.sendNotification(msgname, [data]);
}

function showTipMessage(message:string, titles:string[] = ["我知道了"], callback:any = null) {
    //发送弹窗
    let items: MessageActionItem[] = [];
    for(let i = 0; i < titles.length; i++) {
        let item:MessageActionItem = {title: titles[i]};
        items.push(item);
    }

    connection.window.showInformationMessage(message, ...items).then((selection:MessageActionItem|undefined) => {
        if (callback != null && selection != undefined) {
            callback(selection.title);
        }
    });
}

function showWarningMessage(message:string, titles:string[] = ["我知道了"], callback:any = null) {
    //发送弹窗
    let items: MessageActionItem[] = [];
    for(let i = 0; i < titles.length; i++) {
        let item:MessageActionItem = {title: titles[i]};
        items.push(item);
    }

    connection.window.showWarningMessage(message, ...items).then((selection:MessageActionItem|undefined) => {
        if (callback != null && selection != undefined) {
            callback(selection.title);
        }
    });
}

function showErrorMessage(message:string, titles:string[] = ["我知道了"], callback:any = null) {
    //发送弹窗
    let items: MessageActionItem[] = [];
    for(let i = 0; i < titles.length; i++) {
        let item:MessageActionItem = {title: titles[i]};
        items.push(item);
    }
     
    connection.window.showErrorMessage(message, ...items).then((selection:MessageActionItem|undefined) => {
        if (callback != null && selection != undefined) {
            callback(selection.title);
        }
    });
}

function openFilePath(filepath:string, select:string|undefined) {
    if(fs.existsSync(filepath)) {
        let params = [filepath];
        if(select != undefined){
            params.push(select);
        }
        connection.sendNotification("open_file", [params]);
    }
}

//获取用户维度的定义
function getUserConfig(section: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(section);
	if (!result) {
		result = connection.workspace.getConfiguration(section);
		documentSettings.set(section, result);
    }
	return result;
}

function reloadIncludeFileCallBack(
    msg: string, showprocess: number, total: number, nowIndex: number, extdata:string) {
    //console.log(msg, showprocess, total, nowIndex);
    let data = [showprocess, total, nowIndex];
    if (msg == "inlcude_process") {
        sendMsgToVscode("show_include_process", data);
        return;
    }
    if (msg == "source_process") {
        sendMsgToVscode("show_source_process", data);
        return;
    }
    if (msg == "begin_scan") {
        sendMsgToVscode("begin_scan", data);
        return;
    }
    if (msg == "end_scan") {
        sendMsgToVscode("end_scan", data);
        return;
    }
    if (msg == "scan_ing") {
        let _data = [extdata];
        sendMsgToVscode("scan_ing", _data);
        return;
    }
    if(msg == "error") {
        showErrorMessage("文件索引加载失败！");
    }
    if(msg == "stop_load_index") {
        showErrorMessage("你工程目录文件超过150000个，系统终止索引计算，请目录右键“加入索引范围”指定需要计算的目录！");
    }
    if(msg == "show_file_more") {
        showWarningMessage("你工程目录文件超过50000个，文件过多将影响索引性能，选择目录右键“加入索引范围”可指定需要加入索引的目录！");
    }
    
    sendMsgToVscode("close_show_process", data);
    //重新加载文件
    processFileChange();
};

function updateTips(msg:string){
    //发送更新提示
    //发送弹窗
    let data = ["检查到cpptips有更新，请重启vscode加载最新的插件！"];
    connection.sendNotification("show_update", [data]);
}

connection.onNotification("get_tree", (message: Array<string>) => {
    //客户端获取右边树的请求
    console.log(message);
});

//加入创建索引目录
connection.onNotification("addDirToIndex", (infos: any) => {
    console.log(infos);
    let filepath:string = infos["path"];

    let dataFile = fs.statSync(filepath);
    if(!dataFile.isDirectory()) {
        //提示错误信息
        showErrorMessage("只能添加目录，请选择目录加入索引计算范围！");
        return;
    }

    //获取目录名称
    let dirname = "/" + filepath.replace(basepath, "") + "/";
    console.log(dirname);

    let setPath = basepath + ".vscode/settings.json";
    let seting:any = {};
    if(fs.existsSync(setPath)){
        let fd = fs.openSync(setPath, 'r');
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, null);
        fs.closeSync(fd);
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        seting = JSON.parse(filecontext);
    }

    if(!seting["cpptips.needLoadDir"]) {
        seting["cpptips.needLoadDir"] = [dirname];
    } else {
        for(let i = 0; i < seting["cpptips.needLoadDir"].length; i++) {
            if(seting["cpptips.needLoadDir"][i] == dirname
                || dirname.indexOf(seting["cpptips.needLoadDir"][i]) == 0) {
                //目录配置过，或者父目录已经配置过
                //提示错误
                showErrorMessage("该目录配置或者父目录已经配置，无需重复配置！点击按钮查看当前配置！", ["打开配置文件"], (selection:string)=>{
                    if(selection == "打开配置文件") {
                        //打开配置文件
                        openFilePath(setPath, "cpptips.needLoadDir");
                    }
                });
                return;
            }
        }
        seting["cpptips.needLoadDir"].push(dirname);
    }
    //保存配置文件
    let newSetting = JSON.stringify(seting);
    console.log("newsetting:", newSetting);
    fs.writeFileSync(setPath, newSetting, {encoding: "utf8"});
    documentSettings.clear();
    showTipMessage("操作成功，你可以继续添加其他目录，完成之后点击“重建索引”开始重建索引，也可以配置完之后通过“刷新全部索引”来重建！", ["重建索引", "我知道了"], (selection:string)=>{
        if(selection == "重建索引") {
            //开始重建索引
            //重新加载配置
            reloadAllIndex();
        }
    });
});

//移除创建索引目录
connection.onNotification("delDirToIndex", (infos: any) => {
    console.log(infos);
    let filepath:string = infos["path"];

    let dataFile = fs.statSync(filepath);
    if(!dataFile.isDirectory()) {
        //提示错误信息
        showErrorMessage("只能针对目录操作，请重新选择目录操作！");
        return;
    }

    //获取目录名称
    let dirname = "/" + filepath.replace(basepath, "") + "/";
    console.log(dirname);

    let setPath = basepath + ".vscode/settings.json";
    let seting:any = {};
    if(fs.existsSync(setPath)){
        let fd = fs.openSync(setPath, 'r');
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, null);
        fs.closeSync(fd);
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        seting = JSON.parse(filecontext);
    }

    if(!seting["cpptips.needLoadDir"]) {
        showErrorMessage("未找到任何指定的索引目录，你可以在.vscode/setting.json中查看配置！", ["打开配置文件"], (selection:string)=>{
            if(selection == "打开配置文件") {
                //打开配置文件
                openFilePath(setPath, "cpptips.needLoadDir");
            }
        });
        return;
    } else {
        let _dirs = [];
        for(let i = 0; i < seting["cpptips.needLoadDir"].length; i++) {
            if(seting["cpptips.needLoadDir"][i] == dirname) {
                //找到需要移除的目录
                continue;
            }
            _dirs.push(seting["cpptips.needLoadDir"][i]);
        }
        if(seting["cpptips.needLoadDir"].length == _dirs.length) {
            showErrorMessage("该目录之前未加入索引计算，是否是上级目录有加入，你可以在.vscode/setting.json中查看配置！", ["打开配置文件"], (selection:string)=>{
                if(selection == "打开配置文件") {
                    //打开配置文件
                    openFilePath(setPath, "cpptips.needLoadDir");
                }
            });
            return;
        }
        seting["cpptips.needLoadDir"] = _dirs;
    }
    
    //保存配置文件
    let newSetting = JSON.stringify(seting);
    console.log("remove newsetting:", newSetting);
    fs.writeFileSync(setPath, newSetting, {encoding: "utf8"});
    documentSettings.clear();
    showTipMessage("操作成功，移除之后原来计算的索引将保留，但后续不再更新索引，需要更新请重新加入该目录！");
    globalSettings.needLoadDir = seting;
});

//刷新所有索引
connection.onNotification("reflushAllIdex", (infos: any) => {
    console.log(infos);
    //重新加载配置
    reloadAllIndex();
});

//刷新单文件索引
connection.onNotification("reflushOneIdex", (infos: any) => {
    console.log(infos);
    //重新加载配置
    let filepath:string = infos["path"];
    let filename = "/" + filepath.replace(basepath, "")
    CodeAnalyse.getInstace().reloadOneIncludeFile(filename, reloadOneIncludeFileCallBack);
});

connection.onInitialize((params: InitializeParams) => {
    //console.log(JSON.stringify(process));
    console.log("root path", params.rootPath);
    if (params.rootPath != null) {
        basepath = params.rootPath;
    }
    basepath = basepath.replace(/[\\]{1,2}/g, "/");
    if(basepath[basepath.length - 1] != "/") {
        basepath = basepath + "/";
    }

    //判断是否可以读取到配置
    let capabilities = params.capabilities;
    hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);

    return {
        capabilities: {
            //增量更新
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                //提示注册
                resolveProvider: true,
                triggerCharacters:['.','>',':','/',' ']
            },
            documentOnTypeFormattingProvider:{
                firstTriggerCharacter : '}',
                moreTriggerCharacter : [')']
            },
            signatureHelpProvider :{
                triggerCharacters:['(']
            },
            documentSymbolProvider: true,
            //triggerKind: CompletionTriggerKind.TriggerCharacter,
            hoverProvider : true,
            definitionProvider: true
        }
    };
});

// connection.sendDiagnostics
connection.onInitialized(() => {
    //如果目录没有则创建目录
    let arrdbpath = [basepath, ".vscode", "db", ""];
    let dbpath = arrdbpath.join("/");
    if (!fs.existsSync(dbpath)) {
        fs.mkdirSync(dbpath, { recursive: true});
    }

    let sectionConf = getUserConfig('cpptips');
    sectionConf.then(
        (config) => {
            console.log("userconfig", JSON.stringify(config));
            dbpath = dbpath + "cpptips.db";
            //加载索引单例
            let _config = {
                basedir: basepath,
                dbpath: dbpath,
                showsql: 0,
                extpath: extpath,
                userConfig: config
            };
        
            //代码分析器
            console.log("begin init");
            console.time("init");
            CodeAnalyse.getInstace().init(_config);
            console.timeEnd("init");

            //重新加载配置
            console.log("begin reloadAllIncludeFile");
            console.time("reloadAllIncludeFile");
            CodeAnalyse.getInstace().reloadAllIncludeFile(reloadIncludeFileCallBack);
            console.timeEnd("reloadAllIncludeFile");

            //更新检查
            console.log("begin updateCheck");
            console.time("updateCheck");
            CodeAnalyse.getInstace().updateCheck(updateTips);
            console.timeEnd("updateCheck");
        },
        (err: any) => {console.log(err)}
    );
});

//配置调整
connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		//清楚配置换成
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.cpptips || defaultSettings)
		);
	}
});

function reloadAllIndex() {
    let sectionConf = getUserConfig('cpptips');
    sectionConf.then((config) => {
        console.log("userconfig", JSON.stringify(config));
        //加载索引单例
        let _config = {
            basedir: undefined,
            dbpath: undefined,
            showsql: undefined,
            extpath: undefined,
            userConfig: config
        };
        CodeAnalyse.getInstace().reloadLoadUserConfig(_config);
        CodeAnalyse.getInstace().reloadAllIncludeFile(reloadIncludeFileCallBack);
    }, (err: any) => { console.log(err); });
};

function processFileChange() {
    //处理变更的文件
    let filenum:number = 0;
    let setfilename: Set<string> = new Set();
    let mapfile: Set<FileEvent> = new Set();
    while (true) {
        let file: FileEvent|undefined = changefile.pop();
        if (file == undefined) {
            //处理完了
            break;
        }
        if (setfilename.has(file.uri)) {
            //判断文件是否之前加载过
            continue;
        }
        setfilename.add(file.uri);
        mapfile.add(file);
    }

    //清除定时器
    if(rebuildTimeout != null) {
        clearTimeout(rebuildTimeout);
        rebuildTimeout = null;
    }

    console.info(setfilename);
    let files:string[] = [];
    mapfile.forEach((fileevent)=>{
        let uri: string = decodeURIComponent(fileevent.uri);
        let pos: number = uri.indexOf(basepath);
        let filename = uri;
        filename = filename.slice(pos + basepath.length);
        //如果文件是打开的
        if (openFile[fileevent.uri] && openFile[fileevent.uri] != "" && fileevent.type == FileChangeType.Changed) {
            try {
                let fd = fs.openSync(basepath + filename, 'r');
                const buffer = Buffer.alloc(1024 * 1024 * 2);
                let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, 0);
                fs.closeSync(fd);
                let filecontext = buffer.toString('utf8', 0, bytesRead);
                openFile[fileevent.uri] = filecontext;
            } catch (error) {
                console.error(error);
            }
        }

        //任务里面已经兼容了删除、修改、新增加，这里无需关注
        files.push(filename);
    });

    //只有一个文件，不使用批了加载，单个文件不会锁定数据导致插件不可用
    if(files.length == 1) {
        let filename: string = files[0];
        CodeAnalyse.getInstace().reloadOneIncludeFile(filename, reloadOneIncludeFileCallBack);
        //分析头文件依赖
        process.nextTick(analyseCppFile);
        return;
    }

    if(files.length > 5) {
        //启动全面增量分析
        console.time("reloadAllIncludeFile");
        CodeAnalyse.getInstace().reloadAllIncludeFile(reloadIncludeFileCallBack);
        console.timeEnd("reloadAllIncludeFile");
        //分析头文件依赖
        process.nextTick(analyseCppFile);
        files = [];
        return;
    }

    //加载
    CodeAnalyse.getInstace().reloadBatchIncludeFile(files, reloadIncludeFileCallBack);
    //分析头文件依赖
    process.nextTick(analyseCppFile);
};

connection.onShutdown(():void => {
    //关闭
    //正常情况这里先执行
    console.log("on onShutdown");

});

connection.onExit(() => {
    //退出
    //这里在执行
    CodeAnalyse.getInstace().destroy();
    console.log("on onExit");
});

//文件变更提示
connection.onDidChangeWatchedFiles((_change: DidChangeWatchedFilesParams) => {
    console.log(JSON.stringify(_change));
    let changes: FileEvent[] = _change.changes;
    changefile = changefile.concat(changes);
    if (!CodeAnalyse.getInstace().busy()) {
        //清除定时器
        if(rebuildTimeout != null) {
            clearTimeout(rebuildTimeout);
            rebuildTimeout = null;
        }
        processFileChange();
    } else {
        connection.window.showErrorMessage("插件正在繁忙中，索引稍后加载");
    }

    //文件变动
    //console.log('We received an file change event');
});

function getShowType(type: number): CompletionItemKind {
    switch (type) {
        case TypeEnum.CALSS:
            return CompletionItemKind.Class;
            break;

        case TypeEnum.ENUM:
            return CompletionItemKind.Enum;
            break;

        case TypeEnum.ENUMITEM:
            return CompletionItemKind.EnumMember;
            break;

        case TypeEnum.STRUCT:
            return CompletionItemKind.Struct;
            break;

        case TypeEnum.INTERFACE:
            return CompletionItemKind.Interface;
            break;

        case TypeEnum.VARIABLE:
            return CompletionItemKind.Variable;
            break;

        case TypeEnum.NAMESPACE:
            return CompletionItemKind.Module;
            break;

        case TypeEnum.FUNCTION:
            return CompletionItemKind.Function;
            break;
        
        case TypeEnum.DEFINE:
            return CompletionItemKind.Reference;
            break;
        
        case TypeEnum.TYPEDEF:
            return CompletionItemKind.TypeParameter;
            break;
    
        default:
            return CompletionItemKind.Keyword;
            break;
    }
    return CompletionItemKind.Keyword;
};

//闭合测试
function testCloseMark(str: string, left:string, right:string)
{
    let stack = [];
    for(let i = 0; i < str.length; i++) {
        if(str[i] == left) {
            stack.push(left);
            continue;
        }
        if(str[i] == right) {
            if(stack.length <= 0) {
                //不匹配
                return false;
            }
            stack.pop();
        }
    }

    if(stack.length != 0) {
        return false;
    }
    return true;
}

connection.onCompletion((_textDocumentPosition: CompletionParams): CompletionItem[] | CompletionList | null =>{
    //console.log(_textDocumentPosition);
    if (!_textDocumentPosition.position
        || !_textDocumentPosition.position.line
        || !_textDocumentPosition.position.character) {
        console.log("onCompletion", _textDocumentPosition.textDocument.uri);
        return [];
    }

    //重新加载文件
    let basedir = basepath;
    let uri = decodeURIComponent(_textDocumentPosition.textDocument.uri);
    let pathpos: number = uri.indexOf(basedir);
    let filename = uri;
    filename = filename.slice(pathpos + basedir.length);
    
    let line = _textDocumentPosition.position.line;
    let cpos = _textDocumentPosition.position.character;
    console.log("pos:", line, cpos);

    let context = openFile[_textDocumentPosition.textDocument.uri];
    let pos: number = -1;
    let nowline : number = 0;
    let linecode:string = "";
    while (true) {
        let tmppos = context.indexOf("\n",pos + 1);
        if (tmppos == -1) {
            //找完了
            break;
        }
        if (nowline == line) {
            //找到行
            linecode = context.slice(pos + 1, pos + 1 + cpos);
            break;
        }
        pos = tmppos;
        nowline++;
    };

    //判断是否自动填参数分析
    let autoFillReg = /\([\s]{0,4}(([a-z0-9_\(\)\[\].: \->]{1,128},){0,10})[\s\t]{0,10} $/ig;
    let autoResult = autoFillReg.exec(linecode);
    if(autoResult 
        && testCloseMark(autoResult[1], '(', ')')) {
        console.log(autoResult);
        let preKey = autoResult[0];
        //context = context.substring(0, context.length - preKey.length);
        console.log("begin autoFillParams");
        console.time("autoFillParams");
        let list = autoFillParams(cpos, line, context, pos, filename, preKey);
        console.timeEnd("autoFillParams");
        return CompletionList.create(list, true);;
    }

    linecode = linecode.trim();
    //判断是否为针对类的提醒
    let rge = /(\->|\.|::|\/\s)[\s]{0,4}([a-z0-9_]{0,128})$/ig;
    let _result = rge.exec(linecode);
    if(_result) {
        let symbol = _result[1];
        let preKey = _result[2];
        cpos = cpos - preKey.length;
        //context = context.substring(0, context.length - preKey.length);
        if(symbol == ".") {
            console.log("begin findWithOwner");
            console.time("findWithOwner");
            let list = findWithOwner(cpos, context, pos, filename, preKey);
            console.timeEnd("findWithOwner");
            return CompletionList.create(list, false);
        }
        if(symbol == "->") {
            //指针形式
            console.log("begin findWithPoint");
            console.time("findWithPoint");
            let list = findWithPoint(cpos, context, pos, filename, preKey);
            console.timeEnd("findWithPoint");
            return CompletionList.create(list, false);
        }

        if(symbol == "::") {
            //最后一个字符是点好，启动找知道名字空间下的方法变量或者其他的
            //静态用法
            console.log("begin findWithNamespace");
            console.time("findWithNamespace");
            let list = findWithNamespace(cpos, context, pos, filename, preKey);
            console.timeEnd("findWithNamespace");
            return CompletionList.create(list, false);
        }

        if (symbol == '/') {
            //路径提醒处理
            //未实现
            console.log("路径提醒处理");
        }


        if (symbol == '') {
            //无需处理
            return null;
        }
    }

    //普通前缀匹配
    let __return = [];
    let __icount:number = 0;
    console.log("begin preKeyWordSearch");
    console.time("preKeyWordSearch");
    let result = preKeyWordSearch(context, pos, cpos, linecode, filename);
    console.timeEnd("preKeyWordSearch");
    __return = result.__return;
    __icount = result.__count;
    let iscompletion = true;
    if (__icount < 10 && linecode.length > 8) {
        //已经全部加载完成
        iscompletion = false;
    }
    let clist = CompletionList.create(__return, iscompletion);
    return clist;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    let data: NodeItem =JSON.parse(item.data);
    console.log("begin getShowTips");
    console.time("getShowTips");
    let showData = CodeAnalyse.getInstace().getShowTips('', data);
    console.timeEnd("getShowTips");
    if (showData == false || showData == null) {
        return item;
    }
    let markdown = {
        kind: MarkupKind.Markdown,
        value: showData.d
    };
    item.detail = showData.t;
    item.documentation = markdown;
    return item;
});

connection.onSignatureHelp((_document: TextDocumentPositionParams): SignatureHelp | null => {
    //重新加载文件
    let uri = decodeURIComponent(_document.textDocument.uri);
    let basedir = basepath;
    let filename = decodeURIComponent(_document.textDocument.uri);
    let pathpos: number = filename.indexOf(basedir);
    filename = filename.slice(pathpos + basedir.length);

    let line = _document.position.line;
    let cpos = _document.position.character;
    console.log(line, cpos);

    let context: string = openFile[_document.textDocument.uri];
    let pos:number = 0;
    let nowline: number = 0;
    while (true) {
        let tmppos = context.indexOf("\n", pos + 1);
        if (tmppos == -1) {
            //找完了
            break;
        }
        if (nowline == line) {
            //找到行
            break;
        }
        pos = tmppos;
        nowline++;
    };

    let ipos = pos + cpos;
    let precontext = context.substr(0, ipos + 1);
    
    //get
    console.log("begin getSignatureHelp");
    console.time("getSignatureHelp");
    let fundef = CodeAnalyse.getInstace().getSignatureHelp(filename, precontext, null);
    console.timeEnd("getSignatureHelp");
    if(!fundef) {
        //返回错误
        return null;
    }

    let signaturelist = [];
    for (let i = 0; i < fundef.functiondef.length; i++) {
        let params = fundef.functiondef[i].params;
        let paramsinfos = [];
        for(let j = 0; j < params.length; j++) {
            let doc = params[j];
            let item = ParameterInformation.create(params[j], doc);
            paramsinfos.push(item);
        }
        let signature = SignatureInformation.create(fundef.functiondef[i].functiondef, fundef.filename, ...paramsinfos);
        signaturelist.push(signature);
    }

    let signatureHelp = {
        signatures: signaturelist,
        activeSignature: null,
        activeParameter: fundef.paramsindex
    };

    return signatureHelp;
});

function findWithNamespace(cpos: number, context: string, pos: number, filename: string, symbol:string) {
    console.log("命名空间或者静态方法");
    let precontext = context.substr(0, pos + cpos - 1);
    let lastcontext = context.substr(pos + cpos + symbol.length + 2, 100).trim();
    let hasParams = false;
    if(lastcontext[0] == "(") {
        hasParams = true;
    }

    let result = CodeAnalyse.getInstace().getAllNameByNamespace(filename, precontext, []);
    let showlist = [];
    for (let i: number = 0; i < result.length; i++) {
        if (!(/[a-z0-9_]{1,128}/ig.test(result[i].s))) {
            console.error("this index error!", result[i]);
            //不符合规范的
            continue;
        }
        let item = {
            "label": result[i].s,
            "insertTextFormat": InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i], hasParams),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
};

function getSelectItemInsertCode(item: NodeItem, useName:boolean) {
    //console.info(item);
    if(useName) {
        //强制私有提示的值
        return item.s;
    }
    if(item.c === undefined) {
        //未明确设置插入字符
        return item.s;
    }  
    if (item.c == "") {
        //设置字符未空
        return item.s;
    }
    return item.c;
};

function preKeyWordSearch(context: string, pos: number, cpos: number, linecode: string, filename: string) {
    let icount: number = 0;
    let precontext = context.substr(0, pos + cpos + 1);
    let regResut: RegExpExecArray | null = /[a-z0-9_]{1,128}(::[a-z0-9_]{1,128}){0,10}$/ig.exec(linecode);
    if(regResut == null) {
        //匹配失败
        return { __return: [], __count: icount };
    }
    linecode = linecode.substring(regResut.index);
    console.log("linecode:", linecode);
    
    if (linecode == "" || !(/[a-z0-9_:]{1,128}/ig.test(linecode))) {
        //空格不做处理
        return { __return: [], __count: icount };
    }

    console.log("begin searchKeyWord");
    console.time("searchKeyWord");
    let result = CodeAnalyse.getInstace().searchKeyWord(filename, linecode, precontext, []);
    console.timeEnd("searchKeyWord");
    //console.log(result);
    
    let showlist = [];
    for (let i: number = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i], false),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
        if (result[i].i == "index") {
            icount++;
        }
    }
    return { __return: showlist, __count: icount };
};

function findWithPoint(cpos: number, context: string, pos: number, filename: string, symbol:string) {
    console.log("指针访问提示", cpos);
    let precontext = context.substr(0, pos + cpos - 1);
    let lastcontext = context.substr(pos + cpos + symbol.length + 2, 100).trim();
    let hasParams = false;
    if(lastcontext[0] == "(") {
        hasParams = true;
    }

    //console.log(precontext);
    console.log("begin getAllNameByObj");
    console.time("getAllNameByObj");
    let result = CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, null);
    console.timeEnd("getAllNameByObj");
    let showlist = [];
    for (let i: number = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i], hasParams),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
};

function autoFillParams(cpos: number, line:number, context: string, pos: number, filename: string, keyword:string) {
    console.log("自动匹配函数参数", cpos);
    let precontext = context.substr(0, pos + cpos + 2);
    let lastcontext = context.substr(pos + cpos + keyword.length + 1, 100).trim();
    let hasParams = false;

    let result = CodeAnalyse.getInstace().autoFillParams(filename, precontext, keyword);
    let _precontext = context.substr(0, pos + cpos);
    _precontext = _precontext.trim();
    let backPos = 0;
    if(_precontext[_precontext.length - 1] == "("){
        backPos = 1;
    }
    let showlist = [];
    for (let i: number = 0; i < result.length; i++) {
        let data:string = getSelectItemInsertCode(result[i], hasParams);
        let item:CompletionItem = {
            "label": result[i].s,
            "insertTextFormat": InsertTextFormat.Snippet,
            "insertText": data,
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        if(backPos == 1) {
            let range = Range.create(line, cpos - 1, line, cpos);
            item["textEdit"] = TextEdit.replace(range, data);
        }
        if(item["insertText"] 
            && item["insertText"].indexOf("%params%") != -1) {
            //需要进入编辑状态
            let _pos = item["insertText"].indexOf("%params%");
            let command = Command.create("move_cursor", "cpptips.service.move_cursor", ["%params%", line, cpos + _pos - backPos, cpos + _pos + 8 - backPos]);
            item["command"] = command;
        }
        showlist.push(item);
    }
    return showlist;
};

function findWithOwner(cpos: number, context: string, pos: number, filename: string, symbol:string) {
    console.log("xxx通过归属找提醒", cpos);
    let precontext = context.substr(0, pos + cpos);
    let lastcontext = context.substr(pos + cpos + symbol.length + 1, 100).trim();
    let hasParams = false;
    if(lastcontext[0] == "(") {
        hasParams = true;
    }

    let result = CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, []);
    let showlist = [];
    for (let i: number = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i], hasParams),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
};

//获取头文件依赖回调
function getDependentByCppCallBack(msg:string, filepath:string, usingnamepace:string[], include:string[], showTree:string) {
    console.log(msg);
    if(msg == "busy") {
        //插件正在分析索引，加入队列待会处理
        console.log("插件正在分析索引，加入队列待会处理，分析完成之后重新加载");
        dependentfiles.add(filepath);
        return;
    }
    dependentfiles.delete(filepath);
};

function analyseCppFile() {
    let filenames:string[] = [];
    dependentfiles.forEach((filename)=>{
        filenames.push(filename);
    });

    dependentfiles.clear();
    //dependentfiles = new Set<string>();
    console.log("xxxxxxxxxxxxxx:", JSON.stringify(dependentfiles));
    for (let i = 0; i < filenames.length; i++) {
        let filename = filenames[i];
        console.log("begin getDependentByCpp");
        console.time("getDependentByCpp");
        CodeAnalyse.getInstace().getDependentByCpp(filename, getDependentByCppCallBack);
        console.timeEnd("getDependentByCpp");
    }

    return;
};

//打开文件触发
connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
    let uri = decodeURIComponent(params.textDocument.uri);
    openFile[params.textDocument.uri] = params.textDocument.text;
    let basedir = basepath;
    let pos: number = uri.indexOf(basedir);
    let filepath = uri;
    filepath = filepath.slice(pos + basedir.length);
    dependentfiles.add(filepath);

    console.log("debug:", uri, basedir, filepath);
    //异步执行
    //process.nextTick(analyseCppFile);
    setTimeout(analyseCppFile, 3000);

    //重新计算索引
    CodeAnalyse.getInstace().reloadOneIncludeFile(filepath, reloadOneIncludeFileCallBack);
});

//编辑文件触发，增量触发
connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
    let filename = decodeURIComponent(params.textDocument.uri);
    //console.log(params);
    for (let i:number = 0; i < params.contentChanges.length; i++) {

        const e = params.contentChanges[i];
        if (e.range == undefined
            || e.range.start == undefined
            || e.range.end == undefined ) {
            continue;
        }

        let start = e.range.end;
        let end = e.range.start;
        let sline = start.line;
        let eline = end.line;
        let spos = start.character;
        let epos = end.character;

        let text: string = e.text;
        let context:string = openFile[params.textDocument.uri];
        let lines:number = 0;
        let lendpos:number = -1;
        let replaceStart:number = -1, replaceEnd:number = -1;
        while (true) {
            if (lines != sline && lines != eline) {
                //不用的行
                lines++;
                lendpos = context.indexOf('\n', lendpos + 1);
                continue;
            }

            if (lines == eline) {
                //结束的行
                replaceEnd = lendpos + epos;
            }

            if (lines == sline) {
                //开始的行
                replaceStart = lendpos + spos;
            }

            if (replaceEnd != -1 && replaceStart != -1) {
                //找到了替换点，结束
                break;
            }
            lendpos = context.indexOf('\n', lendpos + 1);
            //totalNumber = totalNumber + lendpos;
            if (lendpos == -1) {
                //找到了最好一行
                break;
            }
            lines++;
        };

        if (replaceStart > replaceEnd) {
            //互换起点位置
            let _tmp = replaceEnd;
            replaceEnd = replaceStart;
            replaceStart = _tmp;
        }

        let tmpstr = context.slice(0, replaceStart + 1) + text + context.slice(replaceEnd + 1);
        openFile[params.textDocument.uri] = tmpstr;
    }
});

//加载单个文件回调
function reloadOneIncludeFileCallBack(msg:string) {
    console.log("reloadOneIncludeFileCallBack:", msg);
    //showTipMessage("文件已重新加载！");
};

//关闭文档触发
connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
    //去掉全局文件内容
    openFile[params.textDocument.uri] = "";

});

//保存完文档之后触发
connection.onDidSaveTextDocument((params: DidSaveTextDocumentParams) => {
    //重新加在文件
    let uri = decodeURIComponent(params.textDocument.uri);
    let basedir = basepath;
    let pos: number = uri.indexOf(basedir);
    let filepath = uri;
    filepath = filepath.slice(pos + basedir.length);
    dependentfiles.add(filepath);

    console.log("analyseCppFile debug:", uri, basedir, filepath);
    //异步执行
    process.nextTick(analyseCppFile);

    //文件变更
    let changes: FileEvent = {
        uri: params.textDocument.uri,
        type: FileChangeType.Changed
    };
    changefile.push(changes);
    if(rebuildTimeout ==null) {
        //这里启动一个定时器用于兜底
        //若文件改动监听器无反应，则这个兜底
        rebuildTimeout = setTimeout(processFileChange, 2000);
    }


    let context = openFile[params.textDocument.uri];
    if(context == undefined) {
        return;
    }
    
    CodeAnalyse.getInstace().diagnostics(filepath, context, (result:string)=>{
        let data = JSON.parse(result);
        console.log(data);
        let diagnosticsData = [];
        if(context == undefined) {
            return;
        }
        let doc = TextDocument.create(params.textDocument.uri, "cpp", 0, context);
        for(let i = 0; i < data.length; i++) {
            let begin:Position = doc.positionAt(data[i].begin);
            let end:Position = doc.positionAt(data[i].end);
            let range = Range.create(begin, end);
            let _diagnostics = Diagnostic.create(range, "检测到这里语法错误，请确认调整！");
            diagnosticsData.push(_diagnostics);
        }
        let diagnosticsParams = {
            uri:params.textDocument.uri,
            diagnostics:diagnosticsData
        };
        connection.sendDiagnostics(diagnosticsParams);
    });
});

connection.onDocumentSymbol((params: DocumentSymbolParams):DocumentSymbol[]|undefined => {
    let uri = decodeURIComponent(params.textDocument.uri);
    let basedir = basepath;
    let pos: number = uri.indexOf(basedir);
    let filepath = uri;
    filepath = filepath.slice(pos + basedir.length);
    if(filepath[0] != "\\" && filepath[0] != "/") {
        filepath = path.sep + filepath;
    }
    let context = openFile[uri];
    let tdoc = TextDocument.create(uri, "cpp", 0, context);
    console.log("begin getDocumentTree");
    console.time("getDocumentTree");
    let showTree = CodeAnalyse.getInstace().getDocumentTree(filepath, context);
    console.timeEnd("getDocumentTree");
    //console.log(JSON.stringify(showTree));
    if(!showTree) {
        //如果返回没有文档结构，则报错
        return undefined;
    }
    
    let list = undefined;
    console.log("begin getDepsInDefineJson");
    console.time("getDepsInDefineJson");
    try {
        list = getDepsInDefineJson(tdoc, showTree);
    } catch(error) {
        list = undefined;
        console.error("error", error);
        console.log(JSON.stringify(showTree));
    }
    console.timeEnd("getDepsInDefineJson");
    //console.log(JSON.stringify(list));
    return list;
});

function getDefineInfo(tdoc: TextDocument, defineMeta: any, owner:string = ""): DocumentSymbol[] {
    let dependencys: DocumentSymbol[] = [];
    
    let functions = defineMeta["function"];
    let variables = defineMeta["variable"];
    let defines = defineMeta["defines"];

    for(let i = 0; i < functions.length; i++) {
        if(functions[i].name == "") {
            continue;
        }
        let bPosition = tdoc.positionAt(functions[i].bpos);
        let ePosition = tdoc.positionAt(functions[i].bpos + functions[i].name.length);
        let dependency =  DocumentSymbol.create(functions[i].name, "", SymbolKind.Function, Range.create(bPosition, ePosition), Range.create(bPosition, ePosition));
        dependencys.push(dependency);
    }

    for(let i = 0; i < variables.length; i++) {
        if(variables[i].name == "") {
            continue;
        }
        let bPosition = tdoc.positionAt(variables[i].bpos);
        let ePosition = tdoc.positionAt(variables[i].bpos + variables[i].name.length);
        let dependency = DocumentSymbol.create(variables[i].name, "d", SymbolKind.Variable, Range.create(bPosition, ePosition), Range.create(bPosition, ePosition));
        dependencys.push(dependency);
    }

    for(let i = 0; i < defines.length; i++) {
        if(defines[i].name == "") {
            continue;
        }
        let bPosition = tdoc.positionAt(defines[i].bpos);
        let ePosition = tdoc.positionAt(defines[i].bpos + defines[i].name.length);
        let dependency = DocumentSymbol.create(defines[i].name, "", SymbolKind.TypeParameter, Range.create(bPosition, ePosition), Range.create(bPosition, ePosition));
        dependencys.push(dependency);
    }

    return dependencys;
}

function getDepsInDefineJson(tdoc:TextDocument ,nodeInfo: any): DocumentSymbol[] {
    let dependencys: DocumentSymbol[] = [];
    
    //生成列表
    let defineMeta = nodeInfo;
    if(defineMeta["function"].length > 0
        || defineMeta["defines"].length > 0 
        || defineMeta["variable"].length > 0) {
        let owner = "";
        if(defineMeta["type"] == TypeEnum.CALSS) {
            owner = defineMeta["name"];
        }
        let ret = getDefineInfo(tdoc, defineMeta, owner);
        if(ret.length > 0){
            //找到数据
            dependencys = dependencys.concat(ret);
        }
    }

    if(defineMeta["child"].length > 0) {
        for(let i = 0; i < defineMeta["child"].length; i++) {
            if(defineMeta["child"][i]["name"] == "") {
                continue;
            }

            let _dependency = null;
            if(defineMeta["child"][i]["type"] == TypeEnum.CALSS) {
                _dependency = DocumentSymbol.create(defineMeta["child"][i]["name"], "", SymbolKind.Class, Range.create(0,1,1,0), Range.create(0,1,1,0));
            } else {
                _dependency = DocumentSymbol.create(defineMeta["child"][i]["name"], "", SymbolKind.Namespace, Range.create(0,1,1,0), Range.create(0,1,1,0));
            }
            _dependency.children = getDepsInDefineJson(tdoc, defineMeta["child"][i]);
            dependencys.push(_dependency);  
        }
    }
   
    return dependencys;
}

connection.onDefinition((params: TextDocumentPositionParams): Definition | undefined | DefinitionLink[] => {
    let filename = decodeURIComponent(params.textDocument.uri);
    let basedir = basepath;
    let pos: number = filename.indexOf(basedir);
    filename = filename.slice(pos + basedir.length);
    let line = params.position.line;
    let cpos = params.position.character;
    console.log("pos:", line, cpos);

    let context = openFile[params.textDocument.uri];
    pos = -1;
    let nowline: number = 0;
    while (true) {
        let tmppos = context.indexOf("\n", pos + 1);
        if (tmppos == -1) {
            //找完了
            break;
        }
        if (nowline == line) {
            //找到行
            break;
        }
        pos = tmppos;
        nowline++;
    };
    
    let ipos = pos + cpos;
    while (true) {
        if ((context[ipos] >= 'a' && context[ipos] <= 'z')
            || (context[ipos] >= 'A' && context[ipos] <= 'Z')
            || (context[ipos] >= '0' && context[ipos] <= '9')
            || context[ipos] == '_') {
            ipos++;
            continue;
        }
        break;
    }

    let result:PointInfo|false = false;
    let precontext = context.substr(0, ipos);
    let lineendpos = context.indexOf('\n', ipos);
    let linestartpos = context.lastIndexOf('\n', ipos);

    let linecode = context.substring(linestartpos, lineendpos).trim();
    console.log("line:", linecode);
    if(/^#include /g.test(linecode)) {
        //是否头文件引用
        let inlcudeFile = linecode.replace("#include ", "");
        inlcudeFile = inlcudeFile.replace(/["<>\s\t"]{1,1}/g, "");
        console.log(inlcudeFile);
        console.log("begin getIncludeDefine");
        console.time("getIncludeDefine");
        result = CodeAnalyse.getInstace().getIncludeDefine(filename, inlcudeFile);
        console.timeEnd("getIncludeDefine");
    } else {
        let linelast = "";
        if (lineendpos == -1) {
            linelast = context.substr(ipos);
        } else {
            linelast = context.substring(ipos, lineendpos);
        }
        console.log("begin getDefinePoint");
        console.time("getDefinePoint");
        result = CodeAnalyse.getInstace().getDefinePoint(filename, precontext, linelast, []);
        console.timeEnd("getDefinePoint");
    }

    if(result == false) {
        //查找定位失败
        return undefined;
    }

    let range = Range.create(result.bline, result.bcols, result.eline, result.ecols);
    let define = Location.create(result.filename, range);
    return define;
});

connection.onTypeDefinition((params: TextDocumentPositionParams): Definition | undefined=> {
    //为实现
    return undefined;
});

//鼠标停留提醒
connection.onHover((params: TextDocumentPositionParams): Hover | undefined => {
        //重新加载文件
        let filename = decodeURIComponent(params.textDocument.uri);
        let basedir = basepath;
        let pos: number = filename.indexOf(basedir);
        filename = filename.slice(pos + basedir.length);

        let line = params.position.line;
        let cpos = params.position.character;
        let context = openFile[params.textDocument.uri];
        console.info(line, cpos);
        pos = -1;
        let nowline: number = 0;
        while (true) {
            let tmppos = context.indexOf("\n", pos + 1);
            if (tmppos == -1) {
                //找完了
                break;
            }
            if (nowline == line) {
                //找到行
                break;
            }
            pos = tmppos;
            nowline++;
        };

        let ipos = pos + cpos;
        while (true) {
            if ((context[ipos] >= 'a' && context[ipos] <= 'z')
                || (context[ipos] >= 'A' && context[ipos] <= 'Z')
                || (context[ipos] >= '0' && context[ipos] <= '9')
                || context[ipos] == '_') {
                ipos++;
                continue;
            }
            break;
        }

        let precontext = context.substr(0, ipos);
        let lineendpos = context.indexOf('\n', ipos);
        let linelast = "";
        if (lineendpos == -1) {
            linelast = context.substr(ipos);
        } else {
            linelast = context.substring(ipos, lineendpos);
        }
        console.log("begin getDefinePoint");
        console.time("getDefinePoint");
        let result = CodeAnalyse.getInstace().getDefinePoint(filename, precontext, linelast, []);
        console.timeEnd("getDefinePoint");
        if (result == false) {
            //查找定位失败
            return undefined;
        }
        
        let precode = result.prelinecode;
        let data = {
            contents: precode
        };
        return data;
    }
);

// Listen on the connection 
connection.listen();
