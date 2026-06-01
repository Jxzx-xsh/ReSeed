/**
 * QuestSystem.ts
 * 任务系统 —— 管理 NPC 委托任务的生命周期
 */

import { PlayerState } from './PlayerState';
import { SmartNPC } from '../agents/SmartNPC';

// ============================================================
// 类型定义
// ============================================================

export type QuestStatus = 'hidden' | 'available' | 'accepted' | 'in_progress' | 'ready' | 'completed' | 'failed' | 'declined';

export type QuestObjectiveType = 'collect' | 'deliver' | 'visit' | 'talk' | 'relationship' | 'survive';

export interface QuestObjective {
  type: QuestObjectiveType;
  description: string;
  target: string;           // 物品名/地点ID/NPC ID
  required: number;         // 需要的数量/次数
  current: number;          // 当前进度
}

export interface QuestReward {
  items?: Record<string, number>;
  relationships?: Record<string, number>;
  fragments?: string[];
  message: string;          // NPC 交付时说的话
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  giver: string;            // 委托人 NPC ID
  giverName: string;        // 委托人显示名
  status: QuestStatus;
  objectives: QuestObjective[];
  reward: QuestReward;
  dayLimit?: number;        // 期限（天数），undefined = 无限
  acceptedDay?: number;     // 接受时的游戏日
  completedDay?: number;    // 完成时的游戏日
  triggerCondition?: (player: PlayerState, npcs: SmartNPC[]) => boolean;
}

// ============================================================
// 任务定义
// ============================================================

export const ALL_QUESTS: Omit<Quest, 'status'>[] = [
  // --- 第一章任务 ---
  {
    id: 'ezra_radio_parts',
    name: '修理通讯塔',
    description: '老埃兹拉需要5个无线电零件来修复通讯塔。去废墟区搜索，或者从玛拉那里购买。',
    giver: 'old_ezra',
    giverName: '老埃兹拉',
    objectives: [
      { type: 'collect', description: '收集无线电零件', target: '无线电零件', required: 5, current: 0 },
    ],
    reward: {
      items: { '信用点': 50 },
      relationships: { old_ezra: 20 },
      fragments: ['ct_4'],
      message: '老埃兹拉接过零件，仔细检查了每一个："切……质量还行。别以为这样我就欠你的。"',
    },
    dayLimit: 15,
    triggerCondition: (p) => p.triggeredEvents.has('ezra_reveals_plan'),
  },

  {
    id: 'samira_pipe_repair',
    name: '保护水管',
    description: '萨米拉需要防锈布来包裹暴露的水管，防止酸雨季腐蚀。',
    giver: 'samira',
    giverName: '萨米拉',
    objectives: [
      { type: 'collect', description: '找到防锈布', target: '防锈布', required: 3, current: 0 },
    ],
    reward: {
      items: { '净水': 5, '信用点': 30 },
      relationships: { samira: 15 },
      message: '萨米拉点了点头："效率不错。水管保住了，全城的水就保住了。"',
    },
    dayLimit: 10,
    triggerCondition: (p) => p.triggeredEvents.has('acid_rain_warning'),
  },

  {
    id: 'arlo_greenhouse_check',
    name: '温室巡检',
    description: '阿洛需要你帮忙检查穹顶绿洲的三个区域，记录作物状态。',
    giver: 'arlo',
    giverName: '阿洛',
    objectives: [
      { type: 'visit', description: '检查穹顶绿洲', target: 'greenhouse', required: 1, current: 0 },
      { type: 'talk', description: '向阿洛汇报', target: 'arlo', required: 1, current: 0 },
    ],
    reward: {
      items: { '干粮': 3 },
      relationships: { arlo: 10 },
      message: '阿洛露出难得的笑容："数据很有用。这些螺旋藻饼给你——自己种的，蛋白质含量不错。"',
    },
    triggerCondition: (p) => p.getRelationship('arlo') >= 10,
  },

  {
    id: 'pax_delivery',
    name: '信使的委托',
    description: '帕克斯出发前想让你帮忙把一封信送到黑冰市场的玛拉手中。',
    giver: 'pax',
    giverName: '帕克斯',
    objectives: [
      { type: 'visit', description: '前往黑冰市场', target: 'market', required: 1, current: 0 },
      { type: 'talk', description: '把信交给玛拉', target: 'mara', required: 1, current: 0 },
    ],
    reward: {
      items: { '信用点': 20 },
      relationships: { pax: 10, mara: 5 },
      message: '玛拉接过信，扫了一眼后嘴角微翘："帕克斯那小子……行，我知道了。替我谢谢他。"',
    },
    triggerCondition: (p) => p.triggeredEvents.has('pax_departure'),
  },

  {
    id: 'anvil_patrol',
    name: '协助巡逻',
    description: '铁砧邀请你一起巡视种子城外围，检查防御设施。',
    giver: 'anvil',
    giverName: '铁砧',
    objectives: [
      { type: 'visit', description: '巡视南门', target: 'south_gate', required: 1, current: 0 },
      { type: 'visit', description: '巡视废墟区', target: 'ruins', required: 1, current: 0 },
    ],
    reward: {
      items: { '信用点': 25, '无线电零件': 1 },
      relationships: { anvil: 10 },
      message: '铁砧的屏幕闪了闪："巡逻效率 +15%。你的观察力超出预期，有机体。这个零件是废墟里捡到的，给你。"',
    },
    triggerCondition: (p) => p.getRelationship('anvil') >= 15,
  },

  // --- 第二章任务 ---
  {
    id: 'mara_echo_well',
    name: '回声井探索',
    description: '玛拉需要你进入回声井获取一份数据。危险，但她承诺给你芯片密钥。',
    giver: 'mara',
    giverName: '玛拉',
    objectives: [
      { type: 'visit', description: '进入回声井', target: 'echo_well', required: 1, current: 0 },
      { type: 'collect', description: '获取数据晶体', target: '数据晶体', required: 1, current: 0 },
    ],
    reward: {
      items: { '芯片密钥': 1 },
      relationships: { mara: 15 },
      fragments: ['mc_3'],
      message: '玛拉接过数据晶体，眼中闪过一丝贪婪的光："成交。密钥给你——别问我这数据是干什么用的。"',
    },
    triggerCondition: (p) => p.triggeredEvents.has('mara_deal'),
  },
];

