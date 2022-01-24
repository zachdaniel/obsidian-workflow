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

type GetVariable = {
  type: 'get-variable';
  name: string;
  line: number;
};

type UnsetVariable = {
  type: 'unset-variable';
  name: string;
}

type Instruction = SetContext | SetVariable | UnsetVariable | GetVariable;

const countHashes = (str: string): number => {
  let i = 0;
  let string = str;
  while (string.startsWith("#")) {
    i +=1
    string = string.substring(1)
  }
  return i;
} 

function getInstruction(text: string, line: number): Instruction | void {
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
    const split = text.split(" = ");
    if(split.length == 2) {
      return {
        type: 'set-variable',
        name: split[0].replace(/^(%%workflow set\s)/, ""),
        value: split[1].replace(/(\s*%%$)/, "")
      }
    }
  }
  if (text.startsWith("%%workflow set_temp ")) {
    const split = text.split(" = ");
    if(split.length == 2) {
      return {
        type: 'set-variable',
        name: split[0].replace(/^(%%workflow set_temp\s)/, ""),
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
  if (text.startsWith("%%workflow get ")) {
    const name = text.replace(/^(%%workflow get\s)/, "").replace(/(\s*%%$)/, "");
    return {
      type: 'get-variable',
      line: line,
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

  setInputValue(variable: string, value: string, line: number) {
    this.workflowState.variables[variable] = value;
    this.app.vault.read(this.app.workspace.getActiveFile()).then((contents) => {
      const lines = contents.split("\n")
      lines.splice(line + 1, 1, `%%workflow set_temp ${variable} = ${value}%%`)

      this.app.vault.modify(this.app.workspace.getActiveFile(), lines.join("\n"));
    })
  }

  render() {
		const {contentEl, workflowState} = this;
    const context = workflowState.context.join(" > ");

    const workflowText = this.workflowState.getText(this.workflowState.line).join("\n");

    contentEl.empty()

    const header = contentEl.createEl("div");

    if(workflowState.getting.length > 0) {
      workflowState.getting.forEach((instruction) => {
        const settings = new Setting(contentEl);
        settings.setClass("mod-settings")
        settings
        .setName(instruction.name)
        .addText((text) => {
          text
            .onChange((value) => {
              this.setInputValue(instruction.name, value, instruction.line)
            })
          }
        )
      })

      const settings = new Setting(contentEl);
      settings.setClass("mod-settings")

      settings.addButton((btn) => {
        btn
          .setButtonText("Save")
          .onClick(() => {
            this.workflowState.getting = [];
            this.workflowState.lines = removeGetters(this.workflowState.lines);
            this.render();
          })
      })

      
    } else {
      const settings = new Setting(contentEl);
      settings.setClass("mod-settings")

      header.addClass("modal");
      header.createEl('h4', {text: context});
      const list = header.createEl('div')
      Object.keys(workflowState.variables).forEach((key) => {
        list.createEl('span', {text: `${key}: ${workflowState.variables[key]}`});
        list.createEl('br');
      });
      const div = header.createEl('div');

      MarkdownRenderer.renderMarkdown(workflowText, div, '', this.app.workspace.getActiveViewOfType(MarkdownView))

      settings
      .addButton((btn) =>
        btn
          .setButtonText("Cancel Workflow")
          .onClick(() => {
            this.close()
            this.removeLine(true);
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
              this.removeLine(true);
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
  }

  writeLine() {
    this.removeLine(false).then(() => {
      this.app.vault.read(this.app.workspace.getActiveFile()).then((contents) => {
        const lines = contents.split("\n")
        const line = this.workflowState.fileLine + this.workflowState.line;
        lines.splice(line + 1, 0, "%%workflow here%%");
        this.app.vault.modify(this.app.workspace.getActiveFile(), lines.join("\n"));
      })
    });
  }

  removeLine(removeVars?: boolean) {
    return this.app.vault.read(this.app.workspace.getActiveFile()).then((contents) => {
      const lines = contents.split("\n")
      const lastLine = this.workflowState.fileLine + this.workflowState.lastLine;
      const newLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if(i < this.workflowState.fileLine || i > lastLine) {
          newLines.push(lines[i]);
        } else {
          if(lines[i] !== "%%workflow here%%") {
            if(lines[i].startsWith("%%workflow set_temp ") && removeVars) {
              const line = lines[i].replace("%%workflow set_temp ", "%%workflow get ").replace(/(\s+=.*%%$)/, "%%")
              newLines.push(line);
            } else {
              newLines.push(lines[i])
            }
          }
        }
      }
      this.app.vault.modify(this.app.workspace.getActiveFile(), newLines.join("\n"));
    })
  }
}
function removeGetters(lines: string[]) {
  return lines.map((line) => {
    if(line.startsWith("%%workflow get")) {
      return line.replace("%%workflow get", "%%workflow nothing")
    } else {
      return line;
    }
  })
}

function findWorkflowStart(lines: string[], line: number): number {
  for (let i = line; i > 0; i--) {
    if(lines[i] === "%%workflow start%%") {
      return i;
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
  getting: GetVariable[] = [];

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
    if (nextText.startsWith("%%workflow if ")) {
      const expression = nextText.replace(/^(%%workflow if\s)/, "").replace(/(\s*%%$)/, "");
      const parts = expression.split(" = ");
      if(parts.length == 2) {
        const variable = parts[0];
        const value = parts[1];
        if((this.variables[variable.trim()] || "").trim() !== value.trim()) {
          return this.skipNext(next + 1);
        } 
      }
      return this.getNext(next);
    } else if(nextText.startsWith("-")) {
      return next;
    } else {
      return this.getNext(next);
    }
  }

  getText(line: number, acc: string[] = []): string[] {
    if(typeof this.lines[line] === "undefined") return;
    const nextText = (this.lines[line] || "").trimStart();

    // For now, only bullet points are part of the structure
    if (nextText.startsWith("%%workflow if ")) {
      const expression = nextText.replace(/^(%%workflow if\s)/, "").replace(/(\s*%%$)/, "");
      const parts = expression.split(" = ");
      if(parts.length == 2) {
        const variable = parts[0];
        const value = parts[1];
        if((this.variables[variable.trim()] || "").trim() === value.trim()) {
          const newNext = this.skipNext(line);
          if (newNext) {
            this.getText(newNext, acc);
          }
        }
      }

      return acc;
    } else {
      if(nextText.startsWith("-") && acc.length !== 0) {
        return acc;
      } else {
        acc.push(this.lines[line]);
        return this.getText(line + 1, acc);
      }
    }
  }

  skipNext(line: number, takeUntil?: number): number | void {
    const nextText = (this.lines[line] || "").trimStart();

    if(takeUntil) {
      if(nextText.startsWith("#")) {
        const depth = countHashes(nextText);
        if(depth <= takeUntil) {
          return line;
        } else {
          return this.skipNext(line + 1, takeUntil);
        }
      } else {
        return this.skipNext(line + 1, takeUntil)
      }
    } else if(nextText.startsWith("#")) {
      const depth = countHashes(nextText);
      return this.skipNext(line + 1, depth);
    } else if(nextText.startsWith("-")) {
      return this.getNext(line);
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
      const instruction = getInstruction(text, line + this.fileLine);
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
    if (instruction.type === 'get-variable') {
      this.getting.push(instruction)
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
