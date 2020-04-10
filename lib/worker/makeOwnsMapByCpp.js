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
var crypto = require('crypto');
var FileIndexStore = require('../store/store').FileIndexStore;
var KeyWordStore = require('../store/store').KeyWordStore;
var cluster = require('cluster');
var MakeOwnsMapByCpp = /** @class */ (function () {
    function MakeOwnsMapByCpp(basedir, dbpath, cppfilename) {
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
                //console.log("listRealName", listRealName);
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
                    //console.log("return path:",retInclude);
                    return retInclude;
                }
                return inputfilename;
            }
            //console.log("return source failename:", inputfilename, filename);
            return inputfilename;
        };
        //获取cpp文件头文件依赖
        this.makeSearchTreeByCpp = function (cppfilename) {
            //在文件存储
            this.filename = cppfilename;
            //加载头文件
            var filemap = this._initFileDir();
            var that = this;
            var fd = fs.openSync(that.basedir + cppfilename, 'r');
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            var fstat = fs.fstatSync(fd);
            fs.closeSync(fd);
            //写入文件索引
            var fshash = crypto.createHash("md5");
            fshash.update(filecontext);
            var md5 = fshash.digest('hex');
            var pos = cppfilename.lastIndexOf('/');
            var filename = cppfilename.substr(pos + 1);
            var updatetime = Math.floor(fstat.mtimeMs / 1000);
            var fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
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
            //执行分析
            var analyse = new Analyse.Analyse(filecontext, cppfilename);
            analyse.doAnalyse();
            var sourceTree = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace());
            var includefile = sourceTree.__file_inlcude;
            var namespaces = sourceTree.__file_usingnamespace;
            var queue = new Queue();
            var processInclude = new Set();
            if (includefile === undefined || typeof includefile == Array) {
                includefile = [];
            }
            if (namespaces === undefined || typeof namespaces == Array) {
                namespaces = [];
            }
            for (var i = 0; i < includefile.length; i++) {
                var filename_1 = this._getFileRealName(includefile[i], cppfilename);
                if (!processInclude.has(filename_1)) {
                    queue.enqueue(filename_1);
                    processInclude.add(filename_1);
                }
            }
            var __inlcudefile = queue.dequeue();
            while (__inlcudefile) {
                if (!filemap[__inlcudefile] || filemap[__inlcudefile].extdata == "") {
                    //没有收录该头文件
                    __inlcudefile = queue.dequeue();
                    continue;
                }
                var extJson = JSON.parse(filemap[__inlcudefile].extdata);
                var includefiles = extJson.i;
                var usingnamespace = extJson.u;
                namespaces = namespaces.concat(usingnamespace);
                for (var i = 0; i < includefiles.length; i++) {
                    var filename_2 = this._getFileRealName(includefiles[i], cppfilename);
                    if (!processInclude.has(filename_2)) {
                        queue.enqueue(filename_2);
                        processInclude.add(filename_2);
                    }
                }
                __inlcudefile = queue.dequeue();
            }
            ;
            //命名空间合并
            var duplicate = new Set(namespaces);
            duplicate.forEach(function (element) {
                that._usingnamespace.push(element);
            });
            //头文件关联
            processInclude.forEach(function (element) {
                that.include.push(element);
            });
            return;
        };
        this.disconstructor = function () {
            //关闭db链接
            FileIndexStore.getInstace().closeconnect();
            KeyWordStore.getInstace().closeconnect();
        };
        this.getData = function () {
            return {
                'usingnamespace': this._usingnamespace,
                'include': this.include
            };
        };
        this.basedir = basedir;
        FileIndexStore.getInstace().connect(dbpath, 0);
        KeyWordStore.getInstace().connect(dbpath, 0);
        this.fileNameMap = {};
        this._usingnamespace = [];
        this.include = [];
    }
    return MakeOwnsMapByCpp;
}());
;
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    var parasms = {
        basedir: "/Users/widyhu/workspace/cpp_project/",
        cppfilename: "/mmpay/mmpaymchmgr/mmpaymchproduct/mmpaymchproductaosvr/logic/MerchantProduct.cpp",
        dbpath: "/Users/widyhu/workspace/code-analyse/cpptips.db"
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        console.log(data);
        //关闭子进程
        worker_1.kill();
    });
}
else if (cluster.isWorker) {
    process.on('message', function (parasms) {
        try {
            //子线程
            console.log(parasms.basedir, parasms.dbpath, parasms.cppfilename);
            //创建索引
            console.time("makeSearchTreeByCpp");
            var maker = new MakeOwnsMapByCpp(parasms.basedir, parasms.dbpath, parasms.cppfilename);
            maker.makeSearchTreeByCpp(parasms.cppfilename);
            console.timeEnd("makeSearchTreeByCpp");
            //释放链接
            maker.disconstructor();
            //向主线线程发送数据
            var result = maker.getData();
            console.time("postMessage");
            process.send(result);
            console.timeEnd("postMessage");
        }
        catch (err) {
            console.error(err);
            process.kill(process.pid);
        }
    });
    process.on('exit', function (code, signal) {
        if (signal) {
            console.log("\u5DE5\u4F5C\u8FDB\u7A0B\u5DF2\u88AB\u4FE1\u53F7 " + signal + " \u6740\u6B7B");
        }
        else if (code !== 0) {
            console.log("\u5DE5\u4F5C\u8FDB\u7A0B\u9000\u51FA\uFF0C\u9000\u51FA\u7801: " + code);
        }
        else {
            console.log('工作进程成功退出');
        }
    });
}
