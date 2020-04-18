/* --------------------------------------------------------------------------------------------
 * analyseBase.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var Tree = require('./tree');
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
                console.error("not find file index!", this.filename);
                return false;
            }
            var fileid = fileinfo.id;
            //变量所有区域
            var nameMap = {};
            this.tree.traverseBF(function (current) {
                //获取当前的命名空间
                var _nameMap = _this._saveAreaOwn(current, fileid);
                nameMap = Object.assign(nameMap, _nameMap);
            });
            return nameMap;
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
            // if (this.typedef[name]) {
            //     return this.typedef[name];
            // }
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
            //获取db中的数据
            var info = this.keyworddb.getByFullnameAndType(samplename, namespace, e.name, TypeEnum.FUNCTION);
            if (info !== false) {
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
            //if(e.name == "operator>=")console.log(e, result);
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
            //console.log(infos);
            if (infos.length > 1) {
                //两个以上定义，理论上是有异常的
                return false;
            }
            var info = infos[0];
            if (info !== false) {
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
            //console.log(saveData);
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
            //console.log(samplename + "|" + inherits + "|" + template + "|" + namespace + "|" + gtype + "|" + fileid);
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
                //console.log(saveData);
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
                    //console.log(namespaces, e);
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
