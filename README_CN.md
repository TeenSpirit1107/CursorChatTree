# AI Chat Tree

一个在 Cursor / VS Code 侧边栏中以树形结构展示 AI 对话分支的扩展。

> **当前状态：** 早期原型。树形界面和本地存储可用；在 Cursor 中打开对应聊天会话尚未实现。

## 功能

- 侧边栏树形视图管理对话分支
- 创建、重命名、删除分支
- 按工作区将分支数据保存到 `.cursor-chat-tree/chats.json`
- 高亮当前选中的分支

## 环境要求

- [Cursor](https://cursor.com/) 或 VS Code `>= 1.85`
- Node.js `>= 18`（从源码构建时需要）

## 在 Cursor 中安装

有两种常用方式：**开发模式**（适合改代码、调试）和 **安装 VSIX 包**（适合日常使用）。

### 方式 A — 开发模式（推荐给开发者）

1. 克隆仓库并在 Cursor 中打开项目目录：

   ```bash
   git clone <repo-url>
   cd CursorChatTree-ws
   npm install
   npm run build
   ```

2. 按 **F5**（或打开 **运行和调试**，选择 **Run Extension**）。

3. 会弹出一个新的 **Extension Development Host** 窗口，扩展已在此窗口中加载。

4. 在该窗口中 **打开一个工作区文件夹**（文件 → 打开文件夹）。扩展需要工作区才能读写数据。

5. 点击左侧活动栏的 **AI Chat Tree** 图标，打开树形视图。

开发时可在终端运行 `npm run watch` 自动重新构建，然后在 Extension Development Host 窗口中重新加载扩展。

### 方式 B — 从 VSIX 安装

1. 打包扩展（`vsce` 需要 **Node.js 18+**；Node 16 会报 `ReadableStream is not defined`）：

   ```bash
   npm install
   npm run build
   npx @vscode/vsce package --allow-missing-repository
   ```

   会在项目根目录生成类似 `cursor-chat-tree-0.0.1.vsix` 的文件。

2. 在 Cursor 中打开命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）。

3. 执行 **Extensions: Install from VSIX...**（扩展：从 VSIX 安装...），选择生成的 `.vsix` 文件。

4. 按提示重新加载 Cursor。

5. 打开一个工作区文件夹，点击活动栏的 **AI Chat Tree** 图标即可使用。

## 使用方法

1. **打开工作区** — 扩展会在第一个工作区文件夹下创建 `.cursor-chat-tree/` 目录保存数据。若未打开文件夹，会提示警告且树不会加载。

2. **打开视图** — 点击活动栏的树形图标，或通过命令面板运行 **View: Open View**，选择 **AI Chat Tree**。

3. **选中分支** — 点击树中的节点即可设为当前活动分支（加粗显示）。

4. **创建分支** — 点击视图标题栏的 `+` 按钮、节点旁的 `+`，或命令面板中的 **AI Chat Tree: Create Branch**。

5. **重命名** — 右键分支（根节点除外）选择 **Rename**，或使用命令面板。

6. **删除** — 右键分支选择 **Delete**，会同时删除其所有子分支。

7. **刷新** — 点击视图标题栏的刷新按钮，从磁盘重新加载数据。

### 数据存储位置

分支数据保存在：

```
<工作区根目录>/.cursor-chat-tree/chats.json
```

若不想把本地聊天元数据提交到 Git，可将 `.cursor-chat-tree/` 加入项目的 `.gitignore`。

## 开发

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run build` | 打包到 `dist/extension.js` |
| `npm run watch` | 监听文件变更并自动构建 |
| `npm run compile` | 使用 `tsc --noEmit` 做类型检查 |

项目结构：

- `src/extension.ts` — 扩展激活与树视图注册
- `src/tree/` — 树数据提供者与节点项
- `src/storage/` — JSON 持久化
- `src/commands/` — 创建 / 重命名 / 删除 / 刷新命令
- `esbuild.js` — 生产构建（CommonJS，`vscode` 外部化）

## 已知限制

- 尚未读取或同步 Cursor 内置聊天历史（`ChatParser` 仍为占位实现）。
- 点击分支不会打开对应的 Cursor 聊天会话。
- 必须至少打开一个工作区文件夹。

## 许可证

以仓库中的许可证文件为准。
