/**
 * SeedCityCLI.ts
 * 种子城终端交互版 —— 文字冒险式游戏入口
 *
 * 运行: npx ts-node src/game/SeedCityCLI.ts
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { SmartNPC } from '../agents/SmartNPC';
import { ALL_PROFILES } from '../agents/profiles';
import { WorldState } from '../agents/WorldState';
import { SocialEngine } from '../agents/SocialEngine';
import { LLMClient } from '../llm/LLMClient';
import { PlayerState, getTrustLevelCN } from './PlayerState';
import { EventSystem, EventResult } from './EventSystem';
import { buildTrustPrompt } from './TrustPrompt';

const SAVE_DIR = path.join(__dirname, '..', '..', 'data');
const SAVE_FILE = path.join(SAVE_DIR, 'savegame.json');

// ============================================================
// 地点定义
// ============================================================

interface Location {
  id: string;
  name: string;
  description: string;
  connections: string[]; // 可到达的其他地点 ID
}

const LOCATIONS: Location[] = [
  { id: 'tent', name: '北区帐篷', description: '旧科考站集装箱和帐篷混合搭建的居住区。老埃兹拉和帕克斯住在这里。铁砧的维修棚也在附近。', connections: ['plaza', 'echo_well', 'greenhouse'] },
  { id: 'plaza', name: '中心广场', description: '种子城的核心，地热井口冒着白雾。锈蚀议会的帐篷立在一旁，几块生锈的公告牌上贴满了配给通知。', connections: ['tent', 'market', 'water', 'greenhouse'] },
  { id: 'greenhouse', name: '穹顶绿洲', description: '半圆形穹顶温室，透光材料修补过多次。LED灯管发出紫粉色的光，水培架上长满了螺旋藻和土豆苗。空气湿润温暖。', connections: ['tent', 'plaza'] },
  { id: 'water', name: '净水站', description: '金属集装箱改造的建筑，管道纵横。萨米拉的水质检测仪嗡嗡作响，墙上贴着严格的取水时间表。', connections: ['plaza', 'south_gate'] },
  { id: 'market', name: '黑冰市场', description: '天然岩洞入口，内部用荧光苔藓照明，散发幽绿色的光。各种摊位摆满了旧零件、药品和来路不明的物资。', connections: ['plaza', 'echo_well'] },
  { id: 'echo_well', name: '回声井', description: '被铁栅栏围住的竖井，深不见底。冷雾从井口涌出，偶尔能听到低沉的电子嗡鸣。铁栅栏上挂着"危险"标志。', connections: ['tent', 'market'] },
  { id: 'ruins', name: '废墟区', description: '锈蚀的钢铁骨架在灰色天空下矗立。风吹过时发出金属呻吟。地面散落着旧电路板和碎玻璃。', connections: ['south_gate', 'tent'] },
  { id: 'south_gate', name: '南门', description: '种子城唯一的出入口。简易哨塔上有人值守，远处是无尽的冰架。帕克斯每次出发都从这里离开。', connections: ['water', 'ruins'] },
];

// ============================================================
// 主游戏类
// ============================================================

class SeedCityCLI {
  private rl: readline.Interface;
  private world: WorldState;
  private npcs: SmartNPC[];
  private social: SocialEngine;
  private llm: LLMClient;
  private player: PlayerState;
  private events: EventSystem;
  private tick: number = 0;
  private running = true;

  constructor() {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.llm = new LLMClient();
    this.world = new WorldState();
    this.social = new SocialEngine(this.llm);
    this.npcs = ALL_PROFILES.map(p => new SmartNPC(p, this.world, this.llm));
    this.player = new PlayerState();
    this.events = new EventSystem();
  }

  async start(): Promise<void> {
    this.printHeader();

    // 尝试加载存档
    if (this.loadGame()) {
      console.log('  💾 已加载上次存档\n');
    } else {
      await this.intro();
      await this.checkAndDisplayEvents();
    }

    while (this.running) {
      this.printLocationInfo();
      const input = await this.ask('\n> ');
      await this.handleInput(input.trim().toLowerCase());
      await this.checkAndDisplayEvents();

      // 每次操作后自动存档
      this.saveGame();
    }

    this.rl.close();
  }

  // ============================================================
  // 显示
  // ============================================================

  private printHeader(): void {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════╗');
    console.log('  ║         R e S e e d                       ║');
    console.log('  ║     末日种子重生计划 · 终端版              ║');
    console.log('  ║         2307年 · 灰域纪元                 ║');
    console.log('  ╚═══════════════════════════════════════════╝');
    console.log('');
  }

  private async intro(): Promise<void> {
    console.log('  灰色的天空下，你踏过冰架的最后一段路。');
    console.log('  远处，一座由废铁和帐篷拼凑的定居点出现在视野中。');
    console.log('  哨塔上的人影朝你挥了挥手——或者是在警告你。');
    console.log('');
    console.log('  你来到了种子城（Seed City）的南门。');
    console.log('');
    console.log('  ─────────────────────────────────────────────');
    console.log('  指令: 看(look) | 走(go) | 说(talk) | 背包(bag)');
    console.log('        帮助(help) | 等待(wait) | 退出(quit)');
    console.log('  ─────────────────────────────────────────────');
  }

  private printLocationInfo(): void {
    const loc = LOCATIONS.find(l => l.id === this.player.location)!;
    const timeStr = this.getTimeStr();
    const npcsHere = this.getNPCsAtLocation(loc.id);

    console.log(`\n┌─── ${loc.name} ─── ${timeStr} ─── 行动点: ${this.player.actionPoints}/${this.player.maxActionPoints} ───`);
    console.log(`│ ${loc.description}`);

    if (npcsHere.length > 0) {
      console.log(`│`);
      for (const npc of npcsHere) {
        const trust = getTrustLevelCN(this.player.getTrustLevel(npc.id));
        console.log(`│ 👤 ${npc.name} [${trust}] — ${npc.getCurrentActivity()}`);
      }
    }

    const exits = loc.connections.map(c => LOCATIONS.find(l => l.id === c)!.name);
    console.log(`│`);
    console.log(`│ 🚪 出口: ${exits.join(' | ')}`);
    console.log(`└${'─'.repeat(50)}`);
  }

  // ============================================================
  // 输入处理
  // ============================================================

  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    // 退出
    if (['quit', 'exit', '退出', 'q'].includes(input)) {
      console.log('\n  你转身走向冰架，种子城的灯火在身后渐渐模糊……');
      console.log('  [游戏结束]\n');
      this.running = false;
      return;
    }

    // 帮助
    if (['help', '帮助', 'h', '?'].includes(input)) {
      this.printHelp();
      return;
    }

    // 查看
    if (['look', '看', 'l'].includes(input)) {
      return; // printLocationInfo 会在下一轮显示
    }

    // 背包
    if (['bag', '背包', 'i', 'inv'].includes(input)) {
      this.printInventory();
      return;
    }

    // 笔记本
    if (['note', '笔记', '笔记本', 'notebook', 'n'].includes(input)) {
      console.log(`\n  ${this.player.getNotebookSummary()}`);
      return;
    }

    // 等待（进入下一天）
    if (['wait', '等待', 'w', '休息', 'rest', 'sleep'].includes(input)) {
      this.player.actionPoints = 0; // 强制用完行动点
      await this.advanceTime();
      return;
    }

    // 移动: go xxx / 走 xxx
    if (input.startsWith('go ') || input.startsWith('走 ') || input.startsWith('去 ')) {
      const dest = input.replace(/^(go|走|去)\s+/, '');
      await this.moveTo(dest);
      return;
    }

    // 对话: talk xxx / 说 xxx
    if (input.startsWith('talk ') || input.startsWith('说 ') || input.startsWith('找 ') || input.startsWith('和 ')) {
      const target = input.replace(/^(talk|说|找|和)\s+/, '').replace(/\s*(说话|聊天|对话)$/, '');
      await this.talkTo(target);
      return;
    }

    // 帮助 NPC: help xxx
    if (input.startsWith('帮助 ') || input.startsWith('give ')) {
      const target = input.replace(/^(帮助|give)\s+/, '');
      await this.helpNPC(target);
      return;
    }

    // 领取配给
    if (input.includes('领') || input.includes('配给') || input.includes('领水') || input.includes('领粮') || input.includes('口粮')) {
      await this.collectRation();
      return;
    }

    // 状态
    if (['status', '状态', 'stat'].includes(input)) {
      this.printStatus();
      return;
    }

    // 尝试匹配地点名直接移动
    const matchedLoc = LOCATIONS.find(l =>
      l.name.includes(input) || l.id.includes(input)
    );
    if (matchedLoc) {
      await this.moveTo(matchedLoc.name);
      return;
    }

    // 尝试匹配 NPC 名直接对话
    const matchedNPC = this.npcs.find(n =>
      n.name.includes(input) || n.id.includes(input)
    );
    if (matchedNPC) {
      await this.talkTo(matchedNPC.name);
      return;
    }

    // 最后：用 LLM 理解玩家意图
    await this.parseWithLLM(input);
  }

  /**
   * 用 LLM 解析自然语言输入
   */
  private async parseWithLLM(input: string): Promise<void> {
    const loc = LOCATIONS.find(l => l.id === this.player.location)!;
    const npcsHere = this.getNPCsAtLocation(loc.id);
    const exits = loc.connections.map(c => LOCATIONS.find(l => l.id === c)!.name);

    const prompt = `你是一个文字冒险游戏的指令解析器。根据玩家输入，判断他想做什么。

当前位置: ${loc.name}
可去地点: ${exits.join(', ')}
在场NPC: ${npcsHere.map(n => n.name).join(', ') || '无'}
玩家背包: ${Object.entries(this.player.inventory).filter(([,v]) => v > 0).map(([k,v]) => `${k}(${v})`).join(', ')}

用JSON回复，只能是以下格式之一：
{"action":"move","target":"地点名"}
{"action":"talk","target":"NPC名"}
{"action":"help","target":"NPC名"}
{"action":"look"}
{"action":"bag"}
{"action":"note"}
{"action":"wait"}
{"action":"status"}
{"action":"unknown","message":"简短提示玩家可以做什么"}`;

    try {
      const response = await this.llm.ask(prompt, `玩家输入: "${input}"`);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        switch (parsed.action) {
          case 'move':
            await this.moveTo(parsed.target);
            return;
          case 'talk':
            await this.talkTo(parsed.target);
            return;
          case 'help':
            await this.helpNPC(parsed.target);
            return;
          case 'look':
            return;
          case 'bag':
            this.printInventory();
            return;
          case 'note':
            console.log(`\n  ${this.player.getNotebookSummary()}`);
            return;
          case 'wait':
            this.player.actionPoints = 0;
            await this.advanceTime();
            return;
          case 'status':
            this.printStatus();
            return;
          default:
            console.log(`  ${parsed.message ?? '试试：去某地、找某人、看背包、查笔记'}`);
            return;
        }
      }
    } catch {
      // LLM 失败，回退
    }

    console.log('  [不太明白你的意思。试试：去中心广场、找老埃兹拉、看背包、查笔记]');
  }

  // ============================================================
  // 动作
  // ============================================================

  private async moveTo(dest: string): Promise<void> {
    const targetLoc = LOCATIONS.find(l =>
      l.name.includes(dest) || l.id.includes(dest)
    );

    if (!targetLoc) {
      console.log(`  [找不到"${dest}"这个地方]`);
      console.log(`  [可去: ${LOCATIONS.map(l => l.name).join('、')}]`);
      return;
    }

    if (targetLoc.id === this.player.location) {
      console.log(`  [你已经在${targetLoc.name}了]`);
      return;
    }

    if (!this.player.spendAction(1)) {
      console.log(`  [行动点不足！剩余 ${this.player.actionPoints} 点。输入"等待"进入下一天]`);
      return;
    }

    this.player.location = targetLoc.id;
    console.log(`\n  你走向${targetLoc.name}……`);
    await this.advanceTime();
  }

  private async talkTo(targetName: string): Promise<void> {
    const npcsHere = this.getNPCsAtLocation(this.player.location);
    const npc = npcsHere.find(n =>
      n.name.includes(targetName) || n.id.includes(targetName)
    );

    if (!npc) {
      console.log(`  [这里没有"${targetName}"。当前位置的人: ${npcsHere.map(n => n.name).join('、') || '无人'}]`);
      return;
    }

    if (!this.player.spendAction(1)) {
      console.log(`  [行动点不足！剩余 ${this.player.actionPoints} 点]`);
      return;
    }

    const trustLevel = this.player.getTrustLevel(npc.id);
    console.log(`\n  你走向${npc.name}…… [信任: ${getTrustLevelCN(trustLevel)}]`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  (输入 再见/bye/离开 或按回车退出对话)`);

    // 对话循环
    let chatting = true;
    let turns = 0;
    while (chatting) {
      const msg = await this.ask(`  你对${npc.name}说: `);
      if (!msg || ['bye', '再见', '走了', 'exit', '离开'].includes(msg.trim().toLowerCase())) {
        console.log(`\n  (你离开了${npc.name})`);
        chatting = false;
        break;
      }

      try {
        const reply = await npc.speak(msg.trim(), this.player.name);
        console.log(`  ${npc.name}: "${reply}"\n`);
        turns++;

        // 每次对话好感 +2（倾听效果）
        if (turns <= 3) {
          this.player.changeRelationship(npc.id, 2);
        }
      } catch (e: any) {
        console.log(`  ${npc.name}: "……"（似乎不想说话）\n`);
      }
    }

    console.log(`  ─────────────────────────────────────────`);
  }

  private async collectRation(): Promise<void> {
    const locId = this.player.location;

    // 检查是否今天已经领过
    const rationKey = `ration_day_${this.player.day}`;
    if (this.player.triggeredEvents.has(rationKey)) {
      console.log('  [今天已经领过配给了，明天再来]');
      return;
    }

    if (locId === 'water') {
      this.player.triggeredEvents.add(rationKey);
      this.player.inventory['净水'] = (this.player.inventory['净水'] ?? 0) + 2;
      console.log('  萨米拉在本子上划了一笔，递给你一个水壶。');
      console.log('  "2 升，别洒了。明天同一时间。"');
      console.log('  📦 获得: 净水 ×2');
      this.player.changeRelationship('samira', 1);
    } else if (locId === 'greenhouse') {
      this.player.triggeredEvents.add(rationKey);
      this.player.inventory['干粮'] = (this.player.inventory['干粮'] ?? 0) + 1;
      console.log('  阿洛从水培架上摘下一份螺旋藻饼，用旧报纸包好递给你。');
      console.log('  "今天的配给。蛋白质含量不错的，真的。"');
      console.log('  📦 获得: 干粮 ×1');
      this.player.changeRelationship('arlo', 1);
    } else {
      console.log('  [需要去净水站领水，或去穹顶绿洲领口粮]');
    }
  }

  private async helpNPC(targetName: string): Promise<void> {
    const npcsHere = this.getNPCsAtLocation(this.player.location);
    const npc = npcsHere.find(n =>
      n.name.includes(targetName) || n.id.includes(targetName)
    );

    if (!npc) {
      console.log(`  [这里没有"${targetName}"]`);
      return;
    }

    console.log(`  你想给${npc.name}什么？`);
    console.log(`  你的背包: ${Object.entries(this.player.inventory).map(([k, v]) => `${k}(${v})`).join(', ')}`);

    const item = await this.ask('  物品名: ');
    if (!item.trim()) return;

    const qty = await this.ask('  数量: ');
    const quantity = parseInt(qty) || 1;

    const itemKey = item.trim();
    if (!this.player.inventory[itemKey] || this.player.inventory[itemKey] < quantity) {
      console.log(`  [你没有足够的 ${itemKey}]`);
      return;
    }

    this.player.inventory[itemKey] -= quantity;
    npc.receiveHelp(itemKey, quantity, this.player.name);

    console.log(`  你给了${npc.name} ${quantity} 个 ${itemKey}。`);

    // NPC 反应
    try {
      const reaction = await npc.speak(`谢谢你给我${quantity}个${itemKey}`, this.player.name);
      console.log(`  ${npc.name}: "${reaction}"`);
    } catch {
      console.log(`  ${npc.name}点了点头。`);
    }
  }

  private async advanceTime(): Promise<void> {
    this.tick++;
    this.world.advanceHour();

    // 检查是否行动点用完 → 新的一天
    if (this.player.actionPoints <= 0) {
      this.player.newDay();
      console.log(`\n  🌙 夜幕降临，你回到帐篷休息……`);
      console.log(`  ☀️ Day ${this.player.day} 开始 | 行动点恢复: ${this.player.actionPoints}/${this.player.maxActionPoints}`);

      if (this.player.day % 3 === 0 && this.player.inventory['干粮'] <= 0) {
        console.log(`  ⚠️ 没有干粮！体力下降，行动点上限 -1`);
      }
    }

    // NPC 行动
    for (const npc of this.npcs) {
      await npc.update(1);
    }

    // 社交引擎
    const encounters = await this.social.processEncounters(this.npcs, this.tick);

    // 显示玩家能看到的事件
    const npcsHere = this.getNPCsAtLocation(this.player.location);
    if (npcsHere.length > 0) {
      for (const npc of npcsHere) {
        const logs = npc.getLog();
        const recent = logs.filter(l => l.day === this.world.currentDay && l.hour === this.world.currentHour);
        for (const entry of recent) {
          if (entry.type === 'action') {
            console.log(`  [${npc.name}] ${entry.message}`);
          }
        }
      }
    }

    // 显示对话事件
    for (const enc of encounters) {
      const isHere = enc.participants.some(n => this.normalizeLocation(n.location) === this.normalizeLocation(this.getLocationName()));
      if (isHere && enc.dialogues.length > 0) {
        console.log(`\n  [你听到附近的对话]`);
        for (const line of enc.dialogues) {
          console.log(`    ${line.speaker}: "${line.dialogue}"`);
        }
      }
    }
  }

  /**
   * 检查并显示事件
   */
  private async checkAndDisplayEvents(): Promise<void> {
    const result = this.events.checkEvents(this.player, this.npcs);
    if (!result) return;

    console.log(`\n  ═══════════════════════════════════════`);
    console.log(`  ${result.message}`);

    if (result.choiceRequired) {
      console.log(`\n  ${result.choiceRequired.prompt}`);
      for (let i = 0; i < result.choiceRequired.options.length; i++) {
        console.log(`    ${i + 1}. ${result.choiceRequired.options[i].text}`);
      }

      const choice = await this.ask('\n  你的选择 (数字): ');
      const idx = parseInt(choice) - 1;

      if (idx >= 0 && idx < result.choiceRequired.options.length) {
        const chosen = result.choiceRequired.options[idx];
        console.log(`\n  ${chosen.result.message}`);
        this.player.totalChoices++;

        // 应用选择结果
        if (chosen.result.relationshipChanges) {
          for (const [npcId, delta] of Object.entries(chosen.result.relationshipChanges)) {
            this.player.changeRelationship(npcId, delta);
          }
        }
        if (chosen.result.inventoryChanges) {
          for (const [item, delta] of Object.entries(chosen.result.inventoryChanges)) {
            this.player.inventory[item] = (this.player.inventory[item] ?? 0) + delta;
          }
        }
        if (chosen.result.fragmentsDiscovered) {
          for (const fragId of chosen.result.fragmentsDiscovered) {
            const frag = this.player.discoverFragment(fragId, '事件');
            if (frag) console.log(`  📝 新线索: ${frag.content}`);
          }
        }
      }
    }

    // 显示发现的碎片
    if (result.fragmentsDiscovered) {
      for (const fragId of result.fragmentsDiscovered) {
        const topic = this.player.notebook.find(t => t.fragments.some(f => f.id === fragId));
        const frag = topic?.fragments.find(f => f.id === fragId);
        if (frag?.discovered) {
          console.log(`  📝 新线索 [${topic!.title}]: ${frag.content}`);
        }
      }
    }

    console.log(`  ═══════════════════════════════════════`);
  }

  // ============================================================
  // 工具
  // ============================================================

  private getNPCsAtLocation(locationId: string): SmartNPC[] {
    const locName = LOCATIONS.find(l => l.id === locationId)?.name ?? '';
    return this.npcs.filter(npc => this.normalizeLocation(npc.location) === this.normalizeLocation(locName));
  }

  private normalizeLocation(loc: string): string {
    if (loc.includes('帐篷') || loc.includes('北区')) return 'tent';
    if (loc.includes('广场') || loc.includes('议会')) return 'plaza';
    if (loc.includes('绿洲') || loc.includes('温室') || loc.includes('农场')) return 'greenhouse';
    if (loc.includes('净水')) return 'water';
    if (loc.includes('市场') || loc.includes('黑冰')) return 'market';
    if (loc.includes('废墟')) return 'ruins';
    if (loc.includes('回声井')) return 'echo_well';
    if (loc.includes('南门')) return 'south_gate';
    return loc;
  }

  private getLocationName(): string {
    return LOCATIONS.find(l => l.id === this.player.location)?.name ?? '';
  }

  private getTimeStr(): string {
    return `Day${this.player.day} ${String(this.world.currentHour).padStart(2, '0')}:00`;
  }

  private printHelp(): void {
    console.log(`
  ┌─── 指令帮助 ───────────────────────────────
  │ 移动:  go/走/去 + 地点名     (消耗 1 行动点)
  │ 对话:  talk/说/找 + NPC名    (消耗 1 行动点)
  │ 帮助:  帮助 + NPC名          (给 NPC 物品)
  │ 查看:  look/看               (查看当前位置)
  │ 背包:  bag/背包              (查看物品)
  │ 笔记:  note/笔记             (查看线索笔记本)
  │ 状态:  status/状态           (查看世界状态)
  │ 等待:  wait/等待             (结束今天，进入下一天)
  │ 退出:  quit/退出
  │
  │ 💡 也可以直接输入地点名移动，或 NPC 名对话
  │ 💡 每天 5 个行动点，用完自动进入下一天
  └─────────────────────────────────────────────`);
  }

  private printInventory(): void {
    console.log(`\n  🎒 背包:`);
    for (const [item, qty] of Object.entries(this.player.inventory)) {
      if (qty > 0) console.log(`    ${item}: ${qty}`);
    }
    console.log(`\n  📊 Day ${this.player.day} | 行动点: ${this.player.actionPoints}/${this.player.maxActionPoints}`);
  }

  private printStatus(): void {
    console.log(`\n  📊 世界状态: ${this.getTimeStr()} | 季节: ${this.world.season === 'ash' ? '灰季' : this.world.season === 'acid_rain' ? '酸雨季' : '苏醒季'}`);
    console.log(`  👤 ${this.player.name} | 📍 ${this.getLocationName()}`);
    console.log(`\n  NPC 位置:`);
    for (const npc of this.npcs) {
      console.log(`    ${npc.name}: ${npc.location} (${npc.getCurrentActivity()})`);
    }
  }

  // ============================================================
  // 存档 / 读档
  // ============================================================

  private saveGame(): void {
    const data = {
      player: {
        name: this.player.name,
        location: this.player.location,
        day: this.player.day,
        actionPoints: this.player.actionPoints,
        maxActionPoints: this.player.maxActionPoints,
        inventory: this.player.inventory,
        relationships: this.player.relationships,
        notebook: this.player.notebook,
        triggeredEvents: Array.from(this.player.triggeredEvents),
        totalChoices: this.player.totalChoices,
        secretsDiscovered: this.player.secretsDiscovered,
      },
      world: {
        currentHour: this.world.currentHour,
        currentDay: this.world.currentDay,
        season: this.world.season,
        events: Array.from(this.world.events),
      },
      npcs: this.npcs.map(n => n.serialize()),
      tick: this.tick,
    };

    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
  }

  private loadGame(): boolean {
    if (!fs.existsSync(SAVE_FILE)) return false;

    try {
      const raw = fs.readFileSync(SAVE_FILE, 'utf-8');
      const data = JSON.parse(raw);

      // 恢复玩家
      this.player.name = data.player.name;
      this.player.location = data.player.location;
      this.player.day = data.player.day;
      this.player.actionPoints = data.player.actionPoints;
      this.player.maxActionPoints = data.player.maxActionPoints;
      this.player.inventory = data.player.inventory;
      this.player.relationships = data.player.relationships;
      this.player.notebook = data.player.notebook;
      this.player.triggeredEvents = new Set(data.player.triggeredEvents);
      this.player.totalChoices = data.player.totalChoices;
      this.player.secretsDiscovered = data.player.secretsDiscovered;

      // 恢复世界
      this.world.currentHour = data.world.currentHour;
      this.world.currentDay = data.world.currentDay;
      this.world.season = data.world.season;
      this.world.events = new Set(data.world.events);

      // 恢复 NPC 状态
      if (data.npcs) {
        for (const saved of data.npcs) {
          const npc = this.npcs.find(n => n.id === saved.id);
          if (npc) {
            npc.location = saved.location;
            npc.mood = saved.mood;
            npc.hunger = saved.hunger;
            npc.thirst = saved.thirst;
            npc.energy = saved.energy;
            npc.social = saved.social;
            if (saved.inventory) npc.inventory = saved.inventory;
            if (saved.memories) npc.memories = saved.memories;
          }
        }
      }

      this.tick = data.tick ?? 0;
      return true;
    } catch {
      return false;
    }
  }

  private ask(prompt: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }
}

// ============================================================
// 启动
// ============================================================

const game = new SeedCityCLI();
game.start().catch(e => {
  console.error('游戏崩溃:', e.message);
  process.exit(1);
});
