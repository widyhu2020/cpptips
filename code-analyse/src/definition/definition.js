/* --------------------------------------------------------------------------------------------
 * definition.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 * 
 * ------------------------------------------------------------------------------------------ */

const TypeEnum = require('../analyse/analyseCpp').TypeEnum;
const KeyWordStore = require('../store/store').KeyWordStore;
const FileIndexStore = require('../store/store').FileIndexStore;
const Completion = require('../completion/completion').Completion;
const DefineMap = require('../definition/defineMap').DefineMap;
const fs = require('fs');
const path = require('path');
const logger = require('log4js').getLogger("cpptips");

class Definition extends Completion{
    constructor(basepath, extpath) {
        super();
        //Store.getInstace(dbfile);
        this.basepath = basepath;
        this.extpath = extpath;   
    }

    //获取非类成员方法或者静态方法定义
    getFunctionDefineInfo = function (name, namespaces) {
        let kws = KeyWordStore.getInstace();
        
        let _pos = name.lastIndexOf("::");
        if (_pos != -1) {
            let _name = name.substring(_pos + 2);
            let _namespace = name.substring(0, _pos);
            //1.判断是否为类的静态变量
            let findclass = kws.getByOwnNameAndName([_namespace], _name, namespaces);
            if (!findclass || findclass.length <= 0) {
                //2.命名空间下的方法
                findclass = kws.getByFullnameAndType('', _namespace, _name, TypeEnum.FUNCTION)
                if(!findclass) {
                    //可能是静态类下的静态变量
                    let _prepos = name.lastIndexOf("::", _pos - 1);
                    let _ownname = "";
                    if(_prepos == -1) {
                        _ownname = _namespace;
                    } else {
                        _ownname = name.substring(_prepos + 2, _pos);
                    }
                    let _snamespace = name.substring(0, _prepos);
                    findclass = kws.getByFullnameAndType(_ownname, _snamespace, _name, TypeEnum.FUNCTION)
                    if(!findclass) {
                        //可能命名空间切分到了using namspace和方法名前面
                        for(let i = 0; i < namespaces.length; i++) {
                            let ns = namespaces[i];
                            if(ns != "") {
                                ns = ns + "::" + _namespace;
                                namespaces[i] = ns;
                            }
                        }
                        let lists = kws.getByFullnameNssAndType('', namespaces, _name, TypeEnum.FUNCTION);
                        if(lists.length <= 0) {
                            return false;
                        }
                        findclass = lists[0];
                    }
                }
            } else {
                findclass = findclass[0];
            }
            if (!findclass) {
                return false;
            }

            let file_id = this.getRealFileId(findclass);
            let sourcefilepath = this.getFileInfo(file_id);
            let filepath = this.getFileInfo(findclass.file_id);
            return this.readFileFindDefine(filepath, findclass.ownname, findclass.name, findclass.type, sourcefilepath);
        } else {
            //没有命名空间的，需要找到全名称
            let findclass = kws.getByNameAndNamespaces(name, namespaces);
            if (findclass.length <= 0) {
                //没有找到父类
                return false;
            }
            for (let i = 0; i < findclass.length; i++) {
                if (findclass[i].type != TypeEnum.FUNCTION) {
                    //不是类的定义
                    continue;
                }
                let file_id = this.getRealFileId(findclass);
                let sourcefilepath = this.getFileInfo(file_id);
                let filepath = this.getFileInfo(findclass.file_id);
                return this.readFileFindDefine(filepath, findclass[i].ownname, findclass[i].name, findclass[i].type, sourcefilepath);
            }
        }
        return false;
    };

    _getDirsMatching = function(fileA, fileB) {
        let pathInfoA = fileA.split(/[\\/]{1,2}/);
        let pathInfoB = fileB.split(/[\\/]{1,2}/);

        let match = 0;
        for(let i = 0; i < pathInfoA.length && i < pathInfoB.length; i++) {
            if(pathInfoA[i] == pathInfoB[i]) {
                //匹配度+1
                match++;
            }
        }
        return match;
    };

    //获取头文件信息
    getIncludeInfo = function(sourceFile, includeFile, fileName) {
        let fdb = FileIndexStore.getInstace();

        let match = -1;
        let findIncludeFile = "";
        console.time("getFileByFileName");
        let fileList = fdb.getFileByFileName(fileName);
        console.timeEnd("getFileByFileName");
        //logger.debug(fileList);
        for(let i = 0; i < fileList.length; i++) {
            let filePath = fileList[i];
            let _pos = filePath.filepath.indexOf(includeFile);
            if(_pos != -1) {
                //匹配规则
                let _match = this._getDirsMatching(filePath.filepath, sourceFile);
                if(_match > match) {
                    findIncludeFile = filePath.filepath;
                }
            }
        }
        return findIncludeFile;
    };

