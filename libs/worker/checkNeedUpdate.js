/* --------------------------------------------------------------------------------------------
 * checkNeedUpdae.js
 *
 *  Created on: 2020年4月11日
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
var CheckNeedUpdate = /** @class */ (function () {
    function CheckNeedUpdate(baseurl, basedir, intervaltime, callback, showversion) {
        if (showversion === void 0) { showversion = 0; }
        this.do = function () {
            var _this = this;
            var that = this;
            if (this.showversion == 1) {
                that.filelist = [];
                var filepath = that.basedir + "/libs/";
                that._getListOnLocation(filepath, "/libs", filepath);
                filepath = that.basedir + "/client/out/";
                that._getListOnLocation(filepath, "/client/out", filepath);
                filepath = that.basedir + "/server/out/";
                that._getListOnLocation(filepath, "/server/out", filepath);
                // that._getSignFileInfo("/package.json");
                var versionInfo = JSON.stringify(that.filelist);
                //console.log(versionInfo);
                var fd = fs.openSync(__dirname + "/../../../list.js", "w+");
                fs.writeSync(fd, versionInfo);
                fs.closeSync(fd);
                process.send("exit");
                return;
            }
            //先检一遍，之后每隔半小时检查一次
            //that._checkNeedUpdate();
            //半小时(默认)执行一次
            this.timer = setInterval(function () {
                if (that.needStop) {
                    console.log("find need exit!");
                    that.filelist = [];
                    clearInterval(_this.timer);
                    return;
                }
                that._checkNeedUpdate();
            }, this.intervaltime);
            //2147483647
        };
        this._checkNeedUpdate = function () {
            var that = this;
            function successfunction(list) {
                that.filelist = [];
                var filepath = that.basedir + "/libs/";
                that._getListOnLocation(filepath, "/libs", filepath);
                filepath = that.basedir + "/client/out/";
                that._getListOnLocation(filepath, "/client/out", filepath);
                filepath = that.basedir + "/server/out/";
                that._getListOnLocation(filepath, "/server/out", filepath);
                //package更新会导致版本不一致，从而导致vscode不加载插件，因此package永远都不更新
                // that._getSignFileInfo("/package.json");
                //构造映射
                var filemap = {};
                for (var i = 0; i < that.filelist.length; i++) {
                    var fileinfo = that.filelist[i];
                    filemap[fileinfo.path] = fileinfo.md5;
                }
                var needShow = false;
                //console.log(list, JSON.stringify(that.filelist));
                var serviceList = JSON.parse(list);
                var _loop_1 = function (i) {
                    var fileinfo = serviceList[i];
                    if (!filemap[fileinfo.path]
                        || filemap[fileinfo.path] != fileinfo.md5) {
                        //文件新增加或者已经更新
                        needShow = true;
                        var timestamp_1 = (new Date()).valueOf();
                        var url_1 = that.baseurl + fileinfo.path + "?v=" + timestamp_1;
                        that._getListChek(url_1, function (context) {
                            //保存文件
                            var ret = false;
                            //最多尝试三次
                            try {
                                ret = that._saveFileToLocal(fileinfo.path, context);
                            }
                            catch (error) {
                                console.log("error:", error, fileinfo.path);
                            }
                        });
                    }
                };
                for (var i = 0; i < serviceList.length; i++) {
                    _loop_1(i);
                }
                if (needShow) {
                    that.callback();
                }
            }
            //获取更新检查文件
            var timestamp = (new Date()).valueOf();
            var url = this.baseurl + "/list.js?v=" + timestamp;
            this._getListChek(url, successfunction);
        };
        this._saveFileToLocal = function (filepath, fileconext) {
            console.log("save file! filepath:", filepath);
            var allpath = this.basedir + filepath;
            try {
                if (fs.existsSync(allpath)) {
                    //修改文件的权限，保证更新
                    if (!fs.accessSync(allpath, fs.constants.W_OK)) {
                        //增加写权限
                        fs.chmodSync(allpath, 502);
                    }
                }
                else {
                    //如果文件不存在，调整文件的可写权限
                    var path_1 = require('path');
                    var pathinfo = path_1.parse(allpath);
                    if (!fs.accessSync(pathinfo.dir, fs.constants.W_OK)) {
                        //增加写权限
                        fs.chmodSync(pathinfo.dir, 502);
                    }
                }
                var fd = fs.openSync(allpath, 'w+');
                var length_1 = fs.writeSync(fd, fileconext, 0, "utf8");
                fs.closeSync(fd);
            }
            catch (error) {
                console.log(error);
                return false;
            }
            return true;
        };
        this._getListChek = function (url, successfunction) {
            //http://9.134.38.144:8888/list.js
            console.log(url);
            try {
                var http = require('http');
                // 参数url和回调函数
                http.get(url, function (res) {
                    if (res.statusCode != 200) {
                        //http请求出错，返回不是200
                        return false;
                    }
                    res.setEncoding('utf8');
                    var html = '';
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
            }
            catch (error) {
                console.log(error, url);
            }
        };
        //获取单个文件
        this._getSignFileInfo = function (filename) {
            var fd = fs.openSync(this.basedir + filename, 'r');
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            fs.closeSync(fd);
            var fshash = crypto.createHash("md5");
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            fshash.update(filecontext);
            var md5 = fshash.digest('hex');
            var fileinfo = {
                path: filename,
                md5: md5
            };
            this.filelist.push(fileinfo);
        };
        //遍历目录
        this._getListOnLocation = function (dirfather, predir, dir) {
            var that = this;
            //获取本地文件的md5文件列表
            //lib文件夹
            var dirf = fs.readdirSync(dir, { 'encoding': 'utf8', 'withFileTypes': false });
            dirf.forEach(function (el, index) {
                if (el == ".DS_Store") {
                    return;
                }
                var filename = "" + dir + "/" + el;
                var dataFile = null;
                try {
                    //不判断软连接
                    dataFile = fs.lstatSync(filename);
                }
                catch (error) {
                    console.log(error);
                    return;
                }
                //一定得fstatSync方法
                if (dataFile.isSymbolicLink()) {
                    //软链接跳过
                    return;
                }
                if (!dataFile) {
                    return;
                }
                else if (dataFile.isDirectory()) {
                    // 又是文件夹
                    // 遍历文件夹
                    that._getListOnLocation(dirfather, predir, filename);
                }
                else if (dataFile.isFile()) {
                    var realfilename = filename.replace(dirfather, "");
                    realfilename = predir + realfilename;
                    var fd = fs.openSync(filename, 'r');
                    var buffer = Buffer.alloc(1024 * 1024 * 2);
                    var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
                    fs.closeSync(fd);
                    var fshash = crypto.createHash("md5");
                    var filecontext = buffer.toString('utf8', 0, bytesRead);
                    fshash.update(filecontext);
                    var md5 = fshash.digest('hex');
                    var fileinfo = {
                        path: realfilename,
                        md5: md5
                    };
                    that.filelist.push(fileinfo);
                }
            });
        };
        //退出进程
        this.shutdown = function () {
            this.needStop = true;
            if (this.timer != null) {
                //清楚定时器
                clearInterval(this.timer);
            }
        };
        this.needStop = false;
        this.filelist = [];
        this.baseurl = baseurl;
        this.basedir = basedir;
        this.intervaltime = intervaltime;
        this.callback = callback;
        this.timer = null;
        this.showversion = showversion;
    }
    return CheckNeedUpdate;
}());
if (cluster.isMaster) {
    //测试代码
    //获取basepath
    var worker_1 = cluster.fork();
    var parasms = {
        baseurl: "http://cpptips.com:8888",
        basedir: "/Users/widyhu/widyhu/cpptips",
        intervaltime: 1,
        showversion: 1,
        maketools: 1
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        if (data == "exit") {
            worker_1.kill();
        }
        if (data == "update") {
            console.log("need update");
        }
    });
}
else if (cluster.isWorker) {
    //子进程
    var checkUpdate_1 = null;
    onMessage = function (parasms) {
        if (parasms === 'shutdown') {
            //让所有进程优雅地关闭。
            if (maker != null) {
                //退出worker
                checkUpdate_1.shutdown();
                //退出
                process.send("over");
                return;
            }
            return;
        }
        if (!parasms.basedir || !parasms.baseurl || !parasms.intervaltime) {
            //输入参数非法
            //console.log("input params error", parasms);
            return;
        }
        function needTips() {
            //发送更新通知
            //引导重启生效
            process.send("update");
        }
        var showversion = 0;
        if (parasms.showversion) {
            showversion = parasms.showversion;
        }
        var basedir = parasms.basedir;
        var baseurl = parasms.baseurl;
        var maketools = parasms.maketools;
        var intervaltime = parasms.intervaltime;
        checkUpdate_1 = new CheckNeedUpdate(baseurl, basedir, intervaltime, needTips, showversion);
        if (!(/[\\/]{1,1}cpptips[\\/]{1,1}/g.test(__dirname))
            || maketools == 1) {
            checkUpdate_1.do();
        }
        else {
            process.send("over");
        }
    };
    process.on('message', function (parasms) {
        //console.log("onmessage",parasms);
        onMessage(parasms);
    });
}
;
