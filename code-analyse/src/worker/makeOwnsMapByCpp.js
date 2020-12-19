/* --------------------------------------------------------------------------------------------
 * makeOwnsMapByCpp.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const Analyse = require('../analyse/analyse');
const Queue = require('../analyse/queue');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FileIndexStore = require('../store/store').FileIndexStore;
const KeyWordStore = require('../store/store').KeyWordStore;
const cluster = require('cluster');
const os = require('os');
const Filetype = require('../traversedir/filetype').Filetype;

class MakeOwnsMapByCpp {

    constructor(basedir, dbpath, sysdir, needrecursion, dependent) {
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

    _getAllFileInfo = function () {
        console.time("_getAllFileInfo");
        let infos = FileIndexStore.getInstace().getAllIncludeFileInfo();
        let filemap = {};
        console.timeEnd("_getAllFileInfo");
        console.time("_getAllFileInfo.2");
        for(let i = 0; i < infos.length; i++) {
            let info = infos[i];
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
    _getStringSimilarity = function (inputfilename, fullName1, fullName2) {
        let dirs1 = fullName1.split(/[\/]+/g);
        let dirs2 = fullName2.split(/[\/]+/g).filter((e)=>{
            return e != "" && e != "." && e != "..";
        });
        let sameDivrNum = 0;

        for (let i = 0; i < dirs1.length && i < dirs2.length; i++) {
            if (dirs1[i] == dirs2[i]) {
                sameDivrNum++;
            }
        }
        return sameDivrNum;
    };

    _getFileRealName = function (inputfilename, cppfilename) {

        inputfilename = inputfilename.replace(/(["'<>]+)|([.]+\/)/g, "");
        let pos = inputfilename.lastIndexOf("/");
        let filename = inputfilename;
        if (pos != -1 && inputfilename.length > pos + 1) {
            filename = inputfilename.substr(pos + 1);
        }

        if (this.fileNameMap[filename]) {
            let listRealName = this.fileNameMap[filename];
            //logger.debug("listRealName", listRealName);
            //找后缀匹配的全部头文件
            let retInclude = listRealName.length > 0 ? listRealName[0] : '';
            let gSameProportion = 0;
            for (let i = 0; i < listRealName.length; i++) {
                const element = listRealName[i];
                let lpos = element.lastIndexOf(inputfilename);
                if (lpos != -1) {
                    //从前往后找，找匹配的最高的，匹配度一样的多个的时候选第一个
                    let sameProportion = this._getStringSimilarity(inputfilename, cppfilename, element);
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
    
    _anaylyseDependentFile = function(filepath) {
        let maker = new RebuildFileIndex(this.basedir, this.dbpath, false);
        maker.setUserConfig({});
        maker.forkReloadKeywordBySignleFile(filepath);
        maker.disconstructor();
    };

    _getFileInfo = function(filepath){
        filepath = filepath.replace(/["'<>]{1,1}/g, "");
        let pathinfo = path.parse(filepath);
        let filename = pathinfo.base;
        let that = this;

        if(!this.fileNameMap[filename]){
            let filenames = FileIndexStore.getInstace().getFileByFileName(filename);
            return filenames;
        }
        let filepaths = this.fileNameMap[filename];
        let result = [];
        filepaths.forEach((value, index, array)=>{
            let _pos = value.lastIndexOf(filepath);
            if(_pos < 0 
                || _pos + filepath.length != value.length) {
                //可能匹配到其他同名文件
                return;
            }
            if(!that.filemap[value]){
                //文件不存
                return;
            }
            result.push(that.filemap[value]);
        });
        return result;
    };

    _readFileContext = function(cppfilename){
        let filepath = this.basedir + cppfilename;
        if(!fs.existsSync(filepath)) {
            //如果文件不存在，则尝试使用系统目录
            filepath = this.sysdir + cppfilename;
            if(!fs.existsSync(filepath)) {
                //如果文件不存在，报错
                let includefile = [];
                let namespaces = [];
                return {includefile,namespaces};
            }
        }

        let fd = fs.openSync(filepath, 'r');
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        let fstat = fs.fstatSync(fd);
        fs.closeSync(fd);

        //写入文件索引
        let fshash = crypto.createHash("md5");
        fshash.update(filecontext);
        let md5 = fshash.digest('hex');
        let pos = filepath.lastIndexOf("/");
        let filename = filepath.substr(pos + 1);
        let updatetime = Math.floor(fstat.mtimeMs / 1000);
        let filetype = new Filetype();
        let fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
        if(fileinfo == false) {
            let data = {
                filename: filename,
                filepath: cppfilename,
                md5: md5,
                type: filetype.judgeFileType(cppfilename),
                updatetime: updatetime,
                extdata: ''
            };
            FileIndexStore.getInstace().insert(data);
        } else {
            FileIndexStore.getInstace().modifyMd5(fileinfo.id, md5, updatetime);
        }

        fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
        if(fileinfo == false) {
            //获取当前文件索引失败
            let includefile = [];
            let namespaces = [];
            return {includefile,namespaces};
        }

        this.own_file_id = fileinfo.id;

        //执行分析
        console.time("Analyse");
        let analyse = new Analyse.Analyse(filecontext, cppfilename);
        analyse.doAnalyse();
        let sourceTree = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace());
        console.timeEnd("Analyse");
        this.showTree = analyse.getDocumentStruct();
        let includefile = sourceTree.__file_inlcude;
        let namespaces = sourceTree.__file_usingnamespace;
        
        if (!includefile) { includefile = []; }
        if (!namespaces) { namespaces = [];}
        return {includefile, namespaces};
    };

    _pushATask = function(fileinfo){
        if (!this.processInclude.has(fileinfo.filepath)) {
            if(this.needrecursion == 0
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

    _changeProtoToCpp(filepath){
        if(/client\.h$/.test(filepath) || /\.pb\.h$/.test(filepath)) {
            //使用proto的client
            let that = this;
            let pathinfo = path.parse(filepath);
            let protoFile = pathinfo.base;
            if(protoFile.indexOf(".pb.h") > 0) {
                protoFile = protoFile.replace(".pb.h", ".proto");
            } else {
                protoFile = protoFile.replace("client.h", ".proto");
            }
            // console.log(protoFile);
            let filenames = this._getFileInfo(protoFile);
            filenames.forEach(filename => {
                that._pushATask(filename);
            });
        }
        return;
    };

    //获取cpp文件头文件依赖
    makeSearchTreeByCpp = function (cppfilename) {
        //在文件存储
        this.filename = cppfilename;
        this.filemap = this._getAllFileInfo();
        let that = this;

        let {includefile, namespaces} = this._readFileContext(cppfilename);
        for (let i = 0; i < includefile.length; i++) {
            //proto处理
            this._changeProtoToCpp(includefile[i]);
            let filenames = this._getFileInfo(includefile[i]);
            filenames.forEach(filename => {
                that._pushATask(filename);
            });
        }
        
        let __inlcudefile = this.queue.dequeue();
        while (__inlcudefile) {
            if (!that.filemap[__inlcudefile] 
                || that.filemap[__inlcudefile].extdata == "") {
                //没有收录该头文件
                //或者该头文件没有包含头文件
                __inlcudefile = that.queue.dequeue();
                continue;
            }
            
            let extJson = JSON.parse(that.filemap[__inlcudefile].extdata);
            let includefiles = extJson.i;
            let usingnamespace = extJson.u;
            namespaces = namespaces.concat(usingnamespace);
            for (let i = 0; i < includefiles.length; i++) {
                //proto处理
                that._changeProtoToCpp(includefiles[i]);
                let filenames = this._getFileInfo(includefiles[i]);
                filenames.forEach(filename => { 
                    that._pushATask(filename);
                });
            }
            __inlcudefile = this.queue.dequeue();
        };

        //命名空间合并
        let duplicate = new Set(namespaces);
        that._usingnamespace = Array.from(duplicate);

        //头文件关联
        that.include = Array.from(that.processInclude);

        //获取文件id
        that.file_id = Array.from(that.processFileId);

        return;
    };

    disconstructor = function() {
        //关闭db链接
        FileIndexStore.getInstace().closeconnect();
        KeyWordStore.getInstace().closeconnect();
    };

    getData = function() {
        console.log("头文件依赖总数：",this.file_id.length);
        if(this.file_id.length < 20){
            console.log(this.include);
        }
        return {
            'usingnamespace': this._usingnamespace,
            'include': this.include,
            'fileids' : this.file_id,
            'currentfileid' : this.own_file_id
        };  
    };
};

if (cluster.isMaster) {
    //测试代码
    const worker = cluster.fork();
    let parasms = {
        basedir: "/Users/widyhu/widyhu/cpp_project/",
        sysdir: "---",
        cppfilename: "/mmpay/mmpaymchmgr/mmpaymchmgrmerchant/mmpaymchmgrmerchantaosvr/logic/Merchant.cpp",
        dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db",
        needrecursion: 0,
        dependent : [12904]
    }
    worker.send(parasms);
    worker.on('message', (data)=>{
        //logger.debug(data);
        //关闭子进程
        worker.kill();
    });
} else if (cluster.isWorker) {
    process.on('message', (parasms) => {
        try {
            //子线程
            // logger.debug(parasms.basedir, parasms.dbpath, parasms.cppfilename);
            //创建索引
            console.time("makeSearchTreeByCpp");
            let maker = new MakeOwnsMapByCpp(parasms.basedir, parasms.dbpath, parasms.sysdir, parasms.needrecursion, parasms.dependent);
            maker.makeSearchTreeByCpp(parasms.cppfilename);
            console.timeEnd("makeSearchTreeByCpp");

            //释放链接
            maker.disconstructor();

            //向主线线程发送数据
            let result = maker.getData();
            process.send(result);
        } catch(err){
            console.log(err);
            process.kill(process.pid);
        }
    });

    process.on('exit', (code, signal) => {
        if (signal) {
            console.debug(`工作进程已被信号 ${signal} 杀死`);
        } else if (code !== 0) {
            console.debug(`工作进程退出，退出码: ${code}`);
        } else {
            console.debug('工作进程成功退出');
        }
    });
}
