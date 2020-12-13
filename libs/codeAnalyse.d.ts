/*
 * codeAnalyse.d.ts
 *
 *  Created on: 2020年4月05日
 *      Author: widyhu
 */

declare interface NodeItem {
	s : string,
	t : number,
	n : string,
	f : string,
	i : string,
	d : number,
	c : string | undefined
}

declare interface ShowItem {
	t : string,
	d : string
}

declare interface GetDependentCallBack<P0, P, P1, P2, P3> {
	(msg:P0, filepath:P, usingnamespace: P1, include: P2, showTree: P3): void;
}

declare interface ReloadOneIncludeCallBack<P1> {
	(msg: P1): void;
}

declare interface ReloadAllIncludeCallBack<P1, P2, P3, P4, P5> {
	(msg: P1, showprocess: P2, total: P3, nowIndex: P4, extdata: P5): void;
}

declare interface diagnosticsCallBack<P1> {
	(result: P1): void;
}

declare interface UpdateCallBack<P1> {
	(msg:P1):void;
}

declare interface CaConfig {
	basedir: string|undefined,
	dbpath: string|undefined,
	showsql: number|undefined,
	extpath: string|undefined,
	userConfig: any|undefined
}

declare interface PointInfo {
	filename: string,
	bline: number,
	bcols: number,
	eline: number,
	ecols: number,
	linecode: string,
	prelinecode: string,
	title: string
}

declare interface FunctionDef {
	functiondef:string,
	params:string[]
}

declare interface FunctionHelpInfo {
	paramsindex:number,
	filename: string,
	functiondef: FunctionDef[]
}


declare class CodeAnalyse {
	constructor(basepath:string);
	getDependentByCpp(cppfilename: string, hander: GetDependentCallBack<string, string, string[],string[], string>|null , isClose: boolean|false):void;
	searchKeyWord(filepath: string, keyword: string, context: string, usingnamepace: string[] | null): NodeItem[];
	getShowTips(filepath: string, name: NodeItem): ShowItem | false;
	getAllNameByObj(filepath: string, context: string, usingnamepace: string[] | null): NodeItem[];
	autoFillParams(filepath:string, filecontext:string, preParams:string): NodeItem[];
	getAllNameByNamespace(filepath: string, filecontext: string, owns: string[] | null): NodeItem[];
	reloadOneIncludeFile(filepath: string, hander:ReloadOneIncludeCallBack<string> | null):void;
	reloadAllIncludeFile(hander: ReloadAllIncludeCallBack<string, number, number, number, string>): void;
	reloadBatchIncludeFile(filepaths: string[],hander: ReloadAllIncludeCallBack<string, number, number, number, string>): boolean;

	//获取定义位置
	getDefinePoint(filepath: string, filecontext: string, linelast: string, usingnamepace: string[] | null): PointInfo|false;

	//跳转头文件定义
	getIncludeDefine(sourceFile:string, includeFile: string): PointInfo|false;

	//获取文档结构
	getDocumentTree(filepath:string, filecontex:string): any;

	//进行语法检查
	diagnostics(filepath:string, filecontext:string, hander:diagnosticsCallBack<string>):void;

	//函数参数提示
	getSignatureHelp(filepath: string, filecontext: string, usingnamepace: string[] | null): FunctionHelpInfo|false;

	//初始化
	init(config: CaConfig): CodeAnalyse;

	//重新加载配置文件
	reloadLoadUserConfig(configs: CaConfig): CodeAnalyse;

	//释放资源
	destroy():void;
	//判断是否正在繁忙中
	busy():boolean;
	//单例方法
	static getInstace(): CodeAnalyse;

	//更新检查
	updateCheck(handler:UpdateCallBack<string>): void;
}

export {
	CodeAnalyse,
	NodeItem,
	ShowItem,
	CaConfig,
	GetDependentCallBack,
	ReloadOneIncludeCallBack,
	ReloadAllIncludeCallBack,
	PointInfo
}