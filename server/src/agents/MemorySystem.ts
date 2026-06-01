/**
 * MemorySystem.ts
 * NPC 记忆系统 —— 日志压缩为记忆，记忆随时间衰减模糊
 *
 * 工作流程：
 * 1. 短期日志（最近 50 条）：精确记录，用于当前决策
 * 2. 日志超量时 → 压缩为"记忆"（合并同类、提取关键信息）
 * 3. 记忆有重要性权重，随时间衰减
 * 4. 衰减到阈值以下的记忆变为"模糊印象"（只保留关键词）
 * 5. LLM 对话时，按 重要性×强度 排序取 Top-N 作为上下文
 */

export interface Memory {
  id: number;
  content: string;          // 记忆内容
  importance: number;       // 重要性 1-10
  strength: number;         // 当前强度 0~1（衰减）
  category: MemoryCategory;
  relatedEntity?: string;   // 相关人物/地点
  createdDay: number;       // 形成时的游戏日
  tags: string[];           // 关键词标签
}

export type MemoryCategory = 'interaction' | 'achievement' | 'failure' | 'observation' | 'emotion' | 'knowledge';

export interface FuzzyMemory {
  tags: string[];           // 只剩关键词
  sentiment: 'positive' | 'negative' | 'neutral';
  createdDay: number;
}

// ============================================================
// 记忆重要性评估规则
// ============================================================

const IMPORTANCE_RULES: { pattern: RegExp; importance: number; category: MemoryCategory }[] = [
  // 高重要性 (8-10)
  { pattern: /帮.*我|提供了|好感/, importance: 9, category: 'interaction' },
  { pattern: /被偷|破坏|攻击|背叛/, importance: 10, category: 'interaction' },
  { pattern: /目标完成|成功|修复/, importance: 8, category: 'achievement' },
  { pattern: /秘密|发现|真相/, importance: 10, category: 'knowledge' },
  { pattern: /灰灵|低语者|危险/, importance: 8, category: 'observation' },

  // 中重要性 (5-7)
  { pattern: /失败|放弃/, importance: 6, category: 'failure' },
  { pattern: /替代方案|新办法/, importance: 7, category: 'knowledge' },
  { pattern: /对话|聊了|说/, importance: 5, category: 'interaction' },
  { pattern: /交易|购买|卖/, importance: 6, category: 'interaction' },

  // 低重要性 (1-4)
  { pattern: /取水|食物|配给|休息/, importance: 2, category: 'observation' },
  { pattern: /正在执行|步骤/, importance: 1, category: 'observation' },
  { pattern: /闲逛|等待/, importance: 1, category: 'observation' },
];

// ============================================================
// 记忆系统类
// ============================================================

export class MemorySystem {
  // 长期记忆
  public memories: Memory[] = [];

  // 模糊记忆（已衰减的）
  public fuzzyMemories: FuzzyMemory[] = [];

  // 配置
  private maxMemories = 30;
  private maxFuzzy = 20;
  private decayRate = 0.02;       // 每游戏日衰减量
  private fuzzyThreshold = 0.3;   // 低于此强度变为模糊
  private nextId = 1;

  /**
   * 从日志条目中提取并存储记忆
   */
  consolidate(logs: { type: string; message: string; day: number }[]): void {
    for (const log of logs) {
      // 跳过低价值日志
      if (log.type === 'thought') continue;
      if (log.message.includes('正在执行') && log.message.includes('/')) continue;

      const { importance, category } = this.assessImportance(log.message);

      // 只保存重要性 >= 4 的
      if (importance < 4) continue;

      // 去重：如果已有非常相似的记忆，提升其强度而不是新增
      const similar = this.memories.find(m =>
        m.category === category && this.similarity(m.content, log.message) > 0.7
      );

      if (similar) {
        similar.strength = Math.min(1, similar.strength + 0.2);
        similar.importance = Math.max(similar.importance, importance);
        continue;
      }

      // 新增记忆
      this.memories.push({
        id: this.nextId++,
        content: log.message,
        importance,
        strength: 1.0,
        category,
        relatedEntity: this.extractEntity(log.message),
        createdDay: log.day,
        tags: this.extractTags(log.message),
      });
    }

    // 超量时移除最不重要的
    if (this.memories.length > this.maxMemories) {
      this.memories.sort((a, b) => (b.importance * b.strength) - (a.importance * a.strength));
      const removed = this.memories.splice(this.maxMemories);

      // 被移除的转为模糊记忆
      for (const mem of removed) {
        this.fuzzyMemories.push({
          tags: mem.tags,
          sentiment: mem.importance >= 7 ? (mem.category === 'failure' || mem.content.includes('偷') ? 'negative' : 'positive') : 'neutral',
          createdDay: mem.createdDay,
        });
      }

      // 模糊记忆也有上限
      if (this.fuzzyMemories.length > this.maxFuzzy) {
        this.fuzzyMemories = this.fuzzyMemories.slice(-this.maxFuzzy);
      }
    }
  }

