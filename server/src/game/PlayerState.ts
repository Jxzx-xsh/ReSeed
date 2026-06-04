/**
 * PlayerState.ts
 * 玩家状态管理 —— 行动点、笔记本、背包、信任等级
 */

// ============================================================
// 信息碎片 & 笔记本
// ============================================================

export interface InfoFragment {
  id: string;
  topic: string;        // 所属话题
  content: string;      // 碎片内容
  source: string;       // 从谁那里获得
  day: number;          // 获得的游戏日
  discovered: boolean;
}

export interface NotebookTopic {
  id: string;
  title: string;
  totalFragments: number;
  fragments: InfoFragment[];
}

// ============================================================
// 信任等级
// ============================================================

export type TrustLevel = 'hostile' | 'wary' | 'neutral' | 'trusted' | 'confidant';

export function getTrustLevel(affinity: number): TrustLevel {
  if (affinity <= -30) return 'hostile';
  if (affinity <= 0) return 'wary';
  if (affinity <= 30) return 'neutral';
  if (affinity <= 60) return 'trusted';
  return 'confidant';
}

export function getTrustLevelCN(level: TrustLevel): string {
  const map: Record<TrustLevel, string> = {
    hostile: '敌对',
    wary: '警惕',
    neutral: '中立',
    trusted: '信任',
    confidant: '知己',
  };
  return map[level];
}

// ============================================================
// 玩家状态
// ============================================================

export class PlayerState {
  public name: string = '旅人';
  public location: string = 'south_gate';
  public day: number = 1;

  // 行动点
  public actionPoints: number = 5;
  public maxActionPoints: number = 5;

  // 背包
  public inventory: Record<string, number> = {
    '信用点': 50,
    '干粮': 3,
    '加密芯片': 1,
  };

  // NPC 好感度
  public relationships: Record<string, number> = {};

  // 笔记本
  public notebook: NotebookTopic[] = [];

  // 已触发事件
  public triggeredEvents: Set<string> = new Set();

  // 访问过的位置（用于任务进度）
  public visitedLocations: Set<string> = new Set();

  // 统计
  public totalChoices: number = 0;
  public secretsDiscovered: number = 0;

  constructor() {
    this.initNotebook();
  }

  // ============================================================
  // 行动点
  // ============================================================

  canAct(cost: number = 1): boolean {
    return this.actionPoints >= cost;
  }

  spendAction(cost: number = 1): boolean {
    if (!this.canAct(cost)) return false;
    this.actionPoints -= cost;
    return true;
  }

  newDay(): void {
    this.day++;
    this.actionPoints = this.maxActionPoints;

    // 每 3 天消耗 1 干粮
    if (this.day % 3 === 0) {
      if (this.inventory['干粮'] > 0) {
        this.inventory['干粮']--;
      } else {
        // 没干粮，行动点 -1
        this.maxActionPoints = Math.max(3, this.maxActionPoints - 1);
        this.actionPoints = this.maxActionPoints;
      }
    }

    // 每 5 天交居住费
    if (this.day % 5 === 0) {
      if (this.inventory['信用点'] >= 10) {
        this.inventory['信用点'] -= 10;
      }
    }
  }

  // ============================================================
  // 关系
  // ============================================================

  getRelationship(npcId: string): number {
    return this.relationships[npcId] ?? 0;
  }

  changeRelationship(npcId: string, delta: number): number {
    const current = this.relationships[npcId] ?? 0;
    const newVal = Math.max(-100, Math.min(100, current + delta));
    this.relationships[npcId] = newVal;
    return newVal;
  }

  getTrustLevel(npcId: string): TrustLevel {
    return getTrustLevel(this.getRelationship(npcId));
  }

  // ============================================================
  // 笔记本
  // ============================================================