    //获取类的全名称
    getClassDefineInfo = function (name, namespaces) {
        let kws = KeyWordStore.getInstace();

        let findclass = [];
        let ret = DefineMap.getInstace().getRealName(name);
        //let _pos = name.lastIndexOf("::");
        if (ret && ret.namespace != "") {
            let _name = ret.name;
            let _namespace = ret.namespace;
            findclass = kws.getByNameAndNamespaces(_name, [_namespace])
        } else {
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
            let extData = JSON.parse(findclass[0].extdata);
            return this.getClassDefineInfo(extData.v, namespaces);
        }

        //只处理第一个，如果有多个这里忽略除一个以外的
        for (let i = 0; i < findclass.length; i++) {
            //如果是枚举值
            if (findclass[i].type == TypeEnum.ENUMITEM
                && i == findclass.length - 1) {
                //找到最后一个，还是枚举，则返回枚举
                let fullnames = [];
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

            let retinherit = [];
            let inherit = JSON.parse(findclass[i].extdata);
            for (let i = 0; i < inherit.i.length; i++) {
                let inheritclass = inherit.i[i];
                let classname = inheritclass.n;
                retinherit.push(classname); 
            }
            let fullname = findclass[i].name;
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
    getDefineInWitchClass = function (ownnames, name, namespaces) {
        let _owns = {};
        let _namespace = namespaces;
        for (let i = 0; i < ownnames.length; i++) {
            let _own = ownnames[i];
            let ret = DefineMap.getInstace().getRealName(_own);
            if(!ret) {
                continue;
            }
            let _tmpown = ret.name;
            let _usingnamespace = ret.namespace;
            _owns[_tmpown] = _usingnamespace;
            _namespace.push(_usingnamespace);
        }

        //通过归属和名称查找定义对象
        let definemap = {};
        let findName = Object.keys(_owns);
        let list = KeyWordStore.getInstace().getByOwnNameAndName(findName, name, namespaces);
        for(let i = 0; i < list.length; i++) {
            let info = list[i];
            definemap[info.ownname] = info;
        }

        //主类放最前面
        for (let i = 0; i < findName.length; i++) {
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
    findFullNameDefine = function (fullname) {
        let name = fullname;
        let ownname = "";
        let namespace = "";
        let _pos = fullname.lastIndexOf("::");
        if (_pos != -1) {
            //已经包含命名空间，直接返回
            name = fullname.substring(_pos + 2);
            namespace = fullname.substring(0, _pos);
        }

        //获取定义详情
        let types = [TypeEnum.CALSS, TypeEnum.STRUCT, TypeEnum.FUNCTION];
        let infos = KeyWordStore.getInstace().getByFullname(ownname, namespace, name, types);
        if(!infos || infos.length <= 0) {
            //查找失败
            return false;
        }
        let info = infos[0];
        let file_id = this.getRealFileId(info);
        let sourcefilepath = this.getFileInfo(file_id);
        let filepath = this.getFileInfo(info.file_id);
        if (!filepath) {
            //未找到文件登记
            return false;
        }

        return this.readFileFindDefine(filepath, name, '', info.type, sourcefilepath);
    };

    //通过文件相对全称获取文件全名
    getFileInfoByFullName = function (filepath) {
        let info = FileIndexStore.getInstace().getFileByFilePath(filepath);
        if (info == false) {
            //可能是本地cpp文件，这种不需要入库
            return this.basepath + filepath;
        }

        if (info.systeminclude == 1) {
            //系统目录
            let fileallpath = this.extpath + path.sep + "data" + info.filepath;
            logger.info("filepath:", fileallpath);
            return fileallpath;
        }
        let fileallpath = this.basepath + info.filepath;
        logger.info("filepath:", fileallpath);
        return fileallpath;
    };

    //通过文件id获取文件名称（相对路径）
    getFileInfo = function(file_id) {
        let info = FileIndexStore.getInstace().getFileById(file_id);
        if(info == false) {
            return false;
        }
        
        if (info.systeminclude == 1) {
            //系统目录
            let fileallpath = this.extpath + path.sep + "data" + info.filepath;
            logger.info("filepath:", fileallpath);
            return fileallpath;
        }
        let fileallpath = this.basepath + info.filepath;
        logger.info("filepath:", fileallpath);
        return fileallpath;
    };

    //读取文件查找内容
    readFileFindDefine = function (filepath, ownname, name, type, sourcefilepath = '') {
        ownname = ownname.trim();
        name = name.trim();

        if(!fs.existsSync(filepath)){
            //文件不存在
            return false;
        }

        //写入文件索引
        let fd = fs.openSync(filepath, 'r');
        const buffer = Buffer.alloc(1024 * 1024 * 2);
        let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
        fs.closeSync(fd);
        let filecontext = buffer.toString('utf8', 0, bytesRead);

        let lineinfo = {};
        let linecode = "";
        let prelinecode = "";
        let bpos = 0;
        let epos = 0;
        let ownpos = 0;
        let namepos = 0;
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
                if(/[.]{1,1}proto$/g.test(filepath)) {
                    //如果是proto定义，尝试重新查
                    //这里有优化空间，_后面的不一定将是message的名称，且可能多个message都定义了相同的内部message，导致调整不准确
                    let _pos = ownname.lastIndexOf("_");
                    if(_pos == -1) {
                        return false;
                    }
                    ownname = ownname.substring(_pos + 1);
                    ownpos = this._findValInStr(filecontext, ownname, 0);
                    if(_pos == -1) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            //从定义开始的位置开始找name的定义
            //proto文件才需这样处理
            namepos = this._findValInStr(filecontext, name, ownpos)
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

        let result = {
            filename: "file://" + filepath,
            bline: lineinfo.l,
            bcols: bpos,
            eline: lineinfo.l,
            ecols: epos,
            linecode: linecode,
            prelinecode: this._getHoverTips(filecontext, ownpos, namepos, ownname, name, filepath),
            title: name != "" ? name : ownname
        };
        if(filepath.indexOf('/') != 0) {
            result.filename = "file:///" + filepath;
        }

        //修正函数的实现定义
        if(sourcefilepath != ""
            && filepath != sourcefilepath) {
            this._readFileFindAchieveFromCpp(result, sourcefilepath, ownname, name, type);
        }

        return result;
    };

    //从源文件中找出实现
    _readFileFindAchieveFromCpp = function(result, sourcefilepath, ownname, name, type) {
        if(!fs.existsSync(sourcefilepath)){
            //文件不存在
            logger.debug("file not exits:",sourcefilepath);
            return false;
        }

        if(type == TypeEnum.FUNCTION) {
            let _nameReg = "[\\s\\t]{1,2}" + ownname + "[\\s\\t]{0,10}::[\\s\\t]{0,10}" + name + "[\\s\\t]{0,10}\\(";
            let reg = new RegExp(_nameReg);
            let fd = fs.openSync(sourcefilepath, 'r');
            const buffer = Buffer.alloc(1024 * 1024 * 2);
            let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2);
            fs.closeSync(fd);
            let filecontext = buffer.toString('utf8', 0, bytesRead);

            let regResult = filecontext.match(reg);
            let namepos = regResult['index'];
            let _name = regResult[0];
            let lineinfo = this._getDefinePost(filecontext, namepos);
            let linecode = lineinfo.c;
            logger.debug("lineinfo:", lineinfo);
            // linecode = linecode.replace(/[\s\t]{0,10}::[\s\t]{0,10}/g, "::");
            let prelinecode = lineinfo.p;
            let bpos = linecode.indexOf(_name);
            let epos = bpos + _name.length - 1;

            result.filename = "file://" + sourcefilepath;
            if(sourcefilepath.indexOf('/') != 0) {
                result.filename = "file:///" + sourcefilepath;
            }
            result.bline = lineinfo.l;
            result.bcols = bpos;
            result.eline = lineinfo.l;
            result.ecols = epos;
            //logger.debug(result);
            return;
        }
        //logger.debug(type);
    };

    _findValInStr = function(source, val, bpos, issmall = false) {
        //全部转为小写查找
        
        while (true) {
            bpos = source.indexOf(val, bpos);
            if(bpos == -1) {
                if(!issmall) {
                    //如果找不到，可能需要大小写兼容
                    //全部转为小写尝试查找
                    source = source.toLowerCase();
                    return this._findValInStr(source, val, bpos, true);
                }
                return -1;
            }

            //判断是否在注释里面
            let notebegin = source.lastIndexOf("/*", bpos);
            let noteend = source.lastIndexOf("*/", bpos);
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

            let c = source[bpos - 1];
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
    _getDefinePost = function (filecontext, namepos) {
        let startpos = 0;
        let lines = 0;
        let lincode = "";
        let precode = "";
        while (true) {
            let pos = filecontext.indexOf("\n", startpos);
            if (pos == -1 
                || (namepos >= startpos && pos >= namepos)) {
                //找到行位置
                lincode = filecontext.substring(startpos, pos);
                let prepos = startpos - 300;
                if (prepos < 0) {
                    prepos = 0;
                }
                precode = filecontext.substring(prepos, startpos);
                break;
            }
            startpos = pos + 1;
            lines++;
        }

        return { l: lines, c: lincode, p: precode};
    };

    //获取鼠标停留展示文案
    _getHoverTips = function (filecontext, ownpos, namepos, ownname, name, filepath) {
        let ownlines = [];
        let namelines = [];
        let title = name == "" ? ownname : name;
        
        let hasnamedata = false;
        if (ownname != "") {
            let lineend = filecontext.indexOf("\n", ownpos);
            let spos = lineend - 200 < 0 ? 0 : lineend - 200;
            let owncontext = filecontext.substring(spos, lineend);
            let lines = owncontext.split("\n");
            ownlines.push(lines[lines.length - 1]);
            for(let i = lines.length - 2; i > 0; i--) {
                let line = lines[i];
                if (line == "" 
                    || /^[\s\t\n]{0,10}[/]{1,1}|^[*]{1,1}/g.test(line)) {
                    ownlines.push(line);
                    continue;
                }
                break;
            }

            //弹出无用的行
            while(true) {
                if (ownlines[ownlines.length - 1] == "") {
                    ownlines.pop();
                }
                break;
            }
            ownlines = ownlines.reverse();
            //接下来一行如果是{则也加入
            spos = filecontext.indexOf("\n", lineend + 1);
            let _tmp = filecontext.substring(lineend + 1, spos);
            if(_tmp.trim() == "{") {
                ownlines.push(_tmp);
            }

            let pos = filecontext.indexOf("}", ownpos);
            let icount = this._getCharCountInStr(filecontext, ownpos, pos, '\n');
            if (icount < 12) {
                //onwname定义行数比较少
                let beginpos = filecontext.indexOf("\n", ownpos);
                let namedata = filecontext.substring(beginpos + 1, pos + 1);
                namelines.push(namedata);
                hasnamedata = true;
            } 
        }

        if (ownpos > 0 && namepos > 0 && !hasnamedata) {
            let icount = this._getCharCountInStr(filecontext, ownpos, namepos, '\n');
            if (icount < 2) {
                let namedata = "";
                let bbeginpos = filecontext.indexOf('\n', namepos);
                let abeginpos = filecontext.indexOf('\n', ownpos);
                let beforedata = filecontext.substring(bbeginpos, abeginpos);
                namedata = beforedata;

                //往后找4行
                let i = 2;
                let pos = bbeginpos;
                while(i--) {
                    pos = filecontext.indexOf('\n', pos + 1);
                    if(pos == -1) {
                        break;
                    }
                }
                let tmpdata = filecontext.substring(bbeginpos, pos);
                let _pos = tmpdata.indexOf('}')
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
            let namedata = "";
            let abeginpos = filecontext.indexOf('\n', namepos);
            let i = 2;
            let pos = abeginpos;
            while (i--) {
                pos = filecontext.lastIndexOf('\n', pos - 1);
                if (pos == -1) {
                    break;
                }
            }

            let tmpdata = filecontext.substring(pos + 1, abeginpos);
            let _pos = tmpdata.indexOf('{')
            if (_pos != -1 && ownname != "") {
                tmpdata = tmpdata.substring(_pos + 1);
            } else {
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
            _pos = tmpdata.indexOf('}')
            if (_pos != -1) {
                tmpdata = tmpdata.substring(0, _pos + 1);
            }
            namedata = namedata + tmpdata;
            namelines.push(namedata);
        }

        let showinfo = [];
        showinfo.push("#### " + title);
        showinfo.push("```cpp");
        showinfo = showinfo.concat(ownlines);
        showinfo = showinfo.concat(namelines);
        showinfo.push("```");
        showinfo.push("文件:" + filepath);
        return showinfo.join('\n');
    };

    _findLineNumWithCode = function (filecontext, lengthmeta, linecode) {
        let ilength = linecode.length;
        let lnum = 0;
        let pos = 0;
        while (true) {
            let _pos = filecontext.indexOf("\n", pos);

            if (_pos == -1) {
                //未找到
                pos = _pos + 1;
                return -1;
            }
            if (_pos - pos == ilength) {
                //判断起点是否在作用域范围
                for (let i = 0; i < lengthmeta.length; i++) {
                    if (_pos >= lengthmeta[i].b && _pos <= lengthmeta[i].e) {
                        //在作用域范围
                        let _line = filecontext.substring(pos, _pos);
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

    getRealFileId = function(findclass) {
        let file_id = findclass.file_id;
        if (findclass.type == TypeEnum.FUNCTION) {
            let extJson = JSON.parse(findclass.extdata);
            if (extJson.length >= 0
                && extJson[0].a
                && extJson[0].a > -1) {
                file_id = extJson[0].a;
            }
        }
        return file_id;
    }

    //获取字符串中指定字符的个数
    _getCharCountInStr(str, beginpos, endpos, charset) {
        let result = 0;
        for (let i = beginpos; i < str.length && i < endpos; i++) {
            if (charset == str[i]) {
                result++;
            }
        }
        return result;
    };
};

module.exports = {
    Definition
};