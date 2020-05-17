/* --------------------------------------------------------------------------------------------
 * definition.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
var KeyWordStore = require('../store/store').KeyWordStore;
var FileIndexStore = require('../store/store').FileIndexStore;
var Completion = require('../completion/completion').Completion;
var DefineMap = require('../definition/defineMap').DefineMap;
var fs = require('fs');
var path = require('path');
var Definition = /** @class */ (function (_super) {
    __extends(Definition, _super);
    function Definition(basepath, extpath) {
        var _this = _super.call(this) || this;
        //获取非类成员方法或者静态方法定义
        _this.getFunctionDefineInfo = function (name, namespaces) {
            var kws = KeyWordStore.getInstace();
            var _pos = name.lastIndexOf("::");
            if (_pos != -1) {
                var _name = name.substring(_pos + 2);
                var _namespace = name.substring(0, _pos);
                //1.判断是否为类的静态变量
                var findclass = kws.getByOwnNameAndName([_namespace], _name, namespaces);
                if (!findclass || findclass.length <= 0) {
                    //2.命名空间下的方法
                    findclass = kws.getByFullnameAndType('', _namespace, _name, TypeEnum.FUNCTION);
                    if (!findclass) {
                        //可能是静态类下的静态变量
                        var _prepos = name.lastIndexOf("::", _pos - 1);
                        var _ownname = "";
                        if (_prepos == -1) {
                            _ownname = _namespace;
                        }
                        else {
                            _ownname = name.substring(_prepos + 2, _pos);
                        }
                        var _snamespace = name.substring(0, _prepos);
                        findclass = kws.getByFullnameAndType(_ownname, _snamespace, _name, TypeEnum.FUNCTION);
                        if (!findclass) {
                            //可能命名空间切分到了using namspace和方法名前面
                            for (var i = 0; i < namespaces.length; i++) {
                                var ns = namespaces[i];
                                if (ns != "") {
                                    ns = ns + "::" + _namespace;
                                    namespaces[i] = ns;
                                }
                            }
                            var lists = kws.getByFullnameNssAndType('', namespaces, _name, TypeEnum.FUNCTION);
                            if (lists.length <= 0) {
                                return false;
                            }
                            findclass = lists[0];
                        }
                    }
                }
                else {
                    findclass = findclass[0];
                }
                if (!findclass) {
                    return false;
                }
                var file_id = this.getRealFileId(findclass);
                var sourcefilepath = this.getFileInfo(file_id);
                var filepath = this.getFileInfo(findclass.file_id);
                return this.readFileFindDefine(filepath, findclass.ownname, findclass.name, findclass.type, sourcefilepath);
            }
            else {
                //没有命名空间的，需要找到全名称
                var findclass = kws.getByNameAndNamespaces(name, namespaces);
                if (findclass.length <= 0) {
                    //没有找到父类
                    return false;
                }
                for (var i = 0; i < findclass.length; i++) {
                    if (findclass[i].type != TypeEnum.FUNCTION) {
                        //不是类的定义
                        continue;
                    }
                    var file_id = this.getRealFileId(findclass);
                    var sourcefilepath = this.getFileInfo(file_id);
                    var filepath = this.getFileInfo(findclass.file_id);
                    return this.readFileFindDefine(filepath, findclass[i].ownname, findclass[i].name, findclass[i].type, sourcefilepath);
                }
            }
            return false;
        };
        _this._getDirsMatching = function (fileA, fileB) {
            var pathInfoA = fileA.split(/[\\/]{1,2}/);
            var pathInfoB = fileB.split(/[\\/]{1,2}/);
            var match = 0;
            for (var i = 0; i < pathInfoA.length && i < pathInfoB.length; i++) {
                if (pathInfoA[i] == pathInfoB[i]) {
                    //匹配度+1
                    match++;
                }
            }
            return match;
        };
        //获取头文件信息
        _this.getIncludeInfo = function (sourceFile, includeFile, fileName) {
            var fdb = FileIndexStore.getInstace();
            var match = -1;
            var findIncludeFile = "";
            console.time("getFileByFileName");
            var fileList = fdb.getFileByFileName(fileName);
            console.timeEnd("getFileByFileName");
            //console.log(fileList);
            for (var i = 0; i < fileList.length; i++) {
                var filePath = fileList[i];
                var _pos = filePath.filepath.indexOf(includeFile);
                if (_pos != -1) {
                    //匹配规则
                    var _match = this._getDirsMatching(filePath.filepath, sourceFile);
                    if (_match > match) {
                        findIncludeFile = filePath.filepath;
                    }
                }
            }
            return findIncludeFile;
        };
        //获取类的全名称
        _this.getClassDefineInfo = function (name, namespaces) {
            var kws = KeyWordStore.getInstace();
            var findclass = [];
            var ret = DefineMap.getInstace().getRealName(name);
            //let _pos = name.lastIndexOf("::");
            if (ret && ret.namespace != "") {
                var _name = ret.name;
                var _namespace = ret.namespace;
                findclass = kws.getByNameAndNamespaces(_name, [_namespace]);
            }
            else {
                //没有命名空间的，需要找到全名称
                findclass = kws.getByNameAndNamespaces(name, namespaces);
                if (findclass.length <= 0) {
                    //没有找到父类
                    return false;
                }
            }
            //宏定义处理
            if (findclass.length == 1
                && findclass[0].type == TypeEnum.DEFINE) {
                //宏定义
                var extData = JSON.parse(findclass[0].extdata);
                return this.getClassDefineInfo(extData.v, namespaces);
            }
            //只处理第一个，如果有多个这里忽略除一个以外的
            for (var i = 0; i < findclass.length; i++) {
                //如果是枚举值
                if (findclass[i].type == TypeEnum.ENUMITEM
                    && i == findclass.length - 1) {
                    //找到最后一个，还是枚举，则返回枚举
                    var fullnames = [];
                    if (findclass[i].namespace != "") {
                        fullnames.push(findclass[i].namespace);
                    }
                    if (findclass[i].ownname != "") {
                        fullnames.push(findclass[i].ownname);
                    }
                    fullnames.push(findclass[i].name);
                    return {
                        full_name: fullnames.join("::"),
                        file_id: findclass[i].file_id,
                        inherit: [],
                        type: TypeEnum.ENUMITEM
                    };
                }
                if (findclass[i].type != TypeEnum.CALSS) {
                    //不是类的定义
                    continue;
                }
                var retinherit = [];
                var inherit = JSON.parse(findclass[i].extdata);
                for (var i_1 = 0; i_1 < inherit.i.length; i_1++) {
                    var inheritclass = inherit.i[i_1];
                    var classname = inheritclass.n;
                    retinherit.push(classname);
                }
                var fullname = findclass[i].name;
                if (findclass[i].namespace != "") {
                    fullname = findclass[i].namespace + "::" + findclass[i].name;
                }
                return {
                    full_name: fullname,
                    file_id: findclass[i].file_id,
                    inherit: retinherit,
                    type: TypeEnum.CALSS
                };
            }
            //原样返回
            return false;
        };
        //获取具体的定义位置
        _this.getDefineInWitchClass = function (ownnames, name, namespaces) {
            var _owns = {};
            var _namespace = namespaces;
            for (var i = 0; i < ownnames.length; i++) {
                var _own = ownnames[i];
                var ret = DefineMap.getInstace().getRealName(_own);
                if (!ret) {
                    continue;
                }
                var _tmpown = ret.name;
                var _usingnamespace = ret.namespace;
                _owns[_tmpown] = _usingnamespace;
                _namespace.push(_usingnamespace);
            }
            //通过归属和名称查找定义对象
            var definemap = {};
            var findName = Object.keys(_owns);
            var list = KeyWordStore.getInstace().getByOwnNameAndName(findName, name, namespaces);
            for (var i = 0; i < list.length; i++) {
                var info = list[i];
                definemap[info.ownname] = info;
            }
            //主类放最前面
            for (var i = 0; i < findName.length; i++) {
                if (definemap[findName[i]]) {
                    //找到
                    return {
                        ownname: findName[i],
                        filepath: this.getFileInfo(definemap[findName[i]].file_id),
                        info: definemap[findName[i]]
                    };
                }
            }
            return false;
        };
        //通过全名称查找定义，只能类、结构体、全局函数
        _this.findFullNameDefine = function (fullname) {
            var name = fullname;
            var ownname = "";
            var namespace = "";
            var _pos = fullname.lastIndexOf("::");
            if (_pos != -1) {
                //已经包含命名空间，直接返回
                name = fullname.substring(_pos + 2);
                namespace = fullname.substring(0, _pos);
            }
            //获取定义详情
            var types = [TypeEnum.CALSS, TypeEnum.STRUCT, TypeEnum.FUNCTION];
            var infos = KeyWordStore.getInstace().getByFullname(ownname, namespace, name, types);
            if (!infos || infos.length <= 0) {
                //查找失败
                return false;
            }
            var info = infos[0];
            var file_id = this.getRealFileId(info);
            var sourcefilepath = this.getFileInfo(file_id);
            var filepath = this.getFileInfo(info.file_id);
            if (!filepath) {
                //未找到文件登记
                return false;
            }
            return this.readFileFindDefine(filepath, name, '', info.type, sourcefilepath);
        };
        //通过文件相对全称获取文件全名
        _this.getFileInfoByFullName = function (filepath) {
            var info = FileIndexStore.getInstace().getFileByFilePath(filepath);
            if (info == false) {
                //可能是本地cpp文件，这种不需要入库
                return this.basepath + filepath;
            }
            if (info.systeminclude == 1) {
                //系统目录
                var fileallpath_1 = this.extpath + path.sep + "data" + info.filepath;
                console.info("filepath:", fileallpath_1);
                return fileallpath_1;
            }
            var fileallpath = this.basepath + info.filepath;
            console.info("filepath:", fileallpath);
            return fileallpath;
        };
        //通过文件id获取文件名称（相对路径）
        _this.getFileInfo = function (file_id) {
            var info = FileIndexStore.getInstace().getFileById(file_id);
            if (info == false) {
                return false;
            }
            if (info.systeminclude == 1) {
                //系统目录
                var fileallpath_2 = this.extpath + path.sep + "data" + info.filepath;
                console.info("filepath:", fileallpath_2);
                return fileallpath_2;
            }
            var fileallpath = this.basepath + info.filepath;
            console.info("filepath:", fileallpath);
            return fileallpath;
        };
        //读取文件查找内容
        _this.readFileFindDefine = function (filepath, ownname, name, type, sourcefilepath) {
            if (sourcefilepath === void 0) { sourcefilepath = ''; }
            ownname = ownname.trim();
            name = name.trim();
            if (!fs.existsSync(filepath)) {
                //文件不存在
                return false;
            }
            //写入文件索引
            var fd = fs.openSync(filepath, 'r');
            var buffer = Buffer.alloc(1024 * 1024 * 2);
            var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            fs.closeSync(fd);
            var filecontext = buffer.toString('utf8', 0, bytesRead);
            var lineinfo = {};
            var linecode = "";
            var prelinecode = "";
            var bpos = 0;
            var epos = 0;
            var ownpos = 0;
            var namepos = 0;
            if (ownname == "" && name != "") {
                namepos = this._findValInStr(filecontext, name, 0);
                if (namepos == -1) {
                    //未找到定义
                    return false;
                }
                lineinfo = this._getDefinePost(filecontext, namepos);
                linecode = lineinfo.c;
                prelinecode = lineinfo.p;
                bpos = linecode.indexOf(name);
                epos = bpos + name.length;
            }
            if (name == "" && ownname != "") {
                ownpos = this._findValInStr(filecontext, ownname, 0);
                if (ownpos == -1) {
                    //未找到定义
                    return false;
                }
                //直接去定义
                lineinfo = this._getDefinePost(filecontext, ownpos);
                linecode = lineinfo.c;
                prelinecode = lineinfo.p;
                bpos = linecode.indexOf(ownname);
                epos = bpos + ownname.length;
            }
            if (name != "" && ownname != "") {
                ownpos = this._findValInStr(filecontext, ownname, 0);
                if (ownpos == -1) {
                    //未找到定义
                    if (/[.]{1,1}proto$/g.test(filepath)) {
                        //如果是proto定义，尝试重新查
                        //这里有优化空间，_后面的不一定将是message的名称，且可能多个message都定义了相同的内部message，导致调整不准确
                        var _pos = ownname.lastIndexOf("_");
                        if (_pos == -1) {
                            return false;
                        }
                        ownname = ownname.substring(_pos + 1);
                        ownpos = this._findValInStr(filecontext, ownname, 0);
                        if (_pos == -1) {
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                }
                //从定义开始的位置开始找name的定义
                //proto文件才需这样处理
                namepos = this._findValInStr(filecontext, name, ownpos);
                if (namepos == -1) {
                    //未找到定义
                    return false;
                }
                lineinfo = this._getDefinePost(filecontext, namepos);
                linecode = lineinfo.c;
                prelinecode = lineinfo.p;
                bpos = linecode.indexOf(name);
                epos = bpos + name.length;
            }
            var result = {
                filename: "file://" + filepath,
                bline: lineinfo.l,
                bcols: bpos,
                eline: lineinfo.l,
                ecols: epos,
                linecode: linecode,
                prelinecode: this._getHoverTips(filecontext, ownpos, namepos, ownname, name, filepath),
                title: name != "" ? name : ownname
            };
            //修正函数的实现定义
            if (sourcefilepath != ""
                && filepath != sourcefilepath) {
                this._readFileFindAchieveFromCpp(result, sourcefilepath, ownname, name, type);
            }
            return result;
        };
        //从源文件中找出实现
        _this._readFileFindAchieveFromCpp = function (result, sourcefilepath, ownname, name, type) {
            if (!fs.existsSync(sourcefilepath)) {
                //文件不存在
                console.log("file not exits:", sourcefilepath);
                return false;
            }
            if (type == TypeEnum.FUNCTION) {
                var _name = ownname + "::" + name;
                var fd = fs.openSync(sourcefilepath, 'r');
                var buffer = Buffer.alloc(1024 * 1024 * 2);
                var bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
                fs.closeSync(fd);
                var filecontext = buffer.toString('utf8', 0, bytesRead);
                var namepos = this._findValInStr(filecontext, _name, 0);
                var lineinfo = this._getDefinePost(filecontext, namepos);
                var linecode = lineinfo.c;
                linecode = linecode.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
                //let prelinecode = lineinfo.p;
                var bpos = linecode.indexOf(_name);
                var epos = bpos + _name.length;
                result.filename = "file://" + sourcefilepath;
                result.bline = lineinfo.l;
                result.bcols = bpos;
                result.eline = lineinfo.l;
                result.ecols = epos;
                console.log(result);
                return;
            }
            console.log(type);
        };
        _this._findValInStr = function (source, val, bpos, issmall) {
            //全部转为小写查找
            if (issmall === void 0) { issmall = false; }
            while (true) {
                bpos = source.indexOf(val, bpos);
                if (bpos == -1) {
                    if (!issmall) {
                        //如果找不到，可能需要大小写兼容
                        //全部转为小写尝试查找
                        source = source.toLowerCase();
                        return this._findValInStr(source, val, bpos, true);
                    }
                    return -1;
                }
                //判断是否在注释里面
                var notebegin = source.lastIndexOf("/*", bpos);
                var noteend = source.lastIndexOf("*/", bpos);
                if (notebegin > noteend && noteend != -1) {
                    //继续找
                    bpos++;
                    continue;
                }
                //去掉行注释
                notebegin = source.lastIndexOf("//", bpos);
                noteend = source.lastIndexOf("\n", bpos);
                if (notebegin > noteend && noteend != -1) {
                    //继续找
                    bpos++;
                    continue;
                }
                //前一个字符
                if (bpos - 1 < 0
                    || bpos + val.length > source.length) {
                    bpos++;
                    continue;
                }
                var c = source[bpos - 1];
                if ((c >= 'a' && c <= 'z')
                    || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9')
                    || c == '_') {
                    bpos++;
                    continue;
                }
                //后面字符
                c = source[bpos + val.length];
                if ((c >= 'a' && c <= 'z')
                    || (c >= 'A' && c <= 'Z')
                    || (c >= '0' && c <= '9')
                    || c == '_') {
                    bpos++;
                    continue;
                }
                return bpos;
            }
        };
        //通过pos获取行数
        _this._getDefinePost = function (filecontext, namepos) {
            var startpos = 0;
            var lines = 0;
            var lincode = "";
            var precode = "";
            while (true) {
                var pos = filecontext.indexOf("\n", startpos);
                if (pos == -1
                    || (namepos >= startpos && pos >= namepos)) {
                    //找到行位置
                    lincode = filecontext.substring(startpos, pos);
                    var prepos = startpos - 300;
                    if (prepos < 0) {
                        prepos = 0;
                    }
                    precode = filecontext.substring(prepos, startpos);
                    break;
                }
                startpos = pos + 1;
                lines++;
            }
            return { l: lines, c: lincode, p: precode };
        };
        //获取鼠标停留展示文案
        _this._getHoverTips = function (filecontext, ownpos, namepos, ownname, name, filepath) {
            var ownlines = [];
            var namelines = [];
            var title = name == "" ? ownname : name;
            var hasnamedata = false;
            if (ownname != "") {
                var lineend = filecontext.indexOf("\n", ownpos);
                var spos = lineend - 200 < 0 ? 0 : lineend - 200;
                var owncontext = filecontext.substring(spos, lineend);
                var lines = owncontext.split("\n");
                ownlines.push(lines[lines.length - 1]);
                for (var i = lines.length - 2; i > 0; i--) {
                    var line = lines[i];
                    if (line == ""
                        || /^[\s\t\n]{0,10}[/]{1,1}|^[*]{1,1}/g.test(line)) {
                        ownlines.push(line);
                        continue;
                    }
                    break;
                }
                //弹出无用的行
                while (true) {
                    if (ownlines[ownlines.length - 1] == "") {
                        ownlines.pop();
                    }
                    break;
                }
                ownlines = ownlines.reverse();
                //接下来一行如果是{则也加入
                spos = filecontext.indexOf("\n", lineend + 1);
                var _tmp = filecontext.substring(lineend + 1, spos);
                if (_tmp.trim() == "{") {
                    ownlines.push(_tmp);
                }
                var pos = filecontext.indexOf("}", ownpos);
                var icount = this._getCharCountInStr(filecontext, ownpos, pos, '\n');
                if (icount < 12) {
                    //onwname定义行数比较少
                    var beginpos = filecontext.indexOf("\n", ownpos);
                    var namedata = filecontext.substring(beginpos + 1, pos + 1);
                    namelines.push(namedata);
                    hasnamedata = true;
                }
            }
            if (ownpos > 0 && namepos > 0 && !hasnamedata) {
                var icount = this._getCharCountInStr(filecontext, ownpos, namepos, '\n');
                if (icount < 2) {
                    var namedata = "";
                    var bbeginpos = filecontext.indexOf('\n', namepos);
                    var abeginpos = filecontext.indexOf('\n', ownpos);
                    var beforedata = filecontext.substring(bbeginpos, abeginpos);
                    namedata = beforedata;
                    //往后找4行
                    var i = 2;
                    var pos = bbeginpos;
                    while (i--) {
                        pos = filecontext.indexOf('\n', pos + 1);
                        if (pos == -1) {
                            break;
                        }
                    }
                    var tmpdata = filecontext.substring(bbeginpos, pos);
                    var _pos = tmpdata.indexOf('}');
                    if (_pos != -1) {
                        tmpdata = tmpdata.substring(0, _pos + 1);
                    }
                    namedata = namedata + tmpdata;
                    namelines.push(namedata);
                    hasnamedata = true;
                }
            }
            if (name != "" && !hasnamedata) {
                //往前找4行
                var namedata = "";
                var abeginpos = filecontext.indexOf('\n', namepos);
                var i = 2;
                var pos = abeginpos;
                while (i--) {
                    pos = filecontext.lastIndexOf('\n', pos - 1);
                    if (pos == -1) {
                        break;
                    }
                }
                var tmpdata = filecontext.substring(pos + 1, abeginpos);
                var _pos = tmpdata.indexOf('{');
                if (_pos != -1 && ownname != "") {
                    tmpdata = tmpdata.substring(_pos + 1);
                }
                else {
                    if (ownname != "") {
                        namelines.push("...");
                    }
                }
                namedata = tmpdata;
                //往后找4行
                i = 2;
                pos = abeginpos;
                while (i--) {
                    pos = filecontext.indexOf('\n', pos + 1);
                    if (pos == -1) {
                        break;
                    }
                }
                tmpdata = filecontext.substring(abeginpos, pos);
                _pos = tmpdata.indexOf('}');
                if (_pos != -1) {
                    tmpdata = tmpdata.substring(0, _pos + 1);
                }
                namedata = namedata + tmpdata;
                namelines.push(namedata);
            }
            var showinfo = [];
            showinfo.push("#### " + title);
            showinfo.push("```cpp");
            showinfo = showinfo.concat(ownlines);
            showinfo = showinfo.concat(namelines);
            showinfo.push("```");
            showinfo.push("文件:" + filepath);
            return showinfo.join('\n');
        };
        _this._findLineNumWithCode = function (filecontext, lengthmeta, linecode) {
            var ilength = linecode.length;
            var lnum = 0;
            var pos = 0;
            while (true) {
                var _pos = filecontext.indexOf("\n", pos);
                if (_pos == -1) {
                    //未找到
                    pos = _pos + 1;
                    return -1;
                }
                if (_pos - pos == ilength) {
                    //判断起点是否在作用域范围
                    for (var i = 0; i < lengthmeta.length; i++) {
                        if (_pos >= lengthmeta[i].b && _pos <= lengthmeta[i].e) {
                            //在作用域范围
                            var _line = filecontext.substring(pos, _pos);
                            if (_line == linecode) {
                                return lnum;
                            }
                        }
                    }
                }
                pos = _pos + 1;
                lnum++;
            }
        };
        _this.getRealFileId = function (findclass) {
            var file_id = findclass.file_id;
            if (findclass.type == TypeEnum.FUNCTION) {
                var extJson = JSON.parse(findclass.extdata);
                if (extJson.length >= 0
                    && extJson[0].a
                    && extJson[0].a > -1) {
                    file_id = extJson[0].a;
                }
            }
            return file_id;
        };
        //Store.getInstace(dbfile);
        _this.basepath = basepath;
        _this.extpath = extpath;
        return _this;
    }
    //获取字符串中指定字符的个数
    Definition.prototype._getCharCountInStr = function (str, beginpos, endpos, charset) {
        var result = 0;
        for (var i = beginpos; i < str.length && i < endpos; i++) {
            if (charset == str[i]) {
                result++;
            }
        }
        return result;
    };
    ;
    return Definition;
}(Completion));
;
module.exports = {
    Definition: Definition
};
