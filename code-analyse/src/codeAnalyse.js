/* --------------------------------------------------------------------------------------------
 * codeAnalyse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const cluster = require('cluster');
const Analyse = require('./analyse/analyseCpp');
const AnalyseTree = require('./analyse/analyse');
const AnalyseDomain = require('./analyse/analyseDomain');
const Completion = require('./completion/completion').Completion;
const Definition = require('./definition/definition').Definition;
const FileIndexStore = require('./store/store').FileIndexStore;
const KeyWordStore = require('./store/store').KeyWordStore;
const DefineMap = require('./definition/defineMap').DefineMap;
const AutoFillParam = require('./completion/autoFillParam').AutoFillParam;
const TypeEnum = require('./analyse/analyseCpp').TypeEnum;
const fs = require('fs');
const __path = require('path');
const { nextTick } = require('process');
const logger = require('log4js').getLogger("cpptips");
const Queue = require('./analyse/queue');

class CodeAnalyse {
    //单例方法
    static getInstace() {
        if (!CodeAnalyse.instance) {
            CodeAnalyse.instance = new CodeAnalyse();
        }
        return CodeAnalyse.instance;
    };

    constructor() {
        this.isinit = false;
        this.basedir = "";
        this.dbpath = "";
        this.namespacestore = {};

        //依赖分析队列
        this.dependentQueue = new Queue();
        this.lockqueue = false;
        
        //缓存
        this.fundefcache = null;

        //loadindex
        this.loadindex = false;

        //用户配置
        this.configs = {};

        //启动定时处理器
        this.dependerTimer = this._dequeueDepend();
    }

    //初始化结构体
    init = function(configs) {
        if (this.isinit) {
            return this;
        }
        logger.info("config:", configs);
        let basedir = configs.basedir;
        this.basedir = basedir;
        let dbpath = configs.dbpath
        this.dbpath = dbpath;
        this.extPath = configs.extpath;
        this.showsql = 0;
        this.userConfig = configs.userConfig;
        if(configs.showsql){
            //是否打印sql
            this.showsql = configs.showsql;
        }

        let lastpos = dbpath.lastIndexOf("/");
        let path = dbpath.substring(0, lastpos);
        logger.info("db path!", dbpath, path);
        if (!fs.existsSync(path)) {
            //文件夹不存
            logger.info("mkdir db path!", path);
            fs.mkdirSync(path, { recursive: true});
        }

        //这里不进行初始化
        KeyWordStore.getInstace().connect(dbpath, this.showsql);
        FileIndexStore.getInstace().connect(dbpath, this.showsql);
        this.isinit = true;
        return this;
    };

    //重新加载用户配置
    reloadLoadUserConfig = function(configs) {
        //设置用户配置
        this.userConfig = configs.userConfig;
        return this;
    };

    //退出
    destroy = function() {
        //退出链接
        this.isinit = false;
        KeyWordStore.getInstace().closeconnect();
        FileIndexStore.getInstace().closeconnect();
        clearInterval(this.dependerTimer);
    };

    //是否可以执行
    busy = function() {
        return !(this.isinit);
    };

    //分析队列，任何事件都进入进行排队处理
    _dequeueDepend = function(){
        let that = this;
        return setInterval(()=>{
            //看是否有任务在处理
            if(that.lockqueue){
                //任务未处理完
                console.log("工作进程正则分析中，请稍后....");
                return;
            }

            //尝试弹出
            let task = that.dependentQueue.dequeue();
            if(!task) {
                //没有任务需要处理
                return;
            }

            let filepath = task['filepath'];
            let callback = task['callback'];
            let isClose = task['isclose'];
            let isSave = task['issave'];
            that._getDependentByCpp(filepath, callback, isClose, isSave);
        }, 1000);
    };

    //获取cpp文件头文件依赖
    _getDependentByCpp = function (filepath, callback = null, isClose = false, isSave = false) {
        let that = this;
        //锁住
        let exitTimer = null;
        if(isClose){
            KeyWordStore.getInstace().removeMenDB(filepath);
            that.lockqueue = false;
            return;
        }

        that.lockqueue = true;
        //其他情况分析文件获取文件依赖，并初始化当前索引到内存数据库
        cluster.setupMaster({
            exec: __dirname + "/worker/makeOwnsMapByCpp.js",
            silent: false,
            windowsHide: true
        });
        
        const worker = cluster.fork();
        let dependent = KeyWordStore.getInstace().getPreSaveFileIds(filepath);
        let parasms = {
            basedir: this.basedir,
            sysdir: this.extPath + "/data/",
            cppfilename: filepath,
            dbpath: this.dbpath,
            needrecursion: isSave ? 0 : 1,
            dependent: dependent
        }
        //发送指令
        worker.send(parasms);
        worker.on('message', (data) => {
            try {
                let usingnamespace = data['usingnamespace'];
                let include = data['include'];
                let showTree = data['showTree'];
                let fileids = data['fileids'];
                let currentfileid = data['currentfileid'];
                //关闭子进程
                nextTick((fileids)=>{
                    //将数据导入内存db
                    if(isSave == true){
                        //排除上次已经加载过的数据
                        let setFiles = new Set(dependent);
                        let needSaveFile = fileids.filter((value, index, array)=>{ return !setFiles.has(value); });
                        needSaveFile.push(currentfileid);
                        logger.log("save fileids:", isSave, needSaveFile);
                        fileids = needSaveFile;
                    }
                    KeyWordStore.getInstace().setMemDB(fileids, filepath, currentfileid, isSave);
                    if(exitTimer) {
                        //如果有定时器，则清除定时器
                        clearTimeout(exitTimer);
                    }
                    that.lockqueue = false;
                }, fileids);
                this.namespacestore[filepath] = usingnamespace;
                if (callback != null) {
                    //需要回调
                    callback("success", filepath, usingnamespace, include, showTree);
                }
            } catch (err) {
                console.debug(err);
                if(exitTimer) {
                    //如果有定时器，则清除定时器
                    clearTimeout(exitTimer);
                }
                that.lockqueue = false;
            }
            worker.kill();
        });

        //退出工作进程
        worker.on('exit', (code, signal) => {
            console.error("获取cpp文件头文件依赖工作进程退出", code, signal);
            //60秒自动解锁
            exitTimer = setTimeout(()=>{ that.lockqueue = false; }, 60000);
        });
    };

    //构造搜索树
    _makeSearchTree = function (files) {
        this.lodadTreeDb();
        let totalSouorceTree = null;
        for (let i = 0; i < files.length; i++) {
            let filename = files[i];
            //logger.debug(filename);
            let strjson = this.store.get(filename);
            if (strjson == "") {
                continue;
            }
            let fileSourceTree = Analyse.makeSourceTree(strjson);

            if (!fileSourceTree['d'] || !fileSourceTree['g']) {
                //数据结构不对
                continue;
            }
            if (totalSouorceTree == null) {
                totalSouorceTree = fileSourceTree;
            } else {
                Analyse.MergerTree(totalSouorceTree, fileSourceTree);
                totalSouorceTree = Analyse.MergerTree(totalSouorceTree, fileSourceTree);
            }
        }

        if (totalSouorceTree == null) {
            //未成功构造查找树
            return false;
        }

        this.searchTree = Analyse._makeSearchTree(totalSouorceTree);
        this.closeTreeDb();
        return true;
    };

    //前缀匹配
    _searchKeyWord = function (filepath, prekeyworld, filecontext, owns = []) {
        let analyse = new AnalyseDomain(filecontext);
        let data = analyse.doAnalyse();
        filecontext = data.reverse().join('\n');
        filecontext = filecontext.replace(/using namespace/g, "using_ns");
        let lines = filecontext.split('\n');

        //判断是否含有命名空间，含有则直接使用
        if(/::/g.test(prekeyworld)) {
            //含有命名空间
            //限定作用域的模糊匹配
            
            let items = prekeyworld.split("::");
            if(items[0] == "" && items.length > 1) {
                //去掉第一个无用的元素
                items = items.slice(1);
            }
            let keyword = items.pop();

            let cp = new Completion();
            let info = cp.getNamespceAndOwner(items);
            if(info == false) {
                //分析失败
                return [];
            }
            
            let ownname = info.ow;
            let namespace = info.ns;

            let result = cp.querByPreKwWithOwner(keyword, namespace, ownname);
            //限定左右与模糊匹配
            return result;
        }

        //这里使用新的set，避免污染
        let usingnamespace = this._getUsingNamespace(lines, filepath, owns);

        //找到归属
        let ownname = this._getPosOwner(data);

        //找出所有的变量定义
        let defineval = this._getDocumentDefineVal(data);

        //模糊前缀查找
        let cp = new Completion();
        let result = cp.querByPreKwInNamepsace(prekeyworld, usingnamespace, ownname, defineval);

        return result;
    };

    _getDocumentDefineVal = function (areas) {
        let findvardef = {};
        let processed = false;
        for (let i = areas.length - 1; i >= 0; i--) {
            let area = areas[i];
            area = area.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
            if(area.length > 2 && area[0] == ":" && area[1] == ":") {
                area = area.substring(2);
            }
            let beginpos = 0;
            beginpos = area.indexOf(';', beginpos);
            if (beginpos ==  -1) {
                if (processed) {
                    //终止执行
                    continue;
                }
                if (area.lastIndexOf("{") == -1) {
                    //终止执行
                    continue;
                }
                //可能是函数定义，此时需要找到参数
                let endpos = area.lastIndexOf(")");
                if(endpos == -1) {
                    //终止执行
                    continue;
                }
                let startpos = area.lastIndexOf("(", endpos);
                if (startpos == -1) {
                    //终止执行
                    continue;
                }
                processed = true;
                let params = area.substring(startpos + 1, endpos);
                this._getFunctionParams(params, findvardef);
                continue;
            }
            beginpos = 0;
            let maxRun = 0;
            while (true && maxRun < 500) {
                maxRun++;
                let endpos = area.indexOf(';', beginpos);
                if(endpos == -1) {
                    //没有找到更多的语句
                    if (!processed 
                        && area.lastIndexOf("{") != -1) {
                        //最后可能是函数定义函数定义
                        let presplitpos = area.lastIndexOf(";");
                        let params = area.substring(presplitpos + 1).trim();
                        if (/^(while|if|else|else[\s\t]{1,4}if)[\s\t]{0,4}\(|^do[\s\t]{0,4}{/g.test(params)){
                            //以上关键字导致的花括号
                            break;
                        }
                        processed = true;
                        this._getFunctionParams(params, findvardef);
                    }
                    break;
                }
                let lastpos = 0;
                let stype = this._getWordInString(area, beginpos, endpos - 1);
                if (stype.p == -1) {
                    //本次查找失败
                    beginpos = endpos + 1;
                    continue;
                }
                lastpos = stype.p;
                let sname = this._getWordInString(area, lastpos, endpos - 1);
                if (sname.p == -1) {
                    //本次查找失败
                    beginpos = endpos + 1;
                    continue;
                }
        
                let type = stype.s;
                let name = sname.s;
                if (!(/^[0-9a-z_]{1,64}$/ig.test(name))) {
                    //不符合命名规范
                    beginpos = endpos + 1;
                    continue;
                }

                //排除函数定义的可能性
                //????

                findvardef[name] = type;
                beginpos = endpos + 1;
            }
        }
        return findvardef;
    };

    //获取函数参数
    _getFunctionParams = function (params, findvardef) {
        params = params.replace(/([\t\n&*]{1,1})|(const)|(\)[\s\t]{0,10}{)/ig, "");
        let _codes = params.split(",");
        let codes = [];
        for (let i = 0; i < _codes.length; i++) {
            let _code = _codes[i].trim();
            if (_code.indexOf("<")) {
                let j = i;
                let maxRun = 0;
                while(true && maxRun < 500) {
                    maxRun++;
                    let result = this._getCharCountInStr(_code, 0, new Set(['<','>']))
                    if (result['<'] == result['>']) {
                        i = j;
                        codes.push(_code);
                        break;
                    }
                    j = j + 1;
                    if (j >= _codes.length) {
                        break;
                    }
                    _code = _code + _codes[j];
                }
                continue;
            }
            //加入
            codes.push(_code);
        }
        
        //logger.debug(codes);
        for(let i = 0; i < codes.length; i++) {
            let _code = codes[i].trim();
            let epos = _code.length - 1;
            let _eqpos = _code.lastIndexOf('=');
            if(_eqpos != -1) {
                epos = _eqpos - 1;
            }

            //获取=前面的非空格字符
            while (epos > 0) {
                if (_code[epos] != ' ') {
                    break;
                }
                epos--;
            }

            let pos = _code.lastIndexOf(' ', epos);
            if (pos == -1) {
                //参数定义有问题
                return;
            }
            let type = _code.substring(0, pos).trim();
            let name = _code.substring(pos, epos + 1).trim();
            findvardef[name] = type;
        }
    };

    //从字符指定区间找出一个word
    _getWordInString = function (str, beginpos, endpos) {
        let word = "";
        let keyword = new Set(['class', 'using', 'namespace', 'struct', 'enum', 'virtual', 'public:', 'private:', 'protected:', 'public', 'private', 'protected']);
        let passChar = new Set([' ', '\t', '\n', '(', '[', ';']);
        let returnFaildChar = new Set(['{', ',', '%', '=', '/', '#', '.']);

        for(let i = beginpos; i <= endpos; i++) {
            //特殊字符跳过
            if (passChar.has(str[i]) && word.length == 0) {
                if (str[i] == '(' || str[i] == '[') {
                    return { p: -1, s: '' };
                }
               continue;
            }

            if (str[i] == "*" || str[i] == "&") {
                //指针地址符号pass
                continue;
            }

            if (returnFaildChar.has(str[i])) {
                //直接返回失败
                if (str[i] == '/' && i + 1 <= endpos ) {
                    if (str[i + 1] == "/") {
                        //此行为注释行，跳过
                        let tmppos = str.indexOf('\n', i + 1);
                        if (tmppos >= endpos) {
                            return { p: -1, s: '' };
                        }
                        i = tmppos;
                        word = "";
                        continue;
                    }

                    if (str[i + 1]  == "*") {
                        //此行为注释行，跳过
                        let tmppos = str.indexOf('*/', i + 1);
                        if (tmppos >= endpos) {
                            return { p: -1, s: '' };
                        }
                        i = tmppos;
                        word = "";
                        continue;
                    }
                }
                return { p: -1, s: '' };
            }
            
            if (passChar.has(str[i])) {
                //碰到哦这种字符需要直接返回
                word = word.trim();
                if (word == "const") {
                    word = "";
                    continue;
                }
                if (keyword.has(word)) {
                    return { p: -1, s: '' };
                }
                let lastpos = i;
                return { p: lastpos, s: word};
            }

            if (str[i] == "<") {
                //可能是模板定义方法
                let _pos = i;
                let _beginpos = _pos;
                let _endpos = _pos;
                let maxRun = 0;
                while (true && maxRun < 500) {
                    maxRun++;
                    _endpos = str.indexOf('>', _pos + 1);
                    if (_endpos == -1) {
                        //<>不匹配
                        return { p: -1, s: '' };
                    }
                    _beginpos = str.indexOf('<', _beginpos + 1);
                    if (_beginpos == -1) {
                        //查找结束
                        word = word + str.substring(i, _endpos + 1);
                        word = word.trim();
                        if (word == "const") {
                            word = "";
                            continue;
                        }
                        if (keyword.has(word)) {
                            return { p: -1, s: '' };
                        }
                        let lastpos = _endpos + 1;
                        return { p: lastpos, s: word.trim() };
                    }
                    _pos = _endpos;
                }   
            }

            word = word + str[i];
            
        }
        return { p: beginpos, s: word };
    };

    //获取当前光标的归属，即当前在哪个类理
    _getPosOwner = function(areas) {
        for (let i = areas.length - 1; i >= 0; i--) {
            let area = areas[i];
            let endpos = area.lastIndexOf('{');
            if (endpos == -1) {
                //没有花括号闭合，不太可能找到归属
                continue;
            }
            //往前找一个分号
            let beginpos = area.lastIndexOf(';', endpos);
            if (beginpos == -1) {
                //这种情况可能是类定义，此种情况需要在找一次类定义
                beginpos = area.lastIndexOf('class ', endpos);
                if (beginpos == -1) {
                    //这里未找到也不拦截
                }
            }

            let code = area.substring(beginpos, endpos);
            //::去掉前后空格
            code = code.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
            if(code.length > 2 && code[0] == ":" && code[1] == ":") {
                code = code.substring(2);
            }
            //从前往后找(
            beginpos = code.indexOf('(');
            if (beginpos == -1 ) {
                beginpos = code.length - 1;
            }

            let result = this._getCharCountInStr(code, beginpos , new Set(['(', ')']));
            if (result['('] != result[')'] || result['('] > 1) {
                //圆括号不闭合，直接失败
                continue;
            }
            
            //直接排除的关键字
            let stopKeyword = new Set('if', 'else', 'while', 'do', 'for');
            //从该位置往前收集关键字
            let findword = "";
            for (let j = beginpos ; j > 0; j--) {
                if (code[j] != " ") {
                    findword = code[j] + findword;
                }
                if (stopKeyword.has(findword)
                    && code[j - 1] == ""){
                    //确定不是函数实现也不是类定义
                    break;
                }

                if ((code[j] == ' ' || code[j] == '\r' || code[j] == '\n') && findword != '') {
                    //前面的是否为 class A格式
                    let _tmpstr = code.substring(0, j).trim();
                    let _pos = _tmpstr.lastIndexOf("class ");
                    let _posend = _tmpstr.lastIndexOf(":");
                    if(_posend < 0) {
                        _posend = _tmpstr.length + 1;
                    }
                    if(_pos != -1) {
                        let ownname = _tmpstr.substring(_pos + 6, _posend).trim();
                        logger.debug(ownname);
                        return ownname;
                    }

                    //看看是否格式为A::B的形式
                    let _endPos = findword.indexOf("::");
                    if(_endPos != -1) {
                        //函数实现，测试::前面的为归属类
                        let ownname = findword.substring(0, _endPos).trim();
                        return ownname;
                    }

                    //可能是类定义，下一个关键字是否为class
                    let _tmppos = code.lastIndexOf("class ", j);
                    if (_tmppos == -1 
                        || (_tmppos - 1 >= 0 && (code[_tmppos - 1] != " " && code[_tmppos - 1] != "\r" && code[_tmppos - 1] != "\n"))) {
                        //没有class关键字
                        break;
                    }
                    
                    let ownname = findword.trim();
                    if(/^[a-z0-9_]{2,64}$/ig.test(ownname)) {
                        return ownname;
                    }
                    break;
                }
            }
        }
        return "";
    };

    //获取字符串中指定字符的个数
    _getCharCountInStr(str, beginpos, charset) {
        let result = {};
        charset.forEach(e => { result[e] = 0; });
        for (let i = beginpos; i < str.length; i++) {
            if (charset.has(str[i])) {
                result[str[i]]++;
            }
        }
        return result;
    };

    //重新加载单个文件
    _reloadOneIncludeFile = function(filepath, callback = null) {

        cluster.setupMaster({
            exec: __dirname + "/worker/rebuildAllFileIndex.js",
            silent: false,
            windowsHide: true
        });

        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            msg_type: 2,//0:表示全量加载；1:表示重新加载知道文件，此时data中需要有filepath
            data: {
                basepath: this.basedir,
                dbpath: this.dbpath,
                filepath: filepath,
                userConfig: this.userConfig
            }
        }
        worker.send(parasms);
        worker.on('message', (data) => {
            let value = data['process'];
            if (data.function == "rebuild") {
                logger.debug("当前进度：%f%，总共：%d，当前：%d", value["showprocess"],
                    value["totalNum"], value["index"]);
                return;
            }
            if (data.function == "error") {
                //报错，执行未完成
                worker.kill();
                callback("error");
                return;
            }

            if (data.function == "over") {
                //任务完成关闭子进程
                worker.kill();
                callback("success");
                return;
            }
        });
    };

    //初始化系统头文件索引库
    _initSystemIncludeIndex = function (callback) {
        let that = this;
        cluster.setupMaster({
            exec: __dirname + "/worker/unzipSystemIncludeWorker.js",
            silent: false,
            windowsHide: true
        });

        //锁住功能
        that.loadindex = true;
        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            extpath: this.extPath,
            dbpath: this.dbpath
        }
        worker.send(parasms);
        worker.on('message', (data) => {
            if (data.function == "over") {
                //任务完成关闭子进程
                worker.kill();
                // that.loadindex = false;
                callback("success");
                return;
            }
            if(data.function == "can_not_import"){
                //任务完成关闭子进程
                worker.kill();
                // that.loadindex = false;
                callback("can_not_import");
                return;
            }
        });
        worker.on('exit', (code, signal) => {
            //恢复正常功能
            //这里不需要恢复正常功能，否则导致变量被设置成false
            // logger.debug("xxxxxxxxxx:exit");
            // that.loadindex = false;
        });
    };

    //全部扫描修改过的头文件重新分析
    _reloadAllIncludeFile = function (callback = null) {
        let that = this;
        cluster.setupMaster({
            exec: __dirname + "/worker/rebuildAllFileIndex.js",
            silent: false,
            windowsHide: true
        });

        //锁住功能 wal模式不需要锁
        that.loadindex = true;
        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            msg_type: 0,//0:表示全量加载；1:表示重新加载知道文件，此时data中需要有filepath
            data: {
                basepath: this.basedir,
                dbpath: this.dbpath,
                userConfig: this.userConfig
            }
        }
        logger.debug("_reloadAllIncludeFile", JSON.stringify(parasms));
        worker.send(parasms);
        worker.on('message', (data) => {
            let value = data['process'];
            if (data.function == "include") {
                callback("inlcude_process", value["showprocess"], value["totalNum"], value["index"]);
                return;
            } 
            if (data.function == "source") {
                callback("source_process", value["showprocess"], value["totalNum"], value["index"]);
                return;
            } 

            if (data.function == "error") {
                //报错，执行未完成
                worker.kill();
                that.loadindex = false;
                callback("error", 0, 0, 0);
                return;
            }

            if (data.function == "over") {
                //任务完成关闭子进程
                worker.kill();
                that.loadindex = false;
                callback("success", 0, 0, 0);
                return;
            }

            if(data.function == "scan_ing") {
                //扫码目录回调
                callback("scan_ing", 0, 0, 0, data.extdata);
                return;
            }

            if(data.function == "stop_load_index"){
                worker.kill();
                that.loadindex = false;
                callback(data.function, 0, 0, 0);
                return;
            }

            //其他函数
            callback(data.function, 0, 0, 0);
            
        });
        worker.on('exit', (code, signal) => {
            //恢复正常功能
            that.loadindex = false;
        });
    };

    //重新分析一批文件
    _reloadBatchIncludeFile = function (filepaths, callback = null) {
        let that = this;
        cluster.setupMaster({
            exec: __dirname + "/worker/rebuildAllFileIndex.js",
            silent: false,
            windowsHide: true
        });

        //锁住功能 wal模式不需要锁
        that.loadindex = true;
        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            msg_type: 0,//0:表示全量加载；1:表示重新加载知道文件，此时data中需要有filepath
            data: {
                basepath: this.basedir,
                dbpath: this.dbpath,
                filepaths: filepaths,
                userConfig: this.userConfig
            }
        }
    
        worker.send(parasms);

        worker.on('message', (data) => {
            let value = data['process'];
            if (data.function == "rebuild") {
                //logger.debug("当前进度：%f%，总共：%d，当前：%d", value["showprocess"],
                //value["totalNum"], value["index"]);
                callback("process", value["showprocess"], value["totalNum"], value["index"]);
                return;
            }
            if (data.function == "error") {
                //报错，执行未完成
                worker.kill();
                callback("error", 0, 0, 0);
                return;
            }

            if (data.function == "over") {
                //任务完成关闭子进程
                callback("success", 0, 0, 0);
                that.loadindex = false;
                worker.kill();
                return;
            }
        });

        worker.on('exit', (code, signal) => {
            //恢复正常功能
            // callback("success", 0, 0, 0);
            that.loadindex = false;
        });
    };

    _rfindPairPos = function(str, rpos, begin, end) {
        let num = 0;
        for(let i = rpos; i >= 0; i--) {
            if (str[i] == end) {
                num++;
            }
            if (str[i] == begin) {
                num--;
            }
            if (num == 0) {
                //找到头了
                return i - 1;
            }
        }
        return -1;
    };

    //从字符串中获取一个合法的名字
    _getLegalName = function(str, rpos) {
        let name = "";
        for(let i = rpos; i >= 0; i--) {
            if ((str[i] >= 'a' && str[i] <= 'z')
                || (str[i] >= 'A' && str[i] <= 'Z')
                || (str[i] >= '0' && str[i] <= '9')
                || (str[i] == '_')){
                name = str[i]+ name;
                continue;
            }
            break;
        }
        return name;
    };

    //闭合匹配
    _getCloseMark = function(str, ipos, bmark, emark) {
        if (str[ipos] != bmark) {
            //输入符号异常
            return false;
        }
        //xxxx(ddd())
        let _bpos = ipos;
        let _epos = ipos;
        let maxRun = 0;
        while (true && maxRun < 500) {
            maxRun++;
            _epos = str.indexOf(emark, _epos + 1);
            if (_epos == -1) {
                //未找到，直接失败
                return false;
            }
            let _pos = str.lastIndexOf(bmark, _epos);
            if (_pos == -1) {
                //理论上不会进这里
                break;
            }
            if (_bpos == _pos) {
                //找寻完毕
                return _epos;
            }
            _bpos = _pos;
        }
        return false;
    };

    //匹配闭合位置
    _getRCloseMark = function(str, ipos, bmark, emark) {
        if (str[ipos] != emark) {
            //输入符号异常
            return false;
        }
        //aaaa(ddd())
        let _bpos = ipos;
        let _epos = ipos;
        let maxRun = 0;
        while(true && maxRun < 500) {
            maxRun++;
            _bpos = str.lastIndexOf(bmark, _bpos - 1);
            if(_bpos == -1) {
                //未找到，直接失败
                return true;
            }

            let _pos = str.indexOf(emark, _bpos);
            if(_pos == -1) {
                //理论上不会进这里
                break;
            }
            if (_pos == _epos) {
                //找寻完毕
                return _bpos;
            }
            _epos = _pos;
        }

        return false;
    };

    _getNameFromStr = function(data, str, lastpos, type) {

        let pchar = str[lastpos];
        if (pchar == ')') {
            //函数形式
            let bpos = this._getRCloseMark(str, lastpos, '(', ')');
            if (!bpos) {
                //[]未闭合
                return [];
            }
            return this._getNameFromStr(data, str, bpos - 1, 'f');
        }
        if (pchar == ']') {
            //数组形式
            let bpos = this._getRCloseMark(str, lastpos, '[', ']');
            if (!bpos) {
                //[]未闭合
                return [];
            }
            let item = { n: "operator[]", t: 'f' };
            data.push(item);
            return this._getNameFromStr(data, str, bpos - 1, 'p');
        }
        if ((pchar >= 'a' && pchar <= 'z')
            || (pchar >= 'A' && pchar <= 'Z')
            || (pchar >= '0' && pchar <= '9')
            || pchar == '_') {
            
            //属性定义
            let findname = "";
            let _posgener = str.lastIndexOf('.', lastpos);
            let _pospoint = str.lastIndexOf('->', lastpos);
            
            if (_pospoint == -1 && _posgener == -1) {
                //查找完毕
                findname = str.substring(0, lastpos + 1).trim();
                let stoppos = this._strHasOtherChar(findname);
                if (stoppos == -2) {
                    //非变量名称
                    return [];
                }
                if(stoppos > -1) {
                    findname = findname.substring(stoppos + 1);
                }
                let item = { n: findname.trim(), t: type };
                data.push(item);
                return data;
            }
           
            //只找到->和.分割都找到，使用大的
            if (_posgener > _pospoint) {
                findname = str.substring(_posgener + 1, lastpos + 1).trim();
                let stoppos = this._strHasOtherChar(findname);
                if (stoppos == -2) {
                    //非变量名称
                    return [];
                }
                if (stoppos > -1) {
                    findname = findname.substring(stoppos + 1);
                    let item = { n: findname.trim(), t: type };
                    data.push(item);
                    return data;
                }
                let item = { n: findname.trim(), t: type };
                data.push(item);
                return this._getNameFromStr(data, str, _posgener - 1, 'p');
            } else {
                findname = str.substring(_pospoint + 2, lastpos + 1).trim();
                let stoppos = this._strHasOtherChar(findname);
                if (stoppos == -2) {
                    //非变量名称
                    return [];
                }
                if (stoppos > -1) {
                    findname = findname.substring(stoppos + 1);
                    let item = { n: findname.trim(), t: type };
                    data.push(item);
                    return data;
                }
                let item = { n: findname.trim(), t: type };
                data.push(item);
                return this._getNameFromStr(data, str, _pospoint - 1, 'p');
            }
        }

        return data;
    };

    _strHasOtherChar = function(findstr) {
        //以下符号修改请注意兼容
        let setEnd = new Set(['(', '[', '{', ')', '<', '=', '-', '+', '*', '\\', ';', ' ', '\t', '\n', ',', '&', '*', '!', '|', ':']);
        let index = findstr.length - 1; 
        for (; index >= 0; index--) {
            let pchar = findstr[index];
            if ((pchar >= 'a' && pchar <= 'z')
                || (pchar >= 'A' && pchar <= 'Z')
                || (pchar >= '0' && pchar <= '9')
                || pchar == '_') {
                continue;
            }
            if(pchar == ':' && findstr[index - 1] == ":") {
                //带命名空间
                return -2;
            }
            if (setEnd.has(pchar)) {
                break;
            } else {
                return -2;
            } 
        }
        return index;
    };

    //变量名称，只允许a-zA-Z0-9_
    _getValName = function (lines) {
        lines = lines.trim();
        if(lines[lines.length - 1] == "-" || lines[lines.length - 1] == "."){
            lines = lines.substring(0, lines.length - 1);
        }
        if(lines[lines.length - 1] == ">" && lines[lines.length - 1] == "-"){
            lines = lines.substring(0, lines.length - 2);
        }
        lines = lines.replace(/[\s\t]{1,10}[.]{1,1}[\s\t]{1,10}/g, '.');
        lines = lines.replace(/[\s\t]{1,10}->[\s\t]{1,10}/g, '->');
        let data = [];
        data = this._getNameFromStr(data, lines, lines.length - 1, 'p');
        return data;
    };

    //回溯找到变量定义
    _getValDefineOwn = function(lines, valname) {
        for (let i = lines.length - 1; i >= 0; i--) {
            let line = lines[i].trim();
            let pos = this._findVanamePos(line, valname);
            let ragx = new RegExp(`[\\s]{1,10}[*&]{0,1}${valname}[\\s()=;,]{1,10}`, 'g');
            if (pos == -1 || !ragx.test(line)) {
                //未找到直接跳过
                if(pos != -1){
                    let ragx = new RegExp(`[\\s]{1,10}[*&]{0,1}${valname}[\\s]{0,10}$`, 'g');
                    if(!ragx.test(line)){
                        continue;
                    }
                } else{
                    continue;
                }
            }
            
            let _sourceline = lines[i];
            let sourctline = line;
            let pretype = line.substring(0, pos);
            let _pretype = pretype;
            let beginpos = pretype.lastIndexOf("(");
            if (beginpos != -1) {
                pretype = pretype.substring(beginpos + 1);
            }
            if(pretype == "))" || pretype == ")") {
                //可能是typeof()
                beginpos = _pretype.lastIndexOf("typeof");
                if(beginpos == -1) {
                    //未通过闭合匹配
                    continue;
                }
                let _tmptype = _pretype.substring(beginpos);
                let markResult = this._getRCloseMark(_tmptype, _tmptype.length - 1, '(', ')');
                //let markResult = this._getCloseMark(_tmptype, 6, '(', ')');
                if(markResult === false
                    || markResult != 6) {
                    //匹配成功的位置
                    //匹配失败，这里注意不是判断否，因为有可能返回0，但是是成功的
                    continue;
                }
                pretype = "typeof";
            }

            pretype = pretype.trim();

            if(pretype[pretype.length - 1] == ","
                && pretype.indexOf(" ") != -1) {
                //一行包含多变量定义
                let _pos = pretype.indexOf(" ");
                pretype = pretype.substring(0, _pos);
            }

            if(pretype[pretype.length - 1] == "=") {
                //这种肯定不是定义
                continue;
            }

            let ispoint = 0;
            if(pretype.indexOf('*') != -1) {
                ispoint = 1;
            }
            pretype = pretype.replace(/([*&]{1,2})|(const )|(static )/g, "").trim();
            if (pretype != "return" 
                && /^[a-z0-9_:]{1,512}$/ig.test(pretype)) {
                //符合变量定义
                if(pretype.indexOf("::") == 0) {
                    pretype = pretype.substring(2);
                }
                return { t: pretype, l: sourctline, ol:_sourceline, p: ispoint };
            }
            
            let result = this._getCharCountInStr(pretype, 0, new Set(['<', '>', ':']));
            if (pretype != "return"
                && result['<'] == result['>'] 
                && result['>'] >= 1 
                && result[':'] % 2 == 0) {
                //带模版的类型
                if(pretype.indexOf("::") == 0) {
                    pretype = pretype.substring(2);
                }
                if(/[\w\s:]{1,256}/g.test(pretype)
                    || (pretype.indexOf("<") != -1 && pretype[pretype.length - 1] == ">")) {
                    //定义不能有其他字符
                    pretype = pretype.replace(/[\s]{0,4}[<>]{1,1}[\s]{0,4}/g, (kw)=>{ return kw.trim(); });
                    return { t: pretype, l: sourctline, ol:_sourceline, p: ispoint };
                }
            }
        }
        if(valname == "this") {
            return { t: "this", l: "", ol:"", p: 0, pos: -1};
        }
        return { t: "", l: "", ol:"", p: 0, pos: -1};
    };

    _getFileNamespace = function (lines) {
       
        let data = [];
        for(let i = 0; i < lines.length; i++) {
            let pos = lines[i].indexOf("namespace");
            if (pos != -1) {
                data = lines.slice(i, i + 20);
                break;
            }
        }

        let nsdata = data.join(" ");
        nsdata = nsdata.replace("{", " { ");
        nsdata = nsdata.replace("}", " } ");
        let items = nsdata.split(/[\s\t]{1,10}/);
        let stk = [];
        for(let i = 0; i < items.length; i++) {
            if(items[i] == "namespace" && items[i+2] == '{') {
                stk.push(items[ i + 1]);
                i = i + 2;
                continue;
            }
            if (items[i] != '{'){
                stk.push('');
                continue;
            }
            if (items[i] != '}') {
                stk.pop();
                continue;
            }
        }
        stk = stk.filter((e)=>{ return e != ""; });
        return stk.join("::");
    };

    _findObjctWhitNames = function (objname, name) {
        //依次定位类型    
        let namespace = "";
        let classname = objname;
        let result = DefineMap.getInstace().getRealName(objname);
        namespace = result.namespace;
        classname = result.name;
        // let lpos = objname.lastIndexOf('::');
        // if (lpos != -1) {
        //     namespace = objname.substring(0, lpos);
        //     classname = objname.substring(lpos + 2);
        // }

        let types = [TypeEnum.VARIABLE, TypeEnum.FUNCTION];
        let infos = KeyWordStore.getInstace().getByFullname(classname, namespace, name.n, types);
        if (!infos || infos.length <= 0) {
            //查找失败
            return false;
        }
        let info = infos[0];
        if (info.type == TypeEnum.FUNCTION) {
            //如果是函数，则返回函数的返回值
            let extData = JSON.parse(info.extdata);
            if (extData.length > 0 && extData[0].r) {
                let type = extData[0].r.t;
                return DefineMap.getInstace().getRealNameWithOwner(type, classname, namespace);
            }
            return false;
        }

        if (info.type == TypeEnum.VARIABLE) {
            //如果是变量，则返回变量的类型
            let extData = JSON.parse(info.extdata);
            let type = extData.t;
            return DefineMap.getInstace().getRealNameWithOwner(type, classname, namespace);
        }

        return false;
    };

    //类或者命名空间对象输入点之后提取
    _getAllNameByObj = function (filepath, filecontext, owns = []) {
        let analyse = new AnalyseDomain(filecontext);
        let data = analyse.doAnalyse();
        filecontext = data.reverse().join('\n');
        filecontext = filecontext.replace(/using namespace/g, "using_ns");
        let lines = filecontext.split('\n');

        //这里使用新的set，避免污染
        let usingnamespace = this._getUsingNamespace(lines, filepath, owns);

        //先找到最后一行的变量名称
        let lastline = lines[lines.length - 1];
        let names = this._getValName(lastline);
        if (names.length <= 0) {
            //未找到合适的名字
            return [];
        }

        //提示处理类
        let cp = new Completion();
        
        //弹出最顶的，用来找定义
        let name = names.pop();
        //获取当前操作的wonname中
        let _ownname = this._getPosOwner(data);
        let _valetype = { t: _ownname, l: "p", ol:'p', p: lastline, pos: -1 };
        if (name.n != "this") {
            //非this指针，需要找出变量定义的类型
            _valetype = this._getValDefineOwn(lines, name.n);
        } 
        if (_valetype.t == "") {
            //未找到类型，异常情况
            //可能是类本身的成员遍历
            let _type = cp.getTypeByOwnerAndNameInNamespace(_ownname, name.n, usingnamespace);
            if(_type == false) {
                return [];
            }
            _valetype = { t: _type, l: "p", p: "", pos: -1 };
        }

        if (_valetype.t == "auto" || _valetype.t == "typeof") {
            //这种情况类型有后面的值确定
            let line = _valetype.l;
            let _pos = line.indexOf(_valetype.t);
            let _beginpos = line.indexOf("=", _pos);
            if(_beginpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                //兼容for(auto a: fddd)语法
                _beginpos = line.indexOf(":", _pos);
            }
            if (_pos == -1 || _beginpos == -1) {
                //没有值无法定位
                return [];
            }
            let _endpos = line.indexOf(";", _pos);
            if(_endpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                //兼容for(auto a: fddd)语法
                _endpos = line.indexOf("{", _pos);
                _endpos = line.lastIndexOf(")", _endpos);
            }
            let _type = line.substring(_beginpos + 1, _endpos).trim();
            let _names = this._getValName(_type);
            names = names.concat(_names);
            if (names.length <= 0) {
                //未找到合适的名字
                return [];
            }
            let name = names.pop();
            _valetype = this._getValDefineOwn(lines, name.n);
        }
        let valetype = _valetype.t;
    
        //转化成全名称
        valetype = cp.getClassFullName(valetype, usingnamespace);
        for (let i = names.length - 1; i >= 0; i--) {
            //依次找最终的结构
            let _nameInfo = DefineMap.getInstace().getRealName(valetype);
            let _valetype = _nameInfo.namespace != "" ? _nameInfo.namespace + "::" + _nameInfo.name : _nameInfo.name;
            let tmptype = this._findObjctWhitNames(_valetype, names[i]);
            if(!tmptype) {
                //获取对象或者继承父中的定义
                let df = new Definition(this.basedir, this.extPath);
                valetype = this._getObjectName(df, _valetype, names[i].n, usingnamespace );
                if(valetype == false) {
                    //没有找到
                    return [];
                }
                break;
            }
            valetype = cp.getMapedName(tmptype, valetype, _nameInfo.name, _nameInfo.namespace);
            usingnamespace.push(_nameInfo.namespace);
            valetype = cp.getClassFullName(valetype, usingnamespace);
        }
        
        return this._getClassAndInheritFuntionAndVar(cp, valetype, _ownname, usingnamespace);
    };

    //获取类的成员函数，包括继承的父类
    _getObjectName = function(df, valetype, names, usingnamespace) {
        //尝试获取继承父的方法
        let maxInherit = 5;
        let ownnames = [valetype];
        let dequeue = [valetype];
        while(--maxInherit > 0) {
            let _valtype = dequeue.pop();
            if(!_valtype) {
                //无元素可处理
                break;
            }
            let result = df.getClassDefineInfo(_valtype, usingnamespace);
            if (result == false) {
                //没找到定义
                break;
            }
            let inheritclass = result.inherit;
            let mergerClassName = [];
            for(let i = 0; i < inheritclass.length; i++) {
                let _className = inheritclass[i].replace(/\<[\s\w,]{2,256}\>/, "");
                dequeue.push(_className);
                mergerClassName.push(_className);
            }
            ownnames = ownnames.concat(mergerClassName);
        };
        
        let fileinfo = df.getDefineInWitchClass(ownnames, names, usingnamespace);
        if (fileinfo == false) {
            //未找到定义
            return false;
        }
        let extJson = JSON.parse(fileinfo.info.extdata);
        valetype = extJson[0].r.t;
        valetype = df.getClassFullName(valetype, usingnamespace);
        return valetype;
    };

    //自动填参数分析
    _autoFillParams = function(filepath, filecontext, preParams){
        filecontext = filecontext.substring(0, filecontext.length - preParams.length - 1);
        let analyse = new AnalyseDomain(filecontext);
        let data = analyse.doAnalyse();
        filecontext = data.reverse().join('\n');
        filecontext = filecontext.replace(/using namespace/g, "using_ns");
        let lines = filecontext.split('\n');

        //这里使用新的set，避免污染
        let usingnamespace = this._getUsingNamespace(lines, filepath, []);

        //先找到最后一行的函数
        let lastline = lines[lines.length - 1];
        let names = this._getValName(lastline);
        if (names.length <= 0) {
            //未找到合适的名字
            return [];
        }

        //获取参数位置
        preParams = preParams.replace(/\([a-z0-9_\(\)\[\].: \->]{1,128}\)/ig, "");
        let params = preParams.split(",");
        let paramsPos = params.length;

        let valetype = "";
        if(names.length > 1) {
            //弹出最顶的，用来找定义
            let name = names.pop();
            //获取当前操作的wonname中
            let _ownname = this._getPosOwner(data);
            let _valetype = { t: _ownname, l: "p", ol:'p', p: lastline, pos: -1 };
            if (name.n != "this") {
                //非this指针，需要找出变量定义的类型
                _valetype = this._getValDefineOwn(lines, name.n);
            }
            valetype = _valetype.t;
        }

        //找到函数定义
        //转化成全名称
        let afp = new AutoFillParam();
        valetype = afp.getClassFullName(valetype, usingnamespace);
        if(valetype == "") {
            //未找到类型定义，可能未内部函数成员变量，或者全局变量
            let name = names[0].n;
            let _ownname = this._getPosOwner(data);
            let ownnames = ['', _ownname];
            let realName = afp.getRealOwnByName(name, ownnames, usingnamespace);
            if(!realName) {
                //真正没找到定义
                return [];
            }
            valetype = realName;
        }

        for (let i = names.length - 1; i >= 1; i--) {
            //依次找最终的结构
            let _nameInfo = DefineMap.getInstace().getRealName(valetype);
            let _valetype = _nameInfo.namespace != "" ? _nameInfo.namespace + "::" + _nameInfo.name : _nameInfo.name;
            let tmptype = this._findObjctWhitNames(_valetype, names[i]);
            if(!tmptype) {
                return [];
            }
            valetype = afp.getMapedName(tmptype, valetype, _nameInfo.name, _nameInfo.namespace);
        }

        let functionName = names[0];
        logger.debug(valetype);

        //获取方法的定义
        afp.setParamsInfo(filecontext, preParams, paramsPos);
        return afp.autoAnalyseParams(valetype, functionName.n, usingnamespace);
    };

    //获取归属类或者继承父类的下函数定义
    _getClassAndInheritFuntionAndVar = function (cp, valetype, ownname, usingnamespace) {
        let queue = [valetype];
        let showitem = [];
        let deeppath = 0;
        //继承类处理
        let maxRun = 0;
        while (true && maxRun < 500) {
            maxRun++;
            if (queue.length <= 0 || deeppath > 5) {
                //已经没有元素了
                //防止死循环，最多只查找5层
                break;
            }
            let tmpvaltype = queue.pop();
            //获取命名空间名称
            //获取归属（类）名称
            let namespace = "";
            let classname = tmpvaltype;

            let _nameInfo = DefineMap.getInstace().getRealName(classname);
            namespace = _nameInfo.namespace;
            classname = _nameInfo.name;
            if(namespace == "") {
                //如果没有名空间，则获取全名重新解释
                let _classname = cp.getClassFullName(classname, usingnamespace);
                if(classname != _classname){
                    _nameInfo = DefineMap.getInstace().getRealName(_classname);
                    namespace = _nameInfo.namespace;
                    classname = _nameInfo.name;
                } 
            }

            let inherit = cp.getInheritOfClass(classname, namespace, usingnamespace);
            queue = queue.concat(inherit);
            
            let _showitem = cp.getByOwnerNameInNamespace(classname, namespace, ownname);
            showitem = showitem.concat(_showitem);
            deeppath++;
        }
        showitem = this._deleteRepeatInArray(showitem);
        return showitem;
    };

    //去重复
    _deleteRepeatInArray = function(array) {
        let setConter = new Set();
        let newArray = [];
        for(let i = 0; i < array.length; i++) {
            let item = array[i];
            if(setConter.has(item.s)) {
                //已经包含
                continue;
            }
            newArray.push(item);
            setConter.add(item.s);
        }
        return newArray;
    };

    //通过命名空间查找
    _getAllNameByNamespace = function (filepath, filecontext, owns = []) {

        //获取前面输入的命名空间
        let linecode = "";
        let _lastlinebeginpos = filecontext.lastIndexOf("\n");
        if (_lastlinebeginpos == -1) {
            linecode = _lastlinebeginpos;
        } else {
            linecode = filecontext.substring(_lastlinebeginpos);
        }

        //分解其中的命名空间层级
        linecode = linecode.replace(/[\s\t]{1,10}[:]{2,2}[\s\t]{1,10}/g, "::").trim();
        let maxdo = 2;
        while(maxdo--) {
            if(linecode[linecode.length - 1] == ":") {
                linecode = linecode.substring(0, linecode.length - 1);
            }
        }

        let result = /([a-z0-9_]{1,256}(::[a-z0-9_]{1,256}){0,10})$/ig.exec(linecode);
        if(result == null) {
            //未找到合法的
            return [];
        }

        linecode = linecode.substring(result.index);

        let namessspaces = linecode.split("::");
        namessspaces = namessspaces.filter((e) => { return e != "";});
        let fullns = namessspaces.join("::");

        let lastnamespace = namessspaces.pop();
        let ownnameepace = namessspaces.join("::");

        let cp = new Completion();
        let showitem = cp.getOnlyByNamespace(fullns);
        if(lastnamespace != "") {
            let _showitem = cp.getStaticByMthedAndVal(lastnamespace, ownnameepace);
            showitem = showitem.concat(_showitem);  
        }
        //这里是否要拉枚举呢（命名空间下枚举太大，这里不拉） 
        return showitem;
    };

    _getShowTips = function (filepath, data) {

        if(!data && data.length <= 0) {
            //一次情况
            return { t: "未获取到名称", d: "未获取到描述", f: -1 };
        }

        let fullnameinfo = JSON.parse(data.n);
        let ownname = fullnameinfo.o;
        let namespace = fullnameinfo.s;
        let name = fullnameinfo.n;
        let file_id = fullnameinfo.f;
        let type = fullnameinfo.t;

        if(fullnameinfo.d) {
            //自动填参数推荐来源
            return { t: "填参推荐", d: "系统为你挑选可能的取值，当前匹配度（最高1000）：" + fullnameinfo.d, f: -1 };
        }

        if (data.f == -1) {
            return { t: name, d: name, f: -1 };
        }

        let cp = new Completion();
        let info = cp.getShowDocument(ownname, namespace, name, type);
        if (!info && info.length <= 0) {
            let showdefie = name;
            if (fullnameinfo.t) {
                showdefie = fullnameinfo.t + " " + showdefie;
            }
            return { t: name, d: showdefie, f: -1 };
        }
        return info;
    };

    _findVanamePos = function(line, valname) {
        let pos = line.indexOf(" " + valname, 0);
        if (pos == -1) {
            pos = line.indexOf("*" + valname, 0);
        }
        if (pos == -1) {
            pos = line.indexOf("&" + valname, 0);
        }
        if (pos == -1) {
            pos = line.indexOf("\t" + valname, 0);
        }
        return pos;
    }

    _getUsingNamespace(lines, filepath, owns) {
        let usingnamespace = [''];
        //获取文档的内置命名空间
        let fileown = this._getFileNamespace(lines);
        if (fileown != "") {
            usingnamespace.push(fileown);
        }
        if (this.namespacestore[filepath]) {
            let uns = this.namespacestore[filepath];
            usingnamespace = usingnamespace.concat(uns);
        }
        let deplicate = new Set(usingnamespace);
        for (let i = 0; i < owns.length; i++) {
            if (!deplicate.has(owns[i])) {
                usingnamespace.push(owns[i]);
                deplicate.add(owns[i]);
            }
        }
        
        return usingnamespace;
    };

    //获取头文件定义
    _getIncludeDefine = function(sourceFile, includeFile, fileName) {
        let df = new Definition(this.basedir, this.extPath);
        if(fileName.indexOf(".pb.h") != -1) {
            //兼容proto
            fileName = fileName.replace(".pb.h", ".proto");
            includeFile = includeFile.replace(".pb.h", ".proto");
            logger.debug("process proto:", fileName);
        }

        let findIncludeFile = df.getIncludeInfo(sourceFile, includeFile, fileName);
        if(findIncludeFile == "") {
            //未找到头文件
            logger.debug("find include file error", includeFile);
            return false;
        }
    
        let _filename = this.basedir + findIncludeFile;
        if(!fs.existsSync(_filename)) {
            //可能是系统库
            _filename = __dirname + "/../data/" + findIncludeFile;
            if(!fs.existsSync(_filename)) {
                //未找到头文件
                logger.debug("find real include file error", includeFile, _filename);
                return false;
            }
        }

        let result = {
            filename: "file://" + _filename,
            bline: 0,
            bcols: 0,
            eline: 1,
            ecols: 0,
            linecode: findIncludeFile,
            prelinecode: findIncludeFile,
            title: "头文件"
        };
        if(_filename.indexOf('/') != 0) {
            result.filename = "file:///" + _filename;
        }
        return result;
    };

    //获取文档结构
    _getDocumentTree = function(filename, filecontext) {
        let analyse = new AnalyseTree.Analyse(filecontext, filename);
        logger.mark("Analyse");
        analyse.doAnalyse();
        logger.mark("Analyse");
        logger.mark("getDocumentStruct");
        showTree = analyse.getDocumentStruct();
        logger.mark("getDocumentStruct");
        if(showTree
            && showTree["name"] == "" 
            && showTree["child"].length == 0
            && showTree["function"].length == 0
            && showTree["variable"].length == 0
            && showTree["defines"].length == 0) {
            return false;
        }
        if(showTree
            && showTree["name"] == "" 
            && showTree["child"].length == 1
            && showTree["child"][0]["name"] == ""
            && showTree["function"].length == 0
            && showTree["variable"].length == 0
            && showTree["defines"].length == 0) {
            //调整格式，应该是个循环，但是这里只做一层
            showTree = showTree["child"][0];
        }
        return showTree;
    };

    //语法检查
    _diagnostics = function(filepath, filecontext, diagnosticscallback) {
        let that = this;
        cluster.setupMaster({
            exec: __dirname + "/worker/analyseDiagnostics.js",
            silent: false,
            windowsHide: true
        });

        //锁住功能 wal模式不需要锁
        that.loadindex = true;
        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            filecontext: filecontext,
            filename: filepath,
            dbpath: this.dbpath
        }
        logger.debug("_diagnostics", JSON.stringify(parasms));
        worker.send(parasms);
        worker.on('message', (data) => {
            if(data.type == "result") {
                logger.debug(data.data);
                //其他函数
                diagnosticscallback(data.data);
                worker.kill();
            }
        });
        worker.on('exit', (code, signal) => {
            //恢复正常功能
            that.loadindex = false;
        });
    };

    _getDefinePoint = function (filepath, filecontext, linelast, owns = []) {
        let analyse = new AnalyseDomain(filecontext);
        let data = analyse.doAnalyse();

        let lengthmeta = [];
        for(let i = 0; i < data.length; i++) {
            let area = data[i];
            let begin = filecontext.indexOf(area);
            let end = begin + area.length;
            lengthmeta.push({b:begin, e:end});
        }

        let _filecontext = data.reverse().join('\n');
        _filecontext = _filecontext.replace(/using namespace/g, "using_ns");
        let lines = _filecontext.split('\n');

        //这里使用新的set，避免污染
        let usingnamespace = this._getUsingNamespace(lines, filepath, owns);
        let ownname = this._getPosOwner(data);
        usingnamespace = this._splitForAllPathNamesapce(ownname, usingnamespace);

        //先找到最后一行的变量名称
        let lastline = lines[lines.length - 1];
        let names = this._getValName(lastline);
        if (names.length <= 0) {
            //未找到合适的名字
            //判断是否本身将是类型
            lastline = lastline.trim();
            lastline = lastline.replace(/[\s]{0,10}[:]{2,2}[\s]{0,10}/g, "::");
            if(lastline.length > 2 && lastline[0] == ":" && lastline[1] == ":" ) {
                lastline = lastline.substring(2);
            }
            let _tmpcodes = lastline.split(/[\s\t\n([{<]{1,1}/g);
            
            let _tmptype = lastline;
            if (_tmpcodes.length > 0) {
                _tmptype = _tmpcodes[_tmpcodes.length - 1].trim();
            }

            let _fullname = "";
            let df = new Definition(this.basedir, this.extPath);
            linelast = linelast.trim();
            //判断是否为合法的类型
            if (linelast[0] == '(') {
                //标明为方法定义
                return df.getFunctionDefineInfo( _tmptype, usingnamespace);
            } else {
                //类定义或者枚举值处理
                let result = df.getClassDefineInfo(_tmptype, usingnamespace);
                if (result == false) {
                    return false;
                }
                //如果是全名称定义，返回该定义
                _fullname = result.full_name;
                if(result.type == TypeEnum.ENUMITEM) {
                    let _items = _fullname.split("::");
                    let _name = _items.pop();
                    let _ownname = _items.pop();
                    let _namespace = _items.join("::");
                    return this._findAllNameInGlobal([], _name, _ownname, [_namespace]);
                }
            }
            return this._findOwnDefinePosOne(_fullname);
        }

        //弹出最顶的，用来找定义
        let name = names.pop();
        let _valetype = this._getValDefineOwn(lines, name.n);
        let valetype = _valetype.t;
        if (_valetype.t == "this") {
            //非this指针，需要找出变量定义的类型
            valetype = this._getPosOwner(data);
        } 
        if (_valetype.t == "auto" || _valetype.t == "typeof") {
            //这种情况类型有后面的值确定
            let line = _valetype.l;
            let _pos = line.indexOf(_valetype.t);
            let _beginpos = line.indexOf("=", _pos);
            if(_beginpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                //兼容for(auto a: fddd)语法
                _beginpos = line.indexOf(":", _pos);
            }
            if (_pos == -1 || _beginpos == -1) {
                //没有值无法定位
                return [];
            }
            let _endpos = line.indexOf(";", _pos);
            if(_endpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                _endpos = line.indexOf("{", _pos);
                _endpos = line.lastIndexOf(")", _endpos);
            }
            let _type = line.substring(_beginpos + 1, _endpos).trim();
            let _names = this._getValName(_type);
            names = names.concat(_names);
            if (names.length <= 0) {
                //未找到合适的名字
                return [];
            }
            let name = names.pop();
            _valetype = this._getValDefineOwn(lines, name.n);
            valetype = _valetype.t;
        }
        
        if (valetype != "" && names.length == 0) {
            //可能是本文档定义
            //同文件跳转
            let result = this._findDefineInDocument(_valetype, filecontext, lengthmeta, valetype, filepath, name);
            if(result) {
                return result;
            }
            //可能是函数定义，需要清空类型从全局或者owner找
            valetype = "";
        }

        if (valetype == "") {
            //可能不是本文档定义，尝试全局查找
            //找到归属
            return this._findAllNameInGlobal(names, name.n, ownname, usingnamespace);
        }

        //如果是关联跟踪
        if (names.length > 0) {
            //多级归属查找
            return this._findOwnDefinePost(names, valetype, usingnamespace);
        } 
        return false;
    };

    //同文档查找定义
    _findDefineInDocument = function(_valetype, filecontext, lengthmeta, valetype, filepath, name) {
        let sourceline = _valetype.ol;
        let beginlines = this._findLineNumWithCode(filecontext, lengthmeta, sourceline);
        let begincols = sourceline.indexOf(valetype);
        let endlines = beginlines;
        let endclos = begincols + valetype.length;
        let df = new Definition(this.basedir, this.extPath);
        let _filename = df.getFileInfoByFullName(filepath);
        logger.info("_filename:", _filename);
        let result = {
            filename: _filename,
            bline: beginlines,
            bcols: begincols,
            eline: endlines,
            ecols: endclos,
            linecode: sourceline,
            prelinecode: sourceline,
            title: name
        };
        return result;
    };

    //归属定义定位
    _findAllNameInGlobal = function (names, name, ownname, usingnamespace) {
        let df = new Definition(this.basedir, this.extPath);
        let owns = [''];

        let runcout = 5;
        let _getinherit = [ownname];
        while(true) {
            let _tmpClass = _getinherit.pop();
            if(!_tmpClass || runcout-- < 0){
                break;
            }
            if(_tmpClass == "") {
                continue;
            }

            //获取真姓名
            let _result = DefineMap.getInstace().getRealName(_tmpClass);
            if(_result.namespace == ""){
                _tmpClass = df.getClassFullName(_result.name, usingnamespace);
                _result = DefineMap.getInstace().getRealName(_tmpClass);
            }
            if(_result && _result.namespace.length >= 0) {
                //获取密命名空间和类名称
                usingnamespace.push(_result.namespace);
                _tmpClass = _result.name;
                owns.push(_tmpClass);
            }

            let inheritClass = df.getInheritOfClassByNamspaces(_tmpClass, usingnamespace)
            for(let i = 0; i < inheritClass.length; i++){
                _getinherit.push(inheritClass[i]);
            }
        }
        
        let result = df.getDefineInWitchClass(owns, name, usingnamespace);
        if (!result) {
            //全局和本类都为找到定义
            //判断是否可能为宏定义（执行到这里不可能是方法或者变量）
            result = KeyWordStore.getInstace().getByNameAndNamespaces(name, usingnamespace);
            if (!result || result.length == 0 ) {
                //去掉own查找也失败
                return false;
            }
            let hasResult = false;
            let info = null;
            for (let i = 0; i < result.length; i++) {
                info = result[i];
                if(info.type == TypeEnum.ENUMITEM) {
                    //枚举值跳转
                    let filepath = df.getFileInfo(info.file_id);
                    return df.readFileFindDefine(filepath, info.ownname, info.name, info.type);
                }
                hasResult = true;
            }
            if (hasResult 
                && (info.type == TypeEnum.CALSS
                    || info.type == TypeEnum.STRUCT
                    || info.type == TypeEnum.ENUM
                    || info.type == TypeEnum.TYPEDEF
                    || info.type == TypeEnum.DEFINE
                    || (info.type == TypeEnum.FUNCTION && names.length == 0)
                    || (info.type == TypeEnum.VARIABLE && names.length == 0))) {
                //变量定义
                //没有归属查找
                var file_id = df.getRealFileId(info);
                var sourcefilepath = df.getFileInfo(file_id);
                var filepath = df.getFileInfo(info.file_id);
                return df.readFileFindDefine(filepath, info.ownname, info.name, info.type, sourcefilepath);
            }
            return false;
        }

        let info = result.info;
        if (info.type == TypeEnum.CALSS
            || info.type == TypeEnum.STRUCT
            || info.type == TypeEnum.ENUM
            || info.type == TypeEnum.TYPEDEF
            || info.type == TypeEnum.DEFINE
            || (info.type == TypeEnum.FUNCTION && names.length == 0)
            || (info.type == TypeEnum.VARIABLE && names.length == 0)) {
            //变量定义
            //没有归属查找
            let file_id = df.getRealFileId(info);
            let sourcefilepath = df.getFileInfo(file_id);
            let filepath = df.getFileInfo(info.file_id);
            return df.readFileFindDefine(filepath, info.ownname, info.name, info.type, sourcefilepath);
        }

        if(info.type == TypeEnum.ENUMITEM) {
            //枚举值跳转
            let filepath = df.getFileInfo(info.file_id);
            return df.readFileFindDefine(filepath, info.ownname, info.name, info.type);
        }
        
        //变量多级跳转
        let typename = info.name;
        if (info.type == TypeEnum.VARIABLE) {
            let extJson = JSON.parse(info.extdata);
            typename = extJson.t;
            return this._findOwnDefinePost(names, typename, usingnamespace);
        }

        //函数多级跳转
        if (info.type == TypeEnum.FUNCTION) {
            let extJson = JSON.parse(info.extdata);
            typename = extJson.r.t;
            return this._findOwnDefinePost(names, typename, usingnamespace);
        }

       return false;
    };

    _findOwnDefinePosOne = function (fullname) {
        let df = new Definition(this.basedir, this.extPath);
        return df.findFullNameDefine(fullname);
    };

    //跨文件查找定义
    _findOwnDefinePost = function (names, valetype, usingnamespace) {
        let df = new Definition(this.basedir, this.extPath);
        //转化成全名称
        valetype = df.getClassFullName(valetype, usingnamespace);
        //保留第0个
        for (let i = names.length - 1; i > 0; i--) {
            //依次找最终的结构
            let _nameInfo = DefineMap.getInstace().getRealName(valetype);
            let tmptype = this._findObjctWhitNames(valetype, names[i]);
            if (!tmptype) {
                //尝试获取继承父的方法
                let maxInherit = 5;
                let ownnames = [valetype];
                let dequeue = [valetype];
                while(--maxInherit > 0) {
                    let _valtype = dequeue.pop();
                    if(!_valtype) {
                        //无元素可处理
                        break;
                    }
                    let result = df.getClassDefineInfo(_valtype, usingnamespace);
                    if (result == false) {
                        //没找到定义
                        break;
                    }
                    let inheritclass = result.inherit;
                    let mergerClassName = [];
                    for(let i = 0; i < inheritclass.length; i++) {
                        let _className = inheritclass[i].replace(/\<[\s\w,]{2,256}\>/, "");
                        dequeue.push(_className);
                        mergerClassName.push(_className);
                    }
                    ownnames = ownnames.concat(mergerClassName);
                };
                let fileinfo = df.getDefineInWitchClass(ownnames, names[i].n, usingnamespace);
                if (fileinfo == false) {
                    //未找到定义
                    return false;
                }
                let extJson = JSON.parse(fileinfo.info.extdata);
                valetype = extJson[0].r.t;
                valetype = df.getClassFullName(valetype, usingnamespace);
            } else {
                valetype = df.getMapedName(tmptype, valetype, _nameInfo.name, _nameInfo.namespace);
                usingnamespace.push(_nameInfo.namespace);
                valetype = df.getClassFullName(valetype, usingnamespace);
            }
        }

        //最后一个定义名称
        let lastname = names[0];

        //找到文件
        //转化成全名称
        let isProbuf = false;
        let maxInherit = 5;
        let ownnames = [valetype];
        let dequeue = [valetype];
        while(--maxInherit > 0) {
            let _valtype = dequeue.pop();
            if(!_valtype) {
                //无元素可处理
                break;
            }

            let result = df.getClassDefineInfo(_valtype, usingnamespace);
            if (result == false) {
                //未找到定义,跳过
                break;;
            }

            //这里只处理5层继承
            let inheritclass = result.inherit;
            let mergerClassName = [];
            for(let i = 0; i < inheritclass.length; i++) {
                if(inheritclass[i] == "google::protobuf::Message") {
                    isProbuf = true;
                }
                let _className = inheritclass[i];
                _className = _className.replace(/\<[\s\w,]{2,256}\>/, "");
                dequeue.push(_className);
                mergerClassName.push(_className);
            }
            ownnames = ownnames.concat(mergerClassName);
        }

        let name = lastname.n;
        if(isProbuf) {
            //当出现命名冲突的时候将无法提示
            //当出现set_xx_size的时候，会出现无法提示的问题
            name = name.replace(/^set_|^add_|^mutable_|^clear_|^has_|_size$|_IsValid$/g, "");
        }

        let fileinfo = df.getDefineInWitchClass(ownnames, name, usingnamespace);
        if (fileinfo == false) {
            //未找到定义
            return false;
        }

        let file_id = df.getRealFileId(fileinfo.info);
        let sourcefilepath = df.getFileInfo(file_id);

        let filepath = fileinfo.filepath;
        let ownname = fileinfo.ownname;
        
        //读取文件查找内容
        return df.readFileFindDefine(filepath, ownname, name, fileinfo.info.type, sourcefilepath);
    };

    //帮助提示
    _getSignatureHelp = function (filepath, filecontext, owns = []) {
        let _ipos = filecontext.lastIndexOf('(', filecontext.length);
        let laststr = "";
        if(_ipos != -1) {
            //裁剪到该位置
            laststr = filecontext.substring(_ipos);
            filecontext = filecontext.substring(0, _ipos);
        }

        if (this.fundefcache != "" && this.fundefcache != null) {
            //读缓存
            let cachesfunctiondef = JSON.parse(this.fundefcache);
            if (cachesfunctiondef['length'] == filecontext.length
                && cachesfunctiondef['filename'] == filepath) {
                //找到cache，直接用
                logger.debug("use cache info");
                let fundef = cachesfunctiondef.fundef;
                //获取参数个数
                let countmap = this._getCharCountInStr(laststr, 0, new Set([',']));
                fundef['paramsindex'] = countmap[','];
                return fundef;
            } else {
                //作废cache数据
                this.fundefcache = "";
            }
        }

        let analyse = new AnalyseDomain(filecontext);
        let data = analyse.doAnalyse();

        let lengthmeta = [];
        for (let i = 0; i < data.length; i++) {
            let area = data[i];
            let begin = filecontext.indexOf(area);
            let end = begin + area.length;
            lengthmeta.push({ b: begin, e: end });
        }

        let _filecontext = data.reverse().join('\n');
        _filecontext = _filecontext.replace(/using namespace/g, "using_ns");
        let lines = _filecontext.split('\n');

        let completion = new Completion();
        //这里使用新的set，避免污染
        let usingnamespace = this._getUsingNamespace(lines, filepath, owns);
        //先找到最后一行的变量名称
        let lastline = lines[lines.length - 1];
        logger.mark("_getValName");
        let names = this._getValName(lastline);
        logger.mark("_getValName");
        let info = null;
        if(names.length == 0) {
            //有可能是静态函数，或者命名空间下的全局函数
            lastline = lastline.trim();
            lastline = lastline.replace(/[\s]{0,10}[:]{2,2}[\s]{0,10}/g, "::");
            if(lastline.length > 2 && lastline[0] == ":" && lastline[1] == ":") {
                lastline = lastline.substring(2);
            }
            let _tmpcodes = lastline.split(/[\s\t\n([{<]{1,1}/g);

            let _tmptype = lastline;
            if (_tmpcodes.length > 0) {
                _tmptype = _tmpcodes[_tmpcodes.length - 1].trim();
            } else {
                return false;
            }

            //判断是否为合法的类型
            info = completion._GetStaticFunctionDefine(_tmptype, usingnamespace);
            if(!info) {
                //没有找到变量
                return false;
            }
        } else {
            
            //弹出最顶的，用来找定义
            let name = names.pop();
            logger.mark("_getValDefineOwn");
            let _valetype = this._getValDefineOwn(lines, name.n);
            logger.mark("_getValDefineOwn");

            if(_valetype.t == "") {
                //未找到变量类型，可能是函数或者宏定义
                let ownname = this._getPosOwner(data);
                info = completion._GetFunctionDefineByOwnAndName(name.n, ownname, usingnamespace);
            } else {
                logger.mark("_GetFunctionDefine");
                info = completion._GetFunctionDefine(names, _valetype.t, usingnamespace);
                logger.mark("_GetFunctionDefine");
            }
        }
        if (!info) {
            return false;
        }
        logger.mark("_getSignatureHelp");
        let result = completion._getSignatureHelp(filepath, info);
        logger.mark("_getSignatureHelp");
        if(result != false) {
            //加入缓存
            //保存缓存
            let cachesfunctiondef = {
                fundef: result,
                length: filecontext.length,
                filename: filepath
            };
            this.fundefcache = JSON.stringify(cachesfunctiondef);
        }

        //获取参数个数
        let countmap = this._getCharCountInStr(laststr, 0, new Set([',']));
        result['paramsindex'] = countmap[','];
        return result;
    };

    _findLineNumWithCode = function (filecontext, lengthmeta, linecode) {

        for(let i = 0; i < lengthmeta.length; i++){
            let linedata = filecontext.substring(lengthmeta[i].b, lengthmeta[i].e);
            let _pos = linedata.lastIndexOf(linecode);
            if(_pos != -1){
                //找到了
                let beginPos = lengthmeta[i].b + _pos + linecode.length;
                let _code = filecontext.substring(0, beginPos);
                let _countnum = this._getCharCountInStr(_code, 0, new Set(['\n']));
                return _countnum['\n'];
            }
        }
        return 0;
        
        // let ilength = linecode.length;
        // let lnum = 0;
        // let pos = filecontext.length - 1;
        // let maxRun = 0;
        // while (true && maxRun < 50000) {
        //     maxRun++;
        //     let _pos = filecontext.lastIndexOf("\n", pos);

        //     if(_pos == -1) {
        //         //未找到
        //         pos = _pos - 1;
        //         return -1;
        //     }
        //     let line = filecontext.substring(_pos, pos);
        //     if(line.trim().indexOf("//") == 0){
        //         pos = _pos - 1;
        //         lnum++;
        //         continue;
        //     }
        //     if (pos - _pos >= ilength && pos - _pos <= ilength + 8) {
        //         //判断起点是否在作用域范围
        //         for (let i = 0; i < lengthmeta.length; i++) {
        //             if (_pos >= lengthmeta[i].b && pos <= lengthmeta[i].e) {
        //                 //在作用域范围
        //                 let _line = filecontext.substring(_pos + 1, pos + 1);
        //                 if (_line.trim() == linecode.trim()) {
        //                     return lnum;
        //                 }
        //             }
        //         }
        //     }
        //     pos = _pos - 1;
        //     lnum++;
        // }
    };

    //标准化文件路径
    _filePathFormat = function(filepath) {
        if (filepath[0] != '/') {
            filepath = "/" + filepath;
        }
        return filepath;
    };

    _updateCheck = function(updatecallback) {
        cluster.setupMaster({
            exec: __dirname + "/worker/checkNeedUpdate.js",
            silent: false,
            windowsHide: true
        });

        const worker = cluster.fork();
        // paramsms结构定义
        let parasms = {
            baseurl: "http://cpptips.com:8888",
            basedir: "/Users/widyhu/.vscode/extensions/widyhu.cpptips-0.1.9/",
            intervaltime: 180000,
            maketools: 0
        }
        logger.debug(JSON.stringify(parasms));
        const path = require('path');
        let basedir = __dirname;
        basedir = path.resolve(basedir, '../');

        parasms.basedir =  basedir;
        parasms.baseurl = this.userConfig.updateCheckUrl;
        parasms.intervaltime = this.userConfig.updateCheckIntervalTime;
        // parasms.basedir = __dirname;
        
        worker.send(parasms);
        worker.on('message', (data) => {
            if(data == "exit") {
                worker.kill();
            }
            if(data == "update") {
                logger.debug("need update");
                updatecallback("update");
            }
        });
    };

    //////////////////////////////////////////////////////////////////////////////
    //一下方法提供给vscode调用
    //知道归属获取提示内容
    getAllNameByObj = function (filepath, filecontext, owns = []) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return [];
            }
            if(owns == null) {
                owns = [];
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("getAllNameByObj file type not match!");
                return [];
            }
            //test
            logger.mark("_getAllNameByObj");
            let result = this._getAllNameByObj(filepath, filecontext, owns);
            logger.mark("_getAllNameByObj");
            return result;
        } catch (error) {
            logger.debug("call getAllNameByObj faild!", error);
            return [];
        }
    };

    //通过命名空间查找
    getAllNameByNamespace = function (filepath, filecontext, owns = []) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return [];
            }
            if (owns == null) {
                owns = [];
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("getAllNameByNamespace file type not match!");
                return [];
            }
            return this._getAllNameByNamespace(filepath, filecontext, owns);
        } catch (error) {
            logger.debug("call getAllNameByObj faild!", error);
            return [];
        }
    };

    //获取提示说明
    getShowTips = function (filepath, data) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
            return this._getShowTips(filepath, data);
        } catch (error) {
            logger.debug("call _getShowTips faild!", error);
            return false;
        }
    }

    //前缀匹配
    searchKeyWord = function (filepath, prekeyworld, filecontext, owns = []) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return [];
            }

            if (owns == null) {
                owns = [];
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("searchKeyWord file type not match!");
                return [];
            }
            return this._searchKeyWord(filepath, prekeyworld, filecontext, owns);
        } catch (error) {
            logger.debug("call _searchKeyWord faild!", error);
            return [];
        }
    };

    //重新加载指定文件
    reloadOneIncludeFile = function (filepath, callback = null) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return;
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".proto", ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("reloadOneIncludeFile this file not include.");
                callback("error");
                return;
            }
            return this._reloadOneIncludeFile(filepath, callback);
        } catch (error) {
            logger.debug("call _reloadOneIncludeFile faild!", error);
            return;
        }
    };

    //重新加载一批文件
    reloadBatchIncludeFile = function (filepaths, callback = null) {
        try {
            if (this.loadindex) {
                //索引加载中，功能暂时不可用
                return false;
            }
            if (filepaths.length == 0) {
                //没有文件可处理
                return true;
            }
            return this._reloadBatchIncludeFile(filepaths, callback);
        } catch (error) {
            logger.debug("call _reloadOneIncludeFile faild!", error);
        }
        return true;
    };

    //重新加载修改过的文件
    reloadAllIncludeFile = function (callback = null) {
        try {
            if (!this.isinit || this.loadindex) {
                //索引加载中，功能暂时不可用
                logger.debug("索引加载中，功能暂时不可用");
                return;
            }
            let that = this;
            function initSystemIncludeOver(msg){
                if(msg == "can_not_import") {
                    callback("can_not_import", 0, 0, 0);
                }
                //加载工程头文件
                logger.info("begin _reloadAllIncludeFile!");
                //初始化db
                return that._reloadAllIncludeFile(callback);
            }
            //初始化系统头文件库
            logger.info("begin _initSystemIncludeIndex!");
            this._initSystemIncludeIndex(initSystemIncludeOver);
        } catch (error) {
            logger.debug("call _reloadOneIncludeFile faild!", error);
        }
    };

    //获取cpp文件的依赖
    getDependentByCpp = function (filepath, callback = null, isClose = false, isSave = false) {
        try {
            let that = this;
            filepath = this._filePathFormat(filepath);
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c", ".proto"]);
            if (!includeExt.has(fileExt)) {
                callback("fileerror", filepath, [], []);
                return;
            }
            
            let task = {
                filepath: filepath,
                callback: callback,
                isclose: isClose,
                issave : isSave
            };
            that.dependentQueue.enqueue(task);
        } catch (error) {
            callback("error", filepath, [], []);
            logger.debug("call getDependentByCpp faild!", error);
            return;
        }
    };

    //获取变量定义
    getDefinePoint = function (filepath, filecontext, linelast, owns = []) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
            if (owns == null) {
                owns = [];
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("getDefinePoint file type not match!");
                return false;
            }
            return this._getDefinePoint(filepath, filecontext, linelast, owns);
        } catch (error) {
            console.log("call getDefinePoint faild!", error);
            logger.debug("call getDefinePoint faild!", error);
            return false;
        }
    };

    //跳转头文件定义
	getIncludeDefine = function (sourceFile, includeFile) {
        try {
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
        
            let fileinfo = __path.parse(includeFile);
            let filename = fileinfo.base;
            let fileExt = fileinfo.ext;
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c", ""]); 
            if (!includeExt.has(fileExt)) {
                logger.debug("getIncludeDefine file type not match!");
                return false;
            }
            return this._getIncludeDefine(sourceFile, includeFile, filename);
        } catch (error) {
            logger.debug("call getDefinePoint faild!", error);
            return false;
        }
    };

    //参数提示
    getSignatureHelp = function (filepath, filecontext, owns = []) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
            if (owns == null) {
                owns = [];
            }
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("getSignatureHelp file type not match!");
                return false;
            }
            return this._getSignatureHelp(filepath, filecontext, owns);
        } catch (error) {
            logger.debug("call getSignatureHelp faild!", error);
            return [];
        }
    };

    //获取文档结构-非异步
    getDocumentTree = function(filepath, filecontext) {
        try {
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
        
            let fileinfo = __path.parse(filepath);
            let fileExt = fileinfo.ext;
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c", ""]); 
            if (!includeExt.has(fileExt)) {
                logger.debug("getDocumentTree file type not match!");
                return false;
            }
            return this._getDocumentTree(filepath, filecontext);
        } catch (error) {
            logger.debug("call getDefinePoint faild!", error);
            return false;
        }
    };

    //自动填参数
    autoFillParams = function(filepath, filecontext, preParams) {
        try {
            filepath = this._filePathFormat(filepath);
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return [];
            }
 
            let pos = filepath.lastIndexOf('.');
            let fileExt = filepath.substring(pos);
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
            if (!includeExt.has(fileExt)) {
                logger.debug("autoFillParams file type not match!");
                return [];
            }
            //test
            logger.mark("_autoFillParams");
            let result = this._autoFillParams(filepath, filecontext, preParams);
            logger.mark("_autoFillParams");
            return result;
        } catch (error) {
            logger.debug("call getAllNameByObj faild!", error);
            return [];
        }  
    };

    //更新检查
    updateCheck = function(updatecallback) {
        try {
            this._updateCheck(updatecallback);
        } catch (error) {
            logger.debug("call updateCheck faild!", error);
        }
    };

    //进行语法检查 -- 废弃
    diagnostics = function(filepath, filecontext, diagnosticscallback) {
        try {
            if (!this.isinit) {
                //索引加载中，功能暂时不可用
                return false;
            }
        
            let fileinfo = __path.parse(filepath);
            let fileExt = fileinfo.ext;
            let includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]); 
            if (!includeExt.has(fileExt)) {
                logger.debug("diagnostics file type not match!");
                return false;
            }
            return this._diagnostics(filepath, filecontext, diagnosticscallback);
        } catch (error) {
            logger.debug("call getDefinePoint faild!", error);
            return false;
        }
    };

    //退出
    onShutdown = function(){
        //遍历所有进程
        function eachWorker(callback) {
            for (const id in cluster.workers) {
                callback(cluster.workers[id]);
            }
        }
        eachWorker((worker) => {
            //通知所有进程退出
            worker.send('shutdown');
            timeout = setTimeout(() => {
                //强制退出
                worker.kill();
            }, 5000);
        });
    };

    _splitForAllPathNamesapce = function(ownname, usingnamespace) {
        let findclass = KeyWordStore.getInstace().getByNameAndNamespaces(ownname, usingnamespace);
        if (findclass != false) {
            for (let i = 0; i < findclass.length; i++) {
                if (findclass[i].type == TypeEnum.CALSS && findclass[i].namespace != "") {
                    let _namespace = findclass[i].namespace;
                    let _nss = _namespace.split("::");
                    let _nsarray = [];
                    for (let j = 0; j < _nss.length - 1; j++) {
                        _nsarray.push(_nss[j]);
                        let _ns = _nsarray.join("::");
                        usingnamespace.push(_ns);
                    }
                }
            }
        }
        let setNs = new Set(usingnamespace);
        usingnamespace = Array.from(setNs);
        return usingnamespace;
    }
};

module.exports = {
    CodeAnalyse: CodeAnalyse
};