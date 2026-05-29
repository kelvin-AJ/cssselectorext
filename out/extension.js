"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var barItem;
function activate(context) {
  barItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1
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
  const removeDuplicates = function(arr) {
    const output = [];
    arr.forEach((el) => !output.includes(el) ? output.push(el) : false);
    return output;
  };
  const hasClassSelector = function(cssContent, className) {
    const escaped = className.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\.${escaped}\\b`, "g");
    return regex.test(cssContent);
  };
  const hasIdSelector = function(cssContent, idName) {
    const escaped = idName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`#${escaped}\\b`, "g");
    return regex.test(cssContent);
  };
  const extractSelectorsFromText = function(text) {
    const ids = [];
    const classes = [];
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
      const attrRegex = /\b(class|className|:class|v-bind:class|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|{([\s\S]*?)}|([^\s>]+))/gi;
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
            while ((strMatch = stringLiteralRegex.exec(curlyBraceVal)) !== null) {
              const val = strMatch[1] || strMatch[2] || strMatch[3];
              if (val) ids.push(val.trim());
            }
          }
        } else if (attrName === "class" || attrName === "classname") {
          if (rawVal) {
            rawVal.trim().split(/\s+/).forEach((c) => {
              if (c) classes.push(c);
            });
          } else if (curlyBraceVal) {
            const stringLiteralRegex = /(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;
            let strMatch;
            while ((strMatch = stringLiteralRegex.exec(curlyBraceVal)) !== null) {
              const val = strMatch[1] || strMatch[2] || strMatch[3];
              if (val) {
                val.trim().split(/\s+/).forEach((c) => {
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
                val.trim().split(/\s+/).forEach((c) => {
                  if (c) classes.push(c);
                });
              }
            }
          }
        }
      }
      const svelteClassRegex = /\bclass:([a-zA-Z0-9_\-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|{[\s\S]*?}|[^\s>]+))?/gi;
      let svelteMatch;
      while ((svelteMatch = svelteClassRegex.exec(attributesString)) !== null) {
        const className = svelteMatch[1];
        if (className) classes.push(className);
      }
    }
    return {
      allIds: removeDuplicates(ids),
      allClasses: removeDuplicates(classes)
    };
  };
  const constructSelectors = function(attributName, arr) {
    if (arr.length === 0) return "";
    return "\n" + arr.map(
      (attribute) => `${attributName == "id" ? "#" : "."}${attribute} {
 
}`
    ).join("\n");
  };
  const buildSelectorsString = function(ids, classes, fresh = true, includeReset = true) {
    const idSelectors = constructSelectors("id", ids);
    const classSelectors = constructSelectors("class", classes);
    if (!fresh) {
      let result2 = "";
      if (ids.length > 0) result2 += `
/* NEW IDs */${idSelectors}
`;
      if (classes.length > 0)
        result2 += `
/* NEW CLASSes */${classSelectors}
`;
      return result2;
    }
    let result = `/* CODE GENERATED BY CSS SELECTOR GENERATOR */
`;
    if (includeReset) {
      result += `
* {
	margin: 0;
	border: 0;
}
`;
    }
    result += `
/* MY IDs */${idSelectors}

/* MY CLASSes */${classSelectors}
`;
    return result;
  };
  let disposable = vscode.commands.registerCommand(
    "css-selector-generator.generate",
    async function() {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage("No active text editor found.");
        return;
      }
      if (activeEditor.document.isDirty) {
        vscode.window.showWarningMessage(
          "Please save document before generating CSS"
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
              "ts"
            ]
          }
        });
        if (!selectedFiles || selectedFiles.length === 0) {
          return;
        }
        const htmlFile = selectedFiles[0];
        const data = fs.readFileSync(htmlFile.fsPath, {
          encoding: "utf8",
          flag: "r"
        });
        const curDocFsPath = activeEditor.document.uri.fsPath;
        const curFileContent = fs.readFileSync(curDocFsPath, {
          encoding: "utf8",
          flag: "r"
        });
        const { allIds, allClasses } = extractSelectorsFromText(data);
        const missingIds = allIds.filter(
          (id) => !hasIdSelector(curFileContent, id)
        );
        const missingClasses = allClasses.filter(
          (className) => !hasClassSelector(curFileContent, className)
        );
        if (missingIds.length === 0 && missingClasses.length === 0) {
          vscode.window.showInformationMessage(
            "All CSS selectors from this file are already present in the stylesheet!"
          );
          return;
        }
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = "CSS Selector Generator";
        quickPick.placeholder = "Select the classes and IDs you want to generate";
        quickPick.canSelectMany = true;
        const quickPickItems = [];
        missingIds.forEach((id) => {
          quickPickItems.push({
            label: `#${id}`,
            description: "ID selector"
          });
        });
        missingClasses.forEach((className) => {
          quickPickItems.push({
            label: `.${className}`,
            description: "Class selector"
          });
        });
        quickPick.items = quickPickItems;
        quickPick.selectedItems = quickPickItems;
        quickPick.onDidAccept(async () => {
          const selected = quickPick.selectedItems;
          quickPick.hide();
          if (!selected || selected.length === 0) {
            vscode.window.showInformationMessage(
              "No selectors selected for generation."
            );
            return;
          }
          const selectedIds = selected.filter((item) => item.label.startsWith("#")).map((item) => item.label.slice(1));
          const selectedClasses = selected.filter((item) => item.label.startsWith(".")).map((item) => item.label.slice(1));
          const fresh = !curFileContent.includes("{");
          const config = vscode.workspace.getConfiguration(
            "css-selector-generator"
          );
          const includeReset = config.get("includeReset", true);
          const insertAtCursor = config.get("insertAtCursor", false);
          const newSelectorsString = buildSelectorsString(
            selectedIds,
            selectedClasses,
            fresh,
            includeReset
          );
          try {
            if (insertAtCursor) {
              await activeEditor.edit(
                (editBuilder) => {
                  const position = activeEditor.selection.active;
                  editBuilder.insert(position, newSelectorsString);
                }
              );
            } else {
              const output = fresh ? newSelectorsString : curFileContent.trimEnd() + "\n" + newSelectorsString;
              fs.writeFileSync(curDocFsPath, output, "utf8");
            }
            vscode.window.showInformationMessage(
              "Thanks for using CSS Selector Generator!"
            );
          } catch (writeError) {
            vscode.window.showErrorMessage("Failed to write to CSS file.");
          }
        });
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
      } catch (error) {
        vscode.window.showErrorMessage(
          "Something went wrong while generating CSS!"
        );
        console.error(error);
      }
    }
  );
  let initializer = vscode.commands.registerCommand(
    "css-selector-generator.initialize",
    function() {
      barItem.show();
      vscode.window.showInformationMessage(
        "CSS Selector Generator initialized"
      );
    }
  );
  context.subscriptions.push(initializer);
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
