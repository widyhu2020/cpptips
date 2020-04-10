var _a = require('worker_threads'), Worker = _a.Worker, isMainThread = _a.isMainThread, parentPort = _a.parentPort, workerData = _a.workerData, SHARE_ENV = _a.SHARE_ENV, MessageChannel = _a.MessageChannel;
var Analyse = require('../analyse/analyse');
var Store = require('../store/store');
var MakeSearchTreeWorkere = /** @class */ (function () {
    function MakeSearchTreeWorkere(basedir) {
        this.lodadTreeDb = function (dbname) {
            this.store = new Store.Store(this.fileAnalyseDB);
        };
        this.closeTreeDb = function () {
            this.store.close();
        };
        this.makeSearchTreeFromDb = function () {
            //加载数据库
            this.lodadTreeDb();
            console.time("get");
            var searchtreejson = this.store.get(this.all_build_index);
            console.timeEnd("get");
            //关闭数据库
            this.closeTreeDb();
            console.time("parse");
            this.searchTree = Analyse.makeSearchTreeFromJson(searchtreejson);
            console.timeEnd("parse");
            return this.searchTree;
        };
        this.store = null;
        this.basedir = basedir;
        this.searchTree = null;
        this.indexpath = basedir + ".index";
        //语法树存储
        this.fileAnalyseDB = this.indexpath + '/tree.db';
        this.all_build_index = "all_build_index";
    }
    return MakeSearchTreeWorkere;
}());
;
if (isMainThread) {
    //主函数为测试代码
    var worker = new Worker(__filename, { env: SHARE_ENV });
    var subChannel = new MessageChannel();
    worker.postMessage({ port: subChannel.port1, basedir: "/Users/widyhu/workspace/cpp_project/" }, [subChannel.port1]);
    subChannel.port2.on('message', function (value) {
        console.log('接收到:', value);
    });
    worker.on("exit", function (extcode) {
        console.log("run over");
    });
    console.log("lasrer");
}
else {
    parentPort.once('message', function (parasms) {
        //子线程
        console.log(parasms.basedir);
        //创建索引
        console.time("MakeSearchTreeWorkere");
        var maker = new MakeSearchTreeWorkere(parasms.basedir);
        var searchTree = maker.makeSearchTreeFromDb();
        console.timeEnd("MakeSearchTreeWorkere");
        //向主线线程发送数据
        console.time("postMessage");
        parasms.port.postMessage(searchTree.searchtree);
        console.timeEnd("postMessage");
        parasms.port.close();
    });
}
