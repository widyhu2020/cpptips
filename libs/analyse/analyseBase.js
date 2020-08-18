/* --------------------------------------------------------------------------------------------
 * analyseBase.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var Tree = require('./tree');
var logger = require('log4js').getLogger("cpptips");
//分析所需要的关键字,不是c++全部关键字
var keywork = new Set([
    '#define', 'if', 'for', 'int', 'int32_t', 'int64_t', '#include',
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
var ROOT_VALUE = 0;
var AnalyseBase = /** @class */ (function () {
    function AnalyseBase(filecontext, isprotobuf, filename) {
        if (isprotobuf === void 0) { isprotobuf = false; }
        if (filename === void 0) { filename = ''; }
        //执行分析，父类不实现
        this.doAnalyse = function () { };
        //获取结果，该结果直接存入db
        this.getResult = function (filedb, keyworddb, savepublic) {
            var _this = this;
            if (savepublic === void 0) { savepublic = false; }
            //获取文件id
            this.filedb = filedb;
            this.keyworddb = keyworddb;
            this.savepublic = savepublic;
            var fileinfo = filedb.getFileByFilePath(this.filename);
            if (!fileinfo || fileinfo === undefined) {
                logger.debug("not find file index!", this.filename);
                return false;
            }
            var fileid = fileinfo.id;
            //清空该文件所有的扩展数据,防止出现不修改名称的问题
            //keyworddb.cleanExtData(fileid);
            //变量所有区域
            var nameMap = {};
            this.tree.traverseBF(function (current) {
                //获取当前的命名空间
                var _nameMap = _this._saveAreaOwn(current, fileid);
                nameMap = Object.assign(nameMap, _nameMap);
            });
            //去掉无用的定义
            this._removeNoUserFunction();
            return nameMap;
        };
        //构造树结构体
        this.makeDefineTree = function (nameMap, result) {
            var ns = result.ns.split("::");
            var currentNode = nameMap;
            var _ns = [];
            for (var i = 0; i < ns.length; i++) {
                _ns.push(ns[i]);
                var isFind = false;
                for (var j = 0; j < currentNode.child.length; j++) {
                    if (currentNode.child[j].ns == _ns.join("::")) {
                        //找到子
                        currentNode = currentNode.child[j];
                        isFind = true;
                    }
                }
                if (!isFind && ns[i].length > 0) {
                    //未找到则构造一个
                    var _data = { ns: _ns.join("::"), name: ns[i], type: TypeEnum.NAMESPACE, child: [], function: [], variable: [], defines: [] };
                    ;
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
        this.getDocumentStruct = function () {
            var _this = this;
            //变量所有区域
            var nameMap = { ns: "", name: "", type: TypeEnum.NAMESPACE, child: [], function: [], variable: [], defines: [] };
            this.tree.traverseBF(function (current) {
                //获取当前的命名空间
                var result = _this._saveAreaOwnForDocumentStruct(current);
                if (!result) {
                    //无需处理
                    return;
                }
                //logger.debug(result);
                var data = Object.values(result);
                for (var i = 0; i < data.length; i++) {
                    nameMap = _this.makeDefineTree(nameMap, data[i]);
                }
            });
            var retData = JSON.stringify(nameMap);
            //logger.debug(retData);
            return nameMap;
        };
        //获取函数位置信息
        this._getPosInDocumentFunction = function (name, type) {
            var types = type.trim().split(/[\s\t\n]{1,10}/g);
            type = types[types.length - 1];
            var regStr = type + "[\\s\\t&*\\n]{0,10}([a-zA-Z0-9_]{1,128}[\\s]{0,10}::)?[\\s]{0,10}" + name + "[\\s\\n\\t]{0,10}\\(";
            var reg = new RegExp(regStr, "gm");
            var myArray = reg.exec(this.context);
            if (myArray && myArray.length > 0) {
                var _pos_1 = this.context.indexOf(myArray[0]);
                if (_pos_1 != -1) {
                    //范围位置
                    return _pos_1;
                }
            }
            var _pos = this.context.indexOf(name);
            return _pos;
        };
        //获取变量位置信息
        this._getPosInDocumentVirable = function (name, type) {
            var types = type.trim().split(/[\s\t\n]{1,10}/g);
            type = types[types.length - 1];
            var regStr = type + "[\\s\\t&*\\n]{0,10}[\\s]{0,10}" + name + "[\\s\\t]{0,10}";
            var reg = new RegExp(regStr, "gm");
            var myArray = reg.exec(this.context);
            if (myArray && myArray.length > 0) {
                var _pos_2 = this.context.indexOf(myArray[0]);
                if (_pos_2 != -1) {
                    //范围位置
                    return _pos_2;
                }
            }
            var _pos = this.context.indexOf(name);
            return _pos;
        };
        //获取宏定义位置信息
        this._getPosInDocumentDefine = function (name) {
            var regStr = "#define [\\s\\t]{0,10}[\\s]{0,10}" + name + "[\\s\\t]{1,10}";
            var reg = new RegExp(regStr, "g");
            var myArray = reg.exec(this.context);
            if (myArray && myArray.length > 0) {
                var _pos_3 = this.context.indexOf(myArray[0]);
                if (_pos_3 != -1) {
                    //范围位置
                    return _pos_3;
                }
            }
            var _pos = this.context.indexOf(name);
            return _pos;
        };
        //存储分析作用域节点（如果一个类、一个命名空间、一个结构体）
        this._saveAreaOwnForDocumentStruct = function (current) {
            var _this = this;
            if (!current.ownname
                || !current.ownname.name) {
                //不需要的节点
                return false;
            }
            var hasData = false;
            //当前命名空间
            var namespace = this._getAreaNamespace(current);
            //定义的方法
            var metchod = current.method;
            //定义变量
            var variable = current.variable;
            //枚举
            var genum = current.enum;
            //宏定义
            var defines = current.define;
            //方法
            var airName = current.ownname.name;
            if (current.ownname.type == TypeEnum.NAMESPACE) {
                airName = "";
            }
            var retResult = {};
            var functionMeta = {};
            metchod.forEach(function (e) {
                hasData = true;
                if (e.name.indexOf("::") != -1) {
                    var names = e.name.split("::");
                    var _pos_4 = _this._getPosInDocumentFunction(names[1], e.returndata.type);
                    if (!functionMeta[names[0]]) {
                        functionMeta[names[0]] = [{ name: names[1], bpos: _pos_4, permission: e.permission }];
                    }
                    else {
                        functionMeta[names[0]].push({ name: names[1], bpos: _pos_4, permission: e.permission });
                    }
                    return;
                }
                if (!functionMeta[airName]) {
                    functionMeta[airName] = [];
                }
                var _pos = _this._getPosInDocumentFunction(e.name, e.returndata.type);
                functionMeta[airName].push({ name: e.name, bpos: _pos, permission: e.permission });
            });
            var keys = Object.keys(functionMeta);
            for (var i = 0; i < keys.length; i++) {
                var results = { ns: namespace, name: keys[i], type: TypeEnum.CALSS, child: [], function: functionMeta[keys[i]], variable: [], defines: [] };
                retResult[keys[i]] = results;
            }
            //变量
            var variableMeta = {};
            variable.forEach(function (e) {
                hasData = true;
                if (e.name.indexOf("::") != -1) {
                    var names = e.name.split("::");
                    var _pos_5 = _this._getPosInDocumentVirable(names[1], e.type);
                    if (!variableMeta[names[0]]) {
                        variableMeta[names[0]] = [{ name: names[1], bpos: _pos_5, permission: e.permission }];
                    }
                    else {
                        variableMeta[names[0]].push({ name: names[1], bpos: _pos_5, permission: e.permission });
                    }
                    return;
                }
                if (!variableMeta[airName]) {
                    variableMeta[airName] = [];
                }
                var _pos = _this._getPosInDocumentVirable(e.name, e.type);
                variableMeta[airName].push({ name: e.name, bpos: _pos, permission: e.permission });
            });
            keys = Object.keys(variableMeta);
            for (var i = 0; i < keys.length; i++) {
                if (!retResult[keys[i]]) {
                    var results = { ns: namespace, name: keys[i], type: current.ownname.type, child: [], function: [], variable: variableMeta[keys[i]], defines: [] };
                    retResult[keys[i]] = results;
                }
                else {
                    retResult[keys[i]].variable = retResult[keys[i]].variable.concat(variableMeta[keys[i]]);
                }
            }
            //枚举,暂时不再树列表中展示
            if (genum.length > 0) {
            }
            //宏定义
            if (defines.length > 0) {
                var definesMeta = [];
                for (var i = 0; i < defines.length; i++) {
                    hasData = true;
                    var name_1 = defines[i].name;
                    var _pos = this._getPosInDocumentDefine(name_1);
                    definesMeta.push({ name: name_1, bpos: _pos, permission: 0 });
                }
                if (!retResult[airName]) {
                    var results = { ns: namespace, name: airName, type: current.ownname.type, child: [], function: [], variable: [], defines: definesMeta };
                    retResult[airName] = results;
                }
                else {
                    retResult[airName].defines = definesMeta;
                }
            }
            //typedef,暂时不再树列表中展示
            if (current.typedef.length > 0) {
            }
            if (!hasData) {
                //如果没有任何数据，直接返回false
                return false;
            }
            //logger.debug(retResult);
            return retResult;
        };
        //
        this._getAreaNamespace = function (current) {
            if (current.ownname
                && current.ownname.type
                && current.ownname.type != TypeEnum.CALSS
                && current.ownname.type != TypeEnum.STRUCT
                && current.ownname.type != TypeEnum.ENUM
                && current.ownname.type != TypeEnum.INTERFACE) {
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
        this._getRealName = function (name) {
            return name;
        };
        //存储分析结果中的函数
        this._saveMethod = function (e, samplename, namespace, fileid) {
            var _this = this;
            if (this.savepublic
                && e.permission != 0) {
                //确定不保存私有和保护方法
                return;
            }
            if (this.savepublic
                && /^_[0-9a-z_]{0,100}$/ig.test(e.name)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }
            //链接数据库
            var mapName = {};
            var input = [];
            var ptype = "";
            e.params.forEach(function (ep) {
                var pobj = {
                    "t": _this._getRealName(ep.type),
                    "n": ep.name,
                    "v": ep.value,
                    "c": ep.isconst,
                    "p": ep.ispoint,
                    "a": ep.isuseadder //是否引用
                };
                input.push(pobj);
                ptype = ptype == '' ? ep.type : ptype + "|" + ep.type;
            });
            var returndata = {
                "t": this._getRealName(e.returndata.type),
                "c": e.returndata.isconst,
                "a": e.returndata.isuseadder,
                "p": e.returndata.ispoint,
            };
            var sigleFun = {
                "a": -1,
                "r": returndata,
                "i": input,
                "c": e.isconst,
                "s": e.isstatic,
                "m": (e.templatefunctiondef ? e.templatefunctiondef : "") //模版定义
            };
            var saveData = {
                ownname: samplename,
                name: e.name,
                namespace: namespace,
                type: TypeEnum.FUNCTION,
                permission: e.permission,
                file_id: fileid,
                extdata: JSON.stringify([sigleFun])
            };
            var function_id = namespace + "|" + samplename + "|" + e.name;
            //找到的定义
            if (!this.newDefine[function_id]) {
                this.newDefine[function_id] = [sigleFun];
            }
            else {
                this.newDefine[function_id].push(sigleFun);
            }
            //获取db中的数据
            var info = this.keyworddb.getByFullnameAndType(samplename, namespace, e.name, TypeEnum.FUNCTION);
            if (info !== false && info.extdata && info.extdata.length > 0) {
                if (!this.methodDefine[function_id]) {
                    this.methodDefine[function_id] = JSON.parse(info.extdata);
                }
                //库中有数据，需要合并
                var dbExtJson = JSON.parse(info.extdata);
                var newExtJson = sigleFun;
                var keys = new Set();
                for (var i = 0; i < dbExtJson.length; i++) {
                    var key_1 = dbExtJson[i].r.t;
                    for (var j = 0; j < dbExtJson[i].i.length; j++) {
                        key_1 = key_1 + "|" + dbExtJson[i].i[j].t;
                    }
                    keys.add(key_1);
                }
                //新的函数定义
                var key_2 = newExtJson.r.t;
                for (var j = 0; j < newExtJson.i.length; j++) {
                    key_2 = key_2 + "|" + newExtJson.i[j].t;
                }
                if (!keys.has(key_2)) {
                    //之前没有该定义
                    dbExtJson.push(newExtJson);
                }
                saveData.extdata = JSON.stringify(dbExtJson);
            }
            var result = this.keyworddb.insert(saveData);
            var key = this._getKey(namespace, samplename, e.name);
            mapName[key] = saveData;
            return mapName;
        };
        //存储函数实现
        this._saveMethodAchieve = function (e, namespaces, fileid) {
            var _this = this;
            var items = e.name.split("::");
            var samplename = items[0];
            var name = items[1];
            var key = this._getRealName(e.returndata.type);
            e.params.forEach(function (ep) {
                key = key + "|" + _this._getRealName(ep.type);
            });
            //获取db中的数据
            var infos = this.keyworddb.getByFullnameNssAndType(samplename, namespaces, name, TypeEnum.FUNCTION);
            //logger.debug(infos);
            if (!infos || infos.length > 1) {
                //两个以上定义，理论上是有异常的
                return false;
            }
            var info = infos[0];
            if (info && info.extdata && info.extdata.length > 0) {
                //库中有数据，需要合并
                var dbExtJson = JSON.parse(info.extdata);
                for (var i = 0; i < dbExtJson.length; i++) {
                    var _key = dbExtJson[i].r.t;
                    for (var j = 0; j < dbExtJson[i].i.length; j++) {
                        _key = _key + "|" + dbExtJson[i].i[j].t;
                    }
                    if (_key == key) {
                        //找到数据
                        if (dbExtJson[i].a
                            && dbExtJson[i].a == fileid) {
                            //库里面就是最新的，无需调整
                            break;
                        }
                        dbExtJson[i].a = fileid;
                        this.keyworddb.modifyExdata(info.id, JSON.stringify(dbExtJson));
                    }
                }
            }
        };
        //存储分析结果中的变量
        this._saveVariable = function (e, samplename, namespace, fileid) {
            if (this.savepublic
                && e.permission != 0) {
                //确定不保存私有和保护方法
                return;
            }
            if (this.savepublic
                && /^_[0-9a-z_]{0,100}$/ig.test(e.name)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }
            //链接数据库
            var mapName = {};
            var varb = {
                "t": this._getRealName(e.type),
                "n": e.name,
                "v": e.value,
                "c": e.isconst,
                "p": e.ispoint,
                "s": e.isstatic,
                "a": e.isuseadder //是否引用
            };
            var saveData = {
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
            var key = this._getKey(namespace, samplename, e.name);
            mapName[key] = saveData;
            return mapName;
        };
        //存储分析结果中的宏定义
        this._saveDefine = function (defines, samplename, namespace, fileid) {
            //链接数据库
            var mapName = {};
            for (var i = 0; i < defines.length; i++) {
                if (this.savepublic
                    && /^_[0-9a-z_]{0,100}$/ig.test(defines[i].name)) {
                    //确定不保存私有和保护方法的情况下不保存_开头的方法
                    return;
                }
                var onedefine = {
                    "n": defines[i].name,
                    "v": defines[i].realName,
                    "p": defines[i].params
                };
                var saveData = {
                    ownname: "",
                    name: defines[i].name,
                    namespace: namespace,
                    type: TypeEnum.DEFINE,
                    permission: 0,
                    file_id: fileid,
                    extdata: JSON.stringify(onedefine)
                };
                this.keyworddb.insert(saveData);
                var key = this._getKey(namespace, "", defines[i].name);
                mapName[key] = saveData;
            }
            return mapName;
        };
        //存储分析结果中的枚举
        this._saveEnum = function (genum, samplename, namespace, fileid) {
            //链接数据库
            var mapName = {};
            for (var i = 0; i < genum.length; i++) {
                var onementitem = {
                    "n": genum[i].name,
                    "v": genum[i].value,
                };
                if (this.savepublic
                    && /^_[0-9a-z_]{0,100}$/ig.test(genum[i].name)) {
                    //确定不保存私有和保护方法的情况下不保存_开头的方法
                    return;
                }
                var saveData = {
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
        this._saveTypedef = function (typedef, samplename, namespace, fileid) {
            //链接数据库
            var mapName = {};
            for (var i = 0; i < typedef.length; i++) {
                if (this.savepublic
                    && /^_[0-9a-z_]{0,100}$/ig.test(typedef[i].name)) {
                    //确定不保存私有和保护方法的情况下不保存_开头的方法
                    return;
                }
                var typedefinfo = {
                    "n": typedef[i].name,
                    "v": typedef[i].value,
                };
                var saveData = {
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
        };
        //存储包含作用域范围的定义（如：类定义、结果体定义、枚举定义、命名空间）
        this._saveOwnInfo = function (samplename, inherits, template, namespace, gtype, fileid) {
            //链接数据库
            var mapName = {};
            if (gtype == TypeEnum.NAMESPACE) {
                var _namespaces = namespace.split("::");
                samplename = _namespaces.pop();
                namespace = _namespaces.join("::");
            }
            if (this.savepublic
                && /^_[0-9a-z_]{0,100}$/ig.test(samplename)) {
                //确定不保存私有和保护方法的情况下不保存_开头的方法
                return;
            }
            //logger.debug(samplename + "|" + inherits + "|" + template + "|" + namespace + "|" + gtype + "|" + fileid);
            if (samplename != "" && samplename != "__global__") {
                var data = {
                    "i": inherits,
                    "p": template
                };
                var saveData = {
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
                var key = this._getKey(namespace, '', samplename);
                mapName[key] = saveData;
            }
            return mapName;
        };
        //存储包含的头文件和使用的命名空间到存储系统中
        this._saveIncludeAndUsingnamespace = function (current, fileid) {
            var mapName = {};
            if (current.include.length > 0
                || current.usingnamespace.length > 0) {
                //首节点
                //包含的头文件
                var include = current.include.length > 0 ? current.include : [];
                //引用的命名空间
                var usingnamespace = current.usingnamespace.length > 0 ? current.usingnamespace : [];
                //保存头文件
                var fileinfo = this.filedb.getFileById(fileid);
                var extData = { i: [], u: [] };
                if (fileinfo.extdata != "") {
                    extData = JSON.parse(fileinfo.extdata);
                }
                var setOfInclude = new Set(extData.i);
                for (var i = 0; i < include.length; i++) {
                    if (!setOfInclude.has(include[i])) {
                        extData.i.push(include[i]);
                    }
                }
                var setOfUsingNamespace = new Set(extData.u);
                for (var i = 0; i < usingnamespace.length; i++) {
                    if (!setOfUsingNamespace.has(usingnamespace[i])) {
                        extData.u.push(usingnamespace[i]);
                    }
                }
                mapName["__file_inlcude"] = extData.i;
                mapName["__file_usingnamespace"] = extData.u;
                this.filedb.modifyExtdata(fileid, JSON.stringify(extData));
            }
            return mapName;
        };
        //存储分析作用域节点（如果一个类、一个命名空间、一个结构体）
        this._saveAreaOwn = function (current, fileid) {
            var _this = this;
            //继承关系
            var inherits = [];
            if (current.ownname
                && current.ownname.inherit) {
                inherits = current.ownname.inherit;
            }
            //类模版
            var template = "";
            if (current.ownname
                && current.ownname.template) {
                //模版
                template = current.ownname.template;
            }
            //当前命名空间
            var namespace = this._getAreaNamespace(current);
            //全名称
            var fullname = current.namespace;
            //命名空间详情
            var ownname = current.ownname;
            //归属名称
            var samplename = '';
            if (ownname) {
                if (ownname.type != TypeEnum.NAMESPACE) {
                    //命名空间不需要owner
                    samplename = ownname.name;
                }
            }
            //定义的方法
            var metchod = current.method;
            //定义变量
            var variable = current.variable;
            //枚举
            var genum = current.enum;
            //宏定义
            var defines = current.define;
            //头文件、宏定义、命名空间引用
            var mergedName = this._saveIncludeAndUsingnamespace(current, fileid);
            var gtype = ownname == null ? '0' : ownname.type;
            var ownsvaename = ownname == null ? '' : ownname.name;
            //归属保存
            var gname = this._saveOwnInfo(ownsvaename, inherits, template, namespace, gtype, fileid);
            mergedName = Object.assign(mergedName, gname);
            //方法
            metchod.forEach(function (e) {
                //logger.debug(e.name);
                if (e.name.indexOf("::") == -1) {
                    var methedName = _this._saveMethod(e, samplename, namespace, fileid);
                    mergedName = Object.assign(mergedName, methedName);
                }
                else {
                    //函数实现，更新实现
                    var namespaces = [namespace];
                    if (mergedName["__file_usingnamespace"]) {
                        namespaces = namespaces.concat(mergedName["__file_usingnamespace"]);
                    }
                    _this._saveMethodAchieve(e, namespaces, fileid);
                }
            });
            //变量
            variable.forEach(function (e) {
                var varName = _this._saveVariable(e, samplename, namespace, fileid);
                mergedName = Object.assign(mergedName, varName);
            });
            //枚举
            if (genum.length > 0) {
                var enumName = this._saveEnum(genum, samplename, namespace, fileid);
                mergedName = Object.assign(mergedName, enumName);
            }
            //宏定义
            if (defines.length > 0) {
                var defineName = this._saveDefine(defines, samplename, namespace, fileid);
                mergedName = Object.assign(mergedName, defineName);
            }
            //typedef
            if (current.typedef.length > 0) {
                var defineName = this._saveTypedef(current.typedef, samplename, namespace, fileid);
                mergedName = Object.assign(mergedName, defineName);
            }
            return mergedName;
        };
        //去掉已经废弃的函数定义
        this._removeNoUserFunction = function () {
            var _keys = Object.keys(this.newDefine);
            for (var i = 0; i < _keys.length; i++) {
                if (!this.methodDefine[_keys[i]]) {
                    // || this.methodDefine[_keys[i]].length == this.newDefine[_keys[i]].length) {
                    continue;
                }
                var keys = {};
                for (var j = 0; j < this.methodDefine[_keys[i]].length; j++) {
                    var key = this.methodDefine[_keys[i]][j].r.t;
                    for (var k = 0; k < this.methodDefine[_keys[i]][j].i.length; k++) {
                        key = key + "|" + this.methodDefine[_keys[i]][j].i[k].t;
                    }
                    keys[key] = this.methodDefine[_keys[i]][j].a;
                }
                //新的函数定义
                for (var k = 0; k < this.newDefine[_keys[i]].length; k++) {
                    var key = this.newDefine[_keys[i]][k].r.t;
                    for (var j = 0; j < this.newDefine[_keys[i]][k].i.length; j++) {
                        key = key + "|" + this.newDefine[_keys[i]][k].i[j].t;
                    }
                    this.newDefine[_keys[i]][k].a = keys[key];
                }
                //保存
                var jsonExt = JSON.stringify(this.newDefine[_keys[i]]);
                var vals = _keys[i].split("|");
                this.keyworddb.modifyExdataWithName(vals[0], vals[1], vals[2], TypeEnum.FUNCTION, jsonExt);
            }
            //logger.debug("resave over!");
        };
        //拼接key，拼接的key用于构造返回数据
        this._getKey = function (namespace, ownname, samplename, other) {
            if (other === void 0) { other = ''; }
            var key = namespace + "|" + ownname + "|" + samplename;
            if (other != '') {
                key = key + "|" + other;
            }
            return key;
        };
        this.point_domain = ROOT_VALUE; //默认指向根作用域
        this.tree = new Tree(ROOT_VALUE); //构造等级树
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
    }
    ;
    return AnalyseBase;
}());
;
module.exports = {
    TypeEnum: TypeEnum,
    keywork: keywork,
    AnalyseBase: AnalyseBase
};
