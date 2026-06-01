/**
 * SocialEngine.ts
 * 社交引擎 —— 自动检测 NPC 相遇并生成自然对话
 *
 * 工作流程：
 * 1. 每 Tick 后检查所有 NPC 的位置
 * 2. 同一地点的 NPC 形成"相遇组"
 * 3. 根据关系、心情、当前活动决定是否触发对话
 * 4. 触发对话时，生成 1-3 轮自然交流
 * 5. 对话结果写入双方记忆
 */

import { LLMClient, ChatMessage } from '../llm/LLMClient';
import { SmartNPC } from './SmartNPC';

export interface Encounter {
  location: string;
  participants: SmartNPC[];
  dialogues: DialogueLine[];
  timestamp: { day: number; hour: number };
}

export interface DialogueLine {
  speaker: string;
  action?: string;
  dialogue: string;
}

export class SocialEngine {
  private llm: LLMClient;
  private recentEncounters: Map<string, number> = new Map(); // "npcA:npcB" → 上次对话的 tick
  private cooldownTicks = 4; // 同一对 NPC 至少间隔 4 小时才会再次对话

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * 每 Tick 调用：检测相遇并生成对话
   */
  async processEncounters(npcs: SmartNPC[], currentTick: number): Promise<Encounter[]> {
    // 1. 按位置分组
    const locationGroups = this.groupByLocation(npcs);

    // 2. 筛选有效相遇（2+ 人，且不在冷却中）
    const encounters: Encounter[] = [];

    for (const [location, group] of locationGroups) {
      if (group.length < 2) continue;

      // 检查是否应该触发对话
      const shouldTalk = this.shouldTriggerDialogue(group, currentTick);
      if (!shouldTalk.trigger) continue;

      // 3. 生成对话
      const participants = shouldTalk.participants;
      const dialogue = await this.generateDialogue(participants, location);

      if (dialogue.length > 0) {
        const day = Math.floor(currentTick / 26) + 1;
        const hour = currentTick % 26;

        encounters.push({
          location,
          participants,
          dialogues: dialogue,
          timestamp: { day, hour },
        });

        // 4. 写入记忆
        this.applyDialogueEffects(participants, dialogue, location);

        // 5. 更新冷却
        this.updateCooldowns(participants, currentTick);
      }
    }

    return encounters;
  }

  /**
   * 按位置分组
   */
  private groupByLocation(npcs: SmartNPC[]): Map<string, SmartNPC[]> {
    const groups = new Map<string, SmartNPC[]>();
    for (const npc of npcs) {
      // 标准化位置名（去掉细节差异）
      const loc = this.normalizeLocation(npc.location);
      if (!groups.has(loc)) groups.set(loc, []);
      groups.get(loc)!.push(npc);
    }
    return groups;
  }

  /**
   * 标准化位置名
   */
  private normalizeLocation(location: string): string {
    if (location.includes('帐篷') || location.includes('北区')) return '北区帐篷';
    if (location.includes('广场') || location.includes('议会')) return '中心广场';
    if (location.includes('绿洲') || location.includes('温室') || location.includes('农场')) return '穹顶绿洲';
    if (location.includes('净水')) return '净水站';
    if (location.includes('市场') || location.includes('黑冰')) return '黑冰市场';
    if (location.includes('废墟')) return '废墟区';
    if (location.includes('回声井')) return '回声井';
    if (location.includes('南门')) return '南门';
    return location;
  }

  /**
   * 判断是否触发对话
   */
  private shouldTriggerDialogue(group: SmartNPC[], currentTick: number): { trigger: boolean; participants: SmartNPC[] } {
    // 从组中选出 2-3 个适合对话的 NPC
    const candidates: SmartNPC[] = [];

    for (const npc of group) {
      // 排除条件：太累、正在睡觉
      if (npc.energy < 10) continue;
      if (npc.getCurrentActivity().includes('睡') || npc.getCurrentActivity().includes('休息')) continue;
      candidates.push(npc);
    }

    if (candidates.length < 2) return { trigger: false, participants: [] };

    // 检查冷却
    const pair = candidates.slice(0, 3); // 最多 3 人
    const pairKey = pair.map(n => n.id).sort().join(':');
    const lastEncounter = this.recentEncounters.get(pairKey) ?? -999;

    if (currentTick - lastEncounter < this.cooldownTicks) {
      return { trigger: false, participants: [] };
    }

    // 触发概率：基于社交需求和关系
    const avgSocialNeed = pair.reduce((s, n) => s + (100 - n.social), 0) / pair.length;
    const triggerChance = Math.min(0.8, avgSocialNeed / 100 + 0.2);

    if (Math.random() > triggerChance) {
      return { trigger: false, participants: [] };
    }

    return { trigger: true, participants: pair };
  }

