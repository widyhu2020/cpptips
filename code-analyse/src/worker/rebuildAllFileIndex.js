/* --------------------------------------------------------------------------------------------
 * rebuildAllFileIndex.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const cluster = require('cluster');
const RebuildFileIndex = require('../analyse/rebuildFileIndex').RebuildFileIndex;
const logger = require('log4js').getLogger("cpptips");


if (cluster.isMaster) {
    //测试代码
    const worker = cluster.fork();
    // paramsms结构定义
    const defaultSettings = { 
        needLoadLinkDir: ["comm", "mmcomm", "platform"],
        ignoreFileAndDir: [
            "^[.~]{1,1}.{1,128}$",
            "^.*_tools_pb\\.(cpp|h)$",
            "^.*testimpl_pb\\.(cpp|h)$",
            "^.*\\.pb\\.(cc|h)$",
            "^(sk_|sm_)[a-z0-9_.]{1,128}$",
            "^mm3rd$",
            "^lib32$",
            "^lib64$",
            "^lib64_debug$",
            "^lib64_release$",
            "^lib32_debug$",
            "^lib32_release$",
            "^debug$",
            "^release$",
            "^win32$",
            "^bin$"
        ]
    };
    let parasms = {
            msg_type: 2,//0:表示全量加载；1:表示重新加载指定文件，此时data中需要有filepath；2：强制重新加载文件；3：强制重新加载所有的索引；4:重新加载一批文件
            data: {
                basepath: "/Users/widyhu/widyhu/cpp_project/",
                dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db",
                filepath: '/mmpay/mmpaymchmgr/mmpaymchproduct/mmpaymchproductaosvr/logic/MerchantProduct.cpp',
                // filepaths: ['xxxxxxxx',
                //             'xxxxxxxx'],
                issystem: 0,//工具-系统目录分析
                userConfig: defaultSettings
            }
    }
    worker.send(parasms);
    worker.on('message', (data) => {
        let value = data['process'];
        if (data.function == "source" || data.function == "include") {
            logger.debug("当前进度：%s, %f%，总共：%d，当前：%d",data.function, value["showprocess"], value["totalNum"], value["index"]);
            return;
        }
        if(data.function == "scan_ing") {
            // logger.debug("当前加载目录：", data.extdata);
            return;
        }

        if (data.function == "error") {
            //报错，执行未完成
            worker.kill();
            return;
        }

        if (data.function == "over") {
            //任务完成关闭子进程
            worker.kill();
            return;
        }
    });
} else if (cluster.isWorker) {
    //用户配置
    let userConfig = {};
    let maker = null;
    let needStop = false;

    function updateProcess(totalNum, i, showprocess, func = "rebuild", extdata = "") {
        //向主线线程发送数据
        let message = { 
            "function": func, 
            "process": { 
                'totalNum': totalNum, 
                'index': i, 
                "showprocess": showprocess
            },
            extdata: extdata
        }
        try{
            process.send(message);
        }catch(error){
            logger.debug(error);
            logger.debug(message);
        }
    };

    function reloadAllFile(basedir, dbpath, resolve, issystem = 0) {
        maker = new RebuildFileIndex(basedir, dbpath, issystem);
        maker.setUserConfig(userConfig);
        maker.rebuildIncludeTree(updateProcess, ()=>{
            resolve();
            maker.disconstructor();
        });
    };

    function forkReloadAllFile(basedir, dbpath, resolve, issystem = 0) {
        maker = new RebuildFileIndex(basedir, dbpath, issystem);
        maker.setUserConfig(userConfig);
        maker.forkRebuildIncludeTree(updateProcess, ()=>{
            resolve();
            maker.disconstructor();
        });
    };

    function reloadSiglIncludeFile(basedir, filepath, dbpath, issystem = 0) {
        maker = new RebuildFileIndex(basedir, dbpath, issystem);
        maker.setUserConfig(userConfig);
        maker.reloadKeywordBySignleFile(filepath);
        maker.disconstructor();
    };

    function forkReloadSiglIncludeFile(basedir, filepath, dbpath, issystem = 0) {
        maker = new RebuildFileIndex(basedir, dbpath, issystem);
        maker.setUserConfig(userConfig);
        maker.forkReloadKeywordBySignleFile(filepath);
        maker.disconstructor();
    };

    function batchReloadIncludeFiles(basedir, filepaths, dbpath, resolve, issystem = 0) {
        
        maker = new RebuildFileIndex(basedir, dbpath, issystem);
        maker.setUserConfig(userConfig);
        maker.batchReloadFiles(filepaths, updateProcess, ()=>{
            resolve();
            maker.disconstructor();
        });
    };

    onMessage = function(parasms) {
        if (parasms === 'shutdown') {
            //让所有进程优雅地关闭。
            if(maker != null) {
                //退出worker
                maker.shutdown();
                return;
            }
            return;
        }
        
        //参数校验
        if (parasms['msg_type'] === undefined
            || !parasms['data']['basepath']
            || !parasms['data']['dbpath']) {
            logger.debug("input parasms error!", parasms);
            let message = { "function": "error" };
            message['msg'] = "input parasms error!";
            process.send(JSON.stringify(message));
            return;
        }

        let issystem = 0;
        if (parasms['data']['issystem']) {
            issystem = parasms['data']['issystem'];
        }
        let msg_type = parasms.msg_type;
        let basepath = parasms.data.basepath;
        let dbpath = parasms.data.dbpath;
        
        if(parasms['data']['userConfig']) {
            userConfig = parasms['data']['userConfig'];
        }

        if (msg_type == 0) {
            //全量扫码目录并重新加载索引
            reloadAllFile(basepath, dbpath,()=>{
                logger.debug("analyse over and exit!");
                let message = {"function": "over"};
                process.send(message);
            }, issystem);
            return;
        }

        if (msg_type == 1) {
            //加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                let message = { "function": "error" };
                message['msg'] = "filepath not find!";
                process.send(message);
                return;
            }
            let filepath = parasms.data.filepath;
            reloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            let message = { "function": "over" };
            process.send(message);
            return;
        }

        if (msg_type == 2) {
            //强制加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                let message = { "function": "error" };
                message['msg'] = "filepath not find!";
                process.send(message);
                return;
            }
            let filepath = parasms.data.filepath;
            forkReloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            let message = { "function": "over" };
            process.send(message);
            return;
        }

        if (msg_type == 3) {
            //全量扫码目录并重新加载索引
            forkReloadAllFile(basepath, dbpath, ()=>{
                logger.debug("analyse over and exit!");
                let message = {"function": "over"};
                process.send(message);
            }, issystem);
            return;
        }

        if (msg_type == 4) {
            //全量扫码目录并重新加载索引
            let filepaths = parasms.data.filepaths;
            batchReloadIncludeFiles(basepath, filepaths, dbpath, ()=>{
                logger.debug("analyse over and exit!");
                let message = {"function": "over"};
                process.send(message);
            }, issystem);
            return;
        }

        let message = { "function": "error" };
        message['msg'] = "type error!" + msg_type;
        process.send(message);
    };

    process.on('message', (parasms) => {
        logger.debug("onmessage", JSON.stringify(parasms));
        onMessage(parasms);
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

