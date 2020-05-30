
const CodeAnalyse = require('./src/codeAnalyse').CodeAnalyse;
const fs = require('fs');
const crypto = require('crypto');
const FileIndexStore = require('./src/store/store').FileIndexStore;
const KeyWordStore = require('./src/store/store').KeyWordStore;
const Store = require('./src/store/store').Store;
const Traverse = require('./src/traversedir/traverse').Traverse;
const Completion = require('./src/completion/completion').Completion;
let basedir = "/Users/widyhu/widyhu/cpp_project/";
const path = require('path');

// const os = require('os');
// console.log(os.arch());
// console.log(os.platform());
// console.log(process.versions.node);
// return;


filename = "xxxxx.proto";

//测试归属找提示
// 301 30
let line = 301;
let cpos = 30;
filename = "src/syncmchinfo.cpp";
let fd = fs.openSync(basedir + filename, 'r');
const buffer = Buffer.alloc(1024 * 1024);
let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024);
let context = buffer.toString('utf8', 0, bytesRead);

let pos = -1;
let nowline = 0;
let linecode = "";
while (true) {
    let tmppos = context.indexOf("\n", pos + 1);
    if (tmppos == -1) {
        //找完了
        break;
    }
    if (nowline == line) {
        //找到行
        linecode = context.slice(pos + 1, pos + 1 + cpos);
        break;
    }
    pos = tmppos;
    nowline++;
};

function testCloseMark(str, left, right)
{
    let stack = [];
    for(let i = 0; i < str.length; i++) {
        if(str[i] == left) {
            stack.push(left);
            continue;
        }
        if(str[i] == right) {
            if(stack.length <= 0) {
                //不匹配
                return false;
            }
            stack.pop();
        }
    }

    if(stack.length != 0) {
        return false;
    }
    return true;
}

console.log(linecode + "|");
let autoFillReg = /\([\s]{0,4}(([a-z0-9_\(\)\[\].: \->]{1,128},){0,10})[\s\t]{0,10} $/ig;
let data = autoFillReg.exec(linecode);
let params = "";
if(data) {
    params = data[1];
    //测试圆括号是否匹配
    console.log(testCloseMark(params, '(', ')'));
}



function succcallbackloadcpp(){
    let ipos = pos + cpos;
    let ipo2 = ipos;
    while (true) {
        if ((context[ipo2] >= 'a' && context[ipo2] <= 'z')
            || (context[ipo2] >= 'A' && context[ipo2] <= 'Z')
            || (context[ipo2] >= '0' && context[ipo2] <= '9')
            || context[ipo2] == '_') {
            ipo2++;
            continue;
        }
        break;
    }

    let precontext = context.substr(0, ipos);
    let lineendpos = context.indexOf('\n', ipos);
    let precontext2 = context.substr(0, ipo2);;
    let linelast = "";
    if (lineendpos == -1) {
        linelast = context.substr(ipos);
    } else {
        linelast = context.substring(ipo2, lineendpos);
    }

    //let d = CodeAnalyse.getInstace().getAllNameByNamespace(filename, precontext, []);
    //let d = CodeAnalyse.getInstace().getSignatureHelp(filename, precontext, []);
    // let d = CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, []);
    //let d = CodeAnalyse.getInstace().getIncludeDefine(filename, "mmpay/mmpaymchmgr/mmpaymchproduct/mmpaymchproductdaosvr/mmpaymchproductdaosvrclient.h");
    let d = CodeAnalyse.getInstace().getDefinePoint(filename, precontext2, linelast, []);
    //let d = CodeAnalyse.getInstace().searchKeyWord(filename, "mmpaymchmerchantofflinedaosvr::MERCHANT_EV", precontext);
    //let d = CodeAnalyse.getInstace().autoFillParams(filename, precontext, params);
    console.log(d);
}

function succcallbackloadindex(msg, a, b, c) {
    console.log("当前进度：%f%，总共：%d，当前：%d", a, b, c);
    //CodeAnalyse.getInstace().getDependentByCpp(filename, succcallbackloadcpp);
}

CodeAnalyse.getInstace().init({ 
    basedir: basedir,
    extpath: "/Users/widyhu/widyhu/cpptips",
    // dbpath: "/Users/widyhu/widyhu/yundb/db/cpptips.db",
    dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/db/cpptips.db", 
    showsql: 1
});

CodeAnalyse.getInstace().getDependentByCpp(filename, succcallbackloadcpp);
//CodeAnalyse.getInstace().reloadAllIncludeFile(succcallbackloadindex);

