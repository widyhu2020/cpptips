/* --------------------------------------------------------------------------------------------
 * stack.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

//该类可以使用Array替代
module.exports = class Stack {
    
    constructor() {
        this.items = new WeakMap();
        this.items.set(this, []);
    }

    push(element) {
        let s = this.items.get(this);
        s.push(element);
    };

    pop() {
        let s = this.items.get(this);
        return s.pop();
    }

    peek() {
        let s = this.items.get(this);
        return s[s.length - 1];
    }

    isEmpty() {
        return this.items.get(this).length === 0;
    }

    size() {
        return this.items.get(this).length;
    }

    clear() {
        this.items.set(this, []);
    }

    print() {
        console.log("stack:  " + this.items.get(this).toString());
    }
};
