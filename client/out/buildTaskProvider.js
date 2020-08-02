"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const cp = require("child_process");
const vscode = require("vscode");
class BuildTaskProvider {
    constructor(workspaceRoot) {
        this.rakePromise = undefined;
        // let pattern = path.join(workspaceRoot, 'Buildfile');
        // let fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        // fileWatcher.onDidChange(() => this.rakePromise = undefined);
        // fileWatcher.onDidCreate(() => this.rakePromise = undefined);
        // fileWatcher.onDidDelete(() => this.rakePromise = undefined);
    }
    provideTasks() {
        if (!this.rakePromise) {
            this.rakePromise = getBuildTasks();
        }
        return this.rakePromise;
    }
    resolveTask(_task) {
        const task = _task.definition.task;
        // A Build task consists of a task and an optional file as specified in BuildTaskDefinition
        // Make sure that this looks like a Build task by checking that there is a task.
        if (task) {
            // resolveTask requires that the same definition object be used.
            const definition = _task.definition;
            return new vscode.Task(definition, definition.task, 'rake', new vscode.ShellExecution(`ls ./`));
        }
        return undefined;
    }
}
exports.BuildTaskProvider = BuildTaskProvider;
BuildTaskProvider.BuildType = 'rake';
function exists(file) {
    return new Promise((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        });
    });
}
function exec(command, options) {
    return new Promise((resolve, reject) => {
        cp.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}
let _channel;
function getOutputChannel() {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('Build Auto Detection');
    }
    return _channel;
}
function getBuildTasks() {
    return __awaiter(this, void 0, void 0, function* () {
        let workspaceRoot = vscode.workspace.rootPath;
        let emptyTasks = [];
        if (!workspaceRoot) {
            return emptyTasks;
        }
        let taskName = "提交编译";
        let kind = {
            type: 'build',
            task: taskName
        };
        let source = "build";
        let options = {
            executable: "ls",
            shellArgs: ["."]
        };
        let execution = new vscode.ShellExecution(`ls .`, options);
        let result = [];
        let task = new vscode.Task(kind, taskName, source);
        task.group = vscode.TaskGroup.Build;
        task.execution = execution;
        result.push(task);
        return result;
    });
}
//# sourceMappingURL=buildTaskProvider.js.map