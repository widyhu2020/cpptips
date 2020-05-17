/* --------------------------------------------------------------------------------------------
 * traverse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var fs = require('fs');
var path = require('path');
var FileIndexStore = require('../store/store').FileIndexStore;
var FileType = require('../store/store').FileType;
var Traverse = /** @class */ (function () {
    function Traverse(basedir, userConfig, isAnlyseSystemDir, analyseIncludeCallBack, analyseSourceCallBack) {
        //加载目录所有文件
        this.scanDirFile = function (resolve) {
            var that = this;
            //处理文件
            this._readDir(this.basedir);
            console.log("include process over");
            //延迟10s开始分析文件
            setTimeout(this.analyseConsumer, 3000, that, resolve);
        };
        //batch添加文件分析任务
        this.addAnalyseFileTasl = function (files, resolve) {
            var that = this;
            for (var i = 0; i < files.length; i++) {
                //判断是否需要忽略的文件夹
                if (that._checkIsIgnorDir(files[0])) {
                    console.debug("need ignor dir!", files[0]);
                    continue;
                }
                this._judgeFileTypeAndSave(files[0]);
            }
            //延迟10s开始分析文件
            setTimeout(this.analyseConsumer, 1, that, resolve);
        };
        //消费者
        this.analyseConsumer = function (that, resolve) {
            var needEmptyTime = 0;
            var timer = null;
            timer = setInterval(function () {
                if (that.needStop) {
                    console.log("find need exit!");
                    that.includefiles = [];
                    that.sourcefiles = [];
                    clearInterval(timer);
                    resolve();
                    return;
                }
                //处理include
                var includeitem = that.includefiles.pop();
                if (includeitem) {
                    //console.log(includeitem.f);
                    that.needStop = that.analyseIncludeCallBack(includeitem.f, includeitem.t);
                    return;
                }
                //处理源文件
                var sourcefile = that.sourcefiles.pop();
                if (sourcefile) {
                    //console.log(sourcefile);
                    that.needStop = that.analyseSourceCallBack(sourcefile.f, sourcefile.t);
                    return;
                }
                needEmptyTime++;
                if (needEmptyTime > 5000) {
                    //5s内都没有数据产生
                    //处理完成
                    console.log("clearInterval");
                    clearInterval(timer);
                    resolve();
                }
            }, 1);
        };
        //获取，目录下需要处理文件的数量
        this.getFileNumInDir = function (callbackshow) {
            var taskTotal = 0;
            taskTotal = this._readDirForTotalFile(this.basedir, callbackshow);
            return taskTotal;
        };
        //遍历文件
        this.traverseFilesDelNotExists = function (callback) {
            var types = [
                FileType.INCLUDE_FILE,
                FileType.PROTOBUF_FILE,
                FileType.SOURCE_FILE
            ];
            callback("正在获取索引库中所有文件数");
            var totalNum = this.fis.getFileTotalWhithType(types);
            callback("获取索引文件库文件完成，总共：" + totalNum);
            console.log("begin traveseinclude... totalNum:", totalNum);
            //单次获取2000个
            var batchCount = 2000;
            var beginIndex = 0;
            var needDeleteFileName = [];
            var needDelete = [];
            while (beginIndex < totalNum) {
                var endIndex = beginIndex + batchCount;
                callback("正在批量获取文件：当前，" + endIndex + "每页2000条");
                console.log(beginIndex, "-", batchCount);
                var infos = this.fis.getFilesWhithType(types, beginIndex, batchCount);
                for (var i = 0; i < infos.length; i++) {
                    if (infos[i].systeminclude == 1) {
                        //系统文件跳过
                        continue;
                    }
                    var filepath = infos[i].filepath;
                    if (!fs.existsSync(this.basedir + filepath)) {
                        //文件不存在，删除数据
                        needDeleteFileName.push(filepath);
                        needDelete.push(infos[i].id);
                        callback("发现文件已经删除：" + filepath + ", id:" + infos[i].id);
                    }
                }
                beginIndex = endIndex;
            }
            ;
            if (totalNum < needDeleteFileName.length * 2) {
                //如果文件超过一半不存在，可能存在问题
                console.log("file not exists. list:", JSON.stringify(needDeleteFileName));
                callback("发现大量删除文件，可能判断有误，不进行索引清理");
                return;
            }
            for (var i = 0; i < needDelete.length; i++) {
                var _id = needDelete[i];
                callback("正在清理文件及其索引:" + _id);
                console.log("totalfile:", totalNum, "needDeleteId:", _id);
                this.fis.delete(_id);
            }
        };
        //遍历原文件-暂时废弃
        this.traverseSource = function (callback, callbackprocess) {
            var types = [FileType.SOURCE_FILE];
            var totalNum = this.fis.getFileTotalWhithType(types);
            console.log("begin traverseSource... totalNum:", totalNum);
            //单次获取1000个
            var batchCount = 1000;
            var beginIndex = 0;
            var showprocess = 0;
            while (beginIndex < totalNum) {
                var endIndex = beginIndex + batchCount;
                var infos = this.fis.getFilesWhithType(types, beginIndex, batchCount);
                for (var i = 0; i < infos.length; i++) {
                    //let filepath = infos[i].filepath;
                    var needStop = callback(infos[i]);
                    if (needStop) {
                        //需要退出，不再处理
                        console.debug("need stop and exit!");
                        return;
                    }
                    var nowshowprocess = ((beginIndex + i) / totalNum) * 100;
                    if (nowshowprocess - showprocess > 0.5) {
                        callbackprocess(totalNum, (beginIndex + i), showprocess.toFixed(2), "source");
                        showprocess = nowshowprocess;
                    }
                }
                beginIndex = endIndex;
            }
        };
        //判断文件类型：返回1为头文件；2为源文件，其他无需处理
        this.judgeFileType = function (filepath) {
            var pos = filepath.lastIndexOf(".");
            if (pos == -1) {
                //文件名称不以后缀结尾
                return FileType.OTHER_FILE;
            }
            var ext = filepath.substr(pos);
            if (!this.includeExt.has(ext) && !this.sourceExt.has(ext)) {
                //不符合条件的文件
                return FileType.OTHER_FILE;
            }
            if (this.includeExt.has(ext) || this._checkIsSystem(filepath)) {
                //usr下所有的文件全部当头文件处理
                if (ext == ".tcc") {
                    //.tcc文件不要处理
                    return FileType.OTHER_FILE;
                }
                if (ext == ".proto") {
                    return FileType.PROTOBUF_FILE;
                }
                return FileType.INCLUDE_FILE;
            }
            if (this.sourceExt.has(ext)) {
                return FileType.SOURCE_FILE;
            }
            return FileType.OTHER_FILE;
        };
        //判断是否系统库函数
        this._checkIsSystem = function (filepath) {
            // /usr/local/
            // /google/protobuf/
            if (filepath.indexOf("/usr/local/") != -1 || filepath.indexOf("\\usr\\local\\") != -1
                || filepath.indexOf("/usr/include/") != -1 || filepath.indexOf("\\usr\\include\\") != -1
                || filepath.indexOf("/google/protobuf/") != -1 || filepath.indexOf("\\google\\protobuf\\") != -1
                || /.*\.tcc$/g.test(filepath)) {
                //如果不是usr系统目录
                //protobuf库里面已经加载过，这里直接pass
                return true;
            }
            return false;
        };
        this._judgeFileTypeAndSave = function (filepath) {
            var pos = filepath.lastIndexOf(".");
            if (pos == -1
                && !this._checkIsSystem(filepath)) {
                //文件名称不以后缀结尾
                //系统头文件除外
                return;
            }
            var ext = filepath.substr(pos);
            if (this.includeExt.has(ext) || this._checkIsSystem(filepath)) {
                //usr下所有的文件全部当头文件处理
                //头文件
                if (ext == ".proto") {
                    //protobuf定义
                    this.includefiles.push({ f: filepath, t: FileType.PROTOBUF_FILE });
                    return;
                }
                //头文件
                //变量头文件需要保存头文件
                this.includefiles.push({ f: filepath, t: FileType.INCLUDE_FILE });
                return;
            }
            if (this.sourceExt.has(ext)) {
                //源文件
                this.sourcefiles.push({ f: filepath, t: FileType.SOURCE_FILE });
                return;
            }
        };
        //判断是否在忽略的文件假名单中
        this._checkIsIgnorDir = function (filepath) {
            //目录处理
            var _filepath = filepath;
            if (filepath[filepath.length - 1] != "/") {
                _filepath = _filepath + "/";
            }
            //没有配置的时候工程全部目录都加载
            if (this.needLoadDir.length > 0) {
                //未配置表示默认加载所有
                var findInConfig = false;
                for (var i = 0; i < this.needLoadDir.length; i++) {
                    if (_filepath.indexOf(this.needLoadDir[i]) == 0) {
                        //命中需要加载的目录
                        findInConfig = true;
                        break;
                    }
                }
                if (!findInConfig) {
                    //未在需要加载的目录中
                    //正则匹配忽略
                    var pathinfo_1 = path.parse(filepath);
                    var realname_1 = pathinfo_1.base;
                    var reg_1 = new RegExp(this.regexStr, "ig");
                    var testResult_1 = reg_1.test(realname_1);
                    if (testResult_1) {
                        //不满足条件的目录和文件
                        return 2;
                    }
                    return 1;
                }
            }
            //在需要加载目录的情况下，还需要过滤是否不需要加载
            for (var i = 0; i < this.ignorDir.length; i++) {
                if (_filepath.indexOf(this.ignorDir[i]) == 0) {
                    //命中忽略目录
                    return 3;
                }
            }
            //正则匹配忽略
            var pathinfo = path.parse(filepath);
            var realname = pathinfo.base;
            var reg = new RegExp(this.regexStr, "ig");
            var testResult = reg.test(realname);
            if (testResult) {
                //不满足条件的目录和文件
                return 2;
            }
            return 0;
        };
        //统计任务数量
        this._readDirForTotalFile = function (dirfather, callbackshow) {
            var total = 0;
            var that = this;
            var dirf = fs.readdirSync(dirfather, { 'encoding': 'utf8', 'withFileTypes': false });
            dirf.forEach(function (el, index) {
                if (that.needStop) {
                    //需要退出，不再处理
                    //console.debug("need stop and exit!");
                    return total;
                }
                // 加上父级访问更深层的文件夹
                var filename = "" + dirfather + "/" + el;
                var wkfilename = filename.replace(that.basedir, "");
                //let _pos = filename.lastIndexOf('/');
                //let realname = filename.substring(_pos + 1);
                if (filename.split('/').length > 20) {
                    //10层以上的目录结构不处理
                    return total;
                }
                //判断是否需要忽略的文件夹
                var needFile = true;
                var _ret = that._checkIsIgnorDir(wkfilename);
                if (_ret == 1) {
                    needFile = false;
                }
                else if (_ret > 0) {
                    return total;
                }
                //系统文件不需要分析，安装插件包里面包含
                if (!that.isAnlyseSystemDir
                    && that._checkIsSystem(filename)) {
                    //console.debug("system file, not analyse!");
                    return total;
                }
                var dataFile = null;
                try {
                    //不判断软连接
                    dataFile = fs.statSync(filename);
                    // dataFile = fs.lstatSync(filename);
                }
                catch (error) {
                    //console.log(error);
                    return total;
                }
                if (!dataFile) {
                    return total;
                }
                else if (dataFile.isDirectory()) {
                    // 又是文件夹
                    // 遍历文件夹
                    //回调目录
                    if (parseInt(Math.random() * 3) == 0) {
                        //三分之一的展示进度
                        var showName = wkfilename;
                        if (showName.length > 32) {
                            var pathitems = showName.split("/");
                            if (pathitems.length > 5) {
                                showName = "/" + pathitems[1] + "/"
                                    + pathitems[2] + "/" + "..." + "/"
                                    + pathitems[pathitems.length - 2] + "/"
                                    + pathitems[pathitems.length - 1];
                            }
                        }
                        that.needStop = callbackshow(showName);
                    }
                    if (that.needStop) {
                        //需要退出，不再处理
                        //console.debug("need stop and exit!");
                        return total;
                    }
                    total = total + that._readDirForTotalFile(filename, callbackshow);
                }
                else if (needFile && dataFile.isFile()) {
                    var pos = filename.lastIndexOf(".");
                    var ext = filename.substr(pos);
                    if (that.includeExt.has(ext)
                        || that.sourceExt.has(ext)
                        || that._checkIsSystem(filename)) {
                        total++;
                    }
                }
            });
            if (total > 150000) {
                //文件超过150000个，终止扫描
                that.needStop = true;
            }
            return total;
        };
        //扫描目录文件并分析
        this._readDir = function (dirfather) {
            var that = this;
            var dirf = fs.readdirSync(dirfather, { 'encoding': 'utf8', 'withFileTypes': false });
            // 这个data数组中装的是当前文件夹下所有的文件名(包括文件夹)
            dirf.forEach(function (el, _index) {
                if (that.needStop) {
                    //需要退出，不再处理
                    return;
                }
                // 加上父级访问更深层的文件夹
                var filename = "" + dirfather + "/" + el;
                var wkfilename = filename.replace(that.basedir, "");
                if (filename.split('/').length > 20) {
                    //10层以上的目录结构不处理
                    return;
                }
                //判断是否需要忽略的文件夹
                var needFile = true;
                var _ret = that._checkIsIgnorDir(wkfilename);
                if (_ret == 1) {
                    needFile = false;
                }
                else if (_ret > 0) {
                    return;
                }
                //系统文件不需要分析，安装插件包里面包含
                if (!that.isAnlyseSystemDir
                    && that._checkIsSystem(filename)) {
                    //console.debug("system file, not analyse!");
                    return;
                }
                var dataFile = null;
                try {
                    //不判断软连接
                    dataFile = fs.statSync(filename);
                    //dataFile = fs.lstatSync(filename);
                }
                catch (error) {
                    //console.log(error);
                    return;
                }
                if (!dataFile) {
                    return;
                }
                else if (dataFile.isDirectory()) {
                    // 又是文件夹
                    // 遍历文件夹
                    that._readDir(filename);
                }
                else if (needFile && dataFile.isFile()) {
                    //后缀校验
                    var pos = filename.lastIndexOf(".");
                    var ext = filename.substr(pos);
                    if (!that.includeExt.has(ext)
                        && !that.sourceExt.has(ext)
                        && !that._checkIsSystem(filename)) {
                        //非系统这里暂时不考虑没有后缀的头文件
                        //console.log(filename);
                        return;
                    }
                    if (that.needStop) {
                        //需要退出，不再处理
                        //console.debug("need stop and exit!");
                        return total;
                    }
                    setImmediate(function () { that._judgeFileTypeAndSave(wkfilename); });
                }
            });
        };
        this.basedir = basedir;
        this.analyseIncludeCallBack = analyseIncludeCallBack;
        this.analyseSourceCallBack = analyseSourceCallBack;
        this.isAnlyseSystemDir = isAnlyseSystemDir;
        //queue
        this.includefiles = [];
        this.sourcefiles = [];
        this.includeExt = new Set(['.h', '.hpp', ".proto"]);
        this.sourceExt = new Set(['.c', '.cc', '.cpp']);
        this.fis = FileIndexStore.getInstace();
        this.userConfig = userConfig;
        this.needStop = false;
        this.analyseLinkDir = new Set([]);
        if (this.userConfig.needLoadLinkDir
            && this.userConfig.needLoadLinkDir instanceof Array) {
            this.analyseLinkDir = new Set(this.userConfig.needLoadLinkDir);
        }
        //需要忽略的文件或者文件的匹配
        console.log("Traverse:", JSON.stringify(userConfig));
        console.log("isAnlyseSystemDir:", JSON.stringify(isAnlyseSystemDir));
        var regex = [];
        this.regexStr = "^[\\/]{1,1}[.~]{1,1}[0-9a-z]{1,128}$";
        if (this.userConfig.ignoreFileAndDir
            && this.userConfig.ignoreFileAndDir instanceof Array) {
            regex = this.userConfig.ignoreFileAndDir;
            this.regexStr = "(" + regex.join(")|(") + ")";
            console.log("user regex:", this.regexStr);
        }
        ;
        //需要忽略的目录，不支持匹配
        this.ignorDir = [];
        if (this.userConfig.ignorDir
            && this.userConfig.ignorDir instanceof Array) {
            this.ignorDir = this.userConfig.ignorDir;
        }
        console.log("ignorDir:", JSON.stringify(this.ignorDir));
        //需要加载的目录，不支持匹配
        this.needLoadDir = [];
        if (this.userConfig.needLoadDir
            && this.userConfig.needLoadDir instanceof Array) {
            this.needLoadDir = this.userConfig.needLoadDir;
        }
        console.log("needLoadDir:", JSON.stringify(this.needLoadDir));
    }
    ;
    return Traverse;
}());
;
module.exports = {
    Traverse: Traverse
};
