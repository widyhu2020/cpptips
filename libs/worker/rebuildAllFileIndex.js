/* --------------------------------------------------------------------------------------------
 * rebuildAllFileIndex.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var cluster = require('cluster');
var Analyse = require('../analyse/analyse').Analyse;
var TypeEnum = require('../analyse/analyse').TypeEnum;
var Traverse = require('../traversedir/traverse');
var fs = require('fs');
var path = require('path');
var util = require('util');
var crypto = require('crypto');
var FileIndexStore = require('../store/store').FileIndexStore;
var KeyWordStore = require('../store/store').KeyWordStore;
var FileType = require('../store/store').FileType;
var logger = require('log4js').getLogger("cpptips");
var needStop = false;
var RebuildFileIndex = /** @class */ (function () {
    function RebuildFileIndex(basedir, dbpath, issystem) {
        if (issystem === void 0) { issystem = 0; }
        this.setUserConfig = function (userConfig) {
            this.userConfig = userConfig;
        };
        this.reloadKeywordBySignleFile = function (filepath) {
            var tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, null, null);
            var type = tr.judgeFileType(filepath);
            if (type == FileType.PROTOBUF_FILE
                || type == FileType.INCLUDE_FILE) {
                //强制加载
                return this._analyseReadIncludeFile(filepath, type, false);
            }
            else if (type == FileType.SOURCE_FILE) {
                //强制加载
                return this._analyseReadSourceFile(filepath, type, false);
            }
        };
        this.forkReloadKeywordBySignleFile = function (filepath) {
            var tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, null, null);
            var type = tr.judgeFileType(filepath);
            if (type == FileType.PROTOBUF_FILE
                || type == FileType.INCLUDE_FILE) {
                //强制加载
                return this._analyseReadIncludeFile(filepath, type, true);
            }
            else if (type == FileType.SOURCE_FILE) {
                //强制加载
                return this._analyseReadSourceFile(filepath, type, true);
            }
        };
        this.batchReloadFiles = function (filepaths, updateProcess, resolve) {
            var that = this;
            var index = 0;
            var totalNum = filepaths.length;
            var showprocess = 0;
            function __readIncludeFile(filepath, filetype) {
                //处理头文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadIncludeFile(filepath, filetype, false);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.01) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            function __readSourceFile(filepath, filetype) {
                //处理源文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadSourceFile(filepath, filetype, false);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.1) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "source");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            var tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
            tr.addAnalyseFileTasl(filepaths, resolve);
        };
        //重新编译头文件索引
        this.rebuildIncludeTree = function (updateProcess, resolve) {
            var that = this;
            var index = 0;
            var totalNum = 0;
            var showprocess = 0;
            function __readIncludeFile(filepath, filetype) {
                //处理头文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadIncludeFile(filepath, filetype, false);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.01) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            function __readSourceFile(filepath, filetype) {
                //处理源文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadSourceFile(filepath, filetype, false);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.1) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "source");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            function _inDirTipsShow(path) {
                //扫码目录回调
                updateProcess(0, 0, 0, "scan_ing", path);
                return that.needExit;
            }
            function _inDeleteNotExists(msg) {
                logger.debug(msg);
                return that.needExit;
            }
            //目录扫描器
            var tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
            //清楚已经删除了的文件
            console.debug("traverseFilesDelNotExists");
            tr.traverseFilesDelNotExists(_inDeleteNotExists);
            console.debug("traverseFilesDelNotExists");
            totalNum = tr.getFileNumInDir(_inDirTipsShow);
            if (totalNum > 200000) {
                //大于200000个文件将不创建索引，强制引导指定索引目录
                updateProcess(0, 0, 0, "stop_load_index", "");
                return;
            }
            if (totalNum > 50000) {
                //大于50000个提示指定目录，但不强制拦截
                updateProcess(0, 0, 0, "show_file_more", "");
            }
            //分析头文件遍历
            tr.scanDirFile(resolve);
        };
        //强制加载所有的索引
        this.forkRebuildIncludeTree = function (updateProcess, resolve) {
            var that = this;
            var index = 0;
            var totalNum = 0;
            var showprocess = 0;
            function __readIncludeFile(filepath, filetype) {
                //处理头文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadIncludeFile(filepath, filetype, true);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.1) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            function __readSourceFile(filepath, filetype) {
                //处理源文件
                if (that.needExit) {
                    //退出进程
                    logger.debug("main process send message, child need exit.");
                    return that.needExit;
                }
                index++;
                that._analyseReadSourceFile(filepath, filetype, true);
                var nowshowprocess = (index / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.1) {
                    updateProcess(totalNum, index, showprocess.toFixed(2), "source");
                    showprocess = nowshowprocess;
                }
                return that.needExit;
            }
            function _inDirTipsShow(path) {
                //扫码目录回调
                updateProcess(0, 0, 0, "scan_ing", path);
                return that.needExit;
            }
            function _inDeleteNotExists(msg) {
                logger.debug(msg);
                return that.needExit;
            }
            //目录扫描器
            var tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
            //清楚已经删除了的文件
            console.debug("traverseFilesDelNotExists");
            tr.traverseFilesDelNotExists(_inDeleteNotExists);
            console.debug("traverseFilesDelNotExists");
            totalNum = tr.getFileNumInDir(_inDirTipsShow);
            if (totalNum > 200000) {
                //大于200000个文件将不创建索引，强制引导指定索引目录
                updateProcess(0, 0, 0, "stop_load_index", "");
                return;
            }
            if (totalNum > 50000) {
                //大于50000个提示指定目录，但不强制拦截
                updateProcess(0, 0, 0, "show_file_more", "");
            }
            //分析头文件遍历
            tr.scanDirFile(resolve);
        };
        //插入c/c++语言关键字
        this._makeLanageKeyWord = function () {
            var keyword = KeyWordStore.getInstace();
            var setKeyWords = new Set([
                "if", "for", "else", "class", "public", "private", "protected", "auto", "byte",
                "int", "uint32_t", "int32_t", "uint64_t", "int64_t", "bool", "break", "unsigned",
                "float", "define", "include", "float", "char", "const", "inline", "continue", "do",
                "return", "interface", "double", "template", "typedef", "typename", "long", "while",
                "this", "__FILE__", "__LINE__", "using", "namespace", "uint16_t", "int16_t", "uint8_t",
                "int8_t", "signed", "throw", "union", "enum", "goto", "virtual", "static", "operator",
                "case", "void", "friend", "default", "new", "delete", "extern", "sizeof", "try", "short",
                "switch", "asm", "catch", "volatile", "struct"
            ]);
            setKeyWords.forEach(function (value, index, array) {
                var extData = { n: value, v: value };
                //写入关键字
                //@ownname, @name, @namespace, @type, @permission, @namelength, @file_id, @extdata
                var data = {
                    ownname: "",
                    name: value,
                    namespace: "",
                    type: TypeEnum.TYPEDEF,
                    file_id: -1,
                    extdata: JSON.stringify(extData),
                    permission: 0
                };
                //console.info(data);
                keyword.insert(data);
            });
        };
        //分析源文件(增量)
        this._analyseReadSourceFile = function (filepath, filetype, forckReolad) {
            if (forckReolad === void 0) { forckReolad = false; }
            if (this.needExit || !FileIndexStore.getInstace().islive()) {
                //退出进程
                this.needExit = false;
                logger.debug("main process send message, child need exit.");
                return this.needExit;
            }
            var that = this;
            var hasInDb = false;
            var lastMd5 = "";
            var fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
            if (fileinfo) {
                //未找到，则获取上次md5值
                lastMd5 = fileinfo.md5;
                hasInDb = true;
            }
            //写入文件索引
            var fd = fs.openSync(that.basedir + filepath, 'r');
            var fstat = fs.fstatSync(fd);
            var updatetime = Math.floor(fstat.mtimeMs / 1000);
            if (!forckReolad && hasInDb && Math.floor(updatetime) == Math.floor(fileinfo.updatetime)) {
                //文件未更新，无需重新加载
                // console.info("this file not modify!");
                fs.closeSync(fd);
                return;
            }
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            fs.closeSync(fd);
            var fshash = crypto.createHash("md5");
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            fshash.update(filecontext);
            var md5 = fshash.digest('hex');
            if (!hasInDb) {
                //获取文件info
                //之前未写入db，则写入db，并分析语法
                //分析文件，去掉类、函数等定义
                var _pos = filepath.lastIndexOf("/");
                var filename = filepath.substring(_pos + 1);
                var data = {
                    filename: filename,
                    filepath: filepath,
                    md5: md5,
                    type: filetype,
                    updatetime: updatetime,
                    extdata: ''
                };
                FileIndexStore.getInstace().insert(data);
                that._readSourceFile(filepath, filecontext);
                return;
            }
            //如果是md5值不一样，则启动分析合并
            if ((hasInDb && lastMd5 != md5) || forckReolad) {
                logger.debug(lastMd5, md5, filepath);
                //获取文件id
                var fileinfo_1 = FileIndexStore.getInstace().getFileByFilePath(filepath);
                if (!fileinfo_1) {
                    //logger.debug("not find file!", filepath);
                    return false;
                }
                var file_id = fileinfo_1.id;
                //通过文件id获取全部的定义
                var oldinfos = KeyWordStore.getInstace().getAllByFileId(file_id);
                //分析文件，去掉类、函数等定义
                var newinfo = this._readSourceFile(filepath, filecontext);
                //获取需呀删除的id
                var delids = this._findNeedDeleteIds(oldinfos, newinfo);
                //删除
                KeyWordStore.getInstace().deleteByIds(delids);
                //更新文件的md5值
                FileIndexStore.getInstace().modifyMd5(file_id, md5, updatetime);
                return;
            }
        };
        //分析头文件(增量)
        this._analyseReadIncludeFile = function (filepath, filetype, forckReolad) {
            if (forckReolad === void 0) { forckReolad = false; }
            if (this.needExit || !FileIndexStore.getInstace().islive()) {
                //退出进程
                this.needExit = false;
                logger.debug("main process send message, child need exit.");
                return this.needExit;
            }
            var that = this;
            var hasInDb = false;
            var lastMd5 = "";
            var fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
            if (fileinfo) {
                //未找到，则获取上次md5值
                lastMd5 = fileinfo.md5;
                hasInDb = true;
            }
            //写入文件索引
            var fd = fs.openSync(that.basedir + filepath, 'r');
            var fstat = fs.fstatSync(fd);
            var updatetime = Math.floor(fstat.mtimeMs / 1000);
            if (!forckReolad && hasInDb && Math.floor(updatetime) == Math.floor(fileinfo.updatetime)) {
                //文件未更新，无需重新加载
                fs.closeSync(fd);
                return;
            }
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            fs.closeSync(fd);
            var fshash = crypto.createHash("md5");
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            fshash.update(filecontext);
            var md5 = fshash.digest('hex');
            if (!hasInDb) {
                //获取文件info
                //第一次加载
                //之前未写入db，则写入db，并分析语法
                //分析文件，去掉类、函数等定义
                var _pos = filepath.lastIndexOf("/");
                var filename = filepath.substring(_pos + 1);
                var data = {
                    filename: filename,
                    filepath: filepath,
                    md5: md5,
                    type: filetype,
                    updatetime: updatetime,
                    extdata: ''
                };
                FileIndexStore.getInstace().insert(data);
                that._readIncludeFile(filepath, filecontext);
                return;
            }
            //如果是md5值不一样，则启动分析合并
            if ((hasInDb && lastMd5 != md5) || forckReolad) {
                logger.debug(lastMd5, md5, filepath);
                //获取文件id
                var fileinfo_2 = FileIndexStore.getInstace().getFileByFilePath(filepath);
                if (!fileinfo_2) {
                    logger.debug("not find file!", filepath);
                    return false;
                }
                var file_id = fileinfo_2.id;
                //通过文件id获取全部的定义
                var oldinfos = KeyWordStore.getInstace().getAllByFileId(file_id);
                //分析文件，去掉类、函数等定义
                var newinfo = that._readIncludeFile(filepath, filecontext);
                //获取需呀删除的id
                var delids = this._findNeedDeleteIds(oldinfos, newinfo);
                //删除
                KeyWordStore.getInstace().deleteByIds(delids);
                //更新文件的md5值
                FileIndexStore.getInstace().modifyMd5(file_id, md5, updatetime);
                return;
            }
        };
        //找出需要删除的内容
        this._findNeedDeleteIds = function (oldinfos, newinfo) {
            var needDelIds = [];
            var newKey = new Set(Object.keys(newinfo));
            for (var i = 0; i < oldinfos.length; i++) {
                var info = oldinfos[i];
                var key = info.namespace + "|" + info.ownname + "|" + info.name;
                if (!newKey.has(key)) {
                    //需要删除的id
                    needDelIds.push(info.id);
                }
            }
            return needDelIds;
        };
        this._readIncludeFile = function (filename, filecontext) {
            //如果是proto生成的头文件，这里不需要分析，后面有直接分析proto文件
            try {
                if (filename.lastIndexOf(".pb.h") != -1) {
                    //是proto文件生产的,不需要处理
                    return {};
                }
                var onlaysavepublic = false;
                if (/[\\/]{1,1}usr[\\/]{1,1}(local|include)[\\/]{1,1}/g.test(filename)) {
                    ///usr/*下保存私有和公共方法
                    //这里分析系统头文件才需要
                    onlaysavepublic = true;
                }
                //执行分析
                var analyse = new Analyse(filecontext, filename);
                analyse.doAnalyse();
                var nameMap = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace(), onlaysavepublic);
                // console.log(nameMap);
                return nameMap;
            }
            catch (error) {
                logger.debug(filename, error);
                return {};
            }
        };
        this._readSourceFile = function (filename, filecontext) {
            //如果是proto生成的头文件，这里不需要分析，后面有直接分析proto文件
            try {
                if (filename.lastIndexOf(".pb.cc") != -1) {
                    //是proto文件生产的,不需要处理
                    return {};
                }
                //proto文件
                var isproto = false;
                if (filename.lastIndexOf(".proto") != -1) {
                    //是proto文件
                    isproto = {};
                }
                var onlaysavepublic = false;
                if (/[\\/]{1,1}usr[\\/]{1,1}(local|include)[\\/]{1,1}/g.test(filename)) {
                    ///usr/*下保存私有和公共方法
                    //这里分析系统文件才需要
                    onlaysavepublic = {};
                }
                //执行分析
                //logger.debug(filecontext);
                var analyse = new Analyse(filecontext, filename);
                analyse.doAnalyse();
                var nameMap = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace(), onlaysavepublic);
                //logger.debug(nameMap);
                return nameMap;
            }
            catch (error) {
                logger.debug(filename, error);
                return {};
            }
        };
        //关闭
        this.shutdown = function () {
            this.needExit = true;
            //this.disconstructor();
        };
        this.disconstructor = function () {
            //关闭db链接
            FileIndexStore.getInstace().closeconnect();
            KeyWordStore.getInstace().closeconnect();
        };
        this.store = null;
        this.basedir = basedir;
        FileIndexStore.getInstace().connect(dbpath, 0);
        KeyWordStore.getInstace().connect(dbpath, 0);
        this.isSystemDir = issystem;
        if (issystem > 0) {
            //设置当前为系统目录
            FileIndexStore.getInstace().setSystemIncludePath();
        }
        //建立关键字索引
        this._makeLanageKeyWord();
        //用户配置
        this.userConfig = {};
        //是否需要退出
        this.needExit = false;
    }
    return RebuildFileIndex;
}());
;
///Users/widyhu/workspace/systeminclude/basedb/basedb.db
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    // paramsms结构定义
    var defaultSettings = {
        needLoadLinkDir: ["comm", "mmcomm", "platform"],
        ignoreFileAndDir: [
            "^[.~]{1,1}.{1,128}$",
            "^.*_tools_pb\\.(cpp|h)$",
            "^.*testimpl_pb\\.(cpp|h)$",
            "^.*\\.pb\\.(cc|h)$",
            "^(sk_|sm_)[a-z0-9_.]{1,128}$",
            "^mm3rd$",
            "^lib32$",
            "^lib64$",
            "^lib64_debug$",
            "^lib64_release$",
            "^lib32_debug$",
            "^lib32_release$",
            "^debug$",
            "^release$",
            "^win32$",
            "^bin$"
        ]
    };
    var parasms = {
        msg_type: 2,
        data: {
            basepath: "--",
            dbpath: "--",
            filepath: '--',
            // filepaths: ['xxxxxxxx',
            //             'xxxxxxxx'],
            issystem: 0,
            userConfig: defaultSettings
        }
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        var value = data['process'];
        if (data.function == "source" || data.function == "include") {
            logger.debug("当前进度：%s, %f%，总共：%d，当前：%d", data.function, value["showprocess"], value["totalNum"], value["index"]);
            return;
        }
        if (data.function == "scan_ing") {
            // logger.debug("当前加载目录：", data.extdata);
            return;
        }
        if (data.function == "error") {
            //报错，执行未完成
            worker_1.kill();
            return;
        }
        if (data.function == "over") {
            //任务完成关闭子进程
            worker_1.kill();
            return;
        }
    });
}
else if (cluster.isWorker) {
    //用户配置
    var userConfig_1 = {};
    var maker_1 = null;
    var needStop_1 = false;
    function updateProcess(totalNum, i, showprocess, func, extdata) {
        if (func === void 0) { func = "rebuild"; }
        if (extdata === void 0) { extdata = ""; }
        //向主线线程发送数据
        var message = {
            "function": func,
            "process": {
                'totalNum': totalNum,
                'index': i,
                "showprocess": showprocess
            },
            extdata: extdata
        };
        try {
            process.send(message);
        }
        catch (error) {
            logger.debug(error);
            logger.debug(message);
        }
    }
    ;
    function reloadAllFile(basedir, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.rebuildIncludeTree(updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    function forkReloadAllFile(basedir, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.forkRebuildIncludeTree(updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    function reloadSiglIncludeFile(basedir, filepath, dbpath, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.reloadKeywordBySignleFile(filepath);
        maker_1.disconstructor();
    }
    ;
    function forkReloadSiglIncludeFile(basedir, filepath, dbpath, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.forkReloadKeywordBySignleFile(filepath);
        maker_1.disconstructor();
    }
    ;
    function batchReloadIncludeFiles(basedir, filepaths, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.batchReloadFiles(filepaths, updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    onMessage = function (parasms) {
        if (parasms === 'shutdown') {
            //让所有进程优雅地关闭。
            if (maker_1 != null) {
                //退出worker
                maker_1.shutdown();
                return;
            }
            return;
        }
        //参数校验
        if (parasms['msg_type'] === undefined
            || !parasms['data']['basepath']
            || !parasms['data']['dbpath']) {
            logger.debug("input parasms error!", parasms);
            var message_1 = { "function": "error" };
            message_1['msg'] = "input parasms error!";
            process.send(JSON.stringify(message_1));
            return;
        }
        var issystem = 0;
        if (parasms['data']['issystem']) {
            issystem = parasms['data']['issystem'];
        }
        var msg_type = parasms.msg_type;
        var basepath = parasms.data.basepath;
        var dbpath = parasms.data.dbpath;
        if (parasms['data']['userConfig']) {
            userConfig_1 = parasms['data']['userConfig'];
        }
        if (msg_type == 0) {
            //全量扫码目录并重新加载索引
            reloadAllFile(basepath, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        if (msg_type == 1) {
            //加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                var message_2 = { "function": "error" };
                message_2['msg'] = "filepath not find!";
                process.send(message_2);
                return;
            }
            var filepath = parasms.data.filepath;
            reloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            var message_3 = { "function": "over" };
            process.send(message_3);
            return;
        }
        if (msg_type == 2) {
            //强制加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                var message_4 = { "function": "error" };
                message_4['msg'] = "filepath not find!";
                process.send(message_4);
                return;
            }
            var filepath = parasms.data.filepath;
            forkReloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            var message_5 = { "function": "over" };
            process.send(message_5);
            return;
        }
        if (msg_type == 3) {
            //全量扫码目录并重新加载索引
            forkReloadAllFile(basepath, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        if (msg_type == 4) {
            //全量扫码目录并重新加载索引
            var filepaths = parasms.data.filepaths;
            batchReloadIncludeFiles(basepath, filepaths, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        var message = { "function": "error" };
        message['msg'] = "type error!" + msg_type;
        process.send(message);
    };
    process.on('message', function (parasms) {
        logger.debug("onmessage", JSON.stringify(parasms));
        onMessage(parasms);
    });
    process.on('exit', function (code, signal) {
        if (signal) {
            logger.debug("\u5DE5\u4F5C\u8FDB\u7A0B\u5DF2\u88AB\u4FE1\u53F7 " + signal + " \u6740\u6B7B");
        }
        else if (code !== 0) {
            logger.debug("\u5DE5\u4F5C\u8FDB\u7A0B\u9000\u51FA\uFF0C\u9000\u51FA\u7801: " + code);
        }
        else {
            logger.debug('工作进程成功退出');
        }
    });
}
