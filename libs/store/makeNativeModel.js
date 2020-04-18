/* --------------------------------------------------------------------------------------------
 * store.js
 *
 *  Created on: 2020年4月18日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var os = require('os');
//重新编译原生模块
_rebuildNatveModel = function () {
    try {
        var Database = require('better-sqlite3');
    }
    catch (error) {
        //先看看包是否包含，如果包含则自动加载
        var autoRet = _rebuildNatveModelAuto();
        if (autoRet) {
            //自动已经选择到了原生二进制
            return;
        }
        //自动选择失败，在linux和darwin下尝试自己编译二进制
        //注意：windows因为依赖太多负载，自身编译不叫困难
        var systemname = process.platform;
        if (systemname == "linux") {
            //linux操作系统
            return _rebuildNatveModelLinux();
        }
        if (systemname == "darwin") {
            //linux操作系统
            return _rebuildNatveModelMaxOs();
        }
    }
};
_rebuildNatveModelAuto = function () {
    var path = require('path');
    var fs = require('fs');
    var scriptpath = __dirname;
    scriptpath = path.resolve(scriptpath, '../..');
    var modulesversion = process.versions.modules;
    var arch = process.arch;
    var platform = process.platform;
    var nativedir = platform + "-" + arch;
    var nativePath = scriptpath + "/data/" + nativedir + "/" + modulesversion;
    if (!fs.existsSync(nativePath)) {
        //没有该平台相关的编译文件
        console.error("not find this platform and arch native!nativedir: ", nativedir);
        //尝试去后台读取编译生成的文件
        //呵呵，这里没时间实现，欢迎有心人实现下
        return false;
    }
    //拷贝better_sqlite3.node文件
    var sourceFile = nativePath + "/better_sqlite3.node";
    var destFile = scriptpath + "/node_modules/better-sqlite3/build/Release/better_sqlite3.node";
    console.log("copy lib:", sourceFile, destFile);
    fs.copyFileSync(sourceFile, destFile);
    //拷贝integer
    sourceFile = nativePath + "/integer.node";
    destFile = scriptpath + "/node_modules/integer/build/Release/integer.node";
    console.log("copy lib:", sourceFile, destFile);
    fs.copyFileSync(sourceFile, destFile);
    return true;
};
_rebuildNatveModelMaxOs = function () {
    var path = require('path');
    var fs = require('fs');
    var scriptpath = __dirname;
    scriptpath = path.resolve(scriptpath, '../..');
    var electronVersion = process.versions.electron;
    if (!fs.existsSync(scriptpath + "/node_modules/.bin")) {
        //创建目录
        fs.mkdirSync(scriptpath + "/node_modules/.bin");
    }
    //将node-gyp拷贝过来
    if (!fs.existsSync(scriptpath + "/node_modules/.bin/node-gyp")) {
        //拷贝
        fs.copyFileSync(scriptpath + "/node_modules/node-gyp/bin/node-gyp.js", scriptpath + "/node_modules/.bin/node-gyp");
    }
    var childprocess = require('child_process');
    var buildcli = scriptpath + '/node_modules/electron-rebuild/lib/src/cli.js';
    var modelepath = scriptpath + '/node_modules/better-sqlite3';
    var params = [
        "-f",
        "-w",
        "better-sqlite3",
        '-v',
        electronVersion,
        '--module-dir',
        modelepath
    ];
    //./node_modules/.bin/electron-rebuild -f -w better-sqlite3 -v 7.1.11
    var result = childprocess.spawnSync(buildcli, params, { encoding: "utf8" });
    console.log(result);
    if (result.status == 0) {
        console.log("rebuild better-sqlite3 success!");
    }
};
_rebuildNatveModelLinux = function () {
    var path = require('path');
    var fs = require('fs');
    var execPath = process.execPath;
    var scriptpath = __dirname;
    scriptpath = path.resolve(scriptpath, '../../node_modules/better-sqlite3');
    var cmd = "cd " + scriptpath + " && " + execPath + " ../node-gyp/bin/node-gyp.js configure && " + execPath + " ../node-gyp/bin/node-gyp.js rebuild";
    scriptpath = path.resolve(scriptpath, '../integer');
    var cmd2 = "&& cd " + scriptpath + " && " + execPath + " ../node-gyp/bin/node-gyp.js configure && " + execPath + " ../node-gyp/bin/node-gyp.js rebuild";
    cmd = cmd + cmd2;
    var childprocess = require('child_process');
    console.log(cmd);
    var result = childprocess.execSync(cmd, { encoding: "utf8" });
    console.log(result);
};
//尝试加载原生数据库
_rebuildNatveModel();
var NativeForTestValid = /** @class */ (function () {
    function NativeForTestValid() {
    }
    return NativeForTestValid;
}());
module.exports = {
    NativeForTestValid: NativeForTestValid
};
