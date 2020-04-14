/* --------------------------------------------------------------------------------------------
 * unzipSystemIncludeWorker.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */
//暂时废弃
const Queue = require('../analyse/queue');
const Analyse = require('../analyse/analyseCpp');

class SearchTree {
    constructor(tree = null) {
        if (tree == null) {
            this.searchtree = this.newNode();
        } else {
            this.searchtree = tree;
        }
        this.namemap = null;
    };

    newPropertyForObject = function(obj, filed, subfiled, value) {
        if (!obj[filed]) {
            obj[filed] = {};
        }
        obj[filed][subfiled] = value;
        return value;
    };

    checkStrPropertyIsEmpty = function(obj, filed) {
        if(!obj[filed]) {
            return true;
        }
        if (obj[filed] == "") {
            return true;
        }
        return false;
    };


    makeSearchTree = function(str, type) {
        let lowerstr = str;
        lowerstr = lowerstr.toLocaleLowerCase();
        let pnode = this.searchtree;
        for (let i = 0; i < lowerstr.length; i++) {
            let char = lowerstr[i];

            //if (!pnode['n'] || (pnode['n'] && !pnode['n'][char])) {
            if (!pnode['n'] || (pnode['n'] && !pnode['n'][char])) {
                let nodenleng = !pnode['n'] ? 0 : Object.keys(pnode['n']).length;
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
                    let oldstr = pnode['s'];
                    let oldlstr = pnode['l'];
                    let oldtype = pnode['t'];
                    let newlstr = lowerstr.substr(i);
                    let index = 0;
                    for (let i = 0; i < oldlstr.length && i < newlstr.length; i++) {
                        if (oldlstr[i] == newlstr[i]) {
                            index++;
                            continue;
                        }
                        break;
                    }

                    let npnode = pnode;
                    for(let i = 0; i < index; i++) {
                        //创建节点
                        this.newPropertyForObject(npnode, 'n', oldlstr[i], this.newNode());
                        npnode = npnode['n'][oldlstr[i]];
                    }
                    
                    //处理旧串
                    delete pnode['l'];
                    delete pnode['s'];
                    delete pnode['t'];
                    if (index < oldlstr.length) {
                        let tmpObj = this.newPropertyForObject(npnode, 'n', oldlstr[index], this.newNode());
                        tmpObj['s'] = oldstr;
                        tmpObj['t'] = oldtype;
                        if (index + 1 < oldlstr.length) {
                            //console.log("xxx2", index + 1 , oldlstr.length);
                            tmpObj['l'] = oldlstr.substr(index + 1);
                        }
                    } else {
                        npnode['s'] = oldstr;
                        npnode['t'] = oldtype;
                    }

                    //处理新串
                    if (index < newlstr.length) {
                        let tmpObj = this.newPropertyForObject(npnode, 'n', newlstr[index], this.newNode());
                        tmpObj['s'] = str;
                        tmpObj['t'] = type;
                        if (index + 1 < newlstr.length) {
                            //console.log("xxx3", index + 1, newlstr.length);
                            tmpObj['l'] = newlstr.substr(index + 1);
                        }
                        pnode = tmpObj;
                    } else {
                        npnode['s'] = str;
                        npnode['t'] = type;
                        pnode = npnode;
                    }
                    break;
                }

                //有子，但是没有相同的字符，则新增节点
                let tmpObj = this.newPropertyForObject(pnode, 'n', char, this.newNode());
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

    initByjson = function(params) {
        let jsontree = JSON.parse(params);
        let keys = Object.keys(jsontree);
        this.searchtree = jsontree[keys[0]];
    };

    setNameMap = function(mapData) {
        this.searchtree.m = mapData;
    };

    setSoureObj = function(source) {
        this.searchtree.f = source;
    };

    getAllNameByObj = function(classname) {
        if (!this.searchtree.m[classname]){
            //类不存在
            return [];
        }

        let fullname = this.searchtree.m[classname];
        //console.log("get fullname", fullname);
        return this.searchtree.f['callback'](this.searchtree.f, fullname);
    };

    search = function (keyword, owns, searchleng = 50) {
        keyword = keyword.toLocaleLowerCase();
        let pnode = this.searchtree;
        let treepath = [];
        //console.time("find_begin");
        for (let i = 0; i < keyword.length; i++) {
            let char = keyword[i];
            if (pnode.n && pnode.n[char]) {
                treepath.push(char);
                pnode = pnode.n[char];
            } else {
                //查找失败
                return false;
            }
        }
        //console.timeEnd("find_begin");

        //该节点为根节点，接下来的都能匹配上
        console.time("getNodePath");
        let result = this.getNodePath(pnode, owns, searchleng);
        console.timeEnd("getNodePath");
        return result;
    };

    checkInOwn = function (findname, owns) {
        let namemap = this.namemap;
        //console.log(owns);
        if (!namemap[findname]) {
            //没有名字映射，直接返回丢弃
            //console.log("not find name map",findname);
            return false;
        }

        for (let i = 0; i < namemap[findname].length; i++) {
            let nmap = namemap[findname][i];
            let fname = nmap['v'];
            if (owns.has(fname)) {
                //找到,名字是命名空间
                return nmap;
            }

            let needcheckname = [];
            for (let j = 0; j < fname.length; j++) {
                if(fname[j] == ':') {
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

    getNodePath = function (node, owns, searchleng = 50) {
        let path = [];
        let queue = new Queue();
        queue.enqueue({'node' : node, "pre" : "", "depth" : 0});
        let currnode = queue.dequeue();
        let processNum = 0;
        while (currnode) {
            processNum++;
            //console.time("find_node");
            let keys = currnode['node'].n ? Object.keys(currnode['node'].n) : [];
            if (keys.length == 0) {
                //到了叶子节点
                let resultstr = currnode['node'].s;
                let type = currnode['node'].t;
                let checkresult = this.checkInOwn(resultstr, owns);
                if (checkresult != false){
                    path.push({
                        "s": resultstr,
                        "t": type,
                        "f": checkresult['f'],
                        "n": checkresult['v']});
                }
                
                currnode = queue.dequeue();
                //console.timeEnd("find_node");
                continue;
            }

            if (currnode['node'].s && currnode['node'].s != "") {
                //节点存在数据挂载，加入数组
                let resultstr = currnode['node'].s;
                let type = currnode['node'].t;
                let checkresult = this.checkInOwn(resultstr, owns);
                if (checkresult != false) {
                    path.push({
                        "s": resultstr,
                        "t": type, 
                        "f": checkresult['f'],
                        "n": checkresult['v']});
                }
            }
            
            //入栈子节点
            for (let i = 0; i < keys.length; i++) {
                // console.log("xxxx", currnode['node'].n[keys[i]], keys[i], keys);
                queue.enqueue({ "node": currnode['node'].n[keys[i]], "pre": currnode['pre'] + keys[i], "depth": currnode['depth'] + 1});
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

    newNode = function(){
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
};

module.exports = {
    SearchTree: SearchTree
};