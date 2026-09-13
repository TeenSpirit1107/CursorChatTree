# AI Chat Tree

A Cursor / VS Code extension that visualizes AI chat conversation branches as a tree in the sidebar.

> **Status:** Early prototype. The tree reads Cursor chat sessions from local storage and infers fork branches; opening a branch in the Cursor chat UI is not implemented yet.

## Features

- Sidebar tree view for chat branches
- **Sync from Cursor** — on load and when you refresh, reads composer data for the open workspace (requires the `sqlite3` CLI and Cursor’s local databases)
- **Fork-aware tree** — nested nodes are separate chat sessions (composers) branched from a shared prefix, not individual user/assistant messages
- Create, rename, and delete **local** branches (when Cursor sync is unavailable or for manual planning)
- Cache synced trees per workspace in `.cursor-chat-tree/chats.json`
- Highlight the currently selected node (filled circle icon)

## Requirements

- [Cursor](https://cursor.com/) or VS Code `>= 1.85`
- Node.js `>= 18` (for building from source)
- **`sqlite3` on your PATH** (for reading Cursor’s `state.vscdb` files). On Ubuntu/Debian: `sudo apt install sqlite3`

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

1. Build the extension package (requires **Node.js 18+** for `vsce`; Node 16 will fail with `ReadableStream is not defined`):

   ```bash
   npm install
   npm run build
   npx @vscode/vsce package --allow-missing-repository
   ```

   This creates a file like `cursor-chat-tree-0.0.1.vsix` in the project root.

2. In Cursor, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

3. Run **Extensions: Install from VSIX...** and select the `.vsix` file.

4. Reload Cursor when prompted.

5. Open a workspace folder, then click the **AI Chat Tree** icon in the Activity Bar.

## Usage

1. **Open a workspace** — the extension stores data under `.cursor-chat-tree/` in the first workspace folder. If no folder is open, you will see a warning and the tree will not load.

2. **Open the view** — click the tree icon in the Activity Bar, or run **View: Open View** and pick **AI Chat Tree**.

3. **Tree shape** — the root is your workspace name. Under it are chat sessions (composers). When Cursor created a fork (a new composer sharing an earlier message prefix with an older chat), the fork appears as a **child branch** under the parent session. Sessions without forks are leaf nodes.

4. **Select a node** — click a node in the tree to mark it as active (filled circle icon).

5. **Create a branch** — use the `+` button in the view title bar, the inline `+` on a node, or run **AI Chat Tree: Create Branch** from the Command Palette. New branches are stored locally in `chats.json`. Nodes synced from Cursor are read-only in the UI (no inline `+` on those nodes).

6. **Rename / delete** — right-click a **local** branch (context menu shows these only for manually created branches), or use the Command Palette.

7. **Refresh** — use the refresh button in the view title bar to **re-sync from Cursor** and update the cached JSON. If sync fails (missing `sqlite3`, no Cursor data, etc.), the extension reloads the last saved `chats.json` instead.

On first launch, the extension tries the same Cursor sync; if that fails, it falls back to saved or default local branch data.

### Data storage

Branch data is saved to:

```
<workspace>/.cursor-chat-tree/chats.json
```

After a successful sync, this file mirrors the tree built from Cursor. You may want to add `.cursor-chat-tree/` to `.gitignore` if you do not want to commit local chat metadata (this repo ignores it).

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
- `src/parser/` — Cursor storage reader, composer discovery, fork tree (`MessageForkParser`)
- `src/storage/` — JSON persistence
- `src/commands/` — create / rename / delete / refresh
- `esbuild.js` — production bundle (CommonJS, `vscode` externalized)

## Known limitations

- Clicking a node does not open the corresponding Cursor chat session.
- Fork detection is heuristic (shared bubble-id prefix between composers, minimum two shared messages; subagent/task composes are omitted). Unusual Cursor storage layouts may miss or mis-link branches.
- Requires at least one open workspace folder and readable Cursor data under your user config (`~/.config/Cursor` on Linux, etc.).
- Refresh overwrites the cached tree when Cursor sync succeeds; purely local branches are not merged with synced data.

## License

See repository license file if present.
