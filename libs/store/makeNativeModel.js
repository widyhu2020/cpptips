/* --------------------------------------------------------------------------------------------
 * makeNativeModel.js
 *
 *  Created on: 2020年4月18日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var path = require('path');
var os = require('os');
//获取操作系统和cpu类型
function getSystemAndCpu() {
    var binPath = "";
    var systemname = process.platform;
    if (systemname == "linux") {
        binPath = "../../bin/node-v12.16.1-linux-x64/node";
    }
    else if (systemname == "darwin") {
        binPath = "../../bin/node-v12.16.1-darwin-x64/node";
    }
    else if (systemname == "win32") {
        console.log(process.arch);
        if (process.arch == "ia32" || process.arch == "x86") {
            binPath = path.join("..", '..', 'bin', 'node-v12.16.1-win-x86', 'node.exe');
        }
        else {
            binPath = path.join('..', '..', 'bin', 'node-v12.16.1-win-x64', 'node.exe');
        }
    }
    else {
        binPath = "node";
    }
    return binPath;
}
//重新编译原生模块
function _rebuildNatveModel() {
    try {
        var Database = require('better-sqlite3');
    }
    catch (error) {
        //better-sqlite3
        var childprocess = require('child_process');
        var binPath = getSystemAndCpu();
        var scriptpath = __dirname;
        var goPan = "";
        if (process.platform == "win32") {
            //windows操作系统
            var pathinfo = path.parse(scriptpath);
            goPan = pathinfo.root.replace("\\", "") + "&&";
        }
        scriptpath = path.resolve(scriptpath, path.join('..', '..', 'node_modules', 'better-sqlite3'));
        var configure = binPath + " " + path.join('..', 'node-gyp', 'bin', 'node-gyp.js') + ' configure';
        var build = binPath + " " + path.join('..', 'node-gyp', 'bin', 'node-gyp.js') + ' build';
        var cmd = goPan + "cd " + scriptpath + "&&" + configure + "&&" + build;
        console.log(cmd);
        var result = childprocess.execSync(cmd, { encoding: "utf8" });
        console.log(result);
        //编译integer
        scriptpath = __dirname;
        scriptpath = path.resolve(scriptpath, path.join('..', '..', 'node_modules', 'integer'));
        configure = binPath + " " + path.join('..', 'node-gyp', 'bin', 'node-gyp.js') + "  configure";
        build = binPath + " " + path.join('..', 'node-gyp', 'bin', 'node-gyp.js') + ' build';
        cmd = goPan + "cd " + scriptpath + "&&" + configure + "&&" + build;
        console.log(cmd);
        result = childprocess.execSync(cmd, { encoding: "utf8" });
        console.log(result);
    }
}
;
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
