/* --------------------------------------------------------------------------------------------
 * stack.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
//该类可以使用Array替代
module.exports = /** @class */ (function () {
    function Stack() {
        this.items = new WeakMap();
        this.items.set(this, []);
    }
    Stack.prototype.push = function (element) {
        var s = this.items.get(this);
        s.push(element);
    };
    ;
    Stack.prototype.pop = function () {
        var s = this.items.get(this);
        return s.pop();
    };
    Stack.prototype.peek = function () {
        var s = this.items.get(this);
        return s[s.length - 1];
    };
    Stack.prototype.isEmpty = function () {
        return this.items.get(this).length === 0;
    };
    Stack.prototype.size = function () {
        return this.items.get(this).length;
    };
    Stack.prototype.clear = function () {
        this.items.set(this, []);
    };
    Stack.prototype.print = function () {
        console.log("stack:  " + this.items.get(this).toString());
    };
    return Stack;
}());
