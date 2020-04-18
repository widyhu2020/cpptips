/* --------------------------------------------------------------------------------------------
 * queue.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
module.exports = /** @class */ (function () {
    function Queue(items) {
        this.items = items || [];
    }
    // 入列
    Queue.prototype.enqueue = function (ele) {
        this.items.push(ele);
    };
    // 出列
    Queue.prototype.dequeue = function () {
        return this.items.shift();
    };
    //
    Queue.prototype.front = function () {
        return this.items[0];
    };
    Queue.prototype.getall = function () {
        return this.items;
    };
    Queue.prototype.clear = function () {
        this.items = [];
    };
    Object.defineProperty(Queue.prototype, "size", {
        get: function () {
            return this.items.length;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Queue.prototype, "isEmpty", {
        get: function () {
            return !this.items.length;
        },
        enumerable: true,
        configurable: true
    });
    Queue.prototype.print = function () {
        console.log(this.items.toString());
    };
    return Queue;
}());
