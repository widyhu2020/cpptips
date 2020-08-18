import { Uri, ViewColumn, window, ExtensionContext, workspace, ConfigurationTarget } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LanguageClient, MessageActionItem } from 'vscode-languageclient';
import { clearInterval } from 'timers';
import { configure, getLogger } from "log4js";
const logger = getLogger("cpptips");

var cookite = "";
let projectPath = workspace.rootPath;

let setPath = projectPath + "/.vscode/settings.json";

/**
 * 获取某个扩展文件相对于webview需要的一种特殊路径格式
 * 形如：vscode-resource:/Users/toonces/projects/vscode-cat-coding/media/cat.gif
 * @param context 上下文
 * @param relativePath 扩展中某个文件相对于根目录的路径，如 images/test.jpg
 */
function getExtensionFileVscodeResource(context, relativePath:string) {
    const diskPath = Uri.file(path.join(context.extensionPath, relativePath));
    return diskPath.with({ scheme: 'vscode-resource' }).toString();
}

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context, templatePath) {
    const resourcePath = path.join(context.extensionPath, templatePath);
    const dirPath = path.dirname(resourcePath);
    let html = fs.readFileSync(resourcePath, 'utf-8');
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        return $1 + Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
	});
	// logger.debug(html);
    return html;
}

export function showIndexConfig(context: ExtensionContext, client:LanguageClient){
	// 创建webview
    const panel = window.createWebviewPanel(
        'indexWebview', // viewType
        "配置分析索引目录", // 视图标题
        ViewColumn.One, // 显示在编辑器的哪个部位
        {
            enableScripts: true, // 启用JS，默认禁用
            retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
        }
    );
    panel.webview.html = getWebViewContent(context, 'webview/index.html');
	panel.webview.onDidReceiveMessage(message => {
		if (messageHandler[message.cmd]) {
			// cmd表示要执行的方法名称
			messageHandler[message.cmd](global, message);
		} else {
			window.showErrorMessage(`未找到名为 ${message.cmd} 的方法!`);
		}
	}, undefined, context.subscriptions);

	let global = { projectPath, panel};

	/**
	 * 存放所有消息回调函数，根据 message.cmd 来决定调用哪个方法，
	 * 想调用什么方法，就在这里写一个和cmd同名的方法实现即可
	 */
	const messageHandler = {
		// 弹出提示
		alert(global, message) {
			window.showInformationMessage(message.info);
		},
		// 显示错误提示
		error(global, message) {
			window.showErrorMessage(message.info);
		},
		// 回调示例：获取工程名
		getProjectName(global, message) {
			let workspaceRoot = workspace.rootPath;
			invokeCallback(global.panel, message, workspaceRoot);
		},
		getDirNames(global, message) {
			let basePath = projectPath + "/" + message.path;
			let config = this.getConfig();
			let dirname = this.getTreeNode(basePath, config, 0);
			invokeCallback(global.panel, message, dirname);
		},
		ignoreFileAndDir(global, message){
			let configuration = workspace.getConfiguration();
			let config = configuration["cpptips"];
			logger.debug(config);
			invokeCallback(global.panel, message, config['ignoreFileAndDir']);
		},
		addIgnoreRegx(global, message){
			let configuration = workspace.getConfiguration();
			let config = configuration["cpptips"];
			config['ignoreFileAndDir'].push(message.path);
			logger.debug(config);
			if(workspace.getConfiguration().update('cpptips.ignoreFileAndDir', config['ignoreFileAndDir'], ConfigurationTarget.Workspace)){
				invokeCallback(global.panel, message, "success");
			} else {
				invokeCallback(global.panel, message, "faild");
			}
		},
		removeIgnoreRegx(global, message){
			let configuration = workspace.getConfiguration();
			let config = configuration["cpptips"]['ignoreFileAndDir'];
			let newConfig = [];
			for(let i = 0; i < config.length; i++){
				if(config[i] != message.path){
					newConfig.push(config[i]);
				}
			}
			logger.debug(config);
			if(workspace.getConfiguration().update('cpptips.ignoreFileAndDir', newConfig, ConfigurationTarget.Workspace)){
				invokeCallback(global.panel, message, "success");
			} else {
				invokeCallback(global.panel, message, "faild");
			}
		},
		getConfig(){
			//获取目录名称
			let configuration = workspace.getConfiguration();
			let needLoadDir = configuration['cpptips']['needLoadDir'];
			logger.debug("needLoadDir:" , needLoadDir);
			return needLoadDir;
		},
		saveConfig(needLoadDir){
			workspace.getConfiguration().update('cpptips.needLoadDir', needLoadDir, ConfigurationTarget.Workspace)
		},
		checkIsInConfig(config, dirname){
			for(let i = 0; i < config.length; i++){
				if(config[i] == dirname){
					return true;
				}
			}
			return false;
		},
		getTreeNode(basePath:string, config, depth = 0) {
			if(depth > 2){
				return [];
			}
			
			let dirf = fs.readdirSync(basePath, { 'encoding': 'utf8', 'withFileTypes': true });
			// 这个data数组中装的是当前文件夹下所有的文件名(包括文件夹)
			var that = this;
			let dirname = [];
			logger.debug(dirf);
			dirf.forEach(function (el, _index) {
				let fullpath = basePath + path.sep + el.name;
				if(/[.]{1,1}.*/.test(el.name) || !el.isDirectory()){
					//只取目录
					return;
				}
				let check = false;
				let relativePath = fullpath.replace(projectPath + "/", "") + "/";
				if(that.checkIsInConfig(config, relativePath)){
					check = true;
				}
				let node = {
					'text': el.name, 
					'state': { "opened" : false, "checked":check },
					'children':[]
				}
				// logger.debug("xxxx", node);
				node['children'] = that.getTreeNode(fullpath, config, depth + 1);
				dirname.push(node);
			});
			return dirname;
		},
		showTipMessage(message:string, titles:string[] = ["我知道了"], callback:any = null) {
			//发送弹窗
			let items: MessageActionItem[] = [];
			for(let i = 0; i < titles.length; i++) {
				let item:MessageActionItem = {title: titles[i]};
				items.push(item);
			}
		
			window.showInformationMessage(message, ...items).then((selection:MessageActionItem|undefined) => {
				if (callback != null && selection != undefined) {
					callback(selection.title);
				}
			});
		},
		saveIndexConfig(global, message){
			logger.debug(message);
			let indexConfig = message.config;
			logger.debug("_newIndexConfig:",indexConfig);
			this.saveConfig(indexConfig);
			logger.debug("save config.");
			this.showTipMessage("配置已经保存成功，请问你现在是否需要增量创建索引（索引分析不能并行，如果当前索引分析中，你可以重启来生效）！", 
				["重建索引", "不需要拉"], (selection:string)=>{
				if(selection == "重建索引") {
					//开始重建索引
					//重新加载配置
					client.sendNotification("reflushAllIdex", {});
				}
				logger.debug("close webview.");
				//关掉网页配置
				global.panel.dispose();
			});
		}
	}

	

	/**
	 * 执行回调函数
	 * @param {*} panel 
	 * @param {*} message 
	 * @param {*} resp 
	 */
	function invokeCallback(panel, message, resp) {
		logger.debug('回调消息：', resp);
		// 错误码在400-600之间的，默认弹出错误提示
		if (typeof resp == 'object' && resp.code && resp.code >= 400 && resp.code < 600) {
			window.showErrorMessage(resp.message || '发生未知错误！');
		}
		panel.webview.postMessage({cmd: 'vscodeCallback', cbid: message.cbid, data: resp});
	}
};

//判定是否需要强制提示配置
export function checkNeedShowDefault(){
	if(!fs.existsSync(setPath)){
		return true;
	}
	return false;
}