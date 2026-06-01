/**
 * SmartNPC.ts
 * 智能 NPC 统一架构 —— 状态机骨架 + LLM 灵魂
 *
 * 设计原则：
 * - 状态机负责：需求管理、计划推进、位置移动、库存计算（确定性、高性能）
 * - LLM 负责：内心独白、对话生成、情绪反应、创意替代方案（按需调用）
 * - LLM 挂了游戏照样跑，只是 NPC 不说话
 */

import { LLMClient } from '../llm/LLMClient';
import { WorldState } from './WorldState';
import { MemorySystem } from './MemorySystem';

// ============================================================
// 类型定义
// ============================================================

export interface NPCProfile {
  id: string;
  name: string;
  personality: string;
  background: string;
  speakingStyle: string;
  schedule: string;          // 日常作息描述
  goals: GoalDef[];
  relationships: Record<string, { affinity: number; note: string }>;
  defaultLocation: string;
  inventory: Record<string, number>;
  // 个体差异
  needs?: {
    hunger?: number;       // 初始饥饿值 (默认 70)
    thirst?: number;       // 初始口渴值 (默认 65)
    energy?: number;       // 初始精力 (默认 80)
    hungerRate?: number;   // 饥饿衰减速率 (默认 3)
    thirstRate?: number;   // 口渴衰减速率 (默认 4)
    energyRate?: number;   // 精力衰减速率 (默认 2)
  };
}

export interface GoalDef {
  id: string;
  description: string;
  priority: number;
  active: boolean;
  steps: StepDef[];
}

export interface StepDef {
  name: string;
  description: string;
  duration: number;       // 游戏小时
  successRate: number;    // 0~1
  location: string;       // 执行地点
  alternatives?: string[]; // 替代方案描述
}

export interface NPCLog {
  day: number;
  hour: number;
  type: 'action' | 'thought' | 'dialogue' | 'decision' | 'failure' | 'event' | 'relationship';
  message: string;
}

type NPCStatus = 'idle' | 'executing' | 'blocked' | 'resting' | 'socializing';

// ============================================================
// 智能 NPC 类
// ============================================================

export class SmartNPC {
  // 基础属性
  public id: string;
  public name: string;
  public status: NPCStatus = 'idle';
  public location: string;
  public mood: string = '平静';

  // 需求 (0-100)
  public hunger: number = 70;
  public thirst: number = 65;
  public energy: number = 80;
  public social: number = 40;

  // 个体衰减速率
  private hungerRate: number = 3;
  private thirstRate: number = 4;
  private energyRate: number = 2;

  // 库存
  public inventory: Record<string, number>;

  // 关系
  public relationships: Record<string, number> = {};

  // 计划系统
  private goals: GoalState[] = [];
  private currentGoalIndex: number = -1;
  private currentStepIndex: number = 0;
  private stepHoursSpent: number = 0;
  private stepFailCount: number = 0;

  // 记忆
  public memories: string[] = [];
  private maxMemories = 20;

  // 记忆系统（长期）
  public memorySystem: MemorySystem = new MemorySystem();

  // 时间
  public totalHoursElapsed: number = 0;

  // 日志
  private log: NPCLog[] = [];
  private logVersion: number = 0; // 每次压缩时递增，外部可检测变化

  // LLM（可选）
  private llm: LLMClient | null;
  private profile: NPCProfile;
  private llmCooldown: number = 0; // 避免频繁调用

