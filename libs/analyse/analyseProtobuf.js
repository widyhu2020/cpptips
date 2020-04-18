/* --------------------------------------------------------------------------------------------
 * analyseProtoBuf.js
 *
 *  Created on: 2020年4月05日
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
var MateData = require('./tree_node');
var Tree = require('./tree');
var AnalyseBase = require('../analyse/analyseBase').AnalyseBase;
var TypeEnum = require('../analyse/analyseBase').TypeEnum;
var AnalyseProtobuf = /** @class */ (function (_super) {
    __extends(AnalyseProtobuf, _super);
    function AnalyseProtobuf(filecontext, filename) {
        if (filename === void 0) { filename = ''; }
        var _this = _super.call(this, filecontext, true, filename) || this;
        //执行分析
        _this.doAnalyse = function () {
            var _this = this;
            //文档处理
            //console.time("splitContext")
            var lines = this._splitContextProto();
            //console.timeEnd("splitContext");
            //console.log(lines);
            this._preProcessProto(lines);
            //分析作用域
            //console.time("analyseDomain")
            this._analyseDomainProto(lines);
            //console.timeEnd("analyseDomain");
            //构建命名空间
            //console.time("makeNamespace")
            this._makeNamespaceProto();
            //console.timeEnd("makeNamespace");
            //遍历树其他代码快分析函数
            //console.time("analyseCodeBlock")
            this.tree.traverseBF(function (current) {
                for (var i = 0; i < current.data.length; i++) {
                    _this._analyseCodeBlockProtoFunction(current, lines, current.data[i]);
                }
            });
            //console.timeEnd("analyseCodeBlock");
            //遍历树其他代码快分析枚举
            //console.time("analyseCodeBlock")
            this.tree.traverseBF(function (current) {
                for (var i = 0; i < current.data.length; i++) {
                    _this._analyseCodeBlockProtoEnum(current, lines, current.data[i]);
                }
            });
            //console.timeEnd("analyseCodeBlock");
        };
        //预处理-分析作用域
        _this._preProcessProto = function (lines) {
            //对分解的串进行第一次处理
            for (var i = 0; i < lines.length; i++) {
                //this.analyseLine(this.context[i], i, this.context);
                if (lines[i] == '{') {
                    this.tree.add(i, this.point_domain);
                    this.point_domain = i;
                    continue;
                }
                if (lines[i] == '}') {
                    this.point_domain = this.tree.getFatherDomain(this.point_domain);
                    continue;
                }
                //将数据挂载到当前作用域下
                //console.log(i);
                this.tree.addDataToNode(this.point_domain, i);
                //this.block.push(this.context[i]);
            }
        };
        //文档拆分-protobuf
        _this._splitContextProto = function () {
            var _this = this;
            var filecontext = this.context.replace(/([,.;(){}=<>*&-]{1,1})/g, function (kw) {
                //关键符号用空格隔开
                if (kw == '}' || kw == '{') {
                    return " {;;;;}" + kw + "{;;;;} ";
                }
                return " " + kw + " ";
            });
            //去掉//注释
            //B0A1-F7FE gbk
            var userindex = 0;
            filecontext = filecontext.replace(/(\/\/[^\n]*\n)|(\/\*.+?(\*\/){1,1})/g, function (kw) {
                var keyword = kw.trim();
                var tmpstr = "@@" + userindex + "@@";
                _this.proto_annotate[tmpstr] = keyword;
                userindex++;
                return tmpstr + " ;";
            });
            //格式化空格，多个全部转化为1个
            filecontext = filecontext.replace(/([\s\n\t\r]+)/g, function (kw) {
                var datalenth = kw.trim();
                //console.log("|"+kw+"|");
                if (datalenth.length > 0) {
                    //console.log("|" + kw + "|");
                    return datalenth;
                }
                return " ";
            });
            //按照{;;;;}将文档分成多块
            var lines = filecontext.split("{;;;;}");
            return lines;
        };
        //分析own，即作用域限定
        _this._analyseDomainProto = function (lines) {
            var _this = this;
            //获取package，得到namespace
            var namespace = "";
            var startpos = lines[0].indexOf('package');
            var endpos = lines[0].indexOf(';', startpos);
            if (startpos != -1 && endpos != -1) {
                namespace = lines[0].substr(startpos + 8, endpos - startpos - 8).trim();
                namespace = namespace.replace(/[\s]{0,2}[.]{1,1}[\s]{0,2}/g, "::");
            }
            if (namespace == "") {
                //没有命名空间，表示定义不正确
                //console.log("proto context error!", this.filename);
                //return false;
            }
            this.basenamespace = namespace;
            //分析类名称
            this.tree.traverseBF(function (current) {
                var find_context = "";
                if (current.domain_level > 0) {
                    find_context = lines[current.domain_level - 1];
                    //console.log("find context:" + find_context);
                }
                var domain_name = find_context;
                var pos = find_context.lastIndexOf(';');
                if (pos >= 0) {
                    domain_name = find_context.substr(pos);
                }
                //尝试获取注释
                var annotatepos = find_context.lastIndexOf(";", pos - 1);
                var annotate = "";
                if (annotatepos >= 0) {
                    annotate = find_context.substr(annotatepos + 1, pos - annotatepos - 1);
                }
                else {
                    annotate = find_context.substr(0, pos - 1);
                }
                domain_name = domain_name.trim();
                _this._getDomainNameAndTypeProto(annotate, domain_name, current);
            });
            return true;
        };
        //获取作用域名称和类型
        _this._getDomainNameAndTypeProto = function (annotate, rawName, treeNode) {
            if (rawName == ""
                && treeNode.domain_level == 0) {
                return;
            }
            var items = rawName.split(/[ ;]/);
            items = items.filter(function (value) {
                //去掉空行
                if (value == "" || value == ";") {
                    return false;
                }
                return true;
            });
            for (var i = 0; i < items.length; i++) {
                if (items[i] == "message") {
                    //消息
                    var inherits = [{ 'p': 0, 'n': "google::protobuf::Message" }];
                    var realLine = "class " + items[i + 1] + " : public google::protobuf::Message";
                    var data = new MateData.BaseData(items[i + 1], TypeEnum.CALSS, realLine, inherits);
                    //console.log(data);
                    Tree.setType(treeNode, data);
                    return;
                }
                if (items[i] == "enum") {
                    //枚举定义
                    var realLine = "enum " + items[i + 1];
                    var data = new MateData.BaseData(items[i + 1], TypeEnum.ENUM, realLine);
                    //console.log(data);
                    Tree.setType(treeNode, data);
                    return;
                }
            }
        };
        //构造命名空间
        _this._makeNamespaceProto = function () {
            var _this = this;
            this.tree.traverseBF(function (current) {
                if (current.parent == null) {
                    current.namespace = _this.basenamespace;
                    return;
                }
                if (current.parent == null) {
                    //野节点
                    return;
                }
                var parentnamespace = current.parent.namespace;
                if (current.ownname == null) {
                    //子没有产生命名空间，则为父亲的命名空间
                    current.namespace = parentnamespace;
                    //console.log(current.namespace);
                    return;
                }
                if (parentnamespace != "") {
                    if (current.parent.ownname
                        && current.parent.ownname.type == TypeEnum.CALSS) {
                        current.namespace = parentnamespace + "_" + current.ownname.name;
                        current.ownname.name = current.parent.ownname.name + "_" + current.ownname.name;
                    }
                    else {
                        current.namespace = parentnamespace + "::" + current.ownname.name;
                    }
                    //console.log(current.namespace);
                }
                else {
                    current.namespace = current.ownname.name;
                    //console.log(current.namespace);
                }
            });
        };
        //分析所有的函数
        _this._analyseCodeBlockProtoFunction = function (node, lines, index) {
            if (!node.ownname
                || (node.ownname
                    && node.ownname.type != TypeEnum.CALSS)) {
                //只需要处理class类型
                return;
            }
            var items = lines[index].split(' ');
            //去掉空格
            items = items.filter(function (e, i, arr) { return e != ''; });
            var prekeywords = new Set(['optional', 'repeated', 'required']);
            //循环提取变量
            for (var i = 0; i < items.length; i++) {
                if (prekeywords.has(items[i])) {
                    if (i > 0 && items[i] == '.') {
                        //排除(number.field).required的情况
                        continue;
                    }
                    var prename = "";
                    var name_1 = "";
                    var type = "";
                    var annotate = "";
                    prename = items[i];
                    var statck = [];
                    //从此位置开始查找
                    var j = i + 1;
                    for (; j < items.length; j++) {
                        if (items[j] == '=') {
                            break;
                        }
                        statck.push(items[j]);
                    }
                    //查找的注释
                    var k = j + 1;
                    var splitCount = 0;
                    for (; k < items.length; k++) {
                        if (prekeywords.has(items[k])) {
                            //可能没有注释，结束
                            //console.log("ddd", items[k], items, k);
                            break;
                        }
                        if (items[k] == ';') {
                            splitCount++;
                        }
                        if (splitCount == 2) {
                            var findannotate = items[k - 1];
                            if (/@@[\d]+@@/g.test(findannotate)) {
                                //找到注释
                                annotate = findannotate;
                                //减少无用循环
                                j = k;
                                break;
                            }
                        }
                    }
                    if (statck.length < 2) {
                        //找到的数据项过少，表示有问题，或者是不符合规范的定义
                        continue;
                    }
                    //栈顶的为字段名称
                    name_1 = statck.pop();
                    //其余的为类型
                    type = statck.join('');
                    type = type.replace(/[.]{1,1}/g, '::');
                    this._analyseFildProto(node, prename, type, name_1, annotate);
                    i = j;
                    continue;
                }
            }
        };
        //分析所有的枚举
        _this._analyseCodeBlockProtoEnum = function (node, lines, index) {
            if (!node.ownname
                || (node.ownname
                    && node.ownname.type != TypeEnum.ENUM)) {
                //只需要处理enum类型
                return;
            }
            //枚举检查函数
            if (node.parent != null && node.ownname.type == TypeEnum.NAMESPACE) {
                var funcname = node.ownname.name + "_IsValid";
                var addVerRet = new MateData.VariableMet();
                addVerRet.type = "bool";
                addVerRet.name = "";
                addVerRet.ispoint = 0;
                var variable = [];
                var addVerSetParams = new MateData.VariableMet();
                addVerSetParams.type = "int";
                addVerSetParams.name = "eEnumValue";
                variable.push(addVerSetParams);
                var addMethod = new MateData.MethodMet();
                addMethod.name = funcname;
                addMethod.returndata = addVerRet;
                addMethod.params = variable;
                addMethod.rawline = "inline bool " + funcname + "( int eEnumValue )";
                addMethod.isinline = 1;
                node.parent.addMethod(addMethod);
            }
            var items = lines[index].split(' ');
            //去掉空格
            items = items.filter(function (e, i, arr) { return e != ''; });
            //循环提取变量
            for (var i = 1; i < items.length - 1; i++) {
                if (items[i] == '=') {
                    var name_2 = items[i - 1];
                    var value = items[i + 1];
                    var annotate = "";
                    //尝试查找助手
                    var j = i + 1;
                    for (; j < items.length; j++) {
                        if (items[j] == ';' && j + 1 < items.length) {
                            if (/@@[0-9]+@@/g.test(items[j + 1])) {
                                annotate = items[j + 1];
                                break;
                            }
                        }
                    }
                    //减少循环次数
                    i = j;
                    var enumvar = new MateData.EnumMet();
                    enumvar.name = name_2.trim();
                    if (enumvar.name == "") {
                        //无效的枚举
                        continue;
                    }
                    if (typeof (value) == 'string') {
                        enumvar.value = value.trim();
                    }
                    else {
                        enumvar.value = value.toString().trim();
                    }
                    enumvar.rawLine = name_2 + " = " + value + (annotate != "" ? this.proto_annotate[annotate] : "");
                    enumvar.permission = 0;
                    node.enum.push(enumvar);
                }
            }
        };
        //单个字段分析
        _this._analyseFildProto = function (node, prename, type, name, annotate) {
            //console.log(prename, type, name, annotate);
            //非数组处理
            if (prename == "optional" || prename == "required") {
                //console.log(prename, type, name, annotate);
                this._analyseFildNormal(node, type, name, annotate);
                return;
            }
            //数组处理
            if (prename == "repeated") {
                this._analyseFildArray(node, type, name, annotate);
                return;
            }
        };
        //添加
        _this._makeStrAddAnalyseFiled = function (node, name, annotate) {
            //string写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "void";
            addVerRet.name = "";
            var variable = [];
            var addVerParams = new MateData.VariableMet();
            addVerParams.type = "std::string";
            addVerParams.name = "value";
            addVerParams.isconst = 1;
            addVerParams.ispoint = 0;
            addVerParams.isuseadder = 1;
            variable.push(addVerParams);
            var addMethod = new MateData.MethodMet();
            addMethod.name = "set_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline void set_" + name + " ( const std::string& value ) ";
            addMethod.isinline = 1;
            node.addMethod(addMethod);
            //char* 写入
            var addVerRetc = new MateData.VariableMet();
            addVerRetc.type = "void";
            addVerRetc.name = "";
            var variablec = [];
            var addVerParamsc = new MateData.VariableMet();
            addVerParamsc.type = "char";
            addVerParamsc.name = "value";
            addVerParamsc.isconst = 1;
            addVerParamsc.ispoint = 1;
            addVerParamsc.isuseadder = 0;
            variablec.push(addVerParamsc);
            var addMethodc = new MateData.MethodMet();
            addMethodc.name = "set_" + name;
            addMethodc.returndata = addVerRetc;
            addMethodc.params = variablec;
            addMethodc.rawline = "inline void set_" + name + " ( const char* value ) ";
            addMethodc.isinline = 1;
            node.addMethod(addMethodc);
            //char* 写入指定长度
            var addVerRetcl = new MateData.VariableMet();
            addVerRetcl.type = "void";
            addVerRetcl.name = "";
            var variablecl = [];
            var addVerParamscl1 = new MateData.VariableMet();
            addVerParamscl1.type = "char";
            addVerParamscl1.name = "value";
            addVerParamscl1.isconst = 1;
            addVerParamscl1.ispoint = 1;
            addVerParamscl1.isuseadder = 0;
            variablecl.push(addVerParamscl1);
            var addVerParamscl2 = new MateData.VariableMet();
            addVerParamscl2.type = "size_t";
            addVerParamscl2.name = "size";
            addVerParamscl2.isconst = 0;
            addVerParamscl2.ispoint = 0;
            addVerParamscl2.isuseadder = 0;
            variablecl.push(addVerParamscl2);
            var addMethodcl = new MateData.MethodMet();
            addMethodcl.name = "set_" + name;
            addMethodcl.returndata = addVerRetcl;
            addMethodcl.params = variablecl;
            addMethodcl.rawline = "inline void set_" + name + " ( const char* value , size_t size ) ";
            addMethodcl.isinline = 1;
            node.addMethod(addMethodc);
            this._makenObjectAddAnalyseFiled(node, name, "std::string", annotate);
        };
        //添加数字类型
        _this._makenNumberAddAnalyseFiled = function (node, name, type, annotate) {
            //直接写入写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "void";
            addVerRet.name = "";
            var variable = [];
            var addVerParams = new MateData.VariableMet();
            addVerParams.type = type;
            addVerParams.name = "value";
            addVerParams.isconst = 0;
            addVerParams.ispoint = 0;
            addVerParams.isuseadder = 0;
            variable.push(addVerParams);
            var addMethod = new MateData.MethodMet();
            addMethod.name = "set_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline void set_" + name + " ( " + type + " value ) ";
            addMethod.isinline = 1;
            node.addMethod(addMethod);
        };
        //添加数字类型
        _this._makenObjectAddAnalyseFiled = function (node, name, type, annotate) {
            //直接写入写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = type;
            addVerRet.name = "";
            addVerRet.ispoint = 1;
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = "mutable_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline " + type + "* mutable_" + name + " ( ) ";
            addMethod.isinline = 1;
            node.addMethod(addMethod);
        };
        //添加数组类型
        _this._makenNumberArrayAddAnalyseFiled = function (node, name, type, annotate) {
            //直接写入写入mutable接口
            //inline ::google::protobuf::RepeatedField< ::google::protobuf::uint64 >* mutable_tenpay_mch_id();
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "::google::protobuf::RepeatedField< " + type + " >";
            addVerRet.name = "";
            addVerRet.ispoint = 1;
            addVerRet.ispoint = 1;
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = "mutable_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline ::google::protobuf::RepeatedField< " + type + " >* mutable_" + name + " ( ) ";
            addMethod.isinline = 1;
            node.addMethod(addMethod);
            //set接口
            //inline void set_tenpay_mch_id(int index, ::google::protobuf::uint64 value);
            var addVerSetRet = new MateData.VariableMet();
            addVerSetRet.type = "void";
            addVerSetRet.name = "";
            var variableSet = [];
            var addVerSetParams = new MateData.VariableMet();
            addVerSetParams.type = "int";
            addVerSetParams.name = "index";
            variableSet.push(addVerSetParams);
            var addVerSetParams2 = new MateData.VariableMet();
            addVerSetParams2.type = type;
            addVerSetParams2.name = "value";
            variableSet.push(addVerSetParams2);
            var addMethodSet = new MateData.MethodMet();
            addMethodSet.name = "set_" + name;
            addMethodSet.returndata = addVerSetRet;
            addMethodSet.params = variableSet;
            addMethodSet.rawline = "inline void set_" + name + " ( int index, " + type + " value ) ";
            addMethodSet.isinline = 1;
            node.addMethod(addMethodSet);
            //add接口
            //inline void add_tenpay_mch_id(::google::protobuf::uint64 value);
            var addVerAddRet = new MateData.VariableMet();
            addVerAddRet.type = "void";
            addVerAddRet.name = "";
            var variableAdd = [];
            var addVerAddParams = new MateData.VariableMet();
            addVerAddParams.type = type;
            addVerAddParams.name = "value";
            variableAdd.push(addVerSetParams2);
            var addMethodAdd = new MateData.MethodMet();
            addMethodAdd.name = "add_" + name;
            addMethodAdd.returndata = addVerAddRet;
            addMethodAdd.params = variableAdd;
            addMethodAdd.rawline = "inline void add_" + name + " ( " + type + " value ) ";
            addMethodAdd.isinline = 1;
            node.addMethod(addMethodAdd);
        };
        //添加数组类型
        _this._makenObjectArrayAddAnalyseFiled = function (node, name, type, annotate) {
            //直接写入写入mutable接口
            //inline ::google::protobuf::RepeatedPtrField< ::mmpaymchmerchant::Merchant >* mutable_merchants();
            var addVerRet1 = new MateData.VariableMet();
            addVerRet1.type = "::google::protobuf::RepeatedField< " + type + " >";
            addVerRet1.name = "";
            addVerRet1.ispoint = 1;
            var variable1 = [];
            var addMethod1 = new MateData.MethodMet();
            addMethod1.name = "mutable_" + name;
            addMethod1.returndata = addVerRet1;
            addMethod1.params = variable1;
            addMethod1.rawline = "inline ::google::protobuf::RepeatedField< " + type + " >*  mutable_" + name + " ( ) ";
            addMethod1.isinline = 1;
            node.addMethod(addMethod1);
            //inline ::mmpaymchmerchant::Merchant* add_merchants();
            var addVerAddRet = new MateData.VariableMet();
            addVerAddRet.type = type;
            addVerAddRet.name = "";
            addVerAddRet.ispoint = 1;
            var addMethodAdd = new MateData.MethodMet();
            addMethodAdd.name = "add_" + name;
            addMethodAdd.returndata = addVerAddRet;
            addMethodAdd.params = [];
            addMethodAdd.rawline = "inline " + type + "* add_" + name + " ( ) ";
            addMethodAdd.isinline = 1;
            node.addMethod(addMethodAdd);
            //inline ::mmpaymchmerchant::Merchant* mutable_merchants(int index);
            var addVerRet2 = new MateData.VariableMet();
            addVerRet2.type = type;
            addVerRet2.name = "";
            addVerRet2.ispoint = 1;
            var variable2 = [];
            var addVerSetParams2 = new MateData.VariableMet();
            addVerSetParams2.type = "int";
            addVerSetParams2.name = "index";
            variable2.push(addVerSetParams2);
            var addMethod2 = new MateData.MethodMet();
            addMethod2.name = "mutable_" + name;
            addMethod2.returndata = addVerRet2;
            addMethod2.params = variable2;
            addMethod2.rawline = "inline const " + type + " * mutable_" + name + " ( int index ) ";
            addMethod2.isinline = 1;
            node.addMethod(addMethod2);
        };
        //构造获取长度函数
        _this._makenArrayGetSizeAnalyseFiled = function (node, name, annotate) {
            //inline int merchants_size() const;
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "int";
            addVerRet.name = "";
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = name + "_size";
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "int " + name + "_size ( ) const";
            addMethod.isinline = 1;
            addMethod.isconst = 1;
            node.addMethod(addMethod);
        };
        //构造获取数据函数
        _this._makenObjectArrayGeteAnalyseFiled = function (node, name, type, annotate) {
            //inline const ::mmpaymchmerchant::Merchant& merchants(int index) const;
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = type;
            addVerRet.name = "";
            addVerRet.isuseadder = 1;
            addVerRet.isconst = 1;
            var variable = [];
            var addVerSetParams = new MateData.VariableMet();
            addVerSetParams.type = "int";
            addVerSetParams.name = "index";
            variable.push(addVerSetParams);
            var addMethod = new MateData.MethodMet();
            addMethod.name = name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline const " + type + "& " + name + " ( int index ) const";
            addMethod.isinline = 1;
            addMethod.isconst = 1;
            node.addMethod(addMethod);
            //inline const ::google::protobuf::RepeatedPtrField< ::mmpaymchmerchant::Merchant >& merchants() const ;
            var addVerRet1 = new MateData.VariableMet();
            addVerRet1.type = "::google::protobuf::RepeatedField< " + type + " >";
            addVerRet1.name = "";
            addVerRet1.ispoint = 1;
            addVerRet1.ispoint = 1;
            var variable1 = [];
            var addMethod1 = new MateData.MethodMet();
            addMethod1.name = name;
            addMethod1.returndata = addVerRet1;
            addMethod1.params = variable1;
            addMethod1.rawline = "inline ::google::protobuf::RepeatedField< " + type + " >* " + name + " ( ) ";
            addMethod1.isinline = 1;
            addMethod1.isconst = 1;
            node.addMethod(addMethod1);
        };
        //构造获取函数
        _this._makenGetAnalyseFiled = function (node, name, type, annotate) {
            //直接写入写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = type;
            addVerRet.name = "";
            addVerRet.isuseadder = 1;
            addVerRet.isconst = 1;
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline const " + type + "& " + name + " ( ) const";
            addMethod.isinline = 1;
            addMethod.isconst = 1;
            node.addMethod(addMethod);
        };
        //构造清楚函数
        _this._makenClearAnalyseFiled = function (node, name, annotate) {
            //直接写入写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "void";
            addVerRet.name = "";
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = "clear_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline void clear_" + name + " ( )";
            addMethod.isinline = 1;
            node.addMethod(addMethod);
        };
        //构造获取函数
        _this._makenHasAnalyseFiled = function (node, name, annotate) {
            //直接写入写入
            var addVerRet = new MateData.VariableMet();
            addVerRet.type = "bool";
            addVerRet.name = "";
            var variable = [];
            var addMethod = new MateData.MethodMet();
            addMethod.name = "has_" + name;
            addMethod.returndata = addVerRet;
            addMethod.params = variable;
            addMethod.rawline = "inline bool has_" + name + " ( ) const";
            addMethod.isinline = 1;
            addMethod.isconst = 1;
            node.addMethod(addMethod);
        };
        //分析非数组
        _this._analyseFildNormal = function (node, type, name, annotate) {
            var useNumberTypes = new Set(["uint64_t", "int64_t", "uint32_t", "int32_t", "uint16_t", "int16_t"]);
            //类型转换
            type = this._transferTypeToCpp(node, type);
            //添加设置方法
            if (type == "std::string") {
                this._makeStrAddAnalyseFiled(node, name, annotate);
            }
            if (useNumberTypes.has(type)) {
                this._makenNumberAddAnalyseFiled(node, name, type, annotate);
            }
            else {
                this._makenObjectAddAnalyseFiled(node, name, type, annotate);
            }
            //添加读取方法
            this._makenGetAnalyseFiled(node, name, type, annotate);
            //添加判断是否存在的方法
            this._makenHasAnalyseFiled(node, name, annotate);
            //清楚的方法
            this._makenClearAnalyseFiled(node, name, annotate);
        };
        //分析数组
        _this._analyseFildArray = function (node, type, name, annotate) {
            //类型转换
            type = this._transferTypeToCpp(node, type, annotate);
            var useNumberTypes = new Set(["uint64_t", "int64_t", "uint32_t", "int32_t", "uint16_t", "int16_t"]);
            //添加设置方法
            if (useNumberTypes.has(type)) {
                this._makenNumberArrayAddAnalyseFiled(node, name, type, annotate);
            }
            else {
                this._makenObjectArrayAddAnalyseFiled(node, name, type, annotate);
            }
            //添加读取方法
            this._makenObjectArrayGeteAnalyseFiled(node, name, type, annotate);
            //获取长度
            this._makenArrayGetSizeAnalyseFiled(node, name, annotate);
            //清楚的方法
            this._makenClearAnalyseFiled(node, name, annotate);
        };
        //proto定义转换成cpp类型定义
        _this._transferTypeToCpp = function (node, prototype) {
            if (prototype == "uint64" || prototype == "fixed64") {
                return "uint64_t";
            }
            if (prototype == "int64" || prototype == "sint64" || prototype == "sfixed64") {
                return "int64_t";
            }
            if (prototype == "uint32" || prototype == "fixed32") {
                return "uint32_t";
            }
            if (prototype == "int32" || prototype == "sint32" || prototype == "sfixed32") {
                return "int32_t";
            }
            if (prototype == "int16") {
                return "int16_t";
            }
            if (prototype == "uint16") {
                return "uint16_t";
            }
            if (prototype == "string") {
                return "std::string";
            }
            if (prototype == "bytes") {
                return "std::string";
            }
            if (prototype == "bytes") {
                return "std::string";
            }
            if (prototype == "bool") {
                return "bool";
            }
            if (prototype == "double") {
                return "double";
            }
            if (prototype == "float") {
                return "float";
            }
            if (prototype == "group") {
                return "enum";
            }
            if (/::/g.test(prototype)) {
                //如果本身带有命名空间
                return prototype;
            }
            //内部定义的message
            for (var i = 0; i < node.children.length; i++) {
                if (!node.children[i].ownname) {
                    continue;
                }
                if (node.children[i].ownname.name == prototype) {
                    return node.children[i].namespace;
                }
            }
            if (this.basenamespace == "") {
                return prototype;
            }
            //本命名空间下的变量
            return this.basenamespace + "::" + prototype;
        };
        //proto需要的变量
        _this.proto_annotate = {};
        _this.basenamespace = "";
        return _this;
    }
    ;
    return AnalyseProtobuf;
}(AnalyseBase));
;
module.exports = {
    AnalyseProtobuf: AnalyseProtobuf,
    TypeEnum: TypeEnum
};