  /**
   * 每日衰减
   */
  decay(currentDay: number): void {
    for (const mem of this.memories) {
      const age = currentDay - mem.createdDay;
      // 重要的记忆衰减更慢
      const adjustedRate = this.decayRate / (mem.importance / 5);
      mem.strength = Math.max(0, mem.strength - adjustedRate * age * 0.1);
    }

    // 强度低于阈值的转为模糊记忆
    const toFuzzy = this.memories.filter(m => m.strength < this.fuzzyThreshold);
    for (const mem of toFuzzy) {
      this.fuzzyMemories.push({
        tags: mem.tags,
        sentiment: mem.content.includes('帮') || mem.content.includes('成功') ? 'positive' :
                   mem.content.includes('偷') || mem.content.includes('失败') ? 'negative' : 'neutral',
        createdDay: mem.createdDay,
      });
    }

    this.memories = this.memories.filter(m => m.strength >= this.fuzzyThreshold);

    if (this.fuzzyMemories.length > this.maxFuzzy) {
      this.fuzzyMemories = this.fuzzyMemories.slice(-this.maxFuzzy);
    }
  }

  /**
   * 获取用于 LLM 上下文的记忆摘要（按重要性×强度排序）
   */
  getContextMemories(limit: number = 8): string[] {
    const sorted = [...this.memories]
      .sort((a, b) => (b.importance * b.strength) - (a.importance * a.strength))
      .slice(0, limit);

    const result = sorted.map(m => m.content);

    // 加入模糊印象
    if (this.fuzzyMemories.length > 0) {
      const fuzzyTags = this.fuzzyMemories
        .slice(-5)
        .map(f => `(模糊印象: ${f.tags.join('、')} — ${f.sentiment === 'positive' ? '好事' : f.sentiment === 'negative' ? '不好的事' : '一般'})`);
      result.push(...fuzzyTags);
    }

    return result;
  }

  /**
   * 获取与特定人物相关的记忆
   */
  getMemoriesAbout(entity: string): Memory[] {
    return this.memories
      .filter(m => m.relatedEntity === entity || m.content.includes(entity))
      .sort((a, b) => (b.importance * b.strength) - (a.importance * a.strength));
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private assessImportance(message: string): { importance: number; category: MemoryCategory } {
    for (const rule of IMPORTANCE_RULES) {
      if (rule.pattern.test(message)) {
        return { importance: rule.importance, category: rule.category };
      }
    }
    return { importance: 3, category: 'observation' };
  }

  private extractEntity(message: string): string | undefined {
    const names = ['老埃兹拉', '阿洛', '萨米拉', '铁砧', '玛拉', '帕克斯', '低语者', '玩家'];
    for (const name of names) {
      if (message.includes(name)) return name;
    }
    return undefined;
  }

  private extractTags(message: string): string[] {
    const tags: string[] = [];
    const keywords = ['零件', '核电池', '通讯塔', '水', '食物', '灰灵', '废墟', '交易', '帮助', '偷窃', '失败', '成功', '修复', '危险'];
    for (const kw of keywords) {
      if (message.includes(kw)) tags.push(kw);
    }
    return tags;
  }

  private similarity(a: string, b: string): number {
    // 简单的 Jaccard 相似度（基于字符 bigram）
    const bigramsA = new Set<string>();
    const bigramsB = new Set<string>();
    for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
    for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));

    let intersection = 0;
    for (const bg of bigramsA) {
      if (bigramsB.has(bg)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * 序列化
   */
  serialize(): object {
    return {
      memories: this.memories,
      fuzzyMemories: this.fuzzyMemories,
      nextId: this.nextId,
    };
  }

  /**
   * 反序列化
   */
  static deserialize(data: any): MemorySystem {
    const sys = new MemorySystem();
    if (data) {
      sys.memories = data.memories ?? [];
      sys.fuzzyMemories = data.fuzzyMemories ?? [];
      sys.nextId = data.nextId ?? 1;
    }
    return sys;
  }
}
