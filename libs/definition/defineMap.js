/* --------------------------------------------------------------------------------------------
 * defineMap.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
var KeyWordStore = require('../store/store').KeyWordStore;
var fs = require('fs');
var StdIteratorType = new Set([
    'reference', 'const_reference',
    'size_type', 'iterator', 'const_iterator',
    'const_reverse_iterator', 'reverse_iterator'
]);
var DefineMap = /** @class */ (function () {
    function DefineMap() {
        this._getTemplateClassNames = function (fullname) {
            var posbegin = fullname.indexOf("<");
            var posend = fullname.lastIndexOf(">");
            if (posbegin == -1 || posend == -1) {
                return false;
            }
            var _defstr = fullname.substring(posbegin + 1, posend);
            var findtype = [];
            var pos = 0;
            var beginpos = 0;
            while (true) {
                var _pos = _defstr.indexOf(",", pos);
                if (_pos == -1) {
                    var _items = _defstr.substring(beginpos).trim();
                    findtype.push(_items);
                    break;
                }
                var result = this._getCharCountInStr(_defstr, pos, _pos, new Set(['<', '>']));
                if (result['<'] == result['>']) {
                    var _items = _defstr.substring(pos, _pos).trim();
                    findtype.push(_items);
                    beginpos = _pos + 1;
                }
                pos = _pos + 1;
            }
            return findtype;
        };
        this.fromTemplateStrGetValDef = function (templatedef) {
            var realParam = this._getTemplateClassNames(templatedef);
            if (!realParam) {
                return [templatedef];
            }
            return realParam;
        };
        this.getTemplateValType = function (fullname, TVal) {
            var realParam = this._getTemplateClassNames(fullname);
            if (!realParam) {
                return TVal;
            }
            var noNamespaceTval = TVal;
            var _valbegin = TVal.lastIndexOf('::');
            if (_valbegin != -1) {
                noNamespaceTval = TVal.substring(_valbegin + 2);
            }
            var _fullname = this.getRealName(fullname);
            var types = [TypeEnum.CALSS, TypeEnum.STRUCT];
            var infos = KeyWordStore.getInstace().getByFullname("", _fullname.namespace, _fullname.name, types);
            for (var i = 0; i < infos.length; i++) {
                var info = infos[0];
                if (info.extdata == "") {
                    //异常数据
                    return TVal;
                }
                //模版定义
                var extJson = JSON.parse(info.extdata);
                var template = extJson.p;
                template = template.replace(/(class )|(typename )/g, "");
                var defParam = this._getTemplateClassNames(template);
                for (var i_1 = 0; i_1 < defParam.length; i_1++) {
                    if ((defParam[i_1] == noNamespaceTval || defParam[i_1] == TVal)
                        && i_1 < realParam.length) {
                        return realParam[i_1];
                    }
                }
            }
            return TVal;
        };
        //获取真实名称，通过owner
        this.getRealNameWithOwner = function (name, ownname, namespace) {
            if (StdIteratorType.has(name)) {
                //碰上std的迭代器，直接返回，太复杂了
                return name;
            }
            //这里只进行一层typedef转换
            var info = KeyWordStore.getInstace().getByFullnameAndType(ownname, namespace, name, TypeEnum.TYPEDEF);
            if (info == false) {
                //未找到映射
                return name;
            }
            var extData = JSON.parse(info.extdata);
            var __tmpfullname = this._removeTemplateDef(extData.v);
            if (info.namespace != "") {
                if (__tmpfullname.indexOf(info.namespace + "::")) {
                    //没有加命名空间，这里补上
                    __tmpfullname = info.namespace + "::" + __tmpfullname;
                }
            }
            return __tmpfullname;
        };
        this.getRealName = function (fullname) {
            fullname = this._removeTemplateDef(fullname);
            var queue = [];
            this._splitFullNameToArray(fullname, queue);
            var _fullname = false;
            var maxCount = 0;
            while (true && maxCount++ < 5) {
                var __fullname = queue.pop();
                if (!__fullname || __fullname === undefined) {
                    //
                    return _fullname;
                }
                _fullname = __fullname;
                //名字转换
                var info = KeyWordStore.getInstace().getByFullnameAndType("", _fullname.namespace, _fullname.name, TypeEnum.TYPEDEF);
                if (info == false) {
                    //未找到映射
                    return _fullname;
                }
                var extData = JSON.parse(info.extdata);
                var __tmpfullname = this._removeTemplateDef(extData.v);
                this._splitFullNameToArray(__tmpfullname, queue, _fullname.namespace);
            }
        };
        this._removeTemplateDef = function (fullname) {
            var templatebegin = fullname.indexOf("<");
            if (templatebegin != -1) {
                //模版类获取本类，包含类忽略
                fullname = fullname.substring(0, templatebegin);
            }
            return fullname;
        };
        //Store.getInstace(dbfile);
    }
    DefineMap.getInstace = function () {
        if (!DefineMap.instance) {
            DefineMap.instance = new DefineMap();
        }
        return DefineMap.instance;
    };
    ;
    //获取字符串中指定字符的个数
    DefineMap.prototype._getCharCountInStr = function (str, beginpos, endpos, charset) {
        var result = {};
        charset.forEach(function (e) { result[e] = 0; });
        for (var i = beginpos; i < endpos; i++) {
            if (charset.has(str[i])) {
                result[str[i]]++;
            }
        }
        return result;
    };
    ;
    DefineMap.prototype._splitFullNameToArray = function (fullname, queue, sourcenas) {
        if (sourcenas === void 0) { sourcenas = ""; }
        var lpos = fullname.lastIndexOf('::');
        if (lpos != -1) {
            var namespace = fullname.substring(0, lpos);
            var classname = fullname.substring(lpos + 2);
            queue.push({ namespace: namespace, name: classname });
        }
        else {
            queue.push({ namespace: sourcenas, name: fullname });
        }
    };
    ;
    return DefineMap;
}());
module.exports = {
    DefineMap: DefineMap,
    StdIteratorType: StdIteratorType
};
