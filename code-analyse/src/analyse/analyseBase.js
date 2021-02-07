/* --------------------------------------------------------------------------------------------
 * analyseBase.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const { exit } = require('process');
const Tree = require('./tree');
const logger = require('log4js').getLogger("cpptips");
const fs = require('fs');

//分析所需要的关键字,不是c++全部关键字
let keywork = new Set([
    '#define', 'if', 'for' , 'int', 'int32_t', 'int64_t', '#include',
    'uint64_t', 'uint32_t', 'uint16_t', 'int16_t', 'uint8_t', 'const',
    'class', 'namespace', 'std::string', 'string', 'bool', 'inline',
    'std::bitset', 'std::map', 'void', 'return', 'static', "__extension__",
    'using____namespace', 'friend', '#ifdef', '#endif', 'do'
]);

var TypeEnum = {
    AIR_IN_FUNCTION: 0,
    NAMESPACE: 1,
    CALSS: 2,
    ENUM: 3,
    STRUCT: 4,
    INTERFACE: 5,
    VARIABLE: 6,
    FUNCTION: 7,
    DEFINE: 8,
    ENUMITEM: 9,
    TYPEDEF: 10
};

var ROOT_VALUE = 0
class AnalyseBase {
    constructor(filecontext, isprotobuf = false, filename = '') {
        this.point_domain = ROOT_VALUE;                 //默认指向根作用域
        this.tree = new Tree(ROOT_VALUE);               //构造等级树

        //文档内容
        this.context = filecontext;
        this.isprotobuf = isprotobuf;
        this.filename = filename;

        //取结果需要的
        this.filedb = null;
        this.keyworddb = null;

        //函数原定义
        this.methodDefine = {};
        this.newDefine = {};

        this.inDBData = [];
    };

    //执行分析，父类不实现
    doAnalyse = function(){};

    //获取结果，该结果直接存入db
    getResult = function (filedb, keyworddb, savepublic = false){
        //获取文件id
        this.filedb = filedb;
        this.keyworddb = keyworddb;
        this.savepublic = savepublic;

        let fileinfo = filedb.getFileByFilePath(this.filename);
        if (!fileinfo || fileinfo === undefined) {
            logger.debug("not find file index!", this.filename);
            return false;
        }
        let fileid = fileinfo.id;
        //初始化fileid
        this.keyworddb.saveFileToMemDB(fileid, this.filename);
        let beginIds = this.keyworddb.getIdsByFileId(fileid);

        //清空该文件所有的扩展数据,防止出现不修改名称的问题
        //keyworddb.cleanExtData(fileid);
        //变量所有区域
        let nameMap = {};
        this.tree.traverseBF((current) => {
            //获取当前的命名空间
            let _nameMap = this._saveAreaOwn(current, fileid);
            nameMap = Object.assign(nameMap, _nameMap);
        });
        
        //去掉无用的定义
        this._removeNoUserFunction();
        
        this.keyworddb.saveMemToDB(fileid, this.filename, beginIds);
        return nameMap;
    };

    //构造树结构体
    makeDefineTree = function(nameMap, result) {
        let ns = result.ns.split("::");
        let currentNode = nameMap;
        let _ns = [];
        for(let i = 0; i < ns.length; i++) {
            _ns.push(ns[i]);
            let isFind = false;
            for(let j = 0; j < currentNode.child.length; j++) {
                if(currentNode.child[j].ns == _ns.join("::")) {
                    //找到子
                    currentNode = currentNode.child[j];
                    isFind = true;
                }
            }
            if(!isFind && ns[i].length > 0) {
                //未找到则构造一个
                let _data = { ns: _ns.join("::") , name: ns[i], type: TypeEnum.NAMESPACE, child: [], function:  [], variable: [], defines: [] };;
                currentNode.child.push(_data);
                currentNode = _data;
            }
        }

        //加入到其子类中
        currentNode.child.push(result);
        //logger.debug(nameMap);
        return nameMap;
    };

    //获取文档结构
    getDocumentStruct = function() {
        //变量所有区域
        let nameMap = { ns:"" , name: "", type: TypeEnum.NAMESPACE, child: [], function:  [], variable: [], defines: [] };
        this.tree.traverseBF((current) => {
            //获取当前的命名空间
            let result = this._saveAreaOwnForDocumentStruct(current);
            if(!result) {
                //无需处理
                return;
            }
            //logger.debug(result);
            let data = Object.values(result);
            for(let i = 0; i < data.length; i++) {
                nameMap = this.makeDefineTree(nameMap, data[i]);
            }
        });

        let retData = JSON.stringify(nameMap);
        //logger.debug(retData);
        return nameMap;
    };

    //获取函数位置信息
    _getPosInDocumentFunction = function(name, type) {
        let types = type.trim().split(/[\s\t\n]{1,10}/g);
        type = types[types.length - 1];
        let regStr = type + "[\\s\\t&*\\n]{0,10}([a-zA-Z0-9_]{1,128}[\\s]{0,10}::)?[\\s]{0,10}" + name +"[\\s\\n\\t]{0,10}\\(";
        let reg = new RegExp(regStr, "gm");
        let myArray = reg.exec(this.context);
        if(myArray && myArray.length > 0){
            let _pos = this.context.indexOf(myArray[0]);
            if(_pos != -1) {
                //范围位置
                return _pos;
            }
        }
        let _pos = this.context.indexOf(name);
        return _pos;
    };

    //获取变量位置信息
     _getPosInDocumentVirable = function(name, type) {
        let types = type.trim().split(/[\s\t\n]{1,10}/g);
        type = types[types.length - 1];
        let regStr = type + "[\\s\\t&*\\n]{0,10}[\\s]{0,10}" + name +"[\\s\\t]{0,10}";
        let reg = new RegExp(regStr, "gm");
        let myArray = reg.exec(this.context);
        if(myArray && myArray.length > 0) {
            let _pos = this.context.indexOf(myArray[0]);
            if(_pos != -1) {
                //范围位置
                return _pos;
            }
        }
        let _pos = this.context.indexOf(name);
        return _pos;
    };

    //获取宏定义位置信息
     _getPosInDocumentDefine = function(name) {
        let regStr = "#define [\\s\\t]{0,10}[\\s]{0,10}" + name +"[\\s\\t]{1,10}";
        let reg = new RegExp(regStr, "g");
        let myArray = reg.exec(this.context);
        if(myArray && myArray.length > 0) {
            let _pos = this.context.indexOf(myArray[0]);
            if(_pos != -1) {
                //范围位置
                return _pos;
            }
        }
        let _pos = this.context.indexOf(name);
        return _pos;
    };

    //存储分析作用域节点（如果一个类、一个命名空间、一个结构体）
    _saveAreaOwnForDocumentStruct = function (current) {
        if(!current.ownname
            || !current.ownname.name) {
            //不需要的节点
            return false;
        }

        let hasData = false;
        //当前命名空间
        let namespace = this._getAreaNamespace(current);
        //定义的方法
        let metchod = current.method;
        //定义变量
        let variable = current.variable;
        //枚举
        let genum = current.enum;
        //宏定义
        let defines = current.define;
        //方法
        
        let airName = current.ownname.name;
        if(current.ownname.type == TypeEnum.NAMESPACE) {
            airName = "";
        }

        let retResult = {};
        let functionMeta = {};
        metchod.forEach(e => {
            hasData = true;
            if(e.name.indexOf("::") != -1) {
                let names = e.name.split("::");
                let _pos = this._getPosInDocumentFunction(names[1], e.returndata.type);
                if(!functionMeta[names[0]]) {
                    functionMeta[names[0]] = [{name: names[1], bpos: _pos, permission: e.permission}];
                } else {
                    functionMeta[names[0]].push({name: names[1], bpos: _pos, permission: e.permission});
                }
                return;
            }
            if(!functionMeta[airName]) {
                functionMeta[airName] = [];
            }

            let _pos = this._getPosInDocumentFunction(e.name, e.returndata.type);
            functionMeta[airName].push({name: e.name, bpos: _pos, permission: e.permission});
        });
        
        let keys = Object.keys(functionMeta);
        for(let i = 0; i < keys.length; i++) {
            let results = { ns:namespace , name: keys[i], type: TypeEnum.CALSS, child: [], function: functionMeta[keys[i]], variable: [], defines: [] };
            retResult[keys[i]] = results;
        }
     
        //变量
        let variableMeta = {};
        variable.forEach(e => {
            hasData = true;
            if(e.name.indexOf("::") != -1) {
                let names = e.name.split("::");
                let _pos = this._getPosInDocumentVirable(names[1], e.type);
                if(!variableMeta[names[0]]) {
                    variableMeta[names[0]] = [{name: names[1], bpos: _pos, permission: e.permission}];
                } else {
                    variableMeta[names[0]].push({name: names[1], bpos: _pos, permission: e.permission});
                }
                return;
            }
            if(!variableMeta[airName]) {
                variableMeta[airName] = [];
            }

            let _pos = this._getPosInDocumentVirable(e.name, e.type);
            variableMeta[airName].push({name: e.name, bpos: _pos, permission: e.permission});
        });

        keys = Object.keys(variableMeta);
        for(let i = 0; i < keys.length; i++) {
            if(!retResult[keys[i]]) {
                let results = { ns:namespace , name: keys[i], type: current.ownname.type, child: [], function: [], variable: variableMeta[keys[i]], defines: [] };
                retResult[keys[i]] = results;
            } else {
                retResult[keys[i]].variable = retResult[keys[i]].variable.concat(variableMeta[keys[i]]);
            }
        }

        //枚举,暂时不再树列表中展示
        if (genum.length > 0) {
        }

        //宏定义
        if (defines.length > 0) {
            let definesMeta = [];
            for (let i = 0; i < defines.length; i++) {
                hasData = true;
                let name = defines[i].name;
                let _pos = this._getPosInDocumentDefine(name);
                definesMeta.push({name: name, bpos: _pos, permission: 0});
            }
            if(!retResult[airName]) {
                let results = { ns:namespace , name: airName, type: current.ownname.type, child: [], function: [], variable: [], defines: definesMeta };
                retResult[airName] = results;
            } else {
                retResult[airName].defines = definesMeta;
            }
        }

        //typedef,暂时不再树列表中展示
        if (current.typedef.length > 0) {
        }

        if(!hasData) {
            //如果没有任何数据，直接返回false
            return false;
        }

        //logger.debug(retResult);
        return retResult;
    };

    _getAreaNamespace = function(current) {
        if (current.ownname
            &&current.ownname.type
            && current.ownname.type != TypeEnum.CALSS
            && current.ownname.type != TypeEnum.STRUCT
            && current.ownname.type != TypeEnum.ENUM
            && current.ownname.type != TypeEnum.INTERFACE ) {
            //只有类才返回命名空间
            return current.namespace;
        }

        //
        if (current.parent 
            && current.parent.namespace) {
            //返回父区域的命名空间
            return current.parent.namespace;
        }

        //没有父表示全局定义
        return "";
    };

    _getRealName = function(name) {
        return name;
    };

    //存储分析结果中的函数
    _saveMethod = function (e, samplename, namespace, fileid) {
        if (this.savepublic 
            && e.permission != 0) {
            //确定不保存私有和保护方法
            return;
        }

        if(this.savepublic 
            && /^_[0-9a-z_]{0,100}$/ig.test(e.name)) {
            //确定不保存私有和保护方法的情况下不保存_开头的方法
            return;
        }

        //链接数据库
        let mapName = {};
        let input = [];
        let ptype = "";
        e.params.forEach(ep => {
            let pobj = {
                "t": this._getRealName(ep.type),
                "n": ep.name,
                "v": ep.value,
                "c": ep.isconst,
                "p": ep.ispoint,
                "a": ep.isuseadder //是否引用
            };
            input.push(pobj);
            ptype = ptype == '' ? ep.type : ptype + "|" + ep.type;
        });
        let returndata = {
            "t": this._getRealName(e.returndata.type),
            "c": e.returndata.isconst,
            "a": e.returndata.isuseadder,
            "p": e.returndata.ispoint,
        };
       
        let sigleFun = {
            "a": -1,
            "r": returndata,
            "i": input,
            "c": e.isconst,
            "s": e.isstatic,
            "m": (e.templatefunctiondef ? e.templatefunctiondef: "") //模版定义
        };
       
        let saveData = {
            ownname: samplename,
            name: e.name,
            namespace: namespace,
            type: TypeEnum.FUNCTION,
            permission: e.permission,
            file_id: fileid,
            extdata: JSON.stringify([sigleFun])
        };
 
        let function_id = namespace + "|" + samplename + "|" + e.name;
        //找到的定义
        if(!this.newDefine[function_id]) {
            this.newDefine[function_id] = [sigleFun];
        } else {
            this.newDefine[function_id].push(sigleFun);
        }
        //获取db中的数据
        let info = this.keyworddb.getByFullnameAndType(samplename, namespace, e.name, TypeEnum.FUNCTION);
        if(info !== false && info.extdata && info.extdata.length > 0) {
            if(!this.methodDefine[function_id]) {
                this.methodDefine[function_id] = JSON.parse(info.extdata);
            }

            //库中有数据，需要合并
            let dbExtJson = JSON.parse(info.extdata);
            let newExtJson = sigleFun;
            let keys = new Set();
            for(let i = 0; i < dbExtJson.length; i++) {
                let key = dbExtJson[i].r.t;
                for (let j = 0; j < dbExtJson[i].i.length; j++) {
                    key = key + "|" + dbExtJson[i].i[j].t;
                }
                keys.add(key);
            }

            //新的函数定义
            let key = newExtJson.r.t;
            for (let j = 0; j < newExtJson.i.length; j++) {
                key = key + "|" + newExtJson.i[j].t;
            }

            if (!keys.has(key)) {
                //之前没有该定义
                dbExtJson.push(newExtJson);
            }
            saveData.extdata = JSON.stringify(dbExtJson)
        }
        
        let result = this.keyworddb.insert(saveData);
        let key = this._getKey(namespace, samplename, e.name);
        mapName[key] = saveData;
        return mapName;
    };

    //存储函数实现
    _saveMethodAchieve = function(e, namespaces, fileid) {
        let items = e.name.split("::");
        let samplename = items[0];
        let name = items[1];

        let key = this._getRealName(e.returndata.type);
        e.params.forEach(ep => {
            key = key + "|" + this._getRealName(ep.type);
        });
        
        //获取db中的数据
        let infos = this.keyworddb.getByFullnameNssAndTypeNoMem(samplename, namespaces, name, TypeEnum.FUNCTION);
        if(!infos || infos.length > 1) {
            //两个以上定义，理论上是有异常的
            return false;
        }

        let info = infos[0];
        if(info && info.extdata && info.extdata.length > 0) {
            //库中有数据，需要合并
            let dbExtJson = JSON.parse(info.extdata);
            for(let i = 0; i < dbExtJson.length; i++) {
                let _key = dbExtJson[i].r.t;
                for (let j = 0; j < dbExtJson[i].i.length; j++) {
                    _key = _key + "|" + dbExtJson[i].i[j].t;
                }

                if(_key == key) {
                    //找到数据
                    if(dbExtJson[i].a
                        && dbExtJson[i].a == fileid) {
                        //库里面就是最新的，无需调整
                        break;
                    }
                    dbExtJson[i].a = fileid;
                    this.keyworddb.modifyExdataNoMem(info.id, JSON.stringify(dbExtJson));
                }
            }
        }
    };

    //存储分析结果中的变量
    _saveVariable = function (e, samplename, namespace, fileid) {
        if (this.savepublic 
            && e.permission != 0) {
            //确定不保存私有和保护方法
            return;
        }

        if(this.savepublic 
            && /^_[0-9a-z_]{0,100}$/ig.test(e.name)) {
            //确定不保存私有和保护方法的情况下不保存_开头的方法
            return;
        }

        //链接数据库
        let mapName = {};
        let varb = {
            "t": this._getRealName(e.type),
            "n": e.name,
            "v": e.value,
            "c": e.isconst,
            "p": e.ispoint,
            "s": e.isstatic,
            "a": e.isuseadder //是否引用
        };
        let saveData = {
            ownname: samplename,
            name: e.name,
            namespace: namespace,
            type: TypeEnum.VARIABLE,
            permission: e.permission,
            file_id: fileid,
            extdata: JSON.stringify(varb)
        };
        //logger.debug(saveData);
        this.keyworddb.insert(saveData);
        let key = this._getKey(namespace, samplename, e.name);
        mapName[key] = saveData;
        return mapName;
    };

    //存储分析结果中的宏定义
    _saveDefine = function (defines, samplename, namespace, fileid) {
        //链接数据库
        let mapName = {};
        for (let i = 0; i < defines.length; i++) {
            if(this.savepublic 
                && /^_[0-9a-z_]{0,100}$/ig.test(defines[i].name)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }

            let onedefine = {
                "n": defines[i].name,
                "v": defines[i].realName,
                "p": defines[i].params
            };

            let saveData = {
                ownname: "",
                name: defines[i].name,
                namespace: namespace,
                type: TypeEnum.DEFINE,
                permission: 0,
                file_id: fileid,
                extdata: JSON.stringify(onedefine)
            };

            this.keyworddb.insert(saveData);
            let key = this._getKey(namespace, "", defines[i].name);
            mapName[key] = saveData;
        }
        return mapName;
    };

    //存储分析结果中的枚举
    _saveEnum = function (genum, samplename, namespace, fileid) {
        //链接数据库
        let mapName = {};
        for (let i = 0; i < genum.length; i++) {
            let onementitem = {
                "n": genum[i].name,
                "v": genum[i].value,
            };

            if(this.savepublic 
                && /^_[0-9a-z_]{0,100}$/ig.test(genum[i].name)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }

            let saveData = {
                ownname: samplename,
                name: genum[i].name,
                namespace: namespace,
                type: TypeEnum.ENUMITEM,
                permission: genum[i].permission,
                file_id: fileid,
                extdata: JSON.stringify(onementitem)
            };

            this.keyworddb.insert(saveData);
            mapName[this._getKey(namespace, samplename, genum[i].name)] = 1;
        }
        return mapName;
    };

    //存储分析结果中的定义
    _saveTypedef = function(typedef, samplename, namespace, fileid) {
        //链接数据库
        let mapName = {};
        for (let i = 0; i < typedef.length; i++) {
            if(this.savepublic 
                && /^_[0-9a-z_]{0,100}$/ig.test(typedef[i].name)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }

            let typedefinfo = {
                "n": typedef[i].name,
                "v": typedef[i].value,
            };

            let saveData = {
                ownname: samplename,
                name: typedef[i].name,
                namespace: namespace,
                type: TypeEnum.TYPEDEF,
                permission: 0,
                file_id: fileid,
                extdata: JSON.stringify(typedefinfo)
            };

            this.keyworddb.insert(saveData);
            mapName[this._getKey(namespace, samplename, typedef[i].name)] = 1;
        }
        return mapName;
    }

    //存储包含作用域范围的定义（如：类定义、结果体定义、枚举定义、命名空间）
    _saveOwnInfo = function (samplename, inherits, template, namespace, gtype, fileid) {
        //链接数据库
        let mapName = {};
        if (gtype == TypeEnum.NAMESPACE) {
            let _namespaces = namespace.split("::");
            samplename = _namespaces.pop();
            namespace = _namespaces.join("::");
        }

        if(this.savepublic 
            && /^_[0-9a-z_]{0,100}$/ig.test(samplename)) {
            //确定不保存私有和保护方法的情况下不保存_开头的方法
            return;
        }

        //logger.debug(samplename + "|" + inherits + "|" + template + "|" + namespace + "|" + gtype + "|" + fileid);
        if (samplename != "" && samplename != "__global__") {
            let data = {
                "i": inherits,
                "p": template
            };
        
            let saveData = {
                ownname: '',
                name: samplename,
                namespace: namespace,
                type: gtype,
                permission: 0,
                file_id: fileid,
                extdata: JSON.stringify(data)
            };
            //logger.debug(saveData);
            this.keyworddb.insert(saveData);
            let key = this._getKey(namespace, '', samplename);
            mapName[key] = saveData;
        }
        return mapName;
    };

    //存储包含的头文件和使用的命名空间到存储系统中
    _saveIncludeAndUsingnamespace = function(current, fileid) {
        let mapName = {};
        if (current.include.length > 0
            || current.usingnamespace.length > 0) {
  
            //首节点
            //包含的头文件
            let include = current.include.length > 0 ? current.include : [];
        
            //引用的命名空间
            let usingnamespace = current.usingnamespace.length > 0 ? current.usingnamespace : [];
      
            //保存头文件
            let fileinfo = this.filedb.getFileById(fileid);
            let extData = { i: [], u: [] };
            if (fileinfo.extdata != "") {
                extData = JSON.parse(fileinfo.extdata);
            }
            
            let setOfInclude = new Set(extData.i);
            extData.i = Array.from(setOfInclude);
            for (let i = 0; i < include.length; i++) {

                let _tmpInclude = include[i].replace(/["'<>]{1,1}/g, "");
                if (!setOfInclude.has(_tmpInclude)) {
                    extData.i.push(_tmpInclude);
                }
            }
            let setOfUsingNamespace = new Set(extData.u);
            extData.u =  Array.from(setOfUsingNamespace);
            for (let i = 0; i < usingnamespace.length; i++) {
                let _tmpUsingNamespce = usingnamespace[i].replace(/["'<>]{1,1}/g, "");
                if (!setOfUsingNamespace.has(_tmpUsingNamespce)) {
                    extData.u.push(_tmpUsingNamespce);
                }
            }

            mapName["__file_inlcude"] = extData.i;
            mapName["__file_usingnamespace"] = extData.u;
            this.filedb.modifyExtdata(fileid, JSON.stringify(extData));
        }

        return mapName;
    }

    //存储分析作用域节点（如果一个类、一个命名空间、一个结构体）
    _saveAreaOwn = function (current, fileid) {
         //继承关系
        let inherits = [];
        if (current.ownname
            && current.ownname.inherit) {
            inherits = current.ownname.inherit;
        }
        //类模版
        let template = "";
        if (current.ownname
            && current.ownname.template) {
            //模版
            template = current.ownname.template;
        }

        //当前命名空间
        let namespace = this._getAreaNamespace(current);
        //全名称
        let fullname = current.namespace;
        //命名空间详情
        let ownname = current.ownname;
        //归属名称
        let samplename = '';
        if (ownname) {
            if (ownname.type != TypeEnum.NAMESPACE) {
                //命名空间不需要owner
                samplename = ownname.name;
            }
        }
        //定义的方法
        let metchod = current.method;
        //定义变量
        let variable = current.variable;
        //枚举
        let genum = current.enum;
        //宏定义
        let defines = current.define;

        //头文件、宏定义、命名空间引用
        let mergedName = this._saveIncludeAndUsingnamespace(current, fileid);
        let gtype = ownname == null ? '0' : ownname.type;
        let ownsvaename = ownname == null ? '' : ownname.name;

        if(this.isprotobuf
            && ownname
            && ownname.rawline.indexOf("google::protobuf::Message") < 0) {
            //从probuf解释出来的类，不用命名空间
            namespace = "";
        }

        //归属保存
        let gname = this._saveOwnInfo(ownsvaename, inherits, template, namespace, gtype, fileid);
        mergedName = Object.assign(mergedName, gname);

        //方法
        metchod.forEach(e => {
            if(e.name.indexOf("::") == -1) {
                let methedName = this._saveMethod(e, samplename, namespace, fileid);
                mergedName = Object.assign(mergedName, methedName);
            } else {
                //函数实现，更新实现
                let namespaces = [namespace];
                if(mergedName["__file_usingnamespace"]) {
                    namespaces = namespaces.concat(mergedName["__file_usingnamespace"]);
                }
                this._saveMethodAchieve(e, namespaces, fileid);
            }
        });

        //变量
        variable.forEach(e => {
            let varName = this._saveVariable(e, samplename, namespace, fileid);
            mergedName = Object.assign(mergedName, varName);
        });

        //枚举
        if (genum.length > 0) {
            let enumName = this._saveEnum(genum, samplename, namespace, fileid);
            mergedName = Object.assign(mergedName, enumName);
        }
        //宏定义
        if (defines.length > 0) {
            let defineName = this._saveDefine(defines, samplename, namespace, fileid);
            mergedName = Object.assign(mergedName, defineName);
        }
        //typedef
        if (current.typedef.length > 0) {
            let defineName = this._saveTypedef(current.typedef, samplename, namespace, fileid);
            mergedName = Object.assign(mergedName, defineName);
        }

        return mergedName;
    }

    //去掉已经废弃的函数定义
    _removeNoUserFunction = function() {
        let _keys = Object.keys(this.newDefine);
        for(let i = 0; i < _keys.length; i++) {
            if(!this.methodDefine[_keys[i]] ){
                // || this.methodDefine[_keys[i]].length == this.newDefine[_keys[i]].length) {
                continue;
            }
            let keys = {};
            for(let j = 0; j < this.methodDefine[_keys[i]].length; j++) {
                let key = this.methodDefine[_keys[i]][j].r.t;
                for (let k = 0; k < this.methodDefine[_keys[i]][j].i.length; k++) {
                    key = key + "|" + this.methodDefine[_keys[i]][j].i[k].t;
                }
                keys[key] = this.methodDefine[_keys[i]][j].a;
            }

            //新的函数定义
            for(let k = 0; k < this.newDefine[_keys[i]].length; k++) {
                let key = this.newDefine[_keys[i]][k].r.t;
                for (let j = 0; j < this.newDefine[_keys[i]][k].i.length; j++) {
                    key = key + "|" + this.newDefine[_keys[i]][k].i[j].t;
                }
                this.newDefine[_keys[i]][k].a = keys[key];
            }
            
            //保存
            let jsonExt = JSON.stringify(this.newDefine[_keys[i]]);
            let vals = _keys[i].split("|");
            this.keyworddb.modifyExdataWithName(vals[0], vals[1], vals[2], TypeEnum.FUNCTION, jsonExt);
        }
    };

    //拼接key，拼接的key用于构造返回数据
    _getKey = function (namespace, ownname, samplename, other = '') {
        let key = namespace + "|" + ownname + "|" + samplename;
        if (other != '') {
            key = key + "|" + other;
        }
        return key;
    };
};

module.exports = {
    TypeEnum,
    keywork,
    AnalyseBase
};

