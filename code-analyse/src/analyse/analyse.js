/* --------------------------------------------------------------------------------------------
 * analyse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const AnalyseCpp = require('./analyseCpp').AnalyseCpp;
const AnalyseProtobuf = require('./analyseProtobuf').AnalyseProtobuf;
const TypeEnum = require('../analyse/analyseCpp').TypeEnum;

class Analyse {
    constructor(filecontext, filename = '') {
        
        //分析handler
        this.analyseHandler = null;

        //proto文件
        let isproto = false;
        if (filename.lastIndexOf(".proto") != -1) {
            //是proto文件
            isproto = true;
        }
        if(isproto) {
            //protobuf处理
            this.analyseHandler = new AnalyseProtobuf(filecontext, filename);
        } else {
            //cpp文件处理
            this.analyseHandler = new AnalyseCpp(filecontext, filename);
        }
    };

    //执行分析
    doAnalyse = function(){
        
        if(!this.analyseHandler) {
            return false;
        }
        return this.analyseHandler.doAnalyse();
    };

    //获取执行结果
    getResult = function (filedb, keyworddb, savepublic = false){
        if(!this.analyseHandler) {
            return false;
        }
        return this.analyseHandler.getResult(filedb, keyworddb, savepublic);
    };

    getDocumentStruct = function() {
        try{
            return this.analyseHandler.getDocumentStruct();
        } catch(error) {
            console.log(error);
            return [];
        }
    };
};

module.exports = {
    Analyse,
    TypeEnum
}