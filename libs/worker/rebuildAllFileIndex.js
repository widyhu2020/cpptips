/* --------------------------------------------------------------------------------------------
 * rebuildAllFileIndex.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var cluster = require('cluster');
var RebuildFileIndex = require('../analyse/rebuildFileIndex').RebuildFileIndex;
var logger = require('log4js').getLogger("cpptips");
if (cluster.isMaster) {
    //测试代码
    var worker_1 = cluster.fork();
    // paramsms结构定义
    var defaultSettings = {
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
    var parasms = {
        msg_type: 2,
        data: {
            basepath: "/Users/widyhu/widyhu/cpp_project/",
            dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db",
            filepath: '/mmpay/mmpaymchmgr/mmpaymchproduct/mmpaymchproductaosvr/logic/MerchantProduct.cpp',
            // filepaths: ['xxxxxxxx',
            //             'xxxxxxxx'],
            issystem: 0,
            userConfig: defaultSettings
        }
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        var value = data['process'];
        if (data.function == "source" || data.function == "include") {
            logger.debug("当前进度：%s, %f%，总共：%d，当前：%d", data.function, value["showprocess"], value["totalNum"], value["index"]);
            return;
        }
        if (data.function == "scan_ing") {
            // logger.debug("当前加载目录：", data.extdata);
            return;
        }
        if (data.function == "error") {
            //报错，执行未完成
            worker_1.kill();
            return;
        }
        if (data.function == "over") {
            //任务完成关闭子进程
            worker_1.kill();
            return;
        }
    });
}
else if (cluster.isWorker) {
    //用户配置
    var userConfig_1 = {};
    var maker_1 = null;
    var needStop = false;
    function updateProcess(totalNum, i, showprocess, func, extdata) {
        if (func === void 0) { func = "rebuild"; }
        if (extdata === void 0) { extdata = ""; }
        //向主线线程发送数据
        var message = {
            "function": func,
            "process": {
                'totalNum': totalNum,
                'index': i,
                "showprocess": showprocess
            },
            extdata: extdata
        };
        try {
            process.send(message);
        }
        catch (error) {
            logger.debug(error);
            logger.debug(message);
        }
    }
    ;
    function reloadAllFile(basedir, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.rebuildIncludeTree(updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    function forkReloadAllFile(basedir, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.forkRebuildIncludeTree(updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    function reloadSiglIncludeFile(basedir, filepath, dbpath, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.reloadKeywordBySignleFile(filepath);
        maker_1.disconstructor();
    }
    ;
    function forkReloadSiglIncludeFile(basedir, filepath, dbpath, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.forkReloadKeywordBySignleFile(filepath);
        maker_1.disconstructor();
    }
    ;
    function batchReloadIncludeFiles(basedir, filepaths, dbpath, resolve, issystem) {
        if (issystem === void 0) { issystem = 0; }
        maker_1 = new RebuildFileIndex(basedir, dbpath, issystem);
        maker_1.setUserConfig(userConfig_1);
        maker_1.batchReloadFiles(filepaths, updateProcess, function () {
            resolve();
            maker_1.disconstructor();
        });
    }
    ;
    onMessage = function (parasms) {
        if (parasms === 'shutdown') {
            //让所有进程优雅地关闭。
            if (maker_1 != null) {
                //退出worker
                maker_1.shutdown();
                return;
            }
            return;
        }
        //参数校验
        if (parasms['msg_type'] === undefined
            || !parasms['data']['basepath']
            || !parasms['data']['dbpath']) {
            logger.debug("input parasms error!", parasms);
            var message_1 = { "function": "error" };
            message_1['msg'] = "input parasms error!";
            process.send(JSON.stringify(message_1));
            return;
        }
        var issystem = 0;
        if (parasms['data']['issystem']) {
            issystem = parasms['data']['issystem'];
        }
        var msg_type = parasms.msg_type;
        var basepath = parasms.data.basepath;
        var dbpath = parasms.data.dbpath;
        if (parasms['data']['userConfig']) {
            userConfig_1 = parasms['data']['userConfig'];
        }
        if (msg_type == 0) {
            //全量扫码目录并重新加载索引
            reloadAllFile(basepath, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        if (msg_type == 1) {
            //加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                var message_2 = { "function": "error" };
                message_2['msg'] = "filepath not find!";
                process.send(message_2);
                return;
            }
            var filepath = parasms.data.filepath;
            reloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            var message_3 = { "function": "over" };
            process.send(message_3);
            return;
        }
        if (msg_type == 2) {
            //强制加载单个文件
            if (!parasms.data.filepath) {
                logger.debug("input filepath error!");
                var message_4 = { "function": "error" };
                message_4['msg'] = "filepath not find!";
                process.send(message_4);
                return;
            }
            var filepath = parasms.data.filepath;
            forkReloadSiglIncludeFile(basepath, filepath, dbpath, issystem);
            var message_5 = { "function": "over" };
            process.send(message_5);
            return;
        }
        if (msg_type == 3) {
            //全量扫码目录并重新加载索引
            forkReloadAllFile(basepath, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        if (msg_type == 4) {
            //全量扫码目录并重新加载索引
            var filepaths = parasms.data.filepaths;
            batchReloadIncludeFiles(basepath, filepaths, dbpath, function () {
                logger.debug("analyse over and exit!");
                var message = { "function": "over" };
                process.send(message);
            }, issystem);
            return;
        }
        var message = { "function": "error" };
        message['msg'] = "type error!" + msg_type;
        process.send(message);
    };
    process.on('message', function (parasms) {
        logger.debug("onmessage", JSON.stringify(parasms));
        onMessage(parasms);
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