  constructor(profile: NPCProfile, private world: WorldState, llm?: LLMClient) {
    this.profile = profile;
    this.id = profile.id;
    this.name = profile.name;
    this.location = profile.defaultLocation;
    this.inventory = { ...profile.inventory };
    this.llm = llm ?? null;

    // 初始化关系
    for (const [target, rel] of Object.entries(profile.relationships)) {
      this.relationships[target] = rel.affinity;
    }

    // 初始化目标
    this.goals = profile.goals.map(g => ({
      ...g,
      completed: false,
      currentStep: 0,
    }));

    // 个体差异：需求初始值和衰减速率
    if (profile.needs) {
      if (profile.needs.hunger !== undefined) this.hunger = profile.needs.hunger;
      if (profile.needs.thirst !== undefined) this.thirst = profile.needs.thirst;
      if (profile.needs.energy !== undefined) this.energy = profile.needs.energy;
      if (profile.needs.hungerRate !== undefined) this.hungerRate = profile.needs.hungerRate;
      if (profile.needs.thirstRate !== undefined) this.thirstRate = profile.needs.thirstRate;
      if (profile.needs.energyRate !== undefined) this.energyRate = profile.needs.energyRate;
    }
  }

  // ============================================================
  // 主循环（状态机驱动，每 tick 调用）
  // ============================================================

  public async update(hoursPassed: number = 1): Promise<void> {
    this.totalHoursElapsed += hoursPassed;
    this.updateNeeds(hoursPassed);
    if (this.llmCooldown > 0) this.llmCooldown--;

    // 1. 紧急需求检查（状态机硬逻辑）
    const urgentAction = this.checkUrgentNeeds();
    if (urgentAction) {
      this.executeUrgentAction(urgentAction);
      return;
    }

    // 2. 推进当前计划（状态机）
    if (this.currentGoalIndex >= 0) {
      await this.executeCurrentStep();
    } else {
      // 3. 选择新目标
      this.selectNextGoal();
    }
  }

  // ============================================================
  // 状态机层：需求系统
  // ============================================================

  private updateNeeds(hours: number): void {
    this.hunger = Math.max(0, this.hunger - this.hungerRate * hours);
    this.thirst = Math.max(0, this.thirst - this.thirstRate * hours);
    this.energy = Math.max(0, this.energy - this.energyRate * hours);
    this.social = Math.max(0, this.social - 1 * hours);
  }

  private checkUrgentNeeds(): string | null {
    if (this.energy < 12) return 'sleep';
    if (this.thirst < 20) return 'drink';
    if (this.hunger < 20) return 'eat';
    return null;
  }

  private executeUrgentAction(action: string): void {
    switch (action) {
      case 'sleep':
        this.location = this.profile.defaultLocation;
        this.status = 'resting';
        this.energy = Math.min(100, this.energy + 12);
        this.addLog('action', '回去休息');
        this.generateThought('太累了，得歇会儿');
        break;
      case 'drink':
        this.location = '净水站';
        this.thirst = Math.min(100, this.thirst + 40);
        this.addLog('action', '去净水站取水');
        this.generateThought('渴得嗓子冒烟');
        break;
      case 'eat':
        this.location = '穹顶绿洲';
        this.hunger = Math.min(100, this.hunger + 35);
        this.addLog('action', '去穹顶绿洲领取食物配给');
        this.generateThought('肚子在叫了');
        break;
    }
  }

  // ============================================================
  // 状态机层：计划系统
  // ============================================================

  private selectNextGoal(): void {
    const available = this.goals
      .filter(g => g.active && !g.completed)
      .sort((a, b) => b.priority - a.priority);

    if (available.length === 0) {
      this.status = 'idle';
      return;
    }

    const goal = available[0];
    this.currentGoalIndex = this.goals.indexOf(goal);
    this.currentStepIndex = goal.currentStep;
    this.stepHoursSpent = 0;
    this.stepFailCount = 0;
    this.status = 'executing';

    this.addLog('decision', `开始目标: ${goal.description}`);
    this.generateThought(`该干正事了——${goal.description}`);
  }

