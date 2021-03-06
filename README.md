# cpptips README

这是一个c++编写辅助工具，包括代码补全、提示、代码跟踪、跳转等，可辅助开发者编写代码和查看代码。该项目中包含c++语法解释算法，但并不完美，有兴趣的朋友可获取并修改和调整，但我们非常希望能反过来完善该开源项目。
> 项目开源地址：https://github.com/widyhu2020/cpptips

 版权声明：
 > 该项目为开源项目，任何人均可以获取和修改（包括使用其中部分算法或者功能），但发布使用仅限于任何开源项目。

## 功能介绍

![功能剪辑](https://www.cpptips.cn/static/helper_mini.gif)

目前主要功能包括：
- 1、不需要proto编译成.pb.h和.pb.cc文件就可以提示proto的定义
- 2、可以直接跳转到proto的定义，也可以调整函数变量等的定义
- 3、支持linux系统头文件提示和跳转
- 4、支持索引下所有命名空间、类、结构体、全局函数、枚举等前缀匹配
- 5、对象.或者->操作可以提示类的成员变量，最高可以提示5层继承关系


# 快速开始
libs文件为编译生成文件夹，请勿修改，如果需要修改请修code-analyse下面的js文件，然后使用编译工具编程到libs目下，编译过程会将es6语法的js文件编译成es5语法，libs中js为最终执行的代码。

## 各平台使用说明

 所有平台，插件启动的时候会自动编译，但因cpu版本，操作系统差异太多，可能在有些操作系统中不兼容，导致插件不可用，可以安装下面方式进行编译配置。

### window
> 安装nodejs，安装python环境（2.7x版本）、需要安装Visual C++ build tools编译环境（安装vs2019，我们测试过程中发现vs2017，若你的环境为vs2017，请先升级到vs2019）
```shell
#安装编译环境，如果你安装有vs2019等ide，此步骤可跳过
npm install --global --production windows-build-tools
#进到工程根目录执行
npm install
#安装node原生模块编译工具
npm install node-gyp
#桌面系统vscode使用electron构造窗口程序，此时需要使用electron-rebuild来重新编译原生模块，因此需要安装electron-rebuid工具
npm install electron-rebuild
#编译better-sqlite3模块
.\node_modules\.bin\electron-rebuild.cmd -f -w better-sqlite3 -v electronversion
#electronversion为当前vscode使用的electron的版本号，获取方式见下tips
```
windows编译环境指引：https://github.com/nodejs/node-gyp#on-windows

### macOS
> 安装nodejs，如果没有python环境需要安装python（2.7x版本），需要xcode编译环境（不一定需要安装完整的xcode）
```shell
npm install node-gyp
#桌面系统vscode使用electron构造窗口程序，此时需要使用electron-rebuild来重新编译原生模块，因此需要安装electron-rebuid工具
npm install electron-rebuild
#编译better-sqlite3模块
.\node_modules\.bin\electron-rebuild -f -w better-sqlite3 -v electronversion
#electronversion为当前vscode使用的electron的版本号，获取方式见下tips
```

### 云开发机linux环境

>安装nodejs，一般带有python环境
```shell
#若使用的是linux桌面版本，使用与macOS一致
#若使用的远程开发，此时不是使用的electron版的nodejs，如需要重新编译远程机器能使用的版本，请参考如下步骤
#1.编译integer，在桌面系统中该模块会被自动编译，linux需要单独编译
cd node_modules/integer
vscode-node ../node-gyp/bin/node-gyp.js configure
vscode-node ../node-gyp/bin/node-gyp.js rebuild

#2.编译better-sqlite3
cd node_modules/better-sqlite3
vscode-node ../node-gyp/bin/node-gyp.js configure
vscode-node ../node-gyp/bin/node-gyp.js rebuild

#注意：
#vscode-node并非一个指令，是一个简写，真正执行的需要使用完整的指令，如下例如：
/home/widyhu/.vscode-server/bin/2aae1f26c72891c399f860409176fe435a154b13/node
#这里不能使用linux上本身安装的nodejs，vscod-server执行的时候使用的是自己的node版本，他并不会使用操作系统的nodejs版本
#怎么获取vscode运行环境的nodejs？见Tips
```
Tips：
- node版本，而非机器上安装的版本，具体版本信息插件启动的时候会打印。vscode启动的时候找到插件最开始的输出，找到execPath对应的值即为vscode运行的nodejs路径
- electronversion为编译vscode时候的版本号，启动插件时插件有打印相关信息

## 如何调试测试
工程中实现了4个调试launch，可在调试面板上手动切换调试对象
#### 启动客户端调试（不可调服务端）
> 启动客户端调试（不可调服务端）的情况下代码跟踪不会进入到服务器相关代码
#### 启动测试程序（code-analyse）
> 启动测试程序（code-analyse）目录下有个test.js，这个为调试测试入口，可以在这里写好测试入口，然后启动调试
#### 服务端并调试
>因服务端不能单独运行调试，这个项一般不用，留着的目的是给下面客户端+服务器一起调试使用
#### 客户端 + 服务器调试
> 客户端 + 服务器调试模式下，服务器和客户端的代码都可跟踪，但是进入的是编译完成之后的代码，如果想调试编译前的代码，启动测试程序（code-analyse）进行调试

### 此外，你还可以使用如下指令，来运行和测试任务进程
#### node code-analyse/src/worker/rebuildAllFileIndex.js
> 重新编译所见索引，用法见rebuildAllFileIndex.js文件中的主进程部分代码
#### node code-analyse/src/worker/unzipSystemIncludeWorker.js
> 解压和导入系统库头文件索引
##### node code-analyse/src/worker/makeOwnsMapByCpp.js
> 分析cpp文件
##### node code-analyse/src/worker/checkNeedUpdate.js 
> 检查更新

# 扩展配置
进入配置方式：
- 进入vscode插件管理，找到cpptips
- 鼠标邮件单击，选择Extensions Settings
- 可以针对User或者Workspace两个维度进行设置
- 如果需要修改，直接点金Edit in settings.json，默认会填入系统默认值，如果不需要可删除
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

## Issues

https://github.com/widyhu2020/cpptips/issues

## 版本记录
v0.1.15
- protobuf嵌套message解释命名空间不准确问题 
- 类成员变量为模版变量解释不出来的问题，例如：std::vector<ddd> 
- 扫描文件的时候，处理已经删除的文件，增加文件删除触发器，文件删除之后同步删除文件对应的各种定义
- 检测到变更文件大于20个的时候，刷新所有索引
- 自动填参数的时候，第一个需要回删前面的空格
- 自动填参数的时候，若填入函数包含参数，自动选择带填入的参数，减少操作
- 解决auto定义的参数无法提示
- 语法检查解决构造函数中带有参数列表时无法正常分析的问题
- 语法检查解决auto定义变量的问
- 解决auto定义的参数无法提示
- 解决重新分析头文件，冲掉跳转实现位置的标记
- 解决cpp定义未分析进入索引中，导致跳转不到函数实现的问题 

v0.1.21
- 解决stl模版类型使用迭代器先赋值，再循环使用时无法提示的问题
- 解决偶现修改文件不能重新加载索引的问题
- 解决protobuf文件在message嵌套message时，获取类名称和命名空间错误的问题
- 函数内部选找作用域时，因为带参数的对象定义，如：A a(b,c)，被误认为函数定义，导致寻找的作用域范围不准确
- 增加右键菜单可快速增加或者移除分析索引目录的功能、增加启动重建索引的菜单、增加选定范围小大写互转的菜单、增加提交puchbuild编译的功能
- 将索引库由原来的隐藏目录和隐藏文件改成非隐藏目录和文件
- 扫描工程文件，当大于5w个文件是，提示用户设置索引分析目录，当大于12w个文件的时候，终止分析索引，强制要求指定分析索引目录

v0.1.25
- 最大创建索引文件调整为15w个
- 解决查找定义的时候，获取cpp文件路径错误问题
- 解决当抛出异常的时候，没有返回，导致server coredump的问题 

v0.2.4
- 解决跳转会跳到所在文件最末尾的问题
- 解决新加的函数、方法、结构体等没法识别，需要重新vscode才能生效的问题
- 增加编译错误和告警抓取等语法问题，可直接从下边问题中直接定位错误位置，并提示错误原因
- 增加编译菜单以及编译快捷键，f5本地编译，control+f5提交远程编译
- 增加同步私有测试容器机制，可直接control+f5编译、传到选择的私有容器并重启
- 增加可视化索引配置，增加新手引导配置流程，并优化索引创建提示和流程

v0.2.7
- 增加编译插件机制，用户可定义自己的编译任务（使用js语言实现）
- 增加忽略文件正则表达式的可视化配置
- 修复复制文件名从的bug（复制文件名称无效的问题）
- 解决编译产生的异常信息，在编辑文档的时候，标记在原未知不变的问题，修改之后会自动找到最新的问题行列标记错误信息
- 引入代码片段功能
- 删除文件夹你右键配置索引创建目录功能，统一调整为可视化配置界面

v0.2.8
- 解决logger日志启用tcp端口，重启之后进程未退出导致插件起不来的问题
- 解决编译错误收集到源文件中当没有错误信息时解释失败的问题
- 优化分析文件大于20w时的文案提醒

v0.2.9
- 调整日志目录规则，linux和mac日志存放为/tmp目录，windows存放目录为c:/cpplog/

v0.3.0
- 解决系统索引导入失败问题，导致无法提示stl的用法的问题
- 启动server端，关掉debug开关，解决端口占用问题
- 将日志输出由终端输出调整为文件，解决终端总是弹出问题
- 编译自定义输入参数增加缓存

v0.3.1
- 修复非首次编译，编译之后追踪的错误信息，编辑文档之后全部失效的问题
- 解决非远程开发编译获取的错误文件路径与本地文件路径不一致，导致错误信息最终报错的问题
- 优化引导配置索引流程，增加文件夹目录文件数量统计，用户可根据统计的文件数选择加入索引构建
- 索引选择目录支持勾选已经加入分析软连接名单的路径（一定要先加入cpptips.needLoadLinkDir）
- 选择目录树中文件或者目录右键复制名称功能，由macos用户可用调整为所有操作系统都放开
- 文档右键增加“去可视化配置索引”菜单

v0.3.2
- 修改编译产生的警告被提示成错误的bug
- 兼容最新的vscode客户端版本
- 解决定位不到的调整报语法错误的问题
- 解决同文件跳转不准确或者不跳转的问题
- 解决基类为模版类的情况下，无法跟踪基类的成员函数和成员变量的问题

v0.4.0
- lsp架构中，server改自带的node版本，以解决vscode升级导致node和版本不一致electron导致插件无法运行的问题，新版本将sqlite不再依赖electron的版本
- 增加自动编译能力，系统内置macos、linux（x64）、windows（x86）、windows（x64）四个操作系统和cpu的node（12.16.1），内置的原生sqlite如果不能使用，系统会自动启用编译，自动编译这一功能依赖操作系统中是需要安装python，如果编译失败，可以先安装python，使用打印出来的指令手工编译，或者安装python重新启动vscode，这一改动将使安装包比原来更大
- 支持protobuf自动建BaseClient，方便接口调用提示（svrkit专用）

v0.4.1
- 修复继承的父类定义包含模版参数时，无法提示和跳转
- 修复proto生产的client类中参数类型使用错误的问题
- 修复跳转时，如果client文件中找不到方法，则跳转到protobuf的函数定义中

v0.4.2
- 行号旁边增加基于master（不基于当前分支）的修改展示，即使提交了当前分支修改标记依然在

v0.4.4
- 修复v0.4.2版本中，相同名字的文件，diff错位的问题

v0.4.6
- 解决上个版本引入的加载对比临时文件的问题，使用过版本的可以使用一下方法清理引入的数据
sqlit projectpath/.vscode/db/cpptips.db
>delete from t_fileindex where filepath like "%.vscode%";

v0.4.7
v0.4.8
- 解决修改文件无法刷新索引的问题
- 对索引存储进行优化，优化成跟进打开的源文件动态创建内存数据库，以提高处理性能（带来的影响是，可能打开页面之后有一段时间无法使用提示）

v0.4.9
- 优化内存db加载规则
- 优化保存刷新规则，减少频繁计算索引导致性能开销大的问题
- 优化自动填参数，当选不到特定类型的时候，列举类型相同的类型
- 优化指针和对象访问，当选择函数的时候，根据当前行的内容决定是否加;结尾
- 回车按键根据上一行的情况，自动提示（简化流程，如果好用再优化）

v0.4.10
- 去掉回车提示逻辑，改为在空行输入空格触发提示
- 提示选择内容时，根据当前光标位置决定要不要在后面加入;号结尾，提高编码效率

v0.4.11
- 修复0.4.9引入的跳转问题

v0.4.12
- 修复部分刷新索引不更新的问题

v0.4.13
- 支持编译的时候选择二进制