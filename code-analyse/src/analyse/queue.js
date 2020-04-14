/* --------------------------------------------------------------------------------------------
 * queue.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

module.exports = class Queue {
    constructor(items) {
        this.items = items || [];
    }
    // 入列
    enqueue(ele) {
        this.items.push(ele);
    }
    // 出列
    dequeue() {
        return this.items.shift();
    }
    //
    front() {
        return this.items[0];
    }
    getall() {
        return this.items;
    }
    clear() {
        this.items = [];
    }
    get size() {
        return this.items.length;
    }
    get isEmpty() {
        return !this.items.length;
    }
    print() {
        console.log(this.items.toString());
    }
};