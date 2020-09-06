/* --------------------------------------------------------------------------------------------
 * unzipSystemIncludeWorker.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const cluster = require('cluster');
const fs = require('fs');
const path = require('path');
const unzipper = require("unzipper");
const FileIndexStore = require('../store/store').FileIndexStore;
const logger = require('log4js').getLogger("cpptips");

class UnzipSystemIncludeWorker {
    constructor() {
    }

    //解压db文件到
    unzipSystemDB = function (systemdbfile, dbpath, callback) {
        if (fs.existsSync(dbpath)) {
            //如果文件已经存在了，直接不进行处理
            let filedb = new FileIndexStore();
            filedb.connect(dbpath, 0);
            let totalRow = filedb.checkHasRowData();
            console.info("file index toatl row:", totalRow);
            if (totalRow >= 1) {
                //已经存在文件，不进行分析
                let ret = filedb.checkHasSystemIndex();
                if(ret == 1){
                    //之前系统索引导入失败，这了重新导入
                    filedb.backup_live(systemdbfile, dbpath);
                    callback("success");
                    filedb.closeconnect();
                    return;
                }
                if(ret == 3){
                    callback("can_not_import");
                    filedb.closeconnect();
                    return;
                }
                
                logger.info("无需初始化系统db文件");
                callback("success");
                filedb.closeconnect();
                return;
            }
        }
    
        //db文件解压之后用不了，这边直接将db文件打包进去，不在进行解压
        let filedb = new FileIndexStore();
        filedb.connect(systemdbfile, 0);
        filedb.backup(dbpath, (t, r) => {
            if(t <=0) {
                callback("success");
                filedb.closeconnect();
                return;
            }
            logger.debug(`progress: ${((t - r) / t * 100).toFixed(1)}%`);
        });        
    };

    //解压系统头文件到指定目录
    unzipInclude = function (zipfile, callback) {
        let pos = zipfile.lastIndexOf("/");
        let filepath = zipfile.substring(0, pos);
        let unzipPath = filepath;
        logger.debug(zipfile, unzipPath);

        if (fs.existsSync(unzipPath + "/" + "usr")) {
            //如果文件已经存在了，直接不进行处理
            logger.info("无需初始化系统头文件文件");
            callback("success");
            return;
        }

        //解压缩
        const stream = fs.createReadStream(zipfile);
        stream.pipe(unzipper.Extract({ path: unzipPath }));
        stream.on('end', function(){
            logger.debug("解压公共头文件成功!");
            callback("faild");
        });
        stream.on('error', function (err) {
            logger.debug("解压公共头文件发生错误!", err);
            callback("success");
        });
    };
};

if (cluster.isMaster) {
    //测试代码
    const worker = cluster.fork();
    let parasms = {
        extpath: "/Users/widyhu/workspace/cpptips/",
        dbpath: "/Users/widyhu/workspace/cpp_project/.vscode/db/cpptips.db"

    }
    worker.send(parasms);
    worker.on('message', (data) => {
        logger.debug(JSON.stringify(data));
        //关闭子进程
        worker.kill();
    });
} else if (cluster.isWorker) {
    
    process.on('message', (parasms) => {
        let extpath = parasms.extpath;
        let dbpath = parasms.dbpath;

        let zipfile = extpath + "/data/usr.zip";
        let basedbpath = extpath + "/data/basedb.db";
        let unzipWorker = new UnzipSystemIncludeWorker();

        //解压db文件回调函数
        function unzipSystemDB_process_over(message) {
            if(message == "can_not_import"){
                let sendmessage = { "function": "can_not_import" };
                process.send(sendmessage);
                return;
            }
            let sendmessage = { "function": "over" };
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
            
        } catch (error) {
            logger.error(error);
            process.kill(process.pid);
        }
    });
}

