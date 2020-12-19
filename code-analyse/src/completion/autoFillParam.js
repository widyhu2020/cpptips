/* --------------------------------------------------------------------------------------------
 * definition.js
 *
 *  Created on: 2020年4月25日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const TypeEnum = require('../analyse/analyseCpp').TypeEnum;
const KeyWordStore = require('../store/store').KeyWordStore;
const FileIndexStore = require('../store/store').FileIndexStore;
const Completion = require('../completion/completion').Completion;
const fs = require('fs');
const path = require('path');
const logger = require('log4js').getLogger("cpptips");

class AutoFillParam extends Completion{
	constructor() {
		super();
	};

	setParamsInfo = function(filecontext, paramsStr, paramsPos) {
		this.filecontext = filecontext;
		this.paramsPos = paramsPos;
		this.paramsStr = paramsStr;
		this.functionName = "";
		this.paramsName = "";
	}

	autoAnalyseParams = function(objName, functionName, namespaces) {
		this.functionName = functionName;
		let fucInfo = this._getFunctionDefine(objName, namespaces);
		if(!fucInfo) {
			//没有找到函数定义
			return false;
		}

		//获取函数的参数列表
		let paramsType = [];
		let extJson = JSON.parse(fucInfo.extdata);
		for(let i = 0; i < extJson.length; i++) {
			let params = extJson[i].i;
			if(params.length >= this.paramsPos) {
				//只处理第一个重载
				paramsType.push(params[this.paramsPos - 1]);
				this.paramsName = params[this.paramsPos - 1].n;
				break;
			}
		}

		//获取当前定义变量
		let nameMap = this._getAllVarDefine(objName, this.filecontext, namespaces);
		logger.debug(JSON.stringify(nameMap));
		let selectList = [];
		for(let i = 0; i < paramsType.length; i++) {
			let type = paramsType[i].t;
			type = type.replace(/[\s*\s]{1,10}/g, "* ");
			if(type.indexOf("::") < 0){
				type = this.getClassFullName(type, namespaces);
			}
			if(nameMap[type]) {
				//匹配到类型
				selectList = selectList.concat(nameMap[type]);
			} else {
				//同名
				if(nameMap[objName]){
					selectList = selectList.concat(nameMap[objName]);
				}
			}
		}
		
		//构造返回数据
		let retData = [];
		for(let i = 0; i < selectList.length; i++) {
			retData.push(this._makeReturnStruct(selectList[i]));
		}
		retData.sort((a,b)=>{ return a.d - b.d; });
		return retData;
	};

	//尝试获取未归属或者默认this归属
	getRealOwnByName = function(name, ownnames, namespaces) {
		let keydb = KeyWordStore.getInstace();
		let infos = keydb.getByOwnNameAndName(ownnames, name, namespaces);
		if(infos.length <= 0) {
			return false;
		}

		//取第一个，多个忽略其他
		let realName = infos[0].ownname;
		if(infos[0].namespace.length > 0) {
			realName = infos[0].namespace + "::" + infos[0].ownname;
		}
		return realName;
	};

	_makeReturnStruct = function(type) {
		let _type = type.name;
		let _degree = type.degree;
		let extData = JSON.stringify({ n: "", s: "", o: this.functionName, f: -1, t: TypeEnum.FUNCTION, d:_degree });
		let node = {
			s : _type,
			t : TypeEnum.FUNCTION,
			n : extData,
			f : "",
			i : "",
			d : _degree,
			c : _type
		};
		return node;
	};

	//获取所有定义
	_getAllVarDefine = function(objName, filecontext, namespaces) {
		//去掉模版定义里面的空格
		let typeMap = { };
		let keyword = new Set(["using_ns", "const", "struct", "class", "enum", "namespace", "interface"]);
		filecontext.replace(/<[\w\s,]{1,256}>/g, (kw) => { return kw.replace(/[\s]{1,10}/g, ""); });
		let reg = /((([\w]{3,64}::){0,5}[\w]{1,64})|(([\w]{1,64}::){0,5}[\w]{1,64}<[,\s]{0,4}([\w]{1,64}::){0,5}[\w]{1,64})>)[*&\s\t]{1,20}([\w]{1,64})[\s]{0,10}[=;,)]{1,1}/g;
		let result = filecontext.match(reg);
		for(let i = 0; i < result.length; i++) {
			let valDefineReg = /((([\w]{1,64}::){0,5}[\w]{1,64})|(([\w]{1,64}::){0,5}[\w]{1,64}<[,\s]{0,4}([\w]{1,64}::){0,5}[\w]{1,64})>)[*&\s\t]{1,20}([\w]{1,64})[\s]{0,10}[=;,)]{1,1}/g;
			let code = result[i];
			let getResult = valDefineReg.exec(code);
			let type = getResult[1];
			let name = getResult[7];
			if(keyword.has(type)) {
				//命中关键字
				continue;
			}

			typeMap = this._getObjectFunction(typeMap, false, name, type, namespaces, 0);
		}

		return typeMap;
	};

	//获取对象对应的方法
	_getObjectFunction = function(codes, ispoint, preown, type, namespaces, displayDegree, depth = 0) {
		if(depth > 3) {
			//大于3层的结构体这里不进行分析
			return codes;
		}

		depth = depth + 1;
		let newcode = preown;
		codes = this._saveTypeToName(codes, type, newcode, displayDegree);
		let sampleType = new Set([
			"int", "char", "uint32_t", "uint64_t", "int32_t", "int64_t", "bool", "float", "double", "int16_t", "uint16_t",
			"int*", "char*", "uint32_t*", "uint64_t*", "int32_t*", "int64_t*", "bool*", "float*", "double*", "int16_t*", "uint16_t*",
			"unsigned int", "long", "long long", "unsigned long","unsigned int*", "long*", "long long*", "unsigned long*"
		]);
		if(sampleType.has(type)) {
			//简单类型无需在继续查找方法
			return codes;
		}

		let usenamespace = namespaces;
		let keydb = KeyWordStore.getInstace();
		let hasnamespace = new Set(namespaces);
		let ownname = type;
		if(type.indexOf("::") != -1) {
			//包含命名空间
			let _pos = type.lastIndexOf("::");
			let namespace = type.substring(0, _pos);
			ownname = type.substring(_pos + 2);
			if(!hasnamespace.has(namespace)) {
				//不能使用累计的命名空间，否则可能拉出不属于该命名空间的定义
				usenamespace = [];
				usenamespace.push(namespace);
				hasnamespace.add(namespace);
			}
		}

		if(ownname == "string") {
			//字符串，只返回c_str//暂时不出c_str
			let _type = preown + ".c_str()";
			if(ispoint) {
				_type = preown + "->c_str()";
			}
			return codes;
		}
		if(ownname == "") {
			logger.debug(ownname, preown, type);
			return codes;
		}
		logger.mark("getByOwnNameAndNs");
		let functions = keydb.getByOwnNameAndNs(ownname, usenamespace);
		logger.mark("getByOwnNameAndNs");
		for(let i = 0; i < functions.length; i++) {
			let func = functions[i];
			if(!func.extdata || func.extdata.length <= 0) {
				//没有收集函数
				continue;
			}
			
			let funcname = func.name;
			if(/^mutable_|^add_|^has_/g.test(funcname)) {
				//protobuf明确写入的函数不考虑在内
				continue;
			}

			let _displayDegree = this.similar(this.cleanProtobufWord(funcname), this.cleanProtobufWord(this.paramsName.toLowerCase()));
			let _funcisplayDegree = this.similar(this.cleanProtobufWord(funcname), this.cleanProtobufWord(this.functionName.toLowerCase()));
			logger.debug(funcname, this.paramsName, this.functionName, "相似度：", _displayDegree, _funcisplayDegree);
			if(_funcisplayDegree > _displayDegree ) {
				//使用匹配度高的
				_displayDegree = _funcisplayDegree;
			}
			_displayDegree = _displayDegree * 1000;
			
			let extJson = JSON.parse(func.extdata);
			for(let j = 0; j < extJson.length; j++) {
				let funcparams = extJson[j];
				let type = funcparams.r.t;
				if(_displayDegree < 500 
					&& (sampleType.has(type) || type == "string" || type == "std::string" )){
					//显示度小于指定值的全部忽略
					continue;
				}
				let _ispoint = false;
				if(funcparams.r.p != 0) {
					_ispoint = true;
				}
				if(!ispoint) {
					preown = newcode + "." + funcname + "(";
				} else {
					preown = newcode + "->" + funcname + "(";
				}
				if(funcparams.i.length > 0) {
					preown = preown + "%params%)";
				} else {
					preown = preown + ")";
				}
				codes = this._getObjectFunction(codes, _ispoint, preown, type, namespaces, _displayDegree, depth);
			}
		}
		return codes;
	};

	//去掉proto生成的头
	cleanProtobufWord = function(name) {
		name = name.toLowerCase();
		name = name.replace(/^(add_|set_|has_|mutable_)/g, "");
		name = name.replace(/[_]{1,4}/g, "");
		return name;
	};

	//比较两个字符相似度
	//来源csdn
	similar = function(s, t, f) {
		if (!s || !t) {
			return 0
		}
		var l = s.length > t.length ? s.length : t.length
		var n = s.length
		var m = t.length
		var d = []
		f = f || 3
		var min = function(a, b, c) {
			return a < b ? (a < c ? a : c) : (b < c ? b : c)
		}
		var i, j, si, tj, cost
		if (n === 0) return m
		if (m === 0) return n
		for (i = 0; i <= n; i++) {
			d[i] = []
			d[i][0] = i
		}
		for (j = 0; j <= m; j++) {
			d[0][j] = j
		}
		for (i = 1; i <= n; i++) {
			si = s.charAt(i - 1)
			for (j = 1; j <= m; j++) {
				tj = t.charAt(j - 1)
				if (si === tj) {
					cost = 0
				} else {
					cost = 1
				}
				d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
			}
		}
		let res = (1 - d[n][m] / l)
		return res.toFixed(f)
	};

	_saveTypeToName = function(codes, type, name, displayDegree) {
		if(!codes[type]) {
			codes[type] = [{name:name,degree:displayDegree}];
			return codes;
		}
		
		codes[type].push({name:name,degree:displayDegree});
		return codes;
	};
	
	_getFunctionDefine = function(objName, namespaces) {
		let name = objName;
		let _pos = objName.lastIndexOf("::");
		if(_pos != -1) {
			name = objName.substring(_pos + 2);
			let namespace = objName.substring(0, _pos);
			namespaces.push(namespace);
		}

		let fucInfos = KeyWordStore.getInstace().getByFullnameNssAndType(name, namespaces, this.functionName, TypeEnum.FUNCTION);
		if(!fucInfos || fucInfos.length <= 0 
			|| fucInfos[0].extdata == "") {
			//没有找到函数定义
			//尝试找基类
			let classinfo = KeyWordStore.getInstace().getByFullnameNssAndType("", namespaces, name, TypeEnum.CALSS);
			if(!classinfo) {
				//未找到类
				return false;
			}
			let jsonExt = classinfo[0].extdata;
			if(jsonExt.length <= 0) {
				//未找继承类
				return false;
			}
			let jsonData = JSON.parse(jsonExt);
			let ownnames = [];
			ownnames.push(name);
			//获取继承的父亲
			for(let i = 0; i < jsonData.i.length; i++) {
				let _tmpName = jsonData.i[i].n.replace(/\<[\w,]{2,256}\>/, "");
				let _pos = _tmpName.lastIndexOf("::");
				let _tmpClassName = _tmpName.substring(_pos + 2);
				let _tmpnamespace = _tmpName.substring(0, _pos);
				namespaces.push(_tmpnamespace);
				ownnames.push(_tmpClassName);
			}
			let infos = KeyWordStore.getInstace().getByOwnNameAndName(ownnames, this.functionName, namespaces);
			if(infos.length <= 0) {
				return false;
			}
			return infos[0];
		}
		return fucInfos[0];
	};
};


module.exports = {
    AutoFillParam
};