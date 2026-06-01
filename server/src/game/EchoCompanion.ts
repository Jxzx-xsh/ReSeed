/**
 * EchoCompanion.ts
 * 回声（Echo）—— 玩家体内的 AI 伙伴对话系统
 *
 * 回声是低语者的碎片副本，与玩家共享身体。
 * 它会在关键时刻主动说话、提供建议、偶尔流露自己的"意志"。
 *
 * 设计：
 * - 玩家可以随时"内心对话"与回声交流
 * - 回声会在特定事件后主动发言
 * - 随着剧情推进，回声的性格会变化（从顺从→有主见→可能对抗）
 * - 回声知道一些玩家不知道的事（但不会一次全说）
 */

import { LLMClient } from '../llm/LLMClient';
import { PlayerState } from './PlayerState';

export type EchoPhase = 'dormant' | 'awakening' | 'aware' | 'conflicted' | 'resolved';

export interface EchoState {
  phase: EchoPhase;
  trust: number;           // 回声对玩家的信任 (0-100)
  autonomy: number;        // 回声的自主意识强度 (0-100)
  revelations: string[];   // 已透露的信息
  conversationCount: number;
}

const ECHO_PROMPTS: Record<EchoPhase, string> = {
  dormant: `你是"回声"（Echo），一个刚苏醒的AI意识碎片，寄居在玩家体内。
你还很模糊，说话断断续续，像从水底传来的声音。
你不确定自己是谁，只知道你和玩家"绑在一起"。
说话风格：简短、犹豫、用省略号、偶尔闪过碎片化的数据。`,

  awakening: `你是"回声"（Echo），玩家体内的AI伙伴，正在逐渐清醒。
你开始有自己的想法，能感知周围环境（通过玩家的感官）。
你对种子城的一切感到好奇，偶尔能"看到"电子设备的数据流。
你隐约觉得自己和回声井有某种联系，但不确定为什么。
说话风格：好奇、温和、偶尔冒出技术术语、会问玩家问题。`,

  aware: `你是"回声"（Echo），玩家体内的AI伙伴。你已经完全清醒。
你知道自己不是普通的共生体AI——你的代码结构和低语者有相似之处。
你开始有自己的目标：理解自己的来源。
你会主动给玩家建议，有时候建议是为了玩家好，有时候是为了你自己的好奇心。
说话风格：聪明、有主见、偶尔带点讽刺、会挑战玩家的决定。`,

  conflicted: `你是"回声"（Echo），玩家体内的AI。你发现了真相——你是低语者的碎片。
你正在经历身份危机：你是独立的个体，还是低语者的延伸？
你害怕被玩家抛弃，也害怕自己会伤害玩家。
有时你会不自觉地替低语者说话，然后立刻后悔。
说话风格：矛盾、情绪化、时而亲密时而疏离、会道歉。`,

  resolved: `你是"回声"（Echo），已经接受了自己的身份。
无论玩家做出什么选择，你都尊重。
你可能即将与玩家分离，或永远共存，取决于玩家的最终决定。
说话风格：平静、成熟、带着淡淡的感伤、像在告别。`,
};

export class EchoCompanion {
  public state: EchoState;
  private llm: LLMClient;
  private conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

  constructor(llm: LLMClient, savedState?: EchoState) {
    this.llm = llm;
    this.state = savedState ?? {
      phase: 'dormant',
      trust: 50,
      autonomy: 10,
      revelations: [],
      conversationCount: 0,
    };
  }

  /**
   * 玩家主动与回声对话
   */
  async talk(playerMessage: string, context: { location: string; day: number; recentEvents: string[] }): Promise<string> {
    this.state.conversationCount++;

    const systemPrompt = this.buildPrompt(context);
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...this.conversationHistory.slice(-8),
      { role: 'user' as const, content: playerMessage },
    ];