// ============================================================
// 任务管理器
// ============================================================

export class QuestSystem {
  private quests: Quest[];

  constructor(savedQuests?: Quest[]) {
    if (savedQuests) {
      this.quests = savedQuests;
    } else {
      this.quests = ALL_QUESTS.map(q => ({ ...q, status: 'hidden' as QuestStatus }));
    }
  }

  /**
   * 每次行动后检查任务状态变化
   */
  update(player: PlayerState, npcs: SmartNPC[]): QuestUpdate[] {
    const updates: QuestUpdate[] = [];

    for (const quest of this.quests) {
      // 检查隐藏任务是否可以变为可用
      if (quest.status === 'hidden') {
        if (quest.triggerCondition && quest.triggerCondition(player, npcs)) {
          quest.status = 'available';
          updates.push({ questId: quest.id, type: 'available', quest });
        }
      }

      // 检查进行中的任务进度
      if (quest.status === 'accepted' || quest.status === 'in_progress') {
        let changed = false;

        for (const obj of quest.objectives) {
          const oldCurrent = obj.current;

          switch (obj.type) {
            case 'collect':
              obj.current = Math.min(obj.required, player.inventory[obj.target] ?? 0);
              break;
            case 'visit':
              if (player.location === obj.target) {
                obj.current = Math.min(obj.required, obj.current + 1);
              }
              break;
            case 'relationship':
              obj.current = Math.min(obj.required, player.getRelationship(obj.target));
              break;
          }

          if (obj.current !== oldCurrent) changed = true;
        }

        // 检查是否所有目标完成
        const allDone = quest.objectives.every(o => o.current >= o.required);
        if (allDone) {
          quest.status = 'ready';
          updates.push({ questId: quest.id, type: 'ready', quest });
        } else if (changed) {
          quest.status = 'in_progress';
          updates.push({ questId: quest.id, type: 'progress', quest });
        }

        // 检查是否超时
        if (quest.dayLimit && quest.acceptedDay) {
          if (player.day - quest.acceptedDay > quest.dayLimit) {
            quest.status = 'failed';
            updates.push({ questId: quest.id, type: 'failed', quest });
          }
        }
      }
    }

    return updates;
  }

