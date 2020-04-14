"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const codeAnalyse_1 = require("../../libs/codeAnalyse");
const fs = require("fs");
let basepath = "/";
let openFile = {};
let changefile = [];
let dependentfiles = new Set();
let extpath = "";
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
let hasConfigurationCapability = false;
//配置
let documentSettings = new Map();
const defaultSettings = {
    needLoadLinkDir: [],
    ignoreFileAndDir: [],
    ignorDir: [],
    needLoadDir: [],
    updateCheckIntervalTime: 10000,
    updateCheckUrl: "http://9.134.38.144:8888/list.js"
};
let globalSettings = defaultSettings;
//创建连接
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
//获取插件根目录
function getExtBasePath(argv) {
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
function sendMsgToVscode(msgname, data) {
    //发送通知
    //console.log(msgname, data);
    connection.sendNotification(msgname, [data]);
}
function showTipMessage(message) {
    //发送弹窗
    let data = [message];
    connection.sendNotification("show_msg", [data]);
}
//获取用户维度的定义
function getUserConfig(section) {
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
function reloadIncludeFileCallBack(msg, showprocess, total, nowIndex, extdata) {
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
    if (msg == "error") {
        showTipMessage("文件索引加载失败！");
    }
    sendMsgToVscode("close_show_process", data);
    //重新加载文件
    processFileChange();
}
;
function updateTips(msg) {
    //发送更新提示
    //发送弹窗
    let data = ["检查到cpptips有更新，请重启vscode加载最新的插件！"];
    connection.sendNotification("show_update", [data]);
}
connection.onInitialize((params) => {
    console.log(process);
    console.log("root path", params.rootPath);
    if (params.rootPath != null) {
        basepath = params.rootPath;
    }
    if (basepath[basepath.length - 1] != '/') {
        basepath = basepath + "/";
    }
    //判断是否可以读取到配置
    let capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    return {
        capabilities: {
            //增量更新
            textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                //提示注册
                resolveProvider: true,
                triggerCharacters: ['.', '>', ':', '/']
            },
            documentOnTypeFormattingProvider: {
                firstTriggerCharacter: '}',
                moreTriggerCharacter: [')']
            },
            signatureHelpProvider: {
                triggerCharacters: ['(']
            },
            //triggerKind: CompletionTriggerKind.TriggerCharacter,
            hoverProvider: true,
            definitionProvider: true
        }
    };
});
connection.onInitialized(() => {
    //如果目录没有则创建目录
    let dbpath = basepath + ".vscode/.db/";
    if (!fs.existsSync(dbpath)) {
        fs.mkdirSync(dbpath, { recursive: true });
    }
    let sectionConf = getUserConfig('cpptips');
    sectionConf.then((config) => {
        console.log("userconfig", config);
        dbpath = dbpath + ".cpptips.db";
        //加载索引单例
        let _config = {
            basedir: basepath,
            dbpath: dbpath,
            showsql: 0,
            extpath: extpath,
            userConfig: config
        };
        //代码分析器
        codeAnalyse_1.CodeAnalyse.getInstace().init(_config);
        //重新加载配置
        codeAnalyse_1.CodeAnalyse.getInstace().reloadAllIncludeFile(reloadIncludeFileCallBack);
        //更新检查
        codeAnalyse_1.CodeAnalyse.getInstace().updateCheck(updateTips);
    }, (err) => { console.log(err); });
});
//配置调整
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        //清楚配置换成
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.cpptips || defaultSettings));
    }
});
function processFileChange() {
    //处理变更的文件
    let filenum = 0;
    let setfilename = new Set();
    let mapfile = new Set();
    while (true) {
        let file = changefile.pop();
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
    console.info(setfilename);
    let files = [];
    mapfile.forEach((fileevent) => {
        let uri = fileevent.uri;
        let pos = uri.indexOf(basepath);
        let filename = uri;
        filename = filename.slice(pos + basepath.length);
        if (openFile[uri] && openFile[uri] != "" && fileevent.type == vscode_languageserver_1.FileChangeType.Changed) {
            try {
                let fd = fs.openSync(basepath + filename, 'r');
                const buffer = Buffer.alloc(1024 * 1024 * 2);
                let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, 0);
                fs.closeSync(fd);
                let filecontext = buffer.toString('utf8', 0, bytesRead);
                openFile[uri] = filecontext;
            }
            catch (error) {
                console.error(error);
            }
        }
        //任务里面已经兼容了删除、修改、新增加，这里无需关注
        files.push(filename);
    });
    //只有一个文件，不使用批了加载，单个文件不会锁定数据导致插件不可用
    if (files.length == 1) {
        let filename = files[0];
        codeAnalyse_1.CodeAnalyse.getInstace().reloadOneIncludeFile(filename, reloadOneIncludeFileCallBack);
        //分析头文件依赖
        process.nextTick(analyseCppFile);
        return;
    }
    //加载
    codeAnalyse_1.CodeAnalyse.getInstace().reloadBatchIncludeFile(files, reloadIncludeFileCallBack);
    //分析头文件依赖
    process.nextTick(analyseCppFile);
}
;
connection.onShutdown(() => {
    //关闭
    //正常情况这里先执行
    console.log("on onShutdown");
});
connection.onExit(() => {
    //退出
    //这里在执行
    codeAnalyse_1.CodeAnalyse.getInstace().destroy();
    console.log("on onExit");
});
connection.onDidChangeWatchedFiles((_change) => {
    //console.log(_change);
    let changes = _change.changes;
    changefile = changefile.concat(changes);
    if (!codeAnalyse_1.CodeAnalyse.getInstace().busy()) {
        processFileChange();
    }
    else {
        connection.window.showErrorMessage("插件正在繁忙中，索引稍后加载");
    }
    //文件变动
    //console.log('We received an file change event');
});
function getShowType(type) {
    switch (type) {
        case TypeEnum.CALSS:
            return vscode_languageserver_1.CompletionItemKind.Class;
            break;
        case TypeEnum.ENUM:
            return vscode_languageserver_1.CompletionItemKind.Enum;
            break;
        case TypeEnum.ENUMITEM:
            return vscode_languageserver_1.CompletionItemKind.EnumMember;
            break;
        case TypeEnum.STRUCT:
            return vscode_languageserver_1.CompletionItemKind.Struct;
            break;
        case TypeEnum.INTERFACE:
            return vscode_languageserver_1.CompletionItemKind.Interface;
            break;
        case TypeEnum.VARIABLE:
            return vscode_languageserver_1.CompletionItemKind.Variable;
            break;
        case TypeEnum.NAMESPACE:
            return vscode_languageserver_1.CompletionItemKind.Module;
            break;
        case TypeEnum.FUNCTION:
            return vscode_languageserver_1.CompletionItemKind.Function;
            break;
        case TypeEnum.DEFINE:
            return vscode_languageserver_1.CompletionItemKind.Reference;
            break;
        case TypeEnum.TYPEDEF:
            return vscode_languageserver_1.CompletionItemKind.TypeParameter;
            break;
        default:
            return vscode_languageserver_1.CompletionItemKind.Keyword;
            break;
    }
    return vscode_languageserver_1.CompletionItemKind.Keyword;
}
;
connection.onCompletion((_textDocumentPosition) => {
    //console.log(_textDocumentPosition);
    if (!_textDocumentPosition.position
        || !_textDocumentPosition.position.line
        || !_textDocumentPosition.position.character) {
        console.log("onCompletion", _textDocumentPosition.textDocument.uri);
        return [];
    }
    //重新加载文件
    let basedir = basepath;
    let pathpos = _textDocumentPosition.textDocument.uri.indexOf(basedir);
    let filename = _textDocumentPosition.textDocument.uri;
    filename = filename.slice(pathpos + basedir.length);
    let line = _textDocumentPosition.position.line;
    let cpos = _textDocumentPosition.position.character;
    console.log("pos:", line, cpos);
    let context = openFile[_textDocumentPosition.textDocument.uri];
    let pos = -1;
    let nowline = 0;
    let linecode = "";
    while (true) {
        let tmppos = context.indexOf("\n", pos + 1);
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
    }
    ;
    linecode = linecode.trim();
    console.log(linecode);
    if (linecode[linecode.length - 1] == '.') {
        //最后一个字符是点好，启动找知道名字空间下的方法变量或者其他的
        let list = findWithOwner(cpos, context, pos, filename);
        return vscode_languageserver_1.CompletionList.create(list, false);
    }
    if (linecode[linecode.length - 1] == '>') {
        if (linecode[linecode.length - 2] != '-') {
            //>只有指针访问才提示
            return [];
        }
        //指针形式
        let list = findWithPoint(cpos, context, pos, filename);
        return vscode_languageserver_1.CompletionList.create(list, false);
    }
    if (linecode.length > 2
        && linecode[linecode.length - 1] == ':'
        && linecode[linecode.length - 2] == ':') {
        //最后一个字符是点好，启动找知道名字空间下的方法变量或者其他的
        //静态用法
        let list = findWithNamespace(cpos, context, pos, filename);
        return vscode_languageserver_1.CompletionList.create(list, false);
    }
    if (linecode[linecode.length - 1] == '/') {
        //路径提醒处理
        console.log("路径提醒处理");
    }
    //普通前缀匹配
    let __return = [];
    let __icount = 0;
    let result = preKeyWordSearch(context, pos, cpos, linecode, filename);
    __return = result.__return;
    __icount = result.__count;
    let iscompletion = true;
    if (__icount < 10 && linecode.length > 8) {
        //已经全部加载完成
        iscompletion = false;
    }
    let clist = vscode_languageserver_1.CompletionList.create(__return, iscompletion);
    return clist;
});
connection.onCompletionResolve((item) => {
    let data = JSON.parse(item.data);
    let showData = codeAnalyse_1.CodeAnalyse.getInstace().getShowTips('', data);
    if (showData == false || showData == null) {
        return item;
    }
    let markdown = {
        kind: vscode_languageserver_1.MarkupKind.Markdown,
        value: showData.d
    };
    item.detail = showData.t;
    item.documentation = markdown;
    return item;
});
connection.onSignatureHelp((_document) => {
    //重新加载文件
    let basedir = basepath;
    let pathpos = _document.textDocument.uri.indexOf(basedir);
    let filename = _document.textDocument.uri;
    filename = filename.slice(pathpos + basedir.length);
    let line = _document.position.line;
    let cpos = _document.position.character;
    console.log(line, cpos);
    let context = openFile[_document.textDocument.uri];
    let pos = 0;
    let nowline = 0;
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
    }
    ;
    let ipos = pos + cpos;
    let precontext = context.substr(0, ipos + 1);
    //get
    let fundef = codeAnalyse_1.CodeAnalyse.getInstace().getSignatureHelp(filename, precontext, null);
    if (!fundef) {
        //返回错误
        return null;
    }
    let signaturelist = [];
    for (let i = 0; i < fundef.functiondef.length; i++) {
        let params = fundef.functiondef[i].params;
        let paramsinfos = [];
        for (let j = 0; j < params.length; j++) {
            let doc = params[j];
            let item = vscode_languageserver_1.ParameterInformation.create(params[j], doc);
            paramsinfos.push(item);
        }
        let signature = vscode_languageserver_1.SignatureInformation.create(fundef.functiondef[i].functiondef, fundef.filename, ...paramsinfos);
        signaturelist.push(signature);
    }
    let signatureHelp = {
        signatures: signaturelist,
        activeSignature: null,
        activeParameter: fundef.paramsindex
    };
    return signatureHelp;
});
function findWithNamespace(cpos, context, pos, filename) {
    console.log("命名空间或者静态方法");
    let precontext = context.substr(0, pos + cpos - 1);
    let result = codeAnalyse_1.CodeAnalyse.getInstace().getAllNameByNamespace(filename, precontext, []);
    let showlist = [];
    for (let i = 0; i < result.length; i++) {
        if (!(/[a-z0-9_]{1,128}/ig.test(result[i].s))) {
            console.error("this index error!", result[i]);
            //不符合规范的
            continue;
        }
        let item = {
            "label": result[i].s,
            "insertTextFormat": vscode_languageserver_1.InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i]),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
}
;
function getSelectItemInsertCode(item) {
    //console.info(item);
    if (item.c === undefined) {
        //未明确设置插入字符
        return item.s;
    }
    if (item.c == "") {
        //设置字符未空
        return item.s;
    }
    return item.c;
}
;
function preKeyWordSearch(context, pos, cpos, linecode, filename) {
    let icount = 0;
    let precontext = context.substr(0, pos + cpos + 1);
    let regResut = /[a-z0-9_]{1,128}(::[a-z0-9_]{1,128}){0,10}$/ig.exec(linecode);
    if (regResut == null) {
        //匹配失败
        return { __return: [], __count: icount };
    }
    linecode = linecode.substring(regResut.index);
    console.log("linecode:", linecode);
    if (linecode == "" || !(/[a-z0-9_:]{1,128}/ig.test(linecode))) {
        //空格不做处理
        return { __return: [], __count: icount };
    }
    console.time("searchKeyWord");
    let result = codeAnalyse_1.CodeAnalyse.getInstace().searchKeyWord(filename, linecode, precontext, []);
    console.timeEnd("searchKeyWord");
    //console.log(result);
    let showlist = [];
    for (let i = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": vscode_languageserver_1.InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i]),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
        if (result[i].i == "index") {
            icount++;
        }
    }
    return { __return: showlist, __count: icount };
}
;
function findWithPoint(cpos, context, pos, filename) {
    console.log("指针访问提示", cpos);
    let precontext = context.substr(0, pos + cpos - 1);
    //console.log(precontext);
    console.time("getAllNameByObj");
    let result = codeAnalyse_1.CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, null);
    console.timeEnd("getAllNameByObj");
    let showlist = [];
    for (let i = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": vscode_languageserver_1.InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i]),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
}
;
function findWithOwner(cpos, context, pos, filename) {
    console.log("xxx通过归属找提醒", cpos);
    let precontext = context.substr(0, pos + cpos);
    let result = codeAnalyse_1.CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, []);
    let showlist = [];
    for (let i = 0; i < result.length; i++) {
        let item = {
            "label": result[i].s,
            "insertTextFormat": vscode_languageserver_1.InsertTextFormat.Snippet,
            "insertText": getSelectItemInsertCode(result[i]),
            "kind": getShowType(result[i].t),
            "data": JSON.stringify(result[i])
        };
        showlist.push(item);
    }
    return showlist;
}
;
//获取头文件依赖回调
function getDependentByCppCallBack(msg, filepath, usingnamepace, include) {
    console.log(msg);
    if (msg == "busy") {
        //插件正在分析索引，加入队列待会处理
        console.log("插件正在分析索引，加入队列待会处理，分析完成之后重新加载");
        dependentfiles.add(filepath);
        return;
    }
}
;
function analyseCppFile() {
    let filenames = [];
    dependentfiles.forEach((filename) => {
        filenames.push(filename);
    });
    dependentfiles.clear();
    for (let i = 0; i < filenames.length; i++) {
        let filename = filenames[i];
        codeAnalyse_1.CodeAnalyse.getInstace().getDependentByCpp(filename, getDependentByCppCallBack);
    }
    return;
}
;
//打开文件触发
connection.onDidOpenTextDocument((params) => {
    let uri = params.textDocument.uri;
    openFile[params.textDocument.uri] = params.textDocument.text;
    let basedir = basepath;
    let pos = uri.indexOf(basedir);
    let filepath = uri;
    filepath = filepath.slice(pos + basedir.length);
    dependentfiles.add(filepath);
    //异步执行
    process.nextTick(analyseCppFile);
});
//编辑文件触发，增量触发
connection.onDidChangeTextDocument((params) => {
    let filename = params.textDocument.uri;
    //console.log(params);
    for (let i = 0; i < params.contentChanges.length; i++) {
        const e = params.contentChanges[i];
        if (e.range == undefined
            || e.range.start == undefined
            || e.range.end == undefined) {
            continue;
        }
        let start = e.range.end;
        let end = e.range.start;
        let sline = start.line;
        let eline = end.line;
        let spos = start.character;
        let epos = end.character;
        let text = e.text;
        let context = openFile[filename];
        let lines = 0;
        let lendpos = -1;
        let replaceStart = -1, replaceEnd = -1;
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
        }
        ;
        if (replaceStart > replaceEnd) {
            //互换起点位置
            let _tmp = replaceEnd;
            replaceEnd = replaceStart;
            replaceStart = _tmp;
        }
        let tmpstr = context.slice(0, replaceStart + 1) + text + context.slice(replaceEnd + 1);
        openFile[filename] = tmpstr;
    }
});
//加载单个文件回调
function reloadOneIncludeFileCallBack(msg) {
    console.log("reloadOneIncludeFileCallBack:", msg);
    //showTipMessage("文件已重新加载！");
}
;
//关闭文档触发
connection.onDidCloseTextDocument((params) => {
    //去掉全局文件内容
    openFile[params.textDocument.uri] = "";
});
//保存完文档之后触发
connection.onDidSaveTextDocument((params) => {
    //重新加在文件
    //前面已经加载文件监听，这里无需再触发重新加载
    // let uri = params.textDocument.uri;
    // let fileevent: FileEvent = {
    //     uri: uri,
    //     type: FileChangeType.Changed
    // };
    // changefile.push(fileevent);
    // if (!CodeAnalyse.getInstace().busy()) {
    //     processFileChange();
    // } else {
    //     connection.window.showErrorMessage("插件正在繁忙中，索引稍后加载");
    // }
});
connection.onDefinition((params) => {
    let filename = params.textDocument.uri;
    let basedir = basepath;
    let pos = filename.indexOf(basedir);
    filename = filename.slice(pos + basedir.length);
    let line = params.position.line;
    let cpos = params.position.character;
    console.log("pos:", line, cpos);
    let context = openFile[params.textDocument.uri];
    pos = -1;
    let nowline = 0;
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
    }
    ;
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
    }
    else {
        linelast = context.substr(ipos, lineendpos);
    }
    let result = codeAnalyse_1.CodeAnalyse.getInstace().getDefinePoint(filename, precontext, linelast, []);
    //console.log(result);
    if (result == false) {
        //查找定位失败
        return undefined;
    }
    let range = vscode_languageserver_1.Range.create(result.bline, result.bcols, result.eline, result.ecols);
    let define = vscode_languageserver_1.Location.create(result.filename, range);
    return define;
});
connection.onTypeDefinition((params) => {
    //为实现
    return undefined;
});
//鼠标停留提醒
connection.onHover((params) => {
    //重新加载文件
    let filename = params.textDocument.uri;
    let basedir = basepath;
    let pos = filename.indexOf(basedir);
    filename = filename.slice(pos + basedir.length);
    let line = params.position.line;
    let cpos = params.position.character;
    let context = openFile[params.textDocument.uri];
    console.info(line, cpos);
    pos = -1;
    let nowline = 0;
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
    }
    ;
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
    }
    else {
        linelast = context.substr(ipos, lineendpos);
    }
    let result = codeAnalyse_1.CodeAnalyse.getInstace().getDefinePoint(filename, precontext, linelast, []);
    if (result == false) {
        //查找定位失败
        return undefined;
    }
    let precode = result.prelinecode;
    let data = {
        contents: precode
    };
    return data;
});
// Listen on the connection 
connection.listen();
//# sourceMappingURL=server.js.map