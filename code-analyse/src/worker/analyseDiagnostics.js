/* --------------------------------------------------------------------------------------------
 * checkNeedUpdae.js
 *
 *  Created on: 2020年5月30日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const cluster = require('cluster');
const AnalyseCpp = require('../analyse/analyseCpp').AnalyseCpp;
const TypeEnum = require('../analyse/analyseBase').TypeEnum;
const FileIndexStore = require('../store/store').FileIndexStore;
const KeyWordStore = require('../store/store').KeyWordStore;
const logger = require('log4js').getLogger("cpptips");

class AnalyseDiagnostics extends AnalyseCpp {
	constructor(filecontext, dbpath, filename = '') {
		super(filecontext, false, filename);
		this.filedb = FileIndexStore.getInstace().connect(dbpath, 0);
		this.kwdb = KeyWordStore.getInstace().connect(dbpath, 0);
		this.include = [];
		this.usingnamespace = [""];
		this.functionName = "";
		this.ownName = "";
		this.allfunctionname = "";
		this.ownNameMap = {};
		this.point = [];
		this.index = 0;//当前处理代码块索引
		this.result  = [];
	};

	//分析语法
	DoAnaylse = function() {
		
		//先执行分析，构造分析树
		this.doAnalyse();

		//分析位置
		this.GetBlockPoint();

		//分析函数参数和for中定义的变量
		this.tree.traverseBF((current) => {
			this.GetIncludeAndUsingnamespace(current);
			if(current.data.length <= 0) {
				return;
			}
			//获取第一个子区域
			let index = current.data[0];
			if(index < 2) {
				//第一块不需要处理
				return;
			}

			let _nameMap = this.GetAearSpaceDefine(current, this.lines[index - 2]);
			current.nameMap = _nameMap;
		});

		//遍历树结构，分析具体语法规则
		this.tree.traverseDF((current) => {
			//logger.debug(current);
			let fatherNameMap = {};
			//获取父节点的定义
			fatherNameMap = this.GetFatherNameMap(current);
			this.GetOwnName(current);
			//获取成员变量
			if(/[\w]{1,128}::[\w]{1,128}/g.test(this.allfunctionname)){
				//函数实现，需要拉取成员变量
				let _nameMap = this.GetMethodInOwn(this.ownName, this.usingnamespace);
				if(Object.keys(_nameMap).length > 0){
					fatherNameMap = Object.assign(fatherNameMap, _nameMap);
				}
			}

			let nameMap = {};
            for (let i = 0; i < current.data.length; i++) {
				let dataIndex = current.data[i];
				let code = this.lines[dataIndex];
				this.index = dataIndex;			
				nameMap = this.AnaylseCodeBlock(nameMap, fatherNameMap, code);
			}
			current.nameMap = Object.assign(current.nameMap, nameMap);
		});	

		for(let i = 0; i < this.result.length; i++) {
			logger.debug(this.result[i].begin, this.result[i].end, this.context.substring(this.result[i].begin - 20, this.result[i].end));
		}
	};

	//分析代码快在整个文档中的位置
	GetBlockPoint = function() {
		let point = [];
		point.push(0);
		let filecode = this.context;
		for(let i = 0; i < filecode.length; i++) {
			if(filecode[i] == "/" && filecode[i + 1] == "/") {
				//改行注释
				let _pos = filecode.indexOf("\n", i);
				i = _pos;
			}

			if(filecode[i] == "/" && filecode[i + 1] == "*") {
				//注释跳过
				let _pos = filecode.indexOf("*/", i);
				i = _pos;
			}
			if(filecode[i] == "{" || filecode[i] == "}") {
				//如果是{},记录位置
				point.push(i);
			}
		}
		this.point = point;
	};

	//获取当前own的所有方法
	GetMethodInOwn = function(ownname, namespaces){
		if(this.ownNameMap[ownname]) {
			//已经计算过own的成员定义，则直接返回
			return this.ownNameMap[ownname];
		}
		let infos = this.kwdb.getAllInOwnNameAndNs(ownname, namespaces, TypeEnum.VARIABLE);
		let nameMap = {};
		for(let  i = 0;  i< infos.length; i++) {
			let info = infos[i];
			let name = info.name;
			if(info.extdata.length > 0) {
				let extJson =JSON.parse(info.extdata);
				nameMap[name] = extJson.t;
			}
		}
		this.ownNameMap[ownname] = nameMap;
		return nameMap;
	};

	//获取当前ownname，如class
	GetOwnName = function (current) {
		let ownname = current.ownname.name;
		let setDomainKw = new Set(["if", "for", "while", "do"]);
		while(true) {
			if(setDomainKw.has(ownname)) {
				current = current.parent;
				ownname = current.ownname.name;
				continue;
			}
			break;
		}

		this.allfunctionname = ownname;
		this.ownName = "";
		this.functionName = ownname;
		let _pos = this.functionName.indexOf("::");
		if(_pos != -1) {
			this.ownName = this.functionName.substring(0, _pos);
			this.functionName = this.functionName.substring(_pos + 2);
		}
	};

	//获取归属与指定区域特殊的定义，如函数参数，for循环里面的定义
	GetAearSpaceDefine = function(current, data) {
		let nameMap = {};
		data = data.trim();
		let stack = [];
		let findPos = -1;
		if(data.lastIndexOf(") :") != -1) {
			let _pos = data.lastIndexOf(") :");
			//可能是构造函数
			let testStr = data.substring(_pos + 3);
			testStr = testStr.replace(/[\s]{1,10}/g, "");
			if(/([,]?[\w]{1,64}\([\w]{1,64}\)){1,32}/g.test(testStr)){
				//测试成功
				data = data.substring(0, _pos + 1);
				//logger.debug(data);
			}
		}

		for(let i = data.length; i > 0; i--) {
			if(data[i] == ')') {
				stack.push(')');
				continue;
			}
			if(data[i] == '('){
				stack.pop();
				if(stack.length <= 0) {
					//闭合找到顶，下一个字符为关键字
					findPos = i - 1;
					break;
				}
				continue;
			}
		}

		if(findPos <= 0) {
			//无效代码块，不符合语法规则的代码
			//这种代码无定义，不需要处理
			return {};
		}

		let keyword = [];
		for(let i = findPos; i >= 0; i--) {
			if(data[i] != " ") {
				keyword.push(data[i]);
				continue;
			}
			if(data[i] == " " && keyword.length > 0) {
				break;
			}
		}

		let strkeyword = keyword.reverse().join("");

		current.ownname.name = strkeyword;
		if(strkeyword == "if" || strkeyword == "else" 
			|| strkeyword == "while" || strkeyword == "do") {
			return {};
		}

		//for循环中定义
		if(strkeyword == "for") {
			let endpos = data.indexOf(";", findPos);
			let item = data.substring(findPos + 2, endpos).trim();
			let _pos = item.indexOf("=");
			let _value = [];
			let i = _pos - 2;
			for(; i > 0; i--) {
				if(item[i] != " ") {
					_value.push(item[i]);
					continue;
				}
				if(item[i] == " " && _value.length > 0) {
					break;
				}
			}
			let valName = _value.reverse().join("");
			let valType = item.substring(0, i).trim().replace(/[\s]{1,10}/g, "");
			nameMap[valName] = valType;
			return nameMap;
		}

		//解释函数参数
		let param = data.substring(findPos + 2, data.length - 1).trim();
		param = param.replace(/[\s]{0,10}[<>,]{1,1}[\s]{0,10}/g, (kw)=>{ return kw.trim(); });
		param = param.replace(/(const )|([&*]{1,2})/g, "");
		param = param.replace(/(unsigned int)|(unsigned long)|(long long)/g, (kw)=>{
			return kw.replace(/[\s]{1,4}/g, "_");
		});
		let reg = /([\w:<>,]{1,128})[\s]{1,4}([\w]{1,64})/g;
		let result = param.match(reg);
		//logger.debug(result);
		for(let i = 0; result && i < result.length; i++) {
			let item = result[i].trim();
			if(item[0] == ",") {
				item = item.substring(1);
			}
			item = item.replace(/(const )|([&]{1,1})|([*]{1,2})/g, " ");
			let _pos = item.lastIndexOf(" ");
			let typeName = item.substring(0, _pos);
			typeName = typeName.replace(/[\s]{1,10}/g, "");
			let valName = item.substring(_pos).trim();
			nameMap[valName] = typeName;
		}
		return nameMap;
	};

	//获取分析结果
	GetAnaylseResult = function() {
		return this.result;
	};

	//获取父domain的所有的名字定义
	GetFatherNameMap = function(current) {
		let nameMap = current.nameMap;
		while(true) {
			if(!current.parent) {
				break;
			}
			current = current.parent;
			let _nameMap = current.nameMap;
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
	AnaylseCodeBlock = function(nameMap, fatherNameMap, codeBlock) {
		let codes = codeBlock.split(/[;{}]{1,1}/g);
		for(let i = 0; i < codes.length; i++) {
			let code = codes[i].trim();
			if(/^for[\s]{0,10}\(/.test(code)) {
				let _pos = code.indexOf("(");
				code = code.substring(_pos + 1).trim();
			}
			code = code.replace(/[\s]{0,10}[.*&,=<>\-()]{1,1}[\s]{0,10}/g, (kw)=>{ 
				let ckw = kw.trim(); 
				if(ckw.trim() == "*") {
					return "* ";
				}
				if(ckw.trim() == ">") {
					return "> ";
				}
				if(ckw.trim() == "&") {
					return "& ";
				}
				if(ckw.trim() == "*") {
					return "* ";
				}
				return ckw;
			});
			if(code == ""
				||/^(return|#include|#define|#if|#endif|namespace|using|using____namespace) /g.test(code)
				||/^if\(|else if\(/g.test(code)) {
				//退出
				continue;
			}
			code = code.replace(/[(,]{1,1}[*&]{1,1}[\s]{1,4}/g, (kw)=>{
				return kw.trim();
			});
			code = code.replace(/(unsigned int)|(unsigned long)|(long long)/g, (kw)=>{
				return kw.replace(/[\s]{1,4}/g, "_");
			});
		
			nameMap = this.AnaylseCode(nameMap, fatherNameMap, code);
		}
		return nameMap;
	};

	//分析一行代码
	AnaylseCode = function(nameMap, fatherNameMap, code) {
		
		code = code.replace("const ", "");
		//定义判断
		let reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})([*&]{0,2}) ([\w]{1,64})$/g;
		let match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let type = match[1];
			let name = match[4];
			//if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
			nameMap[name] = type;
			return nameMap;
		}

		//变量定义，带参数
		reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})[*&]{0,2} ([\w]{1,64})[\s]{0,16}((\()|(=[\s]{0,16}new ))/g;
		match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let type = match[1];
			let name = match[3];
			nameMap[name] = type;
			return nameMap;
		}

		//模版成员变量定义
		reg = /^((([\w]{1,64}::){0,8}[\w]{1,64})<(([,]?([\w]{1,64}::){0,10}[\w]{1,64}){1,10})>)([*&]{0,2}) ([\w]{1,64})$/g;
		match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let type = match[1];
			let name = match[8];
			//if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
			nameMap[name] = type;
			return nameMap;
		}

		//模版成员变量定义,带初始值
		reg = /^((([\w]{1,64}::){0,8}[\w]{1,64})<(([,]?([\w]{1,64}::){0,10}[\w]{1,64}){1,10})>)[*&]{0,2} ([\w]{1,64})[\s]{0,16}=[\s]{0,16}([\w.,(*&)"]{1,128})$/g;
		match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let type = match[1];
			let name = match[7];
			let value = match[8];
			//if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code);
			nameMap[name] = type;

			let typeOfName = type;
			let valType = false;
			if(value.indexOf("(") != -1) {
				//函数调用
				valType = this.CheckFunctionParams(value, nameMap, fatherNameMap);
				// if(name == "bitsetProperty") logger.debug(valType, typeOfName);
			} else if(/^[\d]{1,25}$/g.test(value)) {
				valType = "number";
			} else if(/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
				valType = "float";
			} else if(/^\"[^"]{0,1024}\"$/g.test(value)) {
				valType = "std::string";
			} else if(value == "false" || value == "true"){
				valType = "bool";
			}else {
				valType = this.GetNameType(nameMap, fatherNameMap, value);
				if(!valType) {
					//尝试查找宏定义或者枚举
					valType = this.CheckValueIsDefineOrEnumItem(value);
				}
			}
	
			if(!valType) {
				//变量未定义
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, type, value, "变量为定义");
				return nameMap;
			}
			if(typeOfName == "auto") {
				nameMap[name] = valType;
				return nameMap;
			}

			if(!this.TypeCheck(typeOfName, valType)) {
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, type, value, "变量类型不匹配");
				//if(name == "strInterfaceSource")logger.debug(match,matchcode, type, value);
				return nameMap;
			}
			return nameMap;
		}
		
		
		//带初始值的定义判断
		reg = /^([\w]{1,64}(::[\w]{1,64}){0,10})[*&]{0,2} ([\w]{1,64})[\s]{0,16}=[\s]{0,16}([\w.,()*&"]{1,128})$/g;
		match = reg.exec(code);
		if(match) {
			if(/MMPAY_CTIME_ELF/g.test(code)){
				logger.debug(code);
			}
			// logger.debug(match);
			let type = match[1];
			let name = match[3];
			let value = match[4];
			nameMap[name] = type;
			
			let typeOfName = type;
			let valType = false;
			if(value.indexOf("(") != -1) {
				//函数调用
				valType = this.CheckFunctionParams(value, nameMap, fatherNameMap);
				if(name == "i") logger.debug("jjjjjjjjjjj",value,nameMap, fatherNameMap,valType, typeOfName)
			} else if(/^[\d]{1,25}$/g.test(value)) {
				valType = "number";
			} else if(/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
				valType = "float";
			} else if(/^\"[^"]{0,1024}\"$/g.test(value)) {
				valType = "std::string";
			} else if(value == "false" || value == "true"){
				valType = "bool";
			} else {
				valType = this.GetNameType(nameMap, fatherNameMap, value);
				if(!valType) {
					//尝试查找宏定义或者枚举
					valType = this.CheckValueIsDefineOrEnumItem(value);
				}
			}

			if(!valType) {
				//变量未定义
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, type, value, "类型未定义");
				return nameMap;
			}

			if(typeOfName == "auto") {
				if(valType == "number") {
					nameMap[name] = "int32_t";
				} else {
					nameMap[name] = valType;
				}
				//if(code == "auto i=0") logger.debug("dfdfdfdfdfdfdfdfdf", code, name, value, type, valType, nameMap);
				return nameMap;
			}

			if(!this.TypeCheck(typeOfName, valType)) {
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, type, value, "变量类型不匹配1" +  typeOfName +"|"+ valType);
				return nameMap;
			}
			return nameMap;
		}
		
		//赋值预计检查
		reg = /^([\w]{1,64})=([\w.,]{1,128})$/g;
		match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let name = match[1];
			let value = match[2];
			if(name == "m_pNewIdMaker") logger.debug(nameMap, fatherNameMap, name, value);
			let typeOfName = this.GetNameType(nameMap, fatherNameMap, name);
			if(!typeOfName) {
				//变量未定义
				logger.debug(code, name, value, nameMap, fatherNameMap);
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, name, value, "变量未定义");
				return nameMap;
			}

			let valType = false;
			//如果value是数字类型
			if(/^[\d]{1,25}$/g.test(value)) {
				valType = "int";
			} else if(/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(value)) {
				valType = "number";
			} else if(/^\"[^"]{1,1024}\"$/g.test(value)) {
				valType = "std::string";
				logger.debug(name, value);
			} else if(value == "false" || value == "true"){
				valType = "bool";
			} else {
				valType = this.GetNameType(nameMap, fatherNameMap, value);
				if(!valType) {
					//尝试查找宏定义或者枚举
					valType = this.CheckValueIsDefineOrEnumItem(value);
				}
			}
			if(!valType) {
				//变量未定义
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, name, value, "类型为定义");
				return nameMap;
			}
			if(!this.TypeCheck(typeOfName, valType)) {
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, name, value, "类型未匹配");
				return nameMap;
			}
			return nameMap;
		}

		//函数调用检查 = a().b();
		reg = /^([\w]{1,64})=([\w:.]{1,64}\([\w.,():]{1,128}\))$/g;
		match = reg.exec(code);
		if(match) {
			//logger.debug(match);
			let name = match[1];
			let value = match[2];
			let typeOfName = this.GetNameType(nameMap, fatherNameMap, name);
			if(!typeOfName) {
				//变量未定义
				let matchcode = match[0].replace(/[\s]{1,10}/g, "");
				this.GetPointInSource(matchcode, name, value, "类型为定义");
				return nameMap;
			}
			//check函数参数
			let _type = this.CheckFunctionParams(value, nameMap, fatherNameMap);
			if(!this.TypeCheck(typeOfName, _type)) {
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
	CheckValueIsDefineOrEnumItem = function(val) {
		let infos = this.kwdb.getByNameAndNamespaces(val, this.usingnamespace);
		let _type = false;
		for(let k = 0; k < infos.length; k++) {
			if(infos[k].type == TypeEnum.ENUMITEM) {
				//枚举值
				_type = "int";
				return _type;
			}
			if(infos[k].type == TypeEnum.DEFINE) {
				//宏定义值
				let defineType = JSON.parse(infos[k].extdata);
				if(/^[\d.]{1,25}$/g.test(defineType.v)){
					_type = "int";
					return _type;
				}
				if(/^\"[.]{0,1024}\"$/g.test(val)) {
					_type = "char*"
					return _type;
				}
			}
		}
		return false;
	};

	//获取真正的类型或者等价类型
	GetRealValType = function(defineType) {
		if(defineType == "unsigned_int") {
			defineType = "unsigned int";
		}
		if(defineType == "unsigned_long") {
			defineType = "unsigned long";
		}
		if(defineType == "long_long") {
			defineType = "long long";
		}

		if(defineType == "int"
			|| defineType == "size_t") {
			defineType = "int32_t";
		}

		if(defineType == "time_t"){
			defineType = "uint32_t";
		}
		return defineType;
	};

	//数字等价判断
	TypeCheck = function(defineType, valType) {
		if(valType == "#define") {
			//宏定义，非函数
			return true;
		}

		if(valType == "char*" 
			&& (defineType == "std::string" || defineType == "string")){
			return true;
		}
		
		defineType = this.GetRealValType(defineType);
		valType = this.GetRealValType(valType);
		
		let numberType = [
			"std::bitset<64>", "uint64_t", "int64_t", "std::bitset<32>","uint32_t", "int32_t",
			 "uint16_t", "int16_t", "uint8_t", 
			 "int8_t", "char", "byte", "bool", "NULL", "number"
		];
		let defineleve = -1;
		for(let i = 0; i < numberType.length; i++) {
			//if(valType == "number") logger.debug("ddddddd",defineType, valType,defineleve, numberType[i]);
			if(numberType[i] == defineType) {
				defineleve = i;
			}
			if(numberType[i] == valType) {
				if(defineleve == -1) {
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
	AnalyseFunctionParams = function(paramsStr) {
		let params = [];
		let _stack = [];
		let _params = "";
		for(let i = 1; i < paramsStr.length - 1; i++) {
			if(paramsStr[i] == ",") {
				if(_stack.length == 0) {
					params.push(_params.trim());
					_params = "";
					continue;
				}
			}
			if(paramsStr[i] == "(") {
				_stack.push("(");
			}
			if(paramsStr[i] == ")") {
				_stack.pop("(");
			}
			_params = _params + paramsStr[i];
		}
		if(_params.trim().length > 0) {
			params.push(_params);
		}
		//logger.debug(params);
		return params;
	};

	//分析函数并获取返回类型
	GetFunctionRetType = function(type, name, paramsStr, nameMap, fatherNameMap) {
		if(type.indexOf("<") != -1) {
			let _pos = type.indexOf("<");
			type = type.substring(0, _pos);
		}
		//校验函数参数并返回函数返回值
		let params = this.AnalyseFunctionParams(paramsStr);
		
		let _ns = "";
		let _ownname = [type];
		if(type == "") {
			_ownname.push(this.ownName);
		}
		if(type.indexOf("::") != -1) {
			let _pos = type.lastIndexOf("::");
			_ns = type.substring(0, _pos);
			_ownname = [type.substring(_pos + 2)];
		}
		let usens = [_ns];
		if(_ns == "") {
			usens = this.usingnamespace;
		}

		let info = this.kwdb.getByOwnNameAndNameType(_ownname, name, usens, TypeEnum.FUNCTION);
		//测试代码//////////////////////////////////////////////////////
		// if(name == "str"){
		// 	logger.debug("xxxxxxxxxxxxx", _ownname, usens, info);
		// }
		if(info.length == 0) {
			//没查到函数可能是宏定义
			let info = this.kwdb.getByOwnNameAndNameType(_ownname, name, usens, TypeEnum.DEFINE);
			if(info.length > 0) {
				let jsonData = JSON.parse(info[0].extdata);
				if(params.length != jsonData.p.length) {
					//宏参数不匹配
					logger.debug("#define params not match!");
				}
				//宏定义
				return "#define";
			}
		}

		/////////////////////////////////////////////////////////////
		if(info.length > 0) {
			let extData = info[0].extdata;
			//if(name == "_AddProcessFlows")logger.debug("xxxxxxx", info[0], params);
			let extJson = JSON.parse(extData);
			for(let i = 0; i < extJson.length; i++) {
				if(extJson[i].i.length >= params.length) {
					//产生匹配的才进行分析
					let isError = false;
					for(let j = 0; j < extJson[i].i.length; j++) {
						if(j >= params.length) {
							//函数默认值处理
							//如果超出的参数必须要有默认值，否则报错
							if(extJson[i].i[j].v == null) {
								logger.debug("params not match!", extJson[i].i[j]);
								isError = true;
								continue;
							}
							continue;
						}
						let defineType =  extJson[i].i[j].t;
						let val = params[j];
						
						if((val == "NULL" || val == "nullpter")
							&& extJson[i].i[j].p == 1) {
							//设置了指针
							continue;
						}

						//如果参数的值是数字
						if(/^[\d]{1,25}$/g.test(val)) {
							//数字
							let numberType = new Set(
								["int32_t", "uint32_t", "int16_t", "uint16_t", "uint64_t",
								"int64_t", "int", "double", "float", "unsigned int",
								"long", "unsigned long", "long long", "unsigned long long"]);
							if(!numberType.has(defineType)) {
								//非数字类型，但是匹配了数字
								logger.debug("this type is number", defineType, val);
								isError = true;
								continue;
							}
							continue;
						}

						//如果参数的值是浮点数
						if(/^[\d]{1,25}[.]{1,1}[\d]{1,10}$/g.test(val)) {
							//数字
							let numberType = new Set(["double", "float"]);
							if(!numberType.has(defineType)) {
								//非数字类型，但是匹配了数字
								logger.debug("this type is number", defineType, val);
								isError = true;
								continue;
							}
							continue;
						}

						//如果参数的值是字符串
						if(/^\"[^"]{0,1024}\"$/g.test(val)) {
							let numberType = new Set(["string", "std::string", "char*", "char *"]);
							if(!numberType.has(defineType)) {
								//非字符类型，使用了字符的规则
								logger.debug("this type is string", defineType, val);
								isError = true;
								continue;
							}
							continue;
						}

						//如果参数是函数
						if(val.indexOf("(") != -1) {
							let _type = this.CheckFunctionParams(val, nameMap, fatherNameMap);
							if(!this.TypeCheck(defineType, _type)) {
								logger.debug("this function return type is not match", defineType, _type, val);
								isError = true;
								continue;
							}
							continue;
						}

						//其他情况进行匹配
						let _type = this.GetNameType(nameMap, fatherNameMap, val);
						// if(name == "GetCurrentProccessByBusinessCode") logger.debug(nameMap, fatherNameMap,val);
						if(!_type) {
							//变量为定义
							//判断是否宏定义或者枚举
							let pass = false;
							let infos = this.kwdb.getByNameAndNamespaces(val, this.usingnamespace);
							for(let k = 0; k < infos.length; k++) {
								if(infos[k].type == TypeEnum.ENUMITEM) {
									//枚举值
									_type = "number";
									pass = true;
								}
								if(infos[k].type == TypeEnum.DEFINE) {
									//宏定义值
									let defineType = JSON.parse(infos[k].extdata);
									if(/^[\d.]{1,25}$/g.test(defineType.v)){
										_type = "number";
										pass = true;
									}
									if(/^\"[.]{0,1024}\"$/g.test(val)) {
										_type = "char*"
										pass = true;
									}
								}
							}
							
							//logger.debug(nameMap, fatherNameMap, val, this.allfunctionname);
							if(!pass) {
								logger.debug("this val not define！", defineType, _type, val);
								isError = true;
								continue;
							}
						}
						if(!this.TypeCheck(defineType, _type)) {
							//类型不匹配
							logger.debug("this function return type is not match！", defineType, _type, val);
							isError = true;
							continue;
						}
					}
					if(!isError) {
						// if(name == "GetCurrentProccessByBusinessCode") logger.debug(extJson[0]);
						let _retType = extJson[0].r.t;
						if(extJson[0].r.p == 1) {
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
	GetVariableType = function(type, name) {
		// kwdb.
	};

	//获取当前文档并包含的命名空间
	GetIncludeAndUsingnamespace = function(current) {
        if (current.include.length > 0
            || current.usingnamespace.length > 0) {
            //首节点
            //包含的头文件
            let _include = current.include.length > 0 ? current.include : [];
            //引用的命名空间
            let _usingnamespace = current.usingnamespace.length > 0 ? current.usingnamespace : [];
            //保存头文件
            this.include = this.include.concat(_include);
            this.usingnamespace = this.usingnamespace.concat(_usingnamespace);
        }
    }

	//分析函数调用序列
	GetFuncSequeue = function(func) {
		//分析出函数调用序列
		let fname = [];
		let _tmpname  = "";
		let _params = "";
		for(let i = 0; i < func.length - 1; i++){
			if(func[i] == ".") {
				fname.push({name:_tmpname, params: _params});
				_tmpname = "";
				_params = "";
				continue;
			}
			if(func[i] == "-" && func[i + 1] == ">") {
				fname.push({name:_tmpname, params: _params});
				_tmpname = "";
				_params = "";
				i = i + 1;
				continue;
			}
			if(func[i] == ":" && func[i + 1] == ":") {
				fname.push({name:_tmpname, params: _params});
				_tmpname = "";
				_params = "";
				i = i + 1;
				continue;
			}
			if(func[i] == "(") {
				//处理参数
				let _stack = [];
				let j = i;
				while(j < func.length) {
					if(func[j] == "("){
						_stack.push('(');
						j++;
						continue;
					}
					if(func[j] == ")") {
						_stack.pop();
					}
					if(_stack.length == 0) {
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
		fname.push({name:_tmpname, params: _params});
		return fname;
	};

	//检测函数参数
	CheckFunctionParams = function(func, nameMap, fatherNameMap) {
		let _pos = func.indexOf("(");
		let name = func.substring(0, _pos);

		let funcSq = this.GetFuncSequeue(func);
		let names = funcSq[0];
		let type = this.GetNameType(nameMap, fatherNameMap, names.name);
		if(!type) {
			if(names.params != "") {
				//没有找到定义
				//可能是全局变量或者不带命名空间的函数用法
				type = "";
				let tmpSq = [names];
				funcSq = tmpSq.concat(funcSq);
			} else {
				this.GetPointInSource(func, funcSq[0].name, names.name, "函数参数不匹配");
				//logger.debug("xxx error", names,nameMap, fatherNameMap);
				return false;
			}
		}

		//检查函数参数
		for(let i = 1; i < funcSq.length; i++) {
			names = funcSq[i];
			if(names.params == "") {
				type = this.GetVariableType(type, names.name);
			} else {
				//检查参数
				//获取返回值
				let _type = this.GetFunctionRetType(type, names.name, names.params, nameMap, fatherNameMap);
				if(!_type) {
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
	GetPointInSource = function(func, bname, name, msg) {
		
		let retPos = 0;
		let startPos = this.point[this.index / 2];
		let endPos = this.point[this.index / 2 + 1];
		let source = this.context.substring(startPos, endPos);
		retPos = source.indexOf(name);
		let _pos = 0;
		let find = false;
		while(!find) {
			_pos = source.indexOf(bname, _pos);
			if(_pos == -1) {
				//异常情况
				break;
			}
			//logger.debug(_pos, source, bname);
			let linecode = "";
			for(let i = _pos; i < source.length; i++){
				if(source[i] != " " && source[i] != "\t" 
					&& source[i] != "\n" && source[i] != "\r") {
					linecode = linecode + source[i];
					//logger.debug(linecode);
				}

				let _findPos = func.indexOf(linecode);
				if(_findPos == -1) {
					//跳过继续查找
					//logger.debug("linecode", func, linecode);
					_pos = i;
					linecode = "";
					find = false;
					break;
				} else if(_findPos > 0) {
					//异常情况，退出
					logger.debug(func, bname, name);
					return 0;
				}

				if(func == linecode){
					//找到位置
					//if(func=="std::stringstrErrmsg=0")logger.debug("dddd:",source, linecode, name);
					retPos = source.indexOf(name, _pos);
					find = true;
					break;
				}
			}
		}
		//logger.debug("ss", this.context.substring(startPos + retPos, startPos + retPos + name.length), "dd", bname);
		let range = {begin: startPos + retPos, end: startPos + retPos + name.length};
		this.result.push(range);
		logger.debug("error:", msg, name, range);
		return startPos + retPos;
	};

	//获取变量的类型
	GetNameType = function(nameMap, fatherNameMap, name) {
		//当前域定义的
		if(nameMap.hasOwnProperty(name)) {
			return nameMap[name];
		}

		//父域中定义的
		if(fatherNameMap.hasOwnProperty(name)) {
			return fatherNameMap[name];
		}

		//logger.debug(nameMap, fatherNameMap, name);
		return false;
	};
};

if (cluster.isMaster) {
    //测试代码
	//获取basepath
	const fs = require('fs');
	let basedir = "/";
	let dbpath = "/";
	let filename = "PassCurrentProcess.cpp";
	let fd = fs.openSync(basedir + filename, 'r');
	const buffer = Buffer.alloc(1024 * 1024);
	let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024);
	let context = buffer.toString('utf8', 0, bytesRead);

    const worker = cluster.fork();
    let parasms = {
		filecontext: context,
		filename: filename,
		dbpath: dbpath
    };
    worker.send(parasms);
    worker.on('message', (data) => {
        if(data.type == "result") {
			logger.debug(data.data);
            worker.kill();
        }
    });
} else if (cluster.isWorker) {
	process.on('message', (parasms) => {
		//logger.debug(parasms);
		let filecontext = parasms["filecontext"];
		let filename = parasms["filename"];
		let dbpath = parasms["dbpath"];
		let ad = new AnalyseDiagnostics(filecontext, dbpath, filename);
		ad.DoAnaylse();
		//获取结构
		let result = ad.GetAnaylseResult();
		process.send({data:JSON.stringify(result), type:"result"});
	});
}