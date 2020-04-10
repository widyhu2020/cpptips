/* --------------------------------------------------------------------------------------------
 * unzipSystemIncludeWorker.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var cluster = require('cluster');
var fs = require('fs');
var unzipper = require("unzipper");
var FileIndexStore = require('../store/store').FileIndexStore;
var UnzipSystemIncludeWorker = /** @class */ (function () {
    function UnzipSystemIncludeWorker() {
        //解压db文件到
        this.unzipSystemDB = function (systemdbfile, dbpath, callback) {
            if (fs.existsSync(dbpath)) {
                //如果文件已经存在了，直接不进行处理
                var filedb_1 = new FileIndexStore();
                filedb_1.connect(dbpath, 0);
                var totalRow = filedb_1.checkHasRowData();
                filedb_1.close();
                console.info("file index toatl row:", totalRow);
                if (totalRow >= 1) {
                    //已经存在文件，不进行分析
                    console.info("无需初始化系统db文件");
                    callback("success");
                    return;
                }
            }
            //db文件解压之后用不了，这边直接将db文件打包进去，不在进行解压
            var filedb = new FileIndexStore();
            filedb.connect(systemdbfile, 0);
            filedb.backup(dbpath, function (t, r) {
                if (t <= 0) {
                    callback("success");
                    return;
                }
                console.log("progress: " + ((t - r) / t * 100).toFixed(1) + "%");
            });
        };
        //解压系统头文件到指定目录
        this.unzipInclude = function (zipfile, callback) {
            var pos = zipfile.lastIndexOf("/");
            var path = zipfile.substring(0, pos);
            var unzipPath = path;
            console.log(zipfile, unzipPath);
            if (fs.existsSync(unzipPath + "/usr")) {
                //如果文件已经存在了，直接不进行处理
                console.info("无需初始化系统头文件文件");
                callback("success");
                return;
            }
            //解压缩
            var stream = fs.createReadStream(zipfile);
            stream.pipe(unzipper.Extract({ path: unzipPath }));
            stream.on('end', function () {
                console.log("解压公共头文件成功!");
                callback("faild");
            });
            stream.on('error', function (err) {
                console.log("解压公共头文件发生错误!", err);
                callback("success");
            });
        };
    }
    return UnzipSystemIncludeWorker;
}());
;
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    var parasms = {
        extpath: "/Users/widyhu/workspace/cpptips/",
        dbpath: "/Users/widyhu/workspace/cpp_project/.vscode/.db/.cpptips.db"
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
        var extpath = parasms.extpath;
        var dbpath = parasms.dbpath;
        var zipfile = extpath + "/data/usr.zip";
        var basedbpath = extpath + "/data/basedb.db";
        var unzipWorker = new UnzipSystemIncludeWorker();
        //解压db文件回调函数
        function unzipSystemDB_process_over(message) {
            var sendmessage = { "function": "over" };
            process.send(sendmessage);
        }
        //解压头文件回调函数
        function unzipInclude_process_over(message) {
            //解压系统索引库
            unzipWorker.unzipSystemDB(basedbpath, dbpath, unzipSystemDB_process_over);
        }
        try {
            //解压系统目录文件
            unzipWorker.unzipInclude(zipfile, unzipInclude_process_over);
        }
        catch (error) {
            console.error(error);
            process.kill(process.pid);
        }
    });
}