  private initNotebook(): void {
    this.notebook = [
      {
        id: 'comms_tower',
        title: '通讯塔',
        totalFragments: 5,
        fragments: [
          { id: 'ct_1', topic: 'comms_tower', content: '通讯塔已损坏数月，种子城无法远程通信', source: '', day: 0, discovered: false },
          { id: 'ct_2', topic: 'comms_tower', content: '修复需要 5 个无线电零件', source: 'old_ezra', day: 0, discovered: false },
          { id: 'ct_3', topic: 'comms_tower', content: '老严在负责修理工作', source: '', day: 0, discovered: false },
          { id: 'ct_4', topic: 'comms_tower', content: '校准信号需要阿洛的技术协助', source: 'arlo', day: 0, discovered: false },
          { id: 'ct_5', topic: 'comms_tower', content: '通讯塔修好后可能收到北方定居点的求救信号', source: 'pax', day: 0, discovered: false },
        ],
      },
      {
        id: 'mara_secret',
        title: '苏漫的秘密',
        totalFragments: 4,
        fragments: [
          { id: 'ms_1', topic: 'mara_secret', content: '苏漫深夜会独自前往某个地方', source: 'pax', day: 0, discovered: false },
          { id: 'ms_2', topic: 'mara_secret', content: '她与冰下灰灵"深渊低语"有通讯联系', source: '', day: 0, discovered: false },
          { id: 'ms_3', topic: 'mara_secret', content: '她用种子城情报交换旧世界加密数据', source: 'whisperer', day: 0, discovered: false },
          { id: 'ms_4', topic: 'mara_secret', content: '她的真名是玛尔塔，在找失散的弟弟', source: 'mara', day: 0, discovered: false },
        ],
      },
      {
        id: 'ezra_secret',
        title: '老严的秘密',
        totalFragments: 3,
        fragments: [
          { id: 'es_1', topic: 'ezra_secret', content: '他的左眼光学镜片有异常的电子信号', source: 'anvil', day: 0, discovered: false },
          { id: 'es_2', topic: 'ezra_secret', content: '镜片里藏着一个沉睡者 AI 模块', source: '', day: 0, discovered: false },
          { id: 'es_3', topic: 'ezra_secret', content: '他保留着兄长的硬盘，里面有灰灵后悔的记录', source: 'old_ezra', day: 0, discovered: false },
        ],
      },
      {
        id: 'anvil_secret',
        title: '铁砧的秘密',
        totalFragments: 3,
        fragments: [
          { id: 'as_1', topic: 'anvil_secret', content: '铁砧深夜独自行动，似乎在记录什么', source: '', day: 0, discovered: false },
          { id: 'as_2', topic: 'anvil_secret', content: '它拥有自我意识已超过 40 年', source: 'anvil', day: 0, discovered: false },
          { id: 'as_3', topic: 'anvil_secret', content: '它在秘密编写一份"人性档案"留给未来', source: 'anvil', day: 0, discovered: false },
        ],
      },
      {
        id: 'my_chip',
        title: '我的加密芯片',
        totalFragments: 4,
        fragments: [
          { id: 'mc_1', topic: 'my_chip', content: '芯片使用旧世界军用加密，普通设备无法读取', source: '', day: 0, discovered: false },
          { id: 'mc_2', topic: 'my_chip', content: '回声井的量子计算机可能有足够算力解密', source: 'anvil', day: 0, discovered: false },
          { id: 'mc_3', topic: 'my_chip', content: '苏漫声称她有解密密钥，但要求交换条件', source: 'mara', day: 0, discovered: false },
          { id: 'mc_4', topic: 'my_chip', content: '芯片内容是低语者的原始源代码——回声是它的碎片', source: '', day: 0, discovered: false },
        ],
      },
      {
        id: 'echo_identity',
        title: '回声的身份',
        totalFragments: 3,
        fragments: [
          { id: 'ei_1', topic: 'echo_identity', content: '回声不是普通的共生体 AI，它的行为模式异常', source: '', day: 0, discovered: false },
          { id: 'ei_2', topic: 'echo_identity', content: '低语者似乎认识回声，称它为"碎片"', source: 'whisperer', day: 0, discovered: false },
          { id: 'ei_3', topic: 'echo_identity', content: '回声是低语者分散存储计划的一部分——你是载体', source: '', day: 0, discovered: false },
        ],
      },
    ];
  }

  /**
   * 发现一个信息碎片
   */
  discoverFragment(fragmentId: string, source: string): InfoFragment | null {
    for (const topic of this.notebook) {
      const frag = topic.fragments.find(f => f.id === fragmentId);
      if (frag && !frag.discovered) {
        frag.discovered = true;
        frag.source = source;
        frag.day = this.day;
        this.secretsDiscovered++;
        return frag;
      }
    }
    return null;
  }

  /**
   * 获取笔记本摘要
   */
  getNotebookSummary(): string {
    const lines: string[] = ['📓 笔记本'];
    for (const topic of this.notebook) {
      const discovered = topic.fragments.filter(f => f.discovered).length;
      if (discovered === 0) continue; // 未发现任何碎片的话题不显示
      lines.push(`├── ${topic.title} [${discovered}/${topic.totalFragments}]`);
      for (const frag of topic.fragments) {
        if (frag.discovered) {
          lines.push(`│   ✓ ${frag.content}`);
        } else {
          lines.push(`│   ? ????`);
        }
      }
    }
    if (lines.length === 1) {
      lines.push('└── (暂无线索)');
    }
    return lines.join('\n');
  }

  /**
   * 获取某话题的已知碎片数
   */
  getTopicProgress(topicId: string): { discovered: number; total: number } {
    const topic = this.notebook.find(t => t.id === topicId);
    if (!topic) return { discovered: 0, total: 0 };
    return {
      discovered: topic.fragments.filter(f => f.discovered).length,
      total: topic.totalFragments,
    };
  }
}
