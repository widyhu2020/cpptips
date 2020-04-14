/* --------------------------------------------------------------------------------------------
 * tree_node.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

//基本作用域定义
class BaseData {
    /**
     * 
     * @param {作用域名称，如果是等级为空，类则为类名称} name 
     * @param {类型，见定义TypeEnum} type
     * @param {语句原文} rawLine
     */
    constructor(name, type, rawLine, inherits) {
        this.name = name;
        this.type = type;
        this.inherit = inherits;
        this.rawline = rawLine;
        this.template = "";
    };
};

//该作用域的方法
class MethodMet {
    /**
     * 
     * @param {方法名称} name 
     * @param {返回值类型-VariableMet类型} returndata
     * @param {参数-VariableMet类型数组} params
     * @param {函数级别} outlevel
     * @param {是否const函数} isconst 
     * @param {是否static函数} isstatic
     * @param {是否虚函数} isvirtual
     * @param {是否内联函数} isinline
     * @param {语句原文} rawline 
     */
    constructor() {
        this.name = "";
        this.returndata = "";
        this.params = "";
        this.permission = 0;
        this.isconst = 0;
        this.isstatic = 0;
        this.isvirtual = 0;
        this.isinline = 0;
        this.rawline = 0;
        this.isuseadder = 0;
        this.templatefunctiondef = "";
    };
};

//该作用域的变量
class VariableMet {
    /**
     * 
     * @param {类型} type 
     * @param {名字} name 
     * @param {值} value 
     * @param {是否const} isconst 
     * @param {是否引用} isuseadder 
     * @param {是否指针} ispoint 
     * @param {语句原文} rawline 
     */
    constructor() {
        this.type = "";
        this.name = "";
        this.value = null;
        this.isconst = 0;
        this.isuseadder = 0;
        this.ispoint = 0;
        this.rawline = "";
        this.permission = 0;
    };
};

//该作用域的宏定义
class DefineMet {
    /**
     * 
     * @param {宏定义的名字} name 
     * @param {宏定义的参数列表} params 
     * @param {语句原文} rawline
     */
    constructor() {
        this.name = "";
        this.params = [];
        this.rawline = "";
        this.realName = '';
    }
};

class EnumMet {
    constructor() {
        this.name = "";
        this.value = null;
        this.rawLine = "";
        this.permission = 0;
    }
};

class Typedef {
    constructor(name, value){
        this.name = name;
        this.value = value;
    }
};

class Node {
    constructor(domain) {
        //构造树相关字段定义
        this.domain_level = domain;          //作用域等级 顶级作用域为0
        this.parent = null;
        this.parent_domain_level = null;    //父节点
        this.children = [];

        //业务数据
        this.ownname = null;                //当前节点拥有的元数据
        this.data = [];                     //表示这里挂载了哪些代码块，数组下标
        this.permission = [];               //代码块的访问权限（最后的访问权限，不代表代码块都是这个访问权限）0:公开；1:保护; 2:私有, 与data对应

        //包含的作用域名称
        this.namespace = "";

        //包含的头文件
        this.include = [];

        //引用的命名空间
        this.usingnamespace = [];

        //宏定义
        this.define = [];

        //定义的方法
        this.method = [];

        //定义变量
        this.variable = [];

        //枚举定义
        this.enum = [];

        //typedef
        this.typedef = [];
    };

    addTypedef(typedef) {
        this.typedef.push(typedef);
    }

    //加入头文件路径
    addInclude(includepath){
        this.include.push(includepath);
    }

    //加入宏定义
    addDefine(define){
        this.define.push(define);
    }

    addMethod(method) {
        this.method.push(method);
    }

    addVariable(variable) {
        this.variable.push(variable);
    }

    addUsingNamespace(namespace){
        this.usingnamespace.push(namespace);
    }

    printf = function(){
        //console.log(this.domain_level, this.ownname, this.include, this.usingnamespace, this.define, this.method, this.variable);
        //console.log(this.domain_level, JSON.stringify(this.method), JSON.stringify(this.variable), this.permission);
        //if (this.method.length > 0) {
        //console.log(JSON.stringify(this));
        //}
    }
};


module.exports = {
    Node: Node,
    BaseData: BaseData,
    MethodMet: MethodMet,
    VariableMet: VariableMet,
    DefineMet: DefineMet,
    EnumMet: EnumMet,
    Typedef: Typedef
};
