/* --------------------------------------------------------------------------------------------
 * checkNeedUpdae.js
 *
 *  Created on: 2020年4月11日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const cluster = require('cluster');
const Analyse = require('../analyse/analyse').Analyse;
const TypeEnum = require('../analyse/analyse').TypeEnum;
const Traverse = require('../traversedir/traverse');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');
const FileIndexStore = require('../store/store').FileIndexStore;
const KeyWordStore = require('../store/store').KeyWordStore;
const FileType = require('../store/store').FileType;

class CheckNeedUpdate {
    constructor(baseurl, basedir, intervaltime, callback, showversion = 0) {
        this.needStop = false;
        this.filelist = [];
        this.baseurl = baseurl;
        this.basedir = basedir;
        this.intervaltime = intervaltime;
        this.callback = callback;
        this.timer = null;
        this.showversion = showversion;
    }

    do = function() {
        let that = this;

        if(this.showversion == 1) {
            that.filelist = [];
            let path = that.basedir + "/libs/";
            that._getListOnLocation(path, "/libs", path);
            path = that.basedir + "/client/out/";
            that._getListOnLocation(path, "/client/out", path);
            path = that.basedir + "/server/out/";
            that._getListOnLocation(path, "/server/out", path);
            that._getSignFileInfo("/package.json");
            let versionInfo = JSON.stringify(that.filelist);
            console.log(versionInfo);
            let fd = fs.openSync(__dirname + "/../../../list.js", "w+");
            fs.writeSync(fd, versionInfo);
            fs.closeSync(fd);
            process.send("exit");
            return;
        }
        
        //先检一遍，之后每隔半小时检查一次
        //that._checkNeedUpdate();

        //半小时(默认)执行一次
        this.timer = setInterval(() => {
            if(that.needStop) {
                console.log("find need exit!");
                that.filelist = [];
                clearInterval(this.timer);
                return;
            }
            that._checkNeedUpdate();
        }, this.intervaltime);
        //2147483647
    };

    _checkNeedUpdate = function() {
        let that = this;
        function successfunction(list){
            that.filelist = [];
            let path = that.basedir + "/libs/";
            that._getListOnLocation(path, "/libs", path);
            path = that.basedir + "/client/out/";
            that._getListOnLocation(path, "/client/out", path);
            path = that.basedir + "/server/out/";
            that._getListOnLocation(path, "/server/out", path);
            that._getSignFileInfo("/package.json");

            //构造映射
            let filemap = {};
            for(let i = 0; i < that.filelist.length; i++){
                let fileinfo = that.filelist[i];
                filemap[fileinfo.path] = fileinfo.md5;
            }

            let needShow = false;
            console.log(list, JSON.stringify(that.filelist));
            let serviceList = JSON.parse(list);
            for(let i = 0; i < serviceList.length; i++) {
                let fileinfo = serviceList[i];
                if(!filemap[fileinfo.path] 
                    || filemap[fileinfo.path] != fileinfo.md5) {
                    //文件新增加或者已经更新
                    needShow = true;
                    let timestamp = (new Date()).valueOf();
                    let url = that.baseurl + fileinfo.path + "?v=" + timestamp;
                    that._getListChek(url, (context)=>{
                        //保存文件
                        let ret = false;
                        //最多尝试三次
                        let tryNum = 3;
                        ret = that._saveFileToLocal(fileinfo.path, context);
                    });
                }
            }

            if(needShow) {
                that.callback();
            }
        }

        //获取更新检查文件
        let timestamp = (new Date()).valueOf();
        let url = this.baseurl + "/list.js?v=" + timestamp;
        this._getListChek(url, successfunction);
    };

    _saveFileToLocal = function(filepath, fileconext) {
        console.log("save file! filepath:", filepath);
        let allpath = this.basedir + filepath;
        try{
            let fd = fs.openSync(allpath, 'w+');
            let length = fs.writeSync(fd, fileconext, 0, "utf8");
            fs.closeSync(fd);
        }catch(error){
            console.log(error);
            return false;
        }
        return true;
    };

    _getListChek = function(url, successfunction) {
        //http://9.134.38.144:8888/list.js
        console.log(url);
        try{
            let http = require('http');
            
            // 参数url和回调函数
            http.get(url, function (res) {
                if(res.statusCode != 200){
                    //http请求出错，返回不是200
                    return false;
                }
                res.setEncoding('utf8');
                let html = '';
                // 绑定data事件 回调函数 累加html片段
                res.on('data', function (data) {
                    html += data;
                });

                //拉取完毕
                res.on('end', function () {
                    successfunction(html);
                });
            }).on('error', function () {
                console.log('获取数据错误');
            });
        } catch(error) {
            console.log(error, url);
        }
    };

    //获取单个文件
    _getSignFileInfo = function(filename) {
        let fd = fs.openSync(this.basedir + filename, 'r');
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
        fs.closeSync(fd);

        let fshash = crypto.createHash("md5");
        let filecontext = buffer.toString('utf8', 0, bytesRead);
        fshash.update(filecontext);
        let md5 = fshash.digest('hex');
        let fileinfo = {
            path: filename,
            md5: md5
        };
        this.filelist.push(fileinfo);
    };

    //遍历目录
    _getListOnLocation = function(dirfather, predir, dir) {
        let that = this;
        //获取本地文件的md5文件列表
        //lib文件夹
        let dirf = fs.readdirSync(dir, { 'encoding': 'utf8', 'withFileTypes': false });
        dirf.forEach(function (el, index) {
            let filename = `${dir}/` + el;
            let dataFile = null;
            try {
                //不判断软连接
                dataFile = fs.lstatSync(filename);
            } catch (error) {
                console.log(error);
                return;
            }
           
            //一定得fstatSync方法
            if(dataFile.isSymbolicLink()) {
                //软链接跳过
                return;
            }
            if (!dataFile) {
                return;
            } else if (dataFile.isDirectory()) {
                // 又是文件夹
                // 遍历文件夹
                that._getListOnLocation(dirfather, predir, filename);
            } else if (dataFile.isFile()){
                let realfilename = filename.replace(dirfather, "");
                realfilename = predir + realfilename;
                let fd = fs.openSync(filename, 'r');
                const buffer = Buffer.alloc(1024 * 1024 * 2);
                let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
                fs.closeSync(fd);

                let fshash = crypto.createHash("md5");
                let filecontext = buffer.toString('utf8', 0, bytesRead);
                fshash.update(filecontext);
                let md5 = fshash.digest('hex');
                let fileinfo = {
                    path: realfilename,
                    md5: md5
                };
                that.filelist.push(fileinfo);
            }
        });
    };

    //退出进程
    shutdown = function(){
        this.needStop = true;
        if(this.timer != null) {
            //清楚定时器
            clearInterval(this.timer);
        }
    };
}

if (cluster.isMaster) {
    //测试代码
    //获取basepath
    const worker = cluster.fork();
    let parasms = {
        baseurl: "http://cpptips.com:8888",
        basedir: "/Users/widyhu/widyhu/cpptips",
        intervaltime: 1,
        showversion: 1
    };
    worker.send(parasms);
    worker.on('message', (data) => {
        if(data == "exit") {
            worker.kill();
        }
        if(data == "update") {
            console.log("need update");
        }
    });
} else if (cluster.isWorker) {
    //子进程
    let checkUpdate = null;
    onMessage = function(parasms) {
        if (parasms === 'shutdown') {
            //让所有进程优雅地关闭。
            if(maker != null) {
                //退出worker
                checkUpdate.shutdown();
                //退出
                process.send("over");
                return;
            }
            return;
        }

        if(!parasms.basedir || !parasms.baseurl || !parasms.intervaltime) {
            //输入参数非法
            console.log("input params error", parasms);
            return;
        }

        function needTips() {
            //发送更新通知
            //引导重启生效
            process.send("update");
        }
        let showversion = 0;
        if(parasms.showversion) {
            showversion = parasms.showversion;
        }
        let basedir = parasms.basedir;
        let baseurl = parasms.baseurl;
        let intervaltime = parasms.intervaltime;
        checkUpdate = new CheckNeedUpdate(baseurl, basedir, intervaltime, needTips, showversion);
        checkUpdate.do();
    };
    process.on('message', (parasms) => {
        //console.log("onmessage",parasms);
        onMessage(parasms);
    });
};