/* --------------------------------------------------------------------------------------------
 * makeOwnsMapByCpp.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var Analyse = require('../analyse/analyse');
var Queue = require('../analyse/queue');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var FileIndexStore = require('../store/store').FileIndexStore;
var KeyWordStore = require('../store/store').KeyWordStore;
var cluster = require('cluster');
var os = require('os');
var Filetype = require('../traversedir/filetype').Filetype;
var MakeOwnsMapByCpp = /** @class */ (function () {
    function MakeOwnsMapByCpp(basedir, dbpath, sysdir, needrecursion, dependent) {
        this._getAllFileInfo = function () {
            console.time("_getAllFileInfo");
            var infos = FileIndexStore.getInstace().getAllIncludeFileInfo();
            var filemap = {};
            console.timeEnd("_getAllFileInfo");
            console.time("_getAllFileInfo.2");
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                filemap[info.filepath] = info;
                if (!this.fileNameMap[info.filename]) {
                    this.fileNameMap[info.filename] = [info.filepath];
                    continue;
                }
                this.fileNameMap[info.filename].push(info.filepath);
            }
            console.timeEnd("_getAllFileInfo.2");
            return filemap;
        };
        //获取两个目录的相似度
        this._getStringSimilarity = function (inputfilename, fullName1, fullName2) {
            var dirs1 = fullName1.split(/[\/]+/g);
            var dirs2 = fullName2.split(/[\/]+/g).filter(function (e) {
                return e != "" && e != "." && e != "..";
            });
            var sameDivrNum = 0;
            for (var i = 0; i < dirs1.length && i < dirs2.length; i++) {
                if (dirs1[i] == dirs2[i]) {
                    sameDivrNum++;
                }
            }
            return sameDivrNum;
        };
        this._getFileRealName = function (inputfilename, cppfilename) {
            inputfilename = inputfilename.replace(/(["'<>]+)|([.]+\/)/g, "");
            var pos = inputfilename.lastIndexOf("/");
            var filename = inputfilename;
            if (pos != -1 && inputfilename.length > pos + 1) {
                filename = inputfilename.substr(pos + 1);
            }
            if (this.fileNameMap[filename]) {
                var listRealName = this.fileNameMap[filename];
                //logger.debug("listRealName", listRealName);
                //找后缀匹配的全部头文件
                var retInclude = listRealName.length > 0 ? listRealName[0] : '';
                var gSameProportion = 0;
                for (var i = 0; i < listRealName.length; i++) {
                    var element = listRealName[i];
                    var lpos = element.lastIndexOf(inputfilename);
                    if (lpos != -1) {
                        //从前往后找，找匹配的最高的，匹配度一样的多个的时候选第一个
                        var sameProportion = this._getStringSimilarity(inputfilename, cppfilename, element);
                        if (sameProportion > gSameProportion) {
                            retInclude = element;
                            gSameProportion = sameProportion;
                        }
                        continue;
                    }
                }
                if (retInclude != '') {
                    //logger.debug("return path:",retInclude);
                    return retInclude;
                }
                return inputfilename;
            }
            //logger.debug("return source failename:", inputfilename, filename);
            return inputfilename;
        };
        this._anaylyseDependentFile = function (filepath) {
            var maker = new RebuildFileIndex(this.basedir, this.dbpath, false);
            maker.setUserConfig({});
            maker.forkReloadKeywordBySignleFile(filepath);
            maker.disconstructor();
        };
        this._getFileInfo = function (filepath) {
            filepath = filepath.replace(/["'<>]{1,1}/g, "");
            var pathinfo = path.parse(filepath);
            var filename = pathinfo.base;
            var that = this;
            if (!this.fileNameMap[filename]) {
                var filenames = FileIndexStore.getInstace().getFileByFileName(filename);
                return filenames;
            }
            var filepaths = this.fileNameMap[filename];
            var result = [];
            filepaths.forEach(function (value, index, array) {
                var _pos = value.lastIndexOf(filepath);
                if (_pos < 0
                    || _pos + filepath.length != value.length) {
                    //可能匹配到其他同名文件
                    return;
                }
                if (!that.filemap[value]) {
                    //文件不存
                    return;
                }
                result.push(that.filemap[value]);
            });
            return result;
        };
        this._readFileContext = function (cppfilename) {
            var filepath = this.basedir + cppfilename;
            if (!fs.existsSync(filepath)) {
                //如果文件不存在，则尝试使用系统目录
                filepath = this.sysdir + cppfilename;
                if (!fs.existsSync(filepath)) {
                    //如果文件不存在，报错
                    var includefile_1 = [];
                    var namespaces_1 = [];
                    return { includefile: includefile_1, namespaces: namespaces_1 };
                }
            }
            var fd = fs.openSync(filepath, 'r');
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            var fstat = fs.fstatSync(fd);
            fs.closeSync(fd);
            //写入文件索引
            var fshash = crypto.createHash("md5");
            fshash.update(filecontext);
            var md5 = fshash.digest('hex');
            var pos = filepath.lastIndexOf("/");
            var filename = filepath.substr(pos + 1);
            var updatetime = Math.floor(fstat.mtimeMs / 1000);
            var filetype = new Filetype();
            var fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
            if (fileinfo == false) {
                var data = {
                    filename: filename,
                    filepath: cppfilename,
                    md5: md5,
                    type: filetype.judgeFileType(cppfilename),
                    updatetime: updatetime,
                    extdata: ''
                };
                FileIndexStore.getInstace().insert(data);
            }
            else {
                FileIndexStore.getInstace().modifyMd5(fileinfo.id, md5, updatetime);
            }
            fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
            if (fileinfo == false) {
                //获取当前文件索引失败
                var includefile_2 = [];
                var namespaces_2 = [];
                return { includefile: includefile_2, namespaces: namespaces_2 };
            }
            this.own_file_id = fileinfo.id;
            //执行分析
            console.time("Analyse");
            var analyse = new Analyse.Analyse(filecontext, cppfilename);
            analyse.doAnalyse();
            var sourceTree = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace());
            console.timeEnd("Analyse");
            this.showTree = analyse.getDocumentStruct();
            var includefile = sourceTree.__file_inlcude;
            var namespaces = sourceTree.__file_usingnamespace;
            if (!includefile) {
                includefile = [];
            }
            if (!namespaces) {
                namespaces = [];
            }
            return { includefile: includefile, namespaces: namespaces };
        };
        this._pushATask = function (fileinfo) {
            if (!this.processInclude.has(fileinfo.filepath)) {
                if (this.needrecursion == 0
                    && this.dependent.has(fileinfo.id)) {
                    //如果不需要递归
                    //且该文件已经之前引入过，则跳过
                    return;
                }
                this.queue.enqueue(fileinfo.filepath);
                this.processInclude.add(fileinfo.filepath);
                this.processFileId.add(fileinfo.id);
            }
            return;
        };
        //获取cpp文件头文件依赖
        this.makeSearchTreeByCpp = function (cppfilename) {
            //在文件存储
            this.filename = cppfilename;
            this.filemap = this._getAllFileInfo();
            var that = this;
            var _a = this._readFileContext(cppfilename), includefile = _a.includefile, namespaces = _a.namespaces;
            for (var i = 0; i < includefile.length; i++) {
                //proto处理
                this._changeProtoToCpp(includefile[i]);
                var filenames = this._getFileInfo(includefile[i]);
                filenames.forEach(function (filename) {
                    that._pushATask(filename);
                });
            }
            var __inlcudefile = this.queue.dequeue();
            while (__inlcudefile) {
                if (!that.filemap[__inlcudefile]
                    || that.filemap[__inlcudefile].extdata == "") {
                    //没有收录该头文件
                    //或者该头文件没有包含头文件
                    __inlcudefile = that.queue.dequeue();
                    continue;
                }
                var extJson = JSON.parse(that.filemap[__inlcudefile].extdata);
                var includefiles = extJson.i;
                var usingnamespace = extJson.u;
                namespaces = namespaces.concat(usingnamespace);
                for (var i = 0; i < includefiles.length; i++) {
                    //proto处理
                    that._changeProtoToCpp(includefiles[i]);
                    var filenames = this._getFileInfo(includefiles[i]);
                    filenames.forEach(function (filename) {
                        that._pushATask(filename);
                    });
                }
                __inlcudefile = this.queue.dequeue();
            }
            ;
            //命名空间合并
            var duplicate = new Set(namespaces);
            that._usingnamespace = Array.from(duplicate);
            //头文件关联
            that.include = Array.from(that.processInclude);
            //获取文件id
            that.file_id = Array.from(that.processFileId);
            return;
        };
        this.disconstructor = function () {
            //关闭db链接
            FileIndexStore.getInstace().closeconnect();
            KeyWordStore.getInstace().closeconnect();
        };
        this.getData = function () {
            console.log("头文件依赖总数：", this.file_id.length);
            if (this.file_id.length < 20) {
                console.log(this.include);
            }
            return {
                'usingnamespace': this._usingnamespace,
                'include': this.include,
                'fileids': this.file_id,
                'currentfileid': this.own_file_id
            };
        };
        this.basedir = basedir;
        this.sysdir = sysdir;
        this.needrecursion = needrecursion;
        FileIndexStore.getInstace().connect(dbpath, 0);
        KeyWordStore.getInstace().connect(dbpath, 0);
        this.fileNameMap = {};
        this._usingnamespace = [];
        this.include = [];
        this.file_id = [];
        this.own_file_id = 0;
        this.showTree = {};
        this.dependent = new Set(dependent);
        this.queue = new Queue();
        this.processInclude = new Set();
        this.processFileId = new Set();
        this.filemap = {};
    }
    MakeOwnsMapByCpp.prototype._changeProtoToCpp = function (filepath) {
        if (/client\.h$/.test(filepath) || /\.pb\.h$/.test(filepath)) {
            //使用proto的client
            var that_1 = this;
            var pathinfo = path.parse(filepath);
            var protoFile = pathinfo.base;
            if (protoFile.indexOf(".pb.h") > 0) {
                protoFile = protoFile.replace(".pb.h", ".proto");
            }
            else {
                protoFile = protoFile.replace("client.h", ".proto");
            }
            // console.log(protoFile);
            var filenames = this._getFileInfo(protoFile);
            filenames.forEach(function (filename) {
                that_1._pushATask(filename);
            });
        }
        return;
    };
    ;
    return MakeOwnsMapByCpp;
}());
;
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    var parasms = {
        basedir: "/Users/widyhu/widyhu/cpp_project/",
        sysdir: "---",
        cppfilename: "/mmpay/mmpaymchmgr/mmpaymchmgrmerchant/mmpaymchmgrmerchantaosvr/logic/Merchant.cpp",
        dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db",
        needrecursion: 0,
        dependent: [12904]
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        //logger.debug(data);
        //关闭子进程
        worker_1.kill();
    });
}
else if (cluster.isWorker) {
    process.on('message', function (parasms) {
        try {
            //子线程
            // logger.debug(parasms.basedir, parasms.dbpath, parasms.cppfilename);
            //创建索引
            console.time("makeSearchTreeByCpp");
            var maker = new MakeOwnsMapByCpp(parasms.basedir, parasms.dbpath, parasms.sysdir, parasms.needrecursion, parasms.dependent);
            maker.makeSearchTreeByCpp(parasms.cppfilename);
            console.timeEnd("makeSearchTreeByCpp");
            //释放链接
            maker.disconstructor();
            //向主线线程发送数据
            var result = maker.getData();
            process.send(result);
        }
        catch (err) {
            console.log(err);
            process.kill(process.pid);
        }
    });
    process.on('exit', function (code, signal) {
        if (signal) {
            console.debug("\u5DE5\u4F5C\u8FDB\u7A0B\u5DF2\u88AB\u4FE1\u53F7 " + signal + " \u6740\u6B7B");
        }
        else if (code !== 0) {
            console.debug("\u5DE5\u4F5C\u8FDB\u7A0B\u9000\u51FA\uFF0C\u9000\u51FA\u7801: " + code);
        }
        else {
            console.debug('工作进程成功退出');
        }
    });
}
