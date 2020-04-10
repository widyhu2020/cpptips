/* --------------------------------------------------------------------------------------------
 * analyseDomain.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 */
var AnalyseDomain = /** @class */ (function () {
    //分析domain
    function AnalyseDomain(context) {
        this.getCharNumInStr = function (str, bpos, epos, ichar) {
            var findnum = 0;
            var fpos = bpos + 1;
            while (true) {
                var pos = str.indexOf(ichar, fpos);
                if (pos == -1 || pos > epos) {
                    //超出范围
                    break;
                }
                findnum++;
                fpos = pos + 1;
            }
            return findnum;
        };
        this.fillterOtherFunction = function (data) {
            var tmpdata = [];
            var findfunctiondefine = false;
            for (var i = 0; i < data.length; i++) {
                var blcok = data[i];
                blcok = blcok.trim();
                //if(/namespace/g.test(blcok)) console.log(blcok);
                if (blcok[blcok.length - 1] == ')') {
                    var items = [];
                    //最后一个为)结束，可能是函数定义，可能是for、if、while循环等等
                    var pos = blcok.length - 1;
                    var num = 0;
                    while (true) {
                        var tmppos = blcok.lastIndexOf('(', pos);
                        var _num = this.getCharNumInStr(blcok, tmppos, pos, ')');
                        num = num + _num - 1;
                        if (num <= 0) {
                            pos = tmppos;
                            break;
                        }
                        pos = tmppos - 1;
                    }
                    var preworld = blcok.substr(pos - 20, 20).trim();
                    items = preworld.split(/[\s\n\t:.;]{1,1}/mg);
                    if (items[items.length - 1] == "if"
                        || items[items.length - 1] == "for"
                        || items[items.length - 1] == "while") {
                        //非函数定义
                        tmpdata.push(data[i]);
                        continue;
                    }
                    if (findfunctiondefine == false) {
                        //第一个函数定义，全用
                        findfunctiondefine = true;
                        tmpdata.push(data[i]);
                        continue;
                    }
                    //函数定义，或者结构体、类等等的定义，此块也应该丢弃
                    pos = blcok.lastIndexOf(';');
                    if (pos != -1) {
                        tmpdata.push(blcok.substr(0, pos));
                    }
                    continue;
                }
                tmpdata.push(data[i]);
            }
            return tmpdata;
        };
        this.doAnalyse = function () {
            var data = [];
            var lastpos = this.context.length - 1;
            while (true) {
                var result = this._doAnalyse(lastpos);
                data.push(result.text);
                if (result.pos == -1) {
                    break;
                }
                lastpos = result.pos - 1;
            }
            return this.fillterOtherFunction(data);
        };
        this._doAnalyse = function (pos) {
            //从后往前找
            var beginpos = 0;
            var endNum = 0;
            var epos = pos;
            //endNum = 1;
            while (true) {
                var spos = this.context.lastIndexOf('{', epos);
                if (spos == -1) {
                    //花括号未闭合，不进行继续分析
                    beginpos = -1;
                    break;
                }
                var findEndNum = this.getCharNumInStr(this.context, spos, epos, '}');
                endNum = endNum + findEndNum - 1;
                if (endNum <= 0) {
                    //找第一个开始的符号
                    beginpos = spos;
                    break;
                }
                epos = spos - 1;
            }
            //找到最后一个}符号，与beginpos比较，取大的
            var findtext = "";
            var tmppos = this.context.lastIndexOf('}', pos);
            if (tmppos > beginpos) {
                //取}之后的数据
                findtext = this.context.substr(tmppos + 1, pos - tmppos + 1);
            }
            else {
                //取{之后的数据
                findtext = this.context.substr(beginpos + 1, pos - beginpos + 1);
            }
            var ret = { text: findtext, pos: beginpos };
            return ret;
        };
        this.context = context;
    }
    ;
    return AnalyseDomain;
}());
;
module.exports = AnalyseDomain;