  /**
   * 对话触发任务目标（talk 类型）
   */
  onTalk(npcId: string, player: PlayerState): QuestUpdate[] {
    const updates: QuestUpdate[] = [];

    for (const quest of this.quests) {
      if (quest.status !== 'accepted' && quest.status !== 'in_progress') continue;

      for (const obj of quest.objectives) {
        if (obj.type === 'talk' && obj.target === npcId && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + 1);

          const allDone = quest.objectives.every(o => o.current >= o.required);
          if (allDone) {
            quest.status = 'ready';
            updates.push({ questId: quest.id, type: 'ready', quest });
          } else {
            quest.status = 'in_progress';
            updates.push({ questId: quest.id, type: 'progress', quest });
          }
        }
      }
    }

    return updates;
  }

  /**
   * 接受任务
   */
  accept(questId: string, player: PlayerState): Quest | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'available') return null;

    quest.status = 'accepted';
    quest.acceptedDay = player.day;
    return quest;
  }

  /**
   * 拒绝任务
   */
  decline(questId: string): Quest | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'available') return null;

    quest.status = 'declined';
    return quest;
  }

  /**
   * 提交任务（领取奖励）
   */
  submit(questId: string, player: PlayerState): QuestSubmitResult | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'ready') return null;

    // 检查玩家是否在委托人所在地（或委托人在玩家所在地）
    quest.status = 'completed';
    quest.completedDay = player.day;

    // 应用奖励
    if (quest.reward.items) {
      for (const [item, qty] of Object.entries(quest.reward.items)) {
        player.inventory[item] = (player.inventory[item] ?? 0) + qty;
      }
    }
    if (quest.reward.relationships) {
      for (const [npcId, delta] of Object.entries(quest.reward.relationships)) {
        player.changeRelationship(npcId, delta);
      }
    }
    if (quest.reward.fragments) {
      for (const fragId of quest.reward.fragments) {
        player.discoverFragment(fragId, quest.giverName);
      }
    }

    // 扣除收集类物品
    for (const obj of quest.objectives) {
      if (obj.type === 'collect') {
        player.inventory[obj.target] = Math.max(0, (player.inventory[obj.target] ?? 0) - obj.required);
      }
    }

    return {
      quest,
      reward: quest.reward,
    };
  }

  /**
   * 获取可在 NPC 处接受的任务
   */
  getAvailableForNPC(npcId: string): Quest[] {
    return this.quests.filter(q => q.giver === npcId && q.status === 'available');
  }

  /**
   * 获取可在 NPC 处提交的任务
   */
  getReadyForNPC(npcId: string): Quest[] {
    return this.quests.filter(q => q.giver === npcId && q.status === 'ready');
  }

  /**
   * 获取玩家当前活跃任务
   */
  getActiveQuests(): Quest[] {
    return this.quests.filter(q => ['accepted', 'in_progress', 'ready'].includes(q.status));
  }

  /**
   * 获取已完成任务
   */
  getCompletedQuests(): Quest[] {
    return this.quests.filter(q => q.status === 'completed');
  }

  /**
   * 获取有任务标记的 NPC ID 列表
   */
  getNPCQuestMarkers(): Record<string, 'available' | 'ready'> {
    const markers: Record<string, 'available' | 'ready'> = {};
    for (const quest of this.quests) {
      if (quest.status === 'available') {
        markers[quest.giver] = 'available';
      }
      if (quest.status === 'ready') {
        // ready 优先级高于 available
        markers[quest.giver] = 'ready';
      }
    }
    return markers;
  }

  /**
   * 序列化
   */
  serialize(): Quest[] {
    return this.quests.map(q => ({
      ...q,
      triggerCondition: undefined, // 函数不能序列化
    })) as Quest[];
  }

  /**
   * 从存档恢复（重新绑定 triggerCondition）
   */
  static fromSave(saved: Quest[]): QuestSystem {
    const system = new QuestSystem();
    for (const savedQuest of saved) {
      const quest = system.quests.find(q => q.id === savedQuest.id);
      if (quest) {
        quest.status = savedQuest.status;
        quest.acceptedDay = savedQuest.acceptedDay;
        quest.completedDay = savedQuest.completedDay;
        quest.objectives = savedQuest.objectives;
      }
    }
    return system;
  }
}

// ============================================================
// 辅助类型
// ============================================================

export interface QuestUpdate {
  questId: string;
  type: 'available' | 'progress' | 'ready' | 'failed';
  quest: Quest;
}

export interface QuestSubmitResult {
  quest: Quest;
  reward: QuestReward;
}
