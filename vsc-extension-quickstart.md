# Welcome to your VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your upgraded extension.
* `package.json` - this is the manifest file in which you declare your extension, commands, user configurations, and supported language activation events (like SCSS, LESS, SASS, Vue, and React).
* `src/extension.ts` - this is the main TypeScript file where you provide the implementation of your commands and logic.
  * The file exports an `activate` function, which initializes the interactive QuickPick dialog, token-based DOM parser, and dynamic CSS generator.

## Get up and running straight away

* Run `pnpm install` in your terminal to install dependencies.
* Run `pnpm run compile` to bundle the extension using `esbuild`. 
* Alternatively, run `pnpm run watch` to have esbuild automatically recompile the code as you save changes.
* Press `F5` to open a new window with your extension loaded.
* Open a `.css`, `.scss`, or `.less` file to see the "Generate Selectors" Status Bar button appear.

## Make changes

* You can safely write strict TypeScript code inside `src/extension.ts`. 
* Since the project uses `esbuild`, the code compiles instantly.
* You can relaunch the extension from the debug toolbar after changing code, or reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Run tests

* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.

## Go further

 * [Follow UX guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) to create extensions that seamlessly integrate with VS Code's native interface.
 * Customize your new `package.json` configuration options (`css-selector-generator.insertAtCursor`, `css-selector-generator.includeReset`).
 * [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
