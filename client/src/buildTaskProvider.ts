/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import { TaskGroup } from 'vscode';

export class BuildTaskProvider implements vscode.TaskProvider {
	static BuildType: string = 'rake';
	private rakePromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		// let pattern = path.join(workspaceRoot, 'Buildfile');
		// let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		// fileWatcher.onDidChange(() => this.rakePromise = undefined);
		// fileWatcher.onDidCreate(() => this.rakePromise = undefined);
		// fileWatcher.onDidDelete(() => this.rakePromise = undefined);
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.rakePromise) {
			this.rakePromise = getBuildTasks();
		}
		return this.rakePromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
		// A Build task consists of a task and an optional file as specified in BuildTaskDefinition
		// Make sure that this looks like a Build task by checking that there is a task.
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: BuildTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, definition.task, 'rake', new vscode.ShellExecution(`ls ./`));
		}
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
	if (!_channel) {
		_channel = vscode.window.createOutputChannel('Build Auto Detection');
	}
	return _channel;
}

interface BuildTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;

	/**
	 * The rake file containing the task
	 */
	file?: string;
}

async function getBuildTasks(): Promise<vscode.Task[]> {
	let workspaceRoot = vscode.workspace.rootPath;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceRoot) {
		return emptyTasks;
	}

	let taskName = "提交编译";
	let kind: BuildTaskDefinition = {
		type: 'build',
		task: taskName
	};

	let source = "build";
	let options = {
		executable: "ls",
		shellArgs:["."]
	};
	let execution = new vscode.ShellExecution(`ls .`, options);
	let result: vscode.Task[] = [];
	let task = new vscode.Task(kind, taskName, source);
	task.group = vscode.TaskGroup.Build;
	task.execution = execution;
	result.push(task);
	return result;
}