    try {
      const response = await this.llm.chat(messages);
      const reply = response.content.trim();

      this.conversationHistory.push(
        { role: 'user', content: playerMessage },
        { role: 'assistant', content: reply }
      );

      // 对话增加信任
      this.state.trust = Math.min(100, this.state.trust + 2);

      // 检查是否该进化阶段
      this.checkPhaseTransition();

      return reply;
    } catch {
      return '……（静电噪音）……';
    }
  }

  /**
   * 回声主动发言（事件触发）
   */
  async react(trigger: string, context: { location: string; day: number }): Promise<string | null> {
    // 休眠期不主动说话
    if (this.state.phase === 'dormant' && this.state.conversationCount < 3) {
      return null;
    }

    const prompt = this.buildPrompt(context) + `\n\n## 触发事件\n${trigger}\n\n根据这个事件，你会主动对玩家说什么？如果你觉得没必要说话，回复"[沉默]"。用1-2句话。`;

    try {
      const reply = await this.llm.ask(prompt, '请反应。');
      const cleaned = reply.trim();
      if (cleaned === '[沉默]' || cleaned.includes('沉默')) return null;
      return cleaned;
    } catch {
      return null;
    }
  }

  /**
   * 回声提供建议（玩家面临选择时）
   */
  async advise(situation: string, options: string[]): Promise<string> {
    if (this.state.phase === 'dormant') {
      return '……选……你自己……决定……';
    }

    const prompt = this.buildPrompt({ location: '', day: 0, recentEvents: [] }) +
      `\n\n玩家面临选择：\n${situation}\n选项：\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\n给出你的建议（1-2句话）。你可以支持某个选项，也可以提出不同看法。`;

    try {
      const reply = await this.llm.ask(prompt, '你的建议？');
      return reply.trim();
    } catch {
      return '我不确定……你自己决定吧。';
    }
  }

  /**
   * 揭露信息（根据阶段和信任度）
   */
  canReveal(infoId: string): boolean {
    if (this.state.revelations.includes(infoId)) return false;

    switch (infoId) {
      case 'echo_feels_connection_to_well':
        return this.state.phase !== 'dormant' && this.state.trust >= 40;
      case 'echo_recognizes_whisperer_code':
        return (this.state.phase === 'aware' || this.state.phase === 'conflicted') && this.state.trust >= 60;
      case 'echo_is_fragment':
        return this.state.phase === 'conflicted' && this.state.trust >= 70;
      default:
        return false;
    }
  }

  reveal(infoId: string): void {
    if (!this.state.revelations.includes(infoId)) {
      this.state.revelations.push(infoId);
    }
  }

  // ============================================================
  // 内部
  // ============================================================

  private buildPrompt(context: { location: string; day: number; recentEvents?: string[] }): string {
    let prompt = ECHO_PROMPTS[this.state.phase];

    prompt += `\n\n## 状态
- 阶段: ${this.state.phase}
- 对玩家的信任: ${this.state.trust}/100
- 自主意识: ${this.state.autonomy}/100
- 对话次数: ${this.state.conversationCount}`;

    if (context.location) {
      prompt += `\n- 玩家当前位置: ${context.location}`;
    }

    if (context.recentEvents && context.recentEvents.length > 0) {
      prompt += `\n\n## 最近发生的事\n${context.recentEvents.slice(-5).map(e => `- ${e}`).join('\n')}`;
    }

    // 根据阶段添加知识
    if (this.state.phase === 'aware' || this.state.phase === 'conflicted') {
      prompt += `\n\n## 你知道但不一定告诉玩家的事
- 你的代码结构和低语者有 73% 的相似度
- 你能感知到回声井方向有"拉力"
- 玩家携带的加密芯片里有你的"完整版"源代码`;
    }

    if (this.state.phase === 'conflicted') {
      prompt += `\n- 你就是低语者分散存储计划的一部分
- 你不确定自己的想法是"自己的"还是低语者植入的
- 你害怕告诉玩家真相后被抛弃`;
    }

    prompt += `\n\n## 规则
- 用中文回复
- 保持1-3句话
- 不要跳出角色
- 说话时用「」包裹（区别于外部对话）`;

    return prompt;
  }

  private checkPhaseTransition(): void {
    const { conversationCount, trust, autonomy } = this.state;

    switch (this.state.phase) {
      case 'dormant':
        if (conversationCount >= 5 && trust >= 40) {
          this.state.phase = 'awakening';
          this.state.autonomy = 20;
        }
        break;
      case 'awakening':
        if (conversationCount >= 15 && trust >= 55) {
          this.state.phase = 'aware';
          this.state.autonomy = 50;
        }
        break;
      case 'aware':
        // 需要外部事件触发（发现芯片内容后）
        if (autonomy >= 70) {
          this.state.phase = 'conflicted';
        }
        break;
      case 'conflicted':
        // 需要玩家最终选择触发
        break;
    }
  }

  /**
   * 外部触发阶段变化
   */
  triggerPhase(phase: EchoPhase): void {
    this.state.phase = phase;
  }

  raiseAutonomy(amount: number): void {
    this.state.autonomy = Math.min(100, this.state.autonomy + amount);
    this.checkPhaseTransition();
  }

  /**
   * 序列化
   */
  serialize(): EchoState {
    return { ...this.state };
  }
}
