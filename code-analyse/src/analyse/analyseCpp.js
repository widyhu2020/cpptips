/* --------------------------------------------------------------------------------------------
 * analyseCpp.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const Stack = require('./stack');
const MateData = require('./tree_node');
//Tree为代码快根据包含关系创建的双向索引树
const Tree = require('./tree');
const AnalyseBase = require('./analyseBase').AnalyseBase;
const TypeEnum = require('./analyseBase').TypeEnum;
const keywork = require('./analyseBase').keywork;
const logger = require('log4js').getLogger("cpptips");

class AnalyseCpp extends AnalyseBase {
    
    constructor(filecontext, filename = '') {
        super(filecontext, false, filename);

        //typedef
        this.typedef = {};
        //只保存公共函数
        this.savepublic = false;

        //代码块
        this.lines = [];
    }

    //执行分析，重新实现父类的方法
    doAnalyse = function() {
        //logger.mark("total")
        //文档处理
        //logger.mark("_splitContext")
        this.lines = this._splitContext();
        //logger.mark("_splitContext");

        //预处理
        //logger.mark("_preProcess")
        this._preProcess(this.lines);
        //logger.mark("_preProcess");

        //分析作用域
        //logger.mark("_analyseDomain")
        this._analyseDomain(this.lines);
        //logger.mark("_analyseDomain");

        //构建命名空间
        //logger.mark("_makeNamespace")
        this._makeNamespace();
        //logger.mark("_makeNamespace");

        //生产访问权限
        //logger.mark("_analysePermission")
        this._analysePermission(this.lines);
        //logger.mark("_analysePermission");

        //遍历树其他代码快分析函数
        //logger.mark("_analyseCodeBlockForFunction")
        this.tree.traverseBF((current) => {
            for (let i = 0; i < current.data.length; i++) {
                //logger.mark("_analyseCodeBlockForFunction:" + i)
                this._analyseCodeBlockForFunction(current, this.lines, current.data[i], i);
                //logger.mark("_analyseCodeBlockForFunction:" + i);
            }
        });
        //logger.mark("_analyseCodeBlockForFunction");
        
        //分析变量-只分析成员变量和全局变量
        //logger.mark("_analyseVariable")
        this.tree.traverseBF((current) => {
            //logger.debug(current.domain_level, current.namespace);
            for (let i = 0; i < current.data.length; i++) {
                //logger.mark("_analyseVariable:" + i)
                this._analyseVariable(current, this.lines, current.data[i], i);
                //logger.mark("_analyseVariable:" + i);
            }
        });
        //logger.mark("_analyseVariable");

        //分析枚举
        //logger.mark("_analyseVariable")
        this.tree.traverseBF((current) => {
            //logger.debug(current.domain_level, current.namespace);
            for (let i = 0; i < current.data.length; i++) {
                //logger.mark("_analyseVariable:" + i)
                this._analyseEnum(current, this.lines, current.data[i], i);
                //logger.mark("_analyseVariable:" + i);
            }
        });
        //logger.mark("_analyseVariable");
    };

    //分析枚举
    _analyseEnum = function name(node, lines, index, idataindex) {
        if (node.parent != null
            && node.namespace == node.parent.namespace) {
            //命名空间域父区域命名空间一致，表示该区域代码里面的变量无需关注
            //代码为 if/for/while或者函数引入
            return;
        }
        
        //logger.debug(lines[index - 1]);
        if (lines[index - 1] == "{") {
            //枚举的前一段一定为{
            let pos = lines[index - 2].lastIndexOf(';');
            let lastcode = "";
            let item = [];
            if (pos > 0) {
                lastcode = lines[index - 2].substr(pos);
            } else {
                lastcode = lines[index - 2];
            }
            lastcode = lastcode.trim();
            item = lastcode.split(' ');

            if (item[item.length - 2] != "enum") {
                //前面定义不是enum开头表示非枚举定义

                return;
            }
        } else {
            //其他情况跳过
            return;
        }

        let permission = 0;
        if (idataindex > 0) {
            permission = node.permission[idataindex - 1];
        }

        let item = lines[index].split(',');
        let incindex = 0;
        for(let i = 0; i < item.length; i++) {
            let sourctcodeline = item[i].trim();
            let codeline = sourctcodeline.split('=');
            if(codeline.length != 2 && codeline.length != 1) {
                continue;
            }

            let name = codeline[0];
            let value = codeline.length == 2 ? codeline[1] : incindex;
            if (/\d*/g.test(value)) {
                incindex = value + 1;
            }
            let enumvar = new MateData.EnumMet();
            enumvar.name = name.trim();
            if(enumvar.name == "") {
                //无效的枚举
                continue;
            }
            if (typeof (value) == 'string') {
                enumvar.value = value.trim();
            } else {
                enumvar.value = value.toString().trim();
            }
            enumvar.rawLine = sourctcodeline;
            enumvar.permission = permission;
            node.enum.push(enumvar);
        }
        //logger.debug(node.enum);
    };

    //分析类中的公开属性（public\private\protected）
    //这里只找出该代码快最后的公开属性值
    //在使用的时候抹默认为前一快的公开属性值
    _analysePermission = function (lines){
        function sortNumber(a, b) {
            return a - b;
        }
        //第0快肯定是公共的
        this.tree.traverseBF((current) => {
            let blockinde = current.data.sort(sortNumber);
            //logger.debug(JSON.stringify(blockinde));
            current.permission = new Array(blockinde.length).fill(0);
            if(current.ownname != null
                && current.ownname.type == TypeEnum.CALSS) {
                for (let i = 0; i < blockinde.length; i++) {
                    if(i != 0) {
                        //如果不是第一块默认为前一块的访问权限
                        current.permission[i] = current.permission[i - 1 ];
                    }
                    //从第一块开始处理
                    let index = -1;
                    let publicpos = lines[blockinde[i]].lastIndexOf(" public:");
                    let protectedpos = lines[blockinde[i]].lastIndexOf(" protected:");
                    let privatepos = lines[blockinde[i]].lastIndexOf(" private:");
                    //logger.debug("_analysePermission xxxxxx:",publicpos, protectedpos, privatepos);
                    if (publicpos > index) {
                        //logger.debug("public:", i, lines[blockinde[i]]);
                        index = publicpos;
                        current.permission[i] = 0;
                    }
                    if (protectedpos > index) {
                        //logger.debug("protecte:", lines[blockinde[i]]);
                        index = protectedpos;
                        current.permission[i] = 1;
                    }
                    if (privatepos > index) {
                        //logger.debug("private:", lines[blockinde[i]]);
                        index = privatepos;
                        //logger.debug("_analysePermission ssssssss:", publicpos, protectedpos, privatepos);
                        current.permission[i] = 2;
                    }
                    //logger.debug("show permission: ", current.namespace, JSON.stringify(current.permission));
                }
                return;
            }
        });
    };

    //分析成员变量和命名空间的全局变量
    _analyseVariable = function (node, lines, index, idataindex){
        if (node.ownname
            && (node.ownname.type == TypeEnum.ENUM
                || node.ownname.type == TypeEnum.AIR_IN_FUNCTION)) {
            //枚举中不会包含成员变量定义
            //函数中不会包含成员变量定义
            return;
        }

        if (node.parent != null
            && node.namespace == node.parent.namespace) {
            //命名空间域父区域命名空间一致，表示该区域代码里面的变量无需关注
            //代码为 if/for/while或者函数引入
            //logger.debug(node.namespace, " | ", node.parent.namespace);
            return;
        } 

        let line = lines[index].split(';');
        let permission = node.permission[idataindex];
        line.forEach(item => {
            if (index == 0 || /(#define .+)|(#include )/ig.test(item)){
                //宏定义解释
                this._analyseIncludeAndDefine(node, item);
            }

            let valable = this._judgeCodeisVariabledefine(permission, item);
    
            permission = valable['p'];
            if (valable['v'] != null && valable['v'] != false){
                valable['v'].forEach(e => {
                    node.addVariable(e);
                });
            }
        });
    };

    //判断是否变量定义
    _judgeCodeisVariabledefine = function (defaultpermission, code) {
        code = code.replace(/[\]\[]{1,1}/g, (e) => {
            //标准话格式
            return " " + e + " "
        });
        let item = code.trim().split(' ');
        item = this._getRSignItemSyoml(item);
        item = item.filter((v, i, arr) => {
            //去掉空格项
            return v != "";
        });
        //logger.debug(item);

        let stopkeyword = new Set([
            'struct', 'class', 'namespace', '__extension__', '__typeof__', '#if',
            'enum', 'using', '#endif', 'operator', "using____namespace", 'constexpr',
            '#ifdef', '#define', '#include']);
        let lostkeyword = new Set(['const', '&', '*', ';']);
        let valuenotkeyword = new Set(['.', '+', '-', '%', '>']);

        let isInValue = false;
        let type = '';
        let namedata = [];
        let nowVarible = '';
        let nowValue = null;
        let isconst = 0, isuseadder = 0, ispoint = 0;
        let permission = defaultpermission;
        let isstatic = false;
        let variableisarray = false;
        let needRemoveindex = new Set();
        for(let i = item.length - 1; i >= 0; i--) {
            //访问权限设置
            item[i] = item[i].trim();
            if (item[i] == "public:") {
                needRemoveindex.add(i);
                permission = 0;
                continue;
            }
            if (item[i] == "protected:") {
                needRemoveindex.add(i);
                permission = 1;
                continue;
            }
            if (item[i] == "private:") {
                needRemoveindex.add(i);
                permission = 2;
                continue;
            }

            if (item[i] == '[') {
                //碰到了]结束符号，则往前找。找到开始符号，中间数据全部去掉
                for(let j = i - 1; j >= 0; j--) {
                    if (item[j] == ']') {
                        //找到中间符号，结束查找
                        variableisarray = true;
                        i = j;
                        break;
                    }
                }
                if (variableisarray) {
                    continue;
                }
                //没有找到闭合数据
                return { 'v': false, 'p': permission };
            }

            if(item[i] == 'static') {
                if (type != "") {
                    //static字样只允许出现在第一个
                    return { 'v': false, 'p': permission };
                }
                //静态变量
                isstatic = true;
                continue;
            }

            if (!isInValue && item[i] == "*") {
                ispoint = 1;
            }
            if (!isInValue && item[i] == "const") {
                isconst = 1;
            }
            if (!isInValue && item[i] == "&") {
                isuseadder = 1;
            }
            if (!isInValue && item[i] == "static") {
                isstatic = true;
            }
            if (lostkeyword.has(item[i])){
                //滤掉关键词
                continue;
            }

            if (!isInValue && valuenotkeyword.has(item[i])) {
                //非值区域不允许出现这些字符
                //logger.debug(item);
                return { 'v': false, 'p': permission };
            }

            if (stopkeyword.has(item[i])) {
                //全局区域都不能出现的关键字
                return { 'v': false, 'p': permission };
            }

            if (item[i] == '=') {
                //进入获取值区域
                let values = [];
                let j = i - 1;
                for(; j >= 0; j--) {
                    if (item[j] == ',') {
                        nowValue = values.join(' ');
                        break;
                    }
                    values.push(item[j]);
                }
                if (nowVarible == '') {
                    return { 'v': false, 'p': permission };
                }
                nowValue = values.join(' ');
                isInValue = true;
                if (nowVarible != '') {
                    let variableitem = {
                        'name': nowVarible,
                        'value': nowValue,
                        'ispoint': ispoint,
                        'isconst': isconst,
                        'isuseadder': isuseadder,
                        'permission': permission,
                        'variableisarray': variableisarray ? true : false
                    };
                    //logger.debug("=:", variableitem);
                    namedata.push(variableitem);
                    nowVarible = '';
                    ispoint = 0;
                    isuseadder = 0;
                    variableisarray = false;
                    nowValue = null;
                }
                i = j;
                continue;
            }
            
            if (item[i] == ',') {
                //进入获取值区域
                isInValue = false;
                if (nowVarible != '') {
                    let variableitem = {
                        'name': nowVarible,
                        'value': nowValue,
                        'ispoint': ispoint,
                        'isconst': isconst,
                        'isuseadder': isuseadder,
                        'permission': permission,
                        'variableisarray': variableisarray ? true : false
                    };
                    //logger.debug(",:", variableitem);
                    namedata.push(variableitem);
                    nowVarible = '';
                    ispoint = 0;
                    isuseadder = 0;
                    variableisarray = false;
                    nowValue = null;
                }
                continue;
            }

            if (type.length == 0) {
                //第一个符号为类型
                type = item[i];
                continue;
            }

            //long long类型兼容
            if (item[i] == "long" && type == "long") {
                type = type + " " + item[i];
                continue;
            }

            //unsigned兼容
            if (type == "unsigned") {
                type = type + " " + item[i];
                continue;
            }
            
            if (!isInValue) {
                if (nowVarible != '') {
                    //前面已经赋值了，这里再次出现肯定有问题
                    return { 'v': false, 'p': permission };
                }
                nowVarible = item[i];
            }
        }

        if (needRemoveindex.size > 0) {
            let setNewItem = [];
            for(let i = 0; i < item.length; i++) {
                if (!needRemoveindex.has(i)) {
                    setNewItem.push(item[i]);
                }
            }
            item = setNewItem;
        }
        
        if (nowVarible != '') {
            let variableitem = {
                'name': nowVarible,
                'value': nowValue,
                'ispoint': ispoint,
                'isconst': isconst,
                'isuseadder': isuseadder,
                'permission': permission,
                'variableisarray': false
            };
            if (variableisarray) {
                variableitem['variableisarray'] = true;
            }
            //logger.debug(code, variableitem);
            namedata.push(variableitem);
            nowVarible = '';
            ispoint = 0;
            isuseadder = 0;
            nowValue = null;
        }
        
        if (namedata.length > 0) {
            let rawline = item.reverse().join(" ");
            let varibles = [];
            let _number = this._getCountChars(type, new Set(['<', '>']));
            if (_number % 2 != 0
                || (_number > 0 && !this._checkIsTemplateType(type))){
                return { 'v': false, 'p': permission };
            }
            for(let i = 0; i < namedata.length; i++) {
               
                if (!/^[a-z_]{1,1}[a-z_0-9]{1,200}$/ig.test(namedata[i].name)){
                    continue;
                }
                let _varibles = new MateData.VariableMet();
                _varibles.type = type;
                _varibles.name = namedata[i].name;
                _varibles.value = namedata[i].value;
                _varibles.isconst = namedata[i].isconst;
                _varibles.isuseadder = namedata[i].isuseadder;
                _varibles.ispoint = namedata[i].ispoint;
                _varibles.permission = namedata[i].permission;
                //_varibles.rawline = rawline;
                _varibles.isstatic = isstatic ? 1 :0;
                if (namedata[i].variableisarray) {
                    _varibles.type = type + "[]";
                }
                if (type != "" && namedata[i].name != "") {
                    //logger.debug("dddd", _varibles);
                    varibles.push(_varibles);
                }
            }
            return { 'v': varibles, 'p': permission};
        }

        return { 'v': false, 'p': permission };
    };

    _checkIsTemplateType = function(type) {
        if(type[type.length - 1] != ">") {
            //如果最后一个不是>
            return false;
        }
        
        let stack = [];
        for(let i = 0; i < type.length; i++) {
            if(type[i] == "<") {
                stack.push("<");
                continue;
            }
            if(type[i] == ">") {
                if(stack.length <= 0) {
                    //不匹配
                    return false;
                }
                stack.pop();
                continue;
            }
        }

        return stack.length == 0;
    };

    //构造命名空间范围，遍历节点计算出每个节点的作用域
    //这里作用域包括各种容器类型的定义，如：函数、类、命名空间、结构体、枚举都属于作用域名称
    //例如再在函数中可能是[namespace::]class::function
    //在类中是[namespace::]class
    //在枚举中是[namespace::]enum
    _makeNamespace = function () {
        this.tree.traverseBF((current) => {
            if (current.parent == null
                && current.ownname.name == "__global__") {
                current.namespace = "";
                return;
            }
            if (current.parent == null) {
                //野节点
                return;
            }
            let parentnamespace = current.parent.namespace;
            if (current.ownname == null) {
                //子没有产生命名空间，则为父亲的命名空间
                current.namespace = parentnamespace;
                return;
            }
            if (parentnamespace != "") {
                current.namespace = parentnamespace + "::" + current.ownname.name;
            } else {
                current.namespace = current.ownname.name
            }
        });
    };

    //分析所有的函数
    _analyseCodeBlockForFunction = function (node, lines, index, defaultpermission) {

        if (node.ownname == null
            ||(node.ownname
                && (node.ownname.type == TypeEnum.ENUM
                || node.ownname.type == TypeEnum.AIR_IN_FUNCTION))) {
                //枚举中不会包含函数定义
                return;
            }
        let ownname = "";
        if(node.ownname.type == TypeEnum.CALSS
            || node.ownname.type == TypeEnum.STRUCT) {
            //如果类，当前own设置成类的名称
            //方便后续识别构造函数
            ownname = node.ownname.name;
        }

        let permission = 0;
        if (defaultpermission > 0) {
            //公开属性，默认使用前一个代码块的
            permission = node.permission[defaultpermission - 1];
        }

        if(index == 0) {
            //首行处理，首行不在花括号中间
            let item = this._getFirstFunctionName(lines[index]);
            let method = this._getMethodDefine(item.join(' '), ownname);
            if (method != false && method != []) {
                //写入方法
                method.permission = permission;
                node.addMethod(method);
            }
            return;
        }

        if (index < 2) {
            //无需处理的代码快，可能是第一块，这块出来头文件相关单独处理
            return;
        }

        //logger.debug(lines[index-2]);
        if (lines[index - 1] == "{") {
            //当前代码块绝大部分可能对我们的功能没有用处，
            //如：for、if、do、while 函数实现
            let pos = lines[index - 2].lastIndexOf(';');
            let lastcode = "";
            let item = [];
            if (pos > 0) {
                lastcode = lines[index - 2].substr(pos);
            } else {
                lastcode = lines[index - 2];
            }
            lastcode = lastcode.trim();
            item = lastcode.split(' ');
            
            let passKeywork = new Set(['do', 'while', 'for', 'if']);
            if (passKeywork.has(item[0])
                || (passKeywork.has(item[1]) && item[0] == ';')) {
                //命中for、if、do、while
                //这里无法排除for循环
                //logger.debug("find if/while/do/for: " + lastcode);
                return;
            }

            //for循环机制 for ( A; B; C )
            let icountleft = 0;
            let icountright = 0;
            item.forEach(element => {
                if (element == "(") {
                    icountleft++;
                } else if (element == ")") {
                    icountright++;
                }
            });
            if (icountleft != icountright) {
                //原括号不成对匹配，表示不为完整的函数定义，可能是for循环的最后一步
                //logger.debug("find for:" + lastcode);
                return;
            }
        }

        if (lines[index] == "") {
            //跳过空数据
            return;
        }
        
        let codeline = lines[index].split(';');
        codeline.forEach(element => {
            //访问权限设置
            if (/^ public:.*/g.test(element)) {
                permission = 0;
            }
            if (/^ protected:.*/g.test(element)) {
                permission = 1;
            }
            if (/^ private:.*/g.test(element)) {
                permission = 2;
            }

            //typedef
            if (/^ typedef.*/g.test(element)) {
                this._processsTypedef(element, node);
                return;
            }
            
            let method = this._getMethodDefine(element, ownname);
            
            if (method != false && method != []) {
                //写入方法
                //logger.debug(method.name);
                method.permission = permission;
                node.addMethod(method);
            }
        });
    };

    //typedef处理，在组装函数的时候会直接替换
    _processsTypedef = function (linecode, node) {
        linecode = linecode.replace("typedef", "");
        linecode = linecode.replace("typename", "");
        linecode = linecode.trim();

        let pos  = linecode.lastIndexOf(" ");
        let name = linecode.substring(pos).trim();
        let value = linecode.substring(0, pos).trim();
        
        value = value.replace(/[\s\t]{1,4}/g, "");
        let def = new MateData.Typedef(name, value);
        node.addTypedef(def);
    };

    //分析函数
    _getFirstFunctionName = function(lastcode){
        let item = lastcode.split(' ');
        let stopworld = new Set(['#define', '#endif', '#include', '#ifdef']);
        let data = [];
        for(let i = item.length - 1; i >=0; i--) {
            if(stopworld.has(item[i])){
                if (item[i] == "#include") {
                    let isNum = 0;
                    let tmpData = [];
 
                    for (let i = data.length - 1; i >= 0; i--) {
                        if (isNum == 2) {
                            //logger.debug(tmpData);
                            tmpData.push(data[i]);
                            continue;
                        }
                        isNum += this._getCountChar(data[i], "\"");
                        continue;
                    }
                    data = tmpData;
                    data.reverse();
                } else if (item[i] == "#define") {
                    data.pop();
                }
                break;
            }
            data.push(item[i]);
        }
        return data.reverse();
    };

    //获取字符串中指定字符的个数
    _getCountChar = function(str, inchar) {
        let iCount = 0;
        str.split("").forEach(element => {
            if (element == inchar) {
                iCount++;
            }
        });
        return iCount;
    };

    //判断一个语句是否为函数定义，是则返回函数描述
    _judgeCodeisfunction = function (item, ownname, showlog = 0) {
        //return true;
        if(item[item.length - 1] == "\\") {
            //最后一个符号为\表示为宏里面的方法
            return false;
        }

        
        if (item[0] != ')'
            && item[1] != ')'
            && item[2] != ')') {
            //函数之后不应该有太多东西
            return false;
        }
        

        let passkeyword = new Set([
            '*', '&', 'inline', 'const', 'volatile', '_GLIBCXX_NOEXCEPT',
            '', 'virtual', 'public:',
            'unsigned', 'private:', 'public:', 
            'protected:', 'public', 'private', 
            'protected']);
        let faildkeyword = new Set(['>', '-', '!', 'return', '::', "#define"]);
        let nameerrorkeyword = new Set(['.', '=', '<', 'if', 'else']);
        let needfaild = false;
        let findparamsair = false;
        let stack = new Stack();
        for(let i = 0; i < item.length; i++) {
            
            //跳过没用的标签
            if (passkeyword.has(item[i])){
                //跳过不必要的标签
                continue;
            }

            //一定会失败的符号
            if (faildkeyword.has(item[i])) {
                //logger.debug("xxxxx");
                //一旦出现则表示匹配失败的字符
                return false;
            }

            //完成()校验之后不能出现=符号
            if (nameerrorkeyword.has(item[i]) && findparamsair == true) {
                return false;
            }

            //弹出参数
            if (item[i] == ',') {
                let popnum = 0;
                while (!stack.isEmpty() && popnum < 500) {
                    //弹出数据
                    let data = stack.pop();
                    //if (showlog == 1) logger.debug("dddd", data);
                    if(data == ')') {
                        stack.push(')');
                        break;
                    }
                    popnum++;
                }

                if (popnum != 1 && popnum != 2) {
                    //参数类型不正确
                    //if (showlog == 1) logger.debug("xxxxx", popnum, item);
                    return false;
                }
                continue;
            }

            //函数开始，开始之前不能有其他符号
            if (item[i] == ')' && stack.size() > 0){
                //在)之前便有了数据
                return false;
            }

            if (!findparamsair && item[i] == '=') {
                stack.pop();
                continue;
            }

            //函数体开始
            if (item[i] == '(') {
                let popnum = 0;
                while (!stack.isEmpty() && popnum < 500) {
                    //弹出数据
                    let data = stack.pop();
                    if (data == ')') {
                        //找到()区域，并完成校验
                        findparamsair = true;
                        break;
                    }
                    popnum++;
                }

                if (popnum > 2) {
                    //参数类型不正确
                    //这里可以为0，表示没有参数
                    //logger.debug("xxxx void");
                    return false;
                }
                continue;
            }

            stack.push(item[i]);

            //打印好入堆栈情况
            if (showlog==1) stack.print();
        }

        if(stack.size() == 1
            && findparamsair == true) {
            let fname = stack.pop();
            if(ownname == fname && fname != "") {
                //构造函数
                return true;
            }
        }

        if (stack.size() < 2
            || findparamsair == false) {
            //函数定义的t返回类型和函数名称必须有
            return false;
        }

        //栈底的为方法的名称
        let stacklast = '';
        while (!stack.isEmpty()) {
            //弹出数据
            stacklast = stack.pop();
        }
        
        // if(/[ a-z_\d<>]{0,256}::[ a-z~_\d]{1,256}/ig.test(stacklast)){
        //     //满足成员函数实现的定义，直接不处理
        //     return false;
        // }

        //logger.debug(item);
        return true;
    };

    //获取函数的参数定义
    _getFunctionParams = function(item, index, method) {
        let queue = new Array();
        //找参数
        let variable = [];
        let type = '', name = '', value = null;
        let ispoint = 0, rawline = '', isconst = 0, isvirtual = 0, isuseadder = 0, isinline = 0;
        for(let i = index + 1; i < item.length; i++) {
            if (item[i] == ',' || item[i] == '(') {
                //清空，继续下个查找
                let tmpData = [];
                for (let j = queue.length - 1; j >= 0; j--) {
                    if (queue[j] == ')'){
                        continue;
                    }
                    if (queue[j] == '&') {
                        isuseadder = 1;
                        continue;
                    }
                    if (queue[j] == '*') {
                        ispoint = 1;
                        continue;
                    }
                    if (queue[j] == 'const') {
                        isconst = 1;
                        continue;
                    }
                    if (queue[j] == 'volatile') {
                        continue;
                    }
                    if (queue[j] == '=') {
                        value = queue[j - 1];
                        break;
                    }
                    tmpData.push(queue[j]);
                }
                
                let getIndex = 0;
                type = tmpData.length > getIndex ? tmpData[getIndex++] : '';
                if (type == "unsigned" 
                    || (type == "long" && tmpData[getIndex + 1] == "long")) {
                    //如果是unsigned，下一个也需要加入类型
                    //long long类型兼容
                    type = type + " " + tmpData[getIndex++];
                }
                name = tmpData.length > getIndex ? tmpData[getIndex++] : '';
                //rawline = queue.reverse().join(' ');
                let tmpvar = new MateData.VariableMet();
                tmpvar.name = name;
                tmpvar.type = type;
                tmpvar.value = value;
                tmpvar.isconst = isconst;
                tmpvar.isuseadder = isuseadder;
                tmpvar.ispoint = ispoint;
                tmpvar.rawline = rawline;
                
                if (type != "") {
                    variable.push(tmpvar);
                }
                type = '', name = '', value = null, isconst = 0, isuseadder = 0, ispoint = 0, rawline = '';
                //清空数组，注意这里不能使用=[]的形式，js不是真正意义上的引用穿值
                while(queue.pop()){};
                if (item[i] == '(') {
                    //参数全部找其，终止循环，记录给下面找函数名称和返回值
                    index = i;
                    break;
                }
                continue;
            }
            queue.push(item[i]);
        }
        
        method.params = variable.reverse();
        return index;
    };

    //获取函数名称
    _getFunctionName = function(item, index, method) {
        let notpushkeyworld = new Set(["const", "&", "*", "static", "inline", "virtual", "public:", "private:", "protected:"]);
        for (let i = index + 1; i < item.length; i++) {
            if (!notpushkeyworld.has(item[i]) 
                && item[i] != "") {
                 //判断函数是否符合函数定义
                let name = item[i];
                if(name.indexOf("::") == 0) {
                    //::开头可能是函数实现中类为模板类，导致截断
                    name = item[i + 1] + name;
                    i++;
                }
                if ((!(/^[a-z_]{1,1}[a-z0-9_]{1,100}$/ig.test(name))//正常函数定义
                    && !(/^operator[<>*=\/%&|^~+\-!\[\]()]{1,3}$/g.test(name))
                    && !(/^[a-z_]{1,1}[a-z0-9_]{1,100}[a-z_0-9<>,]{1,64}::[a-z_]{1,1}[a-z0-9_]{1,100}$/ig.test(name))
                    && !(/^[a-z_]{1,1}[a-z0-9_]{1,100}[a-z_0-9<>,]{1,64}::operator[<>*=\/%&|^~+\-!\[\]()]{1,3}$/ig.test(name)))//操作符
                    || name == "_"
                    || name == "") {
                    //函数名称不符合规范
                    //函数名称必须是符合标准
                    //logger.debug(name, item, this.filename);
                    return -1;
                }
                method.name = name;
                index = i;
                break;
            }
            index = i;
        }
        return index;
    };

    //获取返回值对象
    _getFunctionRetInfo = function(item, index, method) {
        let retType = new MateData.VariableMet();
        retType.name = "";
        let retispoint = 0;
        let notpushkeyworld = new Set(["const", "constexpr", "&", "*", "static", "inline", "virtual", "public:", "private:", "protected:"]);
        for (let i = index + 1; i < item.length; i++) {
            if(item[i] == "*") {
                retispoint = retispoint + 1;
            }
            if (item[i] == "&") {
                retType.isuseadder = 1;
            }
         
            if (!notpushkeyworld.has(item[i]) 
                && item[i] != "") {
                let valtype = item[i];
                if((valtype == "long" || valtype == "unsigned")
                    && notpushkeyworld.has(item[i+1])) {
                    valtype = valtype + " " + item[i+1];
                    i++;
                }
                retType.type = valtype;

                //判断是否为const返回
                if(item[i + 1] == "const" || item[i + 1] == "constexpr") {
                    retType.isconst = 1;
                    i++;
                }
                index = i;
                break;
            }
            index = i;
        }
        retType.ispoint = retispoint;
        method.returndata = retType;
        return index;
    };

    //获取函数修饰符-前置
    _getFunctionPreDecorate = function(item, index, method) {
        for (let i = index + 1; i < item.length; i++) {
            if(item[i] == "static") {
                method.isstatic = 1;
                index = i;
                continue;
            }
            if (item[i] == "virtual") {
                method.isvirtual = 1;
                index = i;
                continue;
            }
            if (item[i] == "inline") {
                method.isinline = 1;
                index = i;
                continue;
            }
            break;
        }
        return index;
    };

    //获取函数修饰符-后置
    _getFunctionAfterDecorate = function(item, method) {
        let index = 0;
        for (let i = 0; i < item.length; i++) {
            if(item[i] == "const" && item[i] == "constexpr") {
                method.isconst = 1;
            }
            if (item[i] == "&") {
                method.isuseadder = 1;
            }
            index = i;
            break;
        }
        return index;
    };

    //获取模板定义
    _getTemplateDefine = function(item, index, method) {
        if(index + 1 >= item.length) {
            return index;
        }
        let templateDefine = item[index + 1];
        if(/^template<[a-z0-9,_=( )]{1,128}>$/ig.test(templateDefine)) {
            method.templatefunctiondef = templateDefine;
            //logger.debug(method);
        }
        return index + 1;
    };

    //获取函数定义
    _getMethodDefine = function(str, ownname) {
        let _tmppos = str.indexOf(" ) : ");
        if(_tmppos != -1) {
            //构造函数含有初始化列表
            str = str.substring(0, _tmppos + 2);
        }

        //替换字符串，防止干扰函数检测
        let incIndex = 0;
        let defaultvalumap = {};
        str = str.replace(/('[^']*')|("[^"]*")/g, (e) => {
            let indexnew = "@@" + incIndex+  "@@";
            incIndex++;
            defaultvalumap[indexnew] = e;
            return indexnew;
        });

        str = str.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
        let item = str.split(" ");
        item = this._getRSignItemSyoml(item);

        ///////////////////////////////////////////////////////////
        //去掉函数后面的宏定义标记（stl机器库函数中存在大量这种定义）
        let _item = [];
        let _i = 0;
        for (; _i < item.length; _i++) {
            if (item[_i] == ')') {
                break;
            }
            if (item[_i] == "const") {
                _item.push(item[_i]);  
            }
        }
        _item = _item.concat(item.slice(_i));
        item = _item;
        /////////////////////////////////////////////////////
        //判断当前是否函数定义
        if (!this._judgeCodeisfunction(item, ownname)) {
            //非函数定义
            // if (/operator/ig.test(str))
            //logger.debug("_judgeCodeisfunction faild!codelin:" , item.reverse().join(' '));
            return false;
        }

        //字符串定义填回去
        for(let i = 0; i < item.length; i++){
            if (/@@[\d]+@@/g.test(item[i])) {
                if (defaultvalumap[item[i]]) {
                    item[i] = defaultvalumap[item[i]];
                }
            }
        }

        //出现是否公开限定符号，表示有问题
        let passPromiss = new Set(["public:", "private:", "protected:", "friend", "_GLIBCXX_CONSTEXPR", "LIBPROTOBUF_EXPORT"]);
        item = item.filter((value) => {
            if (passPromiss.has(value)) {
                return false;
            }
            return true;
        });
        //logger.debug(item);
        
        let method = new MateData.MethodMet();
        let index = 0;
        //获取函数引用或者const标记
        index = this._getFunctionAfterDecorate(item, method);
        if(index < 0) {
            //获取名字异常，退出分析
            return false;
        }

        //获取参数
        index = this._getFunctionParams(item, index, method);
        if(index < 0) {
            //获取名字异常，退出分析
            return false;
        }

        //找名称
        index = this._getFunctionName(item, index, method);
        if(index < 0) {
            //获取名字异常，退出分析
            return false;
        }

        if(method.name == ownname
            && method.name != "") {
            //构造函数
            let retType = new MateData.VariableMet();
            retType.type = "";
            method.returndata = retType;
            //获取模板定义
            index = this._getTemplateDefine(item, index, method);
            return method;
        }
        
        //获取返回值信息
        index = this._getFunctionRetInfo(item, index, method);
        if(index < 0) {
            //获取名字异常，退出分析
            return false;
        }

        //获取函数static\inline\virtual标签
        index = this._getFunctionPreDecorate(item, index, method);
        if(index < 0) {
            //获取名字异常，退出分析
            return false;
        }
        
        //获取模板定义
        index = this._getTemplateDefine(item, index, method);
        return method;
    };

    //逆序分析
    _getRSignItemSyoml = function (item) {
        let data = [];
        let inCollen = 0;
        let queue = new Array();
        //正序分析重载运算符
        for(let i = 0; i < item.length; i++) {
            if (/^operator[=!&()\[\]*]{0,2}$/g.test(item[i])) {
                
                let tmpdata = [];
                let rewriteflag = "";
                let j = i;
                for (; j < item.length; j++) {
                    if (item[j] == '(' && rewriteflag != "") {
                        //完成重载判断
                        item[i] =tmpdata.join('');
                        while (i < --j) {
                            item[j] = "";
                        }
                        break;
                    }
                    if (item[j] != "operator") {
                        rewriteflag = rewriteflag + item[j];
                    }
                    tmpdata.push(item[j]);
                }
                item = item.filter((e, i, arr) => { return e != "" });
            }
        }

        for (let i = item.length - 1; i >= 0; i--) {
            if (item[i] == ';') {
                continue;
            }
            if (i == 0 && item[i] == '>') {
                //异常数据
                return [];
            }
            if (item[i] == "class" || item[i] == "typename") {
                let data = item[i] + " ";
                queue.push(data);
            } else {
                queue.push(item[i]);
            }
            if (item[i] == '>') {
                inCollen++;
                continue;
            }

            if (inCollen == 0
                && queue.length > 0) {
                data.push(queue.reverse().join(''));
                queue = [];
            }

            if (item[i] == '<') {
                inCollen--;
            }
        }

        data = data.filter((e,i,arr) => { return e != "" });
        return data;
    };

    //获取字符串中制定字符的个数
    _getCountChars = function (str, setchar) {
        let iCount = 0;
        str.split("").forEach(element => {
            if (setchar.has(element)) {
                iCount++;
            }
        });
        return iCount;
    };

    //分析包含的头文件
    _analyseIncludeAndDefine = function(node, rawline){
        let incIndex = 0;
        let defaultvalumap = {};
        rawline = rawline.replace(/('[^']*')|("[^"]*")/g, function (e) {
            let indexnew = "@@" + incIndex + "@@";
            incIndex++;
            defaultvalumap[indexnew] = e;
            return indexnew;
        });

        let item = rawline.split(' ');
        let maxindex = item.length - 1;

        for (let i = 0; i < maxindex; i++){
            if (/@@[\d]+@@/g.test(item[i])) {
                if (defaultvalumap[item[i]]) {
                    item[i] = defaultvalumap[item[i]];
                }
            }
        }

        for(let i = 0; i < item.length; i++) {
            if (item[i] == "#include") {
                //获取到头文件
                //logger.debug(item);
                let tmpinclude = "";
                let j = i + 1;
                while (j < maxindex) {
                    tmpinclude = tmpinclude + item[j];
                    j++;
                    let iCount = 0;
                    tmpinclude.split("").forEach(element => {
                        if (element == "\"" || element == "<" || element == ">") {
                            iCount++;
                        }
                    });

                    if (iCount == 2) {
                        node.addInclude(tmpinclude.replace(/[ ]{0,4}[.]{1,1}[ ]{0,4}/ig, "."));
                        i = j - 1;
                        break;
                    }
                }
                continue;
            }

            if (item[i] == "#define") {
                //获取宏定义
                //logger.debug(item.slice(i));
                let definename = "";
                let definerealname = "";
                if (i < maxindex) {
                    definename = item[i + 1];
                }
                //logger.debug(item);
                if (i + 2 >= item.length
                    || (i + 2 < item.length && keywork.has(item[i + 2]))
                    || (i + 2 < item.length && item[i + 2] == '')) {
                    //没有值的宏定义,这种宏定义丢掉
                    continue;
                }

                if (/protobuf_[0-9a-z_]{10,512}_INCLUDED/ig.test(definename)
                    || /^GZRD_SVN_ATTR$/g.test(definename)
                    || /^(GLIBCXX_|_STL_|_GLIBCXX_)[a-z0-9_]{1,100}/ig.test(definename)) {
                    //无用定义
                    continue;
                }

                if (item[i + 2] != '(') {
                    //这种宏定义是函数型的， 设置名字
                    definerealname = item[i + 2];
                }

                if (i + 3 >= item.length
                    || (i + 3 < item.length && keywork.has(item[i + 3]))) {
                    //没有值的宏定义,这种宏定义结束
                    let params = [];
                    let definemet = new MateData.DefineMet();
                    definemet.name = definename;
                    definemet.params = params;
                    definemet.rawline = "#define " + definename + " " + definerealname;
                    definemet.realName = definerealname;
                    //logger.debug(definemet);
                    node.addDefine(definemet);
                    continue;
                }

                //从i+2的位置继续变量，找到宏定义的全部参数或者值
                let needparams = false;
                let params = [];
                let rawArray = [];
                rawArray.push(definename);
                let j = i + 2;
                let beginrand = 0;
                for (; j < item.length; j++) {
                    //logger.debug(item[j], params);
                    if(j > maxindex) {
                        break;
                    }
                    if (keywork.has(item[j])) {
                        //碰到关键字直接退出
                        break;
                    }
                    if (j == i + 4 && !needparams) {
                        break;
                    }

                    rawArray.push(item[j]);
                    if (item[j] == ')') {
                        beginrand--;
                        if (beginrand > 0) {
                            continue;
                        }
                        break;
                    }
                    
                    if (needparams && item[j] != ',') {
                        params.push(item[j]);
                        continue;
                    }

                    //表示有参数
                    if (item[j] == '(') {
                        beginrand++;
                        needparams = true;
                    }
                }
                i = j - 1;
                //logger.debug(rawArray);
                if(params.length > 3) {
                    let lastIndex = params.length - 1;
                    if (params[lastIndex] == '.' 
                        && params[lastIndex - 1] == '.' 
                        && params[lastIndex - 2] == '.' ) {
                        params = params.slice(0, lastIndex - 2);
                        params[lastIndex - 3] = params[lastIndex - 3] + "...";
                     }
                }
                
                let definemet = new MateData.DefineMet();
                definemet.name = definename;
                definemet.params = params;
                definemet.rawline = "#define " + rawArray.join(' ').replace(" . . . ", "...");
                definemet.realName = definerealname;
                if (needparams) {
                    //如果是宏定义函数
                    definemet.realName = definerealname + "(" + params.join(',') + ")";
                }
                node.addDefine(definemet);
            }

            if (item[i] == "using____namespace") {
                //命名空间引用
                let namespace = item[i + 1];
                node.addUsingNamespace(namespace);
            }
        }
    };

    //分析own，即作用域限定
    _analyseDomain = function(lines) {
        this.tree.traverseBF((current) => {
            let find_context = "";
            if (current.domain_level > 0) {
                find_context = lines[current.domain_level - 1];
                //logger.debug("find context:" + find_context);
                //类中的结构体和类不需要
                if (current.parent != null 
                    && current.parent.ownname
                    && (current.parent.ownname.type == TypeEnum.CALSS
                    || current.parent.ownname.type == TypeEnum.STRUCT
                    || current.parent.ownname.type == TypeEnum.ENUM)){
                    //无需处理
                    //logger.debug(current);
                    return;     
                }
                //logger.debug(find_context);
            }

            let domain_name = find_context;
            let pos = find_context.lastIndexOf(";");
            if(pos > 0) {
                domain_name = find_context.substr(pos);
            }
            domain_name = domain_name.trim();
            //logger.debug("find domain name:" + domain_name + " ;domain_level:" + current.domain_level);
            this._getDomainNameAndType(domain_name, current);
        });
    };

    //获取作用域名称和类型
    _getDomainNameAndType = function(rawName, treeNode) {
        if (rawName == "" 
            && treeNode.domain_level == 0) {
            return;
        }

        let items = rawName.split(' ');
        items = items.filter((value) => {
            //去掉空行
            if (value == "" || value == ";") {
                return false;
            }
            return true;
        });

        for(let i = 0; i < items.length; i++) {
            if (items[i] == "namespace") {
                //命名空间
                this._saveNamepaceNode(treeNode, items, i);
                return;
            }
            if (items[i] == "struct") {
                //结构体定义
                this._saveStructNode(treeNode, items, i);
                return;
            }
            if (items[i] == "enum") {
                //枚举定义
                this._saveEnumNode(treeNode, items, i);
                return;
            }
            if (items[i] == "class") {
                //类定义
                let templateitems = [];
                if (i >= 2 && items[i - 2] == "template" && items[i - 1] == "<") {
                    templateitems.push(items[i - 2]);
                    templateitems.push(items[i - 1]);
                    templateitems.push(items[i]);
                    let j = i;
                    for(; j < items.length; j++) {
                        templateitems.push(items[j]);
                        if (items[j] == ">") {
                            break;
                        }
                    }
                    i = j;
                    continue;
                    //logger.debug(items, i,j);
                }
                this._saveClassNode(treeNode, items, i);
                return;
            }
            if (items[i] == "interface") {
                //接口定义
                this._saveInterfaceNode(treeNode, items, i);
                return;
            }
        }

        //其余的全部算到函数里面
        let data = new MateData.BaseData("", TypeEnum.AIR_IN_FUNCTION, "in function");
        Tree.setType(treeNode, data);
    };

    //存储命名空间到作用域树节点中
    _saveNamepaceNode = function (treeNode, items, index){
        let name = "";
        if (items.length > (index + 1)) {
            //获取命名空间的名称
            name = items[index + 1];
        }
        let rawLine = items.join(" ");
        let data = new MateData.BaseData(name, TypeEnum.NAMESPACE, rawLine);
        Tree.setType(treeNode, data);
        return;
    };

    //存储结构体到作用域树节点中
    _saveStructNode = function (treeNode, items, index) {
        let name = "";
        let templatename = [];
        let templatenamestr = "";
        let preclass = items.slice(0, index);
        let isbegin = false;
        for (let i = 0; i < preclass.length; i++) {
            preclass[i] = preclass[i].trim();
            if (preclass[i] == "template") {
                isbegin = true;
            }
            if (!isbegin) {
                continue;
            }

            if (preclass[i] == "class" || preclass[i] == "typename") {
                templatename.push(preclass[i] + " ");
                continue;
            }
            templatename.push(preclass[i]);
        }
        if (templatename.length > 0) {
            templatenamestr = templatename.join('');
        }

        if (items.length > (index + 1)) {
            //获取名称
            name = items[index + 1];
        }
        if (name == "" || name == " ") {
            return;
        }
        let rawLine = items.join(" ");
        let data = new MateData.BaseData(name, TypeEnum.STRUCT, rawLine);
        data.template = templatenamestr.trim();
        Tree.setType(treeNode, data);
        return;
    };

    //存储类到作用域树节点中
    _saveClassNode = function (treeNode, items, index) {
        let name = "";
        let templatename = [];
        let templatenamestr = "";
        let preclass = items.slice(0, index);
        let isbegin = false;
        for(let i = 0; i < preclass.length; i++){
            preclass[i] = preclass[i].trim();
            if (preclass[i] == "template") {
                isbegin = true;
            }
            if (!isbegin) {
                continue;
            }
            
            if (preclass[i] == "class" || preclass[i] == "typename") {
                templatename.push(preclass[i] + " ");
                continue;
            }
            templatename.push(preclass[i]);
        }
        if (templatename.length > 0) {
            templatenamestr = templatename.join('');
        }
        
        let classfullname = items.slice(index).join("|");
        let repalaceIndex = 0;
        let tmpMap = {};
        classfullname = classfullname.replace(/([a-z0-9_]*::){1,10}([a-z0-1_]+){1,1}/ig, (kw) => {
            let replacedata = "@@" + repalaceIndex + "@@";
            tmpMap[replacedata] = kw;
            repalaceIndex++;
            return replacedata;
        });

        classfullname = classfullname.replace(/:/g, "|:|");
        let newItems = classfullname.split(/[|]{1,10}/);

        //替换回暂时存放的变量
        for(let i = 0; i < newItems.length; i++) {
            if (tmpMap[newItems[i]]) {
                newItems[i] = tmpMap[newItems[i]];
            }
        }

        index = 0;
        //logger.debug(newItems, index);
        if (newItems.length > (index + 1)) {
            //获取名称
            name = newItems[index + 1];
            for (let i = index + 2; i < newItems.length; i++) {
                if(newItems[i] == ':') {
                    break;
                }
                if (newItems[i] != "") {
                    name = newItems[i];
                }
            }
        }
        let inherits = [];
        let promise = "0";
        
        let isinleherit = false;
        let inheritsname = "";

        for (let i = index + 2; i < newItems.length; i++) {
            if(newItems[i] == ':') {
                isinleherit = true;
                continue; 
            }
            if (!isinleherit){
                //没有进入父类区域
                continue;
            }
            if(newItems[i] == "public") {
                promise = "0";
                continue;
            }
            if (newItems[i] == "protected") {
                promise = "1";
                continue;
            }
            if (newItems[i] == "private") {
                promise = "2";
                continue;
            }
            if (newItems[i] == "," 
                && this._getCountChar(inheritsname, '<') == this._getCountChar(inheritsname, '>')){
                inherits.push({ 'p': promise, 'n': inheritsname });
                inheritsname = "";
                continue;
            }
            if (inheritsname == ""){
                inheritsname = newItems[i].trim();
                continue;
            }
            inheritsname = inheritsname + "" + newItems[i].trim();  
        }

        if (inheritsname != ""){
            inherits.push({ 'p': promise, 'n': inheritsname });
        }
        //logger.debug(newItems, index, name, inheritsname, classfullname);
        let realline = templatenamestr + " " + newItems.join(' ');
        
        let data = new MateData.BaseData(name, TypeEnum.CALSS, newItems.join(' '), inherits);
        data.template = templatenamestr;
        Tree.setType(treeNode, data);
        return;
    };

    //存储枚举到作用域树节点中
    _saveEnumNode = function (treeNode, items, index) {
        let name = "";
        if (items.length > (index + 1)) {
            //获取名称
            name = items[index + 1];
        }
        if (name == "" || name == " " ){
            return;
        }
        let rawLine = items.join(" ");
        let data = new MateData.BaseData(name, TypeEnum.ENUM, rawLine);
        Tree.setType(treeNode, data);
        return;
    };

    //存储接口到作用域树节点中
    _saveInterfaceNode = function (treeNode, items, index) {
        let name = "";
        if (items.length > (index + 1)) {
            //获取名称
            name = items[index + 1];
        }
        let rawLine = items.join(" ");
        let data = new MateData.BaseData(name, TypeEnum.INTERFACE, rawLine);
        Tree.setType(treeNode, data);
        return;
    };

    //标准化文档并文档拆分
    _splitContext = function() {
        
        let filecontext = this.context.replace(
            /([,.;(){}=<>&-]{1,1})|(using[ ]+namespace)/g, function (kw) {
            //关键符号用空格隔开
            if (kw == '}' || kw == '{') {
                return " {;;;;}" + kw + "{;;;;} ";
            }
            if(kw.indexOf("using") != -1) {
                return "using____namespace";
            }
            return " " + kw + " ";
        });

        //去掉//注释
        //B0A1-F7FE gbk
        //
        filecontext = filecontext.replace(/\/\/[^\n]*\n/g, "\n");
        //logger.debug(filecontext);
        
        //宏定义替换
        filecontext = filecontext.replace(/(#define ([^\n]*)?)|(#if ([^\n]*)?)|(#endif([^\n]*)?)|(public:)|(private:)|(protected:)/g, function (kw) {
            return kw + ";";
        });

        //格式化空格，多个全部转化为1个
        filecontext = filecontext.replace(/([\s\n\t\r]+)/g, function(kw) {
            let datalenth = kw.trim();
            //logger.debug("|"+kw+"|");
            if (datalenth.length > 0){
                //logger.debug("|" + kw + "|");
                return datalenth;
            }
            return " ";
        });
       
        ////去掉注释/* */格式
        //logger.debug(filecontext.match(/\/ \*.+?(\* \/){1,1}/g));
        filecontext = filecontext.replace(/\/\*.+?(\*\/){1,1}/g, "");
        
        filecontext = filecontext.replace(/[\s\t]{0,5}[*]{1,1}[\s\t]{0,5}/g, " * ");

        //按照{;;;;}将文档分成多块
        let lines = filecontext.split("{;;;;}");
        return lines;
    };

    //预处理-分析作用域
    _preProcess = function (lines) {
        //对分解的串进行第一次处理
        for (let i = 0; i < lines.length; i++) {
            //this.analyseLine(this.context[i], i, this.context);
            if (lines[i] == '{') {
                //this.slevel.push(SymbolEnum.BEGIN);
                //logger.debug(this.point_domain);
                //logger.debug("domin:" + i);
                this.tree.add(i, this.point_domain);
                this.point_domain = i;
                continue;
            }

            if (lines[i] == '}') {
                //this.slevel.push(SymbolEnum.END);
                //logger.debug("before getFatherDomain:" + this.point_domain);
                //logger.mark("getFatherDomain");
                this.point_domain = this.tree.getFatherDomain(this.point_domain);
                //logger.mark("getFatherDomain");
                //logger.debug("getFatherDomain:" + this.point_domain);
                continue;
            }

            //将数据挂载到当前作用域下
            //logger.debug(i);
            this.tree.addDataToNode(this.point_domain, i);

            //this.block.push(this.context[i]);
        }
    };
};

module.exports = {
    AnalyseCpp,
    TypeEnum
}
