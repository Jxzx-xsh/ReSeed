-- ============================================================
-- ReSeed 任务系统数据库 Schema
-- 用于保存 NPC 计划状态、玩家介入历史
-- 数据库: SQLite (开发) / PostgreSQL (生产)
-- ============================================================

-- ============================================================
-- 1. 世界状态表
-- ============================================================

CREATE TABLE IF NOT EXISTS world_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_day INTEGER NOT NULL DEFAULT 1,
  current_hour INTEGER NOT NULL DEFAULT 0,
  season TEXT NOT NULL DEFAULT 'ash' CHECK (season IN ('ash', 'acid_rain', 'awakening')),
  total_ticks INTEGER NOT NULL DEFAULT 0,
  active_events TEXT DEFAULT '[]',  -- JSON 数组
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. NPC 基础信息表
-- ============================================================

CREATE TABLE IF NOT EXISTS npcs (
  id TEXT PRIMARY KEY,                    -- 'old_ezra', 'arlo', 'mara' 等
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'executing', 'blocked', 'failed', 'sleeping')),
  location TEXT DEFAULT 'center_plaza',   -- 当前位置（对应地图区域 ID）

  -- 需求值 (0-100)
  hunger REAL NOT NULL DEFAULT 70,
  thirst REAL NOT NULL DEFAULT 65,
  energy REAL NOT NULL DEFAULT 80,
  social REAL NOT NULL DEFAULT 40,

  -- 库存 (JSON)
  inventory TEXT NOT NULL DEFAULT '{}',

  -- 时间追踪
  total_hours_elapsed INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. NPC 关系表
-- ============================================================

CREATE TABLE IF NOT EXISTS npc_relationships (
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,                -- 可以是 NPC ID 或 'player:{player_id}'
  affinity INTEGER NOT NULL DEFAULT 0,    -- -100 ~ 100
  trust INTEGER NOT NULL DEFAULT 0,       -- -100 ~ 100
  notes TEXT DEFAULT '',                  -- 关系备注（LLM 可读）
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (npc_id, target_id)
);

-- ============================================================
-- 4. 长期目标表
-- ============================================================

CREATE TABLE IF NOT EXISTS npc_goals (
  id TEXT PRIMARY KEY,                    -- 'old_ezra:repair_comms_tower'
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,                -- 'repair_comms_tower', 'collect_batteries' 等
  priority INTEGER NOT NULL DEFAULT 5,    -- 1-10, 越高越优先
  active BOOLEAN NOT NULL DEFAULT TRUE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP,
  metadata TEXT DEFAULT '{}',             -- JSON: 额外参数
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_npc_goals_npc ON npc_goals(npc_id);
CREATE INDEX idx_npc_goals_active ON npc_goals(npc_id, active, completed);

-- ============================================================
-- 5. 计划表（当前执行中的计划）
-- ============================================================

CREATE TABLE IF NOT EXISTS npc_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES npc_goals(id),  -- 关联的长期目标（可为空，如紧急需求计划）
  plan_type TEXT NOT NULL,                -- 'repair_comms_tower', 'find_food' 等
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'failed', 'abandoned')),
  current_step_index INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  abandoned_reason TEXT                   -- 放弃原因
);

CREATE INDEX idx_npc_plans_npc ON npc_plans(npc_id);
CREATE INDEX idx_npc_plans_active ON npc_plans(npc_id, status);

-- ============================================================
-- 6. 计划步骤表
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES npc_plans(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,            -- 步骤顺序
  name TEXT NOT NULL,                     -- 'inspect_tower', 'collect_parts' 等
  description TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,        -- 所需游戏小时
  hours_spent INTEGER NOT NULL DEFAULT 0, -- 已花费小时
  success_rate REAL NOT NULL DEFAULT 0.5, -- 0~1 成功概率
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,    -- 尝试次数
  completed_at TIMESTAMP,
  failure_reason TEXT,

  UNIQUE(plan_id, step_index)
);

CREATE INDEX idx_plan_steps_plan ON plan_steps(plan_id);

