/* --------------------------------------------------------------------------------------------
 * rebuildAllFileIndex.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const Analyse = require('../analyse/analyse').Analyse;
const TypeEnum = require('../analyse/analyse').TypeEnum;
const Traverse = require('../traversedir/traverse');
const fs = require('fs');
const crypto = require('crypto');
const FileIndexStore = require('../store/store').FileIndexStore;
const KeyWordStore = require('../store/store').KeyWordStore;
const FileType = require('../store/store').FileType;
const logger = require('log4js').getLogger("cpptips");

class RebuildFileIndex {

    constructor(basedir, dbpath, issystem = 0) {
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

    setUserConfig = function(userConfig){
        this.userConfig = userConfig;
    };

    reloadKeywordBySignleFile = function (filepath) {

        let tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, null, null);
        let type = tr.judgeFileType(filepath)
        if(type == FileType.PROTOBUF_FILE
            || type == FileType.INCLUDE_FILE) {
            //强制加载
            return this._analyseReadIncludeFile(filepath, type, false);
        } else if(type == FileType.SOURCE_FILE){
            //强制加载
            return this._analyseReadSourceFile(filepath, type, false);
        }
    };

    forkReloadKeywordBySignleFile = function (filepath) {
       
        let tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, null, null);
        let type = tr.judgeFileType(filepath)

        if(type == FileType.PROTOBUF_FILE
            || type == FileType.INCLUDE_FILE) {
            //强制加载
            return this._analyseReadIncludeFile(filepath, type, true);
        } else if(type == FileType.SOURCE_FILE){
            //强制加载
            return this._analyseReadSourceFile(filepath, type, true);
        }
    };

    batchReloadFiles = function(filepaths, updateProcess, resolve) {
        let that = this;
        let index = 0;
        let totalNum = filepaths.length;
        let showprocess = 0;
        function __readIncludeFile(filepath, filetype) {
            //处理头文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }

            index++;
            that._analyseReadIncludeFile(filepath, filetype, false);
    
            let nowshowprocess = (index / totalNum) * 100;
            if (nowshowprocess - showprocess > 0.01) {
                updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                showprocess = nowshowprocess;
            }
            return that.needExit;
        }

        function __readSourceFile(filepath, filetype) {
            //处理源文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }
            index++;
            that._analyseReadSourceFile(filepath, filetype, false);
            let nowshowprocess = (index / totalNum) * 100;
            if (nowshowprocess - showprocess > 0.1) {
                updateProcess(totalNum, index, showprocess.toFixed(2), "source");
                showprocess = nowshowprocess;
            }
            return that.needExit;
        }
        let tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
        tr.addAnalyseFileTasl(filepaths, resolve);
    };

    //重新编译头文件索引
    rebuildIncludeTree = function (updateProcess, resolve) {
        let that = this;
        let index = 0;
        let totalNum = 0;
        let showprocess = 0;
        function __readIncludeFile(filepath, filetype) {
            //处理头文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }

            index++;
            that._analyseReadIncludeFile(filepath, filetype, false);
    
            let nowshowprocess = (index / totalNum) * 100;
            if (nowshowprocess - showprocess > 0.01) {
                updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                showprocess = nowshowprocess;
            }
            return that.needExit;
        }

        function __readSourceFile(filepath, filetype) {
            //处理源文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }
            index++;
            that._analyseReadSourceFile(filepath, filetype, false);
            let nowshowprocess = (index / totalNum) * 100;
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

        function _inDeleteNotExists(msg){
            logger.debug(msg);
            return that.needExit;
        }

        //目录扫描器
        let tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
        
        //清楚已经删除了的文件
        // console.debug("traverseFilesDelNotExists");
        tr.traverseFilesDelNotExists(_inDeleteNotExists);
        // console.debug("traverseFilesDelNotExists");

        totalNum = tr.getFileNumInDir(_inDirTipsShow);
        if(totalNum > 200000) {
            //大于200000个文件将不创建索引，强制引导指定索引目录
            updateProcess(0, 0, 0, "stop_load_index", "");
            return;
        }
        if(totalNum > 50000) {
            //大于50000个提示指定目录，但不强制拦截
            updateProcess(0, 0, 0, "show_file_more", "");
        }

        //分析头文件遍历
        tr.scanDirFile(resolve);
    };

    //强制加载所有的索引
    forkRebuildIncludeTree = function (updateProcess, resolve) {
        let that = this;
        let index = 0;
        let totalNum = 0;
        let showprocess = 0;
        function __readIncludeFile(filepath, filetype) {
            //处理头文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }

            index++;
            that._analyseReadIncludeFile(filepath, filetype, true);
            let nowshowprocess = (index / totalNum) * 100;
            if (nowshowprocess - showprocess > 0.1) {
                updateProcess(totalNum, index, showprocess.toFixed(2), "include");
                showprocess = nowshowprocess;
            }
            return that.needExit;
        }

        function __readSourceFile(filepath, filetype) {
            //处理源文件
            if(that.needExit) {
                //退出进程
                logger.debug("main process send message, child need exit.");
                return that.needExit;
            }

            index++;
            that._analyseReadSourceFile(filepath, filetype, true);
            let nowshowprocess = (index / totalNum) * 100;
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

        function _inDeleteNotExists(msg){
            logger.debug(msg);
            return that.needExit;
        }

        //目录扫描器
        let tr = new Traverse.Traverse(this.basedir, this.userConfig, this.isSystemDir, __readIncludeFile, __readSourceFile);
        
        //清楚已经删除了的文件
        // console.debug("traverseFilesDelNotExists");
        tr.traverseFilesDelNotExists(_inDeleteNotExists);
        // console.debug("traverseFilesDelNotExists");

        totalNum = tr.getFileNumInDir(_inDirTipsShow);
        if(totalNum > 200000) {
            //大于200000个文件将不创建索引，强制引导指定索引目录
            updateProcess(0, 0, 0, "stop_load_index", "");
            return;
        }
        if(totalNum > 50000) {
            //大于50000个提示指定目录，但不强制拦截
            updateProcess(0, 0, 0, "show_file_more", "");
        }

        //分析头文件遍历
        tr.scanDirFile(resolve);
    };

    //插入c/c++语言关键字
    _makeLanageKeyWord = function() {
        let keyword = KeyWordStore.getInstace();
        let setKeyWords = new Set([
            "if", "for", "else", "class", "public", "private", "protected","auto", "byte",
            "int", "uint32_t", "int32_t", "uint64_t", "int64_t", "bool", "break","unsigned",
            "float", "define", "include", "float", "char", "const", "inline", "continue", "do",
            "return", "interface", "double", "template", "typedef", "typename", "long", "while",
            "this", "__FILE__", "__LINE__", "using", "namespace", "uint16_t", "int16_t", "uint8_t",
            "int8_t", "signed", "throw", "union", "enum", "goto", "virtual", "static", "operator",
            "case", "void", "friend", "default", "new", "delete", "extern", "sizeof", "try", "short",
            "switch", "asm", "catch", "volatile", "struct"
        ]);
        setKeyWords.forEach((value, index, array)=>{
            let extData = { n: value, v: value};

            //写入关键字
            //@ownname, @name, @namespace, @type, @permission, @namelength, @file_id, @extdata
            let data = {
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
    _analyseReadSourceFile = function (filepath, filetype, forckReolad  = false) {
        if(this.needExit || !FileIndexStore.getInstace().islive()) {
            //退出进程
            this.needExit = false;
            logger.debug("main process send message, child need exit.");
            return this.needExit;
        }

        let that = this;
        let hasInDb = false;
        let lastMd5 = "";
        let fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
        if(fileinfo) {
            //未找到，则获取上次md5值
            lastMd5 = fileinfo.md5;
            hasInDb = true;
        }

        //写入文件索引
        let fd = fs.openSync(that.basedir + filepath, 'r');
        let fstat = fs.fstatSync(fd);
        let updatetime = Math.floor(fstat.mtimeMs / 1000);
        if (!forckReolad && hasInDb && Math.floor(updatetime) == Math.floor(fileinfo.updatetime)) {
            //文件未更新，无需重新加载
            fs.closeSync(fd);
            return;
        }
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
        fs.closeSync(fd);

        let fshash = crypto.createHash("md5");
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        fshash.update(filecontext);
        let md5 = fshash.digest('hex');

        if (!hasInDb) {
            //获取文件info
            //之前未写入db，则写入db，并分析语法
            //分析文件，去掉类、函数等定义
            
            let _pos = filepath.lastIndexOf("/");
            let filename = filepath.substring(_pos + 1);
            let data = {
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
            let fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
            if (!fileinfo) {
                //logger.debug("not find file!", filepath);
                return false;
            }
            let file_id = fileinfo.id;

            //通过文件id获取全部的定义
            let oldinfos = KeyWordStore.getInstace().getAllByFileId(file_id);

            //分析文件，去掉类、函数等定义
            let newinfo = this._readSourceFile(filepath, filecontext);

            //获取需呀删除的id
            let delids = this._findNeedDeleteIds(oldinfos, newinfo);

            //删除
            KeyWordStore.getInstace().deleteByIds(delids);

            //更新文件的md5值
            FileIndexStore.getInstace().modifyMd5(file_id, md5, updatetime);
            return;
        }
    };

    //分析头文件(增量)
    _analyseReadIncludeFile = function (filepath, filetype, forckReolad = false) {
        if(this.needExit || !FileIndexStore.getInstace().islive()) {
            //退出进程
            this.needExit = false;
            logger.debug("main process send message, child need exit.");
            return this.needExit;
        }

        let that = this;
        let hasInDb = false;
        let lastMd5 = "";
        let fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
        if(fileinfo) {
            //未找到，则获取上次md5值
            lastMd5 = fileinfo.md5;
            hasInDb = true;
        }

        //写入文件索引
        let fd = fs.openSync(that.basedir + filepath, 'r');
        let fstat = fs.fstatSync(fd);
        let updatetime = Math.floor(fstat.mtimeMs / 1000);

        if (!forckReolad && hasInDb && Math.floor(updatetime) == Math.floor(fileinfo.updatetime)) {
            //文件未更新，无需重新加载
            fs.closeSync(fd);
            return;
        }
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
        fs.closeSync(fd);

        let fshash = crypto.createHash("md5");
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        fshash.update(filecontext);
        let md5 = fshash.digest('hex');

        if (!hasInDb) {
            //获取文件info
            //第一次加载
            //之前未写入db，则写入db，并分析语法
            //分析文件，去掉类、函数等定义
            let _pos = filepath.lastIndexOf("/");
            let filename = filepath.substring(_pos + 1);
            let data = {
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
            let fileinfo = FileIndexStore.getInstace().getFileByFilePath(filepath);
            if (!fileinfo) {
                logger.debug("not find file!", filepath);
                return false;
            }
            let file_id = fileinfo.id;

            //通过文件id获取全部的定义
            let oldinfos = KeyWordStore.getInstace().getAllByFileId(file_id);

            //分析文件，去掉类、函数等定义
            let newinfo = that._readIncludeFile(filepath, filecontext);

            //获取需呀删除的id
            let delids = this._findNeedDeleteIds(oldinfos, newinfo);

            //删除
            KeyWordStore.getInstace().deleteByIds(delids);

            //更新文件的md5值
            
            FileIndexStore.getInstace().modifyMd5(file_id, md5, updatetime);
            return;
        }
    };

    //找出需要删除的内容
    _findNeedDeleteIds = function (oldinfos, newinfo) {
        let needDelIds = [];
        let newKey = new Set(Object.keys(newinfo));
        for(let i = 0; i < oldinfos.length; i++) {
            let info = oldinfos[i];
            let key = info.namespace + "|" + info.ownname + "|" + info.name;
            
            if (!newKey.has(key)) {
                //需要删除的id
                needDelIds.push(info.id);
            }
        }
        return needDelIds;
    };

    _readIncludeFile = function (filename, filecontext) {
        //如果是proto生成的头文件，这里不需要分析，后面有直接分析proto文件
        try {
            if (filename.lastIndexOf(".pb.h") != -1) {
                //是proto文件生产的,不需要处理
                return {};
            }

            let onlaysavepublic = false;
            if (/[\\/]{1,1}usr[\\/]{1,1}(local|include)[\\/]{1,1}/g.test(filename)) {
                ///usr/*下保存私有和公共方法
                //这里分析系统头文件才需要
                onlaysavepublic = true;
            }
            
            //执行分析
            let analyse = new Analyse(filecontext, filename);
            analyse.doAnalyse();
            let nameMap = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace(), onlaysavepublic);
            // console.log(nameMap);
            return nameMap;
        } catch (error) {
            logger.debug(filename, error);
            return {};
        }
    };

    _readSourceFile = function (filename, filecontext) {
        //如果是proto生成的头文件，这里不需要分析，后面有直接分析proto文件
        try {
            if (filename.lastIndexOf(".pb.cc") != -1) {
                //是proto文件生产的,不需要处理
                return {};
            }

            //proto文件
            let isproto = false;
            if (filename.lastIndexOf(".proto") != -1) {
                //是proto文件
                isproto = {};
            }

            let onlaysavepublic = false;
            if (/[\\/]{1,1}usr[\\/]{1,1}(local|include)[\\/]{1,1}/g.test(filename)) {
                ///usr/*下保存私有和公共方法
                //这里分析系统文件才需要
                onlaysavepublic = {};
            }
            
            //执行分析
            //logger.debug(filecontext);
            let analyse = new Analyse(filecontext, filename);
            analyse.doAnalyse();
            let nameMap = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace(), onlaysavepublic);
            //logger.debug(nameMap);
            return nameMap;
        } catch (error) {
            logger.debug(filename, error);
            return {};
        }
    };

    //关闭
    shutdown = function() {
        this.needExit = true;
        //this.disconstructor();
    };

    disconstructor = function () {
        //关闭db链接
        FileIndexStore.getInstace().closeconnect();
        KeyWordStore.getInstace().closeconnect();
    };
};

module.exports = {
    RebuildFileIndex
};
