# cpptips README

这是一个c++编写辅助工具，包括代码补全、提示、代码跟踪、跳转等，可辅助编写代码和看代码。
> 项目开源地址：https://github.com/widyhu2020/cpptips

## 功能介绍

主要功能包括：
- 1、不需要proto编译成.pb.h和.pb.cc文件就可以提示proto的定义
- 2、可以直接跳转到proto的定义，也可以调整函数变量等的定义
- 3、支持linux系统头文件提示和跳转
- 4、支持索引下所有命名空间、类、结构体、全局函数、枚举等前缀匹配
- 5、对象.或者->操作可以提示类的成员变量，最高可以提示5层继承关系

![avatar](https://s1.ax1x.com/2020/04/12/GLi2D0.gif)

## 使用说明

 所有平台，插件启动的时候会自动编译，但因cpu版本，操作系统差异太多，可能在有些操作系统中不兼容，导致插件不可用，可以安装下面方式进行编译配置。

### window:
> 安装nodejs，安装python环境（2.7x版本）、需要安装Visual C++ build tools编译环境
```shell
npm install --global --production windows-build-tools
npm install electron-rebuild
.\node_modules\.bin\electron-rebuild.cmd -f -w better-sqlite3 -v electronversion
```
windows编译环境指引：https://github.com/nodejs/node-gyp#on-windows

### macOS：
> 安装nodejs，如果没有python环境需要安装python（2.7x版本）
```shell
npm install electron-rebuild
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3 -v electronversion
```

### 云开发机linux环境:

>安装nodejs，一般带有python环境
```shell
cd node_modules/integer
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js configure
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js rebuild
cd node_modules/better-sqlite3
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js configure
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node ../node-gyp/bin/node-gyp.js rebuild
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node为vscode允许的
```
Tips：
- node版本，而非机器上安装的版本，具体版本信息插件启动的时候会打印
- electronversion为编译vscode时候的版本号，启动插件时插件有打印相关信息

## 扩展配置
> 配置文件解释
```json
{
	"cpptips.needLoadLinkDir": {
		"type": "array",
		"default": ["/comm", "/mmcomm", "/platform"],
		"description": "默认情况下软连接不计算索引，加入需要加载的白名单中！"
	},
	"cpptips.needLoadDir":{
		"type": "array",
		"default": [
			"/mmpay/",
			"/mmpaygateway/",
			"/mmtenpay/",
			"/comm/",
			"/mmcomm/",
			"/platform/",
			"/comm2/",
			"/appplatform/"
		],
		"description": "需要加载的目录，未配置进来将不会加载该目录，如果配置为空，则加载工程目录下全部目录！"
	},
	"cpptips.ignorDir":{
		"type": "array",
		"default": [
		],
		"description": "明确不创建索引的目录！needLoadDir配置需要加载，但是存在子目录不需要加载时，可以使用该配置项控制，非正则匹配"
	},
	"cpptips.ignoreFileAndDir": {
		"type": "array",
		"default": [
			"^[.~]{1,1}.{1,128}$",
			"^.*_tools_pb\\.(cpp|h)$",
			"^.*testimpl_pb\\.(cpp|h)$",
			"^.*\\.pb\\.(cc|h)$",
			"^(sk_|sm_)[a-z0-9_.]{1,128}$",
			"^mm3rd$",
			"^lib32$",
			"^lib64$",
			"^lib64_debug$",
			"^lib64_release$",
			"^lib32_debug$",
			"^lib32_release$",
			"^debug$",
			"^release$",
			"^win32$",
			"^bin$"
		],
		"description": "需要忽略的文件的名称或者正则表达式，该规则叠加在最后，符合该规则的文件或者文件夹都将不加载"
	},
	"cpptips.updateCheckIntervalTime" : {
		"type": "integer",
		"maximum": 2147483647,
		"default": 10000000,
		"description": "配置更新检查的间隔时间"
	},
	"cpptips.updateCheckUrl" : {
		"type": "string",
		"default": "http://cpptips.com:8888",
		"description": "配置更新检查时拉取的文件url地址"
	}
}
```

进入配置方式：
- 进入vscode插件管理，找到cpptips
- 鼠标邮件单击，选择Extensions Settings
- 可以针对User或者Workspace两个维度进行设置
- 如果需要修改，直接点金Edit in settings.json，默认会填入系统默认值，如果不需要可删除

## Issues

https://github.com/widyhu2020/cpptips/issues
