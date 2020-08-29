import * as path from 'path';
import * as fs from 'fs';
import { ExtensionContext, window, commands, ViewColumn, Range, env, workspace, Uri} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    VersionedTextDocumentIdentifier
} from 'vscode-languageclient';
import { showIndexConfig } from './IndexConfig';
import { build, GetBuildCmd } from './buildProcess';
import { configure, getLogger } from "log4js";
const logger = getLogger("cpptips");
let projectPath = workspace.rootPath;

export function menuProcess(context:ExtensionContext, client:LanguageClient) {
	context.subscriptions.push(commands.registerCommand('cpp.changeType', (uri) => {
		let select = window.activeTextEditor.selection;
		let filename = window.activeTextEditor.document.uri.path;
		let data = JSON.stringify({ select: select, filename: filename });
		client.sendNotification("change_name_type", [[data]]);
		let document = window.activeTextEditor.document;
		let word = document.getText(select);

		let newWord = word;
		//如果原来是_隔开的则转换为驼峰说
		if (newWord.indexOf("_") != -1) {
			let items = newWord.split("_");
			let _tmpWord = "";
			for (let i = 0; i < items.length; i++) {
				let item = items[i];
				let begin = item.substring(0, 1).toLowerCase();
				_tmpWord += begin.toUpperCase() + item.substring(1);
			}
			newWord = _tmpWord;
		}
		else {
			//如果原来是驼峰写法转换为_隔开的
			if (/^Is([A-Z]{1,1}[a-z0-9]{1,128}){1,10}Set$/g.test(word)) {
				newWord = newWord.substring(2, newWord.length - 3);
				newWord = newWord.replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
				newWord = "has" + newWord;
			}
			else if (/^Get([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(word)) {
				newWord = newWord.substring(3);
				let begin = newWord.substring(0, 1).toLowerCase();
				newWord = begin + newWord.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
			}
			else if (/^Set([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(word)) {
				let begin = word.substring(0, 1).toLowerCase();
				newWord = begin + word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
			}
			else {
				let begin = word.substring(0, 1).toLowerCase();
				newWord = begin + word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
			}
		}

		if (word == newWord) {
			//无需替换
			return;
		}

		window.activeTextEditor.edit(editBuilder => {
			editBuilder.replace(select, newWord);
		});
	}));

	//智能提醒，需要改变光标
	context.subscriptions.push(commands.registerCommand('cpptips.service.move_cursor', (params) => {
		let line = params[1];
		let bcol = params[2];
		let ecol = params[3];
		const options = {
			selection: new Range(line, bcol, line, ecol),
			preview: false,
			viewColumn: ViewColumn.Active
		};
		let document = window.activeTextEditor.document;
		window.showTextDocument(document, options);
	}));

	//appplatform迁移结构体处理
	context.subscriptions.push(commands.registerCommand('cpp.appplatformtosvrkit', (uri) => {

		let document = window.activeTextEditor.document;
		let select = window.activeTextEditor.selection;
		let word = document.getText(select);

		let newWord = word.replace(/[a-z0-9]{1,64}\.Set[a-z0-9]{1,64}\([a-z0-9]{1,64}\.Get[a-z0-9]{1,64}\(\)[\s\t]{0,4},[\s\t]{0,4}[a-z0-9]{1,64}\.Is[a-z0-9]{1,64}Set\(\)\);/ig, (_kw) => {
			let data = _kw.split(",");
			if (data.length != 2) {
				return _kw;
			}

			let code = "if(" + data[1].replace(";", "").trim() + "{ " + data[0] + "); }";
			return code;
		});

		newWord = newWord.replace(/[.]{1,1}(Set|Get|Is)(([A-Z]{1,1}[0-9a-z]{1,32}){1,20})/g, (_kw) => {
			//如果原来是驼峰写法转换为_隔开的
			let _word = _kw;
			_word = _word.replace(".", "");
			if (/^Is([A-Z]{1,1}[a-z0-9]{1,128}){1,10}Set$/g.test(_word)) {
				_word = _word.substring(2, _word.length - 3);
				_word = _word.replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
				_word = "has" + _word;
			}
			else if (/^Get([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(_word)) {
				_word = _word.substring(3);
				let begin = _word.substring(0, 1).toLowerCase();
				_word = begin + _word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
			}
			else if (/^Set([A-Z]{1,1}[a-z0-9]{1,128}){1,10}$/g.test(_word)) {
				let begin = _word.substring(0, 1).toLowerCase();
				_word = begin + _word.substring(1).replace(/[A-Z]{1,1}/g, (kw) => {
					return "_" + kw.toLowerCase();
				});
			}
			return "." + _word;
		});
		window.activeTextEditor.edit(editBuilder => {
			editBuilder.replace(select, newWord);
		});
	}));

	//转换为大些
	context.subscriptions.push(commands.registerCommand('cpp.transferToUpper', (uri) => {

		let document = window.activeTextEditor.document;
		let select = window.activeTextEditor.selection;
		let word = document.getText(select);
		let newWord = word.toLocaleUpperCase();
		window.activeTextEditor.edit(editBuilder => {
			editBuilder.replace(select, newWord);
		});
	}));

	//转换为小些
	context.subscriptions.push(commands.registerCommand('cpp.transferToLower', (uri) => {
		let document = window.activeTextEditor.document;
		let select = window.activeTextEditor.selection;
		let word = document.getText(select);
		let newWord = word.toLocaleLowerCase();
		window.activeTextEditor.edit(editBuilder => {
			editBuilder.replace(select, newWord);
		});
	}));

	//索引处理
	context.subscriptions.push(commands.registerCommand('cpp.addIndexDir', (infos) => {
		logger.debug(infos);
		client.sendNotification("addDirToIndex", infos);
	}));

	//索引处理
	context.subscriptions.push(commands.registerCommand('cpp.delIndexDir', (infos) => {
		logger.debug(infos);
		client.sendNotification("delDirToIndex", infos);
	}));

	//刷新所有索引
	context.subscriptions.push(commands.registerCommand('cpp.reflushAllIdex', (infos) => {
		logger.debug(infos);
		client.sendNotification("reflushAllIdex", infos);
	}));

	//显示可视化索引配置
	context.subscriptions.push(commands.registerCommand('cpp.showWebConfig', (infos) => {
		//配置配置文件
		showIndexConfig(context, client);
	}));

	//刷新该文件的索引
	context.subscriptions.push(commands.registerCommand('cpp.reflushOneIdex', (infos) => {
		logger.debug(infos);
		client.sendNotification("reflushOneIdex", infos);
	}));

	//复制文件名称处理
	context.subscriptions.push(commands.registerCommand('cpp.copyfilename', (infos) => {
		logger.debug(infos);
		let filepath: string = infos.path;
		let pathinfo = path.parse(filepath);
		logger.debug(pathinfo.base);
		let filename = pathinfo.base;
		env.clipboard.writeText(filename);
	}));

	//提交编译
	context.subscriptions.push(commands.registerCommand('cpp.build', (infos) => {
		build(context);
	}));

	//提交编译到容器
	context.subscriptions.push(commands.registerCommand('cpp.buildfordocker', (infos) => {
		GetBuildCmd(context);
	}));

	//编译过程配置
	context.subscriptions.push(commands.registerCommand('cpp.buildconfig', (infos) => {
		let jsPath = projectPath + "/.vscode/build.js";
		if(!fs.existsSync(jsPath)){
			let extensionPath = context.extensionPath;
			let _helpfile = extensionPath + "/webview/buildHelp.txt";
			fs.copyFileSync(_helpfile, jsPath);
		}
		window.showTextDocument(Uri.file(jsPath));
	}));
}