  private async executeCurrentStep(): Promise<void> {
    const goal = this.goals[this.currentGoalIndex];
    if (!goal || this.currentStepIndex >= goal.steps.length) {
      // 目标完成
      goal.completed = true;
      this.addLog('event', `🎉 目标完成: ${goal.description}`);
      this.generateThought(`总算搞定了——${goal.description}`);
      this.currentGoalIndex = -1;
      this.status = 'idle';
      return;
    }

    const step = goal.steps[this.currentStepIndex];
    this.location = step.location;
    this.status = 'executing';
    this.stepHoursSpent++;

    // 还没到时间
    if (this.stepHoursSpent < step.duration) {
      this.addLog('action', `${step.description} (${this.stepHoursSpent}/${step.duration}h)`);
      return;
    }

    // 时间到，判定成功/失败
    const roll = this.world.random();
    if (roll <= step.successRate) {
      // 成功
      this.addLog('action', `✓ 步骤完成: ${step.name}`);
      this.generateThought(`${step.name}搞定了`);
      this.currentStepIndex++;
      goal.currentStep = this.currentStepIndex;
      this.stepHoursSpent = 0;
      this.stepFailCount = 0;
    } else {
      // 失败
      this.stepFailCount++;
      this.addLog('failure', `步骤失败: ${step.name} (第${this.stepFailCount}次)`);

      if (this.stepFailCount >= 3) {
        // 触发替代方案（LLM 参与决策）
        await this.handleStepFailure(goal, step);
      } else {
        this.stepHoursSpent = 0; // 重试
        this.generateThought(`失败了，再来一次`);
      }
    }
  }

  /**
   * 步骤连续失败 → 寻找替代方案（LLM 增强）
   */
  private async handleStepFailure(goal: GoalState, step: StepDef): Promise<void> {
    // 如果有预定义替代方案，用状态机逻辑
    if (step.alternatives && step.alternatives.length > 0) {
      const alt = step.alternatives[0];
      this.addLog('decision', `切换替代方案: ${alt}`);
      this.generateThought(`这条路走不通，换个法子——${alt}`);

      // 提高成功率（替代方案通常更容易）
      step.successRate = Math.min(0.9, step.successRate + 0.3);
      this.stepHoursSpent = 0;
      this.stepFailCount = 0;
      return;
    }

    // 没有预定义替代方案 → 让 LLM 想一个
    if (this.llm && this.llmCooldown <= 0) {
      const creative = await this.askLLMForAlternative(goal, step);
      if (creative) {
        this.addLog('decision', `[AI创意] ${creative}`);
        this.addMemory(`想到了新办法: ${creative}`);
        step.successRate = Math.min(0.85, step.successRate + 0.25);
        this.stepHoursSpent = 0;
        this.stepFailCount = 0;
        this.llmCooldown = 3;
        return;
      }
    }

    // 彻底失败，放弃当前目标
    this.addLog('failure', `放弃目标: ${goal.description}`);
    this.generateThought(`算了，这事暂时搞不定`);
    this.currentGoalIndex = -1;
    this.status = 'idle';
  }

  // ============================================================
  // LLM 层：按需调用
  // ============================================================

  /**
   * 生成内心独白（非阻塞，失败不影响游戏）
   */
  private generateThought(situation: string): void {
    if (!this.llm || this.llmCooldown > 0) {
      // 无 LLM 时用简单模板
      this.addLog('thought', situation);
      return;
    }

    // 异步生成，不阻塞主循环
    this.llm.ask(
      this.buildPersonalityPrompt() + '\n\n用一句话表达你对当前情况的内心感受（第一人称，符合性格）。',
      `当前情况: ${situation}`
    ).then(reply => {
      this.addLog('thought', reply.trim().slice(0, 100));
      this.llmCooldown = 2;
    }).catch(() => {
      this.addLog('thought', situation);
    });
  }

