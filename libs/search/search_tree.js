/* --------------------------------------------------------------------------------------------
 * unzipSystemIncludeWorker.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
//暂时废弃
var Queue = require('../analyse/queue');
var Analyse = require('../analyse/analyseCpp');
var SearchTree = /** @class */ (function () {
    function SearchTree(tree) {
        if (tree === void 0) { tree = null; }
        this.newPropertyForObject = function (obj, filed, subfiled, value) {
            if (!obj[filed]) {
                obj[filed] = {};
            }
            obj[filed][subfiled] = value;
            return value;
        };
        this.checkStrPropertyIsEmpty = function (obj, filed) {
            if (!obj[filed]) {
                return true;
            }
            if (obj[filed] == "") {
                return true;
            }
            return false;
        };
        this.makeSearchTree = function (str, type) {
            var lowerstr = str;
            lowerstr = lowerstr.toLocaleLowerCase();
            var pnode = this.searchtree;
            for (var i = 0; i < lowerstr.length; i++) {
                var char = lowerstr[i];
                //if (!pnode['n'] || (pnode['n'] && !pnode['n'][char])) {
                if (!pnode['n'] || (pnode['n'] && !pnode['n'][char])) {
                    var nodenleng = !pnode['n'] ? 0 : Object.keys(pnode['n']).length;
                    //如果没有子节点，且之前没有预留的字符
                    if (nodenleng == 0 && this.checkStrPropertyIsEmpty(pnode, 'l')) {
                        this.newPropertyForObject(pnode, 'n', char, this.newNode());
                        //pnode['n'][char] = this.newNode();
                        pnode = pnode['n'][char];
                        if (i + 1 < lowerstr.length) {
                            //console.log("xxx1", i + 1, lowerstr.length);
                            pnode['l'] = lowerstr.substr(i + 1);
                        }
                        pnode['s'] = str;
                        pnode['t'] = type;
                        break;
                    }
                    //如果没有子节点，且之前有预留字段
                    if (nodenleng == 0 && pnode['l'] && pnode['l'] != "") {
                        //找到相同的前缀
                        var oldstr = pnode['s'];
                        var oldlstr = pnode['l'];
                        var oldtype = pnode['t'];
                        var newlstr = lowerstr.substr(i);
                        var index = 0;
                        for (var i_1 = 0; i_1 < oldlstr.length && i_1 < newlstr.length; i_1++) {
                            if (oldlstr[i_1] == newlstr[i_1]) {
                                index++;
                                continue;
                            }
                            break;
                        }
                        var npnode = pnode;
                        for (var i_2 = 0; i_2 < index; i_2++) {
                            //创建节点
                            this.newPropertyForObject(npnode, 'n', oldlstr[i_2], this.newNode());
                            npnode = npnode['n'][oldlstr[i_2]];
                        }
                        //处理旧串
                        delete pnode['l'];
                        delete pnode['s'];
                        delete pnode['t'];
                        if (index < oldlstr.length) {
                            var tmpObj_1 = this.newPropertyForObject(npnode, 'n', oldlstr[index], this.newNode());
                            tmpObj_1['s'] = oldstr;
                            tmpObj_1['t'] = oldtype;
                            if (index + 1 < oldlstr.length) {
                                //console.log("xxx2", index + 1 , oldlstr.length);
                                tmpObj_1['l'] = oldlstr.substr(index + 1);
                            }
                        }
                        else {
                            npnode['s'] = oldstr;
                            npnode['t'] = oldtype;
                        }
                        //处理新串
                        if (index < newlstr.length) {
                            var tmpObj_2 = this.newPropertyForObject(npnode, 'n', newlstr[index], this.newNode());
                            tmpObj_2['s'] = str;
                            tmpObj_2['t'] = type;
                            if (index + 1 < newlstr.length) {
                                //console.log("xxx3", index + 1, newlstr.length);
                                tmpObj_2['l'] = newlstr.substr(index + 1);
                            }
                            pnode = tmpObj_2;
                        }
                        else {
                            npnode['s'] = str;
                            npnode['t'] = type;
                            pnode = npnode;
                        }
                        break;
                    }
                    //有子，但是没有相同的字符，则新增节点
                    var tmpObj = this.newPropertyForObject(pnode, 'n', char, this.newNode());
                    if (i + 1 < lowerstr.length) {
                        //console.log("xxx3", i + 1 , lowerstr.length);
                        tmpObj['l'] = lowerstr.substr(i + 1);
                    }
                    tmpObj['s'] = str;
                    tmpObj['t'] = type;
                    pnode = tmpObj;
                    break;
                }
                pnode = pnode['n'][char];
            }
            pnode['s'] = str;
            pnode['t'] = type;
            return this.searchtree;
        };
        this.initByjson = function (params) {
            var jsontree = JSON.parse(params);
            var keys = Object.keys(jsontree);
            this.searchtree = jsontree[keys[0]];
        };
        this.setNameMap = function (mapData) {
            this.searchtree.m = mapData;
        };
        this.setSoureObj = function (source) {
            this.searchtree.f = source;
        };
        this.getAllNameByObj = function (classname) {
            if (!this.searchtree.m[classname]) {
                //类不存在
                return [];
            }
            var fullname = this.searchtree.m[classname];
            //console.log("get fullname", fullname);
            return this.searchtree.f['callback'](this.searchtree.f, fullname);
        };
        this.search = function (keyword, owns, searchleng) {
            if (searchleng === void 0) { searchleng = 50; }
            keyword = keyword.toLocaleLowerCase();
            var pnode = this.searchtree;
            var treepath = [];
            //console.time("find_begin");
            for (var i = 0; i < keyword.length; i++) {
                var char = keyword[i];
                if (pnode.n && pnode.n[char]) {
                    treepath.push(char);
                    pnode = pnode.n[char];
                }
                else {
                    //查找失败
                    return false;
                }
            }
            //console.timeEnd("find_begin");
            //该节点为根节点，接下来的都能匹配上
            console.time("getNodePath");
            var result = this.getNodePath(pnode, owns, searchleng);
            console.timeEnd("getNodePath");
            return result;
        };
        this.checkInOwn = function (findname, owns) {
            var namemap = this.namemap;
            //console.log(owns);
            if (!namemap[findname]) {
                //没有名字映射，直接返回丢弃
                //console.log("not find name map",findname);
                return false;
            }
            for (var i = 0; i < namemap[findname].length; i++) {
                var nmap = namemap[findname][i];
                var fname = nmap['v'];
                if (owns.has(fname)) {
                    //找到,名字是命名空间
                    return nmap;
                }
                var needcheckname = [];
                for (var j = 0; j < fname.length; j++) {
                    if (fname[j] == ':') {
                        if (owns.has(needcheckname.join(''))) {
                            //找到
                            return nmap;
                        }
                        if (j + 1 < fname.length && fname[j + 1] == ':') {
                            //结下来的如果也行：，则直接加入
                            needcheckname.push(':');
                            j++;
                        }
                    }
                    needcheckname.push(fname[j]);
                }
            }
            return false;
        };
        this.getNodePath = function (node, owns, searchleng) {
            if (searchleng === void 0) { searchleng = 50; }
            var path = [];
            var queue = new Queue();
            queue.enqueue({ 'node': node, "pre": "", "depth": 0 });
            var currnode = queue.dequeue();
            var processNum = 0;
            while (currnode) {
                processNum++;
                //console.time("find_node");
                var keys = currnode['node'].n ? Object.keys(currnode['node'].n) : [];
                if (keys.length == 0) {
                    //到了叶子节点
                    var resultstr = currnode['node'].s;
                    var type = currnode['node'].t;
                    var checkresult = this.checkInOwn(resultstr, owns);
                    if (checkresult != false) {
                        path.push({
                            "s": resultstr,
                            "t": type,
                            "f": checkresult['f'],
                            "n": checkresult['v']
                        });
                    }
                    currnode = queue.dequeue();
                    //console.timeEnd("find_node");
                    continue;
                }
                if (currnode['node'].s && currnode['node'].s != "") {
                    //节点存在数据挂载，加入数组
                    var resultstr = currnode['node'].s;
                    var type = currnode['node'].t;
                    var checkresult = this.checkInOwn(resultstr, owns);
                    if (checkresult != false) {
                        path.push({
                            "s": resultstr,
                            "t": type,
                            "f": checkresult['f'],
                            "n": checkresult['v']
                        });
                    }
                }
                //入栈子节点
                for (var i = 0; i < keys.length; i++) {
                    // console.log("xxxx", currnode['node'].n[keys[i]], keys[i], keys);
                    queue.enqueue({ "node": currnode['node'].n[keys[i]], "pre": currnode['pre'] + keys[i], "depth": currnode['depth'] + 1 });
                }
                if (path.length > searchleng) {
                    //搜索结构大于50的时候终止继续进行
                    //console.timeEnd("find_node");
                    break;
                }
                currnode = queue.dequeue();
                //console.timeEnd("find_node");
            }
            //console.log("process times:", processNum);
            return path;
        };
        this.newNode = function () {
            return {
            //          "d": [],
            //           's': "",
            //           't': 0,
            //           'l': "",//未匹配完的数据
            //           "n": {},//查找节点路径
            //           'm': {},//名字到全名映射
            //            'f': {},//来源的源头对象
            };
        };
        if (tree == null) {
            this.searchtree = this.newNode();
        }
        else {
            this.searchtree = tree;
        }
        this.namemap = null;
    }
    ;
    return SearchTree;
}());
;
module.exports = {
    SearchTree: SearchTree
};
