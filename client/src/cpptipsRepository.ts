import { CancellationToken, ExtensionContext, ProviderResult, QuickDiffProvider, scm, TextDocument, TextDocumentChangeEvent, TextEdit, TextEditor, Uri, window, workspace, WorkspaceFolder } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const crypto = require('crypto');

export class CpptipsRepository implements QuickDiffProvider {
	basePath:string = "";
	setLanguageId = new Set(["cpp", "payprotobuf"]);
	//定期删除文件
	deleteTimer = null;
	//定期获取master文件
	deque:Array<string> = [];
	refushTimer = null;;

	constructor(context: ExtensionContext) {
		this.basePath = path.resolve(workspace.workspaceFolders[0].uri.path, path.join(".vscode", ".git"));
		if(!fs.existsSync(this.basePath)){
			//创建目录
			fs.mkdirSync(this.basePath, {recursive: true});
		}

		this.deleteTimer = setInterval(this.cleanMasterFile, 120000, this);
		this.refushTimer = setInterval(this.saveMasterFile, 3000, this);
		this.SourceControl(context);
	}

	unconstructor(){
		if(this.deleteTimer){
			clearInterval(this.deleteTimer);
		}
		if(this.refushTimer){
			clearInterval(this.refushTimer);
		}
	}

	provideOriginalResource(uri: Uri, token: CancellationToken): ProviderResult<Uri> {
		//原文件内容
		if(fs.statSync(uri.fsPath).size <= 0){
			//文件大小为0，表示新加的文件
			return null;
		}
		let pathinfo = path.parse(uri.fsPath);
		let filename = this.getPathHash(pathinfo.dir) + "_" + pathinfo.base;
		let retUri = Uri.parse(path.resolve(this.basePath, filename));
		return retUri;
	};

	getPathHash(fileBasePath:string){
		let pathhash = crypto.createHash("md5");
		pathhash.update(fileBasePath);
		let md5 = pathhash.digest('hex');
		return md5;
	};

	getRunCmd(fileBasePath:string, fileName:string, masterFileName:string) {
		let systemname = process.platform;
		let runCmd = "";
		if(systemname == "linux") {
			runCmd = `cd ${fileBasePath}&&git show master:./${fileName} > ${masterFileName}`;
		} else if(systemname == "darwin") {
			runCmd = `cd ${fileBasePath}&&git show master:./${fileName} > ${masterFileName}`;
		} else if(systemname == "win32"){
			//windows可能需要先到对应的盘符，否则会报错
			let pathinfo = path.parse(fileBasePath);
			let goPan = pathinfo.root.replace("\\", "");
			runCmd = `${goPan}&&cd ${fileBasePath}&&git show master:.\\${fileName} > ${masterFileName}`;
		} else {
			runCmd = `cd ${fileBasePath}&&git show master:./${fileName} > ${masterFileName}`;
		}
		return runCmd;
	}

	saveMasterFile(pthis:CpptipsRepository){
		if(pthis.deque.length <= 0){
			//没有任务可处理
			return;
		}

		//取出一个任务处理
		let filePath = pthis.deque.pop();
		let pathinfo = path.parse(filePath);
		if(pathinfo.dir.indexOf(".vscode") >= 0) {
			//打开暂存文件直接返回
			return;
		}

		let filename =  pthis.getPathHash(pathinfo.dir) + "_" + pathinfo.base;
		let filepath = path.resolve(pthis.basePath, filename);
		let nowTime = new Date().getTime();
		if(fs.existsSync(filepath) 
			&& ((nowTime - fs.statSync(filepath).mtime.getTime()) < 120000)) {
			//文件已经存在
			//120s内不更新
			return;
		}
		
		let cmd = pthis.getRunCmd(pathinfo.dir, pathinfo.base, filepath);
		// console.log(cmd);

		let childprocess = require('child_process');
		childprocess.exec(cmd,  {encoding:"utf8"}, function(error, stdout, stderr){
			if(error 
				&& (/exists on disk/.test(stderr) || /exists on disk/.test(stdout))) {
				console.log('stderr: ' + stderr);
				fs.writeFileSync(filepath," ", {encoding:"utf8"});
				return;
			}
		});
	};

	SourceControl(context: ExtensionContext){
		workspace.onDidChangeTextDocument((event:TextDocumentChangeEvent)=>{
			if(!event
				|| !this.setLanguageId.has(event.document.languageId)) { 
				return; 
			}
			//刷新master文件
			this.deque.push(event.document.uri.fsPath);
		});

		//编辑的活动文档发生变化
		window.onDidChangeActiveTextEditor((_editor:TextEditor)=>{
			if(!_editor
				|| !this.setLanguageId.has(_editor.document.languageId)) { 
				return; 
			}
			//刷新master文件
			this.deque.push(_editor.document.uri.fsPath);
		});

		const gitSCM = scm.createSourceControl('git', 'Git', workspace.workspaceFolders[0].uri);
		gitSCM.quickDiffProvider = this;
		context.subscriptions.push(gitSCM);
	};

	//删除文件
	cleanMasterFile(pthis:CpptipsRepository){
		//定期清除文件
		let editors:TextEditor[] = window.visibleTextEditors;
		let arrFlPath:string[] = [];
		editors.forEach(editor => {
			let pathinfo = path.parse(editor.document.uri.fsPath);
			arrFlPath.push(path.resolve(pthis.basePath, pathinfo.base));
		});
		let paths = fs.readdirSync(pthis.basePath);
		let setFlPath:Set<string> = new Set(arrFlPath);
		paths.forEach(_path => {
			let _realPath = _path.replace(/^[a-f0-9]{1,32}_/i, "");
			_realPath = path.resolve(pthis.basePath, _realPath);
			_path = path.resolve(pthis.basePath, _path);
			if(setFlPath.has(_realPath)) {
				//当前打开的文件不能不删除
				return;
			}

			let nowTime = new Date().getTime();
			if(nowTime - fs.statSync(_path).mtime.getTime() > 86400000){
				//只清除大于1天的文件
				if(/\.vscode/.test(_path)){
					//删除文件
					fs.unlinkSync(_path);
				}
			}
		});
	};
};

