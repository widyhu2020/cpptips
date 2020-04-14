
const CodeAnalyse = require('./src/codeAnalyse').CodeAnalyse;
const fs = require('fs');
const crypto = require('crypto');
const FileIndexStore = require('./src/store/store').FileIndexStore;
const KeyWordStore = require('./src/store/store').KeyWordStore;
const Store = require('./src/store/store').Store;
const Traverse = require('./src/traversedir/traverse').Traverse;
const Completion = require('./src/completion/completion').Completion;
let basedir = "/Users/widyhu/widyhu/cpp_project/";


// const os = require('os');
// console.log(os.arch());
// console.log(os.platform());
// console.log(process.versions.node);
// return;



//filename = "/appplatform/export_include/c2cplatform/library/the3/svrkit_api_co/comm2_core/utils/iPriorityQueue_Heap.h";
filename = "/mmpay/mmpaymchmgr/mmpaymchmgrmerchant/mmpaymchmgrmerchantdaosvr/mmpaymchmgrmerchantdaosvr.proto";

//测试归属找提示
//706 59
let line = 706;
let cpos = 59;
filename = "/mmpay/mmpaymchmgr/mmpaymchproduct/mmpaymchproductaosvr/logic/merchant_product_fsm/productauthoritystatemachine.cpp";
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
        linelast = context.substr(ipos, lineendpos);
    }
    //let d = CodeAnalyse.getInstace().getAllNameByNamespace(filename, precontext, []);
    //let d = CodeAnalyse.getInstace().getSignatureHelp(filename, precontext, []);
    //let d = CodeAnalyse.getInstace().getAllNameByObj(filename, precontext, []);
    let d = CodeAnalyse.getInstace().getDefinePoint(filename, precontext2, linelast, []);
    //let d = CodeAnalyse.getInstace().searchKeyWord(filename, "mmpaymchmerchantofflinedaosvr::MERCHANT_EV", precontext);
    console.log(d);
}

function succcallbackloadindex(msg, a, b, c) {
    console.log("当前进度：%f%，总共：%d，当前：%d", a, b, c);
    CodeAnalyse.getInstace().getDependentByCpp(filename, succcallbackloadcpp);
}

CodeAnalyse.getInstace().init({ 
    basedir: basedir,
    extpath: "/Users/widyhu/widyhu/cpptips",
    dbpath: "/Users/widyhu/widyhu/cpp_project/.vscode/.db/.cpptips.db", 
    showsql: 1
});

CodeAnalyse.getInstace().getDependentByCpp(filename, succcallbackloadcpp);
//CodeAnalyse.getInstace().reloadAllIncludeFile(succcallbackloadindex);

