/* --------------------------------------------------------------------------------------------
 * checkNeedUpdae.js
 *
 *  Created on: 2020年5月30日
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
var cluster = require('cluster');
var AnalyseCpp = require('../analyse/analyseCpp').AnalyseCpp;
var TypeEnum = require('../analyse/analyseBase').TypeEnum;
var FileIndexStore = require('../store/store').FileIndexStore;
var KeyWordStore = require('../store/store').KeyWordStore;
var logger = require('log4js').getLogger("cpptips");
var AnalyseDiagnostics = /** @class */ (function (_super) {
    __extends(AnalyseDiagnostics, _super);
    function AnalyseDiagnostics(filecontext, dbpath, filename) {
        if (filename === void 0) { filename = ''; }
        var _this = _super.call(this, filecontext, false, filename) || this;
        //分析语法
        _this.DoAnaylse = function () {
            var _this = this;
            //先执行分析，构造分析树
            this.doAnalyse();
            //分析位置
            this.GetBlockPoint();
            //分析函数参数和for中定义的变量
            this.tree.traverseBF(function (current) {
                _this.GetIncludeAndUsingnamespace(current);
                if (current.data.length <= 0) {
                    return;
                }
                //获取第一个子区域
                var index = current.data[0];
                if (index < 2) {
                    //第一块不需要处理
                    return;
                }
                var _nameMap = _this.GetAearSpaceDefine(current, _this.lines[index - 2]);
                current.nameMap = _nameMap;
            });
            //遍历树结构，分析具体语法规则
            this.tree.traverseDF(function (current) {
                //logger.debug(current);
                var fatherNameMap = {};
                //获取父节点的定义
                fatherNameMap = _this.GetFatherNameMap(current);
                _this.GetOwnName(current);
                //获取成员变量
                if (/[\w]{1,128}::[\w]{1,128}/g.test(_this.allfunctionname)) {
                    //函数实现，需要拉取成员变量
                    var _nameMap = _this.GetMethodInOwn(_this.ownName, _this.usingnamespace);
                    if (Object.keys(_nameMap).length > 0) {
                        fatherNameMap = Object.assign(fatherNameMap, _nameMap);
                    }
                }
                var nameMap = {};
                for (var i = 0; i < current.data.length; i++) {
                    var dataIndex = current.data[i];
                    var code = _this.lines[dataIndex];
                    _this.index = dataIndex;
                    nameMap = _this.AnaylseCodeBlock(nameMap, fatherNameMap, code);
                }
                current.nameMap = Object.assign(current.nameMap, nameMap);
            });
            for (var i = 0; i < this.result.length; i++) {
                logger.debug(this.result[i].begin, this.result[i].end, this.context.substring(this.result[i].begin - 20, this.result[i].end));
            }
        };
        //分析代码快在整个文档中的位置
        _this.GetBlockPoint = function () {
            var point = [];
            point.push(0);
            var filecode = this.context;
            for (var i = 0; i < filecode.length; i++) {
                if (filecode[i] == "/" && filecode[i + 1] == "/") {
                    //改行注释
                    var _pos = filecode.indexOf("\n", i);
                    i = _pos;
                }
                if (filecode[i] == "/" && filecode[i + 1] == "*") {
                    //注释跳过
                    var _pos = filecode.indexOf("*/", i);
                    i = _pos;
                }
                if (filecode[i] == "{" || filecode[i] == "}") {
                    //如果是{},记录位置
                    point.push(i);
                }
            }
            this.point = point;
        };
        //获取当前own的所有方法
        _this.GetMethodInOwn = function (ownname, namespaces) {
            if (this.ownNameMap[ownname]) {
                //已经计算过own的成员定义，则直接返回
                return this.ownNameMap[ownname];
            }
            var infos = this.kwdb.getAllInOwnNameAndNs(ownname, namespaces, TypeEnum.VARIABLE);
            var nameMap = {};
            for (var i = 0; i < infos.length; i++) {
                var info = infos[i];
                var name_1 = info.name;
                if (info.extdata.length > 0) {
                    var extJson = JSON.parse(info.extdata);
                    nameMap[name_1] = extJson.t;
                }
            }
            this.ownNameMap[ownname] = nameMap;
            return nameMap;
        };
        //获取当前ownname，如class
        _this.GetOwnName = function (current) {
            var ownname = current.ownname.name;
            var setDomainKw = new Set(["if", "for", "while", "do"]);
            while (true) {
                if (setDomainKw.has(ownname)) {
                    current = current.parent;
                    ownname = current.ownname.name;
                    continue;
                }
                break;
            }
            this.allfunctionname = ownname;
            this.ownName = "";
            this.functionName = ownname;
            var _pos = this.functionName.indexOf("::");
            if (_pos != -1) {
                this.ownName = this.functionName.substring(0, _pos);
                this.functionName = this.functionName.substring(_pos + 2);
            }
        };
        //获取归属与指定区域特殊的定义，如函数参数，for循环里面的定义
        _this.GetAearSpaceDefine = function (current, data) {
            var nameMap = {};
            data = data.trim();
            var stack = [];
            var findPos = -1;
            if (data.lastIndexOf(") :") != -1) {
                var _pos = data.lastIndexOf(") :");
                //可能是构造函数
                var testStr = data.substring(_pos + 3);
                testStr = testStr.replace(/[\s]{1,10}/g, "");
                if (/([,]?[\w]{1,64}\([\w]{1,64}\)){1,32}/g.test(testStr)) {
                    //测试成功
                    data = data.substring(0, _pos + 1);
                    //logger.debug(data);
                }
            }
            for (var i = data.length; i > 0; i--) {
                if (data[i] == ')') {
                    stack.push(')');
                    continue;
                }
                if (data[i] == '(') {
                    stack.pop();
                    if (stack.length <= 0) {
                        //闭合找到顶，下一个字符为关键字
                        findPos = i - 1;
                        break;
                    }
                    continue;
                }
            }
            if (findPos <= 0) {
                //无效代码块，不符合语法规则的代码
                //这种代码无定义，不需要处理
                return {};
            }
            var keyword = [];
            for (var i = findPos; i >= 0; i--) {
                if (data[i] != " ") {
                    keyword.push(data[i]);
                    continue;
                }
                if (data[i] == " " && keyword.length > 0) {
                    break;
                }
            }
            var strkeyword = keyword.reverse().join("");
            current.ownname.name = strkeyword;
            if (strkeyword == "if" || strkeyword == "else"
                || strkeyword == "while" || strkeyword == "do") {
                return {};
            }
            //for循环中定义
            if (strkeyword == "for") {
                var endpos = data.indexOf(";", findPos);
                var item = data.substring(findPos + 2, endpos).trim();
                var _pos = item.indexOf("=");
                var _value = [];
                var i = _pos - 2;
                for (; i > 0; i--) {
                    if (item[i] != " ") {
                        _value.push(item[i]);
                        continue;
                    }
                    if (item[i] == " " && _value.length > 0) {
                        break;
                    }
                }
                var valName = _value.reverse().join("");
                var valType = item.substring(0, i).trim().replace(/[\s]{1,10}/g, "");
                nameMap[valName] = valType;
                return nameMap;
            }
            //解释函数参数
            var param = data.substring(findPos + 2, data.length - 1).trim();
            param = param.replace(/[\s]{0,10}[<>,]{1,1}[\s]{0,10}/g, function (kw) { return kw.trim(); });
            param = param.replace(/(const )|([&*]{1,2})/g, "");
            param = param.replace(/(unsigned int)|(unsigned long)|(long long)/g, function (kw) {
                return kw.replace(/[\s]{1,4}/g, "_");
            });
            var reg = /([\w:<>,]{1,128})[\s]{1,4}([\w]{1,64})/g;
            var result = param.match(reg);
            //logger.debug(result);
            for (var i = 0; result && i < result.length; i++) {
                var item = result[i].trim();
                if (item[0] == ",") {
                    item = item.substring(1);
                }
                item = item.replace(/(const )|([&]{1,1})|([*]{1,2})/g, " ");
                var _pos = item.lastIndexOf(" ");
                var typeName = item.substring(0, _pos);
                typeName = typeName.replace(/[\s]{1,10}/g, "");
                var valName = item.substring(_pos).trim();
                nameMap[valName] = typeName;
            }
            return nameMap;
        };
        //获取分析结果
        _this.GetAnaylseResult = function () {
            return this.result;
        };
        //获取父domain的所有的名字定义
        _this.GetFatherNameMap = function (current) {
            var nameMap = current.nameMap;
            while (true) {
                if (!current.parent) {
                    break;
                }
                current = current.parent;
                var _nameMap = current.nameMap;
                //logger.debug("predata:", _nameMap, nameMap);
                nameMap = Object.assign(nameMap, _nameMap);
                //logger.debug("result:", nameMap);
            }
            //logger.debug(nameMap);
            return nameMap;
        };
        //分析代码块
        //nameMap:当前代码块的变量定义（到改行为止）
        //fathernNameMap：父代码块的变量定义（包括父的父，一直到树的根）
        _this.AnaylseCodeBlock = function (nameMap, fatherNameMap, codeBlock) {
            var codes = codeBlock.split(/[;{}]{1,1}/g);
            for (var i = 0; i < codes.length; i++) {
                var code = codes[i].trim();
                if (/^for[\s]{0,10}\(/.test(code)) {
                    var _pos = code.indexOf("(");
                    code = code.substring(_pos + 1).trim();
                }
                code = code.replace(/[\s]{0,10}[.*&,=<>\-()]{1,1}[\s]{0,10}/g, function (kw) {
                    var ckw = kw.trim();
                    if (ckw.trim() == "*") {
                        return "* ";
                    }
                    if (ckw.trim() == ">") {
                        return "> ";
                    }
                    if (ckw.trim() == "&") {
                        return "& ";
                    }
                    if (ckw.trim() == "*") {
                        return "* ";
                    }
                    return ckw;
                });
                if (code == ""
                    || /^(return|#include|#define|#if|#endif|namespace|using|using____namespace) /g.test(code)
                    || /^if\(|else if\(/g.test(code)) {
                    //退出
                    continue;
                }
                code = code.replace(/[(,]{1,1}[*&]{1,1}[\s]{1,4}/g, function (kw) {
                    return kw.trim();
                });
                code = code.replace(/(unsigned int)|(unsigned long)|(long long)/g, function (kw) {
                    return kw.replace(/[\s]{1,4}/g, "_");
                });
                nameMap = this.AnaylseCode(nameMap, fatherNameMap, code);
            }
            return nameMap;
        };
        //分析一行代码
        _this.AnaylseCode = function (nameMap, fatherNameMap, code) {
            code = code.replace("const ", "");
            //定义判断
            var reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})([*&]{0,2}) ([\w]{1,64})$/g;
            var match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var type = match[1];
                var name_2 = match[4];
                //if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
                nameMap[name_2] = type;
                return nameMap;
            }
            //变量定义，带参数
            reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})[*&]{0,2} ([\w]{1,64})[\s]{0,16}((\()|(=[\s]{0,16}new ))/g;
            match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var type = match[1];
                var name_3 = match[3];
                nameMap[name_3] = type;
                return nameMap;
            }
            //模版成员变量定义
            reg = /^((([\w]{1,64}::){0,8}[\w]{1,64})<(([,]?([\w]{1,64}::){0,10}[\w]{1,64}){1,10})>)([*&]{0,2}) ([\w]{1,64})$/g;
            match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var type = match[1];
                var name_4 = match[8];
                //if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
                nameMap[name_4] = type;
                return nameMap;
            }
            //模版成员变量定义,带初始值
            reg = /^((([\w]{1,64}::){0,8}[\w]{1,64})<(([,]?([\w]{1,64}::){0,10}[\w]{1,64}){1,10})>)[*&]{0,2} ([\w]{1,64})[\s]{0,16}=[\s]{0,16}([\w.,(*&)"]{1,128})$/g;
            match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var type = match[1];
                var name_5 = match[7];
                var value = match[8];
                //if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
                nameMap[name_5] = type;
                var typeOfName = type;
                var valType = false;
                if (value.indexOf("(") != -1) {
                    //函数调用
                    valType = this.CheckFunctionParams(value, nameMap, fatherNameMap);
                    // if(name == "bitsetProperty") logger.debug(valType, typeOfName);
                }
                else if (/^[\d]{1,25}$/g.test(value)) {
                    valType = "number";
                }
                else if (/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
                    valType = "float";
                }
                else if (/^\"[^"]{0,1024}\"$/g.test(value)) {
                    valType = "std::string";
                }
                else if (value == "false" || value == "true") {
                    valType = "bool";
                }
                else {
                    valType = this.GetNameType(nameMap, fatherNameMap, value);
                    if (!valType) {
                        //尝试查找宏定义或者枚举
                        valType = this.CheckValueIsDefineOrEnumItem(value);
                    }
                }
                if (!valType) {
                    //变量未定义
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, type, value, "变量为定义");
                    return nameMap;
                }
                if (typeOfName == "auto") {
                    nameMap[name_5] = valType;
                    return nameMap;
                }
                if (!this.TypeCheck(typeOfName, valType)) {
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, type, value, "变量类型不匹配");
                    //if(name == "strInterfaceSource")logger.debug(match,matchcode, type, value);
                    return nameMap;
                }
                return nameMap;
            }
            //带初始值的定义判断
            reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})[*&]{0,2} ([\w]{1,64})[\s]{0,16}=[\s]{0,16}([\w.,()*&"]{1,128})$/g;
            match = reg.exec(code);
            if (match) {
                if (/MMPAY_CTIME_ELF/g.test(code)) {
                    logger.debug(code);
                }
                // logger.debug(match);
                var type = match[1];
                var name_6 = match[3];
                var value = match[4];
                nameMap[name_6] = type;
                var typeOfName = type;
                var valType = false;
                if (value.indexOf("(") != -1) {
                    //函数调用
                    valType = this.CheckFunctionParams(value, nameMap, fatherNameMap);
                    if (name_6 == "i")
                        logger.debug("jjjjjjjjjjj", value, nameMap, fatherNameMap, valType, typeOfName);
                }
                else if (/^[\d]{1,25}$/g.test(value)) {
                    valType = "number";
                }
                else if (/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
                    valType = "float";
                }
                else if (/^\"[^"]{0,1024}\"$/g.test(value)) {
                    valType = "std::string";
                }
                else if (value == "false" || value == "true") {
                    valType = "bool";
                }
                else {
                    valType = this.GetNameType(nameMap, fatherNameMap, value);
                    if (!valType) {
                        //尝试查找宏定义或者枚举
                        valType = this.CheckValueIsDefineOrEnumItem(value);
                    }
                }
                if (!valType) {
                    //变量未定义
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, type, value, "类型未定义");
                    return nameMap;
                }
                if (typeOfName == "auto") {
                    if (valType == "number") {
                        nameMap[name_6] = "int32_t";
                    }
                    else {
                        nameMap[name_6] = valType;
                    }
                    //if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code, name, value, type, valType, nameMap);
                    return nameMap;
                }
                if (!this.TypeCheck(typeOfName, valType)) {
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, type, value, "变量类型不匹配1" + typeOfName + "|" + valType);
                    return nameMap;
                }
                return nameMap;
            }
            //赋值预计检查
            reg = /^([\w]{1,64})=([\w.,]{1,128})$/g;
            match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var name_7 = match[1];
                var value = match[2];
                if (name_7 == "m_pNewIdMaker")
                    logger.debug(nameMap, fatherNameMap, name_7, value);
                var typeOfName = this.GetNameType(nameMap, fatherNameMap, name_7);
                if (!typeOfName) {
                    //变量未定义
                    logger.debug(code, name_7, value, nameMap, fatherNameMap);
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, name_7, value, "变量未定义");
                    return nameMap;
                }
                var valType = false;
                //如果value是数字类型
                if (/^[\d]{1,25}$/g.test(value)) {
                    valType = "int";
                }
                else if (/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
                    valType = "number";
                }
                else if (/^\"[^"]{1,1024}\"$/g.test(value)) {
                    valType = "std::string";
                    logger.debug(name_7, value);
                }
                else if (value == "false" || value == "true") {
                    valType = "bool";
                }
                else {
                    valType = this.GetNameType(nameMap, fatherNameMap, value);
                    if (!valType) {
                        //尝试查找宏定义或者枚举
                        valType = this.CheckValueIsDefineOrEnumItem(value);
                    }
                }
                if (!valType) {
                    //变量未定义
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, name_7, value, "类型为定义");
                    return nameMap;
                }
                if (!this.TypeCheck(typeOfName, valType)) {
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, name_7, value, "类型未匹配");
                    return nameMap;
                }
                return nameMap;
            }
            //函数调用检查 = a().b();
            reg = /^([\w]{1,64})=([\w:.]{1,64}\([\w.,():]{1,128}\))$/g;
            match = reg.exec(code);
            if (match) {
                //logger.debug(match);
                var name_8 = match[1];
                var value = match[2];
                var typeOfName = this.GetNameType(nameMap, fatherNameMap, name_8);
                if (!typeOfName) {
                    //变量未定义
                    var matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    this.GetPointInSource(matchcode, name_8, value, "类型为定义");
                    return nameMap;
                }
                //check函数参数
                var _type = this.CheckFunctionParams(value, nameMap, fatherNameMap);
                if (!this.TypeCheck(typeOfName, _type)) {
                    //let matchcode = match[0].replace(/[\s]{1,10}/g, "");
                    //logger.debug("function return not match!" +  typeOfName + "|" +  name + "|" + _type + "|" + value);
                    //this.GetPointInSource(matchcode, value, value);
                    return nameMap;
                }
                return nameMap;
            }
            return nameMap;
        };
        //判断值是否为宏定义或者枚举
        _this.CheckValueIsDefineOrEnumItem = function (val) {
            var infos = this.kwdb.getByNameAndNamespaces(val, this.usingnamespace);
            var _type = false;
            for (var k = 0; k < infos.length; k++) {
                if (infos[k].type == TypeEnum.ENUMITEM) {
                    //枚举值
                    _type = "int";
                    return _type;
                }
                if (infos[k].type == TypeEnum.DEFINE) {
                    //宏定义值
                    var defineType = JSON.parse(infos[k].extdata);
                    if (/^[\d.]{1,25}$/g.test(defineType.v)) {
                        _type = "int";
                        return _type;
                    }
                    if (/^\"[.]{0,1024}\"$/g.test(val)) {
                        _type = "char*";
                        return _type;
                    }
                }
            }
            return false;
        };
        //获取真正的类型或者等价类型
        _this.GetRealValType = function (defineType) {
            if (defineType == "unsigned_int") {
                defineType = "unsigned int";
            }
            if (defineType == "unsigned_long") {
                defineType = "unsigned long";
            }
            if (defineType == "long_long") {
                defineType = "long long";
            }
            if (defineType == "int"
                || defineType == "size_t") {
                defineType = "int32_t";
            }
            if (defineType == "time_t") {
                defineType = "uint32_t";
            }
            return defineType;
        };
        //数字等价判断
        _this.TypeCheck = function (defineType, valType) {
            if (valType == "#define") {
                //宏定义，非函数
                return true;
            }
            if (valType == "char*"
                && (defineType == "std::string" || defineType == "string")) {
                return true;
            }
            defineType = this.GetRealValType(defineType);
            valType = this.GetRealValType(valType);
            var numberType = [
                "std::bitset<64>", "uint64_t", "int64_t", "std::bitset<32>", "uint32_t", "int32_t",
                "uint16_t", "int16_t", "uint8_t",
                "int8_t", "char", "byte", "bool", "NULL", "number"
            ];
            var defineleve = -1;
            for (var i = 0; i < numberType.length; i++) {
                //if(valType == "number") logger.debug("ddddddd",defineType, valType,defineleve, numberType[i]);
                if (numberType[i] == defineType) {
                    defineleve = i;
                }
                if (numberType[i] == valType) {
                    if (defineleve == -1) {
                        //还未找到定义的位置
                        //容量大的不能赋值给容量小的
                        return false;
                    }
                    return true;
                }
            }
            return defineType == valType;
        };
        //分析函数参数
        _this.AnalyseFunctionParams = function (paramsStr) {
            var params = [];
            var _stack = [];
            var _params = "";
            for (var i = 1; i < paramsStr.length - 1; i++) {
                if (paramsStr[i] == ",") {
                    if (_stack.length == 0) {
                        params.push(_params.trim());
                        _params = "";
                        continue;
                    }
                }
                if (paramsStr[i] == "(") {
                    _stack.push("(");
                }
                if (paramsStr[i] == ")") {
                    _stack.pop("(");
                }
                _params = _params + paramsStr[i];
            }
            if (_params.trim().length > 0) {
                params.push(_params);
            }
            //logger.debug(params);
            return params;
        };
        //分析函数并获取返回类型
        _this.GetFunctionRetType = function (type, name, paramsStr, nameMap, fatherNameMap) {
            if (type.indexOf("<") != -1) {
                var _pos = type.indexOf("<");
                type = type.substring(0, _pos);
            }
            //校验函数参数并返回函数返回值
            var params = this.AnalyseFunctionParams(paramsStr);
            var _ns = "";
            var _ownname = [type];
            if (type == "") {
                _ownname.push(this.ownName);
            }
            if (type.indexOf("::") != -1) {
                var _pos = type.lastIndexOf("::");
                _ns = type.substring(0, _pos);
                _ownname = [type.substring(_pos + 2)];
            }
            var usens = [_ns];
            if (_ns == "") {
                usens = this.usingnamespace;
            }
            var info = this.kwdb.getByOwnNameAndNameType(_ownname, name, usens, TypeEnum.FUNCTION);
            //测试代码//////////////////////////////////////////////////////
            // if(name == "str"){
            // 	logger.debug("xxxxxxxxxxxxx", _ownname, usens, info);
            // }
            if (info.length == 0) {
                //没查到函数可能是宏定义
                var info_1 = this.kwdb.getByOwnNameAndNameType(_ownname, name, usens, TypeEnum.DEFINE);
                if (info_1.length > 0) {
                    var jsonData = JSON.parse(info_1[0].extdata);
                    if (params.length != jsonData.p.length) {
                        //宏参数不匹配
                        logger.debug("#define params not match!");
                    }
                    //宏定义
                    return "#define";
                }
            }
            /////////////////////////////////////////////////////////////
            if (info.length > 0) {
                var extData = info[0].extdata;
                //if(name == "_AddProcessFlows")logger.debug("xxxxxxx", info[0], params);
                var extJson = JSON.parse(extData);
                for (var i = 0; i < extJson.length; i++) {
                    if (extJson[i].i.length >= params.length) {
                        //产生匹配的才进行分析
                        var isError = false;
                        for (var j = 0; j < extJson[i].i.length; j++) {
                            if (j >= params.length) {
                                //函数默认值处理
                                //如果超出的参数必须要有默认值，否则报错
                                if (extJson[i].i[j].v == null) {
                                    logger.debug("params not match!", extJson[i].i[j]);
                                    isError = true;
                                    continue;
                                }
                                continue;
                            }
                            var defineType = extJson[i].i[j].t;
                            var val = params[j];
                            if ((val == "NULL" || val == "nullpter")
                                && extJson[i].i[j].p == 1) {
                                //设置了指针
                                continue;
                            }
                            //如果参数的值是数字
                            if (/^[\d]{1,25}$/g.test(val)) {
                                //数字
                                var numberType = new Set(["int32_t", "uint32_t", "int16_t", "uint16_t", "uint64_t",
                                    "int64_t", "int", "double", "float", "unsigned int",
                                    "long", "unsigned long", "long long", "unsigned long long"]);
                                if (!numberType.has(defineType)) {
                                    //非数字类型，但是匹配了数字
                                    logger.debug("this type is number", defineType, val);
                                    isError = true;
                                    continue;
                                }
                                continue;
                            }
                            //如果参数的值是浮点数
                            if (/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(val)) {
                                //数字
                                var numberType = new Set(["double", "float"]);
                                if (!numberType.has(defineType)) {
                                    //非数字类型，但是匹配了数字
                                    logger.debug("this type is number", defineType, val);
                                    isError = true;
                                    continue;
                                }
                                continue;
                            }
                            //如果参数的值是字符串
                            if (/^\"[^"]{0,1024}\"$/g.test(val)) {
                                var numberType = new Set(["string", "std::string", "char*", "char *"]);
                                if (!numberType.has(defineType)) {
                                    //非字符类型，使用了字符的规则
                                    logger.debug("this type is string", defineType, val);
                                    isError = true;
                                    continue;
                                }
                                continue;
                            }
                            //如果参数是函数
                            if (val.indexOf("(") != -1) {
                                var _type_1 = this.CheckFunctionParams(val, nameMap, fatherNameMap);
                                if (!this.TypeCheck(defineType, _type_1)) {
                                    logger.debug("this function return type is not match", defineType, _type_1, val);
                                    isError = true;
                                    continue;
                                }
                                continue;
                            }
                            //其他情况进行匹配
                            var _type = this.GetNameType(nameMap, fatherNameMap, val);
                            // if(name == "GetCurrentProccessByBusinessCode") logger.debug(nameMap, fatherNameMap,val);
                            if (!_type) {
                                //变量为定义
                                //判断是否宏定义或者枚举
                                var pass = false;
                                var infos = this.kwdb.getByNameAndNamespaces(val, this.usingnamespace);
                                for (var k = 0; k < infos.length; k++) {
                                    if (infos[k].type == TypeEnum.ENUMITEM) {
                                        //枚举值
                                        _type = "number";
                                        pass = true;
                                    }
                                    if (infos[k].type == TypeEnum.DEFINE) {
                                        //宏定义值
                                        var defineType_1 = JSON.parse(infos[k].extdata);
                                        if (/^[\d.]{1,25}$/g.test(defineType_1.v)) {
                                            _type = "number";
                                            pass = true;
                                        }
                                        if (/^\"[.]{0,1024}\"$/g.test(val)) {
                                            _type = "char*";
                                            pass = true;
                                        }
                                    }
                                }
                                //logger.debug(nameMap, fatherNameMap, val, this.allfunctionname);
                                if (!pass) {
                                    logger.debug("this val not define！", defineType, _type, val);
                                    isError = true;
                                    continue;
                                }
                            }
                            if (!this.TypeCheck(defineType, _type)) {
                                //类型不匹配
                                logger.debug("this function return type is not match！", defineType, _type, val);
                                isError = true;
                                continue;
                            }
                        }
                        if (!isError) {
                            // if(name == "GetCurrentProccessByBusinessCode") logger.debug(extJson[0]);
                            var _retType = extJson[0].r.t;
                            if (extJson[0].r.p == 1) {
                                _retType = _retType + "*";
                            }
                            return _retType;
                        }
                    }
                }
            }
            logger.debug(type, name, paramsStr);
            return false;
        };
        //分析成员变量类型
        _this.GetVariableType = function (type, name) {
            // kwdb.
        };
        //获取当前文档并包含的命名空间
        _this.GetIncludeAndUsingnamespace = function (current) {
            if (current.include.length > 0
                || current.usingnamespace.length > 0) {
                //首节点
                //包含的头文件
                var _include = current.include.length > 0 ? current.include : [];
                //引用的命名空间
                var _usingnamespace = current.usingnamespace.length > 0 ? current.usingnamespace : [];
                //保存头文件
                this.include = this.include.concat(_include);
                this.usingnamespace = this.usingnamespace.concat(_usingnamespace);
            }
        };
        //分析函数调用序列
        _this.GetFuncSequeue = function (func) {
            //分析出函数调用序列
            var fname = [];
            var _tmpname = "";
            var _params = "";
            for (var i = 0; i < func.length - 1; i++) {
                if (func[i] == ".") {
                    fname.push({ name: _tmpname, params: _params });
                    _tmpname = "";
                    _params = "";
                    continue;
                }
                if (func[i] == "-" && func[i + 1] == ">") {
                    fname.push({ name: _tmpname, params: _params });
                    _tmpname = "";
                    _params = "";
                    i = i + 1;
                    continue;
                }
                if (func[i] == ":" && func[i + 1] == ":") {
                    fname.push({ name: _tmpname, params: _params });
                    _tmpname = "";
                    _params = "";
                    i = i + 1;
                    continue;
                }
                if (func[i] == "(") {
                    //处理参数
                    var _stack = [];
                    var j = i;
                    while (j < func.length) {
                        if (func[j] == "(") {
                            _stack.push('(');
                            j++;
                            continue;
                        }
                        if (func[j] == ")") {
                            _stack.pop();
                        }
                        if (_stack.length == 0) {
                            _params = func.substring(i, j + 1);
                            //this.CheckFunctionParams(_newfunc)
                            // logger.debug("_newfunc", _newfunc);
                            i = j;
                            break;
                        }
                        j++;
                    }
                    continue;
                }
                _tmpname = _tmpname + func[i];
            }
            fname.push({ name: _tmpname, params: _params });
            return fname;
        };
        //检测函数参数
        _this.CheckFunctionParams = function (func, nameMap, fatherNameMap) {
            var _pos = func.indexOf("(");
            var name = func.substring(0, _pos);
            var funcSq = this.GetFuncSequeue(func);
            var names = funcSq[0];
            var type = this.GetNameType(nameMap, fatherNameMap, names.name);
            if (!type) {
                if (names.params != "") {
                    //没有找到定义
                    //可能是全局变量或者不带命名空间的函数用法
                    type = "";
                    var tmpSq = [names];
                    funcSq = tmpSq.concat(funcSq);
                }
                else {
                    this.GetPointInSource(func, funcSq[0].name, names.name, "函数参数不匹配");
                    //logger.debug("xxx error", names,nameMap, fatherNameMap);
                    return false;
                }
            }
            //检查函数参数
            for (var i = 1; i < funcSq.length; i++) {
                names = funcSq[i];
                if (names.params == "") {
                    type = this.GetVariableType(type, names.name);
                }
                else {
                    //检查参数
                    //获取返回值
                    var _type = this.GetFunctionRetType(type, names.name, names.params, nameMap, fatherNameMap);
                    if (!_type) {
                        this.GetPointInSource(func, funcSq[0].name, names.name, "函数返回了未定义类型");
                        logger.debug("ccc error", func, names, type, _type);
                        return false;
                    }
                    type = _type;
                }
            }
            return type;
        };
        //获取错误位置在源文件中的位置
        _this.GetPointInSource = function (func, bname, name, msg) {
            var retPos = 0;
            var startPos = this.point[this.index / 2];
            var endPos = this.point[this.index / 2 + 1];
            var source = this.context.substring(startPos, endPos);
            retPos = source.indexOf(name);
            var _pos = 0;
            var find = false;
            while (!find) {
                _pos = source.indexOf(bname, _pos);
                if (_pos == -1) {
                    //异常情况
                    break;
                }
                //logger.debug(_pos, source, bname);
                var linecode = "";
                for (var i = _pos; i < source.length; i++) {
                    if (source[i] != " " && source[i] != "\t"
                        && source[i] != "\n" && source[i] != "\r") {
                        linecode = linecode + source[i];
                        //logger.debug(linecode);
                    }
                    var _findPos = func.indexOf(linecode);
                    if (_findPos == -1) {
                        //跳过继续查找
                        //logger.debug("linecode", func, linecode);
                        _pos = i;
                        linecode = "";
                        find = false;
                        break;
                    }
                    else if (_findPos > 0) {
                        //异常情况，退出
                        logger.debug(func, bname, name);
                        return 0;
                    }
                    if (func == linecode) {
                        //找到位置
                        //if(func=="std::stringstrErrmsg=0")logger.debug("dddd:",source, linecode, name);
                        retPos = source.indexOf(name, _pos);
                        find = true;
                        break;
                    }
                }
            }
            //logger.debug("ss", this.context.substring(startPos + retPos, startPos + retPos + name.length), "dd", bname);
            var range = { begin: startPos + retPos, end: startPos + retPos + name.length };
            this.result.push(range);
            logger.debug("error:", msg, name, range);
            return startPos + retPos;
        };
        //获取变量的类型
        _this.GetNameType = function (nameMap, fatherNameMap, name) {
            //当前域定义的
            if (nameMap.hasOwnProperty(name)) {
                return nameMap[name];
            }
            //父域中定义的
            if (fatherNameMap.hasOwnProperty(name)) {
                return fatherNameMap[name];
            }
            //logger.debug(nameMap, fatherNameMap, name);
            return false;
        };
        _this.filedb = FileIndexStore.getInstace().connect(dbpath, 0);
        _this.kwdb = KeyWordStore.getInstace().connect(dbpath, 0);
        _this.include = [];
        _this.usingnamespace = [""];
        _this.functionName = "";
        _this.ownName = "";
        _this.allfunctionname = "";
        _this.ownNameMap = {};
        _this.point = [];
        _this.index = 0; //当前处理代码块索引
        _this.result = [];
        return _this;
    }
    ;
    return AnalyseDiagnostics;
}(AnalyseCpp));
;
if (cluster.isMaster) {
    //测试代码
    //获取basepath
    var fs = require('fs');
    var basedir = "/";
    var dbpath = "/";
    var filename = "PassCurrentProcess.cpp";
    var fd = fs.openSync(basedir + filename, 'r');
    var buffer = Buffer.alloc(1024 * 1024);
    var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024);
    var context_1 = buffer.toString('utf8', 0, bytesRead);
    var worker_1 = cluster.fork();
    var parasms = {
        filecontext: context_1,
        filename: filename,
        dbpath: dbpath
    };
    worker_1.send(parasms);
    worker_1.on('message', function (data) {
        if (data.type == "result") {
            logger.debug(data.data);
            worker_1.kill();
        }
    });
}
else if (cluster.isWorker) {
    process.on('message', function (parasms) {
        //logger.debug(parasms);
        var filecontext = parasms["filecontext"];
        var filename = parasms["filename"];
        var dbpath = parasms["dbpath"];
        var ad = new AnalyseDiagnostics(filecontext, dbpath, filename);
        ad.DoAnaylse();
        //获取结构
        var result = ad.GetAnaylseResult();
        process.send({ data: JSON.stringify(result), type: "result" });
    });
}
