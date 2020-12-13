/* --------------------------------------------------------------------------------------------
 * analyse.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var AnalyseCpp = require('./analyseCpp').AnalyseCpp;
var AnalyseProtobuf = require('./analyseProtobuf').AnalyseProtobuf;
var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
var logger = require('log4js').getLogger("cpptips");
var Analyse = /** @class */ (function () {
    function Analyse(filecontext, filename) {
        if (filename === void 0) { filename = ''; }
        //执行分析
        this.doAnalyse = function () {
            if (!this.analyseHandler) {
                return false;
            }
            return this.analyseHandler.doAnalyse();
        };
        //获取执行结果
        this.getResult = function (filedb, keyworddb, savepublic) {
            if (savepublic === void 0) { savepublic = false; }
            if (!this.analyseHandler) {
                return false;
            }
            return this.analyseHandler.getResult(filedb, keyworddb, savepublic);
        };
        this.getDocumentStruct = function () {
            try {
                return this.analyseHandler.getDocumentStruct();
            }
            catch (error) {
                logger.debug(error);
                return [];
            }
        };
        if (filename.indexOf(".vscode") != -1) {
            //无需处理
            return;
        }
        //分析handler
        this.analyseHandler = null;
        //proto文件
        var isproto = false;
        if (filename.lastIndexOf(".proto") != -1) {
            //是proto文件
            isproto = true;
        }
        if (isproto) {
            //protobuf处理
            this.analyseHandler = new AnalyseProtobuf(filecontext, filename);
        }
        else {
            //cpp文件处理
            this.analyseHandler = new AnalyseCpp(filecontext, filename);
        }
    }
    ;
    return Analyse;
}());
;
module.exports = {
    Analyse: Analyse,
    TypeEnum: TypeEnum
};