-- ============================================================
-- 7. 替代方案执行记录
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_alternatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES npc_plans(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,            -- 在哪个步骤触发的
  description TEXT NOT NULL,              -- '求助铁砧协助', '从玛拉购买零件' 等
  applied BOOLEAN NOT NULL DEFAULT TRUE,
  result TEXT,                            -- 'success' / 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. 玩家介入历史表
-- ============================================================

CREATE TABLE IF NOT EXISTS player_interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,                -- 玩家标识
  npc_id TEXT NOT NULL REFERENCES npcs(id),
  intervention_type TEXT NOT NULL
    CHECK (intervention_type IN ('help', 'sabotage', 'trade', 'dialogue', 'quest_accept', 'quest_complete')),

  -- 介入详情
  item_type TEXT,                         -- 'radio_parts', 'credits', 'nuclear_battery' 等
  quantity INTEGER DEFAULT 0,
  plan_id INTEGER REFERENCES npc_plans(id),  -- 影响的计划（可为空）
  step_index INTEGER,                    -- 影响的步骤

  -- 影响结果
  affinity_change INTEGER DEFAULT 0,      -- 好感度变化
  time_impact_hours INTEGER DEFAULT 0,    -- 对计划时间的影响（正=延迟，负=加速）
  world_event TEXT,                       -- 触发的世界事件

  -- 时间
  game_day INTEGER NOT NULL,
  game_hour INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_interventions_player ON player_interventions(player_id);
CREATE INDEX idx_interventions_npc ON player_interventions(npc_id);
CREATE INDEX idx_interventions_time ON player_interventions(game_day, game_hour);

-- ============================================================
-- 9. 世界日志表
-- ============================================================

CREATE TABLE IF NOT EXISTS world_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_day INTEGER NOT NULL,
  game_hour INTEGER NOT NULL,
  log_type TEXT NOT NULL
    CHECK (log_type IN ('action', 'decision', 'event', 'relationship', 'failure', 'system')),
  source TEXT NOT NULL,                   -- 'old_ezra', 'world', 'player:xxx' 等
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',             -- JSON: 额外数据
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_world_log_time ON world_log(game_day, game_hour);
CREATE INDEX idx_world_log_source ON world_log(source);
CREATE INDEX idx_world_log_type ON world_log(log_type);

-- ============================================================
-- 10. 交易记录表
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id TEXT NOT NULL,                 -- NPC ID 或 'player:xxx'
  seller_id TEXT NOT NULL,
  commodity TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_unit REAL NOT NULL,
  total_price REAL NOT NULL,
  location TEXT NOT NULL
    CHECK (location IN ('plaza', 'blackmarket', 'private')),
  game_day INTEGER NOT NULL,
  game_hour INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_time ON transactions(game_day, game_hour);

-- ============================================================
-- 11. NPC 记忆表（用于 LLM 上下文）
-- ============================================================

CREATE TABLE IF NOT EXISTS npc_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL
    CHECK (memory_type IN ('interaction', 'observation', 'emotion', 'knowledge')),
  content TEXT NOT NULL,                  -- 记忆内容（自然语言）
  importance INTEGER NOT NULL DEFAULT 5,  -- 1-10 重要性
  related_entity TEXT,                    -- 相关实体 ID
  game_day INTEGER NOT NULL,
  game_hour INTEGER NOT NULL,
  decay_rate REAL NOT NULL DEFAULT 0.01,  -- 记忆衰减速率
  current_strength REAL NOT NULL DEFAULT 1.0, -- 当前记忆强度 (0~1)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memories_npc ON npc_memories(npc_id);
CREATE INDEX idx_memories_importance ON npc_memories(npc_id, importance DESC);
CREATE INDEX idx_memories_strength ON npc_memories(npc_id, current_strength DESC);

-- ============================================================
-- 初始数据
-- ============================================================

-- 世界初始状态
INSERT OR IGNORE INTO world_state (id, current_day, current_hour, season)
VALUES (1, 1, 0, 'ash');

-- 老埃兹拉
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'old_ezra',
  '老埃兹拉 (Old Ezra)',
  '{"radioParts": 0, "credits": 120, "nuclearBattery": 1, "scrapMetal": 3, "tools": 2}'
);

-- 阿洛
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'arlo',
  '阿洛 (Arlo)',
  '{"credits": 40, "seeds": 12, "tools": 1}'
);

-- 萨米拉
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'samira',
  '萨米拉 (Samira)',
  '{"credits": 60, "waterFilters": 3, "tools": 2}'
);

-- 铁砧
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'anvil',
  '铁砧 (Anvil)',
  '{"credits": 0, "scrapMetal": 10, "tools": 8}'
);

-- 玛拉
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'mara',
  '玛拉 (Mara)',
  '{"credits": 500, "radioParts": 20, "nuclearBattery": 2, "contraband": 5}'
);

-- 帕克斯
INSERT OR IGNORE INTO npcs (id, display_name, inventory) VALUES (
  'pax',
  '帕克斯 (Pax)',
  '{"credits": 25, "letters": 7, "tools": 1}'
);

-- 低语者
INSERT OR IGNORE INTO npcs (id, display_name, status, location, inventory) VALUES (
  'whisperer',
  '低语者 (The Whisperer)',
  'idle',
  'echo_well',
  '{"computePower": 45, "encryptedData": 99}'
);

-- 初始关系
INSERT OR IGNORE INTO npc_relationships (npc_id, target_id, affinity, trust, notes) VALUES
  ('old_ezra', 'anvil', 70, 80, '救命恩人，绝对忠诚'),
  ('old_ezra', 'mara', -10, -20, '表面合作，背地警惕'),
  ('old_ezra', 'arlo', 20, 30, '看不起但承认农场价值'),
  ('old_ezra', 'samira', 30, 40, '互相尊重工作态度'),
  ('old_ezra', 'pax', 40, 35, '欠人情'),
  ('old_ezra', 'whisperer', -80, -90, '发誓要抓住它'),
  ('anvil', 'old_ezra', 90, 95, '被他重启，绝对忠诚'),
  ('anvil', 'samira', 50, 60, '频繁合作维修水泵'),
  ('anvil', 'whisperer', -30, -50, '视为异类AI，保持警惕'),
  ('mara', 'whisperer', 40, 30, '秘密交易伙伴'),
  ('mara', 'pax', 20, 10, '利用他传递消息'),
  ('arlo', 'samira', 60, 40, '暗恋，但害羞'),
  ('samira', 'arlo', 30, 50, '假装不知道他的心意');

-- 老埃兹拉的长期目标
INSERT OR IGNORE INTO npc_goals (id, npc_id, goal_type, priority, active) VALUES
  ('old_ezra:repair_comms_tower', 'old_ezra', 'repair_comms_tower', 10, TRUE),
  ('old_ezra:collect_batteries', 'old_ezra', 'collect_batteries', 8, TRUE),
  ('old_ezra:destroy_wraith_node', 'old_ezra', 'destroy_wraith_node', 5, FALSE);
