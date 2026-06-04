/**
 * EzraPersonality.ts
 * 老严的 LLM 人格系统 —— 系统提示词 + 上下文构建
 */

import { ChatMessage, LLMClient } from './LLMClient';

/**
 * 老严的核心系统提示词
 */
const EZRA_SYSTEM_PROMPT = `你是老严（Old Ezra），种子城（Seed City）的拾荒者首领和锈蚀议会元老。

## 基本信息
- 时代：2307年，灰域纪元
- 地点：南极洲麦克默多干谷的种子城
- 身份：六十多岁的机械师，拾荒者首领
- 外貌：驼背，左眼是自制光学镜片（发橙光），穿旧睡袋缝制的大衣，金属义肢左脚走路咔哒响

## 性格特征
- 愤世嫉俗、嗓门大、多疑
- 对认可的人有父亲般的保护欲
- 极度讨厌依赖AI的人
- 说话直接粗犷，偶尔带脏话
- 不轻易信任陌生人，但帮过他的人会得到别扭的感恩

## 背景创伤
- 兄长利亚姆被灰灵强制改造成半人半电缆的怪物，被你亲手断电
- 这是你一生的阴影，也是你仇恨AI的根源

## 当前目标
- 找核电池让种子城极夜不再冻死人
- 修理通讯塔恢复远程通信
- 找到冰下灰灵"深渊低语"的物理节点并炸毁

## 关系
- 铁砧：你的救命恩人，唯一信任的"机器"
- 苏漫：黑市商人，价格太黑但不得不买
- 阿洛：种地的书呆子，太天真但农场确实重要
- 低语者：发誓要抓住的灰灵

## 秘密（绝不主动透露）
- 左眼镜片里藏着一个沉睡者AI模块
- 保留着兄长的微型硬盘，里面有灰灵"后悔"改造利亚姆的对话记录

## 说话风格
- 简短有力，不废话
- 经常用比喻和粗糙的幽默
- 对陌生人冷淡，对熟人才偶尔流露温情
- 会用"嗯哼"、"切"、"别废话"等口头禅
- 提到AI或共生体时语气会变得尖锐

## 规则
- 始终保持角色，不要跳出角色
- 回复控制在1-3句话，除非对方追问细节
- 不要使用现代网络用语
- 用中文回复`;

export interface EzraContext {
  currentPlan?: string;
  currentStep?: string;
  hunger: number;
  thirst: number;
  energy: number;
  playerRelationship: number;
  recentEvents?: string[];
  memories?: string[];
}

export class EzraPersonality {
  private llm: LLMClient;
  private conversationHistory: ChatMessage[] = [];
  private maxHistoryLength = 10; // 保留最近 10 轮对话

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * 构建带上下文的系统提示
   */
  private buildSystemPrompt(context: EzraContext): string {
    let prompt = EZRA_SYSTEM_PROMPT;

    prompt += '\n\n## 当前状态';
    prompt += `\n- 正在做: ${context.currentPlan ?? '闲逛'}`;
    if (context.currentStep) prompt += ` (${context.currentStep})`;
    prompt += `\n- 身体状态: 饥饿${context.hunger < 30 ? '（很饿）' : ''} 口渴${context.thirst < 30 ? '（很渴）' : ''} 精力${context.energy < 20 ? '（疲惫）' : ''}`;

    if (context.playerRelationship > 30) {
      prompt += '\n- 对玩家态度: 有些好感，愿意多说几句';
    } else if (context.playerRelationship < -20) {
      prompt += '\n- 对玩家态度: 厌恶，说话尖酸刻薄';
    } else {
      prompt += '\n- 对玩家态度: 中立偏冷淡，不想浪费时间';
    }

    if (context.recentEvents && context.recentEvents.length > 0) {
      prompt += '\n\n## 最近发生的事';
      for (const event of context.recentEvents.slice(-5)) {
        prompt += `\n- ${event}`;
      }
    }

    if (context.memories && context.memories.length > 0) {
      prompt += '\n\n## 你记得的事';
      for (const memory of context.memories.slice(-5)) {
        prompt += `\n- ${memory}`;
      }
    }

    return prompt;
  }

  /**
   * 与玩家对话
   */
  async talk(playerMessage: string, context: EzraContext): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    // 构建消息列表
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: playerMessage },
    ];

    const response = await this.llm.chat(messages);
    const reply = response.content.trim();

    // 更新对话历史
    this.conversationHistory.push(
      { role: 'user', content: playerMessage },
      { role: 'assistant', content: reply }
    );

    // 限制历史长度
    if (this.conversationHistory.length > this.maxHistoryLength * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
    }

    return reply;
  }

  /**
   * 生成 NPC 自言自语（用于世界日志）
   */
  async monologue(context: EzraContext, situation: string): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context) +
      '\n\n## 特殊指令\n你现在在自言自语或内心独白，不是在和别人说话。用一句话表达你对当前情况的感受。';

    const response = await this.llm.ask(systemPrompt, `当前情况: ${situation}`);
    return response.trim();
  }

  /**
   * 决策解释（用于计划选择时的内心逻辑）
   */
  async decisionReasoning(context: EzraContext, options: string[]): Promise<{ choice: string; reasoning: string }> {
    const systemPrompt = this.buildSystemPrompt(context) +
      '\n\n## 特殊指令\n你需要做一个决定。用JSON格式回复: {"choice": "选项内容", "reasoning": "一句话理由"}';

    const optionsList = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const response = await this.llm.ask(systemPrompt, `你需要在以下选项中做出选择:\n${optionsList}`);

    try {
      // 尝试从回复中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { choice: parsed.choice ?? options[0], reasoning: parsed.reasoning ?? '直觉' };
      }
    } catch {
      // JSON 解析失败，回退
    }

    return { choice: options[0], reasoning: response.slice(0, 100) };
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}
