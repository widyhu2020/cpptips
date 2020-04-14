/* --------------------------------------------------------------------------------------------
 * traverse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const fs = require('fs');
const FileIndexStore = require('../store/store').FileIndexStore;
const FileType = require('../store/store').FileType;


class Traverse {
    constructor(basedir, userConfig, isAnlyseSystemDir, analyseIncludeCallBack, analyseSourceCallBack) {
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
        if(this.userConfig.needLoadLinkDir
            && this.userConfig.needLoadLinkDir instanceof Array) {
            this.analyseLinkDir = new Set(this.userConfig.needLoadLinkDir);
        }

        //需要忽略的文件或者文件的匹配
        console.log("Traverse:", userConfig);
        console.log("isAnlyseSystemDir:", isAnlyseSystemDir);
        let regex = [];
        this.regexStr = "^\\[.~]{1,1}[0-9a-z]{1,128}$";
        if(this.userConfig.ignoreFileAndDir
            && this.userConfig.ignoreFileAndDir instanceof Array) {
            regex = this.userConfig.ignoreFileAndDir;
            this.regexStr = "(" + regex.join(")|(") + ")";
            console.log("user regex:",this.regexStr);
        };

        //需要忽略的目录，不支持匹配
        this.ignorDir = [];
        if(this.userConfig.ignorDir
            && this.userConfig.ignorDir instanceof Array) {
            this.ignorDir = this.userConfig.ignorDir;
        }
        console.log("ignorDir:", this.ignorDir);

        //需要加载的目录，不支持匹配
        this.needLoadDir = [];
        if(this.userConfig.needLoadDir
            && this.userConfig.needLoadDir instanceof Array) {
            this.needLoadDir = this.userConfig.needLoadDir;
        }
        console.log("needLoadDir:", this.needLoadDir);
    };

    //加载目录所有文件
    scanDirFile = function(resolve) {
        let that = this;
        //处理头文件
        this._readDir(this.basedir);
        console.log("include process over");
    
        //延迟10s开始分析文件
        setTimeout(this.analyseConsumer, 3000, that, resolve);
    };

    //batch添加文件分析任务
    addAnalyseFileTasl = function(files, resolve) {
        let that = this;

        for(let i = 0; i < files.length; i++) {
            //判断是否需要忽略的文件夹
            if(that._checkIsIgnorDir(files[0])) {
                console.debug("need ignor dir!", files[0]);
                continue;
            }
            this._judgeFileTypeAndSave(files[0]);
        }

        //延迟10s开始分析文件
        setTimeout(this.analyseConsumer, 1, that, resolve);
    };
    //消费者
    analyseConsumer = function(that, resolve) {
        
        let needEmptyTime = 0;
        let timer = null;
        timer = setInterval(() => {
            if(that.needStop) {
                console.log("find need exit!");
                that.includefiles = [];
                that.sourcefiles = [];
                clearInterval(timer);
                resolve();
                return;
            }
            //处理include
            let includeitem = that.includefiles.pop();
            if(includeitem) {
                //console.log(includeitem.f);
                that.needStop = that.analyseIncludeCallBack(includeitem.f, includeitem.t);
                return;
            }

            //处理源文件
            let sourcefile = that.sourcefiles.pop();
            if(sourcefile) {
                //console.log(sourcefile);
                that.needStop = that.analyseSourceCallBack(sourcefile.f, sourcefile.t);
                return;
            }
            needEmptyTime++;
            if(needEmptyTime > 5000) {
                //5s内都没有数据产生
                //处理完成
                console.log("clearInterval");
                clearInterval(timer);
                resolve();
            }
        }, 1);
    };

    //获取，目录下需要处理文件的数量
    getFileNumInDir = function(callbackshow) {
        let taskTotal = 0;
        taskTotal = this._readDirForTotalFile(this.basedir, callbackshow);
        return taskTotal;
    };

    //遍历头文件-暂时废弃
    traverseInclude = function(callback, callbackprocess) {
        
        let types = [FileType.INCLUDE_FILE, FileType.PROTOBUF_FILE];
        let totalNum = this.fis.getFileTotalWhithType(types);
        console.log("begin traveseinclude... totalNum:", totalNum);

        //单次获取1000个
        let batchCount = 1000;
        let beginIndex = 0;
        let showprocess = 0;
        while(beginIndex < totalNum) {
            let endIndex = beginIndex + batchCount;
            let infos = this.fis.getFilesWhithType(types, beginIndex, batchCount);

            for (let i = 0; i < infos.length; i++) {
                //let filepath = infos[i].filepath;
                let needStop = callback(infos[i]);
                if(needStop) {
                    //需要退出，不再处理
                    console.debug("need stop and exit!");
                    return;
                }
                let nowshowprocess = ((beginIndex + i) / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.5) {
                    //console.log("total:", totalNum, "processed:", i);
                    callbackprocess(totalNum, (beginIndex + i), showprocess.toFixed(2), "include");
                    showprocess = nowshowprocess;
                }
            }
            beginIndex = endIndex;
        }
    };

    //遍历原文件-暂时废弃
    traverseSource = function(callback, callbackprocess) {

        let types = [FileType.SOURCE_FILE];
        let totalNum = this.fis.getFileTotalWhithType(types);
        console.log("begin traverseSource... totalNum:", totalNum);

        //单次获取1000个
        let batchCount = 1000;
        let beginIndex = 0;
        let showprocess = 0;
        while(beginIndex < totalNum) {
            let endIndex = beginIndex + batchCount;
            let infos = this.fis.getFilesWhithType(types, beginIndex, batchCount);
            for (let i = 0; i < infos.length; i++) {
                //let filepath = infos[i].filepath;
                let needStop = callback(infos[i]);
                if(needStop) {
                    //需要退出，不再处理
                    console.debug("need stop and exit!");
                    return;
                }
                let nowshowprocess = ((beginIndex + i) / totalNum) * 100;
                if (nowshowprocess - showprocess > 0.5) {
                    callbackprocess(totalNum, (beginIndex + i), showprocess.toFixed(2), "source");
                    showprocess = nowshowprocess;
                }
            }
            beginIndex = endIndex;
        }
    };

    //判断文件类型：返回1为头文件；2为源文件，其他无需处理
    judgeFileType = function(filepath) {
        let pos = filepath.lastIndexOf(".");
        if(pos == -1) {
            //文件名称不以后缀结尾
            return FileType.OTHER_FILE;
        }

        let ext = filepath.substr(pos);
        if(!this.includeExt.has(ext) && !this.sourceExt.has(ext)) {
            //不符合条件的文件
            return FileType.OTHER_FILE;
        }
        
        if (this.includeExt.has(ext) || this._checkIsSystem(filepath)) {
            //usr下所有的文件全部当头文件处理
            if (ext == ".tcc") {
                //.tcc文件不要处理
                return FileType.OTHER_FILE;
            }
            if(ext == ".proto") {
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
    _checkIsSystem = function(filepath) {
        // /usr/local/
        // /google/protobuf/
        if (filepath.indexOf("/usr/local/") != -1
            || filepath.indexOf("/usr/include/") != -1
            || filepath.indexOf("/google/protobuf/") != -1
            || /.*\.tcc$/g.test(filepath)){
            //如果不是usr系统目录
            //protobuf库里面已经加载过，这里直接pass
            return true;
        }
        
        return false;
    };

    _judgeFileTypeAndSave = function(filepath) {
        let pos = filepath.lastIndexOf(".");
        if(pos == -1
            && !this._checkIsSystem(filepath)) {
            //文件名称不以后缀结尾
            //系统头文件除外
            return;
        }

        let ext = filepath.substr(pos);
        if (this.includeExt.has(ext) || this._checkIsSystem(filepath)) {
            //usr下所有的文件全部当头文件处理
            //头文件
            if(ext == ".proto") {
                //protobuf定义
                this.includefiles.push({f:filepath, t:FileType.PROTOBUF_FILE});
                return;
            }

            //头文件
            //变量头文件需要保存头文件
            this.includefiles.push({f:filepath, t:FileType.INCLUDE_FILE});
            return;
        }

        if (this.sourceExt.has(ext)) {
            //源文件
            this.sourcefiles.push({f:filepath, t:FileType.SOURCE_FILE});
            return;
        }
    };

    //判断是否在忽略的文件假名单中
    _checkIsIgnorDir = function(filepath) {
        //目录处理
        let _filepath = filepath;
        if(filepath[filepath.length - 1] != "/") {
            _filepath = _filepath + "/";
        }

        if(this.needLoadDir.length > 0) {
            //未配置表示默认加载所有
            let findInConfig = false;
            for(let i = 0; i < this.needLoadDir.length; i++) {
                if(_filepath.indexOf(this.needLoadDir[i]) == 0) {
                    //命中需要加载的目录
                    //console.log("file need load!", _filepath, this.needLoadDir[i]);
                    findInConfig = true;
                    break;
                }
            }
            if(!findInConfig) {
                //未在需要加载的目录中
                //console.log("file not need load!", _filepath);
                return true;
            }
        }

        //在需要加载目录的情况下，还需要过滤是否不需要加载
        for(let i = 0; i < this.ignorDir.length; i++) {
            if(_filepath.indexOf(this.ignorDir[i]) == 0) {
                //命中忽略目录
                //console.log("need ignor dir!", _filepath, this.ignorDir[i]);
                return true;
            }
        }

        //正则匹配忽略
        let _pos = filepath.lastIndexOf('/');
        let realname = filepath.substring(_pos + 1);
        let reg = new RegExp(this.regexStr,"ig");
        let testResult = reg.test(realname);
        if(testResult) {
            //不满足条件的目录和文件
            //console.log("file not reg match!", realname);
            return true;
        }

        return false;
    };

    //统计任务数量
    _readDirForTotalFile = function(dirfather, callbackshow) {
        let total = 0;
        let that = this;
        let dirf = fs.readdirSync(dirfather, { 'encoding': 'utf8', 'withFileTypes': false });
        dirf.forEach(function (el, index) {
            if(that.needStop) {
                //需要退出，不再处理
                //console.debug("need stop and exit!");
                return total;
            }
            // 加上父级访问更深层的文件夹
            let filename = `${dirfather}/` + el;
            let wkfilename = filename.replace(that.basedir, "");
            //let _pos = filename.lastIndexOf('/');
            //let realname = filename.substring(_pos + 1);

            //判断是否需要忽略的文件夹
            if(that._checkIsIgnorDir(wkfilename)) {
                //console.debug("need ignor dir!", wkfilename);
                return total;
            }

            //系统文件不需要分析，安装插件包里面包含
            if(!that.isAnlyseSystemDir
                && that._checkIsSystem(filename)) {
                //console.debug("system file, not analyse!");
                return total;
            }

            let dataFile = null;
            try {
                //不判断软连接
                //dataFile = fs.statSync(filename);
                dataFile = fs.lstatSync(filename);
            } catch (error) {
                console.log(error);
                return total;
            }
        
            //一定得fstatSync方法
            if(dataFile.isSymbolicLink()
                && !that.analyseLinkDir.has(wkfilename)) {
                //软链接跳过
                return total;
            }
        
            if (!dataFile) {
                return total;
            } else if (dataFile.isDirectory()) {
                // 又是文件夹
                // 遍历文件夹
                //回调目录
                if(parseInt(Math.random() * 3) == 0){
                    //三分之一的展示进度
                    let showName = wkfilename;
                    if(showName.length > 32) {
                        let pathitems = showName.split("/");
                        if(pathitems.length > 5) {
                            showName = "/" + pathitems[1] + "/" + pathitems[2] + "/.../" + pathitems[pathitems.length - 2] + "/" + pathitems[pathitems.length - 1];
                        }
                    }
                    that.needStop = callbackshow(showName);
                }
                if(that.needStop) {
                    //需要退出，不再处理
                    //console.debug("need stop and exit!");
                    return total;
                }
                total = total + that._readDirForTotalFile(filename, callbackshow);
            } else if (dataFile.isFile()){   
                let pos = filename.lastIndexOf(".");
                let ext = filename.substr(pos);
                if(that.includeExt.has(ext) 
                    || that.sourceExt.has(ext) 
                    || that._checkIsSystem(filename)) {
                    total++;
                }
            }
        });
        return total;
    };

    //扫描目录文件并分析
    _readDir = function(dirfather) {
        let that = this;
        let dirf = fs.readdirSync(dirfather, { 'encoding': 'utf8', 'withFileTypes': false });

        // 这个data数组中装的是当前文件夹下所有的文件名(包括文件夹)
        dirf.forEach(function (el, _index) {
            if(that.needStop) {
                //需要退出，不再处理
                //console.debug("need stop and exit!");
                return;
            }

            // 加上父级访问更深层的文件夹
            let filename = `${dirfather}/` + el;
            let wkfilename = filename.replace(that.basedir, "");

            //判断是否需要忽略的文件夹
            if(that._checkIsIgnorDir(wkfilename)) {
                //console.debug("need ignor dir!", wkfilename);
                return;
            }

            //系统文件不需要分析，安装插件包里面包含
            if(!that.isAnlyseSystemDir
                && that._checkIsSystem(filename)) {
                //console.debug("system file, not analyse!");
                return;
            }

            let dataFile = null;
            try {
                //不判断软连接
                //dataFile = fs.statSync(filename);
                dataFile = fs.lstatSync(filename);
            } catch (error) {
                console.log(error);
                return;
            }
        
            //一定得fstatSync方法
            if(dataFile.isSymbolicLink()
                && !that.analyseLinkDir.has(wkfilename)) {
                //软链接跳过
                //console.log("link:", wkfilename);
                return;
            }
        
            if (!dataFile) {
                return;
            } else if (dataFile.isDirectory()) {
                // 又是文件夹
                // 遍历文件夹
                that._readDir(filename);
            } else if (dataFile.isFile()){
                //后缀校验
                let pos = filename.lastIndexOf(".");
                let ext = filename.substr(pos);
                if(!that.includeExt.has(ext) 
                    && !that.sourceExt.has(ext) 
                    && !that._checkIsSystem(filename)) {
                    //非系统这里暂时不考虑没有后缀的头文件
                    //console.log(filename);
                    return;
                }

                if(that.needStop) {
                    //需要退出，不再处理
                    //console.debug("need stop and exit!");
                    return total;
                }
                setImmediate(()=>{that._judgeFileTypeAndSave(wkfilename);});
            }
        });
    };
};

module.exports = {
    Traverse: Traverse
};