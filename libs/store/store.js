/* --------------------------------------------------------------------------------------------
 * store.js
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 *
 * ------------------------------------------------------------------------------------------ */
var NativeForTestValid = require('./makeNativeModel');
var Database = require('better-sqlite3');
var os = require('os');
var KeyWordStore = /** @class */ (function () {
    function KeyWordStore() {
        this.connect = function (dbname, showsql, memorydb) {
            if (showsql === void 0) { showsql = 0; }
            if (memorydb === void 0) { memorydb = 0; }
            if (this.db != null) {
                //之前有过链接
                return this;
            }
            this.dbname = dbname;
            var options = { verbose: console.log, fileMustExist: false };
            if (showsql == 0) {
                options = {};
            }
            if (memorydb == 1) {
                //内存db
                options.memory = true;
            }
            console.info("databasepath:", this.dbname);
            this.db = new Database(this.dbname, options);
            this.initKeyWordTable();
            return this;
        };
        this.closeconnect = function () {
            if (this.db == null) {
                //之前有过链接
                return true;
            }
            this.db.close();
            this.db = null;
        };
        //创建并初始化关键字索引表
        this.initKeyWordTable = function () {
            var row = this.db.prepare('SELECT count(*) as total FROM sqlite_master WHERE name=? and type=\'table\'').get('t_keyword');
            if (row.total == 0) {
                console.error("not find t_keyword, create table now");
                //创建表/索引
                var createtable = this.db.prepare('CREATE TABLE t_keyword(\
                    id INTEGER PRIMARY KEY AUTOINCREMENT,\
                    ownname  TEXT NOT NULL,\
                    name      TEXT NOT NULL,\
                    namespace TEXT NOT NULL,\
                    type      INTEGER  DEFAULT 0,\
                    permission INTEGER DEFAULT 0,\
                    namelength INTEGER DEFAULT 0,\
                    file_id   INTEGER NOT NULL,\
                    extdata    TEXT DEFAULT \"\"\
                );').run();
                var createu_index_fullname = this.db.prepare('CREATE UNIQUE INDEX u_index_fullname ON t_keyword(ownname, namespace, name, type)').run();
                var createu_i_index_ownname = this.db.prepare('CREATE INDEX i_index_ownname ON t_keyword(ownname)').run();
                var createu_i_index_name = this.db.prepare('CREATE INDEX i_index_name ON t_keyword(name)').run();
                var createu_i_index_namespace = this.db.prepare('CREATE INDEX i_index_namespace ON t_keyword(namespace)').run();
                var createu_i_index_file_id = this.db.prepare('CREATE INDEX i_index_file_id ON t_keyword(file_id)').run();
                var createu_i_index_type = this.db.prepare('CREATE INDEX i_index_type ON t_keyword(type)').run();
                var createu_i_namelength = this.db.prepare('CREATE INDEX i_namelength ON t_keyword(namelength)').run();
                //https://www.sqlite.org/pragma.html
                //启动wal模式
                //this.db.pragma('encoding = UTF-8');
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('auto_vacuum = 1'); //删除数据时整理文件大小
                this.db.pragma('synchronous = 0'); //不怕丢数据，要快
            }
            this.db.pragma('cache_size = 100000'); //100000*1.5k
            return;
        };
        this.close = function () {
            this.db.close();
        };
        this.insert = function (data) {
            try {
                return this._insert(data);
            }
            catch (erryr) {
                this.db.err;
                console.error(erryr);
                return false;
            }
        };
        //插入数据
        this._insert = function (data) {
            //入参数判断
            if (data['ownname'] === undefined || data['name'] === undefined
                || data['namespace'] === undefined || data['type'] === undefined
                || data['file_id'] === undefined || data['extdata'] === undefined
                || data['permission'] === undefined) {
                console.error("input data error!", data);
                return false;
            }
            data['namelength'] = data['name'].length;
            //查看db是否已经存在
            var info = this.getByFullnameAndType(data['ownname'], data['namespace'], data['name'], data['type']);
            if (info) {
                //console.error("data is in db!", info);
                //更新附加数据
                if (info.extdata != data['extdata']) {
                    if (!this.modifyExdata(info.id, data['extdata'])) {
                        console.error("modifyExdata faild!", info.id, data['extdata']);
                        return false;
                    }
                }
                //更新权限
                if (info.permission != data['permission']) {
                    if (!this.modifyPermission(info.id, data['permission'])) {
                        console.error("modifyPermission faild!", info.id, data['permission']);
                        return false;
                    }
                }
                //修改类型
                if (info.type != data['type']) {
                    if (!this.modifyType(info.id, data['type'])) {
                        console.error("modifyType faild!", info.id, data['type']);
                        return false;
                    }
                }
                return true;
            }
            try {
                var stmt = this.db.prepare('INSERT INTO t_keyword (ownname, name, namespace, type, permission, namelength, file_id, extdata) \
                VALUES (@ownname, @name, @namespace, @type, @permission, @namelength, @file_id, @extdata)');
                var info_1 = stmt.run(data);
                //console.log(info);
                return info_1.changes == 1;
            }
            catch (error) {
                console.log("insert faild", error);
                return false;
            }
        };
        //修改命名空间
        this.modifyNamespace = function (id, namespace) {
            var stmt = this.db.prepare('UPDATE t_keyword  SET namespace=? WHERE id=?');
            var info = stmt.run(namespace, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改文件id
        this.modifyFileId = function (id, file_id) {
            var stmt = this.db.prepare('UPDATE t_keyword  SET file_id=? WHERE id=?');
            var info = stmt.run(file_id, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改扩展数据
        this.modifyExdata = function (id, extdata) {
            var stmt = this.db.prepare('UPDATE t_keyword  SET extdata=? WHERE id=?');
            var info = stmt.run(extdata, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改对外权限
        this.modifyPermission = function (id, permission) {
            var stmt = this.db.prepare('UPDATE t_keyword  SET permission=? WHERE id=?');
            var info = stmt.run(permission, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改类型
        this.modifyType = function (id, type) {
            var stmt = this.db.prepare('UPDATE t_keyword  SET type=? WHERE id=?');
            var info = stmt.run(type, id);
            //console.log(info);
            return info.changes == 1;
        };
        //删除数据
        this.delete = function (id) {
            var stmt = this.db.prepare('DELETE FROM t_keyword WHERE id=? LIMIT 0,1');
            var info = stmt.run(id);
            console.log(info);
            return info.changes == 1;
        };
        //批量删除数据
        this.deleteByIds = function (ids) {
            if (ids.length <= 0) {
                //没有输入ids，直接成功
                return true;
            }
            var sqlids = ids.join(',');
            var stmt = this.db.prepare('DELETE FROM t_keyword WHERE id IN (' + sqlids + ')');
            var info = stmt.run();
            //console.log(info);
            return info.changes == 1;
        };
        //通过文件id删除数据
        this.deleteByFileId = function (file_id) {
            var stmt = this.db.prepare('DELETE FROM t_keyword WHERE file_id=?');
            var info = stmt.run(file_id);
            console.log(info);
            return info.changes == 1;
        };
        //通过文件id获取所有的定义
        this.getAllByFileId = function (file_id) {
            var stmt = this.db.prepare('SELECT id, ownname, name, namespace, type, permission, file_id, extdata FROM t_keyword WHERE file_id=?');
            var infos = stmt.all(file_id);
            //console.log(infos);
            if (!infos || infos == undefined) {
                //未查询到结果
                console.error("not find result. namespace:", namespace);
                return [];
            }
            return infos;
        };
        //指定命名空间下查找
        this.findByNamespace = function (namespace) {
            var stmt = this.db.prepare('SELECT id, ownname, name, namespace, type, permission, file_id, extdata FROM t_keyword WHERE namespace=?');
            var infos = stmt.all(namespace);
            console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                console.error("not find result. namespace:", namespace);
                return [];
            }
            return infos;
        };
        //前缀匹配搜索
        this.freezFindByPreKeyword = function (keyword, namepsaces, ownname, maxlength, permission, types) {
            if (permission === void 0) { permission = []; }
            if (types === void 0) { types = []; }
            if (types.length == 0) {
                types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            }
            if (permission.length == 0) {
                permission = [0, 1, 2];
            }
            var sqlpermission = permission.join(",");
            var sqltype = types.join(",");
            var sqlnamespace = namepsaces.join("','");
            //非函数和变量
            //只查找公共的定向
            //全局的变量和方法
            // let _keyword = keyword;
            // let intype = "6,7,9";
            // freezquer = "GLOB \'" + _keyword + '*\'';
            var _keyword = keyword.replace('_', '/_');
            var freezquer = "LIKE \'" + _keyword + '%\' escape \'/\'';
            var sql = 'SELECT id, ownname, name, namespace,  type, permission, file_id, extdata \
                    FROM t_keyword \
                    WHERE \
                        name ' + freezquer + ' \
                        AND namespace in (\'' + sqlnamespace + '\') \
                        AND ownname=\'' + ownname + '\' \
                        AND namelength < ' + maxlength + ' \
                        AND permission IN (' + sqlpermission + ') \
                        AND type IN (' + sqltype + ')';
            //console.log(sql);
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", keyword, namepsaces);
                return [];
            }
            return infos;
        };
        //前缀匹配搜索
        this.freezFindAllByPreKeyword = function (keyword, namepsaces, ownname, maxlength) {
            var sqlnamespace = namepsaces.join("','");
            //非函数和变量
            //只查找公共的定向
            //全局的变量和方法
            var _keyword = keyword.replace('_', '/_');
            var freezquer = "LIKE \'" + _keyword + '%\' escape \'/\'';
            var sql = 'SELECT id, ownname, name, namespace,  type, permission, file_id, extdata \
                    FROM t_keyword \
                    WHERE \
                        name ' + freezquer + ' \
                        AND (\
                                ( \
                                    namespace=\'\' \
                                    AND ownname=\'\' \
                                    AND namelength < ' + maxlength + '\
                                    AND name NOT GLOB \'_*\' \
                                    AND type IN (1,2,3,4,6,7,8,10)\
                                ) OR \
                                (\
                                    namespace in (\'' + sqlnamespace + '\') \
                                    AND ownname=\'\' \
                                    AND namelength < ' + maxlength + '\
                                    AND type IN (1,2,3,4,6,7,8)\
                                ) OR \
                                (\
                                    namespace in (\'' + sqlnamespace + '\') \
                                    AND ownname=\'' + ownname + '\' \
                                    AND type IN (7,8)\
                                ) OR\
                                (\
                                   namespace in (\'' + sqlnamespace + '\') \
                                   AND namelength < ' + maxlength + '\
                                   AND type IN (9)\
                                )\
                            ) ORDER BY namelength ASC,type ASC LIMIT 0,20';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            //console.log(sql);
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", keyword, namepsaces);
                return [];
            }
            return infos;
        };
        //从命名空间中匹配own
        this.freezGetByNameAndNamespaces = function (name, namespaces, maxlength) {
            var sqlnamespace = namespaces.join("','");
            var freezquer = "LIKE \'" + name + '%\' escape \'/\'';
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                            FROM t_keyword \
                                WHERE \
                                name ' + freezquer + ' \
                                AND namelength < ' + maxlength + '\
                                AND type IN (1,2,3,4,9)\
                                AND namespace in (\'' + sqlnamespace + '\')';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //前缀匹配搜索-区分大小写
        this.freezFindByPreKeywordCase = function (keyword, namepsaces, ownname, maxlength, permission, types) {
            if (permission === void 0) { permission = []; }
            if (types === void 0) { types = []; }
            if (types.length == 0) {
                types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            }
            if (permission.length == 0) {
                permission = [0, 1, 2];
            }
            var sqlpermission = permission.join(",");
            var sqltype = types.join(",");
            var sqlnamespace = namepsaces.join("','");
            //非函数和变量
            //只查找公共的定向
            //全局的变量和方法
            var _keyword = keyword;
            var freezquer = "GLOB \'" + _keyword + '*\'';
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                    FROM t_keyword \
                    WHERE \
                        name ' + freezquer + ' \
                        AND namelength < ' + maxlength + ' \
                        AND namespace IN (\'' + sqlnamespace + '\') \
                        AND ownname=\'' + ownname + '\' \
                        AND permission IN (' + sqlpermission + ') \
                        AND type IN (' + sqltype + ') \
                        LIMIT 0,10';
            //console.log(sql);
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", keyword, namepsaces);
                return [];
            }
            return infos;
        };
        //前缀匹配搜索-区分大小写
        this.freezFindByPreKeywordnOnOwnCase = function (keyword, namepsaces, maxlength, permission, types) {
            if (permission === void 0) { permission = []; }
            if (types === void 0) { types = []; }
            if (types.length == 0) {
                types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            }
            if (permission.length == 0) {
                permission = [0, 1, 2];
            }
            var sqlpermission = permission.join(",");
            var sqltype = types.join(",");
            var sqlnamespace = namepsaces.join("','");
            //非函数和变量
            //只查找公共的定向
            //全局的变量和方法
            var _keyword = keyword;
            var freezquer = "GLOB \'" + _keyword + '*\'';
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                    FROM t_keyword \
                    WHERE \
                        name ' + freezquer + ' \
                        AND namelength < ' + maxlength + ' \
                        AND namespace IN (\'' + sqlnamespace + '\') \
                        AND permission IN (' + sqlpermission + ') \
                        AND type IN (' + sqltype + ') \
                        LIMIT 0,10';
            //console.log(sql);
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", keyword, namepsaces);
                return [];
            }
            return infos;
        };
        //通过全名获取
        this.getByOwnName = function (ownname, namespace, permission) {
            if (permission === void 0) { permission = []; }
            var sqlpermission = "";
            if (permission.length <= 0) {
                permission = [0, 1, 2];
            }
            sqlpermission = permission.join(",");
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname=? \
                                    AND namespace=? \
                                    AND permission IN (' + permission + ')';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all(ownname, namespace);
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //通过全名获取,不能_开头，用于使用在标准头文件中通过_来决定内部方法变量等等
        this.getByOwnNameNotStart_ = function (ownname, namespace, permission) {
            if (permission === void 0) { permission = []; }
            var sqlpermission = "";
            if (permission.length <= 0) {
                permission = [0, 1, 2];
            }
            sqlpermission = permission.join(",");
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname=? \
                                    AND namespace=? \
                                    AND name NOT GLOB \'_*\' \
                                    AND permission IN (' + permission + ')';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all(ownname, namespace);
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //通过名称和owner获取
        this.getByOwnNameAndName = function (ownnames, name, namespaces) {
            var owns = ownnames.join('\',\'');
            var sqlnamespace = namespaces.join("','");
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname IN (\'' + owns + '\') \
                                        AND name=\'' + name + '\' \
                                        AND namespace in (\'' + sqlnamespace + '\')';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //从命名空间中查找own
        this.getByNameAndNamespaces = function (name, namespaces) {
            var sqlnamespace = namespaces.join("','");
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                            FROM t_keyword \
                                WHERE name=? \
                                AND namespace in (\'' + sqlnamespace + '\')';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all(name);
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //通过全名获取(无类型)
        this.getByFullname = function (ownname, namespace, name, types) {
            if (types === void 0) { types = []; }
            if (types.length == 0) {
                //如果没有填类型，则查找所有类型
                types = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            }
            var strtypes = types.join(',');
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname=? \
                                    AND namespace=? \
                                    AND name=? \
                                    AND type IN (' + strtypes + ') LIMIT 0,100';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all(ownname, namespace, name);
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return [];
            }
            return infos;
        };
        //通过全名获取
        this.getByFullnameAndType = function (ownname, namespace, name, type) {
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname=? \
                                    AND namespace=? \
                                    AND name=? \
                                    AND type=? LIMIT 0,1';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all(ownname, namespace, name, type);
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return false;
            }
            return infos[0];
        };
        //通过全名获取
        this.getByFullnameNssAndType = function (ownname, namespaces, name, type) {
            var sqlnamespace = namespaces.join("','");
            var sql = 'SELECT id, ownname, name, namespace, type, permission, file_id, extdata \
                                FROM t_keyword \
                                    WHERE ownname= \'' + ownname + '\' \
                                    AND namespace in (\'' + sqlnamespace + '\') \
                                    AND name= \'' + name + '\' \
                                    AND type= ' + type + ' LIMIT 0,1';
            sql = sql.replace(/[\t\s]{1,100}/g, " ");
            var stmt = this.db.prepare(sql);
            var infos = stmt.all();
            //console.log(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. namespace:", ownname, namespace, name);
                return false;
            }
            return infos;
        };
        console.info("KeyWordStore in constructor");
        this.dbname = "";
        this.db = null;
    }
    //单例方法
    KeyWordStore.getInstace = function () {
        if (!KeyWordStore.instance) {
            KeyWordStore.instance = new KeyWordStore();
        }
        return KeyWordStore.instance;
    };
    ;
    ;
    return KeyWordStore;
}());
;
var FileType = {
    INCLUDE_FILE: 0,
    PROTOBUF_FILE: 1,
    SOURCE_FILE: 2,
    OTHER_FILE: 3
};
var FileState = {
    NEED_UPDATE_FILE: 0,
    PROCESSED_FILE: 1
};
var FileIndexStore = /** @class */ (function () {
    function FileIndexStore() {
        this.islive = function () {
            return this.db != null;
        };
        this.connect = function (dbname, showsql, memorydb) {
            if (showsql === void 0) { showsql = 0; }
            if (memorydb === void 0) { memorydb = 0; }
            if (this.db != null) {
                //之前有过链接
                return this;
            }
            this.dbname = dbname;
            var options = { verbose: console.log, fileMustExist: false };
            if (showsql == 0) {
                options = {};
            }
            if (memorydb == 1) {
                //内存db
                options.memory = true;
            }
            this.db = new Database(this.dbname, options);
            this.initKeyWordFileIndex();
            return this;
        };
        //备份到指定库中，这里用于从存储的db上加载数据写入db中
        this.backup = function (dbname, showprogress) {
            this.db.backup(dbname, {
                progress: function (_a) {
                    var t = _a.totalPages, r = _a.remainingPages;
                    showprogress(t, r);
                }
            }).then(function () {
                //完成
                showprogress(0, 0);
            }).catch(function (err) {
                console.log('backup failed:', err);
            });
        };
        this.closeconnect = function () {
            if (this.db == null) {
                //之前有过链接
                return true;
            }
            this.db.close();
            this.db = null;
        };
        //设置当前为系统引用
        this.setSystemIncludePath = function (params) {
            this.system_include = 1;
        };
        //type定义：0头文件；1:proto文件；2:源文件
        //创建并初始化文件目录索引
        this.initKeyWordFileIndex = function () {
            var row = this.db.prepare('SELECT count(*) as total FROM sqlite_master WHERE name=? and type=\'table\'').get('t_fileindex');
            if (row.total == 0) {
                console.error("not find t_fileindex, create table now");
                //创建表/索引
                //filename为文件名称
                //filepath为文件相对路径全名，包括目录
                var createtable = this.db.prepare('CREATE TABLE t_fileindex(\
                    id INTEGER PRIMARY KEY AUTOINCREMENT,\
                    filename   TEXT NOT NULL,\
                    filepath   TEXT NOT NULL,\
                    md5        TEXT NOT NULL,\
                    updatetime INTEGER NOT NULL,\
                    type       INTEGER  DEFAULT 0,\
                    state      INTEGER  DEFAULT 0,\
                    systeminclude INTEGER DEFAULT 0,\
                    extdata    TEXT DEFAULT \"\"\
                );').run();
                var createu_i_filename = this.db.prepare('CREATE INDEX i_filename ON t_fileindex(filename)').run();
                var createu_u_i_filepath = this.db.prepare('CREATE UNIQUE INDEX u_i_filepath ON t_fileindex(filepath)').run();
                var createu_u_i_type_state = this.db.prepare('CREATE INDEX u_i_type_state ON t_fileindex(type, state)').run();
                //console.info(createtable, createu_i_filename, createu_u_i_filepath);
                //https://www.sqlite.org/pragma.html
                //this.db.pragma('encoding = UTF-8');
                this.db.pragma('journal_mode = WAL');
                this.db.pragma('auto_vacuum = 1'); //删除数据时整理文件大小
                this.db.pragma('synchronous = 0'); //不怕丢数据，要快
            }
            this.db.pragma('cache_size = 50000'); //50000*1.5k
            return;
        };
        this.close = function () {
            this.db.close();
        };
        //插入数据
        this.insert = function (data) {
            //入参数判断
            if (data['filepath'] === undefined || data['filename'] === undefined
                || data['md5'] === undefined || data['type'] === undefined
                || data['extdata'] === undefined || data['updatetime'] === undefined) {
                //console.error("input data error!", data);
                return false;
            }
            if (os.platform() == "win32"
                && data['filepath'].indexOf("\\") != -1) {
                //windows系统，需要规范化路径
                data['filepath'] = data['filepath'].replace("\\", "/");
            }
            //获取时间戳
            data['systeminclude'] = this.system_include;
            try {
                var stmt = this.db.prepare('INSERT INTO t_fileindex \
                (filepath, filename, md5, updatetime, type, systeminclude, state, extdata) \
                    VALUES \
                (@filepath, @filename, @md5, @updatetime, @type, @systeminclude, 1, @extdata)');
                var info = stmt.run(data);
                //console.log(info);
                return info.changes == 1;
            }
            catch (error) {
                console.log("insert faild", error);
                return false;
            }
        };
        //修改数据
        this.update = function (data) {
            //入参数判断
            if (data['id'] === undefined
                || data['md5'] === undefined || data['updatetime'] === undefined
                || data['extdata'] === undefined) {
                //console.error("input data error!", data);
                return false;
            }
            //获取时间戳
            data['systeminclude'] = this.system_include;
            try {
                var stmt = this.db.prepare('UPDATE t_fileindex SET \
                md5=@md5, \
                updatetime=@updatetime,\
                systeminclude=@systeminclude,\
                state=1,\
                extdata=@extdata \
            WHERE id=@id');
                var info = stmt.run(data);
                //console.log(info);
                return info.changes == 1;
            }
            catch (error) {
                console.log("update faild", error);
                return false;
            }
        };
        //修改文件md5值
        this.modifyMd5 = function (id, md5, time) {
            var stmt = this.db.prepare('UPDATE t_fileindex  SET md5=?,updatetime=? WHERE id=?');
            //let time = (new Date()).getTime();
            var info = stmt.run(md5, time, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改父目录文件id
        this.modifyFileName = function (id, filename) {
            //获取数据
            var fileinfo = this.getFileById(id);
            if (!fileinfo || fileinfo === undefined) {
                console.error("not find file id", id);
                return false;
            }
            var filepath = fileinfo.filepath.replace(fileinfo.filename, filename);
            var stmt = this.db.prepare('UPDATE t_fileindex  SET filename=?,filepath=? WHERE id=?');
            var info = stmt.run(filename, filepath, id);
            //console.log(info);
            return info.changes == 1;
        };
        //修改扩展数据
        this.modifyExtdata = function (id, extdata) {
            var stmt = this.db.prepare('UPDATE t_fileindex  SET extdata=? WHERE id=?');
            var info = stmt.run(extdata, id);
            //console.log(info);
            return info.changes == 1;
        };
        //删除数据
        this.delete = function (id) {
            var stmt = this.db.prepare('DELETE FROM t_fileindex WHERE id=?');
            var info = stmt.run(id);
            console.log(info);
            return info.changes == 1;
        };
        //删除数据
        this.deleteByFilename = function (filename) {
            var stmt = this.db.prepare('DELETE FROM t_fileindex WHERE filename=?');
            var info = stmt.run(filename);
            //console.log(info);
            return info.changes == 1;
        };
        //通过文件名称获取文件信息
        this.getFileByFileName = function (filename) {
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, systeminclude, extdata FROM t_fileindex WHERE filename=?');
            var infos = stmt.all(filename);
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. filename:", filename);
                return [];
            }
            //规范化路径
            for (var i = 0; i < infos.length; i++) {
                var fileinfos = infos[i];
                if (os.platform() == "win32"
                    && fileinfos.filepath.indexOf("\\") != -1) {
                    //windows系统，需要规范化路径
                    fileinfos.filepath = fileinfos.filepath.replace("\\", "/");
                    infos[i] = fileinfos;
                }
            }
            return infos;
        };
        //通过类型，状态获取总文件数
        //只需要非系统文件
        this.getFileTotalWhithType = function (types) {
            var sqltype = types.join(",");
            var stmt = this.db.prepare('SELECT COUNT(id) AS total FROM t_fileindex WHERE \
                    type IN (' + sqltype + ') \
                    AND systeminclude=0');
            var infos = stmt.all();
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                return 0;
            }
            return infos[0].total;
        };
        //通过类型，状态获取文件id
        this.getFilesWhithType = function (types, begin, end) {
            var sqltype = types.join(",");
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, state, systeminclude, extdata FROM t_fileindex WHERE \
                    type IN (' + sqltype + ')\
                    AND systeminclude=0 \
                    LIMIT ' + begin + "," + end);
            var infos = stmt.all();
            //console.info(infos);
            //console.info(begin, end);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. filepath:", filepath);
                return false;
            }
            //规范化路径
            for (var i = 0; i < infos.length; i++) {
                var fileinfos = infos[i];
                if (os.platform() == "win32"
                    && fileinfos.filepath.indexOf("\\") != -1) {
                    //windows系统，需要规范化路径
                    fileinfos.filepath = fileinfos.filepath.replace("\\", "/");
                    infos[i] = fileinfos;
                }
            }
            return infos;
        };
        //通过文件名称相对路径全名获取文件信息
        this.getFileByFilePath = function (filepath) {
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, state, systeminclude, extdata FROM t_fileindex WHERE filepath=?');
            var infos = stmt.all(filepath);
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                //console.error("not find result. filepath:", filepath);
                return false;
            }
            //规范化路径
            if (os.platform() == "win32"
                && infos[0].filepath.indexOf("\\") != -1) {
                //windows系统，需要规范化路径
                infos[0].filepath = infos[0].filepath.replace("\\", "/");
            }
            return infos[0];
        };
        //通过id批量获取文件名称
        this.getFileByIds = function (ids) {
            var sqlids = ids.join(',');
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, state, systeminclude, extdata FROM t_fileindex WHERE id in (' + sqlids + ')');
            var infos = stmt.all();
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                console.error("not find result. ids:", ids);
                return [];
            }
            //规范化路径
            for (var i = 0; i < infos.length; i++) {
                var fileinfos = infos[i];
                if (os.platform() == "win32"
                    && fileinfos.filepath.indexOf("\\") != -1) {
                    //windows系统，需要规范化路径
                    fileinfos.filepath = fileinfos.filepath.replace("\\", "/");
                    infos[i] = fileinfos;
                }
            }
            return infos;
        };
        //通过id获取单个文件名称
        this.getFileById = function (id) {
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, state, systeminclude, extdata FROM t_fileindex WHERE id=?');
            var infos = stmt.all(id);
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                console.error("not find result. id:", id);
                return false;
            }
            //规范化路径
            if (os.platform() == "win32"
                && infos[0].filepath.indexOf("\\") != -1) {
                //windows系统，需要规范化路径
                infos[0].filepath = infos[0].filepath.replace("\\", "/");
            }
            return infos[0];
        };
        //取得所有的文件
        this.getAllFileInfo = function () {
            var stmt = this.db.prepare('SELECT id, filepath, filename, md5, updatetime, type, state, systeminclude, extdata FROM t_fileindex');
            var infos = stmt.all();
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                console.error("get all data faild!");
                return [];
            }
            //规范化路径
            for (var i = 0; i < infos.length; i++) {
                var fileinfos = infos[i];
                if (os.platform() == "win32"
                    && fileinfos.filepath.indexOf("\\") != -1) {
                    //windows系统，需要规范化路径
                    fileinfos.filepath = fileinfos.filepath.replace("\\", "/");
                    infos[i] = fileinfos;
                }
            }
            return infos;
        };
        //统计表的行数(为了性能)
        this.checkHasRowData = function () {
            var stmt = this.db.prepare('SELECT id as total FROM t_fileindex LIMIT 0,10');
            var infos = stmt.all();
            //console.info(infos);
            if (!infos || infos == undefined || infos.length == 0) {
                //未查询到结果
                console.error("get all data faild!");
                return 0;
            }
            //返回总行书
            return infos.length;
        };
        console.info("FileIndexStore in constructor");
        this.dbname = '';
        this.db = null;
        this.system_include = 0;
    }
    /*
    extdata字段定义
    {
        "i":["ddd.h"],   //引用的头文件
        "u":["mmpaymch"] //使用的命名空间
    }
    */
    //单例方法
    FileIndexStore.getInstace = function () {
        if (!FileIndexStore.instance) {
            FileIndexStore.instance = new FileIndexStore();
        }
        return FileIndexStore.instance;
    };
    ;
    ;
    return FileIndexStore;
}());
;
var Store = /** @class */ (function () {
    function Store() {
        this._getMaxLength = function (keywordlength) {
            var maxlength = 128;
            if (keywordlength.length < 2) {
                maxlength = keywordlength.length * 4;
                return maxlength;
            }
            if (keywordlength.length < 4) {
                maxlength = keywordlength.length * 3;
                return maxlength;
            }
            if (keywordlength.length < 6) {
                maxlength = keywordlength.length * 2;
                return maxlength;
            }
            return maxlength;
        };
        //输入前缀和命名空间，获取智能提示列表
        this.querOwnNameByPreKwInNamepsace = function (preKw, namespaces) {
            if (/^[_]{1,1}[a-z0-9_]{0,128}$/ig.test(preKw)) {
                //全局下不能以_开头
                return [];
            }
            var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
            var permission = [0, 1, 2];
            var types = [TypeEnum.NAMESPACE, TypeEnum.CALSS, TypeEnum.STRUCT, TypeEnum.DEFINE];
            var ownname = "";
            var infos = [];
            var maxlength = this._getMaxLength(preKw);
            infos = KeyWordStore.getInstace().freezFindByPreKeyword(preKw, namespaces, ownname, maxlength, permission, types);
            return infos;
        };
        this.freezFindAllByPreKeyword = function (preKw, namespaces, ownname) {
            //模糊匹配
            var maxlength = 256;
            var infos = KeyWordStore.getInstace().freezFindAllByPreKeyword(preKw, namespaces, ownname, maxlength);
            return infos;
        };
        //限定own的前缀匹配
        this.freezFindRestrictByPreKeyword = function (preKw, namespace, ownname) {
            //模糊匹配
            var maxlength = 256;
            var infos = KeyWordStore.getInstace().freezFindByPreKeyword(preKw, namespace, ownname, maxlength);
            return infos;
        };
        //限定命名空间的前缀匹配
        this.freezGetByNameAndNamespaces = function (preKw, namespace) {
            //模糊匹配
            var maxlength = this._getMaxLength(preKw);
            var infos = KeyWordStore.getInstace().freezGetByNameAndNamespaces(preKw, namespace, maxlength);
            return infos;
        };
        //获取归属下的方法和变量
        this.querInOwnByPreKwInNamepsaceCase = function (preKw, namespaces, ownname) {
            var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
            var permission = [0, 1, 2];
            var types = [TypeEnum.FUNCTION, TypeEnum.VARIABLE];
            //归属下不限制长度
            var maxlength = 128; //this._getMaxLength(preKw);
            var infos = KeyWordStore.getInstace().freezFindByPreKeywordCase(preKw, namespaces, ownname, maxlength, permission, types);
            return infos;
        };
        //获取全局下的方法和变量
        this.querGlobalByPreKwInNamepsaceCase = function (preKw, namespaces) {
            if (/^[_]{1,1}[a-z0-9_]{0,128}$/ig.test(preKw)) {
                //全局下不能以_开头
                return [];
            }
            var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
            var permission = [0, 1, 2];
            var types = [TypeEnum.FUNCTION, TypeEnum.VARIABLE];
            var ownname = "";
            var maxlength = 128; //this._getMaxLength(preKw);
            var infos = KeyWordStore.getInstace().freezFindByPreKeywordCase(preKw, namespaces, ownname, maxlength, permission, types);
            return infos;
        };
        //获取枚举值
        this.querEnumItemPreKwInNamepsaceCase = function (preKw, namespaces) {
            var TypeEnum = require('../analyse/analyseCpp').TypeEnum;
            var permission = [0, 1, 2];
            var types = [TypeEnum.ENUMITEM];
            var maxlength = 128; //this._getMaxLength(preKw);
            var infos = KeyWordStore.getInstace().freezFindByPreKeywordnOnOwnCase(preKw, namespaces, maxlength, permission, types);
            return infos;
        };
        //通过owner取下面的方法或者变量
        this.getByOwnerNameInNamespace = function (ownname, namespace, permission) {
            if (permission === void 0) { permission = []; }
            var infos = KeyWordStore.getInstace().getByOwnName(ownname, namespace, permission);
            //获取所有的fid列表
            var file_ids = {};
            for (var i = 0; i < infos.length; i++) {
                file_ids[infos[i].file_id] = 1;
            }
            //通过fid获取文件列表
            var files = FileIndexStore.getInstace().getFileByIds(Object.keys(file_ids));
            var filemap = {};
            for (var i = 0; i < files.length; i++) {
                filemap[files[i].id] = files[i].filepath;
            }
            //合并文件名称
            for (var i = 0; i < infos.length; i++) {
                if (!filemap[infos[i].file_id]) {
                    console.error("fileid error!", infos[i]);
                    infos[i]['filepath'] = "";
                    continue;
                }
                infos[i]['filepath'] = filemap[infos[i].file_id];
            }
            return infos;
        };
        //通过全名称获取
        this.getByFullname = function (ownname, namespace, name, type) {
            //获取定义详情
            var info = KeyWordStore.getInstace().getByFullnameAndType(ownname, namespace, name, type);
            if (!info) {
                //如果未找到定义
                return false;
            }
            //通过fid获取文件列表
            var files = FileIndexStore.getInstace().getFileById(info.file_id);
            if (!info) {
                //如果未找到定义
                info['filepath'] = '';
            }
            info['filepath'] = files.filepath;
            return info;
        };
    }
    //单例方法
    Store.getInstace = function (dbpath) {
        if (!Store.instance) {
            Store.instance = new Store(dbpath);
        }
        return Store.instance;
    };
    ;
    ;
    return Store;
}());
;
module.exports = {
    Store: Store,
    FileIndexStore: FileIndexStore,
    KeyWordStore: KeyWordStore,
    FileType: FileType,
    FileState: FileState
};
