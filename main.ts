import { Plugin, App, OpenViewState, Workspace, WorkspaceLeaf, PluginSettingTab, Setting, TFile } from "obsidian";
import { around } from 'monkey-around';

interface YamlRule {
	key: string;
	value: string;
}

interface OpenInNewTabSettings {
	rules: YamlRule[];
}

const DEFAULT_SETTINGS: OpenInNewTabSettings = {
	rules: [{ key: "type", value: "hub" }]
}

export default class OpenInNewTabPlugin extends Plugin {
	settings: OpenInNewTabSettings;
	uninstallMonkeyPatch: () => void;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new OpenInNewTabSettingTab(this.app, this));

		this.monkeyPatchOpenLinkText();

		this.registerDomEvent(document, "click", this.generateClickHandler(this.app), {
			capture: true,
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload(): void {
		this.uninstallMonkeyPatch && this.uninstallMonkeyPatch();
	}

	shouldOpenInNewTab(path: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return true;

		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) return true;

		const isIgnoreTarget = this.settings.rules.some(rule =>
			rule.key && frontmatter[rule.key] === rule.value
		);

		return !isIgnoreTarget;
	}

	monkeyPatchOpenLinkText() {
		const self = this;
		this.uninstallMonkeyPatch = around(Workspace.prototype, {
			openLinkText(oldOpenLinkText) {
				return async function (
					linkText: string,
					sourcePath: string,
					newLeaf?: boolean,
					openViewState?: OpenViewState) {

					const fileName = linkText.split("#")?.[0];
					const fullPath = fileName === "" ? sourcePath : `${fileName}${fileName.endsWith('.md') ? '' : '.md'}`;
					const isSameFile = fileName === "" || `${fileName}.md` === sourcePath;

					let fileAlreadyOpen = false;
					if (!isSameFile) {
						this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
							const viewState = leaf.getViewState();
							const matchesMarkdownFile = viewState.type === 'markdown' && viewState.state?.file?.endsWith(`${fileName}.md`);
							if (matchesMarkdownFile) {
								this.app.workspace.setActiveLeaf(leaf);
								fileAlreadyOpen = true;
							}
						});
					}

					// YAML 조건에 따른 새 탭 여부 결정
					let openNewLeaf = self.shouldOpenInNewTab(fullPath);

					if (isSameFile) {
						openNewLeaf = newLeaf || false;
					} else if (fileAlreadyOpen) {
						openNewLeaf = false;
					}

					return oldOpenLinkText && oldOpenLinkText.apply(this, [
						linkText,
						sourcePath,
						openNewLeaf,
						openViewState,
					]);
				}
			},
		});
	}

	// 2. 파일 탐색기 등에서의 클릭 핸들러
	generateClickHandler(appInstance: App) {
		const self = this;
		return function (event: MouseEvent) {
			const target = event.target as Element;
			const isNavFile = target?.classList?.contains("nav-file-title") || target?.classList?.contains("nav-file-title-content");
			const titleEl = target?.closest(".nav-file-title");
			const pureClick = !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

			if (isNavFile && titleEl && pureClick) {
				const path = titleEl.getAttribute("data-path");
				if (path) {
					let result = false;
					appInstance.workspace.iterateAllLeaves((leaf) => {
						if (leaf.getViewState().state?.file === path) {
							appInstance.workspace.setActiveLeaf(leaf);
							result = true;
						}
					});

					const emptyLeaves = appInstance.workspace.getLeavesOfType("empty");
					if (emptyLeaves.length > 0) {
						appInstance.workspace.setActiveLeaf(emptyLeaves[0]);
						return;
					}

					if (!result) {
						event.stopPropagation();
						const openNewLeaf = self.shouldOpenInNewTab(path);
						appInstance.workspace.openLinkText(path, path, openNewLeaf);
					}
				}
			}
		}
	}
}

// 3. 설정 탭 구현
class OpenInNewTabSettingTab extends PluginSettingTab {
	plugin: OpenInNewTabPlugin;

	constructor(app: App, plugin: OpenInNewTabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "새 탭 열기 예외 규칙" });

		new Setting(containerEl)
			.setName("Add Rule")
			.setDesc("특정 YAML 조건일 때 기존 탭에서 열리도록 설정합니다.")
			.addButton((button) => {
				button.setButtonText("+")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.rules.push({ key: "", value: "" });
						await this.plugin.saveSettings();
						this.display();
					});
			});

		this.plugin.settings.rules.forEach((rule, index) => {
			const s = new Setting(containerEl)
				.addText((text) =>
					text.setPlaceholder("속성")
						.setValue(rule.key)
						.onChange(async (value) => {
							rule.key = value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text.setPlaceholder("값")
						.setValue(rule.value)
						.onChange(async (value) => {
							rule.value = value;
							await this.plugin.saveSettings();
						})
				)
				.addButton((button) => {
					button.setButtonText("-")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.rules.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						});
				});
			s.infoEl.remove();
		});
	}
}