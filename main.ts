import { App, Component, Editor, EditorPosition, MarkdownRenderer, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';

// Remember to rename these classes and interfaces!

interface WorkflowSettings {
	exampleSetting: string;
}

const DEFAULT_SETTINGS: WorkflowSettings = {
	exampleSetting: 'default'
}

export default class Workflow extends Plugin {
	settings: WorkflowSettings;

  openWorkflow(workflowState?: WorkflowState): void {
    if (workflowState) {
      new WorkflowModal(this, workflowState).open();
    } else {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      this.app.vault.read(markdownView.file).then((value) => {
        const workflowState = new WorkflowState(value, markdownView.editor.getCursor().line);
        this.openWorkflow(workflowState);
      }); 
    }

  }

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('No Current Workflow');

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new WorkflowModal(this.app).open();
		// 	}
		// });
		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// This adds a complex command that can check whether the current state of the app allows execution of the command

		this.addCommand({
			id: 'start-workflow',
			name: 'Start Workflow',
			checkCallback: (checking: boolean) => {
				// Conditions to check
        
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
            this.openWorkflow();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				} else {
          return false;
        }
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

type SetContext = {
  type: 'set-context';
  depth: number;
  context: string;
};

type SetVariable = {
  type: 'set-variable';
  name: string;
  value: string;
};

type UnsetVariable = {
  type: 'unset-variable';
  name: string;
}

type Instruction = SetContext | SetVariable | UnsetVariable;

const countHashes = (str: string): number => {
  let i = 0;
  let string = str;
  while (string.startsWith("#")) {
    i +=1
    string = string.substring(1)
  }
  return i;
} 

function getInstruction(text: string): Instruction | void {
  if (text.startsWith("#")) {
    const depth = countHashes(text) - 1;
    const context = text.replace(/^(#+\s)/,"")
    return {
      type: 'set-context',
      depth: depth,
      context: context,
    }
  }
  if (text.startsWith("%%workflow set ")) {
    console.log(text);
    const split = text.split(" = ");
    if(split.length == 2) {
      return {
        type: 'set-variable',
        name: split[0].replace(/^(%%workflow set\s)/, ""),
        value: split[1].replace(/(\s*%%$)/, "")
      }
    }
  }
  if (text.startsWith("%%workflow unset ")) {
    const name = text.replace(/^(%%workflow unset\s)/, "").replace(/(\s*%%$)/, "");
    return {
      type: 'unset-variable',
      name: name
    }
  }
}
// class ConfirmContinueModal extends Modal {
//   workflowState: WorkflowState;
//   plugin: Workflow;
//   constructor(plugin: Workflow, workflowState: WorkflowState) {
//     super(plugin.app)
//     this.plugin = plugin;
//     this.workflowState = workflowState;
//   }

//   onOpen() {
//     const {contentEl} = this;

//     contentEl.addClass("modal");
//     contentEl.setText("Existing workflow found, continue?")

//     const settings = new Setting(contentEl);
//     settings.setClass("mod-settings");

//     settings
//     .addButton((btn) =>
//       btn
//         .setButtonText("Discard")
//         .setClass("mod-warning")
//         .onClick(() => {
//           this.close()
//           this.plugin.openWorkflow()
//         }));

//     settings
//     .addButton((btn) =>
//       btn
//         .setButtonText("Continue")
//         .onClick(() => {
//           this.close();
//           this.plugin.openWorkflow(this.workflowState);
//         }));
//   }

// 	onClose() {
// 		const {contentEl} = this;
// 		contentEl.empty();
// 	}
// }

class WorkflowModal extends Modal {
  workflowState: WorkflowState;
  plugin: Workflow;

  constructor(plugin: Workflow, workflowState: WorkflowState) {
    super(plugin.app)
    this.plugin = plugin;
    this.workflowState = workflowState;
  }

  onOpen() {
    this.workflowState.line = this.workflowState.line - 1;
    this.workflowState.next();
    this.workflowState.setContext();
    this.render();
  }

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

  render() {
		const {contentEl, workflowState} = this;
    const context = workflowState.context.join(" > ");
    const upUntil = workflowState.getNext(workflowState.line);
    let workflowLines;
    if(upUntil) {
      workflowLines = workflowState.lines.slice(workflowState.line, upUntil);
    } else {
      workflowLines = workflowState.lines.slice(workflowState.line);
    }

    const workflowText = workflowLines.filter((line) => !getInstruction(line)).join("\n");

    contentEl.empty()

    const header = contentEl.createEl("div");
    header.addClass("modal");
    header.createEl('h4', {text: context});
    Object.keys(workflowState.variables).forEach((key) => {
      header.createEl('h5', {text: `${key}: ${workflowState.variables[key]}`})
    });
    const div = header.createEl('div');

    MarkdownRenderer.renderMarkdown(workflowText, div, '', this.app.workspace.getActiveViewOfType(MarkdownView))

    const settings = new Setting(contentEl);
    settings.setClass("mod-settings")
    settings
    .setDesc("foobar")
    .addButton((btn) =>
      btn
        .setButtonText("Cancel Workflow")
        .onClick(() => {
          this.close()
          this.removeLine();
        }));
    if (workflowState.getPrevious(workflowState.line)) {
      settings
      .addButton((btn) =>
        btn
          .setButtonText("Previous")
          .onClick(() => {
            this.writeLine()
            workflowState.previous();
            workflowState.setContext();
            this.render();
          }));
    }

    if(workflowState.line === workflowState.lines.length - 1) {
      settings
      .addButton((btn) =>
        btn
          .setButtonText("Complete")
          .setClass("mod-warning")
          .onClick(() => {
            this.close();
            this.removeLine();
          }));
    } else {
      settings
      .addButton((btn) =>
        btn
          .setButtonText("Next")
          .onClick(() => {
            workflowState.next();
            this.writeLine()
            workflowState.setContext();
            this.render();
          }));
    }
  }

  writeLine() {
    this.removeLine().then(() => {
      this.app.vault.read(this.app.workspace.getActiveFile()).then((contents) => {
        const lines = contents.split("\n")
        const line = this.workflowState.fileLine + this.workflowState.line;
        lines.splice(line + 1, 0, "%%workflow here%%");
        this.app.vault.modify(this.app.workspace.getActiveFile(), lines.join("\n"));
      })
    });
  }

  removeLine() {
    return this.app.vault.read(this.app.workspace.getActiveFile()).then((contents) => {
      const lines = contents.split("\n")
      const lastLine = this.workflowState.fileLine + this.workflowState.lastLine;
      const newLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if(i < this.workflowState.fileLine || i > lastLine) {
          newLines.push(lines[i]);
        } else {
          if(lines[i] !== "%%workflow here%%") {
            newLines.push(lines[i])
          }
        }
      }
      this.app.vault.modify(this.app.workspace.getActiveFile(), newLines.join("\n"));
    })
  }
}

function findWorkflowStart(lines: string[], line: number): number {
  for (let i = line; i > 0; i--) {
    if(lines[i] === "%%workflow start%%") {
      return i + 1;
    }
  }
  return 0;
}

class WorkflowState {
  lines: string[];
  line: number;
  start: number
  context: string[];
  fileLine: number;
  variables: {[key: string]: string};
  lastLine: number;

	constructor(text: string, line: number) {
    let lines = text.split('\n');
    const start = findWorkflowStart(lines, line);

    lines = lines.slice(start);
    this.lines = [];
    this.line = 0;
    for (let i = this.line + 1; i < lines.length; i++) {
      if(lines[i] === '%%workflow end%%') {
        this.lastLine = i;
        break;
      }
      if(lines[i] === "%%workflow here%%") {
        this.line = i - 1;
      }
      this.lines.push(lines[i])
    }
    this.variables = {};
    this.context = [];
    this.start = 0;
    this.fileLine = start;
	}

  previous() {
    this.line = this.getPrevious(this.line) || this.line;
  }

  next() {
    this.line = this.getNext(this.line) || this.line;
  }

  getNext(line: number): number | void {
    const next = line + 1;
    if(typeof this.lines[next] === "undefined") return;
    const nextText = (this.lines[next] || "").trimStart();

    // For now, only bullet points are part of the structure
    if(nextText.startsWith("-")) {
      return next;
    } else {
      return this.getNext(next);
    }
  }

  getPrevious(line: number): number | void {
    const prev = line -1;
    if(typeof this.lines[prev] === "undefined") return;
    const nextText = (this.lines[prev] || "").trimStart();

    if(nextText.startsWith("-")) {
      return prev;
    } else {
      return this.getPrevious(prev);
    }
  }

  setContext() {
    this.variables = {};
    this.context = [];
    for (let line = this.start; line < this.line; line++) {
      const text = this.lines[line].trimStart();
      const instruction = getInstruction(text);
      if(instruction) {
        this.followInstruction(instruction);
      }
    }
  }

  followInstruction(instruction: Instruction) {
    if (instruction.type === 'set-variable') {
      this.variables[instruction.name] = instruction.value;
    }
    if (instruction.type === 'set-context') {
      this.context = this.context.slice(0, instruction.depth);
      this.context.push(instruction.context)
    }
    if (instruction.type === 'unset-variable') {
      delete this.variables[instruction.name]
    }
  }
}

class SampleSettingTab extends PluginSettingTab {
	plugin: Workflow;

	constructor(app: App, plugin: Workflow) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s an example')
			.addText(text => text
				.setPlaceholder('Enter a value')
				.setValue(this.plugin.settings.exampleSetting)
				.onChange(async (value) => {
					this.plugin.settings.exampleSetting = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h2', {text: 'Workflow Settings'});
	}
}
