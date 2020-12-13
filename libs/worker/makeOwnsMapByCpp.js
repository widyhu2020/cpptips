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
var MakeOwnsMapByCpp = /** @class */ (function () {
    function MakeOwnsMapByCpp(basedir, dbpath, sysdir) {
        //目录匹配
        this._initFileDir = function () {
            var infos = FileIndexStore.getInstace().getAllFileInfo();
            var filemap = {};
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                filemap[info.filepath] = info;
                if (!this.fileNameMap[info.filename]) {
                    this.fileNameMap[info.filename] = [info.filepath];
                    continue;
                }
                this.fileNameMap[info.filename].push(info.filepath);
            }
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
        //获取cpp文件头文件依赖
        this.makeSearchTreeByCpp = function (cppfilename) {
            //在文件存储
            this.filename = cppfilename;
            var that = this;
            //加载头文件
            console.time("_initFileDir");
            // let filemap = this._initFileDir();
            var filemap = {};
            console.timeEnd("_initFileDir");
            var filepath = that.basedir + cppfilename;
            if (!fs.existsSync(filepath)) {
                //如果文件不存在，则尝试使用系统目录
                filepath = that.sysdir + cppfilename;
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
            var pos = cppfilename.lastIndexOf("/");
            var filename = cppfilename.substr(pos + 1);
            var updatetime = Math.floor(fstat.mtimeMs / 1000);
            // logger.debug("getFileByFilePath");
            var fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
            // logger.debug("getFileByFilePath");
            if (fileinfo == false) {
                var data = {
                    filename: filename,
                    filepath: cppfilename,
                    md5: md5,
                    type: 0,
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
                return;
            }
            this.own_file_id = fileinfo.id;
            //执行分析
            var analyse = new Analyse.Analyse(filecontext, cppfilename);
            analyse.doAnalyse();
            var sourceTree = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace());
            this.showTree = analyse.getDocumentStruct();
            var includefile = sourceTree.__file_inlcude;
            var namespaces = sourceTree.__file_usingnamespace;
            var queue = new Queue();
            var processInclude = new Set();
            var processFileId = new Set();
            if (includefile === undefined || typeof includefile == Array) {
                includefile = [];
            }
            if (namespaces === undefined || typeof namespaces == Array) {
                namespaces = [];
            }
            var _loop_1 = function (i) {
                includefile[i] = includefile[i].replace(/["'<>]{1,1}/g, "");
                var pathinfo = path.parse(includefile[i]);
                var protoFile = pathinfo.base;
                var filedivpath = pathinfo.dir;
                var filenames = FileIndexStore.getInstace().getFileByFileName(protoFile);
                if (filenames && filenames.length > 0) {
                    filenames.forEach(function (filename) {
                        if (filename.filepath.indexOf(filedivpath) == -1) {
                            //未匹配路径
                            return;
                        }
                        if (!processInclude.has(filename.filepath)) {
                            queue.enqueue(filename.filepath);
                            filemap[filename.filepath] = filename;
                            processInclude.add(filename.filepath);
                            processFileId.add(filename.id);
                        }
                    });
                }
                else {
                    queue.enqueue(protoFile);
                }
            };
            for (var i = 0; i < includefile.length; i++) {
                _loop_1(i);
            }
            var __inlcudefile = queue.dequeue();
            while (__inlcudefile) {
                if (/client\.h$/.test(__inlcudefile) || /\.pb\.h$/.test(__inlcudefile)) {
                    //使用proto的client
                    var pathinfo = path.parse(__inlcudefile);
                    var protoFile = pathinfo.base;
                    if (protoFile.indexOf(".pb.h") > 0) {
                        protoFile = protoFile.replace(".pb.h", ".proto");
                    }
                    else {
                        protoFile = protoFile.replace("client.h", ".proto");
                    }
                    var filenames = FileIndexStore.getInstace().getFileByFileName(protoFile);
                    if (filenames && filenames.length > 0) {
                        filenames.forEach(function (filename) {
                            if (!processInclude.has(filename.filepath)) {
                                queue.enqueue(filename.filepath);
                                filemap[filename.filepath] = filename;
                                processInclude.add(filename.filepath);
                                processFileId.add(filename.id);
                            }
                        });
                    }
                    else {
                        queue.enqueue(protoFile);
                    }
                }
                if (filemap[__inlcudefile] && !processInclude.has(__inlcudefile)) {
                    //当前文件纳入
                    processInclude.add(filemap[__inlcudefile].filepath);
                    processFileId.add(filemap[__inlcudefile].id);
                }
                if (!filemap[__inlcudefile] || filemap[__inlcudefile].extdata == "") {
                    //没有收录该头文件
                    __inlcudefile = queue.dequeue();
                    continue;
                }
                var extJson = JSON.parse(filemap[__inlcudefile].extdata);
                var includefiles = extJson.i;
                var usingnamespace = extJson.u;
                namespaces = namespaces.concat(usingnamespace);
                var _loop_2 = function (i) {
                    includefiles[i] = includefiles[i].replace(/["'<>]{1,1}/g, "");
                    var pathinfo = path.parse(includefiles[i]);
                    var protoFile = pathinfo.base;
                    var filedivpath = pathinfo.dir.replace(/[.]{1,2}\//m, "");
                    var filenames = FileIndexStore.getInstace().getFileByFileName(protoFile);
                    if (filenames && filenames.length > 0) {
                        filenames.forEach(function (filename) {
                            if (filename.filepath.indexOf(filedivpath) == -1) {
                                //未匹配路径
                                return;
                            }
                            if (!processInclude.has(filename.filepath)) {
                                queue.enqueue(filename.filepath);
                                filemap[filename.filepath] = filename;
                                processInclude.add(filename.filepath);
                                processFileId.add(filename.id);
                            }
                        });
                    }
                    else {
                        // if(__inlcudefile.indexOf("mmpaymchmerchantsubjectauthorizebizaosvr") > 0)console.log(__inlcudefile, protoFile);
                        queue.enqueue(protoFile);
                    }
                };
                for (var i = 0; i < includefiles.length; i++) {
                    _loop_2(i);
                }
                __inlcudefile = queue.dequeue();
            }
            ;
            //命名空间合并
            var duplicate = new Set(namespaces);
            that._usingnamespace = Array.from(duplicate);
            //头文件关联
            that.include = Array.from(processInclude);
            //获取文件id
            that.file_id = Array.from(processFileId);
            return;
        };
        this.disconstructor = function () {
            //关闭db链接
            FileIndexStore.getInstace().closeconnect();
            KeyWordStore.getInstace().closeconnect();
        };
        this.getData = function () {
            console.log("头文件依赖总数：", this.file_id.length);
            // logger.debug(this.file_id.join(","));
            return {
                'usingnamespace': this._usingnamespace,
                'include': this.include,
                'fileids': this.file_id,
                'currentfileid': this.own_file_id
            };
        };
        this.basedir = basedir;
        this.sysdir = sysdir;
        FileIndexStore.getInstace().connect(dbpath, 0);
        KeyWordStore.getInstace().connect(dbpath, 0);
        this.fileNameMap = {};
        this._usingnamespace = [];
        this.include = [];
        this.file_id = [];
        this.own_file_id = 0;
        this.showTree = {};
    }
    return MakeOwnsMapByCpp;
}());
;
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    var parasms = {
        basedir: "---",
        sysdir: "---",
        cppfilename: "---",
        dbpath: "--/.vscode/db/cpptips.db"
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
            var maker = new MakeOwnsMapByCpp(parasms.basedir, parasms.dbpath, parasms.sysdir);
            maker.makeSearchTreeByCpp(parasms.cppfilename);
            console.timeEnd("makeSearchTreeByCpp");
            //释放链接
            maker.disconstructor();
            //向主线线程发送数据
            var result = maker.getData();
            process.send(result);
        }
        catch (err) {
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
