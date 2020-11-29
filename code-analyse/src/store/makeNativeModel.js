/* --------------------------------------------------------------------------------------------
 * makeNativeModel.js
 *
 *  Created on: 2020年4月18日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */
const path = require('path');
const os = require('os');

//获取操作系统和cpu类型
function getSystemAndCpu(){
   let binPath = "";
   let systemname = process.platform;
   if(systemname == "linux") {
      binPath = "../../bin/node-v12.16.1-linux-x64/node";
  } else if(systemname == "darwin") {
      binPath = "../../bin/node-v12.16.1-darwin-x64/node";
  } else if(systemname == "win32"){
      console.log(process.arch);
      if(process.arch == "ia32" || process.arch == "x86"){
         binPath = path.join("..",'..','bin','node-v12.16.1-win-x86','node.exe'); 
      } else {
         binPath = path.join('..','..','bin','node-v12.16.1-win-x64','node.exe');
      }
  }  else {
   binPath = "node";
  }
  return binPath;
}

//重新编译原生模块
function _rebuildNatveModel(){
   try{
	   const Database = require('better-sqlite3');
   } catch(error){
      //better-sqlite3
      let childprocess = require('child_process');

      let binPath = getSystemAndCpu();
      let scriptpath = __dirname;
      let goPan = "";
      if(process.platform == "win32"){
         //windows操作系统
         let pathinfo = path.parse(scriptpath);
         goPan = pathinfo.root.replace("\\", "") + "&&";
      }
      scriptpath = path.resolve(scriptpath, path.join('..','..','node_modules','better-sqlite3'));
      let configure = `${binPath} ` + path.join('..','node-gyp','bin','node-gyp.js') +' configure';
      let build = `${binPath} ` + path.join('..','node-gyp','bin','node-gyp.js')+' build';
      let cmd = `${goPan}cd ${scriptpath}&&${configure}&&${build}`;
      console.log(cmd);
      let result = childprocess.execSync(cmd, {encoding: "utf8"});
      console.log(result);

      //编译integer
      scriptpath = __dirname;
      scriptpath = path.resolve(scriptpath, path.join('..','..','node_modules','integer'));
      configure = `${binPath} ` + path.join('..','node-gyp','bin','node-gyp.js') + "  configure";
      build = `${binPath} ` + path.join('..','node-gyp','bin','node-gyp.js') +' build';
      cmd = `${goPan}cd ${scriptpath}&&${configure}&&${build}`;
      console.log(cmd);
      result = childprocess.execSync(cmd, {encoding: "utf8"});
      console.log(result);
   }
};

//尝试加载原生数据库
_rebuildNatveModel();

class NativeForTestValid {
	//空方法
	//该文件只是为了测试原生模块能否使用
}
module.exports = {
   NativeForTestValid
};