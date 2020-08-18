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
const logger = require('log4js').getLogger("cpptips");

class MakeOwnsMapByCpp {

    constructor(basedir, dbpath, sysdir) {
        this.basedir = basedir;
        this.sysdir = sysdir;

        FileIndexStore.getInstace().connect(dbpath, 0);
        KeyWordStore.getInstace().connect(dbpath, 0);

        this.fileNameMap = {};
        this._usingnamespace = [];
        this.include = [];
        this.showTree = {};
    }

    //目录匹配
    _initFileDir = function () {
        let infos = FileIndexStore.getInstace().getAllFileInfo();
        let filemap = {};
        for(let i = 0; i < infos.length; i++) {
            let info = infos[i];
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
    
    //获取cpp文件头文件依赖
    makeSearchTreeByCpp = function (cppfilename) {
        //在文件存储
        this.filename = cppfilename;
        let that = this;
        //加载头文件
        let filemap = this._initFileDir();

        let filepath = that.basedir + cppfilename;
        if(!fs.existsSync(filepath)) {
            //如果文件不存在，则尝试使用系统目录
            filepath = that.sysdir + cppfilename;
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
        let pos = cppfilename.lastIndexOf("/");
        let filename = cppfilename.substr(pos + 1);
        let updatetime = Math.floor(fstat.mtimeMs / 1000);
        console.time("getFileByFilePath");
        let fileinfo = FileIndexStore.getInstace().getFileByFilePath(cppfilename);
        console.timeEnd("getFileByFilePath");
        if(fileinfo == false) {
            let data = {
                filename: filename,
                filepath: cppfilename,
                md5: md5,
                type: 0,
                updatetime: updatetime,
                extdata: ''
            };
            FileIndexStore.getInstace().insert(data);
        } else {
            FileIndexStore.getInstace().modifyMd5(fileinfo.id, md5, updatetime);
        }

        //执行分析
        let analyse = new Analyse.Analyse(filecontext, cppfilename);
        console.time("Analyse");
        analyse.doAnalyse();
        console.timeEnd("Analyse");
        console.time("getResult");
        let sourceTree = analyse.getResult(FileIndexStore.getInstace(), KeyWordStore.getInstace());
        console.timeEnd("getResult");
        console.time("getDocumentStruct");
        this.showTree = analyse.getDocumentStruct();
        console.timeEnd("getDocumentStruct");

        let includefile = sourceTree.__file_inlcude;
        let namespaces = sourceTree.__file_usingnamespace;
        let queue = new Queue();
        let processInclude = new Set();
        if (includefile === undefined || typeof includefile == Array) {
            includefile = [];
        }
        if (namespaces === undefined || typeof namespaces == Array) {
            namespaces = [];
        }

        for (let i = 0; i < includefile.length; i++) {
            let filename = this._getFileRealName(includefile[i], cppfilename);
            if (!processInclude.has(filename)) {
                queue.enqueue(filename);
                processInclude.add(filename);
            }
        }
        
        let __inlcudefile = queue.dequeue();
        while (__inlcudefile) {
            if (!filemap[__inlcudefile] || filemap[__inlcudefile].extdata == "") {
                //没有收录该头文件
                __inlcudefile = queue.dequeue();
                continue;
            }
            let extJson = JSON.parse(filemap[__inlcudefile].extdata);
            let includefiles = extJson.i;
            let usingnamespace = extJson.u;
            namespaces = namespaces.concat(usingnamespace);
           
            for (let i = 0; i < includefiles.length; i++) {
                let filename = this._getFileRealName(includefiles[i], cppfilename);
                if (!processInclude.has(filename)) {
                    queue.enqueue(filename);
                    processInclude.add(filename);
                }
            }
            __inlcudefile = queue.dequeue();
        };

        //命名空间合并
        let duplicate = new Set(namespaces);
        duplicate.forEach(function (element) {
            that._usingnamespace.push(element);
        });

        //头文件关联
        processInclude.forEach(function (element) {
            that.include.push(element);
        });

        return;
    };

    disconstructor = function() {
        //关闭db链接
        FileIndexStore.getInstace().closeconnect();
        KeyWordStore.getInstace().closeconnect();
    };

    getData = function() {
        return {
            'usingnamespace': this._usingnamespace,
            'include': this.include
        };  
    };
};

if (cluster.isMaster) {
    //测试代码
    const worker = cluster.fork();
    let parasms = {
        basedir: "/Users/widyhu/widyhu/cpp_project/",
        sysdir: "",
        cppfilename: "xxxxx",
        dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db"
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
            logger.debug(parasms.basedir, parasms.dbpath, parasms.cppfilename);
            //创建索引
            console.time("makeSearchTreeByCpp");
            let maker = new MakeOwnsMapByCpp(parasms.basedir, parasms.dbpath, parasms.sysdir);
            maker.makeSearchTreeByCpp(parasms.cppfilename);
            console.timeEnd("makeSearchTreeByCpp");

            //释放链接
            maker.disconstructor();

            //向主线线程发送数据
            let result = maker.getData();
            console.time("postMessage");
            process.send(result);
            console.timeEnd("postMessage");
        } catch(err){
            logger.debug(err);
            process.kill(process.pid);
        }
    });

    process.on('exit', (code, signal) => {
        if (signal) {
            logger.debug(`工作进程已被信号 ${signal} 杀死`);
        } else if (code !== 0) {
            logger.debug(`工作进程退出，退出码: ${code}`);
        } else {
            logger.debug('工作进程成功退出');
        }
    });
}
