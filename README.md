# AI Chat Tree

A Cursor / VS Code extension that visualizes AI chat conversation branches as a tree in the sidebar.

> **Status:** Early prototype. The tree UI and local storage work; opening a branch in Cursor chat is not implemented yet.

## Features

- Sidebar tree view for chat branches
- Create, rename, and delete branches
- Persist branch data per workspace in `.cursor-chat-tree/chats.json`
- Highlight the currently selected branch

## Requirements

- [Cursor](https://cursor.com/) or VS Code `>= 1.85`
- Node.js `>= 18` (for building from source)

## Install in Cursor

You can use either **development mode** (best while hacking on the extension) or **install a VSIX** (best for daily use).

### Option A — Development mode (recommended for contributors)

1. Clone this repo and open the project folder in Cursor:

   ```bash
   git clone <repo-url>
   cd CursorChatTree-ws
   npm install
   npm run build
   ```

2. Press **F5** (or open **Run and Debug** and choose **Run Extension**).

3. A new **Extension Development Host** window opens with the extension loaded.

4. In that window, open a **workspace folder** (File → Open Folder). The extension needs a workspace to store data.

5. Click the **AI Chat Tree** icon in the Activity Bar (left sidebar) to open the tree view.

To iterate on code, run `npm run watch` in a terminal so changes rebuild automatically, then reload the Extension Development Host window.

### Option B — Install from a VSIX package

1. Build the extension package:

   ```bash
   npm install
   npm run build
   npx @vscode/vsce package
   ```

   This creates a file like `cursor-chat-tree-0.0.1.vsix` in the project root.

2. In Cursor, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

3. Run **Extensions: Install from VSIX...** and select the `.vsix` file.

4. Reload Cursor when prompted.

5. Open a workspace folder, then click the **AI Chat Tree** icon in the Activity Bar.

## Usage

1. **Open a workspace** — the extension stores data under `.cursor-chat-tree/` in the first workspace folder. If no folder is open, you will see a warning and the tree will not load.

2. **Open the view** — click the tree icon in the Activity Bar, or run **View: Open View** and pick **AI Chat Tree**.

3. **Select a branch** — click a node in the tree to mark it as active (shown in bold).

4. **Create a branch** — use the `+` button in the view title bar, the inline `+` on a node, or run **AI Chat Tree: Create Branch** from the Command Palette.

5. **Rename** — right-click a branch (not the root) and choose **Rename**, or use the Command Palette.

6. **Delete** — right-click a branch and choose **Delete**. This removes the branch and all of its children.

7. **Refresh** — use the refresh button in the view title bar to reload data from disk.

### Data storage

Branch data is saved to:

```
<workspace>/.cursor-chat-tree/chats.json
```

You may want to add `.cursor-chat-tree/` to `.gitignore` if you do not want to commit local chat metadata (this repo already ignores it in development docs).

## Development

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Bundle extension to `dist/extension.js` |
| `npm run watch` | Rebuild on file changes |
| `npm run compile` | Type-check with `tsc --noEmit` |

Project layout:

- `src/extension.ts` — activation and tree view registration
- `src/tree/` — tree provider and items
- `src/storage/` — JSON persistence
- `src/commands/` — create / rename / delete / refresh
- `esbuild.js` — production bundle (CommonJS, `vscode` externalized)

## Known limitations

- Does not yet read or sync with Cursor's built-in chat history (`ChatParser` is a placeholder).
- Clicking a branch does not open the corresponding Cursor chat session.
- Requires at least one open workspace folder.

## License

See repository license file if present.
