/**
 * simulation.ts
 * 种子城统一模拟入口 —— SmartNPC + SocialEngine
 *
 * 命令:
 *   npx ts-node src/agents/simulation.ts              # 模拟 1 天（26h）
 *   npx ts-node src/agents/simulation.ts --ticks=6    # 模拟 6 小时
 *   npx ts-node src/agents/simulation.ts --fast       # 快速模式（无等待）
 */

import * as fs from 'fs';
import * as path from 'path';
import { SmartNPC } from './SmartNPC';
import { ALL_PROFILES } from './profiles';
import { WorldState } from './WorldState';
import { LLMClient } from '../llm/LLMClient';
import { SocialEngine } from './SocialEngine';

const args = process.argv.slice(2);
const getArg = (name: string, def: number) => {
  const f = args.find(a => a.startsWith(`--${name}=`));
  return f ? parseInt(f.split('=')[1]) : def;
};
const fast = args.includes('--fast');

const MAX_TICKS = getArg('ticks', 26);
const INTERVAL = fast ? 0 : 2000;

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  🌍 种子城模拟 —— SmartNPC（状态机 + LLM）           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const llm = new LLMClient();
  const world = new WorldState();
  const social = new SocialEngine(llm);

  const npcs = ALL_PROFILES.map(p => new SmartNPC(p, world, llm));

  console.log(`👥 ${npcs.map(n => n.name).join('、')}`);
  console.log(`⚙️  ${MAX_TICKS} ticks | ${fast ? '快速' : '正常'}模式`);
  console.log('─'.repeat(55) + '\n');

  const worldLog: string[] = [];
  worldLog.push(`种子城世界日志 | ${new Date().toISOString().slice(0, 10)}\n`);

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    world.advanceHour();
    const timeStr = `Day${world.currentDay} ${String(world.currentHour).padStart(2, '0')}:00`;

    // 所有 NPC 行动（状态机驱动，快速）
    for (const npc of npcs) {
      await npc.update(1);
    }

    // 社交引擎检测相遇
    const encounters = await social.processEncounters(npcs, tick);

    // 输出
    console.log(`🕐 ${timeStr}`);
    worldLog.push(`[${timeStr}]`);

    for (const npc of npcs) {
      const brief = `  ${npc.name}: ${npc.location} (${npc.getCurrentActivity()})`;
      console.log(brief);
      worldLog.push(brief);
    }

    if (encounters.length > 0) {
      for (const enc of encounters) {
        const header = `  🎭 对话: ${enc.participants.map(n => n.name).join('、')}`;
        console.log(header);
        worldLog.push(header);
        for (const line of enc.dialogues) {
          const l = `    ${line.speaker}: "${line.dialogue}"`;
          console.log(l);
          worldLog.push(l);
        }
      }
    }

    console.log('');
    worldLog.push('');

    if (!fast && tick < MAX_TICKS - 1) await sleep(INTERVAL);
  }

  // 保存日志
  const outDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'world_log.txt');
  fs.writeFileSync(outPath, worldLog.join('\n'), 'utf-8');
  console.log(`📁 日志: ${outPath}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
