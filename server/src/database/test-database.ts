/**
 * test-database.ts
 * 数据库集成测试 —— 验证 GameDatabase 与模拟系统的完整工作流
 *
 * 运行: npx ts-node src/database/test-database.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { GameDatabase } from './GameDatabase';
import { SmartNPC } from '../agents/SmartNPC';
import { EZRA_PROFILE } from '../agents/profiles/ezra-profile';
import { WorldState } from '../agents/WorldState';

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'database', 'test_integration.db');

// 清理旧测试数据库
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// ============================================================
// 测试工具
// ============================================================

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, message: string): void {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✅ ${message}`);
  } else {
    console.log(`  ❌ ${message}`);
  }
}

// ============================================================
// 测试开始
// ============================================================

console.log('╔══════════════════════════════════════════╗');
console.log('║  数据库集成测试                          ║');
console.log('╚══════════════════════════════════════════╝\n');

async function runTests() {
const db = new GameDatabase(TEST_DB_PATH);
await db.init();

// --- 测试 1: 世界状态 ---
console.log('📦 测试 1: 世界状态');

const worldState = db.getWorldState();
assert(worldState !== undefined, '世界状态已初始化');
assert(worldState!.current_day === 1, '初始天数 = 1');
assert(worldState!.season === 'ash', '初始季节 = ash');

db.updateWorldState(3, 14, 'acid_rain', 100, ['rust_storm']);
const updated = db.getWorldState();
assert(updated!.current_day === 3, '更新天数 = 3');
assert(updated!.season === 'acid_rain', '更新季节 = acid_rain');
assert(JSON.parse(updated!.active_events).includes('rust_storm'), '活跃事件包含 rust_storm');

// --- 测试 2: NPC 数据 ---
console.log('\n👤 测试 2: NPC 数据');

const ezra = db.getNPC('old_ezra');
assert(ezra !== undefined, '老埃兹拉存在');
assert(ezra!.display_name.includes('Old Ezra'), '名称正确');

const inventory = JSON.parse(ezra!.inventory);
assert(inventory.credits === 120, '初始信用点 = 120');
assert(inventory.nuclearBattery === 1, '初始核电池 = 1');

const allNPCs = db.getAllNPCs();
assert(allNPCs.length === 7, '共 7 个 NPC');

db.updateNPC('old_ezra', { hunger: 45, status: 'executing' });
const updatedEzra = db.getNPC('old_ezra');
assert(updatedEzra!.hunger === 45, '饥饿值更新为 45');
assert(updatedEzra!.status === 'executing', '状态更新为 executing');

// --- 测试 3: 关系网 ---
console.log('\n💬 测试 3: 关系网');

const rels = db.getRelationships('old_ezra');
assert(rels.length >= 5, '老埃兹拉有 5+ 个关系');

const anvilRel = rels.find(r => r.target_id === 'anvil');
assert(anvilRel!.affinity === 70, '对铁砧好感度 = 70');

db.updateRelationship('old_ezra', 'player:test_player', 20, 15);
const playerRel = db.getRelationships('old_ezra').find(r => r.target_id === 'player:test_player');
assert(playerRel !== undefined, '玩家关系已创建');
assert(playerRel!.affinity === 20, '玩家好感度 = 20');

// --- 测试 4: 计划管理 ---
console.log('\n📋 测试 4: 计划管理');

const planId = db.createPlan('old_ezra', 'repair_comms_tower', 'old_ezra:repair_comms_tower', [
  { step_index: 0, name: 'inspect_tower', description: '检查通讯塔', duration_hours: 1, hours_spent: 0, success_rate: 0.95, status: 'pending', attempts: 0 },
  { step_index: 1, name: 'collect_parts', description: '收集零件', duration_hours: 8, hours_spent: 0, success_rate: 0.4, status: 'pending', attempts: 0 },
  { step_index: 2, name: 'fix_antenna', description: '焊接天线', duration_hours: 3, hours_spent: 0, success_rate: 0.7, status: 'pending', attempts: 0 },
  { step_index: 3, name: 'calibrate', description: '校准信号', duration_hours: 2, hours_spent: 0, success_rate: 0.5, status: 'pending', attempts: 0 },
]);

assert(planId > 0, `计划已创建 (ID: ${planId})`);

const activePlan = db.getActivePlan('old_ezra');
assert(activePlan !== null, '有活跃计划');
assert(activePlan!.plan_type === 'repair_comms_tower', '计划类型正确');
assert(activePlan!.steps.length === 4, '有 4 个步骤');

db.updatePlanStep(planId, 0, { status: 'completed', hours_spent: 1 });
db.updatePlanStatus(planId, 'active', 1);

const updatedPlan = db.getActivePlan('old_ezra');
assert(updatedPlan!.current_step_index === 1, '当前步骤推进到 1');
assert(updatedPlan!.steps[0].status === 'completed', '步骤 0 已完成');

// --- 测试 5: 玩家介入记录 ---
console.log('\n🎮 测试 5: 玩家介入');

db.recordIntervention({
  player_id: 'player_001',
  npc_id: 'old_ezra',
  intervention_type: 'help',
  item_type: 'radio_parts',
  quantity: 5,
  plan_id: planId,
  step_index: 1,
  affinity_change: 20,
  time_impact_hours: -10,
  game_day: 1,
  game_hour: 14,
});

db.recordIntervention({
  player_id: 'player_002',
  npc_id: 'old_ezra',
  intervention_type: 'sabotage',
  item_type: 'radio_parts',
  quantity: 3,
  affinity_change: -30,
  time_impact_hours: 15,
  game_day: 2,
  game_hour: 8,
});

const p1History = db.getPlayerInterventions('player_001', 'old_ezra');
assert(p1History.length === 1, '玩家1 有 1 条介入记录');
assert(p1History[0].intervention_type === 'help', '类型为 help');

const p1Stats = db.getPlayerStats('player_001');
assert(p1Stats.helps === 1, '帮助次数 = 1');
assert(p1Stats.total_affinity_change === 20, '总好感变化 = 20');

const p2Stats = db.getPlayerStats('player_002');
assert(p2Stats.sabotages === 1, '破坏次数 = 1');
assert(p2Stats.total_time_impact === 15, '总时间影响 = 15h');

// --- 测试 6: 世界日志 ---
console.log('\n📜 测试 6: 世界日志');

db.addLog({ game_day: 1, game_hour: 1, log_type: 'decision', source: 'old_ezra', message: '开始执行修理通讯塔计划' });
db.addLog({ game_day: 1, game_hour: 10, log_type: 'failure', source: 'old_ezra', message: '收集零件失败（第1次）' });
db.addLog({ game_day: 1, game_hour: 14, log_type: 'event', source: 'player_001', message: '玩家帮助了老埃兹拉' });

const logs = db.getRecentLogs(10);
assert(logs.length === 3, '有 3 条日志');

const ezraLogs = db.getRecentLogs(10, 'old_ezra');
assert(ezraLogs.length === 2, '老埃兹拉有 2 条日志');

// 批量写入测试
db.addLogBatch([
  { game_day: 2, game_hour: 0, log_type: 'system', source: 'world', message: 'Day 2 开始' },
  { game_day: 2, game_hour: 1, log_type: 'action', source: 'old_ezra', message: '继续收集零件' },
  { game_day: 2, game_hour: 2, log_type: 'action', source: 'arlo', message: '检查温室作物' },
]);

const allLogs = db.getRecentLogs(20);
assert(allLogs.length === 6, '批量写入后共 6 条日志');

// --- 测试 7: NPC 记忆 ---
console.log('\n🧠 测试 7: NPC 记忆');

db.addMemory('old_ezra', 'interaction', '玩家帮助了我收集零件，虽然我不想承认，但确实省了不少时间', 8, 1, 14, 'player_001');
db.addMemory('old_ezra', 'emotion', '对玛拉的涨价感到愤怒', 5, 1, 18);
db.addMemory('old_ezra', 'observation', '铁砧今天巡视时发现南墙有裂缝', 6, 2, 9, 'anvil');

const memories = db.getTopMemories('old_ezra');
assert(memories.length === 3, '有 3 条记忆');
assert(memories[0].importance === 8, '最重要的记忆排在前面');

db.decayMemories(10); // 大幅衰减测试
const decayedMemories = db.getTopMemories('old_ezra');
// 衰减后强度降低，低重要性的可能被过滤
assert(decayedMemories.length <= 3, '衰减后记忆数量合理');

// --- 测试 8: 模拟系统集成 ---
console.log('\n🔄 测试 8: 模拟系统集成');

// 模拟运行 SmartNPC 并同步到数据库
const world = new WorldState(() => 0.3); // 确定性随机
const agent = new SmartNPC(EZRA_PROFILE, world); // 无 LLM，纯状态机

// 运行 10 个 tick
for (let i = 0; i < 10; i++) {
  world.advanceHour();
  // SmartNPC.update is async but without LLM it resolves immediately
  agent.update(1);
}

// 同步 agent 状态到数据库
db.updateNPC('old_ezra', {
  status: agent.status,
  hunger: agent.hunger,
  thirst: agent.thirst,
  energy: agent.energy,
  social: agent.social,
  inventory: JSON.stringify(agent.inventory),
  total_hours_elapsed: agent.totalHoursElapsed,
});

// 同步日志
const agentLogs = agent.getLog();
const typeMap: Record<string, string> = { thought: 'system', dialogue: 'event', action: 'action', decision: 'decision', failure: 'failure', event: 'event', relationship: 'relationship' };
db.addLogBatch(agentLogs.map((l: any) => ({
  game_day: l.day,
  game_hour: l.hour,
  log_type: typeMap[l.type] ?? 'system',
  source: 'old_ezra',
  message: l.message,
})));

// 验证同步
const syncedNPC = db.getNPC('old_ezra');
assert(syncedNPC!.total_hours_elapsed === 10, '同步后已过 10 小时');
assert(syncedNPC!.status === agent.status, `状态同步: ${agent.status}`);

const syncedLogs = db.getRecentLogs(50, 'old_ezra');
assert(syncedLogs.length > 2, `日志同步: ${syncedLogs.length} 条`);

// 同步关系
for (const [target, affinity] of Object.entries(agent.relationships)) {
  db.updateRelationship('old_ezra', target === 'player' ? 'player:default' : target, affinity as number);
}

const syncedRels = db.getRelationships('old_ezra');
assert(syncedRels.length >= 6, `关系同步: ${syncedRels.length} 条`);

// ============================================================
// 报告
// ============================================================

console.log('\n═══════════════════════════════════════════');
console.log(`  测试结果: ${passCount}/${testCount} 通过`);
console.log('═══════════════════════════════════════════');

// 清理
db.close();
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log('  🧹 测试数据库已清理');
}

if (passCount < testCount) {
  process.exit(1);
}
}

runTests().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
