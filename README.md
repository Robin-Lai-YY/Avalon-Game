# Avalon Game

多人实时阿瓦隆（The Resistance: Avalon）网页版，支持 5–10 人局。PWA 应用，使用 Firebase Realtime Database 同步房间与游戏状态。

## 功能概览

- **房间**：创建房间 / 输入房号加入，大厅准备后由房主开始游戏
- **角色**：按人数自动发牌（梅林、派西维尔、忠臣、刺客、莫甘娜等），详见 [Avalon_Roles.md](./Avalon_Roles.md)
- **流程**：选队 → 组队投票（通过/否决）→ 任务投票（好人只能投成功，坏人可投失败）→ 回合结果 → 好人 3 胜进入刺杀阶段 → 刺客猜梅林 → 游戏结束
- **规则**：队长每轮轮换；游戏内可点击「查看身份/视角」临时查看自己的身份与可见玩家，再点一次隐藏

## 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS，PWA
- **后端/同步**：Firebase Realtime Database（仅存共享状态，逻辑在客户端）

## 快速开始

### 1. 克隆与安装

```bash
git clone https://github.com/Robin-Lai-YY/Avalon-Game.git
cd Avalon-Game/avalon-pwa
npm install
```

### 2. 配置 Firebase

1. 在 [Firebase Console](https://console.firebase.google.com/) 创建项目并启用 **Realtime Database**。
2. 在项目概览中添加 **Web 应用**，获取 `firebaseConfig`。
3. 在 `avalon-pwa` 目录下复制环境示例并填入配置：

```bash
cp .env.example .env
```

编辑 `.env`，填入：

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`（Realtime Database 的 URL）
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

4. 部署数据库规则（可选，用于生产环境）：`firebase deploy --only database`（需先 `npm install -g firebase-tools` 并 `firebase login`）。

更多步骤见 [avalon-pwa/FIREBASE_SETUP.md](./avalon-pwa/FIREBASE_SETUP.md)。

### 3. 运行

```bash
npm run dev
```

浏览器打开 `http://localhost:5173`。一人创建房间，其余人用房号加入，全部准备后房主点「开始游戏」即可。

### 4. 构建与预览

```bash
npm run build
npm run preview
```

## 项目结构

```
Avalon-Game/
├── README.md                 # 本文件
├── Avalon_Roles.md           # 5–10 人局角色与视角说明
├── avalon-pwa/               # 前端 PWA 应用
│   ├── src/
│   │   ├── pages/            # 首页、大厅、角色页、游戏页、结果页
│   │   ├── components/       # 选队、投票、任务、刺杀等组件
│   │   ├── services/         # Firebase 与 gameEngine
│   │   └── utils/             # 任务人数、洗牌等
│   ├── e2e/                  # Playwright E2E 测试
│   ├── .env.example          # 环境变量示例（勿提交 .env）
│   └── FIREBASE_SETUP.md      # Firebase 配置说明
├── system_prompt.md
├── tasks.md
├── trd.md
└── ui_wireframe.md
```

## 测试

```bash
cd avalon-pwa
npm run playwright:install   # 首次需安装 Chromium
npm run test:e2e            # 需先 npm run dev 或复用已有 5173 服务
```

## 许可证

Private / 未指定开源协议。
