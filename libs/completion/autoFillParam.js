/* --------------------------------------------------------------------------------------------
 * definition.js
 *
 *  Created on: 2020年4月25日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
var KeyWordStore = require('../store/store').KeyWordStore;
var FileIndexStore = require('../store/store').FileIndexStore;
var Completion = require('../completion/completion').Completion;
var fs = require('fs');
var path = require('path');
var logger = require('log4js').getLogger("cpptips");
var AutoFillParam = /** @class */ (function (_super) {
    __extends(AutoFillParam, _super);
    function AutoFillParam() {
        var _this = _super.call(this) || this;
        _this.setParamsInfo = function (filecontext, paramsStr, paramsPos) {
            this.filecontext = filecontext;
            this.paramsPos = paramsPos;
            this.paramsStr = paramsStr;
            this.functionName = "";
            this.paramsName = "";
        };
        _this.autoAnalyseParams = function (objName, functionName, namespaces) {
            this.functionName = functionName;
            var fucInfo = this._getFunctionDefine(objName, namespaces);
            if (!fucInfo) {
                //没有找到函数定义
                return false;
            }
            //获取函数的参数列表
            var paramsType = [];
            var extJson = JSON.parse(fucInfo.extdata);
            for (var i = 0; i < extJson.length; i++) {
                var params = extJson[i].i;
                if (params.length >= this.paramsPos) {
                    //只处理第一个重载
                    paramsType.push(params[this.paramsPos - 1]);
                    this.paramsName = params[this.paramsPos - 1].n;
                    break;
                }
            }
            //获取当前定义变量
            var nameMap = this._getAllVarDefine(objName, this.filecontext, namespaces);
            logger.debug(JSON.stringify(nameMap));
            var selectList = [];
            for (var i = 0; i < paramsType.length; i++) {
                var type = paramsType[i].t;
                type = type.replace(/[\s*\s]{1,10}/g, "* ");
                if (type.indexOf("::") < 0) {
                    type = this.getClassFullName(type, namespaces);
                }
                if (nameMap[type]) {
                    //匹配到类型
                    selectList = selectList.concat(nameMap[type]);
                }
                else {
                    //同名
                    if (nameMap[objName]) {
                        selectList = selectList.concat(nameMap[objName]);
                    }
                }
            }
            //构造返回数据
            var retData = [];
            for (var i = 0; i < selectList.length; i++) {
                retData.push(this._makeReturnStruct(selectList[i]));
            }
            retData.sort(function (a, b) { return a.d - b.d; });
            return retData;
        };
        //尝试获取未归属或者默认this归属
        _this.getRealOwnByName = function (name, ownnames, namespaces) {
            var keydb = KeyWordStore.getInstace();
            var infos = keydb.getByOwnNameAndName(ownnames, name, namespaces);
            if (infos.length <= 0) {
                return false;
            }
            //取第一个，多个忽略其他
            var realName = infos[0].ownname;
            if (infos[0].namespace.length > 0) {
                realName = infos[0].namespace + "::" + infos[0].ownname;
            }
            return realName;
        };
        _this._makeReturnStruct = function (type) {
            var _type = type.name;
            var _degree = type.degree;
            var extData = JSON.stringify({ n: "", s: "", o: this.functionName, f: -1, t: TypeEnum.FUNCTION, d: _degree });
            var node = {
                s: _type,
                t: TypeEnum.FUNCTION,
                n: extData,
                f: "",
                i: "",
                d: _degree,
                c: _type
            };
            return node;
        };
        //获取所有定义
        _this._getAllVarDefine = function (objName, filecontext, namespaces) {
            //去掉模版定义里面的空格
            var typeMap = {};
            var keyword = new Set(["using_ns", "const", "struct", "class", "enum", "namespace", "interface"]);
            filecontext.replace(/<[\w\s,]{1,256}>/g, function (kw) { return kw.replace(/[\s]{1,10}/g, ""); });
            var reg = /((([\w]{3,64}::){0,5}[\w]{1,64})|(([\w]{1,64}::){0,5}[\w]{1,64}<[,\s]{0,4}([\w]{1,64}::){0,5}[\w]{1,64})>)[*&\s\t]{1,20}([\w]{1,64})[\s]{0,10}[=;,)]{1,1}/g;
            var result = filecontext.match(reg);
            for (var i = 0; i < result.length; i++) {
                var valDefineReg = /((([\w]{1,64}::){0,5}[\w]{1,64})|(([\w]{1,64}::){0,5}[\w]{1,64}<[,\s]{0,4}([\w]{1,64}::){0,5}[\w]{1,64})>)[*&\s\t]{1,20}([\w]{1,64})[\s]{0,10}[=;,)]{1,1}/g;
                var code = result[i];
                var getResult = valDefineReg.exec(code);
                var type = getResult[1];
                var name_1 = getResult[7];
                if (keyword.has(type)) {
                    //命中关键字
                    continue;
                }
                typeMap = this._getObjectFunction(typeMap, false, name_1, type, namespaces, 0);
            }
            return typeMap;
        };
        //获取对象对应的方法
        _this._getObjectFunction = function (codes, ispoint, preown, type, namespaces, displayDegree, depth) {
            if (depth === void 0) { depth = 0; }
            if (depth > 3) {
                //大于3层的结构体这里不进行分析
                return codes;
            }
            depth = depth + 1;
            var newcode = preown;
            codes = this._saveTypeToName(codes, type, newcode, displayDegree);
            var sampleType = new Set([
                "int", "char", "uint32_t", "uint64_t", "int32_t", "int64_t", "bool", "float", "double", "int16_t", "uint16_t",
                "int*", "char*", "uint32_t*", "uint64_t*", "int32_t*", "int64_t*", "bool*", "float*", "double*", "int16_t*", "uint16_t*",
                "unsigned int", "long", "long long", "unsigned long", "unsigned int*", "long*", "long long*", "unsigned long*"
            ]);
            if (sampleType.has(type)) {
                //简单类型无需在继续查找方法
                return codes;
            }
            var usenamespace = namespaces;
            var keydb = KeyWordStore.getInstace();
            var hasnamespace = new Set(namespaces);
            var ownname = type;
            if (type.indexOf("::") != -1) {
                //包含命名空间
                var _pos = type.lastIndexOf("::");
                var namespace = type.substring(0, _pos);
                ownname = type.substring(_pos + 2);
                if (!hasnamespace.has(namespace)) {
                    //不能使用累计的命名空间，否则可能拉出不属于该命名空间的定义
                    usenamespace = [];
                    usenamespace.push(namespace);
                    hasnamespace.add(namespace);
                }
            }
            if (ownname == "string") {
                //字符串，只返回c_str//暂时不出c_str
                var _type = preown + ".c_str()";
                if (ispoint) {
                    _type = preown + "->c_str()";
                }
                return codes;
            }
            if (ownname == "") {
                logger.debug(ownname, preown, type);
                return codes;
            }
            logger.mark("getByOwnNameAndNs");
            var functions = keydb.getByOwnNameAndNs(ownname, usenamespace);
            logger.mark("getByOwnNameAndNs");
            for (var i = 0; i < functions.length; i++) {
                var func = functions[i];
                if (!func.extdata || func.extdata.length <= 0) {
                    //没有收集函数
                    continue;
                }
                var funcname = func.name;
                if (/^mutable_|^add_|^has_/g.test(funcname)) {
                    //protobuf明确写入的函数不考虑在内
                    continue;
                }
                var _displayDegree = this.similar(this.cleanProtobufWord(funcname), this.cleanProtobufWord(this.paramsName.toLowerCase()));
                var _funcisplayDegree = this.similar(this.cleanProtobufWord(funcname), this.cleanProtobufWord(this.functionName.toLowerCase()));
                logger.debug(funcname, this.paramsName, this.functionName, "相似度：", _displayDegree, _funcisplayDegree);
                if (_funcisplayDegree > _displayDegree) {
                    //使用匹配度高的
                    _displayDegree = _funcisplayDegree;
                }
                _displayDegree = _displayDegree * 1000;
                var extJson = JSON.parse(func.extdata);
                for (var j = 0; j < extJson.length; j++) {
                    var funcparams = extJson[j];
                    var type_1 = funcparams.r.t;
                    if (_displayDegree < 500
                        && (sampleType.has(type_1) || type_1 == "string" || type_1 == "std::string")) {
                        //显示度小于指定值的全部忽略
                        continue;
                    }
                    var _ispoint = false;
                    if (funcparams.r.p != 0) {
                        _ispoint = true;
                    }
                    if (!ispoint) {
                        preown = newcode + "." + funcname + "(";
                    }
                    else {
                        preown = newcode + "->" + funcname + "(";
                    }
                    if (funcparams.i.length > 0) {
                        preown = preown + "%params%)";
                    }
                    else {
                        preown = preown + ")";
                    }
                    codes = this._getObjectFunction(codes, _ispoint, preown, type_1, namespaces, _displayDegree, depth);
                }
            }
            return codes;
        };
        //去掉proto生成的头
        _this.cleanProtobufWord = function (name) {
            name = name.toLowerCase();
            name = name.replace(/^(add_|set_|has_|mutable_)/g, "");
            name = name.replace(/[_]{1,4}/g, "");
            return name;
        };
        //比较两个字符相似度
        //来源csdn
        _this.similar = function (s, t, f) {
            if (!s || !t) {
                return 0;
            }
            var l = s.length > t.length ? s.length : t.length;
            var n = s.length;
            var m = t.length;
            var d = [];
            f = f || 3;
            var min = function (a, b, c) {
                return a < b ? (a < c ? a : c) : (b < c ? b : c);
            };
            var i, j, si, tj, cost;
            if (n === 0)
                return m;
            if (m === 0)
                return n;
            for (i = 0; i <= n; i++) {
                d[i] = [];
                d[i][0] = i;
            }
            for (j = 0; j <= m; j++) {
                d[0][j] = j;
            }
            for (i = 1; i <= n; i++) {
                si = s.charAt(i - 1);
                for (j = 1; j <= m; j++) {
                    tj = t.charAt(j - 1);
                    if (si === tj) {
                        cost = 0;
                    }
                    else {
                        cost = 1;
                    }
                    d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
                }
            }
            var res = (1 - d[n][m] / l);
            return res.toFixed(f);
        };
        _this._saveTypeToName = function (codes, type, name, displayDegree) {
            if (!codes[type]) {
                codes[type] = [{ name: name, degree: displayDegree }];
                return codes;
            }
            codes[type].push({ name: name, degree: displayDegree });
            return codes;
        };
        _this._getFunctionDefine = function (objName, namespaces) {
            var name = objName;
            var _pos = objName.lastIndexOf("::");
            if (_pos != -1) {
                name = objName.substring(_pos + 2);
                var namespace = objName.substring(0, _pos);
                namespaces.push(namespace);
            }
            var fucInfos = KeyWordStore.getInstace().getByFullnameNssAndType(name, namespaces, this.functionName, TypeEnum.FUNCTION);
            if (!fucInfos || fucInfos.length <= 0
                || fucInfos[0].extdata == "") {
                //没有找到函数定义
                //尝试找基类
                var classinfo = KeyWordStore.getInstace().getByFullnameNssAndType("", namespaces, name, TypeEnum.CALSS);
                if (!classinfo) {
                    //未找到类
                    return false;
                }
                var jsonExt = classinfo[0].extdata;
                if (jsonExt.length <= 0) {
                    //未找继承类
                    return false;
                }
                var jsonData = JSON.parse(jsonExt);
                var ownnames = [];
                ownnames.push(name);
                //获取继承的父亲
                for (var i = 0; i < jsonData.i.length; i++) {
                    var _tmpName = jsonData.i[i].n.replace(/\<[\w,]{2,256}\>/, "");
                    var _pos_1 = _tmpName.lastIndexOf("::");
                    var _tmpClassName = _tmpName.substring(_pos_1 + 2);
                    var _tmpnamespace = _tmpName.substring(0, _pos_1);
                    namespaces.push(_tmpnamespace);
                    ownnames.push(_tmpClassName);
                }
                var infos = KeyWordStore.getInstace().getByOwnNameAndName(ownnames, this.functionName, namespaces);
                if (infos.length <= 0) {
                    return false;
                }
                return infos[0];
            }
            return fucInfos[0];
        };
        return _this;
    }
    ;
    return AutoFillParam;
}(Completion));
;
module.exports = {
    AutoFillParam: AutoFillParam
};
