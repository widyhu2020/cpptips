/* --------------------------------------------------------------------------------------------
 * analyseBase.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const Tree = require('./tree');

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
            console.error("not find file index!", this.filename);
            return false;
        }
        let fileid = fileinfo.id;
        
        //变量所有区域
        let nameMap = {};
        this.tree.traverseBF((current) => {
            //获取当前的命名空间
            let _nameMap = this._saveAreaOwn(current, fileid);
            nameMap = Object.assign(nameMap, _nameMap);
        });
        return nameMap;
    };

    //
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
        // if (this.typedef[name]) {
        //     return this.typedef[name];
        // }
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
            "m": (e.templatefunctiondef ? e.templatefunctiondef: "")                    //模版定义
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

        //获取db中的数据
        let info = this.keyworddb.getByFullnameAndType(samplename, namespace, e.name, TypeEnum.FUNCTION);
        if(info !== false) {
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
        //if(e.name == "operator>=")console.log(e, result);
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
        let infos = this.keyworddb.getByFullnameNssAndType(samplename, namespaces, name, TypeEnum.FUNCTION);
        //console.log(infos);
        if(infos.length > 1) {
            //两个以上定义，理论上是有异常的
            return false;
        }
        let info = infos[0];
        if(info !== false) {
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
                    this.keyworddb.modifyExdata(info.id, JSON.stringify(dbExtJson));
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
        //console.log(saveData);
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

        //console.log(samplename + "|" + inherits + "|" + template + "|" + namespace + "|" + gtype + "|" + fileid);
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
            //console.log(saveData);
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
            for (let i = 0; i < include.length; i++) {
                if (!setOfInclude.has(include[i])) {
                    extData.i.push(include[i]);
                }
            }
            let setOfUsingNamespace = new Set(extData.u);
            for (let i = 0; i < usingnamespace.length; i++) {
                if (!setOfUsingNamespace.has(usingnamespace[i])) {
                    extData.u.push(usingnamespace[i]);
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
                //console.log(namespaces, e);
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

