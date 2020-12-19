var FileType = require('../store/store').FileType;
var logger = require('log4js').getLogger("cpptips");
var Filetype = /** @class */ (function () {
    function Filetype() {
        //判断文件类型：返回1为头文件；2为源文件，其他无需处理
        this.judgeFileType = function (filepath) {
            var pos = filepath.lastIndexOf(".");
            if (pos == -1) {
                //文件名称不以后缀结尾
                return FileType.OTHER_FILE;
            }
            var ext = filepath.substr(pos);
            if (!this.includeExt.has(ext) && !this.sourceExt.has(ext)) {
                //不符合条件的文件
                return FileType.OTHER_FILE;
            }
            if (this.includeExt.has(ext) || this._checkIsSystem(filepath)) {
                //usr下所有的文件全部当头文件处理
                if (ext == ".tcc") {
                    //.tcc文件不要处理
                    return FileType.OTHER_FILE;
                }
                if (ext == ".proto") {
                    return FileType.PROTOBUF_FILE;
                }
                return FileType.INCLUDE_FILE;
            }
            if (this.sourceExt.has(ext)) {
                return FileType.SOURCE_FILE;
            }
            return FileType.OTHER_FILE;
        };
        //判断是否系统库函数
        this._checkIsSystem = function (filepath) {
            // /usr/local/
            // /google/protobuf/
            if (filepath.indexOf("/.vscode/") != -1 || filepath.indexOf("\\.vscode\\") != -1
                || filepath.indexOf("/usr/local/") != -1 || filepath.indexOf("\\usr\\local\\") != -1
                || filepath.indexOf("/usr/include/") != -1 || filepath.indexOf("\\usr\\include\\") != -1
                || filepath.indexOf("/google/protobuf/") != -1 || filepath.indexOf("\\google\\protobuf\\") != -1
                || /.*\.tcc$/g.test(filepath)) {
                //如果不是usr系统目录
                //protobuf库里面已经加载过，这里直接pass
                return true;
            }
            return false;
        };
        this.includeExt = new Set(['.h', '.hpp', ".proto"]);
        this.sourceExt = new Set(['.c', '.cc', '.cpp']);
    }
    ;
    return Filetype;
}());
;
module.exports = {
    Filetype: Filetype
};
