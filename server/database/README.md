# 数据库存储方案

## 概述

任务系统使用 SQLite（开发）/ PostgreSQL（生产）存储 NPC 计划状态和玩家介入历史。

## 表结构

```
┌─────────────────┐     ┌──────────────────┐
│   world_state   │     │      npcs        │
│ (全局世界状态)   │     │ (NPC 基础信息)    │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
          ┌─────────┴──┐  ┌─────┴─────┐  ┌──┴──────────────┐
          │ npc_goals   │  │npc_relat- │  │ npc_memories    │
          │ (长期目标)   │  │ionships   │  │ (NPC 记忆)      │
          └──────┬──────┘  │(关系网)    │  └─────────────────┘
                 │         └───────────┘
          ┌──────┴──────┐
          │  npc_plans  │
          │ (执行计划)   │
          └──────┬──────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
┌──────┴───┐ ┌───┴────────┐ ┌───────────────────┐
│plan_steps│ │plan_alter- │ │player_interventions│
│(计划步骤) │ │natives     │ │(玩家介入历史)       │
└──────────┘ │(替代方案)   │ └───────────────────┘
             └────────────┘

┌──────────────┐  ┌──────────────┐
│  world_log   │  │ transactions │
│ (世界日志)    │  │ (交易记录)    │
└──────────────┘  └──────────────┘
```

## 核心表说明

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `world_state` | 全局世界状态（单行） | 时间、季节、活跃事件 |
| `npcs` | NPC 基础属性 | 需求值、库存、位置、状态 |
| `npc_relationships` | NPC 间关系 | 好感度、信任度 |
| `npc_goals` | 长期目标 | 优先级、是否激活/完成 |
| `npc_plans` | 当前执行的计划 | 计划类型、当前步骤、失败次数 |
| `plan_steps` | 计划的具体步骤 | 时长、成功率、尝试次数 |
| `plan_alternatives` | 替代方案执行记录 | 触发步骤、描述、结果 |
| `player_interventions` | 玩家介入历史 | 类型、物品、好感变化、时间影响 |
| `world_log` | 世界事件日志 | 类型、来源、消息 |
| `transactions` | 交易记录 | 买卖双方、商品、价格、地点 |
| `npc_memories` | NPC 记忆（LLM 上下文） | 内容、重要性、衰减强度 |

## 设计要点

### 1. NPC 计划状态持久化

- `npc_plans` 记录当前活跃计划及其进度
- `plan_steps` 细化每个步骤的执行状态
- 停止/重启服务器时，从数据库恢复 NPC 的精确执行位置

### 2. 玩家介入追踪

- `player_interventions` 记录每次玩家与 NPC 的交互
- 包含对计划时间的量化影响（加速/延迟小时数）
- 可用于生成"玩家影响力报告"和触发后续剧情

### 3. NPC 记忆系统

- 记忆有重要性和衰减机制
- LLM 生成对话时，按 `importance × current_strength` 排序取 Top-N 作为上下文
- 每日 Tick 衰减 `current_strength`，低于阈值的记忆可被清理

### 4. 查询模式

```sql
-- 获取 NPC 当前活跃计划及步骤
SELECT p.*, s.*
FROM npc_plans p
JOIN plan_steps s ON s.plan_id = p.id
WHERE p.npc_id = 'old_ezra' AND p.status = 'active'
ORDER BY s.step_index;

-- 获取玩家对某 NPC 的所有介入历史
SELECT * FROM player_interventions
WHERE player_id = 'player_001' AND npc_id = 'old_ezra'
ORDER BY game_day DESC, game_hour DESC;

-- 获取 NPC 最重要的记忆（用于 LLM 上下文）
SELECT * FROM npc_memories
WHERE npc_id = 'old_ezra' AND current_strength > 0.3
ORDER BY importance * current_strength DESC
LIMIT 10;

-- 统计玩家对世界的总影响
SELECT
  player_id,
  COUNT(*) as total_interventions,
  SUM(CASE WHEN intervention_type = 'help' THEN 1 ELSE 0 END) as helps,
  SUM(CASE WHEN intervention_type = 'sabotage' THEN 1 ELSE 0 END) as sabotages,
  SUM(affinity_change) as total_affinity_change,
  SUM(time_impact_hours) as total_time_impact
FROM player_interventions
GROUP BY player_id;
```

## 使用方式

```bash
# 初始化数据库
sqlite3 server/database/reseed.db < server/database/schema.sql

# 或在代码中
import Database from 'better-sqlite3';
const db = new Database('database/reseed.db');
db.exec(fs.readFileSync('database/schema.sql', 'utf-8'));
```

## 迁移策略

- 开发阶段使用 SQLite（零配置，单文件）
- 生产环境切换 PostgreSQL（将 `AUTOINCREMENT` 改为 `SERIAL`，`TEXT` JSON 改为 `JSONB`）
- 迁移文件放在 `server/database/migrations/` 目录