  /**
   * 与玩家/NPC 对话（使用指定的 LLM 客户端）
   */
  public async speakWith(context: string, speakerName: string, llmClient: LLMClient): Promise<string> {
    try {
      const longTermMemories = this.memorySystem.getContextMemories(6);
      const memoryContext = longTermMemories.length > 0
        ? `\n\n## 你的记忆\n${longTermMemories.map(m => `- ${m}`).join('\n')}`
        : '';

      const prompt = this.buildPersonalityPrompt() + `\n\n## 当前状态
- 位置: ${this.location}
- 心情: ${this.mood}
- 正在做: ${this.getCurrentActivity()}
- 最近的事: ${this.memories.slice(-5).join('；')}${memoryContext}

## 规则
- 回复1-2句话，保持角色性格
- 用中文`;

      const reply = await llmClient.ask(prompt, `${speakerName}对你说: "${context}"`);
      const cleaned = reply.trim().replace(/^[""]|[""]$/g, '');
      this.addLog('dialogue', `[对${speakerName}] "${cleaned}"`);
      return cleaned;
    } catch {
      return this.getDefaultReply(context);
    }
  }

  /**
   * 与玩家/NPC 对话（使用内置 LLM）
   */
  public async speak(context: string, speakerName: string): Promise<string> {
    if (!this.llm) {
      return this.getDefaultReply(context);
    }

    try {
      // 获取长期记忆作为上下文
      const longTermMemories = this.memorySystem.getContextMemories(6);
      const memoryContext = longTermMemories.length > 0
        ? `\n\n## 你的记忆\n${longTermMemories.map(m => `- ${m}`).join('\n')}`
        : '';

      const prompt = this.buildPersonalityPrompt() + `\n\n## 当前状态
- 位置: ${this.location}
- 心情: ${this.mood}
- 正在做: ${this.getCurrentActivity()}
- 最近的事: ${this.memories.slice(-5).join('；')}${memoryContext}

## 规则
- 回复1-2句话，保持角色性格
- 用中文`;

      const reply = await this.llm.ask(prompt, `${speakerName}对你说: "${context}"`);
      const cleaned = reply.trim().replace(/^[""]|[""]$/g, '');
      this.addLog('dialogue', `[对${speakerName}] "${cleaned}"`);
      return cleaned;
    } catch {
      return this.getDefaultReply(context);
    }
  }

  /**
   * NPC 相遇时的主动发言
   */
  public async greet(otherNames: string[], situation: string): Promise<string> {
    if (!this.llm) {
      return `嗯。`;
    }

    try {
      const prompt = this.buildPersonalityPrompt() + `\n\n你在${this.location}遇到了${otherNames.join('和')}。${situation}\n用1-2句话自然地打招呼或说点什么。保持角色性格。`;
      const reply = await this.llm.ask(prompt, '请说话。');
      return reply.trim().replace(/^[""]|[""]$/g, '');
    } catch {
      return '嗯。';
    }
  }

  /**
   * 让 LLM 想替代方案
   */
  private async askLLMForAlternative(goal: GoalState, step: StepDef): Promise<string | null> {
    if (!this.llm) return null;

    try {
      const prompt = this.buildPersonalityPrompt() + `\n\n你正在执行"${goal.description}"，但"${step.description}"连续失败了3次。
你的库存: ${JSON.stringify(this.inventory)}
你的关系: ${Object.entries(this.relationships).map(([k, v]) => `${k}(${v})`).join(', ')}

用一句话描述一个符合你性格的替代方案（不要超出世界观设定）。`;

      const reply = await this.llm.ask(prompt, '想一个替代方案。');
      return reply.trim().slice(0, 80);
    } catch {
      return null;
    }
  }

  /**
   * 构建人格提示词
   */
  private buildPersonalityPrompt(): string {
    return `你是${this.name}。
性格: ${this.profile.personality}
背景: ${this.profile.background}
说话风格: ${this.profile.speakingStyle}`;
  }

