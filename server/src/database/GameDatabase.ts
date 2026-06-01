/**
 * GameDatabase.ts
 * SQLite 数据库封装 —— 提供 NPC 状态持久化、世界日志、玩家介入记录
 */

import Database from 'better-sqlite3';
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
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(__dirname, '..', '..', 'database', 'reseed.db');
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');

    const isNew = !fs.existsSync(resolvedPath);
    this.db = new Database(resolvedPath);

    // 性能优化
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    // 如果是新数据库，执行 schema
    if (isNew && fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    }
  }

  // ============================================================
  // 世界状态
  // ============================================================

  getWorldState(): DBWorldState | undefined {
    return this.db.prepare('SELECT * FROM world_state WHERE id = 1').get() as DBWorldState | undefined;
  }

  updateWorldState(day: number, hour: number, season: string, ticks: number, events: string[]): void {
    this.db.prepare(`
      UPDATE world_state 
      SET current_day = ?, current_hour = ?, season = ?, total_ticks = ?, 
          active_events = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(day, hour, season, ticks, JSON.stringify(events));
  }

  // ============================================================
  // NPC 管理
  // ============================================================

  getNPC(id: string): DBNPC | undefined {
    return this.db.prepare('SELECT * FROM npcs WHERE id = ?').get(id) as DBNPC | undefined;
  }

  getAllNPCs(): DBNPC[] {
    return this.db.prepare('SELECT * FROM npcs').all() as DBNPC[];
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

    this.db.prepare(`UPDATE npcs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // ============================================================
  // 关系
  // ============================================================

  getRelationships(npcId: string): DBRelationship[] {
    return this.db.prepare('SELECT * FROM npc_relationships WHERE npc_id = ?').all(npcId) as DBRelationship[];
  }

  updateRelationship(npcId: string, targetId: string, affinity: number, trust?: number): void {
    if (trust !== undefined) {
      this.db.prepare(`
        INSERT INTO npc_relationships (npc_id, target_id, affinity, trust, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(npc_id, target_id) DO UPDATE SET 
          affinity = ?, trust = ?, updated_at = CURRENT_TIMESTAMP
      `).run(npcId, targetId, affinity, trust, affinity, trust);
    } else {
      this.db.prepare(`
        INSERT INTO npc_relationships (npc_id, target_id, affinity, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(npc_id, target_id) DO UPDATE SET 
          affinity = ?, updated_at = CURRENT_TIMESTAMP
      `).run(npcId, targetId, affinity, affinity);
    }
  }

  // ============================================================
  // 计划管理
  // ============================================================

  getActivePlan(npcId: string): (DBPlan & { steps: DBPlanStep[] }) | null {
    const plan = this.db.prepare(
      "SELECT * FROM npc_plans WHERE npc_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"
    ).get(npcId) as DBPlan | undefined;

    if (!plan) return null;

    const steps = this.db.prepare(
      'SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_index'
    ).all(plan.id) as DBPlanStep[];

    return { ...plan, steps };
  }

  createPlan(npcId: string, planType: string, goalId: string | null, steps: Omit<DBPlanStep, 'id' | 'plan_id'>[]): number {
    const result = this.db.prepare(`
      INSERT INTO npc_plans (npc_id, goal_id, plan_type, status, current_step_index, fail_count)
      VALUES (?, ?, ?, 'active', 0, 0)
    `).run(npcId, goalId, planType);

    const planId = result.lastInsertRowid as number;

    const insertStep = this.db.prepare(`
      INSERT INTO plan_steps (plan_id, step_index, name, description, duration_hours, hours_spent, success_rate, status, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const step of steps) {
      insertStep.run(planId, step.step_index, step.name, step.description, step.duration_hours, step.hours_spent, step.success_rate, step.status, step.attempts);
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
    this.db.prepare(`UPDATE npc_plans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
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

    this.db.prepare(`UPDATE plan_steps SET ${fields.join(', ')} WHERE plan_id = ? AND step_index = ?`).run(...values);
  }

  // ============================================================
  // 玩家介入
  // ============================================================

  recordIntervention(data: DBIntervention): number {
    const result = this.db.prepare(`
      INSERT INTO player_interventions 
        (player_id, npc_id, intervention_type, item_type, quantity, plan_id, step_index,
         affinity_change, time_impact_hours, world_event, game_day, game_hour)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.player_id, data.npc_id, data.intervention_type,
      data.item_type ?? null, data.quantity ?? 0,
      data.plan_id ?? null, data.step_index ?? null,
      data.affinity_change ?? 0, data.time_impact_hours ?? 0,
      data.world_event ?? null, data.game_day, data.game_hour
    );
    return result.lastInsertRowid as number;
  }

  getPlayerInterventions(playerId: string, npcId?: string, limit: number = 50): any[] {
    if (npcId) {
      return this.db.prepare(
        'SELECT * FROM player_interventions WHERE player_id = ? AND npc_id = ? ORDER BY id DESC LIMIT ?'
      ).all(playerId, npcId, limit);
    }
    return this.db.prepare(
      'SELECT * FROM player_interventions WHERE player_id = ? ORDER BY id DESC LIMIT ?'
    ).all(playerId, limit);
  }

  // ============================================================
  // 世界日志
  // ============================================================

  addLog(entry: DBLogEntry): void {
    this.db.prepare(`
      INSERT INTO world_log (game_day, game_hour, log_type, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entry.game_day, entry.game_hour, entry.log_type, entry.source, entry.message, entry.metadata ?? '{}');
  }

  addLogBatch(entries: DBLogEntry[]): void {
    const insert = this.db.prepare(`
      INSERT INTO world_log (game_day, game_hour, log_type, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: DBLogEntry[]) => {
      for (const e of items) {
        insert.run(e.game_day, e.game_hour, e.log_type, e.source, e.message, e.metadata ?? '{}');
      }
    });

    transaction(entries);
  }

  getRecentLogs(limit: number = 30, source?: string): any[] {
    if (source) {
      return this.db.prepare(
        'SELECT * FROM world_log WHERE source = ? ORDER BY id DESC LIMIT ?'
      ).all(source, limit);
    }
    return this.db.prepare('SELECT * FROM world_log ORDER BY id DESC LIMIT ?').all(limit);
  }

  // ============================================================
  // NPC 记忆
  // ============================================================

  addMemory(npcId: string, type: string, content: string, importance: number, gameDay: number, gameHour: number, relatedEntity?: string): void {
    this.db.prepare(`
      INSERT INTO npc_memories (npc_id, memory_type, content, importance, related_entity, game_day, game_hour)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(npcId, type, content, importance, relatedEntity ?? null, gameDay, gameHour);
  }

  getTopMemories(npcId: string, limit: number = 10): any[] {
    return this.db.prepare(`
      SELECT * FROM npc_memories 
      WHERE npc_id = ? AND current_strength > 0.3
      ORDER BY importance * current_strength DESC
      LIMIT ?
    `).all(npcId, limit);
  }

  decayMemories(decayAmount: number = 0.01): void {
    this.db.prepare(`
      UPDATE npc_memories 
      SET current_strength = MAX(0, current_strength - decay_rate * ?)
    `).run(decayAmount);
  }

  // ============================================================
  // 统计
  // ============================================================

  getPlayerStats(playerId: string): any {
    return this.db.prepare(`
      SELECT
        COUNT(*) as total_interventions,
        SUM(CASE WHEN intervention_type = 'help' THEN 1 ELSE 0 END) as helps,
        SUM(CASE WHEN intervention_type = 'sabotage' THEN 1 ELSE 0 END) as sabotages,
        SUM(affinity_change) as total_affinity_change,
        SUM(time_impact_hours) as total_time_impact
      FROM player_interventions
      WHERE player_id = ?
    `).get(playerId);
  }

  // ============================================================
  // 生命周期
  // ============================================================

  close(): void {
    this.db.close();
  }
}
