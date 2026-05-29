import * as vscode from "vscode";
import * as fs from "fs";

let barItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  barItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1,
  );
  barItem.name = "Generate CSS Selectors from HTML file";
  barItem.text = "$(edit) Generate Selectors";
  barItem.command = "css-selector-generator.generate";

  function showTab() {
    const curDoc = vscode.window.activeTextEditor;
    const curDocFsPath = curDoc?.document.uri.fsPath;
    if (curDocFsPath) {
      const isSupportedStyle = /\.(css|scss|less|sass)$/i.test(curDocFsPath);
      isSupportedStyle ? barItem.show() : barItem.hide();
    } else {
      barItem.hide();
    }
  }
  showTab();

  vscode.window.onDidChangeActiveTextEditor(showTab);
  console.log("CSS Selector Generator Activated!");

  const removeDuplicates = function (arr: string[]): string[] {
    const output: string[] = [];
    arr.forEach((el) => (!output.includes(el) ? output.push(el) : false));
    return output;
  };

  const hasClassSelector = function (
    cssContent: string,
    className: string,
  ): boolean {
    const escaped = className.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\.${escaped}\\b`, "g");
    return regex.test(cssContent);
  };

  const hasIdSelector = function (cssContent: string, idName: string): boolean {
    const escaped = idName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`#${escaped}\\b`, "g");
    return regex.test(cssContent);
  };

  const extractSelectorsFromText = function (text: string): {
    allIds: string[];
    allClasses: string[];
  } {
    const ids: string[] = [];
    const classes: string[] = [];

    let cleanText = text + "";
    cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, "");
    cleanText = cleanText.replace(/\/\*[\s\S]*?\*\//g, "");
    cleanText = cleanText.replace(/(?:^|\s)\/\/.*$/gm, "");
    cleanText = cleanText.replace(/<script[\s\S]*?<\/script>/gi, "");
    cleanText = cleanText.replace(/<style[\s\S]*?<\/style>/gi, "");
    cleanText = cleanText.replace(/<\?php[\s\S]*?\?>/gi, "");
    cleanText = cleanText.replace(/<\?[\s\S]*?\?>/gi, "");
    cleanText = cleanText.replace(/<%[\s\S]*?%>/g, "");

    const tagRegex = /<([a-zA-Z0-9_\-:]+)([^>]*?)\/?>/g;
    let tagMatch;

    while ((tagMatch = tagRegex.exec(cleanText)) !== null) {
      const attributesString = tagMatch[2];
      if (!attributesString) continue;

      const attrRegex =
        /\b(class|className|:class|v-bind:class|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|{([\s\S]*?)}|([^\s>]+))/gi;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(attributesString)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const doubleQuoteVal = attrMatch[2];
        const singleQuoteVal = attrMatch[3];
        const curlyBraceVal = attrMatch[4];
        const unquotedVal = attrMatch[5];

        const rawVal = doubleQuoteVal || singleQuoteVal || unquotedVal;

        if (attrName === "id") {
          if (rawVal) {
            ids.push(rawVal.trim());
          } else if (curlyBraceVal) {
            const stringLiteralRegex = /(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
            let strMatch;
            while (
              (strMatch = stringLiteralRegex.exec(curlyBraceVal)) !== null
            ) {
              const val = strMatch[1] || strMatch[2] || strMatch[3];
              if (val) ids.push(val.trim());
            }
          }
        } else if (attrName === "class" || attrName === "classname") {
          if (rawVal) {
            rawVal
              .trim()
              .split(/\s+/)
              .forEach((c) => {
                if (c) classes.push(c);
              });
          } else if (curlyBraceVal) {
            const stringLiteralRegex = /(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
            let strMatch;
            while (
              (strMatch = stringLiteralRegex.exec(curlyBraceVal)) !== null
            ) {
              const val = strMatch[1] || strMatch[2] || strMatch[3];
              if (val) {
                val
                  .trim()
                  .split(/\s+/)
                  .forEach((c) => {
                    if (c) classes.push(c);
                  });
              }
            }
          }
        } else if (attrName === ":class" || attrName === "v-bind:class") {
          if (rawVal) {
            const stringLiteralRegex = /(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
            let strMatch;
            while ((strMatch = stringLiteralRegex.exec(rawVal)) !== null) {
              const val = strMatch[1] || strMatch[2] || strMatch[3];
              if (val) {
                val
                  .trim()
                  .split(/\s+/)
                  .forEach((c) => {
                    if (c) classes.push(c);
                  });
              }
            }
          }
        }
      }

      const svelteClassRegex =
        /\bclass:([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|{[\s\S]*?}|[^\s>]+))?/gi;
      let svelteMatch;
      while ((svelteMatch = svelteClassRegex.exec(attributesString)) !== null) {
        const className = svelteMatch[1];
        if (className) classes.push(className);
      }
    }

    return {
      allIds: removeDuplicates(ids),
      allClasses: removeDuplicates(classes),
    };
  };

  const constructSelectors = function (
    attributName: string,
    arr: string[],
  ): string {
    if (arr.length === 0) return "";
    return (
      "\n" +
      arr
        .map(
          (attribute) =>
            `${attributName == "id" ? "#" : "."}${attribute} {\n \n}`,
        )
        .join("\n")
    );
  };

  const buildSelectorsString = function (
    ids: string[],
    classes: string[],
    fresh: boolean = true,
    includeReset: boolean = true,
  ): string {
    const idSelectors = constructSelectors("id", ids);
    const classSelectors = constructSelectors("class", classes);

    if (!fresh) {
      let result = "";
      if (ids.length > 0) result += `\n/* NEW IDs */${idSelectors}\n`;
      if (classes.length > 0)
        result += `\n/* NEW CLASSes */${classSelectors}\n`;
      return result;
    }

    let result = `/* CODE GENERATED BY CSS SELECTOR GENERATOR */\n`;

    if (includeReset) {
      result += `
* {
	margin: 0;
	border: 0;
}
`;
    }

    result += `\n/* MY IDs */${idSelectors}\n\n/* MY CLASSes */${classSelectors}\n`;
    return result;
  };

  let disposable = vscode.commands.registerCommand(
    "css-selector-generator.generate",
    async function () {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage("No active text editor found.");
        return;
      }

      if (activeEditor.document.isDirty) {
        vscode.window.showWarningMessage(
          "Please save document before generating CSS",
        );
        return;
      }

      try {
        const selectedFiles = await vscode.window.showOpenDialog({
          openLabel: "Generate Selectors",
          canSelectMany: false,
          title: "CSS Selector Generator",
          filters: {
            "HTML, Templates & Components": [
              "html",
              "htm",
              "ejs",
              "jsp",
              "php",
              "vue",
              "svelte",
              "jsx",
              "tsx",
              "js",
              "ts",
            ],
          },
        });

        if (!selectedFiles || selectedFiles.length === 0) {
          return;
        }

        const htmlFile = selectedFiles[0];
        const data = fs.readFileSync(htmlFile.fsPath, {
          encoding: "utf8",
          flag: "r",
        });
        const curDocFsPath = activeEditor.document.uri.fsPath;
        const curFileContent = fs.readFileSync(curDocFsPath, {
          encoding: "utf8",
          flag: "r",
        });

        const { allIds, allClasses } = extractSelectorsFromText(data);

        const missingIds = allIds.filter(
          (id) => !hasIdSelector(curFileContent, id),
        );
        const missingClasses = allClasses.filter(
          (className) => !hasClassSelector(curFileContent, className),
        );

        if (missingIds.length === 0 && missingClasses.length === 0) {
          vscode.window.showInformationMessage(
            "All CSS selectors from this file are already present in the stylesheet!",
          );
          return;
        }

        const quickPick = vscode.window.createQuickPick();
        quickPick.title = "CSS Selector Generator";
        quickPick.placeholder =
          "Select the classes and IDs you want to generate";
        quickPick.canSelectMany = true;

        const quickPickItems: vscode.QuickPickItem[] = [];
        missingIds.forEach((id) => {
          quickPickItems.push({
            label: `#${id}`,
            description: "ID selector",
          });
        });
        missingClasses.forEach((className) => {
          quickPickItems.push({
            label: `.${className}`,
            description: "Class selector",
          });
        });

        quickPick.items = quickPickItems;
        quickPick.selectedItems = quickPickItems;

        quickPick.onDidAccept(async () => {
          const selected = quickPick.selectedItems;
          quickPick.hide();

          if (!selected || selected.length === 0) {
            vscode.window.showInformationMessage(
              "No selectors selected for generation.",
            );
            return;
          }

          const selectedIds = selected
            .filter((item) => item.label.startsWith("#"))
            .map((item) => item.label.slice(1));

          const selectedClasses = selected
            .filter((item) => item.label.startsWith("."))
            .map((item) => item.label.slice(1));

          const fresh = !curFileContent.includes("{");
          const config = vscode.workspace.getConfiguration(
            "css-selector-generator",
          );
          const includeReset = config.get<boolean>("includeReset", true);
          const insertAtCursor = config.get<boolean>("insertAtCursor", false);

          const newSelectorsString = buildSelectorsString(
            selectedIds,
            selectedClasses,
            fresh,
            includeReset,
          );

          try {
            if (insertAtCursor) {
              await activeEditor.edit(
                (editBuilder: {
                  insert: (arg0: any, arg1: string) => void;
                }) => {
                  const position = activeEditor.selection.active;
                  editBuilder.insert(position, newSelectorsString);
                },
              );
            } else {
              const output = fresh
                ? newSelectorsString
                : curFileContent.trimEnd() + "\n" + newSelectorsString;
              fs.writeFileSync(curDocFsPath, output, "utf8");
            }
            vscode.window.showInformationMessage(
              "Thanks for using CSS Selector Generator!",
            );
          } catch (writeError) {
            vscode.window.showErrorMessage("Failed to write to CSS file.");
          }
        });

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
      } catch (error) {
        vscode.window.showErrorMessage(
          "Something went wrong while generating CSS!",
        );
        console.error(error);
      }
    },
  );

  let initializer = vscode.commands.registerCommand(
    "css-selector-generator.initialize",
    function () {
      barItem.show();
      vscode.window.showInformationMessage(
        "CSS Selector Generator initialized",
      );
    },
  );

  context.subscriptions.push(initializer);
  context.subscriptions.push(disposable);
}

export function deactivate() {}
