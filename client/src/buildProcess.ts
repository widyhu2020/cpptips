import * as path from 'path';
import * as fs from 'fs';
import { workspace, ExtensionContext, window, StatusBarItem, StatusBarAlignment, ThemeColor, TextEdit, commands, ViewColumn, Position, Range, MessageOptions, TextDocumentShowOptions, TextDocument, Uri, scm, Terminal, ShellExecution, Task, TaskDefinition, tasks, Disposable, TaskGroup} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    VersionedTextDocumentIdentifier,
	MessageActionItem
} from 'vscode-languageclient';

interface BuildTaskDefinition extends TaskDefinition {
    /**
     * The task name
     */
    task: string;
  
    /**
     * The rake file containing the task
     */
    file?: string;
}

function runBuild(path:string, command:string){
	let taskName = "提交编译";
	let kind: BuildTaskDefinition = {
		type: 'build',
		task: taskName
	};

	let source = "build";
	let execution = new ShellExecution(`cd ${path} && ${command}`, null);
	let task = new Task(kind, taskName, source);
	task.group = TaskGroup.Build;
	task.execution = execution;
	task.problemMatchers = [
		"$cpp_gcc",
		"$cpp_build"
	];
	tasks.executeTask(task);
}

function getSelectBetaList(dirname:string){
	let workspaceRoot = workspace.rootPath;
	let list = workspaceRoot + "/list.txt";
	// console.log("list:", list, dirname);
	let data = "无法获取你的私有容器，请按照指引进行配置，打开\nhttp://docker.wxpaytest.oa.com/wepayDocker/container \n中的容器列表直接复制到该文件中并替换该内容，无需调整格式！";
	if(!fs.existsSync(list)){
		console.log("new faile. list:", list);
		fs.writeFileSync(list, data, {encoding:"utf-8"});
		window.showTextDocument(Uri.file(list));
		return false;
	}
	let fd = fs.openSync(list, 'r');
	let buffer = Buffer.alloc(1024 * 1024 * 2);
	let bytesRead = fs.readSync(fd, buffer, 0, 1024 * 1024 * 2, 0);
	let filecontext = buffer.toString('utf8', 0, bytesRead);
	if(filecontext == "" || filecontext == data) {
		console.log("new faile. list:", list);
		fs.writeFileSync(list, data, {encoding:"utf-8"});
		window.showTextDocument(Uri.file(list));
		return false;
	}

	//获取服务名称
	const pathInfo = path.parse(dirname);
	let svrName = pathInfo.name;

	let lines = filecontext.split("\n");
	console.log("lines:", lines);
	let betaInfo = [];
	lines.forEach(msg => {
		msg = msg.trim();
		if(msg.indexOf(svrName) == -1){
			//格式没有
			return;
		}
		let items = msg.split(/[\s\t]{1,10}/);
		if(items.length < 3){
			return;
		}
		let container = items[0];
		let ip = items[2];
		let servicename = items[1];
		let _item = container + " " + servicename + " " + ip;
		console.log("item:", _item);
		betaInfo.push(_item);
	});
	if(betaInfo.length <= 0) {
		//未配置，或者未创建私有容器
		let items: MessageActionItem[] = [];
		items.push( {title: "立刻去配置"});
		items.push( {title: "继续编译到本地"});
		window.showErrorMessage("你未将私有容器列表复制到list.txt中，或者你还未配置私有容器，如果确认有私有容器请重新复制容器列表到list.txt中", ...items).then((selection:MessageActionItem|undefined) => {
			if (selection != undefined
				&& selection.title == "立刻去配置") {
				window.showTextDocument(Uri.file(list));
			} else if(selection != undefined
				&& selection.title == "继续编译到本地") {
				build(null);
			}
		});;
		return false;
	}
	return betaInfo;
}

export function  buildToBeta(infos: any) {

	let filepath = window.activeTextEditor.document.fileName;
	console.log("form command! filepath:", filepath);
    let pathinfo = path.parse(filepath);
	let dirname = pathinfo.dir;
	
	while (true) {
		if (!fs.existsSync(dirname + "/BUILD")
			&& !fs.existsSync(dirname + "/makefile")) {
			//查找编译文件
			let _pathinfo = path.parse(dirname);
			dirname = _pathinfo.dir;
			if (dirname == "" || dirname == "/") {
				break;
			}
			console.log("try find build:", dirname);
			continue;
		}
		
		console.log("find build:", dirname);
        if (fs.existsSync(dirname + "/BUILD")) {
			//patchbuild 编译
			//获取用户名的私有容器
			//尝试编译
			let betaInfo = getSelectBetaList(dirname);
			console.log("find bataInfo:", betaInfo);
			if(betaInfo == false){
				return;
			}
			window.showQuickPick(
				// 这个对象中所有参数都是可选参数
				betaInfo,
				{
					canPickMany: false,
					ignoreFocusOut: true,
					matchOnDescription: true,
					matchOnDetail: true,
					placeHolder: '温馨提示，请选择你需要同步的容器，按esc健取消！'
				}
			).then(function (msg) {
				console.log("用户输入：" + msg);
				let items = msg.split(/[\s\t]{1,10}/);
				let container = items[0];
				let ip = items[2];
				let servicename = items[1];
				let build_command_array = [
					"patchbuild",
					"build",
					":" + servicename,
					"-t",
					ip,
					"--container",
					container,
					"-r",
					"./"
				];
				let build_command = build_command_array.join(" ");
                runBuild(dirname, build_command);
			});
		}
		if (fs.existsSync(dirname + "/makefile")) {
			//makefile编译
			runBuild(dirname, "make -j 2");
		}
        return;
    }
    window.showErrorMessage("未找到可编译的目录，请确认是否有编译配置！");
	
}

export function build(infos:any) {
	let filepath = window.activeTextEditor.document.fileName;
	console.log("form command! filepath:", filepath);

	let pathinfo = path.parse(filepath);
	let dirname = pathinfo.dir;
	//尝试编译
	while(true) {
		if(!fs.existsSync(dirname + "/BUILD")
			&& !fs.existsSync(dirname + "/makefile")) {
			//查找编译文件
			let _pathinfo = path.parse(dirname);
			dirname = _pathinfo.dir;
			if(dirname == "" || dirname == "/") {
				break;
			}
			continue;
		}
		if(fs.existsSync(dirname + "/BUILD")){
			//patchbuild 编译
			runBuild(dirname, "patchbuild build -d");
		}
		if(fs.existsSync(dirname + "/makefile")){
			//makefile编译
			runBuild(dirname, "make -j 2");
		}
		return;
	}
	window.showErrorMessage("未找到可编译的目录，请确认是否有编译配置！");
}

