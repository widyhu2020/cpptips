/* --------------------------------------------------------------------------------------------
 * completion.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var Store = require('../store/store').Store;
var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
var KeyWordStore = require('../store/store').KeyWordStore;
var DefineMap = require('../definition/defineMap').DefineMap;
var StdIteratorType = require('../definition/defineMap').StdIteratorType;
var Completion = /** @class */ (function () {
    function Completion() {
        //获取类的全名称
        this.getClassFullName = function (name, namespaces) {
            var kws = KeyWordStore.getInstace();
            if (name.indexOf("::") != -1) {
                //已经包含命名空间，直接返回
                return name;
            }
            //没有命名空间的，需要找到全名称
            var findclass = kws.getByNameAndNamespaces(name, namespaces);
            if (findclass.length <= 0) {
                //没有找到父类
                return name;
            }
            //宏定义处理
            if (findclass.length == 1
                && findclass[0].type == TypeEnum.DEFINE) {
                //宏定义
                var extData = JSON.parse(findclass[0].extdata);
                return this.getClassFullName(extData.v, namespaces);
            }
            findclass.sort(function (a, b) {
                return b.namespace.length - a.namespace.length;
            });
            //只处理第一个，如果有多个这里忽略除一个以外的
            for (var i = 0; i < findclass.length; i++) {
                if (findclass[i].type != TypeEnum.CALSS
                    && findclass[i].type != TypeEnum.STRUCT) {
                    //不是类的定义
                    continue;
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
        this.getInheritOfClassSample = function (name, namespace) {
            var kws = KeyWordStore.getInstace();
            var classInfo = kws.getByFullnameAndType('', namespace, name, TypeEnum.CALSS);
            if (!classInfo) {
                return [];
            }
            var extData = JSON.parse(classInfo.extdata);
            if (extData.i.length == 0) {
                //没有继承
                return [];
            }
            var inherit = [];
            for (var i = 0; i < extData.i.length; i++) {
                var inheritclass = extData.i[i];
                if (inheritclass.p == 0) {
                    var classname = inheritclass.n;
                    inherit.push(classname);
                }
            }
            return inherit;
        };
        //获取类的继承父
        this.getInheritOfClass = function (name, namespace, usnamespace) {
            var kws = KeyWordStore.getInstace();
            var classInfo = kws.getByFullnameAndType('', namespace, name, TypeEnum.CALSS);
            if (!classInfo) {
                return [];
            }
            var extData = JSON.parse(classInfo.extdata);
            if (extData.i.length == 0) {
                //没有继承
                return [];
            }
            var inherit = [];
            for (var i = 0; i < extData.i.length; i++) {
                var inheritclass = extData.i[i];
                if (inheritclass.p == 0) {
                    var classname = inheritclass.n;
                    if (classname.indexOf("::") != -1) {
                        //只处理公有继承的方法
                        inherit.push(inheritclass.n);
                        continue;
                    }
                    //没有命名空间的，需要找到全名称
                    usnamespace.push(namespace);
                    var findclass = kws.getByNameAndNamespaces(classname, usnamespace);
                    if (findclass.length <= 0) {
                        //没有找到父类
                        continue;
                    }
                    for (var i_1 = 0; i_1 < findclass.length; i_1++) {
                        if (findclass[i_1].type != TypeEnum.CALSS) {
                            //不是类的定义
                            continue;
                        }
                        //只处理第一个，如果有多个这里忽略除一个以外的
                        inherit.push(findclass[i_1].namespace + "::" + findclass[i_1].name);
                        break;
                    }
                }
            }
            return inherit;
        };
        //输入前缀和命名空间，获取智能提示列表
        this.querByPreKwInNamepsace = function (preKw, namespaces, ownname, defineval, gettype) {
            if (gettype === void 0) { gettype = []; }
            namespaces = namespaces.filter(function (e) { return e != ""; });
            var showitem = [];
            this._getDocumentDefine(preKw, ownname, defineval, showitem);
            console.time("freezFindAllByPreKeyword");
            var infos = Store.getInstace().freezFindAllByPreKeyword(preKw, namespaces, ownname);
            console.timeEnd("freezFindAllByPreKeyword");
            //解释附加参数
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                var items = this._getShowItem(info);
                showitem.push(items);
            }
            return showitem;
        };
        //限定作用域模糊查找
        this.querByPreKwWithOwner = function (preKw, namespace, owname) {
            var infos = [];
            if (owname == "") {
                infos = Store.getInstace().freezGetByNameAndNamespaces(preKw, [namespace]);
            }
            else {
                infos = Store.getInstace().freezFindRestrictByPreKeyword(preKw, [namespace], owname);
            }
            //解释附加参数
            var showitem = [];
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                var items = this._getShowItem(info);
                showitem.push(items);
            }
            return showitem;
        };
        //通过owner和名称以及命名空间获取类型
        this.getTypeByOwnerAndNameInNamespace = function (ownname, name, namespaces) {
            var infos = KeyWordStore.getInstace().getByOwnNameAndName([ownname], name, namespaces);
            if (infos.length <= 0) {
                return false;
            }
            else if (infos.length > 1) {
                infos.sort(function (a, b) {
                    return b.namespace.length - a.namespace.length;
                });
            }
            var findType = false;
            for (var i = 0; i < infos.length; i++) {
                if (infos[0].type == TypeEnum.STRUCT) {
                    //如果是类
                    findType = infos[0].namespace + "::" + infos[0].name;
                    break;
                }
                if (infos[0].type == TypeEnum.CALSS) {
                    //如果是类
                    findType = infos[0].namespace + "::" + infos[0].name;
                    break;
                }
                //如果是函数
                if (infos[0].type == TypeEnum.VARIABLE) {
                    //返回类型
                    if (infos[0].extdata.length <= 0) {
                        continue;
                    }
                    var extJson = JSON.parse(infos[0].extdata);
                    findType = extJson.t;
                    break;
                }
                //如果是变量
                if (infos[0].type == TypeEnum.FUNCTION) {
                    if (infos[0].extdata.length <= 0) {
                        continue;
                    }
                    var extJson = JSON.parse(infos[0].extdata);
                    findType = extJson[0].r.t;
                    break;
                }
            }
            return findType;
        };
        //通过owner取下面的方法或者变量
        this.getByOwnerNameInNamespace = function (ownname, namespace) {
            console.time("getByOwnerNameInNamespace");
            var infos = Store.getInstace().getByOwnerNameInNamespace(ownname, namespace);
            console.timeEnd("getByOwnerNameInNamespace");
            var showitem = [];
            //解释附加参数
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                var items = this._getShowItem(info);
                showitem.push(items);
            }
            return showitem;
        };
        //判断是否纯命名空间，若不是，切出owner
        this.getNamespceAndOwner = function (namespaces) {
            var kws = KeyWordStore.getInstace();
            //判断是否为命名空间
            var _name = namespaces.pop();
            var _namespace = namespaces.join("::");
            var info = kws.getByFullname("", _namespace, _name, [1, 2, 3, 4]);
            if (info.length <= 0) {
                //不是命名空间、类等等
                return false;
            }
            var namespace = "";
            var ownname = "";
            if (info[0].type == TypeEnum.NAMESPACE) {
                //命名空间
                namespaces.push(_name);
                namespace = namespaces.join("::");
                ownname = "";
                return { ns: namespace, ow: ownname };
            }
            //其他类型
            namespace = _namespace;
            ownname = _name;
            return { ns: namespace, ow: ownname };
        };
        //通过命名空间获取下面定义
        this.getOnlyByNamespace = function (namespace) {
            var kws = KeyWordStore.getInstace();
            var infos = [];
            if (namespace == "std") {
                infos = kws.getByOwnNameNotStart_('', namespace);
            }
            else {
                infos = kws.getByOwnName('', namespace);
            }
            var showitem = [];
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                var items = this._getShowItem(info);
                showitem.push(items);
            }
            return showitem;
        };
        //获取静态函数或者静态变量
        this.getStaticByMthedAndVal = function (ownames, namespace) {
            var kws = KeyWordStore.getInstace();
            var infos = kws.getByOwnName(ownames, namespace);
            var showitem = [];
            var showenumitem = [];
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                if (info.type != TypeEnum.FUNCTION
                    && info.type != TypeEnum.VARIABLE
                    && info.type != TypeEnum.ENUMITEM) {
                    continue;
                }
                var extJson = JSON.parse(info.extdata);
                if (info.type == TypeEnum.FUNCTION
                    && extJson.length > 0
                    && extJson[0].s == 1) {
                    //静态函数
                    var items = this._getShowItem(info);
                    showitem.push(items);
                }
                if (info.type == TypeEnum.VARIABLE
                    && extJson.s == 1) {
                    //静态函数
                    var items = this._getShowItem(info);
                    showitem.push(items);
                }
                if (info.type == TypeEnum.ENUMITEM) {
                    //静态函数
                    var items = this._getShowItem(info);
                    showenumitem.push(items);
                }
            }
            if (showitem.length < 15) {
                //如果大于50条是不加入枚举值
                showitem = showitem.concat(showenumitem);
            }
            return showitem;
        };
        //获取提示文档
        this.getShowDocument = function (ownname, namespace, name, type) {
            //找到定义详情
            var info = Store.getInstace().getByFullname(ownname, namespace, name, type);
            if (!info || info.length <= 0) {
                //没有找到父类
                return false;
            }
            var showtips = { t: '', d: '', f: 0 };
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
        this._getDocumentDefine = function (preKw, ownname, defineval, showitem) {
            var keys = Object.keys(defineval);
            for (var i = 0; i < keys.length; i++) {
                var type = defineval[keys[i]];
                var name_1 = keys[i];
                if (name_1.toLocaleLowerCase().indexOf(preKw.toLocaleLowerCase()) != 0) {
                    continue;
                }
                var data = {
                    "s": name_1,
                    "t": TypeEnum.VARIABLE,
                    "f": -1,
                    "n": JSON.stringify({ n: name_1, s: "", o: ownname, t: type }),
                    "i": 'document'
                };
                showitem.push(data);
            }
            return showitem;
        };
        //获取提示列表项
        this._getShowItem = function (info) {
            var extJson = {};
            var insertCode = "";
            if (info.extdata != "") {
                extJson = JSON.parse(info.extdata);
                if (info.type == TypeEnum.FUNCTION) {
                    //函数
                    insertCode = info.name + "(";
                    var index = 1;
                    for (var i = 0; i < extJson[0].i.length; i++) {
                        var showTips = "【按Tab键切换到下个参数】";
                        if (extJson[0].i.length == 1) {
                            showTips = "";
                        }
                        insertCode = insertCode + (index > 1 ? "," : "") + "${" + index + ":" + extJson[0].i[i].n + (index == 1 ? showTips : "") + "}";
                        index++;
                    }
                    insertCode = insertCode + ")";
                }
                if (info.type == TypeEnum.DEFINE
                    && extJson.p.length > 0) {
                    //宏定义
                    insertCode = info.name + "(";
                    var index = 1;
                    for (var i = 0; i < extJson.p.length; i++) {
                        var showTips = "【按Tab键切换到下个参数】";
                        if (extJson.p.length == 1) {
                            showTips = "";
                        }
                        insertCode = insertCode + (index > 1 ? "," : "") + "${" + index + ":" + extJson.p[i] + (index == 1 ? showTips : "") + "}";
                        index++;
                    }
                    insertCode = insertCode + ")";
                }
            }
            var extData = JSON.stringify({ n: info.name, s: info.namespace, o: info.ownname, f: info.file_id, t: info.type });
            var data = {
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
        this._processFunction = function (infos, autoline) {
            if (autoline === void 0) { autoline = true; }
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            //console.log(extDataJson);
            //构造函数定义
            var allfundef = "";
            for (var k = 0; k < extDataJson.length; k++) {
                var extData = extDataJson[k];
                var fundef = "";
                //是否静态函数
                if (extData.s && extData.s == 1) {
                    fundef = fundef + "static";
                }
                //返回值处理
                if (extData.r) {
                    var returnDef = extData.r.t;
                    if (extData.r.c == 1) {
                        returnDef = "const " + returnDef;
                    }
                    if (extData.r.a == 1) {
                        returnDef = returnDef + "&";
                    }
                    if (extData.r.p == 1) {
                        returnDef = returnDef + "*";
                    }
                    fundef = fundef + " " + returnDef;
                }
                fundef = fundef + " " + infos.name;
                //函数参数体处理
                var params = "";
                var paramsarray = [];
                for (var i = 0; i < extData.i.length; i++) {
                    var singParams = extData.i[i].t;
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
                if (params.length > 10 && autoline == true) {
                    params = paramsarray.join(",\n  ");
                    params = "\n  " + params;
                }
                //拼接参数体
                fundef = fundef + "(" + params + ")";
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
        this._processVariable = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            var vardef = extDataJson.t;
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
        this._processClass = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            //补充函数定义
            infos['extDataJson'] = extDataJson;
            infos['define'] = "class";
        };
        //宏定义处理
        this._processDefine = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            //补充函数定义
            infos['extDataJson'] = extDataJson;
            infos['define'] = "class";
        };
        //枚举处理
        this._processEnumItem = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            var neumdef = extDataJson.n + " = " + extDataJson.v;
            //补充函数定义
            infos['extDataJson'] = extDataJson;
            infos['define'] = neumdef;
        };
        //枚举处理
        this._processTypedefItem = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            var neumdef = "typedef " + extDataJson.n + " " + extDataJson.v;
            //补充函数定义
            infos['extDataJson'] = extDataJson;
            infos['define'] = neumdef;
        };
        //通过函数名称和own获取函数定义
        this._GetFunctionDefineByOwnAndName = function (names, ownname, usingnamespaces) {
            var _tmpinfo = KeyWordStore.getInstace().getByOwnNameAndName(['', ownname], names, usingnamespaces);
            if (_tmpinfo != false) {
                for (var i = 0; i < _tmpinfo.length; i++) {
                    if (_tmpinfo[i].type == TypeEnum.FUNCTION) {
                        //只处理第一个函数
                        return _tmpinfo[i];
                    }
                    if (_tmpinfo[i].type == TypeEnum.DEFINE) {
                        var extJson = JSON.parse(_tmpinfo[i].extdata);
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
        this._GetStaticFunctionDefine = function (name, usingnamespaces) {
            var _pos = name.lastIndexOf("::");
            var _name = name, _namespace = "";
            if (_pos != -1) {
                _name = name.substring(_pos + 2);
                _namespace = name.substring(0, _pos);
                usingnamespaces.push(_namespace);
            }
            //尝试处理
            var _tmpinfo = KeyWordStore.getInstace().getByOwnNameAndName(['', _namespace], _name, usingnamespaces);
            if (_tmpinfo != false) {
                for (var i = 0; i < _tmpinfo.length; i++) {
                    if (_tmpinfo[i].type == TypeEnum.FUNCTION) {
                        //只处理第一个函数
                        return _tmpinfo[i];
                    }
                }
            }
            return false;
        };
        //类扩展
        this._classAddInherits = function (name, namespace) {
            var _ownnames = [name];
            var _namespaces = [namespace];
            //获取类定义
            //只处理第一层继承
            var inherits = this.getInheritOfClassSample(name, namespace);
            for (var j = 0; j < inherits.length; j++) {
                var inheritsname = inherits[j];
                var data = DefineMap.getInstace().getRealName(inheritsname);
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
            return { _ownnames: _ownnames.reverse(), _namespace: _namespaces };
        };
        //获取函数定义
        this._GetFunctionDefine = function (names, firstownname, usingnamespaces) {
            if (firstownname == "") {
                //全局函数或者本类的定义
                return false;
            }
            //找归属类
            var classname = firstownname;
            for (var i = names.length - 1; i >= 0; i--) {
                classname = this.getClassFullName(classname, usingnamespaces);
                var name_2 = names[i];
                var _name = classname, _namespace = "";
                var ret = DefineMap.getInstace().getRealName(classname);
                _name = ret.name;
                _namespace = ret.namespace;
                //扩展继承父类
                var __ownnames = [];
                var __namespace = [];
                ret = this._classAddInherits(_name, _namespace);
                __ownnames = ret._ownnames;
                __namespace = ret._namespace;
                var _tmpinfos = KeyWordStore.getInstace().getByOwnNameAndName(__ownnames, name_2.n, __namespace);
                if (_tmpinfos.length == 0) {
                    return false;
                }
                for (var j = 0; j < _tmpinfos.length; j++) {
                    var _tmpinfo = _tmpinfos[j];
                    if (_tmpinfo.type == TypeEnum.VARIABLE) {
                        //变量
                        var extJson = JSON.parse(_tmpinfo.extdata);
                        var type = extJson.t;
                        var tmptype = DefineMap.getInstace().getRealNameWithOwner(type, _name, _namespace);
                        classname = this.getMapedName(tmptype, classname, _name, _namespace);
                        break;
                    }
                    if (_tmpinfo.type == TypeEnum.FUNCTION) {
                        //函数
                        if (i == 0) {
                            //最后一个，直接返回函数定义
                            return _tmpinfo;
                        }
                        var extData = JSON.parse(_tmpinfo.extdata);
                        var type = extData[0].r.t;
                        var tmptype = DefineMap.getInstace().getRealNameWithOwner(type, _name, _namespace);
                        classname = this.getMapedName(tmptype, classname, _name, _namespace);
                        break;
                    }
                }
            }
            return false;
        };
        //变量类型转义（typedef替换）
        this.getMapedName = function (tmptype, templatedef, __ownnames, __namespace) {
            if (__namespace == "std") {
                if (StdIteratorType.has(tmptype)) {
                    //stl里面的迭代器实在太复杂了，这里简单处理，碰到这两个简化处理
                    var paramsdef = DefineMap.getInstace().fromTemplateStrGetValDef(templatedef);
                    if (__ownnames == "map" && paramsdef.length == 2) {
                        tmptype = "std::pair<" + paramsdef[0] + "," + paramsdef[1] + ">";
                        return tmptype;
                    }
                    else {
                        var first = paramsdef[0];
                        tmptype = first;
                        return tmptype;
                    }
                }
            }
            return DefineMap.getInstace().getTemplateValType(templatedef, tmptype);
        };
        //获取帮助参数
        this._getSignatureHelp = function (filepath, info) {
            var _fundefine = this._processFunctionHelp(info);
            var functionhelp = {
                filepath: filepath,
                functiondef: _fundefine
            };
            return functionhelp;
        };
        //函数处理
        this._processFunctionHelp = function (infos) {
            if (infos.extdata == "") {
                console.error("extdata error", infos);
                return;
            }
            //序列化附加字段
            var extDataJson = JSON.parse(infos.extdata);
            if (infos.type == TypeEnum.DEFINE) {
                var def = infos.name;
                var params = [];
                for (var i = 0; i < extDataJson.p.length; i++) {
                    params.push(extDataJson.p[i]);
                }
                def = def + "(" + params.join(',') + ")";
                //函数定义
                var functiondef = {
                    functiondef: def,
                    params: params
                };
                return [functiondef];
            }
            //构造函数定义
            var allfundef = [];
            for (var k = 0; k < extDataJson.length; k++) {
                var extData = extDataJson[k];
                var fundef = "";
                //是否静态函数
                if (extData.s && extData.s == 1) {
                    fundef = fundef + "static";
                }
                //返回值处理
                if (extData.r) {
                    var returnDef = extData.r.t;
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
                var params = "";
                var paramsarray = [];
                for (var i = 0; i < extData.i.length; i++) {
                    var singParams = extData.i[i].t;
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
                var functiondef = {
                    functiondef: fundef,
                    params: paramsarray
                };
                allfundef.push(functiondef);
            }
            return allfundef;
        };
        //获取函数
        this._getShowTipsOnFunction = function (showtips, info) {
            var showitem = { t: '', d: '', f: 0 };
            showitem.t = info.name;
            showitem.f = info.file_id;
            var filename = info.filepath;
            var ownsname = info.ownname;
            //归属，函数定义，定位文件
            var data = [];
            data.push("```cpp");
            data.push("类型：函数");
            if (info.namespace != "") {
                data.push("命名空间：" + info.namespace);
            }
            else {
                data.push("命名空间：全局");
            }
            data.push("归属：" + ownsname);
            data.push("函数定义：");
            data.push(info.define);
            data.push("文件：");
            data.push(filename);
            data.push("```");
            var doc = data.join('\n');
            showitem.d = doc + "\n" + showtips.d;
            return showitem;
        };
        //获取变量定义
        this._getShowTipsOnVariable = function (showtips, info) {
            var showitem = { t: '', d: '', f: 0 };
            showitem.t = info.name;
            showitem.f = info.file_id;
            //归属，函数定义，定位文件
            var data = [];
            data.push("```cpp");
            var ownsname = info.ownname;
            data.push("类型：变量");
            if (info.namespace != "") {
                data.push("命名空间：" + info.namespace);
            }
            else {
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
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showtips.d;
            return showitem;
        };
        //获取宏定义
        this._getShowTipsOnDefine = function (showtips, info) {
            var showitem = { t: '', d: '', f: 0 };
            showitem.t = info.name;
            showitem.f = info.file_id;
            //归属，函数定义，定位文件
            var data = [];
            data.push("```cpp");
            data.push("类型：宏定义");
            if (info.namespace != "") {
                data.push("命名空间：" + info.namespace);
            }
            else {
                data.push("命名空间：全局");
            }
            data.push("归属：" + info.ownname);
            data.push("定义：");
            data.push(info.define);
            data.push("文件：");
            data.push(info.filepath);
            data.push("```");
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showtips.d;
            return showitem;
        };
        //获取名称
        this._getShowTipsOnClass = function (showitem, info) {
            showitem.t = info.name;
            showitem.f = info.file_id;
            var data = [];
            data.push("```cpp");
            data.push("类型：类");
            if (info.namespace != "") {
                data.push("命名空间：" + info.namespace);
            }
            else {
                data.push("命名空间：全局");
            }
            if (info.ownname != "") {
                data.push("归属：" + info.ownname);
            }
            else {
                data.push("归属：全局");
            }
            data.push("定义：");
            data.push(info.define);
            data.push("继承关系：");
            var inherits = [];
            for (var i = 0; i < info.extDataJson.i.length; i++) {
                var classval = info.extDataJson.i[i];
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
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showitem.d;
            return showitem;
        };
        //获取名称
        this._getShowTipsOnStuct = function (showitem, info) {
            showitem.t = info.name;
            showitem.f = info.file_id;
            var data = [];
            data.push("```cpp");
            data.push("类型：结构体");
            if (info.namespace != "") {
                data.push("命名空间" + info.namespace);
            }
            else {
                data.push("命名空间：全局");
            }
            if (info.ownname != "") {
                data.push("归属" + info.ownname);
            }
            else {
                data.push("归属：全局");
            }
            data.push("文件：");
            data.push(info.filepath);
            data.push("```");
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showitem.d;
            return showitem;
        };
        //枚举解释
        this._getShowTipsOnEnum = function (showitem, info) {
            showitem.t = info.name;
            showitem.f = info.file_id;
            var data = [];
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
            var doc = "";
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
        this._getShowTipsOnEnumItem = function (showitem, info) {
            showitem.t = info.name;
            showitem.f = info.file_id;
            var data = [];
            data.push("```cpp");
            data.push("类型：枚举值");
            data.push("命名空间：" + info.namespace);
            data.push("归属：" + info.ownname);
            data.push("值定义：");
            data.push(info.define);
            data.push("文件：");
            data.push(info.filepath);
            data.push("```");
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showitem.d;
            return showitem;
        };
        //枚举项
        this._getShowTipsOnTypedefItem = function (showitem, info) {
            showitem.t = info.name;
            showitem.f = info.file_id;
            var data = [];
            data.push("```cpp");
            data.push("类型：定义类型");
            data.push("命名空间：" + info.namespace);
            data.push("归属：" + info.ownname);
            data.push("值定义：");
            data.push(info.define);
            data.push("文件：");
            data.push(info.filepath);
            data.push("```");
            var doc = data.join("\n");
            showitem.d = doc + "\n" + showitem.d;
            return showitem;
        };
        //Store.getInstace(dbfile);
    }
    return Completion;
}());
;
module.exports = {
    Completion: Completion
};
