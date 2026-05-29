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

    const buildSelectorsString = function (ids: string[], classes: string[], fresh: boolean = true, includeReset: boolean = true): string {
      // Sort for deterministic output
      const sortedIds = [...ids].sort();
      const sortedClasses = [...classes].sort();
      const idSelectors = constructSelectors("id", sortedIds);
      const classSelectors = constructSelectors("class", sortedClasses);

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
        // Scan the current workspace for supported markup files
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          vscode.window.showErrorMessage("No workspace folder open.");
          return;
        }
        const rootUri = workspaceFolders[0].uri;
        const globPattern = "**/*.{html,htm,ejs,jsp,php,vue,svelte,jsx,tsx,js,ts}";
        const uris = await vscode.workspace.findFiles(globPattern);
        if (uris.length === 0) {
          vscode.window.showInformationMessage("No supported markup files found in the workspace.");
          return;
        }
        // Convert URIs to quick pick items
        const filePickItems = uris.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri }));
        const selectedFileItem = await vscode.window.showQuickPick(filePickItems, {
          placeHolder: "Select a markup file to generate CSS selectors from",
          canPickMany: false,
        });
        if (!selectedFileItem) {
          return; // User cancelled
        }
        const htmlFile = selectedFileItem.uri;

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

          // Prepare the final output string
          let finalOutput: string;
          if (insertAtCursor) {
            finalOutput = newSelectorsString; // will be inserted at cursor later
          } else {
            finalOutput = fresh ? newSelectorsString : curFileContent.trimEnd() + "\n" + newSelectorsString;
          }

          // Show a diff preview
          const previewDoc = await vscode.workspace.openTextDocument({
            content: finalOutput,
            language: "css",
          });
          await vscode.commands.executeCommand(
            "vscode.diff",
            vscode.Uri.file(curDocFsPath),
            previewDoc.uri,
            "Current ↔ Generated CSS",
          );

          const apply = await vscode.window.showQuickPick(["Apply", "Cancel"], {
            placeHolder: "Apply the generated CSS?",
          });
          if (apply !== "Apply") {
            return; // abort
          }

          try {
            if (insertAtCursor) {
              await activeEditor.edit((editBuilder) => {
                const position = activeEditor.selection.active;
                editBuilder.insert(position, finalOutput);
              });
            } else {
              fs.writeFileSync(curDocFsPath, finalOutput, "utf8");
            }
            vscode.window.showInformationMessage("Thanks for using CSS Selector Generator!");
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
