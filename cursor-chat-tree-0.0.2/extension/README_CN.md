# AI Chat Tree

一个在 Cursor / VS Code 侧边栏中以树形结构展示 AI 对话分支的扩展。

> **当前状态：** 早期原型。扩展会从 Cursor 本地数据读取会话并推断 fork 分支；在 Cursor 聊天界面中打开对应会话尚未实现。

## 功能

- 侧边栏树形视图管理对话分支
- **从 Cursor 同步** — 启动时与点击刷新时，读取当前工作区相关的 composer 数据（需要系统已安装 `sqlite3`，并能访问 Cursor 本地数据库）
- **按分支展示** — 子节点是「从共同前缀 fork 出来的独立会话（composer）」，而不是逐条 user/assistant 消息
- 创建、重命名、删除 **本地** 分支（在无法同步 Cursor 时，或用于手动规划）
- 将同步结果缓存到工作区 `.cursor-chat-tree/chats.json`
- 高亮当前选中的节点（实心圆点图标）

## 环境要求

- [Cursor](https://cursor.com/) 或 VS Code `>= 1.85`
- Node.js `>= 18`（从源码构建时需要）
- **PATH 中可用的 `sqlite3` 命令**（用于读取 Cursor 的 `state.vscdb`）。Ubuntu/Debian 示例：`sudo apt install sqlite3`

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

3. **树的结构** — 根节点为工作区名称。其下为各聊天会话（composer）。若 Cursor 中从某条历史前缀 fork 出新会话，新会话会作为 **子分支** 挂在父会话下。没有 fork 的会话为叶子节点。

4. **选中节点** — 点击树中的节点设为当前活动节点（实心圆点图标）。

5. **创建分支** — 点击视图标题栏的 `+`、节点旁的 `+`，或命令面板中的 **AI Chat Tree: Create Branch**。新建分支写入本地 `chats.json`。从 Cursor 同步的节点为只读（这些节点上没有内联 `+`）。

6. **重命名 / 删除** — 右键 **本地** 分支（仅对手动创建的分支显示菜单项），或使用命令面板。

7. **刷新** — 点击视图标题栏的刷新按钮，**从 Cursor 重新同步**并更新缓存 JSON。若同步失败（未安装 `sqlite3`、无 Cursor 数据等），则改为从磁盘加载上次保存的 `chats.json`。

首次启动时会同样尝试 Cursor 同步；失败则回退到已保存或默认的本地分支数据。

### 数据存储位置

分支数据保存在：

```
<工作区根目录>/.cursor-chat-tree/chats.json
```

同步成功后会用 Cursor 构建的树覆盖写入该文件。若不想把本地聊天元数据提交到 Git，可将 `.cursor-chat-tree/` 加入 `.gitignore`（本仓库已忽略）。

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
- `src/parser/` — Cursor 存储读取、composer 发现、fork 树构建（`MessageForkParser`）
- `src/storage/` — JSON 持久化
- `src/commands/` — 创建 / 重命名 / 删除 / 刷新命令
- `esbuild.js` — 生产构建（CommonJS，`vscode` 外部化）

## 已知限制

- 点击树节点不会在 Cursor 中打开对应聊天会话。
- Fork 检测为启发式规则（composer 之间 bubble id 前缀相同且至少两条；子 agent / task 类 composer 会跳过）。Cursor 存储格式变化时可能漏检或误连分支。
- 必须打开至少一个工作区文件夹，且能读取用户目录下的 Cursor 数据（Linux 上一般为 `~/.config/Cursor`）。
- 刷新且同步成功时会用 Cursor 树覆盖缓存；不会与纯本地分支做合并。

## 许可证

以仓库中的许可证文件为准。
