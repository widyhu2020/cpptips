/* --------------------------------------------------------------------------------------------
 * traverse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var fs = require('fs');
var path = require('path');
var FileIndexStore = require('../store/store').FileIndexStore;
var Filetype = require('../traversedir/filetype').Filetype;
var FileType = require('../store/store').FileType;
var logger = require('log4js').getLogger("cpptips");
var Traverse = /** @class */ (function (_super) {
    __extends(Traverse, _super);
    function Traverse(basedir, userConfig, isAnlyseSystemDir, analyseIncludeCallBack, analyseSourceCallBack) {
        var _this = _super.call(this) || this;
        //加载目录所有文件
        _this.scanDirFile = function (resolve) {
            var that = this;
            //处理文件
            this.uniqueDir = new Set([]);
            this._readDir(this.basedir);
            logger.debug("include process over");
            //延迟10s开始分析文件
            setTimeout(this.analyseConsumer, 3000, that, resolve);
        };
        //batch添加文件分析任务
        _this.addAnalyseFileTasl = function (files, resolve) {
            var that = this;
            for (var i = 0; i < files.length; i++) {
                //判断是否需要忽略的文件夹
                if (that._checkIsIgnorDir(files[0])) {
                    logger.debug("need ignor dir!", files[0]);
                    continue;
                }
                this._judgeFileTypeAndSave(files[0]);
            }
            //延迟10s开始分析文件
            setTimeout(this.analyseConsumer, 1, that, resolve);
        };
        //消费者
        _this.analyseConsumer = function (that, resolve) {
            var needEmptyTime = 0;
            var timer = null;
            timer = setInterval(function () {
                if (that.needStop) {
                    logger.debug("find need exit!");
                    that.includefiles = [];
                    that.sourcefiles = [];
                    clearInterval(timer);
                    resolve();
                    return;
                }
                //处理include
                var includeitem = that.includefiles.pop();
                if (includeitem) {
                    //logger.debug(includeitem.f);
                    that.needStop = that.analyseIncludeCallBack(includeitem.f, includeitem.t);
                    return;
                }
                //处理源文件
                var sourcefile = that.sourcefiles.pop();
                if (sourcefile) {
                    //logger.debug(sourcefile);
                    that.needStop = that.analyseSourceCallBack(sourcefile.f, sourcefile.t);
                    return;
                }
                needEmptyTime++;
                if (needEmptyTime > 5000) {
                    //5s内都没有数据产生
                    //处理完成
                    logger.debug("clearInterval");
                    clearInterval(timer);
                    resolve();
                }
            }, 1);
        };
        //获取，目录下需要处理文件的数量
        _this.getFileNumInDir = function (callbackshow) {
            var taskTotal = 0;
            this.uniqueDir = new Set([]);
            taskTotal = this._readDirForTotalFile(this.basedir, callbackshow);
            return taskTotal;
        };
        //遍历文件
        _this.traverseFilesDelNotExists = function (callback) {
            var types = [
                FileType.INCLUDE_FILE,
                FileType.PROTOBUF_FILE,
                FileType.SOURCE_FILE
            ];
            callback("正在获取索引库中所有文件数");
            var totalNum = this.fis.getFileTotalWhithType(types);
            callback("获取索引文件库文件完成，总共：" + totalNum);
            logger.debug("begin traveseinclude... totalNum:", totalNum);
            //单次获取2000个
            var batchCount = 2000;
            var beginIndex = 0;
            var needDeleteFileName = [];
            var needDelete = [];
            while (beginIndex < totalNum) {
                var endIndex = beginIndex + batchCount;
                callback("正在批量获取文件：当前，" + endIndex + "每页2000条");
                logger.debug(beginIndex, "-", batchCount);
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
                logger.debug("file not exists. list:", JSON.stringify(needDeleteFileName));
                callback("发现大量删除文件，可能判断有误，不进行索引清理");
                return;
            }
            for (var i = 0; i < needDelete.length; i++) {
                var _id = needDelete[i];
                callback("正在清理文件及其索引:" + _id);
                logger.debug("totalfile:", totalNum, "needDeleteId:", _id);
                this.fis.delete(_id);
            }
        };
        //遍历原文件-暂时废弃
        _this.traverseSource = function (callback, callbackprocess) {
            var types = [FileType.SOURCE_FILE];
            var totalNum = this.fis.getFileTotalWhithType(types);
            logger.debug("begin traverseSource... totalNum:", totalNum);
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
                        logger.debug("need stop and exit!");
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
        _this._judgeFileTypeAndSave = function (filepath) {
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
        _this._checkIsIgnorDir = function (filepath) {
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
        _this._readDirForTotalFile = function (dirfather, callbackshow) {
            var total = 0;
            var that = this;
            var dirf = fs.readdirSync(dirfather, { 'encoding': 'utf8', 'withFileTypes': false });
            dirf.forEach(function (el, index) {
                if (that.needStop) {
                    //需要退出，不再处理
                    //logger.debug("need stop and exit!");
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
                    //logger.debug("system file, not analyse!");
                    return total;
                }
                var dataFile = null;
                try {
                    //不判断软连接
                    dataFile = fs.statSync(filename);
                    dataFileLStat = fs.lstatSync(filename);
                }
                catch (error) {
                    return total;
                }
                //一定得fstatSync方法
                if (dataFileLStat.isSymbolicLink()
                    && !that.analyseLinkDir.has(wkfilename)
                    && !that.analyseLinkDir.has(wkfilename + "/")) {
                    //软链接跳过,且没加入明确执行分析计划
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
                        return total;
                    }
                    total = total + that._readDirForTotalFile(filename, callbackshow);
                }
                else if (needFile && dataFile.isFile()) {
                    //防止重复分析
                    var pathinfo = path.parse(filename);
                    var uniqueName = pathinfo.name + pathinfo.ext + "_" + dataFileLStat.size + "_" + dataFileLStat.mtimeMs;
                    if (that.uniqueDir.has(uniqueName)) {
                        //该目录已经分析过
                        //logger.debug("file cycle:", filename, uniqueName);
                        return total;
                    }
                    that.uniqueDir.add(uniqueName);
                    var pos = filename.lastIndexOf(".");
                    var ext = filename.substr(pos);
                    if (that.includeExt.has(ext)
                        || that.sourceExt.has(ext)
                        || that._checkIsSystem(filename)) {
                        total++;
                    }
                }
            });
            if (total > 200000) {
                //文件超过200000个，终止扫描
                that.needStop = true;
            }
            return total;
        };
        //扫描目录文件并分析
        _this._readDir = function (dirfather) {
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
                    //logger.debug("system file, not analyse!");
                    return;
                }
                var dataFile = null;
                try {
                    //不判断软连接
                    dataFile = fs.statSync(filename);
                    dataFileLStat = fs.lstatSync(filename);
                }
                catch (error) {
                    return;
                }
                //一定得fstatSync方法
                if (dataFileLStat.isSymbolicLink()
                    && !that.analyseLinkDir.has(wkfilename)
                    && !that.analyseLinkDir.has(wkfilename + "/")) {
                    //软链接跳过,且没加入明确执行分析计划
                    //logger.debug("this file is symbolic link! and not in link dir!", wkfilename);
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
                        //logger.debug(filename);
                        return;
                    }
                    if (that.needStop) {
                        //需要退出，不再处理
                        //logger.debug("need stop and exit!");
                        return;
                    }
                    //防止重复分析
                    var pathinfo = path.parse(filename);
                    var uniqueName = pathinfo.name + pathinfo.ext + "_" + dataFileLStat.size + "_" + dataFileLStat.mtimeMs;
                    if (that.uniqueDir.has(uniqueName)) {
                        //该目录已经分析过
                        //logger.debug("file cycle:", filename, uniqueName);
                        return;
                    }
                    that.uniqueDir.add(uniqueName);
                    setImmediate(function () { that._judgeFileTypeAndSave(wkfilename); });
                }
            });
        };
        _this.basedir = basedir;
        _this.analyseIncludeCallBack = analyseIncludeCallBack;
        _this.analyseSourceCallBack = analyseSourceCallBack;
        _this.isAnlyseSystemDir = isAnlyseSystemDir;
        //防重检查
        _this.uniqueDir = new Set([]);
        //queue
        _this.includefiles = [];
        _this.sourcefiles = [];
        _this.fis = FileIndexStore.getInstace();
        _this.userConfig = userConfig;
        _this.needStop = false;
        _this.analyseLinkDir = new Set([]);
        if (_this.userConfig.needLoadLinkDir
            && _this.userConfig.needLoadLinkDir instanceof Array) {
            _this.analyseLinkDir = new Set(_this.userConfig.needLoadLinkDir);
        }
        //需要忽略的文件或者文件的匹配
        logger.debug("Traverse:", JSON.stringify(userConfig));
        logger.debug("isAnlyseSystemDir:", JSON.stringify(isAnlyseSystemDir));
        var regex = [];
        _this.regexStr = "^[\\/]{1,1}[.~]{1,1}[0-9a-z]{1,128}$";
        if (_this.userConfig.ignoreFileAndDir
            && _this.userConfig.ignoreFileAndDir instanceof Array) {
            regex = _this.userConfig.ignoreFileAndDir;
            _this.regexStr = "(" + regex.join(")|(") + ")";
            logger.debug("user regex:", _this.regexStr);
        }
        ;
        //需要忽略的目录，不支持匹配
        _this.ignorDir = [];
        if (_this.userConfig.ignorDir
            && _this.userConfig.ignorDir instanceof Array) {
            _this.ignorDir = _this.userConfig.ignorDir;
        }
        logger.debug("ignorDir:", JSON.stringify(_this.ignorDir));
        //需要加载的目录，不支持匹配
        _this.needLoadDir = [];
        if (_this.userConfig.needLoadDir
            && _this.userConfig.needLoadDir instanceof Array) {
            _this.needLoadDir = _this.userConfig.needLoadDir;
        }
        //needLoadDir是否有软连接，如果有加入this.analyseLinkDir
        for (var i = 0; i < _this.needLoadDir.length; i++) {
            var path_1 = _this.needLoadDir[i];
            try {
                var fileStat = fs.lstatSync(_this.basedir + path_1);
                if (fileStat.isSymbolicLink()) {
                    _this.analyseLinkDir.add(path_1);
                }
            }
            catch (error) {
            }
        }
        //链接全部加入索引计算范围
        for (var i = 0; _this.userConfig.needLoadLinkDir && i < _this.userConfig.needLoadLinkDir.length; i++) {
            var path_2 = _this.userConfig.needLoadLinkDir[i];
            _this.needLoadDir.push(path_2);
        }
        logger.debug("needLoadDir:", JSON.stringify(_this.needLoadDir));
        return _this;
    }
    ;
    return Traverse;
}(Filetype));
;
module.exports = {
    Traverse: Traverse
};