  /**
   * 无 LLM 时的默认回复
   */
  private getDefaultReply(_context: string): string {
    const defaults = ['嗯。', '没空。', '再说。', '别烦我。'];
    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  // ============================================================
  // 玩家交互
  // ============================================================

  public receiveHelp(item: string, quantity: number, playerId: string = 'player'): void {
    if (item in this.inventory) {
      this.inventory[item] = (this.inventory[item] ?? 0) + quantity;
    }

    const gain = Math.min(20, quantity * 7);
    this.relationships[playerId] = Math.min(100, (this.relationships[playerId] ?? 0) + gain);

    this.addLog('relationship', `${playerId} 提供了 ${quantity} 个 ${item}，好感 +${gain}`);
    this.addMemory(`有人帮了我，给了${quantity}个${item}`);
    this.generateThought(`有人帮忙了，虽然不想承认，但确实有用`);
  }

  public sufferSabotage(item: string, quantity: number, playerId: string = 'player'): void {
    if (item in this.inventory) {
      this.inventory[item] = Math.max(0, (this.inventory[item] ?? 0) - quantity);
    }

    const loss = Math.min(30, quantity * 15);
    this.relationships[playerId] = Math.max(-100, (this.relationships[playerId] ?? 0) - loss);

    this.addLog('relationship', `被偷了 ${quantity} 个 ${item}，好感 -${loss}`);
    this.addMemory(`东西被偷了！${quantity}个${item}没了`);
    this.generateThought(`该死的小偷`);
  }

  // ============================================================
  // 工具方法
  // ============================================================

  public getCurrentActivity(): string {
    if (this.currentGoalIndex < 0) return '闲逛';
    const goal = this.goals[this.currentGoalIndex];
    if (!goal || this.currentStepIndex >= goal.steps.length) return '闲逛';
    return goal.steps[this.currentStepIndex].description;
  }

  public getStatusBrief(): string {
    return `${this.name}: 在${this.location}，${this.getCurrentActivity()}（${this.mood}）`;
  }

  public addLog(type: NPCLog['type'], message: string): void {
    const day = this.world.currentDay;
    const hour = this.world.currentHour;
    const minute = this.world.currentMinute;
    this.log.push({ day, hour: hour * 100 + minute, type, message });

    // 日志超量时压缩为记忆
    if (this.log.length > 100) {
      const oldLogs = this.log.slice(0, 50);
      this.log = this.log.slice(50);
      this.logVersion++;

      this.memorySystem.consolidate(oldLogs);
      this.memorySystem.decay(day);
    }
  }

  public getLog(): NPCLog[] { return [...this.log]; }

  public getLogVersion(): number { return this.logVersion; }

  public addMemory(memory: string): void {
    this.memories.push(memory);
    if (this.memories.length > this.maxMemories) this.memories.shift();
  }

  public getFormattedLog(): string {
    return this.log.map(e => {
      const icon = { action: '⚡', thought: '💭', dialogue: '💬', decision: '🧠', failure: '⚠️', event: '📢', relationship: '❤️' }[e.type];
      const h = Math.floor(e.hour / 100);
      const m = e.hour % 100;
      return `[Day${e.day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}] ${icon} ${e.message}`;
    }).join('\n');
  }

  /**
   * 序列化
   */
  public serialize(): object {
    return {
      id: this.id,
      status: this.status,
      location: this.location,
      mood: this.mood,
      hunger: this.hunger,
      thirst: this.thirst,
      energy: this.energy,
      social: this.social,
      inventory: this.inventory,
      relationships: this.relationships,
      memories: this.memories,
      memorySystem: this.memorySystem.serialize(),
      totalHoursElapsed: this.totalHoursElapsed,
      currentGoalIndex: this.currentGoalIndex,
      currentStepIndex: this.currentStepIndex,
      stepHoursSpent: this.stepHoursSpent,
      goals: this.goals,
    };
  }
}

// ============================================================
// 内部类型
// ============================================================

interface GoalState extends GoalDef {
  completed: boolean;
  currentStep: number;
}
