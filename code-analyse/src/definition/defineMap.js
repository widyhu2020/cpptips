/* --------------------------------------------------------------------------------------------
 * defineMap.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const TypeEnum = require('../analyse/analyseCpp').TypeEnum;
const KeyWordStore = require('../store/store').KeyWordStore;
const fs = require('fs');

let StdIteratorType = new Set([
    'reference', 'const_reference',
    'size_type', 'iterator', 'const_iterator', 
    'const_reverse_iterator', 'reverse_iterator']);

class DefineMap {
    constructor() {
        //Store.getInstace(dbfile);
    }

    static getInstace() {
        if (!DefineMap.instance) {
            DefineMap.instance = new DefineMap();
        }
        return DefineMap.instance;
    };

    _getTemplateClassNames = function (fullname) {
        let posbegin = fullname.indexOf("<");
        let posend = fullname.lastIndexOf(">");
        if (posbegin == -1 || posend == -1) {
            return false;
        }

        let _defstr = fullname.substring(posbegin + 1, posend);
        let findtype = [];
        let pos = 0;
        let beginpos = 0;
        while (true) {
            let _pos = _defstr.indexOf(",", pos);
            if (_pos == -1) {
                let _items = _defstr.substring(beginpos).trim();
                findtype.push(_items);
                break;
            }
            let result = this._getCharCountInStr(_defstr, pos, _pos, new Set(['<', '>']));
            if (result['<'] == result['>']) {
                let _items = _defstr.substring(pos, _pos).trim();
                findtype.push(_items);
                beginpos = _pos + 1;
            }
            pos = _pos + 1;
        }
        return findtype;
    };

    //获取字符串中指定字符的个数
    _getCharCountInStr(str, beginpos, endpos, charset) {
        let result = {};
        charset.forEach(e => { result[e] = 0; });
        for (let i = beginpos; i < endpos; i++) {
            if (charset.has(str[i])) {
                result[str[i]]++;
            }
        }
        return result;
    };

    fromTemplateStrGetValDef = function(templatedef) {
        let realParam = this._getTemplateClassNames(templatedef);
        if (!realParam) {
            return [templatedef];
        }
        return realParam;
    };

    getTemplateValType = function (fullname, TVal) {
        let realParam = this._getTemplateClassNames(fullname);
        if (!realParam) {
            return TVal;
        }

        let noNamespaceTval = TVal;
        let _valbegin = TVal.lastIndexOf('::');
        if (_valbegin != -1) {
            noNamespaceTval = TVal.substring(_valbegin + 2);
        }

        let _fullname = this.getRealName(fullname);
        let types = [TypeEnum.CALSS, TypeEnum.STRUCT];
        let infos = KeyWordStore.getInstace().getByFullname("", _fullname.namespace, _fullname.name, types);
        for(let i = 0; i < infos.length; i++) {
            let info = infos[0];
            if (info.extdata == "") {
                //异常数据
                return TVal;
            }
            //模版定义
            let extJson = JSON.parse(info.extdata);
            let template = extJson.p;
            template = template.replace(/(class )|(typename )/g, "");
            let defParam = this._getTemplateClassNames(template);
            for(let i = 0; i < defParam.length; i++) {
                if ((defParam[i] == noNamespaceTval || defParam[i] == TVal )
                    && i < realParam.length) {
                    return realParam[i];
                }
            }
        }
        return TVal;
    };

    //获取真实名称，通过owner
    getRealNameWithOwner = function(name, ownname, namespace) {

        if (StdIteratorType.has(name)) {
            //碰上std的迭代器，直接返回，太复杂了
            return name;
        }
        //这里只进行一层typedef转换
        let info = KeyWordStore.getInstace().getByFullnameAndType(ownname, namespace, name, TypeEnum.TYPEDEF);
        if (info == false) {
            //未找到映射
            return name;
        }
        let extData = JSON.parse(info.extdata);
        let __tmpfullname = this._removeTemplateDef(extData.v);
        if (info.namespace != "") {
            if (__tmpfullname.indexOf(info.namespace + "::")){
                //没有加命名空间，这里补上
                __tmpfullname = info.namespace + "::" + __tmpfullname;
            }
        }
        return __tmpfullname;
    };

    getRealName = function(fullname) {

        fullname = this._removeTemplateDef(fullname);
        let queue = [];
        this._splitFullNameToArray(fullname, queue);

        let _fullname = false;
        let maxCount = 0;
        while (true && maxCount++ < 5) {
            let __fullname = queue.pop();
            if (!__fullname || __fullname === undefined) {
                //
                return _fullname;
            }
            _fullname = __fullname;
      
            //名字转换
            let info = KeyWordStore.getInstace().getByFullnameAndType("", _fullname.namespace, _fullname.name, TypeEnum.TYPEDEF);
            if (info == false) {
                //未找到映射
                return _fullname;
            }

            let extData = JSON.parse(info.extdata);
            let __tmpfullname = this._removeTemplateDef(extData.v);
            this._splitFullNameToArray(__tmpfullname, queue, _fullname.namespace);
        }
    };

    _removeTemplateDef = function(fullname) {
        let templatebegin = fullname.indexOf("<");
        if (templatebegin != -1) {
            //模版类获取本类，包含类忽略
            fullname = fullname.substring(0, templatebegin);
        }
        return fullname;
    };

    _splitFullNameToArray(fullname, queue, sourcenas = "") {
        let lpos = fullname.lastIndexOf('::');
        if (lpos != -1) {
            let namespace = fullname.substring(0, lpos);
            let classname = fullname.substring(lpos + 2);
            queue.push({ namespace: namespace, name: classname });
        }
        else {
            queue.push({ namespace: sourcenas, name: fullname });
        }
    };
}

module.exports = {
    DefineMap: DefineMap,
    StdIteratorType: StdIteratorType
};