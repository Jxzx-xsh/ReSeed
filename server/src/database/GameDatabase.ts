/**
 * GameDatabase.ts
 * SQLite 数据库封装（sql.js 版本）—— 提供 NPC 状态持久化、世界日志、玩家介入记录
 * sql.js 是纯 WebAssembly 实现，无需编译原生模块
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

export interface DBWorldState {
  current_day: number;
  current_hour: number;
  season: string;
  total_ticks: number;
  active_events: string;
}

export interface DBNPC {
  id: string;
  display_name: string;
  status: string;
  location: string;
  hunger: number;
  thirst: number;
  energy: number;
  social: number;
  inventory: string;
  total_hours_elapsed: number;
}

export interface DBRelationship {
  npc_id: string;
  target_id: string;
  affinity: number;
  trust: number;
  notes: string;
}

export interface DBPlan {
  id: number;
  npc_id: string;
  goal_id: string | null;
  plan_type: string;
  status: string;
  current_step_index: number;
  fail_count: number;
}

export interface DBPlanStep {
  id: number;
  plan_id: number;
  step_index: number;
  name: string;
  description: string;
  duration_hours: number;
  hours_spent: number;
  success_rate: number;
  status: string;
  attempts: number;
}

export interface DBIntervention {
  player_id: string;
  npc_id: string;
  intervention_type: string;
  item_type?: string;
  quantity?: number;
  plan_id?: number;
  step_index?: number;
  affinity_change?: number;
  time_impact_hours?: number;
  world_event?: string;
  game_day: number;
  game_hour: number;
}

export interface DBLogEntry {
  game_day: number;
  game_hour: number;
  log_type: string;
  source: string;
  message: string;
  metadata?: string;
}

export class GameDatabase {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private dirty: boolean = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? path.join(__dirname, '..', '..', 'database', 'reseed.db');
  }

  /**
   * 异步初始化（必须在使用前调用）
   */
  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');

    if (fs.existsSync(this.dbPath)) {
      // 加载已有数据库
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      // 创建新数据库
      this.db = new SQL.Database();
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        this.db.run(schema);
        this.dirty = true;
      }
    }

    // 性能优化
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');

    // 定期自动保存（每 30 秒）
    this.saveTimer = setInterval(() => {
      if (this.dirty) this.saveToDisk();
    }, 30000);
  }

  /**
   * 保存数据库到磁盘
   */
  saveToDisk(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.dbPath, buffer);
    this.dirty = false;
  }

  // ============================================================
  // 内部工具方法
  // ============================================================

  private get(sql: string, ...params: any[]): any | undefined {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  private all(sql: string, ...params: any[]): any[] {
    const results: any[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  private run(sql: string, ...params: any[]): { lastInsertRowid: number } {
    this.db.run(sql, params);
    this.dirty = true;
    const result = this.get('SELECT last_insert_rowid() as id');
    return { lastInsertRowid: result?.id ?? 0 };
  }

  private exec(sql: string): void {
    this.db.run(sql);
    this.dirty = true;
  }

  // ============================================================
  // 世界状态
  // ============================================================

  getWorldState(): DBWorldState | undefined {
    return this.get('SELECT * FROM world_state WHERE id = 1') as DBWorldState | undefined;
  }

  updateWorldState(day: number, hour: number, season: string, ticks: number, events: string[]): void {
    this.run(`
      UPDATE world_state 
      SET current_day = ?, current_hour = ?, season = ?, total_ticks = ?, 
          active_events = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, day, hour, season, ticks, JSON.stringify(events));
  }

  // ============================================================
  // NPC 管理
  // ============================================================

  getNPC(id: string): DBNPC | undefined {
    return this.get('SELECT * FROM npcs WHERE id = ?', id) as DBNPC | undefined;
  }

  getAllNPCs(): DBNPC[] {
    return this.all('SELECT * FROM npcs') as DBNPC[];
  }

  updateNPC(id: string, data: Partial<DBNPC>): void {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    this.run(`UPDATE npcs SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }

  // ============================================================
  // 关系
  // ============================================================

  getRelationships(npcId: string): DBRelationship[] {
    return this.all('SELECT * FROM npc_relationships WHERE npc_id = ?', npcId) as DBRelationship[];
  }

  updateRelationship(npcId: string, targetId: string, affinity: number, trust?: number): void {
    if (trust !== undefined) {
      this.run(`
        INSERT INTO npc_relationships (npc_id, target_id, affinity, trust, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(npc_id, target_id) DO UPDATE SET 
          affinity = ?, trust = ?, updated_at = CURRENT_TIMESTAMP
      `, npcId, targetId, affinity, trust, affinity, trust);
    } else {
      this.run(`
        INSERT INTO npc_relationships (npc_id, target_id, affinity, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(npc_id, target_id) DO UPDATE SET 
          affinity = ?, updated_at = CURRENT_TIMESTAMP
      `, npcId, targetId, affinity, affinity);
    }
  }

  // ============================================================
  // 计划管理
  // ============================================================

  getActivePlan(npcId: string): (DBPlan & { steps: DBPlanStep[] }) | null {
    const plan = this.get(
      "SELECT * FROM npc_plans WHERE npc_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", npcId
    ) as DBPlan | undefined;

    if (!plan) return null;

    const steps = this.all(
      'SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_index', plan.id
    ) as DBPlanStep[];

    return { ...plan, steps };
  }

  createPlan(npcId: string, planType: string, goalId: string | null, steps: Omit<DBPlanStep, 'id' | 'plan_id'>[]): number {
    const result = this.run(`
      INSERT INTO npc_plans (npc_id, goal_id, plan_type, status, current_step_index, fail_count)
      VALUES (?, ?, ?, 'active', 0, 0)
    `, npcId, goalId, planType);

    const planId = result.lastInsertRowid;

    for (const step of steps) {
      this.run(`
        INSERT INTO plan_steps (plan_id, step_index, name, description, duration_hours, hours_spent, success_rate, status, attempts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, planId, step.step_index, step.name, step.description, step.duration_hours, step.hours_spent, step.success_rate, step.status, step.attempts);
    }

    return planId;
  }

  updatePlanStatus(planId: number, status: string, stepIndex?: number, failCount?: number): void {
    const updates: string[] = ['status = ?'];
    const values: any[] = [status];

    if (stepIndex !== undefined) {
      updates.push('current_step_index = ?');
      values.push(stepIndex);
    }
    if (failCount !== undefined) {
      updates.push('fail_count = ?');
      values.push(failCount);
    }
    if (status === 'completed' || status === 'failed' || status === 'abandoned') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    values.push(planId);
    this.run(`UPDATE npc_plans SET ${updates.join(', ')} WHERE id = ?`, ...values);
  }

  updatePlanStep(planId: number, stepIndex: number, data: Partial<DBPlanStep>): void {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (!['id', 'plan_id', 'step_index'].includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;
    values.push(planId, stepIndex);

    this.run(`UPDATE plan_steps SET ${fields.join(', ')} WHERE plan_id = ? AND step_index = ?`, ...values);
  }

  // ============================================================
  // 玩家介入
  // ============================================================

  recordIntervention(data: DBIntervention): number {
    const result = this.run(`
      INSERT INTO player_interventions 
        (player_id, npc_id, intervention_type, item_type, quantity, plan_id, step_index,
         affinity_change, time_impact_hours, world_event, game_day, game_hour)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      data.player_id, data.npc_id, data.intervention_type,
      data.item_type ?? null, data.quantity ?? 0,
      data.plan_id ?? null, data.step_index ?? null,
      data.affinity_change ?? 0, data.time_impact_hours ?? 0,
      data.world_event ?? null, data.game_day, data.game_hour
    );
    return result.lastInsertRowid;
  }

  getPlayerInterventions(playerId: string, npcId?: string, limit: number = 50): any[] {
    if (npcId) {
      return this.all(
        'SELECT * FROM player_interventions WHERE player_id = ? AND npc_id = ? ORDER BY id DESC LIMIT ?',
        playerId, npcId, limit
      );
    }
    return this.all(
      'SELECT * FROM player_interventions WHERE player_id = ? ORDER BY id DESC LIMIT ?',
      playerId, limit
    );
  }

  // ============================================================
  // 世界日志
  // ============================================================

  addLog(entry: DBLogEntry): void {
    this.run(`
      INSERT INTO world_log (game_day, game_hour, log_type, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, entry.game_day, entry.game_hour, entry.log_type, entry.source, entry.message, entry.metadata ?? '{}');
  }

  addLogBatch(entries: DBLogEntry[]): void {
    for (const e of entries) {
      this.run(`
        INSERT INTO world_log (game_day, game_hour, log_type, source, message, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `, e.game_day, e.game_hour, e.log_type, e.source, e.message, e.metadata ?? '{}');
    }
  }

  getRecentLogs(limit: number = 30, source?: string): any[] {
    if (source) {
      return this.all(
        'SELECT * FROM world_log WHERE source = ? ORDER BY id DESC LIMIT ?',
        source, limit
      );
    }
    return this.all('SELECT * FROM world_log ORDER BY id DESC LIMIT ?', limit);
  }

  // ============================================================
  // NPC 记忆
  // ============================================================

  addMemory(npcId: string, type: string, content: string, importance: number, gameDay: number, gameHour: number, relatedEntity?: string): void {
    this.run(`
      INSERT INTO npc_memories (npc_id, memory_type, content, importance, related_entity, game_day, game_hour)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, npcId, type, content, importance, relatedEntity ?? null, gameDay, gameHour);
  }

  getTopMemories(npcId: string, limit: number = 10): any[] {
    return this.all(`
      SELECT * FROM npc_memories 
      WHERE npc_id = ? AND current_strength > 0.3
      ORDER BY importance * current_strength DESC
      LIMIT ?
    `, npcId, limit);
  }

  decayMemories(decayAmount: number = 0.01): void {
    this.run(`
      UPDATE npc_memories 
      SET current_strength = MAX(0, current_strength - decay_rate * ?)
    `, decayAmount);
  }

  // ============================================================
  // 统计
  // ============================================================

  getPlayerStats(playerId: string): any {
    return this.get(`
      SELECT
        COUNT(*) as total_interventions,
        SUM(CASE WHEN intervention_type = 'help' THEN 1 ELSE 0 END) as helps,
        SUM(CASE WHEN intervention_type = 'sabotage' THEN 1 ELSE 0 END) as sabotages,
        SUM(affinity_change) as total_affinity_change,
        SUM(time_impact_hours) as total_time_impact
      FROM player_interventions
      WHERE player_id = ?
    `, playerId);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  close(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    // 关闭前保存
    if (this.dirty) this.saveToDisk();
    this.db.close();
  }
}
