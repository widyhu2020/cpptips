/* --------------------------------------------------------------------------------------------
 * codeAnalyse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var cluster = require('cluster');
var Analyse = require('./analyse/analyseCpp');
var AnalyseTree = require('./analyse/analyse');
var AnalyseDomain = require('./analyse/analyseDomain');
var Completion = require('./completion/completion').Completion;
var Definition = require('./definition/definition').Definition;
var FileIndexStore = require('./store/store').FileIndexStore;
var KeyWordStore = require('./store/store').KeyWordStore;
var DefineMap = require('./definition/defineMap').DefineMap;
var AutoFillParam = require('./completion/autoFillParam').AutoFillParam;
var TypeEnum = require('./analyse/analyseCpp').TypeEnum;
var fs = require('fs');
var __path = require('path');
var logger = require('log4js').getLogger("cpptips");
var CodeAnalyse = /** @class */ (function () {
    function CodeAnalyse() {
        //初始化结构体
        this.init = function (configs) {
            if (this.isinit) {
                return this;
            }
            logger.info("config:", configs);
            var basedir = configs.basedir;
            this.basedir = basedir;
            var dbpath = configs.dbpath;
            this.dbpath = dbpath;
            this.extPath = configs.extpath;
            this.showsql = 0;
            this.userConfig = configs.userConfig;
            if (configs.showsql) {
                //是否打印sql
                this.showsql = configs.showsql;
            }
            var lastpos = dbpath.lastIndexOf("/");
            var path = dbpath.substring(0, lastpos);
            logger.info("db path!", dbpath, path);
            if (!fs.existsSync(path)) {
                //文件夹不存
                logger.info("mkdir db path!", path);
                fs.mkdirSync(path, { recursive: true });
            }
            //这里不进行初始化
            KeyWordStore.getInstace().connect(dbpath, this.showsql);
            FileIndexStore.getInstace().connect(dbpath, this.showsql);
            this.isinit = true;
            return this;
        };
        //重新加载用户配置
        this.reloadLoadUserConfig = function (configs) {
            //设置用户配置
            this.userConfig = configs.userConfig;
            return this;
        };
        //退出
        this.destroy = function () {
            //退出链接
            this.isinit = false;
            KeyWordStore.getInstace().closeconnect();
            FileIndexStore.getInstace().closeconnect();
        };
        //是否可以执行
        this.busy = function () {
            return !(this.isinit);
        };
        //获取cpp文件头文件依赖
        this._getDependentByCpp = function (filepath, callback) {
            var _this = this;
            if (callback === void 0) { callback = null; }
            cluster.setupMaster({
                exec: __dirname + "/worker/makeOwnsMapByCpp.js",
                silent: false,
                windowsHide: true
            });
            var worker = cluster.fork();
            var parasms = {
                basedir: this.basedir,
                sysdir: this.extPath + "/data/",
                cppfilename: filepath,
                dbpath: this.dbpath
            };
            //发送指令
            worker.send(parasms);
            worker.on('message', function (data) {
                try {
                    var usingnamespace = data['usingnamespace'];
                    var include = data['include'];
                    var showTree = data['showTree'];
                    //关闭子进程
                    _this.namespacestore[filepath] = usingnamespace;
                    if (callback != null) {
                        //需要回调
                        callback("success", filepath, usingnamespace, include, showTree);
                    }
                }
                catch (err) {
                    logger.debug(err);
                }
                worker.kill();
            });
            //退出工作进程
            worker.on('exit', function (code, signal) {
                logger.info("获取cpp文件头文件依赖工作进程退出", code, signal);
            });
        };
        //构造搜索树
        this._makeSearchTree = function (files) {
            this.lodadTreeDb();
            var totalSouorceTree = null;
            for (var i = 0; i < files.length; i++) {
                var filename = files[i];
                //logger.debug(filename);
                var strjson = this.store.get(filename);
                if (strjson == "") {
                    continue;
                }
                var fileSourceTree = Analyse.makeSourceTree(strjson);
                if (!fileSourceTree['d'] || !fileSourceTree['g']) {
                    //数据结构不对
                    continue;
                }
                if (totalSouorceTree == null) {
                    totalSouorceTree = fileSourceTree;
                }
                else {
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
        this._searchKeyWord = function (filepath, prekeyworld, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            var analyse = new AnalyseDomain(filecontext);
            var data = analyse.doAnalyse();
            filecontext = data.reverse().join('\n');
            filecontext = filecontext.replace(/using namespace/g, "using_ns");
            var lines = filecontext.split('\n');
            //判断是否含有命名空间，含有则直接使用
            if (/::/g.test(prekeyworld)) {
                //含有命名空间
                //限定作用域的模糊匹配
                var items = prekeyworld.split("::");
                if (items[0] == "" && items.length > 1) {
                    //去掉第一个无用的元素
                    items = items.slice(1);
                }
                var keyword = items.pop();
                var cp_1 = new Completion();
                var info = cp_1.getNamespceAndOwner(items);
                if (info == false) {
                    //分析失败
                    return [];
                }
                var ownname_1 = info.ow;
                var namespace = info.ns;
                var result_1 = cp_1.querByPreKwWithOwner(keyword, namespace, ownname_1);
                //限定左右与模糊匹配
                return result_1;
            }
            //这里使用新的set，避免污染
            var usingnamespace = this._getUsingNamespace(lines, filepath, owns);
            //找到归属
            var ownname = this._getPosOwner(data);
            //找出所有的变量定义
            var defineval = this._getDocumentDefineVal(data);
            //模糊前缀查找
            var cp = new Completion();
            var result = cp.querByPreKwInNamepsace(prekeyworld, usingnamespace, ownname, defineval);
            return result;
        };
        this._getDocumentDefineVal = function (areas) {
            var findvardef = {};
            var processed = false;
            for (var i = areas.length - 1; i >= 0; i--) {
                var area = areas[i];
                area = area.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
                if (area.length > 2 && area[0] == ":" && area[1] == ":") {
                    area = area.substring(2);
                }
                var beginpos = 0;
                beginpos = area.indexOf(';', beginpos);
                if (beginpos == -1) {
                    if (processed) {
                        //终止执行
                        continue;
                    }
                    if (area.lastIndexOf("{") == -1) {
                        //终止执行
                        continue;
                    }
                    //可能是函数定义，此时需要找到参数
                    var endpos = area.lastIndexOf(")");
                    if (endpos == -1) {
                        //终止执行
                        continue;
                    }
                    var startpos = area.lastIndexOf("(", endpos);
                    if (startpos == -1) {
                        //终止执行
                        continue;
                    }
                    processed = true;
                    var params = area.substring(startpos + 1, endpos);
                    this._getFunctionParams(params, findvardef);
                    continue;
                }
                beginpos = 0;
                var maxRun = 0;
                while (true && maxRun < 500) {
                    maxRun++;
                    var endpos = area.indexOf(';', beginpos);
                    if (endpos == -1) {
                        //没有找到更多的语句
                        if (!processed
                            && area.lastIndexOf("{") != -1) {
                            //最后可能是函数定义函数定义
                            var presplitpos = area.lastIndexOf(";");
                            var params = area.substring(presplitpos + 1).trim();
                            if (/^(while|if|else|else[\s\t]{1,4}if)[\s\t]{0,4}\(|^do[\s\t]{0,4}{/g.test(params)) {
                                //以上关键字导致的花括号
                                break;
                            }
                            processed = true;
                            this._getFunctionParams(params, findvardef);
                        }
                        break;
                    }
                    var lastpos = 0;
                    var stype = this._getWordInString(area, beginpos, endpos - 1);
                    if (stype.p == -1) {
                        //本次查找失败
                        beginpos = endpos + 1;
                        continue;
                    }
                    lastpos = stype.p;
                    var sname = this._getWordInString(area, lastpos, endpos - 1);
                    if (sname.p == -1) {
                        //本次查找失败
                        beginpos = endpos + 1;
                        continue;
                    }
                    var type = stype.s;
                    var name_1 = sname.s;
                    if (!(/^[0-9a-z_]{1,64}$/ig.test(name_1))) {
                        //不符合命名规范
                        beginpos = endpos + 1;
                        continue;
                    }
                    //排除函数定义的可能性
                    //????
                    findvardef[name_1] = type;
                    beginpos = endpos + 1;
                }
            }
            return findvardef;
        };
        //获取函数参数
        this._getFunctionParams = function (params, findvardef) {
            params = params.replace(/([\t\n&*]{1,1})|(const)|(\)[\s\t]{0,10}{)/ig, "");
            var _codes = params.split(",");
            var codes = [];
            for (var i = 0; i < _codes.length; i++) {
                var _code = _codes[i].trim();
                if (_code.indexOf("<")) {
                    var j = i;
                    var maxRun = 0;
                    while (true && maxRun < 500) {
                        maxRun++;
                        var result = this._getCharCountInStr(_code, 0, new Set(['<', '>']));
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
            for (var i = 0; i < codes.length; i++) {
                var _code = codes[i].trim();
                var epos = _code.length - 1;
                var _eqpos = _code.lastIndexOf('=');
                if (_eqpos != -1) {
                    epos = _eqpos - 1;
                }
                //获取=前面的非空格字符
                while (epos > 0) {
                    if (_code[epos] != ' ') {
                        break;
                    }
                    epos--;
                }
                var pos = _code.lastIndexOf(' ', epos);
                if (pos == -1) {
                    //参数定义有问题
                    return;
                }
                var type = _code.substring(0, pos).trim();
                var name_2 = _code.substring(pos, epos + 1).trim();
                findvardef[name_2] = type;
            }
        };
        //从字符指定区间找出一个word
        this._getWordInString = function (str, beginpos, endpos) {
            var word = "";
            var keyword = new Set(['class', 'using', 'namespace', 'struct', 'enum', 'virtual', 'public:', 'private:', 'protected:', 'public', 'private', 'protected']);
            var passChar = new Set([' ', '\t', '\n', '(', '[', ';']);
            var returnFaildChar = new Set(['{', ',', '%', '=', '/', '#', '.']);
            for (var i = beginpos; i <= endpos; i++) {
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
                    if (str[i] == '/' && i + 1 <= endpos) {
                        if (str[i + 1] == "/") {
                            //此行为注释行，跳过
                            var tmppos = str.indexOf('\n', i + 1);
                            if (tmppos >= endpos) {
                                return { p: -1, s: '' };
                            }
                            i = tmppos;
                            word = "";
                            continue;
                        }
                        if (str[i + 1] == "*") {
                            //此行为注释行，跳过
                            var tmppos = str.indexOf('*/', i + 1);
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
                    var lastpos = i;
                    return { p: lastpos, s: word };
                }
                if (str[i] == "<") {
                    //可能是模板定义方法
                    var _pos = i;
                    var _beginpos = _pos;
                    var _endpos = _pos;
                    var maxRun = 0;
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
                            var lastpos = _endpos + 1;
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
        this._getPosOwner = function (areas) {
            for (var i = areas.length - 1; i >= 0; i--) {
                var area = areas[i];
                var endpos = area.lastIndexOf('{');
                if (endpos == -1) {
                    //没有花括号闭合，不太可能找到归属
                    continue;
                }
                //往前找一个分号
                var beginpos = area.lastIndexOf(';', endpos);
                if (beginpos == -1) {
                    //这种情况可能是类定义，此种情况需要在找一次类定义
                    beginpos = area.lastIndexOf('class ', endpos);
                    if (beginpos == -1) {
                        //这里未找到也不拦截
                    }
                }
                var code = area.substring(beginpos, endpos);
                //::去掉前后空格
                code = code.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
                if (code.length > 2 && code[0] == ":" && code[1] == ":") {
                    code = code.substring(2);
                }
                //从前往后找(
                beginpos = code.indexOf('(');
                if (beginpos == -1) {
                    beginpos = code.length - 1;
                }
                var result = this._getCharCountInStr(code, beginpos, new Set(['(', ')']));
                if (result['('] != result[')'] || result['('] > 1) {
                    //圆括号不闭合，直接失败
                    continue;
                }
                //直接排除的关键字
                var stopKeyword = new Set('if', 'else', 'while', 'do', 'for');
                //从该位置往前收集关键字
                var findword = "";
                for (var j = beginpos; j > 0; j--) {
                    if (code[j] != " ") {
                        findword = code[j] + findword;
                    }
                    if (stopKeyword.has(findword)
                        && code[j - 1] == "") {
                        //确定不是函数实现也不是类定义
                        break;
                    }
                    if ((code[j] == ' ' || code[j] == '\r' || code[j] == '\n') && findword != '') {
                        //前面的是否为 class A格式
                        var _tmpstr = code.substring(0, j).trim();
                        var _pos = _tmpstr.lastIndexOf("class ");
                        var _posend = _tmpstr.lastIndexOf(":");
                        if (_posend < 0) {
                            _posend = _tmpstr.length + 1;
                        }
                        if (_pos != -1) {
                            var ownname_2 = _tmpstr.substring(_pos + 6, _posend).trim();
                            logger.debug(ownname_2);
                            return ownname_2;
                        }
                        //看看是否格式为A::B的形式
                        var _endPos = findword.indexOf("::");
                        if (_endPos != -1) {
                            //函数实现，测试::前面的为归属类
                            var ownname_3 = findword.substring(0, _endPos).trim();
                            return ownname_3;
                        }
                        //可能是类定义，下一个关键字是否为class
                        var _tmppos = code.lastIndexOf("class ", j);
                        if (_tmppos == -1
                            || (_tmppos - 1 >= 0 && (code[_tmppos - 1] != " " && code[_tmppos - 1] != "\r" && code[_tmppos - 1] != "\n"))) {
                            //没有class关键字
                            break;
                        }
                        var ownname = findword.trim();
                        if (/^[a-z0-9_]{2,64}$/ig.test(ownname)) {
                            return ownname;
                        }
                        break;
                    }
                }
            }
            return "";
        };
        //重新加载单个文件
        this._reloadOneIncludeFile = function (filepath, callback) {
            if (callback === void 0) { callback = null; }
            cluster.setupMaster({
                exec: __dirname + "/worker/rebuildAllFileIndex.js",
                silent: false,
                windowsHide: true
            });
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                msg_type: 2,
                data: {
                    basepath: this.basedir,
                    dbpath: this.dbpath,
                    filepath: filepath,
                    userConfig: this.userConfig
                }
            };
            worker.send(parasms);
            worker.on('message', function (data) {
                var value = data['process'];
                if (data.function == "rebuild") {
                    logger.debug("当前进度：%f%，总共：%d，当前：%d", value["showprocess"], value["totalNum"], value["index"]);
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
        this._initSystemIncludeIndex = function (callback) {
            var that = this;
            cluster.setupMaster({
                exec: __dirname + "/worker/unzipSystemIncludeWorker.js",
                silent: false,
                windowsHide: true
            });
            //锁住功能
            that.loadindex = true;
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                extpath: this.extPath,
                dbpath: this.dbpath
            };
            worker.send(parasms);
            worker.on('message', function (data) {
                if (data.function == "over") {
                    //任务完成关闭子进程
                    worker.kill();
                    // that.loadindex = false;
                    callback("success");
                    return;
                }
                if (data.function == "can_not_import") {
                    //任务完成关闭子进程
                    worker.kill();
                    // that.loadindex = false;
                    callback("can_not_import");
                    return;
                }
            });
            worker.on('exit', function (code, signal) {
                //恢复正常功能
                //这里不需要恢复正常功能，否则导致变量被设置成false
                // logger.debug("xxxxxxxxxx:exit");
                // that.loadindex = false;
            });
        };
        //全部扫描修改过的头文件重新分析
        this._reloadAllIncludeFile = function (callback) {
            if (callback === void 0) { callback = null; }
            var that = this;
            cluster.setupMaster({
                exec: __dirname + "/worker/rebuildAllFileIndex.js",
                silent: false,
                windowsHide: true
            });
            //锁住功能 wal模式不需要锁
            that.loadindex = true;
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                msg_type: 0,
                data: {
                    basepath: this.basedir,
                    dbpath: this.dbpath,
                    userConfig: this.userConfig
                }
            };
            logger.debug("_reloadAllIncludeFile", JSON.stringify(parasms));
            worker.send(parasms);
            worker.on('message', function (data) {
                var value = data['process'];
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
                if (data.function == "scan_ing") {
                    //扫码目录回调
                    callback("scan_ing", 0, 0, 0, data.extdata);
                    return;
                }
                if (data.function == "stop_load_index") {
                    worker.kill();
                    that.loadindex = false;
                    callback(data.function, 0, 0, 0);
                    return;
                }
                //其他函数
                callback(data.function, 0, 0, 0);
            });
            worker.on('exit', function (code, signal) {
                //恢复正常功能
                that.loadindex = false;
            });
        };
        //重新分析一批文件
        this._reloadBatchIncludeFile = function (filepaths, callback) {
            if (callback === void 0) { callback = null; }
            var that = this;
            cluster.setupMaster({
                exec: __dirname + "/worker/rebuildAllFileIndex.js",
                silent: false,
                windowsHide: true
            });
            //锁住功能 wal模式不需要锁
            that.loadindex = true;
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                msg_type: 0,
                data: {
                    basepath: this.basedir,
                    dbpath: this.dbpath,
                    filepaths: filepaths,
                    userConfig: this.userConfig
                }
            };
            worker.send(parasms);
            worker.on('message', function (data) {
                var value = data['process'];
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
                    worker.kill();
                    return;
                }
            });
            worker.on('exit', function (code, signal) {
                //恢复正常功能
                callback("success", 0, 0, 0);
                that.loadindex = false;
            });
        };
        this._rfindPairPos = function (str, rpos, begin, end) {
            var num = 0;
            for (var i = rpos; i >= 0; i--) {
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
        this._getLegalName = function (str, rpos) {
            var name = "";
            for (var i = rpos; i >= 0; i--) {
                if ((str[i] >= 'a' && str[i] <= 'z')
                    || (str[i] >= 'A' && str[i] <= 'Z')
                    || (str[i] >= '0' && str[i] <= '9')
                    || (str[i] == '_')) {
                    name = str[i] + name;
                    continue;
                }
                break;
            }
            return name;
        };
        //闭合匹配
        this._getCloseMark = function (str, ipos, bmark, emark) {
            if (str[ipos] != bmark) {
                //输入符号异常
                return false;
            }
            //xxxx(ddd())
            var _bpos = ipos;
            var _epos = ipos;
            var maxRun = 0;
            while (true && maxRun < 500) {
                maxRun++;
                _epos = str.indexOf(emark, _epos + 1);
                if (_epos == -1) {
                    //未找到，直接失败
                    return false;
                }
                var _pos = str.lastIndexOf(bmark, _epos);
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
        this._getRCloseMark = function (str, ipos, bmark, emark) {
            if (str[ipos] != emark) {
                //输入符号异常
                return false;
            }
            //aaaa(ddd())
            var _bpos = ipos;
            var _epos = ipos;
            var maxRun = 0;
            while (true && maxRun < 500) {
                maxRun++;
                _bpos = str.lastIndexOf(bmark, _bpos - 1);
                if (_bpos == -1) {
                    //未找到，直接失败
                    return true;
                }
                var _pos = str.indexOf(emark, _bpos);
                if (_pos == -1) {
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
        this._getNameFromStr = function (data, str, lastpos, type) {
            var pchar = str[lastpos];
            if (pchar == ')') {
                //函数形式
                var bpos = this._getRCloseMark(str, lastpos, '(', ')');
                if (!bpos) {
                    //[]未闭合
                    return [];
                }
                return this._getNameFromStr(data, str, bpos - 1, 'f');
            }
            if (pchar == ']') {
                //数组形式
                var bpos = this._getRCloseMark(str, lastpos, '[', ']');
                if (!bpos) {
                    //[]未闭合
                    return [];
                }
                var item = { n: "operator[]", t: 'f' };
                data.push(item);
                return this._getNameFromStr(data, str, bpos - 1, 'p');
            }
            if ((pchar >= 'a' && pchar <= 'z')
                || (pchar >= 'A' && pchar <= 'Z')
                || (pchar >= '0' && pchar <= '9')
                || pchar == '_') {
                //属性定义
                var findname = "";
                var _posgener = str.lastIndexOf('.', lastpos);
                var _pospoint = str.lastIndexOf('->', lastpos);
                if (_pospoint == -1 && _posgener == -1) {
                    //查找完毕
                    findname = str.substring(0, lastpos + 1).trim();
                    var stoppos = this._strHasOtherChar(findname);
                    if (stoppos == -2) {
                        //非变量名称
                        return [];
                    }
                    if (stoppos > -1) {
                        findname = findname.substring(stoppos + 1);
                    }
                    var item = { n: findname.trim(), t: type };
                    data.push(item);
                    return data;
                }
                //只找到->和.分割都找到，使用大的
                if (_posgener > _pospoint) {
                    findname = str.substring(_posgener + 1, lastpos + 1).trim();
                    var stoppos = this._strHasOtherChar(findname);
                    if (stoppos == -2) {
                        //非变量名称
                        return [];
                    }
                    if (stoppos > -1) {
                        findname = findname.substring(stoppos + 1);
                        var item_1 = { n: findname.trim(), t: type };
                        data.push(item_1);
                        return data;
                    }
                    var item = { n: findname.trim(), t: type };
                    data.push(item);
                    return this._getNameFromStr(data, str, _posgener - 1, 'p');
                }
                else {
                    findname = str.substring(_pospoint + 2, lastpos + 1).trim();
                    var stoppos = this._strHasOtherChar(findname);
                    if (stoppos == -2) {
                        //非变量名称
                        return [];
                    }
                    if (stoppos > -1) {
                        findname = findname.substring(stoppos + 1);
                        var item_2 = { n: findname.trim(), t: type };
                        data.push(item_2);
                        return data;
                    }
                    var item = { n: findname.trim(), t: type };
                    data.push(item);
                    return this._getNameFromStr(data, str, _pospoint - 1, 'p');
                }
            }
            return data;
        };
        this._strHasOtherChar = function (findstr) {
            //以下符号修改请注意兼容
            var setEnd = new Set(['(', '[', '{', ')', '<', '=', '-', '+', '*', '\\', ';', ' ', '\t', '\n', ',', '&', '*', '!', '|', ':']);
            var index = findstr.length - 1;
            for (; index >= 0; index--) {
                var pchar = findstr[index];
                if ((pchar >= 'a' && pchar <= 'z')
                    || (pchar >= 'A' && pchar <= 'Z')
                    || (pchar >= '0' && pchar <= '9')
                    || pchar == '_') {
                    continue;
                }
                if (pchar == ':' && findstr[index - 1] == ":") {
                    //带命名空间
                    return -2;
                }
                if (setEnd.has(pchar)) {
                    break;
                }
                else {
                    return -2;
                }
            }
            return index;
        };
        //变量名称，只允许a-zA-Z0-9_
        this._getValName = function (lines) {
            lines = lines.trim();
            if (lines[lines.length - 1] == "-" || lines[lines.length - 1] == ".") {
                lines = lines.substring(0, lines.length - 1);
            }
            if (lines[lines.length - 1] == ">" && lines[lines.length - 1] == "-") {
                lines = lines.substring(0, lines.length - 2);
            }
            lines = lines.replace(/[\s\t]{1,10}[.]{1,1}[\s\t]{1,10}/g, '.');
            lines = lines.replace(/[\s\t]{1,10}->[\s\t]{1,10}/g, '->');
            var data = [];
            data = this._getNameFromStr(data, lines, lines.length - 1, 'p');
            return data;
        };
        //回溯找到变量定义
        this._getValDefineOwn = function (lines, valname) {
            for (var i = lines.length - 1; i >= 0; i--) {
                var line = lines[i].trim();
                var pos = this._findVanamePos(line, valname);
                if (pos == -1) {
                    //未找到直接跳过
                    continue;
                }
                var _sourceline = lines[i];
                var sourctline = line;
                var pretype = line.substring(0, pos);
                var _pretype = pretype;
                var beginpos = pretype.lastIndexOf("(");
                if (beginpos != -1) {
                    pretype = pretype.substring(beginpos + 1);
                }
                if (pretype == "))" || pretype == ")") {
                    //可能是typeof()
                    beginpos = _pretype.lastIndexOf("typeof");
                    if (beginpos == -1) {
                        //未通过闭合匹配
                        continue;
                    }
                    var _tmptype = _pretype.substring(beginpos);
                    var markResult = this._getRCloseMark(_tmptype, _tmptype.length - 1, '(', ')');
                    //let markResult = this._getCloseMark(_tmptype, 6, '(', ')');
                    if (markResult === false
                        || markResult != 6) {
                        //匹配成功的位置
                        //匹配失败，这里注意不是判断否，因为有可能返回0，但是是成功的
                        continue;
                    }
                    pretype = "typeof";
                }
                pretype = pretype.trim();
                if (pretype[pretype.length - 1] == ","
                    && pretype.indexOf(" ") != -1) {
                    //一行包含多变量定义
                    var _pos = pretype.indexOf(" ");
                    pretype = pretype.substring(0, _pos);
                }
                if (pretype[pretype.length - 1] == "=") {
                    //这种肯定不是定义
                    continue;
                }
                var ispoint = 0;
                if (pretype.indexOf('*') != -1) {
                    ispoint = 1;
                }
                pretype = pretype.replace(/([*&]{1,2})|(const )|(static )/g, "").trim();
                if (pretype != "return"
                    && /^[a-z0-9_:]{1,512}$/ig.test(pretype)) {
                    //符合变量定义
                    if (pretype.indexOf("::") == 0) {
                        pretype = pretype.substring(2);
                    }
                    return { t: pretype, l: sourctline, ol: _sourceline, p: ispoint };
                }
                var result = this._getCharCountInStr(pretype, 0, new Set(['<', '>', ':']));
                if (pretype != "return"
                    && result['<'] == result['>']
                    && result['>'] >= 1
                    && result[':'] % 2 == 0) {
                    //带模版的类型
                    if (pretype.indexOf("::") == 0) {
                        pretype = pretype.substring(2);
                    }
                    if (/[\w\s:]{1,256}/g.test(pretype)
                        || (pretype.indexOf("<") != -1 && pretype[pretype.length - 1] == ">")) {
                        //定义不能有其他字符
                        pretype = pretype.replace(/[\s]{0,4}[<>]{1,1}[\s]{0,4}/g, function (kw) { return kw.trim(); });
                        return { t: pretype, l: sourctline, ol: _sourceline, p: ispoint };
                    }
                }
            }
            if (valname == "this") {
                return { t: "this", l: "", ol: "", p: 0, pos: -1 };
            }
            return { t: "", l: "", ol: "", p: 0, pos: -1 };
        };
        this._getFileNamespace = function (lines) {
            var data = [];
            for (var i = 0; i < lines.length; i++) {
                var pos = lines[i].indexOf("namespace");
                if (pos != -1) {
                    data = lines.slice(i, i + 20);
                    break;
                }
            }
            var nsdata = data.join(" ");
            nsdata = nsdata.replace("{", " { ");
            nsdata = nsdata.replace("}", " } ");
            var items = nsdata.split(/[\s\t]{1,10}/);
            var stk = [];
            for (var i = 0; i < items.length; i++) {
                if (items[i] == "namespace" && items[i + 2] == '{') {
                    stk.push(items[i + 1]);
                    i = i + 2;
                    continue;
                }
                if (items[i] != '{') {
                    stk.push('');
                    continue;
                }
                if (items[i] != '}') {
                    stk.pop();
                    continue;
                }
            }
            stk = stk.filter(function (e) { return e != ""; });
            return stk.join("::");
        };
        this._findObjctWhitNames = function (objname, name) {
            //依次定位类型    
            var namespace = "";
            var classname = objname;
            var result = DefineMap.getInstace().getRealName(objname);
            namespace = result.namespace;
            classname = result.name;
            // let lpos = objname.lastIndexOf('::');
            // if (lpos != -1) {
            //     namespace = objname.substring(0, lpos);
            //     classname = objname.substring(lpos + 2);
            // }
            var types = [TypeEnum.VARIABLE, TypeEnum.FUNCTION];
            var infos = KeyWordStore.getInstace().getByFullname(classname, namespace, name.n, types);
            if (!infos || infos.length <= 0) {
                //查找失败
                return false;
            }
            var info = infos[0];
            if (info.type == TypeEnum.FUNCTION) {
                //如果是函数，则返回函数的返回值
                var extData = JSON.parse(info.extdata);
                if (extData.length > 0 && extData[0].r) {
                    var type = extData[0].r.t;
                    return DefineMap.getInstace().getRealNameWithOwner(type, classname, namespace);
                }
                return false;
            }
            if (info.type == TypeEnum.VARIABLE) {
                //如果是变量，则返回变量的类型
                var extData = JSON.parse(info.extdata);
                var type = extData.t;
                return DefineMap.getInstace().getRealNameWithOwner(type, classname, namespace);
            }
            return false;
        };
        //类或者命名空间对象输入点之后提取
        this._getAllNameByObj = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            var analyse = new AnalyseDomain(filecontext);
            var data = analyse.doAnalyse();
            filecontext = data.reverse().join('\n');
            filecontext = filecontext.replace(/using namespace/g, "using_ns");
            var lines = filecontext.split('\n');
            //这里使用新的set，避免污染
            var usingnamespace = this._getUsingNamespace(lines, filepath, owns);
            //先找到最后一行的变量名称
            var lastline = lines[lines.length - 1];
            var names = this._getValName(lastline);
            if (names.length <= 0) {
                //未找到合适的名字
                return [];
            }
            //提示处理类
            var cp = new Completion();
            //弹出最顶的，用来找定义
            var name = names.pop();
            //获取当前操作的wonname中
            var _ownname = this._getPosOwner(data);
            var _valetype = { t: _ownname, l: "p", ol: 'p', p: lastline, pos: -1 };
            if (name.n != "this") {
                //非this指针，需要找出变量定义的类型
                _valetype = this._getValDefineOwn(lines, name.n);
            }
            if (_valetype.t == "") {
                //未找到类型，异常情况
                //可能是类本身的成员遍历
                var _type = cp.getTypeByOwnerAndNameInNamespace(_ownname, name.n, usingnamespace);
                if (_type == false) {
                    return [];
                }
                _valetype = { t: _type, l: "p", p: "", pos: -1 };
            }
            if (_valetype.t == "auto" || _valetype.t == "typeof") {
                //这种情况类型有后面的值确定
                var line = _valetype.l;
                var _pos = line.indexOf(_valetype.t);
                var _beginpos = line.indexOf("=", _pos);
                if (_beginpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                    //兼容for(auto a: fddd)语法
                    _beginpos = line.indexOf(":", _pos);
                }
                if (_pos == -1 || _beginpos == -1) {
                    //没有值无法定位
                    return [];
                }
                var _endpos = line.indexOf(";", _pos);
                if (_endpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                    //兼容for(auto a: fddd)语法
                    _endpos = line.indexOf("{", _pos);
                    _endpos = line.lastIndexOf(")", _endpos);
                }
                var _type = line.substring(_beginpos + 1, _endpos).trim();
                var _names = this._getValName(_type);
                names = names.concat(_names);
                if (names.length <= 0) {
                    //未找到合适的名字
                    return [];
                }
                var name_3 = names.pop();
                _valetype = this._getValDefineOwn(lines, name_3.n);
            }
            var valetype = _valetype.t;
            //转化成全名称
            valetype = cp.getClassFullName(valetype, usingnamespace);
            for (var i = names.length - 1; i >= 0; i--) {
                //依次找最终的结构
                var _nameInfo = DefineMap.getInstace().getRealName(valetype);
                var _valetype_1 = _nameInfo.namespace != "" ? _nameInfo.namespace + "::" + _nameInfo.name : _nameInfo.name;
                var tmptype = this._findObjctWhitNames(_valetype_1, names[i]);
                if (!tmptype) {
                    //获取对象或者继承父中的定义
                    var df = new Definition(this.basedir, this.extPath);
                    valetype = this._getObjectName(df, _valetype_1, names[i].n, usingnamespace);
                    if (valetype == false) {
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
        this._getObjectName = function (df, valetype, names, usingnamespace) {
            //尝试获取继承父的方法
            var maxInherit = 5;
            var ownnames = [valetype];
            var dequeue = [valetype];
            while (--maxInherit > 0) {
                var _valtype = dequeue.pop();
                if (!_valtype) {
                    //无元素可处理
                    break;
                }
                var result = df.getClassDefineInfo(_valtype, usingnamespace);
                if (result == false) {
                    //没找到定义
                    break;
                }
                var inheritclass = result.inherit;
                var mergerClassName = [];
                for (var i = 0; i < inheritclass.length; i++) {
                    var _className = inheritclass[i].replace(/\<[\s\w,]{2,256}\>/, "");
                    dequeue.push(_className);
                    mergerClassName.push(_className);
                }
                ownnames = ownnames.concat(mergerClassName);
            }
            ;
            var fileinfo = df.getDefineInWitchClass(ownnames, names, usingnamespace);
            if (fileinfo == false) {
                //未找到定义
                return false;
            }
            var extJson = JSON.parse(fileinfo.info.extdata);
            valetype = extJson[0].r.t;
            valetype = df.getClassFullName(valetype, usingnamespace);
            return valetype;
        };
        //自动填参数分析
        this._autoFillParams = function (filepath, filecontext, preParams) {
            filecontext = filecontext.substring(0, filecontext.length - preParams.length - 1);
            var analyse = new AnalyseDomain(filecontext);
            var data = analyse.doAnalyse();
            filecontext = data.reverse().join('\n');
            filecontext = filecontext.replace(/using namespace/g, "using_ns");
            var lines = filecontext.split('\n');
            //这里使用新的set，避免污染
            var usingnamespace = this._getUsingNamespace(lines, filepath, []);
            //先找到最后一行的函数
            var lastline = lines[lines.length - 1];
            var names = this._getValName(lastline);
            if (names.length <= 0) {
                //未找到合适的名字
                return [];
            }
            //获取参数位置
            preParams = preParams.replace(/\([a-z0-9_\(\)\[\].: \->]{1,128}\)/ig, "");
            var params = preParams.split(",");
            var paramsPos = params.length;
            var valetype = "";
            if (names.length > 1) {
                //弹出最顶的，用来找定义
                var name_4 = names.pop();
                //获取当前操作的wonname中
                var _ownname = this._getPosOwner(data);
                var _valetype = { t: _ownname, l: "p", ol: 'p', p: lastline, pos: -1 };
                if (name_4.n != "this") {
                    //非this指针，需要找出变量定义的类型
                    _valetype = this._getValDefineOwn(lines, name_4.n);
                }
                valetype = _valetype.t;
            }
            //找到函数定义
            //转化成全名称
            var afp = new AutoFillParam();
            valetype = afp.getClassFullName(valetype, usingnamespace);
            if (valetype == "") {
                //未找到类型定义，可能未内部函数成员变量，或者全局变量
                var name_5 = names[0].n;
                var _ownname = this._getPosOwner(data);
                var ownnames = ['', _ownname];
                var realName = afp.getRealOwnByName(name_5, ownnames, usingnamespace);
                if (!realName) {
                    //真正没找到定义
                    return [];
                }
                valetype = realName;
            }
            for (var i = names.length - 1; i >= 1; i--) {
                //依次找最终的结构
                var _nameInfo = DefineMap.getInstace().getRealName(valetype);
                var _valetype = _nameInfo.namespace != "" ? _nameInfo.namespace + "::" + _nameInfo.name : _nameInfo.name;
                var tmptype = this._findObjctWhitNames(_valetype, names[i]);
                if (!tmptype) {
                    return [];
                }
                valetype = afp.getMapedName(tmptype, valetype, _nameInfo.name, _nameInfo.namespace);
            }
            var functionName = names[0];
            logger.debug(valetype);
            //获取方法的定义
            afp.setParamsInfo(filecontext, preParams, paramsPos);
            return afp.autoAnalyseParams(valetype, functionName.n, usingnamespace);
        };
        //获取归属类或者继承父类的下函数定义
        this._getClassAndInheritFuntionAndVar = function (cp, valetype, ownname, usingnamespace) {
            var queue = [valetype];
            var showitem = [];
            var deeppath = 0;
            //继承类处理
            var maxRun = 0;
            while (true && maxRun < 500) {
                maxRun++;
                if (queue.length <= 0 || deeppath > 5) {
                    //已经没有元素了
                    //防止死循环，最多只查找5层
                    break;
                }
                var tmpvaltype = queue.pop();
                //获取命名空间名称
                //获取归属（类）名称
                var namespace = "";
                var classname = tmpvaltype;
                var _nameInfo = DefineMap.getInstace().getRealName(classname);
                namespace = _nameInfo.namespace;
                classname = _nameInfo.name;
                if (namespace == "") {
                    //如果没有名空间，则获取全名重新解释
                    var _classname = cp.getClassFullName(classname, usingnamespace);
                    if (classname != _classname) {
                        _nameInfo = DefineMap.getInstace().getRealName(_classname);
                        namespace = _nameInfo.namespace;
                        classname = _nameInfo.name;
                    }
                }
                var inherit = cp.getInheritOfClass(classname, namespace, usingnamespace);
                queue = queue.concat(inherit);
                var _showitem = cp.getByOwnerNameInNamespace(classname, namespace, ownname);
                showitem = showitem.concat(_showitem);
                deeppath++;
            }
            showitem = this._deleteRepeatInArray(showitem);
            return showitem;
        };
        //去重复
        this._deleteRepeatInArray = function (array) {
            var setConter = new Set();
            var newArray = [];
            for (var i = 0; i < array.length; i++) {
                var item = array[i];
                if (setConter.has(item.s)) {
                    //已经包含
                    continue;
                }
                newArray.push(item);
                setConter.add(item.s);
            }
            return newArray;
        };
        //通过命名空间查找
        this._getAllNameByNamespace = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            //获取前面输入的命名空间
            var linecode = "";
            var _lastlinebeginpos = filecontext.lastIndexOf("\n");
            if (_lastlinebeginpos == -1) {
                linecode = _lastlinebeginpos;
            }
            else {
                linecode = filecontext.substring(_lastlinebeginpos);
            }
            //分解其中的命名空间层级
            linecode = linecode.replace(/[\s\t]{1,10}[:]{2,2}[\s\t]{1,10}/g, "::").trim();
            var maxdo = 2;
            while (maxdo--) {
                if (linecode[linecode.length - 1] == ":") {
                    linecode = linecode.substring(0, linecode.length - 1);
                }
            }
            var result = /([a-z0-9_]{1,256}(::[a-z0-9_]{1,256}){0,10})$/ig.exec(linecode);
            if (result == null) {
                //未找到合法的
                return [];
            }
            linecode = linecode.substring(result.index);
            var namessspaces = linecode.split("::");
            namessspaces = namessspaces.filter(function (e) { return e != ""; });
            var fullns = namessspaces.join("::");
            var lastnamespace = namessspaces.pop();
            var ownnameepace = namessspaces.join("::");
            var cp = new Completion();
            var showitem = cp.getOnlyByNamespace(fullns);
            if (lastnamespace != "") {
                var _showitem = cp.getStaticByMthedAndVal(lastnamespace, ownnameepace);
                showitem = showitem.concat(_showitem);
            }
            //这里是否要拉枚举呢（命名空间下枚举太大，这里不拉） 
            return showitem;
        };
        this._getShowTips = function (filepath, data) {
            if (!data && data.length <= 0) {
                //一次情况
                return { t: "未获取到名称", d: "未获取到描述", f: -1 };
            }
            var fullnameinfo = JSON.parse(data.n);
            var ownname = fullnameinfo.o;
            var namespace = fullnameinfo.s;
            var name = fullnameinfo.n;
            var file_id = fullnameinfo.f;
            var type = fullnameinfo.t;
            if (fullnameinfo.d) {
                //自动填参数推荐来源
                return { t: "填参推荐", d: "系统为你挑选可能的取值，当前匹配度（最高1000）：" + fullnameinfo.d, f: -1 };
            }
            if (data.f == -1) {
                return { t: name, d: name, f: -1 };
            }
            var cp = new Completion();
            var info = cp.getShowDocument(ownname, namespace, name, type);
            if (!info && info.length <= 0) {
                var showdefie = name;
                if (fullnameinfo.t) {
                    showdefie = fullnameinfo.t + " " + showdefie;
                }
                return { t: name, d: showdefie, f: -1 };
            }
            return info;
        };
        this._findVanamePos = function (line, valname) {
            var pos = line.indexOf(" " + valname, 0);
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
        };
        //获取头文件定义
        this._getIncludeDefine = function (sourceFile, includeFile, fileName) {
            var df = new Definition(this.basedir, this.extPath);
            if (fileName.indexOf(".pb.h") != -1) {
                //兼容proto
                fileName = fileName.replace(".pb.h", ".proto");
                includeFile = includeFile.replace(".pb.h", ".proto");
                logger.debug("process proto:", fileName);
            }
            var findIncludeFile = df.getIncludeInfo(sourceFile, includeFile, fileName);
            if (findIncludeFile == "") {
                //未找到头文件
                logger.debug("find include file error", includeFile);
                return false;
            }
            var _filename = this.basedir + findIncludeFile;
            if (!fs.existsSync(_filename)) {
                //可能是系统库
                _filename = __dirname + "/../data/" + findIncludeFile;
                if (!fs.existsSync(_filename)) {
                    //未找到头文件
                    logger.debug("find real include file error", includeFile, _filename);
                    return false;
                }
            }
            var result = {
                filename: "file://" + _filename,
                bline: 0,
                bcols: 0,
                eline: 1,
                ecols: 0,
                linecode: findIncludeFile,
                prelinecode: findIncludeFile,
                title: "头文件"
            };
            if (_filename.indexOf('/') != 0) {
                result.filename = "file:///" + _filename;
            }
            return result;
        };
        //获取文档结构
        this._getDocumentTree = function (filename, filecontext) {
            var analyse = new AnalyseTree.Analyse(filecontext, filename);
            logger.mark("Analyse");
            analyse.doAnalyse();
            logger.mark("Analyse");
            logger.mark("getDocumentStruct");
            showTree = analyse.getDocumentStruct();
            logger.mark("getDocumentStruct");
            if (showTree
                && showTree["name"] == ""
                && showTree["child"].length == 0
                && showTree["function"].length == 0
                && showTree["variable"].length == 0
                && showTree["defines"].length == 0) {
                return false;
            }
            if (showTree
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
        this._diagnostics = function (filepath, filecontext, diagnosticscallback) {
            var that = this;
            cluster.setupMaster({
                exec: __dirname + "/worker/analyseDiagnostics.js",
                silent: false,
                windowsHide: true
            });
            //锁住功能 wal模式不需要锁
            that.loadindex = true;
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                filecontext: filecontext,
                filename: filepath,
                dbpath: this.dbpath
            };
            logger.debug("_diagnostics", JSON.stringify(parasms));
            worker.send(parasms);
            worker.on('message', function (data) {
                if (data.type == "result") {
                    logger.debug(data.data);
                    //其他函数
                    diagnosticscallback(data.data);
                    worker.kill();
                }
            });
            worker.on('exit', function (code, signal) {
                //恢复正常功能
                that.loadindex = false;
            });
        };
        this._getDefinePoint = function (filepath, filecontext, linelast, owns) {
            if (owns === void 0) { owns = []; }
            var analyse = new AnalyseDomain(filecontext);
            var data = analyse.doAnalyse();
            var lengthmeta = [];
            for (var i = 0; i < data.length; i++) {
                var area = data[i];
                var begin = filecontext.indexOf(area);
                var end = begin + area.length;
                lengthmeta.push({ b: begin, e: end });
            }
            var _filecontext = data.reverse().join('\n');
            _filecontext = _filecontext.replace(/using namespace/g, "using_ns");
            var lines = _filecontext.split('\n');
            //这里使用新的set，避免污染
            var usingnamespace = this._getUsingNamespace(lines, filepath, owns);
            var ownname = this._getPosOwner(data);
            usingnamespace = this._splitForAllPathNamesapce(ownname, usingnamespace);
            //先找到最后一行的变量名称
            var lastline = lines[lines.length - 1];
            var names = this._getValName(lastline);
            if (names.length <= 0) {
                //未找到合适的名字
                //判断是否本身将是类型
                lastline = lastline.trim();
                lastline = lastline.replace(/[\s]{0,10}[:]{2,2}[\s]{0,10}/g, "::");
                if (lastline.length > 2 && lastline[0] == ":" && lastline[1] == ":") {
                    lastline = lastline.substring(2);
                }
                var _tmpcodes = lastline.split(/[\s\t\n([{<]{1,1}/g);
                var _tmptype = lastline;
                if (_tmpcodes.length > 0) {
                    _tmptype = _tmpcodes[_tmpcodes.length - 1].trim();
                }
                var _fullname = "";
                var df = new Definition(this.basedir, this.extPath);
                linelast = linelast.trim();
                //判断是否为合法的类型
                if (linelast[0] == '(') {
                    //标明为方法定义
                    return df.getFunctionDefineInfo(_tmptype, usingnamespace);
                }
                else {
                    //类定义或者枚举值处理
                    var result = df.getClassDefineInfo(_tmptype, usingnamespace);
                    if (result == false) {
                        return false;
                    }
                    //如果是全名称定义，返回该定义
                    _fullname = result.full_name;
                    if (result.type == TypeEnum.ENUMITEM) {
                        var _items = _fullname.split("::");
                        var _name = _items.pop();
                        var _ownname = _items.pop();
                        var _namespace = _items.join("::");
                        return this._findAllNameInGlobal([], _name, _ownname, [_namespace]);
                    }
                }
                return this._findOwnDefinePosOne(_fullname);
            }
            //弹出最顶的，用来找定义
            var name = names.pop();
            var _valetype = this._getValDefineOwn(lines, name.n);
            var valetype = _valetype.t;
            if (_valetype.t == "this") {
                //非this指针，需要找出变量定义的类型
                valetype = this._getPosOwner(data);
            }
            if (_valetype.t == "auto" || _valetype.t == "typeof") {
                //这种情况类型有后面的值确定
                var line = _valetype.l;
                var _pos = line.indexOf(_valetype.t);
                var _beginpos = line.indexOf("=", _pos);
                if (_beginpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                    //兼容for(auto a: fddd)语法
                    _beginpos = line.indexOf(":", _pos);
                }
                if (_pos == -1 || _beginpos == -1) {
                    //没有值无法定位
                    return [];
                }
                var _endpos = line.indexOf(";", _pos);
                if (_endpos == -1 && /^for[\s]{0,4}\(/g.test(line)) {
                    _endpos = line.indexOf("{", _pos);
                    _endpos = line.lastIndexOf(")", _endpos);
                }
                var _type = line.substring(_beginpos + 1, _endpos).trim();
                var _names = this._getValName(_type);
                names = names.concat(_names);
                if (names.length <= 0) {
                    //未找到合适的名字
                    return [];
                }
                var name_6 = names.pop();
                _valetype = this._getValDefineOwn(lines, name_6.n);
                valetype = _valetype.t;
            }
            if (valetype != "" && names.length == 0) {
                //可能是本文档定义
                //同文件跳转
                var result = this._findDefineInDocument(_valetype, filecontext, lengthmeta, valetype, filepath, name);
                if (result) {
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
        this._findDefineInDocument = function (_valetype, filecontext, lengthmeta, valetype, filepath, name) {
            var sourceline = _valetype.ol;
            var beginlines = this._findLineNumWithCode(filecontext, lengthmeta, sourceline);
            var begincols = sourceline.indexOf(valetype);
            var endlines = beginlines;
            var endclos = begincols + valetype.length;
            var df = new Definition(this.basedir, this.extPath);
            var _filename = df.getFileInfoByFullName(filepath);
            logger.info("_filename:", _filename);
            var result = {
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
        this._findAllNameInGlobal = function (names, name, ownname, usingnamespace) {
            var df = new Definition(this.basedir, this.extPath);
            var owns = [''];
            var runcout = 5;
            var _getinherit = [ownname];
            while (true) {
                var _tmpClass = _getinherit.pop();
                if (!_tmpClass || runcout-- < 0) {
                    break;
                }
                if (_tmpClass == "") {
                    continue;
                }
                //获取真姓名
                var _result = DefineMap.getInstace().getRealName(_tmpClass);
                if (_result.namespace == "") {
                    _tmpClass = df.getClassFullName(_result.name, usingnamespace);
                    _result = DefineMap.getInstace().getRealName(_tmpClass);
                }
                if (_result && _result.namespace.length >= 0) {
                    //获取密命名空间和类名称
                    usingnamespace.push(_result.namespace);
                    _tmpClass = _result.name;
                    owns.push(_tmpClass);
                }
                var inheritClass = df.getInheritOfClassByNamspaces(_tmpClass, usingnamespace);
                for (var i = 0; i < inheritClass.length; i++) {
                    _getinherit.push(inheritClass[i]);
                }
            }
            var result = df.getDefineInWitchClass(owns, name, usingnamespace);
            if (!result) {
                //全局和本类都为找到定义
                //判断是否可能为宏定义（执行到这里不可能是方法或者变量）
                result = KeyWordStore.getInstace().getByNameAndNamespaces(name, usingnamespace);
                if (!result || result.length == 0) {
                    //去掉own查找也失败
                    return false;
                }
                var hasResult = false;
                var info_1 = null;
                for (var i = 0; i < result.length; i++) {
                    info_1 = result[i];
                    if (info_1.type == TypeEnum.ENUMITEM) {
                        //枚举值跳转
                        var filepath_1 = df.getFileInfo(info_1.file_id);
                        return df.readFileFindDefine(filepath_1, info_1.ownname, info_1.name, info_1.type);
                    }
                    hasResult = true;
                }
                if (hasResult
                    && (info_1.type == TypeEnum.CALSS
                        || info_1.type == TypeEnum.STRUCT
                        || info_1.type == TypeEnum.ENUM
                        || info_1.type == TypeEnum.TYPEDEF
                        || info_1.type == TypeEnum.DEFINE
                        || (info_1.type == TypeEnum.FUNCTION && names.length == 0)
                        || (info_1.type == TypeEnum.VARIABLE && names.length == 0))) {
                    //变量定义
                    //没有归属查找
                    var file_id = df.getRealFileId(info_1);
                    var sourcefilepath = df.getFileInfo(file_id);
                    var filepath = df.getFileInfo(info_1.file_id);
                    return df.readFileFindDefine(filepath, info_1.ownname, info_1.name, info_1.type, sourcefilepath);
                }
                return false;
            }
            var info = result.info;
            if (info.type == TypeEnum.CALSS
                || info.type == TypeEnum.STRUCT
                || info.type == TypeEnum.ENUM
                || info.type == TypeEnum.TYPEDEF
                || info.type == TypeEnum.DEFINE
                || (info.type == TypeEnum.FUNCTION && names.length == 0)
                || (info.type == TypeEnum.VARIABLE && names.length == 0)) {
                //变量定义
                //没有归属查找
                var file_id_1 = df.getRealFileId(info);
                var sourcefilepath_1 = df.getFileInfo(file_id_1);
                var filepath_2 = df.getFileInfo(info.file_id);
                return df.readFileFindDefine(filepath_2, info.ownname, info.name, info.type, sourcefilepath_1);
            }
            if (info.type == TypeEnum.ENUMITEM) {
                //枚举值跳转
                var filepath_3 = df.getFileInfo(info.file_id);
                return df.readFileFindDefine(filepath_3, info.ownname, info.name, info.type);
            }
            //变量多级跳转
            var typename = info.name;
            if (info.type == TypeEnum.VARIABLE) {
                var extJson = JSON.parse(info.extdata);
                typename = extJson.t;
                return this._findOwnDefinePost(names, typename, usingnamespace);
            }
            //函数多级跳转
            if (info.type == TypeEnum.FUNCTION) {
                var extJson = JSON.parse(info.extdata);
                typename = extJson.r.t;
                return this._findOwnDefinePost(names, typename, usingnamespace);
            }
            return false;
        };
        this._findOwnDefinePosOne = function (fullname) {
            var df = new Definition(this.basedir, this.extPath);
            return df.findFullNameDefine(fullname);
        };
        //跨文件查找定义
        this._findOwnDefinePost = function (names, valetype, usingnamespace) {
            var df = new Definition(this.basedir, this.extPath);
            //转化成全名称
            valetype = df.getClassFullName(valetype, usingnamespace);
            //保留第0个
            for (var i = names.length - 1; i > 0; i--) {
                //依次找最终的结构
                var _nameInfo = DefineMap.getInstace().getRealName(valetype);
                var tmptype = this._findObjctWhitNames(valetype, names[i]);
                if (!tmptype) {
                    //尝试获取继承父的方法
                    var maxInherit_1 = 5;
                    var ownnames_1 = [valetype];
                    var dequeue_1 = [valetype];
                    while (--maxInherit_1 > 0) {
                        var _valtype = dequeue_1.pop();
                        if (!_valtype) {
                            //无元素可处理
                            break;
                        }
                        var result = df.getClassDefineInfo(_valtype, usingnamespace);
                        if (result == false) {
                            //没找到定义
                            break;
                        }
                        var inheritclass = result.inherit;
                        var mergerClassName = [];
                        for (var i_1 = 0; i_1 < inheritclass.length; i_1++) {
                            var _className = inheritclass[i_1].replace(/\<[\s\w,]{2,256}\>/, "");
                            dequeue_1.push(_className);
                            mergerClassName.push(_className);
                        }
                        ownnames_1 = ownnames_1.concat(mergerClassName);
                    }
                    ;
                    var fileinfo_1 = df.getDefineInWitchClass(ownnames_1, names[i].n, usingnamespace);
                    if (fileinfo_1 == false) {
                        //未找到定义
                        return false;
                    }
                    var extJson = JSON.parse(fileinfo_1.info.extdata);
                    valetype = extJson[0].r.t;
                    valetype = df.getClassFullName(valetype, usingnamespace);
                }
                else {
                    valetype = df.getMapedName(tmptype, valetype, _nameInfo.name, _nameInfo.namespace);
                    usingnamespace.push(_nameInfo.namespace);
                    valetype = df.getClassFullName(valetype, usingnamespace);
                }
            }
            //最后一个定义名称
            var lastname = names[0];
            //找到文件
            //转化成全名称
            var isProbuf = false;
            var maxInherit = 5;
            var ownnames = [valetype];
            var dequeue = [valetype];
            while (--maxInherit > 0) {
                var _valtype = dequeue.pop();
                if (!_valtype) {
                    //无元素可处理
                    break;
                }
                var result = df.getClassDefineInfo(_valtype, usingnamespace);
                if (result == false) {
                    //未找到定义,跳过
                    break;
                    ;
                }
                //这里只处理5层继承
                var inheritclass = result.inherit;
                var mergerClassName = [];
                for (var i = 0; i < inheritclass.length; i++) {
                    if (inheritclass[i] == "google::protobuf::Message") {
                        isProbuf = true;
                    }
                    var _className = inheritclass[i];
                    _className = _className.replace(/\<[\s\w,]{2,256}\>/, "");
                    dequeue.push(_className);
                    mergerClassName.push(_className);
                }
                ownnames = ownnames.concat(mergerClassName);
            }
            var name = lastname.n;
            if (isProbuf) {
                //当出现命名冲突的时候将无法提示
                //当出现set_xx_size的时候，会出现无法提示的问题
                name = name.replace(/^set_|^add_|^mutable_|^clear_|^has_|_size$|_IsValid$/g, "");
            }
            var fileinfo = df.getDefineInWitchClass(ownnames, name, usingnamespace);
            if (fileinfo == false) {
                //未找到定义
                return false;
            }
            var file_id = df.getRealFileId(fileinfo.info);
            var sourcefilepath = df.getFileInfo(file_id);
            var filepath = fileinfo.filepath;
            var ownname = fileinfo.ownname;
            //读取文件查找内容
            return df.readFileFindDefine(filepath, ownname, name, fileinfo.info.type, sourcefilepath);
        };
        //帮助提示
        this._getSignatureHelp = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            var _ipos = filecontext.lastIndexOf('(', filecontext.length);
            var laststr = "";
            if (_ipos != -1) {
                //裁剪到该位置
                laststr = filecontext.substring(_ipos);
                filecontext = filecontext.substring(0, _ipos);
            }
            if (this.fundefcache != "" && this.fundefcache != null) {
                //读缓存
                var cachesfunctiondef = JSON.parse(this.fundefcache);
                if (cachesfunctiondef['length'] == filecontext.length
                    && cachesfunctiondef['filename'] == filepath) {
                    //找到cache，直接用
                    logger.debug("use cache info");
                    var fundef = cachesfunctiondef.fundef;
                    //获取参数个数
                    var countmap_1 = this._getCharCountInStr(laststr, 0, new Set([',']));
                    fundef['paramsindex'] = countmap_1[','];
                    return fundef;
                }
                else {
                    //作废cache数据
                    this.fundefcache = "";
                }
            }
            var analyse = new AnalyseDomain(filecontext);
            var data = analyse.doAnalyse();
            var lengthmeta = [];
            for (var i = 0; i < data.length; i++) {
                var area = data[i];
                var begin = filecontext.indexOf(area);
                var end = begin + area.length;
                lengthmeta.push({ b: begin, e: end });
            }
            var _filecontext = data.reverse().join('\n');
            _filecontext = _filecontext.replace(/using namespace/g, "using_ns");
            var lines = _filecontext.split('\n');
            var completion = new Completion();
            //这里使用新的set，避免污染
            var usingnamespace = this._getUsingNamespace(lines, filepath, owns);
            //先找到最后一行的变量名称
            var lastline = lines[lines.length - 1];
            logger.mark("_getValName");
            var names = this._getValName(lastline);
            logger.mark("_getValName");
            var info = null;
            if (names.length == 0) {
                //有可能是静态函数，或者命名空间下的全局函数
                lastline = lastline.trim();
                lastline = lastline.replace(/[\s]{0,10}[:]{2,2}[\s]{0,10}/g, "::");
                if (lastline.length > 2 && lastline[0] == ":" && lastline[1] == ":") {
                    lastline = lastline.substring(2);
                }
                var _tmpcodes = lastline.split(/[\s\t\n([{<]{1,1}/g);
                var _tmptype = lastline;
                if (_tmpcodes.length > 0) {
                    _tmptype = _tmpcodes[_tmpcodes.length - 1].trim();
                }
                else {
                    return false;
                }
                //判断是否为合法的类型
                info = completion._GetStaticFunctionDefine(_tmptype, usingnamespace);
                if (!info) {
                    //没有找到变量
                    return false;
                }
            }
            else {
                //弹出最顶的，用来找定义
                var name_7 = names.pop();
                logger.mark("_getValDefineOwn");
                var _valetype = this._getValDefineOwn(lines, name_7.n);
                logger.mark("_getValDefineOwn");
                if (_valetype.t == "") {
                    //未找到变量类型，可能是函数或者宏定义
                    var ownname = this._getPosOwner(data);
                    info = completion._GetFunctionDefineByOwnAndName(name_7.n, ownname, usingnamespace);
                }
                else {
                    logger.mark("_GetFunctionDefine");
                    info = completion._GetFunctionDefine(names, _valetype.t, usingnamespace);
                    logger.mark("_GetFunctionDefine");
                }
            }
            if (!info) {
                return false;
            }
            logger.mark("_getSignatureHelp");
            var result = completion._getSignatureHelp(filepath, info);
            logger.mark("_getSignatureHelp");
            if (result != false) {
                //加入缓存
                //保存缓存
                var cachesfunctiondef = {
                    fundef: result,
                    length: filecontext.length,
                    filename: filepath
                };
                this.fundefcache = JSON.stringify(cachesfunctiondef);
            }
            //获取参数个数
            var countmap = this._getCharCountInStr(laststr, 0, new Set([',']));
            result['paramsindex'] = countmap[','];
            return result;
        };
        this._findLineNumWithCode = function (filecontext, lengthmeta, linecode) {
            for (var i = 0; i < lengthmeta.length; i++) {
                var linedata = filecontext.substring(lengthmeta[i].b, lengthmeta[i].e);
                var _pos = linedata.lastIndexOf(linecode);
                if (_pos != -1) {
                    //找到了
                    var beginPos = lengthmeta[i].b + _pos + linecode.length;
                    var _code = filecontext.substring(0, beginPos);
                    var _countnum = this._getCharCountInStr(_code, 0, new Set(['\n']));
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
        this._filePathFormat = function (filepath) {
            if (filepath[0] != '/') {
                filepath = "/" + filepath;
            }
            return filepath;
        };
        this._updateCheck = function (updatecallback) {
            cluster.setupMaster({
                exec: __dirname + "/worker/checkNeedUpdate.js",
                silent: false,
                windowsHide: true
            });
            var worker = cluster.fork();
            // paramsms结构定义
            var parasms = {
                baseurl: "http://cpptips.com:8888",
                basedir: "/Users/widyhu/.vscode/extensions/widyhu.cpptips-0.1.9/",
                intervaltime: 180000,
                maketools: 0
            };
            logger.debug(JSON.stringify(parasms));
            var path = require('path');
            var basedir = __dirname;
            basedir = path.resolve(basedir, '../');
            parasms.basedir = basedir;
            parasms.baseurl = this.userConfig.updateCheckUrl;
            parasms.intervaltime = this.userConfig.updateCheckIntervalTime;
            // parasms.basedir = __dirname;
            worker.send(parasms);
            worker.on('message', function (data) {
                if (data == "exit") {
                    worker.kill();
                }
                if (data == "update") {
                    logger.debug("need update");
                    updatecallback("update");
                }
            });
        };
        //////////////////////////////////////////////////////////////////////////////
        //一下方法提供给vscode调用
        //知道归属获取提示内容
        this.getAllNameByObj = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return [];
                }
                if (owns == null) {
                    owns = [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getAllNameByObj file type not match!");
                    return [];
                }
                //test
                logger.mark("_getAllNameByObj");
                var result = this._getAllNameByObj(filepath, filecontext, owns);
                logger.mark("_getAllNameByObj");
                return result;
            }
            catch (error) {
                logger.debug("call getAllNameByObj faild!", error);
                return [];
            }
        };
        //通过命名空间查找
        this.getAllNameByNamespace = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return [];
                }
                if (owns == null) {
                    owns = [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getAllNameByNamespace file type not match!");
                    return [];
                }
                return this._getAllNameByNamespace(filepath, filecontext, owns);
            }
            catch (error) {
                logger.debug("call getAllNameByObj faild!", error);
                return [];
            }
        };
        //获取提示说明
        this.getShowTips = function (filepath, data) {
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                return this._getShowTips(filepath, data);
            }
            catch (error) {
                logger.debug("call _getShowTips faild!", error);
                return false;
            }
        };
        //前缀匹配
        this.searchKeyWord = function (filepath, prekeyworld, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return [];
                }
                if (owns == null) {
                    owns = [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("searchKeyWord file type not match!");
                    return [];
                }
                return this._searchKeyWord(filepath, prekeyworld, filecontext, owns);
            }
            catch (error) {
                logger.debug("call _searchKeyWord faild!", error);
                return [];
            }
        };
        //重新加载知道文件
        this.reloadOneIncludeFile = function (filepath, callback) {
            if (callback === void 0) { callback = null; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return;
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".proto", ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("reloadOneIncludeFile this file not include.");
                    callback("error");
                    return;
                }
                return this._reloadOneIncludeFile(filepath, callback);
            }
            catch (error) {
                logger.debug("call _reloadOneIncludeFile faild!", error);
                return;
            }
        };
        //重新加载一批文件
        this.reloadBatchIncludeFile = function (filepaths, callback) {
            if (callback === void 0) { callback = null; }
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
            }
            catch (error) {
                logger.debug("call _reloadOneIncludeFile faild!", error);
            }
            return true;
        };
        //重新加载修改过的文件
        this.reloadAllIncludeFile = function (callback) {
            if (callback === void 0) { callback = null; }
            try {
                if (!this.isinit || this.loadindex) {
                    //索引加载中，功能暂时不可用
                    logger.debug("索引加载中，功能暂时不可用");
                    return;
                }
                var that_1 = this;
                function initSystemIncludeOver(msg) {
                    if (msg == "can_not_import") {
                        callback("can_not_import", 0, 0, 0);
                    }
                    //加载工程头文件
                    logger.info("begin _reloadAllIncludeFile!");
                    //初始化db
                    return that_1._reloadAllIncludeFile(callback);
                }
                //初始化系统头文件库
                logger.info("begin _initSystemIncludeIndex!");
                this._initSystemIncludeIndex(initSystemIncludeOver);
            }
            catch (error) {
                logger.debug("call _reloadOneIncludeFile faild!", error);
            }
        };
        //获取cpp文件的依赖
        this.getDependentByCpp = function (filepath, callback) {
            if (callback === void 0) { callback = null; }
            try {
                var that = this;
                filepath = this._filePathFormat(filepath);
                if (this.loadindex) {
                    //索引加载中，功能可能暂时不可用
                    //进行尝试分析，并且回调加入分析队列中，等待索引加载完成之后再分析一次
                    callback("busy", filepath, [], []);
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    callback("fileerror", filepath, [], []);
                    return;
                }
                logger.debug("dddd", this.isinit, this.loadindex);
                return that._getDependentByCpp(filepath, callback);
            }
            catch (error) {
                callback("error", filepath, [], []);
                logger.debug("call getDependentByCpp faild!", error);
                return;
            }
        };
        //获取变量定义
        this.getDefinePoint = function (filepath, filecontext, linelast, owns) {
            if (owns === void 0) { owns = []; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                if (owns == null) {
                    owns = [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getDefinePoint file type not match!");
                    return false;
                }
                return this._getDefinePoint(filepath, filecontext, linelast, owns);
            }
            catch (error) {
                console.log("call getDefinePoint faild!", error);
                logger.debug("call getDefinePoint faild!", error);
                return false;
            }
        };
        //跳转头文件定义
        this.getIncludeDefine = function (sourceFile, includeFile) {
            try {
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                var fileinfo = __path.parse(includeFile);
                var filename = fileinfo.base;
                var fileExt = fileinfo.ext;
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c", ""]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getIncludeDefine file type not match!");
                    return false;
                }
                return this._getIncludeDefine(sourceFile, includeFile, filename);
            }
            catch (error) {
                logger.debug("call getDefinePoint faild!", error);
                return false;
            }
        };
        //参数提示
        this.getSignatureHelp = function (filepath, filecontext, owns) {
            if (owns === void 0) { owns = []; }
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                if (owns == null) {
                    owns = [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getSignatureHelp file type not match!");
                    return false;
                }
                return this._getSignatureHelp(filepath, filecontext, owns);
            }
            catch (error) {
                logger.debug("call getSignatureHelp faild!", error);
                return [];
            }
        };
        //获取文档结构-非异步
        this.getDocumentTree = function (filepath, filecontext) {
            try {
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                var fileinfo = __path.parse(filepath);
                var fileExt = fileinfo.ext;
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c", ""]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("getDocumentTree file type not match!");
                    return false;
                }
                return this._getDocumentTree(filepath, filecontext);
            }
            catch (error) {
                logger.debug("call getDefinePoint faild!", error);
                return false;
            }
        };
        //自动填参数
        this.autoFillParams = function (filepath, filecontext, preParams) {
            try {
                filepath = this._filePathFormat(filepath);
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return [];
                }
                var pos = filepath.lastIndexOf('.');
                var fileExt = filepath.substring(pos);
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("autoFillParams file type not match!");
                    return [];
                }
                //test
                logger.mark("_autoFillParams");
                var result = this._autoFillParams(filepath, filecontext, preParams);
                logger.mark("_autoFillParams");
                return result;
            }
            catch (error) {
                logger.debug("call getAllNameByObj faild!", error);
                return [];
            }
        };
        //更新检查
        this.updateCheck = function (updatecallback) {
            try {
                this._updateCheck(updatecallback);
            }
            catch (error) {
                logger.debug("call updateCheck faild!", error);
            }
        };
        //进行语法检查 -- 废弃
        this.diagnostics = function (filepath, filecontext, diagnosticscallback) {
            try {
                if (!this.isinit) {
                    //索引加载中，功能暂时不可用
                    return false;
                }
                var fileinfo = __path.parse(filepath);
                var fileExt = fileinfo.ext;
                var includeExt = new Set(['.h', '.hpp', ".cpp", ".c"]);
                if (!includeExt.has(fileExt)) {
                    logger.debug("diagnostics file type not match!");
                    return false;
                }
                return this._diagnostics(filepath, filecontext, diagnosticscallback);
            }
            catch (error) {
                logger.debug("call getDefinePoint faild!", error);
                return false;
            }
        };
        //退出
        this.onShutdown = function () {
            //遍历所有进程
            function eachWorker(callback) {
                for (var id in cluster.workers) {
                    callback(cluster.workers[id]);
                }
            }
            eachWorker(function (worker) {
                //通知所有进程退出
                worker.send('shutdown');
                timeout = setTimeout(function () {
                    //强制退出
                    worker.kill();
                }, 5000);
            });
        };
        this._splitForAllPathNamesapce = function (ownname, usingnamespace) {
            var findclass = KeyWordStore.getInstace().getByNameAndNamespaces(ownname, usingnamespace);
            if (findclass != false) {
                for (var i = 0; i < findclass.length; i++) {
                    if (findclass[i].type == TypeEnum.CALSS && findclass[i].namespace != "") {
                        var _namespace = findclass[i].namespace;
                        var _nss = _namespace.split("::");
                        var _nsarray = [];
                        for (var j = 0; j < _nss.length - 1; j++) {
                            _nsarray.push(_nss[j]);
                            var _ns = _nsarray.join("::");
                            usingnamespace.push(_ns);
                        }
                    }
                }
            }
            var setNs = new Set(usingnamespace);
            usingnamespace = Array.from(setNs);
            return usingnamespace;
        };
        this.isinit = false;
        this.basedir = "";
        this.dbpath = "";
        this.namespacestore = {};
        //缓存
        this.fundefcache = null;
        //loadindex
        this.loadindex = false;
        //用户配置
        this.configs = {};
    }
    //单例方法
    CodeAnalyse.getInstace = function () {
        if (!CodeAnalyse.instance) {
            CodeAnalyse.instance = new CodeAnalyse();
        }
        return CodeAnalyse.instance;
    };
    ;
    //获取字符串中指定字符的个数
    CodeAnalyse.prototype._getCharCountInStr = function (str, beginpos, charset) {
        var result = {};
        charset.forEach(function (e) { result[e] = 0; });
        for (var i = beginpos; i < str.length; i++) {
            if (charset.has(str[i])) {
                result[str[i]]++;
            }
        }
        return result;
    };
    ;
    CodeAnalyse.prototype._getUsingNamespace = function (lines, filepath, owns) {
        var usingnamespace = [''];
        //获取文档的内置命名空间
        var fileown = this._getFileNamespace(lines);
        if (fileown != "") {
            usingnamespace.push(fileown);
        }
        if (this.namespacestore[filepath]) {
            var uns = this.namespacestore[filepath];
            usingnamespace = usingnamespace.concat(uns);
        }
        var deplicate = new Set(usingnamespace);
        for (var i = 0; i < owns.length; i++) {
            if (!deplicate.has(owns[i])) {
                usingnamespace.push(owns[i]);
                deplicate.add(owns[i]);
            }
        }
        return usingnamespace;
    };
    ;
    return CodeAnalyse;
}());
;
module.exports = {
    CodeAnalyse: CodeAnalyse
};
