"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
var DEFINE_TYPE = {
    NAMESPACE: 1,
    CLASS: 2,
    FUNCTION: 7,
    VARIABLE: 6,
    DEFINE: 8
};
class DepNodeProvider {
    constructor(json) {
        this.json = json;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.jsonData = "";
        console.log(json);
        this.jsonData = JSON.parse(json);
        if (this.jsonData["name"] == ""
            && this.jsonData["child"].length == 1
            && this.jsonData["child"][0]["name"] == "") {
            //兼容异常数据
            this.jsonData = this.jsonData["child"][0];
        }
    }
    refresh(json) {
        this.jsonData = JSON.parse(json);
        if (this.jsonData["name"] == ""
            && this.jsonData["child"].length == 1
            && this.jsonData["child"][0]["name"] == "") {
            //兼容异常数据
            this.jsonData = this.jsonData["child"][0];
        }
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        let lable = "";
        if (element && element.fullname) {
            lable = element.fullname;
        }
        return Promise.resolve(this.getDepsInDefineJson(lable));
    }
    getDefineInfo(key, defineMeta, owner = "") {
        let dependencys = [];
        let functions = defineMeta["function"];
        let variables = defineMeta["variable"];
        let defines = defineMeta["defines"];
        for (let i = 0; i < functions.length; i++) {
            let fullname = key + "::" + functions[i];
            let command = {
                command: 'extension.gotodefine',
                title: '跳转到指定实现',
                arguments: [[functions[i], owner, "function"]]
            };
            let dependency = new Dependency(functions[i], fullname, DEFINE_TYPE.FUNCTION, vscode.TreeItemCollapsibleState.None, command);
            dependencys.push(dependency);
        }
        for (let i = 0; i < variables.length; i++) {
            let fullname = key + "::" + variables[i];
            let command = {
                command: 'extension.gotodefine',
                title: '跳转到指定实现',
                arguments: [[variables[i], owner, "variable"]]
            };
            let dependency = new Dependency(variables[i], fullname, DEFINE_TYPE.VARIABLE, vscode.TreeItemCollapsibleState.None, command);
            dependencys.push(dependency);
        }
        for (let i = 0; i < defines.length; i++) {
            let fullname = key + "::" + defines[i];
            let command = {
                command: 'extension.gotodefine',
                title: '跳转到指定实现',
                arguments: [[defines[i], owner, "define"]]
            };
            let dependency = new Dependency(defines[i], fullname, DEFINE_TYPE.DEFINE, vscode.TreeItemCollapsibleState.None, command);
            dependencys.push(dependency);
        }
        return dependencys;
    }
    getDepsInDefineJson(key) {
        let dependencys = [];
        let nodeInfo = this.jsonData;
        //找到位置
        if (key != "") {
            let nameKeys = key.split("::");
            nodeInfo = this.jsonData;
            for (let i = 0; i < nameKeys.length; i++) {
                let name = nameKeys[i];
                for (let j = 0; j < nodeInfo['child'].length; j++) {
                    if (nodeInfo['child'][j]["name"] == name) {
                        nodeInfo = nodeInfo['child'][j];
                        break;
                    }
                }
            }
        }
        //生成列表
        let defineMeta = nodeInfo;
        if (defineMeta["function"].length > 0
            || defineMeta["defines"].length > 0
            || defineMeta["variable"].length > 0) {
            let owner = "";
            if (defineMeta["type"] == DEFINE_TYPE.CLASS) {
                owner = defineMeta["name"];
            }
            let ret = this.getDefineInfo(key, defineMeta, owner);
            if (ret.length > 0) {
                //找到数据
                dependencys = dependencys.concat(ret);
            }
        }
        for (let i = 0; i < defineMeta["child"].length; i++) {
            //命名空间下函数方法
            let name = defineMeta["child"][i]["name"];
            let namespace = key.length > 0 ? key + "::" + name : name;
            let type = defineMeta["child"][i]["type"];
            if (name == "") {
                let owner = "";
                if (defineMeta["type"] == DEFINE_TYPE.CLASS) {
                    owner = defineMeta["name"];
                }
                let ret = this.getDefineInfo(key, defineMeta["child"][i], owner);
                dependencys = dependencys.concat(ret);
                continue;
            }
            let dependency = new Dependency(name, namespace, type, vscode.TreeItemCollapsibleState.Collapsed);
            dependencys.push(dependency);
        }
        return dependencys;
        return [];
    }
}
exports.DepNodeProvider = DepNodeProvider;
class Dependency extends vscode.TreeItem {
    constructor(label, fullname, type, collapsibleState, command) {
        super(label, collapsibleState);
        this.label = label;
        this.fullname = fullname;
        this.type = type;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'function_w.png');
        this.contextValue = 'dependency';
        if (type == DEFINE_TYPE.NAMESPACE) {
            //命名空间
            this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'namespace.png');
        }
        else if (type == DEFINE_TYPE.CLASS) {
            //类
            this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'class.png');
        }
        else if (type == DEFINE_TYPE.FUNCTION) {
            //方法
            this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'function.png');
        }
        else if (type == DEFINE_TYPE.VARIABLE) {
            //变量
            this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'var.png');
        }
        else if (type == DEFINE_TYPE.DEFINE) {
            //宏定义
            this.iconPath = path.join(__filename, '..', '..', '..', 'resources', 'define.png');
        }
    }
    get tooltip() {
        return `${this.label}`;
    }
    get description() {
        return "";
    }
}
exports.Dependency = Dependency;
//# sourceMappingURL=nodeDependencies.js.map