  /**
   * 生成自然对话（1-3 轮）
   */
  private async generateDialogue(participants: SmartNPC[], location: string): Promise<DialogueLine[]> {
    const names = participants.map(n => n.name);
    const rounds = Math.min(participants.length + 1, 4); // 2人=3轮, 3人=4轮

    const context = this.buildEncounterContext(participants, location);
    const dialogues: DialogueLine[] = [];
    const history: string[] = [];

    for (let i = 0; i < rounds; i++) {
      const speaker = participants[i % participants.length];
      const others = participants.filter(n => n.id !== speaker.id);

      const prompt = this.buildSpeakerPrompt(speaker, others, location, history, i === 0);

      try {
        const response = await this.llm.chat([
          { role: 'system', content: prompt },
          { role: 'user', content: i === 0
            ? `你在${location}遇到了${others.map(n => n.name).join('和')}。自然地开口说话。`
            : '根据对话自然接话。' },
        ]);

        const raw = response.content.trim();
        const parsed = this.parseLine(raw);

        dialogues.push({ speaker: speaker.name, ...parsed });
        history.push(`${speaker.name}: "${parsed.dialogue}"`);
      } catch {
        break; // LLM 失败就结束对话
      }
    }

    return dialogues;
  }

  /**
   * 构建说话者提示词
   */
  private buildSpeakerPrompt(
    speaker: SmartNPC,
    others: SmartNPC[],
    location: string,
    history: string[],
    isFirst: boolean
  ): string {
    const othersDesc = others.map(n =>
      `${n.name}（${n.mood}，正在${n.getCurrentActivity()}）`
    ).join('、');

    let prompt = `你是${speaker.name}。
性格关键词: ${speaker.mood}
当前活动: ${speaker.getCurrentActivity()}
你在${location}遇到了${othersDesc}。

规则:
- 只输出你说的话（1-2句）
- 可以加简短动作，格式: (动作) 对话内容
- 保持角色性格
- 对话要自然，像真人偶遇时的闲聊
- 可以谈正事、抱怨、开玩笑、或只是打个招呼
- 用中文`;

    if (history.length > 0) {
      prompt += `\n\n之前说的:\n${history.join('\n')}`;
    }

    return prompt;
  }

  /**
   * 构建相遇上下文
   */
  private buildEncounterContext(participants: SmartNPC[], location: string): string {
    return participants.map(n =>
      `${n.name}: 在${location}，${n.getCurrentActivity()}（心情: ${n.mood}）`
    ).join('\n');
  }

  /**
   * 解析对话行
   */
  private parseLine(raw: string): { action?: string; dialogue: string } {
    const match = raw.match(/\(([^)]+)\)\s*(.+)/);
    if (match) {
      return { action: match[1].trim(), dialogue: match[2].replace(/["""]/g, '').trim() };
    }
    return { dialogue: raw.replace(/["""]/g, '').trim() };
  }

  /**
   * 对话效果：写入记忆 + 恢复社交值
   */
  private applyDialogueEffects(participants: SmartNPC[], dialogues: DialogueLine[], location: string): void {
    const summary = dialogues.map(d => `${d.speaker}说: "${d.dialogue}"`).join('；');
    const shortSummary = `在${location}和${participants.map(n => n.name).join('、')}聊了几句`;

    for (const npc of participants) {
      // 写入记忆
      npc.memories.push(shortSummary);
      if (npc.memories.length > 15) npc.memories.shift();

      // 恢复社交值
      npc.social = Math.min(100, npc.social + 10);

      // 记录到日志
      const myLines = dialogues.filter(d => d.speaker === npc.name);
      for (const line of myLines) {
        npc.addLog('dialogue', `[对${participants.filter(n => n.name !== npc.name).map(n => n.name).join('、')}] "${line.dialogue}"`);
      }
    }
  }

  /**
   * 更新冷却
   */
  private updateCooldowns(participants: SmartNPC[], tick: number): void {
    const key = participants.map(n => n.id).sort().join(':');
    this.recentEncounters.set(key, tick);
  }
}
