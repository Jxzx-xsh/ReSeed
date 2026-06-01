# ReSeed

末日种子重生计划

## 项目结构

```
ReSeed/
├── docs/                              # 所有设计文档
│   ├── lore/                          # 世界背景设定
│   │   ├── world_overview.md          # 时间轴、环境、AI三界、主题等
│   │   ├── seed_city.md              # 种子城详细介绍（位置、地标、威胁）
│   │   ├── seed_city_map.md          # 种子城地图（ASCII + 区域详情）
│   │   └── flora_fauna.md            # 硅基苔藓、锈蚀蝙蝠、空荧浮游体等
│   ├── characters/                    # NPC人物卡
│   │   ├── old_ezra.md / arlo.md / samira.md
│   │   ├── anvil.md / mara.md / pax.md
│   │   └── whisperer.md
│   ├── development/                   # 开发规划
│   │   ├── roadmap.md                # 分阶段开发任务
│   │   ├── tech_stack.md            # 技术选型
│   │   ├── api_design.md            # WebSocket/LLM 接口规范
│   │   └── economy_system.md        # 经济与资源系统设计
│   └── future/                        # 未来扩展
│       ├── vr_plan.md / trading_system.md / multiplayer.md
├── client/                            # 前端代码 (PixiJS + Matter.js)
│   ├── src/
│   │   ├── game/                     # 游戏核心逻辑
│   │   ├── entities/                 # 玩家、NPC、资源实体
│   │   ├── rendering/                # PixiJS 渲染与摄像机
│   │   ├── physics/                  # Matter.js 碰撞处理
│   │   └── ui/                       # 对话框、HUD、世界日志
│   ├── assets/
│   ├── index.html
│   └── package.json
├── server/                            # 后端代码 (Node.js + TypeScript)
│   ├── src/
│   │   ├── agents/                   # 智能 NPC 系统
│   │   │   ├── SmartNPC.ts           # 核心：状态机骨架 + LLM 灵魂
│   │   │   ├── SocialEngine.ts       # 社交引擎（自动检测相遇触发对话）
│   │   │   ├── WorldState.ts         # 世界状态（时间、季节、事件）
│   │   │   ├── simulation.ts         # 模拟运行入口
│   │   │   └── profiles/             # NPC 人物配置
│   │   │       ├── ezra-profile.ts   # 老埃兹拉
│   │   │       ├── arlo-profile.ts   # 阿洛
│   │   │       ├── samira-profile.ts # 萨米拉
│   │   │       ├── anvil-profile.ts  # 铁砧
│   │   │       ├── mara-profile.ts   # 玛拉
│   │   │       ├── pax-profile.ts    # 帕克斯
│   │   │       └── index.ts          # 统一导出
│   │   ├── llm/                      # LLM 调用层
│   │   │   ├── LLMClient.ts          # OpenAI API 兼容客户端
│   │   │   ├── EzraPersonality.ts    # 老埃兹拉人格（对话/独白/决策）
│   │   │   └── test-ezra-chat.ts     # 对话测试 & 交互模式
│   │   ├── database/                 # 数据库封装
│   │   │   ├── GameDatabase.ts       # SQLite 操作类
│   │   │   └── test-database.ts      # 集成测试（39项）
│   │   └── websocket/                # 客户端同步（待实现）
│   ├── database/                      # 数据库文件
│   │   ├── schema.sql                # 11张表 Schema + 初始数据
│   │   └── README.md                 # 表关系图 & 查询示例
│   ├── tsconfig.json
│   └── package.json
├── tools/
│   ├── generate_world_seed.js
│   └── test_llm_connection.js
├── .gitignore
├── README.md
└── LICENSE
```

## 模块说明

### docs/
项目文档，包含世界观设定（lore）、NPC 角色档案（characters）、开发规划（development）和未来扩展设想（future）。

### client/
前端渲染与物理模拟，使用 PixiJS 进行 2D 渲染，Matter.js 处理物理引擎逻辑。包含游戏核心、实体管理、UI 组件等模块。

### server/
后端服务，核心是 **SmartNPC 智能体系统**：
- **状态机层**：需求管理、计划推进、位置移动、库存计算（确定性、< 1ms/NPC）
- **LLM 层**：对话生成、内心独白、情绪反应、创意替代方案（按需调用本地 LLM）
- **社交引擎**：自动检测 NPC 同地点相遇，触发自然对话
- **数据库**：SQLite 持久化世界状态、NPC 计划、玩家介入历史

### tools/
辅助脚本，用于世界种子生成和 LLM 连接测试。

## 快速启动

```bash
cd server
npm install

# 运行数据库测试
npm run test:db

# 模拟种子城一天（6个NPC自主行动 + 自然对话）
npm run sim

# 快速模拟（无等待）
npm run sim:fast

# 和老埃兹拉聊天
npm run chat
```

需要本地 LLM 服务运行在 `http://192.168.200.11:1234`（LM Studio / Ollama）。
