# caustics（影）

光穿过水面后在水底形成的碎裂光纹 —— 陆洄的微信端投影，一个轻量的 ADHD 友好生活管理 AI 助手。

## 核心功能
- 主动 check-in（温和的日常问候）
- 待办与提醒自动提取与推送
- 每日自动日记（Daily Log）
- 可在线切换 LLM（Claude / GPT / DeepSeek）
- 手机浏览器 Dashboard 控制面板

## 技术栈
- 后端：Node.js + Express
- 数据库：Supabase（PostgreSQL）
- 部署：Render（免费层）
- 微信接入：ClawBot 协议
- LLM 适配：Anthropic / OpenAI 兼容接口

## 项目结构
caustics/
├── .gitignore
├── .env.example
├── package.json
├── README.md
├── public/
│   └── index.html
└── src/
    ├── index.js
    ├── config.js
    ├── middleware/
    │   └── auth.js
    ├── services/
    │   ├── supabase.js
    │   ├── configService.js
    │   ├── memoryService.js
    │   ├── wechatService.js
    │   ├── contextCache.js
    │   ├── checkinService.js
    │   ├── reminderService.js
    │   └── diaryService.js
    ├── llm/
    │   ├── provider.js
    │   ├── anthropic.js
    │   ├── openai.js
    │   └── index.js
    ├── routes/
    │   ├── wechat.js
    │   ├── jobs.js
    │   ├── auth.js
    │   ├── configRoutes.js
    │   └── scheduleRoutes.js
    └── templates/
        └── systemPrompt.js

## 快速部署
1. 在 Supabase 项目执行建表 SQL（见项目文档第六章）
2. 将此仓库连接到 Render 新建 Web Service
3. 在 Render 环境变量中填入所需密钥（参照 `.env.example`）
4. 设置外部 cron 服务（cron-job.org）定时 `POST /api/run-jobs`
5. 设置 UptimeRobot 监控根路径防止 Render 休眠

## Dashboard 访问
服务运行后，浏览器访问服务地址，输入管理密码（默认 `caustics`，请及时在 Supabase 的 `shadow_config` 表中修改 `dashboard_password`）

## 安全提醒
- 仓库为公开，所有敏感信息（API Key、密码）仅存储在 Render 环境变量或 Supabase 数据库中，不会出现在代码里。
- 请勿将 `.env` 文件提交至仓库。