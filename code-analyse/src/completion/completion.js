/* --------------------------------------------------------------------------------------------
 * completion.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const Store = require('../store/store').Store;
const TypeEnum = require('../analyse/analyseCpp').TypeEnum;
const KeyWordStore = require('../store/store').KeyWordStore;
const DefineMap = require('../definition/defineMap').DefineMap;
const StdIteratorType = require('../definition/defineMap').StdIteratorType;
const logger = require('log4js').getLogger("cpptips");

class Completion {
    constructor(){
        //Store.getInstace(dbfile);
    }

    transferStlName = function(templatename, params, name) {
        let _pos = templatename.lastIndexOf("::");
        if(templatename.substring(0, _pos) != "std") {
            return templatename;
        }
        let ownname = templatename.substring(_pos + 2);
        if(name == "const_iterator" 
            || name == "iterator"
            || name == "reverse_iterator"
            || name == "const_reverse_iterator") {
            if(ownname == "map") {
                return "std::pair<" + params + ">";
            }
            return params;
        }
        return templatename;
    };

    //获取类的全名称
    getClassFullName = function (name, namespaces) {
        let kws = KeyWordStore.getInstace();
        if(name.indexOf("::") != -1 && name.indexOf("<") == -1) {
            //已经包含命名空间，直接返回
            //且不是模版定义
            return name;
        }
        
        //如果类目带模版参数，则去掉
        if(name[name.length - 1] == ">") {
            name = name.replace(/<[\w\s<>,:]{1,256}$/g, "");
        } else {
            let _pos = name.lastIndexOf(">");
            let _bpos = name.indexOf("<");
            if(name[_pos + 1] != ":" || name[_pos + 2] != ":") {
                name = name.replace(/<[\w\s<>,:]{1,256}$/g, "");
            } else {
                let _definename = name.substring(_pos + 3);
                let _name = name.substring(0, _bpos);
                let params = name.substring(_bpos + 1, _pos);
                name = this.transferStlName(_name, params, _definename);
            }
        }

        //没有命名空间的，需要找到全名称
        let findclass = kws.getByNameAndNamespaces(name, namespaces);
        if (findclass.length <= 0) {
            //没有找到父类
            return name;
        }

        //宏定义处理
        if (findclass.length == 1
            && findclass[0].type == TypeEnum.DEFINE) {
            //宏定义
            let extData = JSON.parse(findclass[0].extdata);
            return this.getClassFullName(extData.v, namespaces);
        }

        //typedef处理
        if (findclass.length == 1
            && findclass[0].type == TypeEnum.TYPEDEF) {
            //宏定义
            let extData = JSON.parse(findclass[0].extdata);
            return this.getClassFullName(extData.v, namespaces);
        }

        findclass.sort((a,b)=>{
            //这里可以优化成类型排序【类>结构体>type>define>其他】
            return b.namespace.length - a.namespace.length;
        });

        //只处理第一个，如果有多个这里忽略除一个以外的
        for (let i = 0; i < findclass.length; i++) {
            if (findclass[i].type != TypeEnum.CALSS
                && findclass[i].type != TypeEnum.STRUCT
                && findclass[i].type != TypeEnum.DEFINE
                && findclass[i].type != TypeEnum.TYPEDEF) {
                //不是类的定义
                continue;
            }

            //宏定义处理
            if (findclass[i].type == TypeEnum.DEFINE) {
                //宏定义
                let extData = JSON.parse(findclass[i].extdata);
                return this.getClassFullName(extData.v, namespaces);
            }

            //typedef处理
            if (findclass[i].type == TypeEnum.TYPEDEF) {
                //宏定义
                let extData = JSON.parse(findclass[i].extdata);
                return this.getClassFullName(extData.v, namespaces);
            }

            if (findclass[i].namespace == "") {
                //没有命名空间
                return findclass[i].name;
            }
            return findclass[i].namespace + "::" + findclass[i].name;
        }

        //原样返回
        return name;
    };

    //获取类的继承父-需要命名空间
    getInheritOfClassSample = function (name, namespace) {
        let kws = KeyWordStore.getInstace();
        let classInfo = kws.getByFullnameAndType('', namespace, name, TypeEnum.CALSS);
        if (!classInfo) {
            return [];
        }

        let extData = JSON.parse(classInfo.extdata);
        if (extData.i.length == 0) {
            //没有继承
            return [];
        }

        let inherit = [];
        for (let i = 0; i < extData.i.length; i++) {
            let inheritclass = extData.i[i];
            if (inheritclass.p == 0) {
                let classname = inheritclass.n;
                inherit.push(classname);
            }
        }
        return inherit;
    };

    //获取类的继承父
    getInheritOfClass = function (name, namespace, usnamespace) {
        let kws = KeyWordStore.getInstace();
        let classInfo = kws.getByFullnameAndType('', namespace, name, TypeEnum.CALSS);
        if (!classInfo) {
            return [];
        }
        
        let extData = JSON.parse(classInfo.extdata);
        if (extData.i.length == 0) {
            //没有继承
            return [];
        }

        let inherit = [];
        for(let i = 0; i < extData.i.length; i++) {
            let inheritclass = extData.i[i];
            if (inheritclass.p == 0) {
                let classname = inheritclass.n;
                if(classname.indexOf("::") != -1) {
                    //只处理公有继承的方法
                    inherit.push(inheritclass.n);
                    continue;
                }
                //没有命名空间的，需要找到全名称
                usnamespace.push(namespace);
                let findclass = kws.getByNameAndNamespaces(classname, usnamespace);
                if (findclass.length <= 0) {
                    //没有找到父类
                    continue;
                }
                
                for (let i = 0; i < findclass.length; i++) {
                    if (findclass[i].type != TypeEnum.CALSS) {
                        //不是类的定义
                        continue;
                    }
                    //只处理第一个，如果有多个这里忽略除一个以外的
                    inherit.push(findclass[i].namespace + "::" + findclass[i].name);
                    break;
                }
            }
        }
        return inherit;
    };

    //输入前缀和命名空间，获取智能提示列表
    querByPreKwInNamepsace = function (preKw, namespaces, ownname, defineval, gettype = []) {

        namespaces = namespaces.filter((e)=>{ return e != ""; });
        let showitem = [];
        this._getDocumentDefine(preKw, ownname, defineval, showitem);
        logger.mark("freezFindAllByPreKeyword");
        let infos = Store.getInstace().freezFindAllByPreKeyword(preKw, namespaces, ownname);
        logger.mark("freezFindAllByPreKeyword");
        //解释附加参数
        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];
            let items = this._getShowItem(info);
            showitem.push(items);
        }
        return showitem;
    };

    //限定作用域模糊查找
    querByPreKwWithOwner = function(preKw, namespace, owname) {
        let infos = [];
        if(owname == "") {
            infos = Store.getInstace().freezGetByNameAndNamespaces(preKw, [namespace]);
        } else {
            infos = Store.getInstace().freezFindRestrictByPreKeyword(preKw, [namespace], owname);
        }
        //解释附加参数
        let showitem = [];
        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];
            let items = this._getShowItem(info);
            showitem.push(items);
        }
        return showitem;
    };

    //通过owner和名称以及命名空间获取类型
    getTypeByOwnerAndNameInNamespace = function(ownname, name, namespaces) {
        let infos = KeyWordStore.getInstace().getByOwnNameAndName([ownname], name, namespaces);
        if(infos.length <= 0) {
            return false;
        } else if(infos.length > 1) {
            infos.sort((a,b)=>{
                return b.namespace.length - a.namespace.length;
            });
        }
        let findType = false;
        for(let i = 0; i < infos.length; i++) 
        {
            if(infos[0].type == TypeEnum.STRUCT) {
                //如果是类
                findType = infos[0].namespace + "::" + infos[0].name;
                break;
            }

            if(infos[0].type == TypeEnum.CALSS) {
                //如果是类
                findType = infos[0].namespace + "::" + infos[0].name;
                break;
            }
            
            //如果是函数
            if(infos[0].type == TypeEnum.VARIABLE) {
                //返回类型
                if(infos[0].extdata.length <= 0) {
                    continue;
                }
                let extJson = JSON.parse(infos[0].extdata);
                findType = extJson.t;
                break;
            }

            //如果是变量
            if(infos[0].type == TypeEnum.FUNCTION) {
                if(infos[0].extdata.length <= 0) {
                    continue;
                }
                let extJson = JSON.parse(infos[0].extdata);
                findType = extJson[0].r.t;
                break;
            }
        }

        return findType;
    };

    //通过owner取下面的方法或者变量
    getByOwnerNameInNamespace = function (ownname, namespace) {
        logger.mark("getByOwnerNameInNamespace");
        let infos = Store.getInstace().getByOwnerNameInNamespace(ownname, namespace);
        logger.mark("getByOwnerNameInNamespace");
        let showitem = [];
        //解释附加参数
        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];
            let items = this._getShowItem(info);
            showitem.push(items);
        }
        return showitem;
    };

    //判断是否纯命名空间，若不是，切出owner
    getNamespceAndOwner = function(namespaces) {
        let kws = KeyWordStore.getInstace();
        //判断是否为命名空间
        let _name = namespaces.pop();
        let _namespace = namespaces.join("::");
        let info = kws.getByFullname("", _namespace, _name, [1,2,3,4] );
        if(info.length <= 0) {
            //不是命名空间、类等等
            return false;
        }

        let namespace = "";
        let ownname = "";
        if(info[0].type == TypeEnum.NAMESPACE) {
            //命名空间
            namespaces.push(_name);
            namespace = namespaces.join("::");
            ownname = "";
            return {ns: namespace, ow: ownname};
        }

        //其他类型
        namespace = _namespace;
        ownname = _name;
        return {ns: namespace, ow: ownname};
    };

    //通过命名空间获取下面定义
    getOnlyByNamespace = function(namespace) {
        let kws = KeyWordStore.getInstace();
        let infos = []; 
        if(namespace == "std") {
            infos = kws.getByOwnNameNotStart_('', namespace);
        } else {
            infos = kws.getByOwnName('', namespace);
        }
        let showitem = [];
        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];
            let items = this._getShowItem(info);
            showitem.push(items);
        }
        return showitem;
    };

    //获取静态函数或者静态变量
    getStaticByMthedAndVal = function (ownames, namespace) {
        let kws = KeyWordStore.getInstace();
        let infos = kws.getByOwnName(ownames, namespace);
        let showitem = [];
        let showenumitem = [];
        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];
            if (info.type != TypeEnum.FUNCTION
                && info.type != TypeEnum.VARIABLE
                && info.type != TypeEnum.ENUMITEM) {
                continue;
            }
            let extJson = JSON.parse(info.extdata);
            if (info.type == TypeEnum.FUNCTION
                && extJson.length > 0
                && extJson[0].s == 1) {
                //静态函数
                let items = this._getShowItem(info);
                showitem.push(items);
            }

            if (info.type == TypeEnum.VARIABLE
                && extJson.s == 1) {
                //静态函数
                let items = this._getShowItem(info);
                showitem.push(items);
            }

            if (info.type == TypeEnum.ENUMITEM) {
                //静态函数
                let items = this._getShowItem(info);
                showenumitem.push(items);
            }
        }

        if(showitem.length < 15) {
            //如果大于50条是不加入枚举值
            showitem = showitem.concat(showenumitem);
        }

        return showitem;
    };

    //获取提示文档
    getShowDocument = function (ownname, namespace, name, type) {
        //找到定义详情
        let info = Store.getInstace().getByFullname(ownname, namespace, name, type);
        if (!info || info.length <= 0) {
            //没有找到父类
            return false;
        }

        let showtips = { t: '', d: '', f: 0 };
        type = info.type;
        if (type == TypeEnum.FUNCTION) {
            //函数
            this._processFunction(info);
            showtips = this._getShowTipsOnFunction(showtips, info);
            return showtips;
        }
        if (type == TypeEnum.VARIABLE) {
            //变量
            this._processVariable(info);
            showtips = this._getShowTipsOnVariable(showtips, info);
            return showtips;
        }
        if (type == TypeEnum.CALSS) {
            //类
            this._processClass(info);
            showtips = this._getShowTipsOnClass(showtips, info);
            return showtips;
        }
        if (type == TypeEnum.DEFINE) {
            //宏定义
            this._processClass(info);
            showtips = this._getShowTipsOnDefine(showtips, info);
            return showtips;
        }
        if (type == TypeEnum.ENUMITEM) {
            //枚举项
            this._processEnumItem(info);
            showtips = this._getShowTipsOnEnumItem(showtips, info);
            return showtips;
        }
        if (type == TypeEnum.TYPEDEF) {
            //枚举项
            this._processTypedefItem(info);
            showtips = this._getShowTipsOnTypedefItem(showtips, info);
            return showtips;
        }
        return showtips;
    };

    //获取局部变量定义
    _getDocumentDefine = function (preKw, ownname, defineval, showitem) {
        let keys = Object.keys(defineval);
        for (let i = 0; i < keys.length; i++) {
            let type = defineval[keys[i]];
            let name = keys[i];
            if (name.toLocaleLowerCase().indexOf(preKw.toLocaleLowerCase()) != 0) {
                continue;
            }
            
            let data = {
                "s": name,
                "t": TypeEnum.VARIABLE,
                "f": -1,
                "n": JSON.stringify({ n: name, s: "", o: ownname, t: type }),
                "i": 'document'
            };
            showitem.push(data);
        }
        return showitem;
    };

    //获取提示列表项
    _getShowItem = function (info) {
        let extJson = {};
        let insertCode = "";
        if (info.extdata != "") {
            extJson = JSON.parse(info.extdata);
            if (info.type == TypeEnum.FUNCTION) {
                //函数
                insertCode = info.name + "(";
                let index = 1;
                for(let i = 0; i < extJson[0].i.length; i++) {
                    let showTips = "【空格自动选参、TAB跳到下一个参数】";
                    if (extJson[0].i.length == 1) {
                        showTips = "";
                    }
                    insertCode = insertCode + (index > 1 ? "," : "") + "${" + index + ":" + extJson[0].i[i].n + (index == 1 ? showTips: "") + "}";
                    index++;
                }
                insertCode = insertCode + ")";
            }
            if (info.type == TypeEnum.DEFINE
                && extJson.p.length > 0){
                //宏定义
                insertCode = info.name + "(";
                let index = 1;
                for (let i = 0; i < extJson.p.length; i++) {
                    let showTips = "【空格自动选参、TAB跳到下一个参数】";
                    if (extJson.p.length == 1) {
                        showTips = "";
                    }
                    insertCode = insertCode + (index > 1 ? "," : "") + "${" + index + ":" + extJson.p[i] + (index == 1 ? showTips : "") + "}";
                    index++;
                }
                insertCode = insertCode + ")";
            }
        }
        
        let extData = JSON.stringify({ n: info.name, s: info.namespace, o: info.ownname, f: info.file_id, t: info.type});
        let data = {
            "s": info.name,
            "c": insertCode,
            "t": info.type,
            "f": info.file_id,
            "n": extData,
            "i": "index"
        };
        return data;
    };

    //函数处理
    _processFunction = function(infos, autoline = true) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos );
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);
        //logger.debug(extDataJson);
        //构造函数定义
        let allfundef = "";
        
        for (let k = 0; k < extDataJson.length; k++) {
            let extData = extDataJson[k];
            let fundef = "";
            //是否静态函数
            if (extData.s && extData.s == 1) {
                fundef = fundef + "static";
            }

            //返回值处理
            if (extData.r) {
                let returnDef = extData.r.t;
                if (extData.r.c == 1) {
                    returnDef = "const " + returnDef;
                }
                if (extData.r.a == 1) {
                    returnDef = returnDef + "&";
                }
                if (extData.r.p == 1) {
                    returnDef = returnDef + "*";
                }
                fundef = fundef + " " +  returnDef;
            }

            fundef = fundef + " " + infos.name;

            //函数参数体处理
            let params = "";
            let paramsarray = [];
            for (let i = 0; i < extData.i.length; i++) {
                let singParams = extData.i[i].t;
                if (extData.i[i].c == 1) {
                    singParams = "const " + singParams;
                }
                if (extData.i[i].a == 1) {
                    singParams = singParams + "&";
                }
                if (extData.i[i].p == 1) {
                    singParams = singParams + "*";
                }
                singParams = singParams + " " + extData.i[i].n;
                if (extData.i[i].v && extData.i[i].v != null){
                    singParams = singParams + " = " + extData.i[i].v;
                }

                paramsarray.push(singParams);
            }
            params = paramsarray.join(", ");
            if (params.length > 10 && autoline == true) {
                params = paramsarray.join(",\n  ");
                params = "\n  " + params;
            }

            //拼接参数体
            fundef = fundef + "(" +  params + ")"; 
            
            //const函数
            if (extData.c && extData.c == 1) {
                fundef = fundef + "const";
            }

            //模版定义
            if (extData.m && extData.m != "") {
                fundef = extData.m + "\n" + fundef;
            }
            allfundef = allfundef == "" ? fundef : allfundef + "\n" + fundef;
        }

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = allfundef;
    };

    //变量处理
    _processVariable = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);
        let vardef = extDataJson.t;
        if (extDataJson.c == 1) {
            vardef = "const " + vardef;
        }
        if (extDataJson.s == 1) {
            vardef = "static " + vardef;
        }
        if (extDataJson.a == 1) {
            vardef = vardef + "&";
        }
        if (extDataJson.p == 1) {
            vardef = vardef + "*";
        }
        vardef = vardef + " " + extDataJson.n;

        //默认值
        if (extDataJson.v && extDataJson.v != null) {
            vardef = vardef + " = " + extDataJson.v;
        }

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = vardef;
    };

    //类处理
    _processClass = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = "class";
    };

    //宏定义处理
    _processDefine = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = "class";
    };

    //枚举处理
    _processEnumItem = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);
        let neumdef = extDataJson.n + " = " + extDataJson.v;

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = neumdef;
    };

    //枚举处理
    _processTypedefItem = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);
        let neumdef = "typedef " + extDataJson.n + " " + extDataJson.v;

        //补充函数定义
        infos['extDataJson'] = extDataJson;
        infos['define'] = neumdef;
    };

    //通过函数名称和own获取函数定义
    _GetFunctionDefineByOwnAndName = function (names, ownname, usingnamespaces) {
        let _tmpinfo = KeyWordStore.getInstace().getByOwnNameAndName(['', ownname], names, usingnamespaces);
        if (_tmpinfo != false) {
            for (let i = 0; i < _tmpinfo.length; i++) {
                if (_tmpinfo[i].type == TypeEnum.FUNCTION) {
                    //只处理第一个函数
                    return _tmpinfo[i];
                }
                if (_tmpinfo[i].type == TypeEnum.DEFINE) {
                    let extJson = JSON.parse(_tmpinfo[i].extdata);
                    if (extJson.p.length > 0) {
                        //必须是带参数的宏定义
                        return _tmpinfo[i];
                    }
                }
            }
        }

        return false;
    };

    //获取静态或者命名空间下全局函数定义
    _GetStaticFunctionDefine = function (name, usingnamespaces) {
        let _pos = name.lastIndexOf("::");
        let _name = name, _namespace = "";
        if (_pos != -1) {
            _name = name.substring(_pos + 2);
            _namespace = name.substring(0, _pos);
            usingnamespaces.push(_namespace);
        }

        //尝试处理
        let _tmpinfo = KeyWordStore.getInstace().getByOwnNameAndName(['', _namespace], _name, usingnamespaces);
        if (_tmpinfo != false) {
            for (let i = 0; i < _tmpinfo.length; i++) {
                if (_tmpinfo[i].type == TypeEnum.FUNCTION) {
                    //只处理第一个函数
                    return _tmpinfo[i];
                }
            }
        }
        return false;
    };

    //类扩展
    _classAddInherits = function(name, namespace) {
        let _ownnames = [name];
        let _namespaces = [namespace];
        //获取类定义
        //只处理第一层继承
        let inherits = this.getInheritOfClassSample(name, namespace);
        for (let j = 0; j < inherits.length; j++) {
            let inheritsname = inherits[j];
            let data = DefineMap.getInstace().getRealName(inheritsname);
            // let _pos = inheritsname.lastIndexOf("::");
            // if (_pos != -1) {
            //     let __name = inheritsname.substring(_pos + 2);
            //     let __namespace = inheritsname.substring(0, _pos);
            //     _ownnames.push(__name);
            //     _namespaces.push(__namespace);
            //     continue;
            // }
            if (data.namespace != "") {
                _namespaces.push(data.namespace);
            }
            _ownnames.push(data.name);
        }
        //子类房前面
        return { _ownnames: _ownnames.reverse(), _namespace:_namespaces};
    };

    //获取函数定义
    _GetFunctionDefine = function (names, firstownname, usingnamespaces) {
        if (firstownname == "") {
            //全局函数或者本类的定义
            return false;
        }

        //找归属类
        let classname = firstownname;
        for (let i = names.length - 1; i >= 0 ; i--) {
            classname = this.getClassFullName(classname, usingnamespaces);
            let name = names[i];
            let _name = classname, _namespace = "";
            let ret = DefineMap.getInstace().getRealName(classname);
            _name = ret.name;
            _namespace = ret.namespace;

            //扩展继承父类
            let __ownnames =[];
            let __namespace = [];
            ret = this._classAddInherits(_name, _namespace);
            __ownnames = ret._ownnames;
            __namespace = ret._namespace;
            
            let _tmpinfos = KeyWordStore.getInstace().getByOwnNameAndName(__ownnames, name.n, __namespace);
            if (_tmpinfos.length == 0) {
                return false;
            }

            for (let j = 0; j < _tmpinfos.length; j++) {
                let _tmpinfo = _tmpinfos[j];
                if (_tmpinfo.type == TypeEnum.VARIABLE) {
                    //变量
                    let extJson = JSON.parse(_tmpinfo.extdata);
                    let type = extJson.t;
                    let tmptype = DefineMap.getInstace().getRealNameWithOwner(type, _name, _namespace);
                    classname = this.getMapedName(tmptype, classname, _name, _namespace);
                    break;
                }

                if (_tmpinfo.type == TypeEnum.FUNCTION) {
                    //函数
                    if (i == 0) {
                        //最后一个，直接返回函数定义
                        return _tmpinfo;
                    }
                    let extData = JSON.parse(_tmpinfo.extdata);
                    let type = extData[0].r.t;
                    let tmptype = DefineMap.getInstace().getRealNameWithOwner(type, _name, _namespace);
                    classname = this.getMapedName(tmptype, classname, _name, _namespace);
                    break;
                }
            }
        }

        return false;
    };

    //变量类型转义（typedef替换）
    getMapedName = function (tmptype, templatedef, __ownnames, __namespace) {
        if (__namespace == "std") {
            if (StdIteratorType.has(tmptype)) {
                //stl里面的迭代器实在太复杂了，这里简单处理，碰到这两个简化处理
                let paramsdef = DefineMap.getInstace().fromTemplateStrGetValDef(templatedef);
                if (__ownnames == "map" && paramsdef.length == 2) {
                    tmptype = "std::pair<" + paramsdef[0] + "," + paramsdef[1] + ">";
                    return tmptype;
                } if(tmptype == "__string_type") {
                    //字符类型
                    return "std::basic_string";
                } else {
                    let first = paramsdef[0];
                    tmptype = first;
                    return tmptype;
                }
            }
        }
        return DefineMap.getInstace().getTemplateValType(templatedef, tmptype);
    }

    //获取帮助参数
    _getSignatureHelp = function (filepath, info) {
        let _fundefine = this._processFunctionHelp(info);
        let functionhelp = {
            filepath: filepath,
            functiondef : _fundefine
        };
        return functionhelp;
    };

    //函数处理
    _processFunctionHelp = function (infos) {
        if (infos.extdata == "") {
            logger.error("extdata error", infos);
            return;
        }

        //序列化附加字段
        let extDataJson = JSON.parse(infos.extdata);
        if (infos.type == TypeEnum.DEFINE) {
            let def = infos.name;
            let params = [];
            for (let i = 0; i < extDataJson.p.length; i++) {
                params.push(extDataJson.p[i]);
            }
            def = def + "(" + params.join(',') + ")";
            //函数定义
            let functiondef = {
                functiondef: def,
                params: params
            };
            return [functiondef];
        }

        //构造函数定义
        let allfundef = [];
        for (let k = 0; k < extDataJson.length; k++) {
            let extData = extDataJson[k];
            let fundef = "";
            //是否静态函数
            if (extData.s && extData.s == 1) {
                fundef = fundef + "static";
            }

            //返回值处理
            if (extData.r) {
                let returnDef = extData.r.t;
                if (extData.r.c == 1) {
                    returnDef = "const " + returnDef;
                }
                if (extData.r.a == 1) {
                    returnDef = returnDef + "&";
                }
                if (extData.r.p == 1) {
                    returnDef = returnDef + "*";
                }
                fundef = fundef == "" ? returnDef : fundef + " " + returnDef;
            }

            fundef = fundef + " " + infos.name;
            //函数参数体处理
            let params = "";
            let paramsarray = [];
            for (let i = 0; i < extData.i.length; i++) {
                let singParams = extData.i[i].t;
                if (extData.i[i].c == 1) {
                    singParams = "const " + singParams;
                }
                if (extData.i[i].a == 1) {
                    singParams = singParams + "&";
                }
                if (extData.i[i].p == 1) {
                    singParams = singParams + "*";
                }
                singParams = singParams + " " + extData.i[i].n;
                if (extData.i[i].v && extData.i[i].v != null) {
                    singParams = singParams + " = " + extData.i[i].v;
                }
                
                paramsarray.push(singParams);
            }
            params = paramsarray.join(", ");

            //拼接参数体
            fundef = fundef + "(" + params + ")";

            //const函数
            if (extData.c && extData.c == 1) {
                fundef = fundef + "const";
            }

            //模版定义
            if (extData.m && extData.m != "") {
                fundef = extData.m + " " + fundef;
            }

            //函数定义
            let functiondef = {
                functiondef: fundef,
                params: paramsarray
            };
            allfundef.push(functiondef);
        }

        return allfundef;
    };

    //获取函数
    _getShowTipsOnFunction = function (showtips, info) {
        let showitem = { t: '', d: '', f: 0 };
        showitem.t = info.name;
        showitem.f = info.file_id;

        let filename = info.filepath;
        let ownsname = info.ownname;
        //归属，函数定义，定位文件
        let data = [];
        data.push("```cpp");
        data.push("类型：函数");
        if (info.namespace != "") {
            data.push("命名空间：" + info.namespace);
        } else {
            data.push("命名空间：全局");
        }
        data.push("归属：" + ownsname);
        data.push("函数定义：");
        data.push(info.define);
        data.push("文件：");
        data.push(filename);
        data.push("```");

        let doc = data.join('\n');
        showitem.d = doc + "\n" + showtips.d;
        return showitem;
    };

    //获取变量定义
    _getShowTipsOnVariable = function (showtips, info) {
        let showitem = { t: '', d: '', f: 0 };
        showitem.t = info.name;
        showitem.f = info.file_id;

        //归属，函数定义，定位文件
        let data = [];
        data.push("```cpp");
        let ownsname = info.ownname;
        data.push("类型：变量");

        if (info.namespace != "") {
            data.push("命名空间：" + info.namespace);
        } else {
            data.push("命名空间：全局");
        }
        data.push("归属：" + ownsname);
        data.push("变量类型：");
        data.push(info.extDataJson.t);
        data.push("变量定义：");
        data.push(info.define);
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");

        let doc = data.join("\n");
        showitem.d = doc + "\n" + showtips.d;
        return showitem;
    };

    //获取宏定义
    _getShowTipsOnDefine = function (showtips, info) {
        let showitem = { t: '', d: '', f: 0 };
        showitem.t = info.name;
        showitem.f = info.file_id;

        //归属，函数定义，定位文件
        let data = [];
        data.push("```cpp");
        data.push("类型：宏定义");
        if (info.namespace != "") {
            data.push("命名空间：" + info.namespace);
        } else {
            data.push("命名空间：全局");
        }
        data.push("归属：" + info.ownname);
        data.push("定义：");
        data.push(info.define);
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");

        let doc = data.join("\n");
        showitem.d = doc + "\n" + showtips.d;
        return showitem;
    };

    //获取名称
    _getShowTipsOnClass = function (showitem, info) {
        showitem.t = info.name;
        showitem.f = info.file_id;

        let data = [];
        data.push("```cpp");
        data.push("类型：类");
        if (info.namespace != "") {
            data.push("命名空间：" + info.namespace);
        } else {
            data.push("命名空间：全局");
        }
        if (info.ownname != "") {
            data.push("归属：" + info.ownname);
        } else {
            data.push("归属：全局");
        }
        data.push("定义：");
        data.push(info.define);
        data.push("继承关系：");
        let inherits = [];
        for (let i = 0; i < info.extDataJson.i.length; i++) {
            let classval = info.extDataJson.i[i];
            if (classval['p'] == '0') {
                inherits.push("public " + classval['n']);
            }
            if (classval['p'] == '1') {
                inherits.push("protected " + classval['n']);
            }
            if (classval['p'] == '2') {
                inherits.push("private " + classval['n']);
            }
        }
        data.push(inherits.join(";"));
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");
        let doc = data.join("\n");
        
        showitem.d = doc + "\n" + showitem.d;
        return showitem;
    };

    //获取名称
    _getShowTipsOnStuct = function (showitem, info) {
        showitem.t = info.name;
        showitem.f = info.file_id;

        let data = [];
        data.push("```cpp");
        data.push("类型：结构体");
        if (info.namespace != "") {
            data.push("命名空间" + info.namespace);
        } else {
            data.push("命名空间：全局");
        }
        
        if (info.ownname != "") {
            data.push("归属" + info.ownname);
        } else {
            data.push("归属：全局");
        }
        
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");
        let doc = data.join("\n");
        showitem.d = doc + "\n" + showitem.d;
        return showitem;
    };

    //枚举解释
    _getShowTipsOnEnum = function (showitem, info) {
        showitem.t = info.name;
        showitem.f = info.file_id;

        let data = [];
        data["类型"] = "枚举";
        data["命名空间"] = "全局";
        if (info.namespace != "") {
            data["命名空间"] = info.namespace;
        }
        data["归属"] = "全局";
        if (info.ownname != "") {
            data["归属"] = info.ownname;
        }
        data["定义文件"] = filepath;
        let doc = "";
        for (var key in data) {
            if (key == "") {
                doc = doc + data[key] + "\n";
                continue;
            }
            doc = doc + key + "：" + data[key] + "\n";
        }
        showitem.d = doc + "\n" + showitem.d;
        return showitem;
    };

    //枚举项
    _getShowTipsOnEnumItem = function (showitem, info) {
        showitem.t = info.name;
        showitem.f = info.file_id;

        let data = [];
        data.push("```cpp");
        data.push("类型：枚举值");
        data.push("命名空间：" +  info.namespace);
        data.push("归属：" + info.ownname);
        data.push("值定义：");
        data.push(info.define);
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");
        let doc = data.join("\n");
        showitem.d = doc + "\n" + showitem.d;
        return showitem;
    };

    //枚举项
    _getShowTipsOnTypedefItem = function (showitem, info) {
        showitem.t = info.name;
        showitem.f = info.file_id;

        let data = [];
        data.push("```cpp");
        data.push("类型：定义类型");
        data.push("命名空间：" + info.namespace);
        data.push("归属：" + info.ownname);
        data.push("值定义：");
        data.push(info.define);
        data.push("文件：");
        data.push(info.filepath);
        data.push("```");
        let doc = data.join("\n");
        showitem.d = doc + "\n" + showitem.d;
        return showitem;
    };
};

module.exports = {
    Completion
};