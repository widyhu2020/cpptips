/* --------------------------------------------------------------------------------------------
 * tree.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var _a;
var MateData = require('./tree_node');
var Queue = require('./queue');
//Node = metdate.Node;
//BaseData = metdate.BaseData;
//MethodMet, VariableMet, DefineMet
//console.log(require('./tree_node'));
module.exports = (_a = /** @class */ (function () {
        function Tree(domain) {
            this.getRootNode = function () {
                return this.node;
            };
            this.traverseDF = function (callback) {
                (function recurse(currentNode) {
                    callback(currentNode);
                    for (var i = 0, length = currentNode.children.length; i < length; i++) {
                        recurse(currentNode.children[i]);
                    }
                })(this.node);
            };
            this.traverseBF = function (callback) {
                var queue = new Queue();
                //console.log(this);
                queue.enqueue(this.node);
                //console.log(queue);
                var currentTree = queue.dequeue();
                //console.log(currentTree);
                while (currentTree) {
                    for (var i = 0, length = currentTree.children.length; i < length; i++) {
                        queue.enqueue(currentTree.children[i]);
                    }
                    callback(currentTree);
                    currentTree = queue.dequeue();
                }
            };
            this.contains = function (callback, traversal) {
                traversal.call(this, callback);
            };
            this.add = function (domain, toDomain) {
                var child = new MateData.Node(domain), parent = null, callback = function (node) {
                    //console.log(node);
                    //console.log(domain);
                    if (node.domain_level === toDomain) {
                        parent = node;
                    }
                };
                //console.log(child);
                this.contains(callback, this.traverseDF);
                if (parent) {
                    parent.children.push(child);
                    child.parent = parent;
                    child.parent_domain_level = parent.domain_level;
                }
                else {
                    throw new Error('Cannot add node to a non-existent parent.');
                }
            };
            this.getFatherDomain = function (domain) {
                var current = null, callback = function (node) {
                    if (node.domain_level === domain) {
                        current = node;
                    }
                };
                this.contains(callback, this.traverseBF);
                if (current && current.parent != null) {
                    //存在父节点
                    return current.parent.domain_level;
                }
                return 0;
            };
            this.addDataToNode = function (domain, data) {
                var child = new MateData.Node(domain), callback = function (node) {
                    if (node.domain_level === domain) {
                        node.data.push(data);
                    }
                };
                //console.log(child);
                this.contains(callback, this.traverseDF);
            };
            this.remove = function (domain) {
                var tree = this, current = null, parent = null, childToRemove = null, index;
                var callback = function (node) {
                    if (node.domain_level === domain) {
                        current = node;
                    }
                };
                this.contains(callback, this.traverseBF);
                // console.log(domain, current);
                if (current != null && current.parent != null) {
                    parent = current.parent;
                    index = this.findIndex(parent.children, domain);
                    if (index === undefined) {
                        throw new Error('Node to remove does not exist.');
                    }
                    else {
                        childToRemove = parent.children.splice(index, 1);
                    }
                }
                else {
                    console.log("error", current, domain);
                    throw new Error('Parent does not exist.');
                }
                return childToRemove;
            };
            this.findIndex = function (arr, domain) {
                var index;
                for (var i = 0; i < arr.length; i++) {
                    if (arr[i].domain_level === domain) {
                        index = i;
                    }
                }
                return index;
            };
            //移除父的链接
            this.removeParentLink = function () {
                this.traverseBF(function (current) {
                    if (current != null) {
                        //current.parent_domain_level = current.parent.domain_level;
                        current.parent = null;
                    }
                });
            };
            this.printToJson = function () {
                console.log(JSON.stringify(this));
            };
            this.formartJson = function () {
                return JSON.stringify(this);
            };
            this.node = new MateData.Node(domain);
            this.node.ownname = new MateData.BaseData('__global__', 1, '');
        }
        ;
        return Tree;
    }()),
    _a.setType = function (node, data) {
        //console.log(node);
        node.ownname = data;
        //console.log(node);
    },
    _a);
