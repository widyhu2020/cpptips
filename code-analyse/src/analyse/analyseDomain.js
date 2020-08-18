/* --------------------------------------------------------------------------------------------
 * analyseDomain.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 */
const logger = require('log4js').getLogger("cpptips");

class AnalyseDomain {
    //分析domain
    constructor(context) {
        this.context = context;
        this.context = this.context.replace(/\/\/[^\n]*\n/g, "\n");
        // this.context = this.context.replace(/\/\*.+?(\*\/){1,1}/mg, "");

        while(true) {
            let bpos = this.context.indexOf("/*", 0);
            let epos = this.context.indexOf("*/", bpos);
            if(bpos == -1 || epos == -1) {
                //查找完毕
                break;
            }
            let firstContext = this.context.substring(0, bpos);
            let lastContext = this.context.substring(epos + 2);
            this.context = firstContext + lastContext;
        }  
    };

    getCharNumInStr = function(str, bpos, epos, ichar) {

        let findnum = 0;
        let fpos = bpos + 1;
        let maxRun = 0;
        while (true && maxRun < 500) {
            maxRun++;
            let pos = str.indexOf(ichar, fpos);
            if(pos == -1 || pos > epos) {
                //超出范围
                break;
            }
            findnum++;
            fpos = pos + 1;
        }
        return findnum;
    };

    fillterOtherFunction = function(data) {
        let tmpdata = [];
        let findfunctiondefine = false;
        for(let i = 0; i < data.length; i++) {
            let blcok = data[i];
            blcok = blcok.trim();
            //if(/namespace/g.test(blcok)) logger.debug(blcok);
            if(blcok[blcok.length - 1] == '{') {
                //最后一个为}结束，可能是函数实现
                //判断是否为函数
                let reg = /([\w]{1,64}[\s]{1,10})(([\w]{1,64}::){0,6}[\w]{1,64})[\s]{0,10}(\([\s]{0,10}\)|\([^();!.]{1,1024}\))[\s]{0,10}[{;]{1,1}$/mg;
                let matchData = reg.exec(blcok);
                if(matchData){
                    //判断是否为真正函数
                    let functiondef = matchData[0].trim();
                    let _retType = matchData[1].trim();
                    if(_retType == "else" 
                        || _retType == "if" 
                        || _retType == "for"
                        || _retType == "do"
                        || _retType == "while"
                        || functiondef[functiondef.length - 1] == ";") {
                        tmpdata.push(blcok);
                        continue;
                    }
                    let params = matchData[4].replace(/[()*&\n]{1,1}|const/g, "");
                    params = params.trim();
                    params = params.replace(/[\s]{0,10}::[\s]{0,10}/g, "::");
                    let paramsItem = params.split(",");
                    let isParamsDefine = true;
                    for(let i = 0; i < paramsItem.length; i++) {
                        if(paramsItem[i].trim().indexOf(" ") == -1) {
                            isParamsDefine = false;
                            break;
                        }
                    }
                    if(params != "" && !isParamsDefine) {
                        //不是函数定义
                        tmpdata.push(blcok);
                        continue;
                    }
                    
                    if(findfunctiondefine) {
                        //只需要一个函数
                        continue;
                    }
                    //函数定义
                    findfunctiondefine = true;
                    tmpdata.push(blcok);
                    continue;
                }
            }
            if (blcok[blcok.length - 1] == ')') {
                let items = [];
                //最后一个为)结束，可能是函数定义，可能是for、if、while循环等等
                let pos = blcok.length - 1;
                let num = 0;
                let maxRun = 0;
                while (true && maxRun < 500) {
                    maxRun++;
                    let tmppos = blcok.lastIndexOf('(', pos);
                    let _num = this.getCharNumInStr(blcok, tmppos, pos, ')');
                    num = num + _num - 1;
                    if(num <= 0) {
                        pos = tmppos;
                        break;
                    }
                    pos = tmppos - 1;
                }
                
                let preworld = blcok.substr(pos - 20, 20).trim();
                items = preworld.split(/[\s\n\t:.;]{1,1}/mg);

                if (items[items.length - 1] == "if"
                    || items[items.length - 1] == "for"
                    || items[items.length - 1] == "while") {
                    //非函数定义
                    tmpdata.push(data[i]);
                    continue;
                }

                //函数定义，或者结构体、类等等的定义，此块也应该丢弃
                blcok = blcok.replace(/(class |struct |enum )[\s\w:<>\n,{]*$/mg, "");
                tmpdata.push(blcok);
                continue;
            }
            tmpdata.push(data[i]);
        }
        return tmpdata;
    };

    doAnalyse = function() {
        
        let data = [];
        let lastpos = this.context.length - 1;
        let maxRun = 0;
        while (true && maxRun < 500) {
            maxRun++;
            let result = this._doAnalyse(lastpos);
            data.push(result.text);
            if (result.pos == -1) {
                break;
            }
            lastpos = result.pos - 1;
        }

        return this.fillterOtherFunction(data);
    };

    _doAnalyse = function(pos) {
        //从后往前找
        let beginpos = 0;
        let endNum = 0;
        let epos = pos;
        let maxRun = 0;
        while (true && maxRun < 500) {
            maxRun++;
            let spos = this.context.lastIndexOf('{', epos);
            if (spos == -1) {
                //花括号未闭合，不进行继续分析
                beginpos = -1;
                break;
            }
   
            let findEndNum = this.getCharNumInStr(this.context, spos, epos, '}');
            endNum = endNum + findEndNum - 1;
            if (endNum <= 0) {
                //找第一个开始的符号
                beginpos = spos;
                break;
            }
            epos = spos - 1;
        }

        //找到最后一个}符号，与beginpos比较，取大的
        let findtext = "";
        let tmppos = this.context.lastIndexOf('}', pos);
        if (tmppos > beginpos) {
            //取}之后的数据
            findtext = this.context.substr(tmppos + 1, pos - tmppos + 1);
        } else {
            //取{之后的数据
            findtext = this.context.substr(beginpos + 1, pos - beginpos + 1);
        }

        let ret = { text: findtext, pos: beginpos };
        return ret;
    };
};

module.exports = AnalyseDomain