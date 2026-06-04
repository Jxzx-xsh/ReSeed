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

export interface QuestLogEntry {
  questId: string;
  questName: string;
  type: 'accepted' | 'completed' | 'failed' | 'declined';
  day: number;
  timestamp: number;
}

export const ALL_QUESTS: Omit<Quest, 'status'>[] = [
  // --- 第一章任务 ---
  {
    id: 'ezra_radio_parts',
    name: '修理通讯塔',
    description: '老严需要5个无线电零件来修复通讯塔。去废墟区搜索，或者从苏漫那里购买。',
    giver: 'old_ezra',
    giverName: '老严',
    objectives: [
      { type: 'collect', description: '收集无线电零件', target: '无线电零件', required: 5, current: 0 },
    ],
    reward: {
      items: { '信用点': 50 },
      relationships: { old_ezra: 20 },
      fragments: ['ct_4'],
      message: '老严接过零件，仔细检查了每一个："切……质量还行。别以为这样我就欠你的。"',
    },
    dayLimit: 15,
    triggerCondition: (p) => p.triggeredEvents.has('ezra_reveals_plan'),
  },

  {
    id: 'samira_pipe_repair',
    name: '保护水管',
    description: '沈沫需要防锈布来包裹暴露的水管，防止酸雨季腐蚀。',
    giver: 'samira',
    giverName: '沈沫',
    objectives: [
      { type: 'collect', description: '找到防锈布', target: '防锈布', required: 3, current: 0 },
    ],
    reward: {
      items: { '净水': 5, '信用点': 30 },
      relationships: { samira: 15 },
      message: '沈沫点了点头："效率不错。水管保住了，全城的水就保住了。"',
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
    description: '小白出发前想让你帮忙把一封信送到黑冰市场的苏漫手中。',
    giver: 'pax',
    giverName: '小白',
    objectives: [
      { type: 'visit', description: '前往黑冰市场', target: 'market', required: 1, current: 0 },
      { type: 'talk', description: '把信交给苏漫', target: 'mara', required: 1, current: 0 },
    ],
    reward: {
      items: { '信用点': 20 },
      relationships: { pax: 10, mara: 5 },
      message: '苏漫接过信，扫了一眼后嘴角微翘："小白那小子……行，我知道了。替我谢谢他。"',
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
    description: '苏漫需要你进入回声井获取一份数据。危险，但她承诺给你芯片密钥。',
    giver: 'mara',
    giverName: '苏漫',
    objectives: [
      { type: 'visit', description: '进入回声井', target: 'echo_well', required: 1, current: 0 },
      { type: 'collect', description: '获取数据晶体', target: '数据晶体', required: 1, current: 0 },
    ],
    reward: {
      items: { '芯片密钥': 1 },
      relationships: { mara: 15 },
      fragments: ['mc_3'],
      message: '苏漫接过数据晶体，眼中闪过一丝贪婪的光："成交。密钥给你——别问我这数据是干什么用的。"',
    },
    triggerCondition: (p) => p.triggeredEvents.has('mara_deal'),
  },

  {
    id: 'ezra_battery_hunt',
    name: '核电池搜寻',
    description: '老严需要你去废墟深处寻找一枚核电池，这是种子城度过极夜的关键。',
    giver: 'old_ezra',
    giverName: '老严',
    objectives: [
      { type: 'visit', description: '深入废墟区', target: 'ruins', required: 1, current: 0 },
      { type: 'collect', description: '找到核电池', target: '核电池', required: 1, current: 0 },
    ],
    reward: {
      items: { '信用点': 100, '干粮': 5 },
      relationships: { old_ezra: 25 },
      fragments: ['ct_7'],
      message: '老严紧紧握着核电池，罕见地露出一丝柔和："这东西……能让大家熬过这个冬天。谢了。"',
    },
    dayLimit: 20,
    triggerCondition: (p) => p.getRelationship('old_ezra') >= 30 && p.day >= 15,
  },

  {
    id: 'arlo_moss_sample',
    name: '苔藓样本',
    description: '阿洛需要你去苔原采集一些硅基苔藓样本，用于培育超级苔藓项目。',
    giver: 'arlo',
    giverName: '阿洛',
    objectives: [
      { type: 'visit', description: '前往废墟区', target: 'ruins', required: 1, current: 0 },
      { type: 'collect', description: '采集苔藓样本', target: '苔藓样本', required: 3, current: 0 },
    ],
    reward: {
      items: { '净水': 3, '信用点': 20 },
      relationships: { arlo: 15 },
      message: '阿洛兴奋地接过样本："太棒了！这些样本的基因序列……我有预感能培育出耐寒品种！"',
    },
    triggerCondition: (p) => p.getRelationship('arlo') >= 20,
  },

  {
    id: 'samira_water_test',
    name: '水质检测',
    description: '沈沫怀疑水源被污染，需要你收集各区域的水样进行检测。',
    giver: 'samira',
    giverName: '沈沫',
    objectives: [
      { type: 'visit', description: '收集净水站水样', target: 'water_station', required: 1, current: 0 },
      { type: 'visit', description: '收集穹顶绿洲水样', target: 'greenhouse', required: 1, current: 0 },
      { type: 'talk', description: '向沈沫汇报结果', target: 'samira', required: 1, current: 0 },
    ],
    reward: {
      items: { '净水': 10, '信用点': 35 },
      relationships: { samira: 15 },
      message: '沈沫看着检测报告："结果正常……暂时。保持警惕，水源是我们的生命线。"',
    },
    triggerCondition: (p) => p.getRelationship('samira') >= 15,
  },

  {
    id: 'anvil_component_search',
    name: '零件搜寻',
    description: '铁砧需要特定的维修零件来维护种子城的基础设施。',
    giver: 'anvil',
    giverName: '铁砧',
    objectives: [
      { type: 'collect', description: '收集金属齿轮', target: '金属齿轮', required: 2, current: 0 },
      { type: 'collect', description: '收集液压管', target: '液压管', required: 3, current: 0 },
    ],
    reward: {
      items: { '信用点': 40, '无线电零件': 2 },
      relationships: { anvil: 20 },
      message: '铁砧接收零件："组件匹配度 98.7%。你的搜寻效率值得肯定，有机体。这是额外奖励。"',
    },
    triggerCondition: (p) => p.getRelationship('anvil') >= 25,
  },

  {
    id: 'whisperer_riddle',
    name: '低语者的谜题',
    description: '低语者提出了一个谜题，解开它可能会揭示关于灰灵的重要信息。',
    giver: 'whisperer',
    giverName: '低语者',
    objectives: [
      { type: 'visit', description: '前往回声井', target: 'echo_well', required: 1, current: 0 },
      { type: 'talk', description: '聆听低语者的谜题', target: 'whisperer', required: 1, current: 0 },
    ],
    reward: {
      items: { '芯片密钥': 1 },
      fragments: ['wsp_1'],
      message: '低语声在你耳边回响："答案……在数据的缝隙中……在遗忘的边缘……"',
    },
    triggerCondition: (p) => p.triggeredEvents.has('whisperer_contact') || (p.location === 'echo_well' && p.day >= 10),
  },
];

// ============================================================
// 任务管理器
// ============================================================

export class QuestSystem {
  private quests: Quest[];
  private questLog: QuestLogEntry[] = [];

  constructor(savedQuests?: Quest[]) {
    if (savedQuests) {
      this.quests = savedQuests;
    } else {
      this.quests = ALL_QUESTS.map(q => ({ ...q, status: 'hidden' as QuestStatus }));
    }
  }

  /**
   * 添加任务日志
   */
  private addLog(questId: string, questName: string, type: QuestLogEntry['type'], day: number): void {
    this.questLog.push({
      questId,
      questName,
      type,
      day,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取任务日志
   */
  getQuestLog(): QuestLogEntry[] {
    return [...this.questLog];
  }

  /**
   * 每次行动后检查任务状态变化
   */
  update(player: PlayerState, npcs: SmartNPC[]): QuestUpdate[] {
    const updates: QuestUpdate[] = [];

    // 每天检查被拒绝的任务是否可以重新接受
    this.resetDeclinedQuests(player);

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
              // 只有当目标尚未完成且玩家当前位置匹配时才计数
              // 使用 visitedLocations 来防止重复计数
              if (obj.current < obj.required && player.location === obj.target) {
                // 检查这次访问是否已经计数过（防止同一位置重复计数）
                const visitedKey = `visited_${quest.id}_${obj.target}`;
                if (!player.visitedLocations.has(visitedKey)) {
                  obj.current = Math.min(obj.required, obj.current + 1);
                  player.visitedLocations.add(visitedKey);
                }
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
            this.addLog(quest.id, quest.name, 'failed', player.day);
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
    this.addLog(quest.id, quest.name, 'accepted', player.day);
    return quest;
  }

  /**
   * 拒绝任务
   */
  decline(questId: string, player: PlayerState): Quest | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'available') return null;

    quest.status = 'declined';
    (quest as any).declinedDay = player.day; // 记录拒绝时的游戏天数
    this.addLog(quest.id, quest.name, 'declined', player.day);
    return quest;
  }

  /**
   * 重置被拒绝的任务（可重新接受）
   */
  resetDeclinedQuests(player: PlayerState): void {
    for (const quest of this.quests) {
      if (quest.status === 'declined') {
        // 拒绝后3天可以重新接受
        const declinedDay = (quest as any).declinedDay || 0;
        if (player.day - declinedDay >= 3) {
          quest.status = 'available';
          delete (quest as any).declinedDay;
        }
      }
    }
  }

  /**
   * 提交任务（领取奖励）
   * @param questId 任务ID
   * @param player 玩家状态
   * @param npcs NPC列表（用于检查位置）
   */
  submit(questId: string, player: PlayerState, npcs: SmartNPC[] = []): QuestSubmitResult | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'ready') return null;

    // 检查玩家是否与委托人在同一位置
    const giverNpc = npcs.find(n => n.id === quest.giver);
    if (giverNpc && giverNpc.location !== player.location) {
      // 如果不在同一位置，返回特殊错误
      return {
        quest,
        reward: quest.reward,
        error: 'not_at_location' as const,
      };
    }

    quest.status = 'completed';
    quest.completedDay = player.day;
    this.addLog(quest.id, quest.name, 'completed', player.day);

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
   * 获取某 NPC 发布的所有任务
   */
  getQuestsByGiver(npcId: string): Quest[] {
    return this.quests.filter(q => q.giver === npcId);
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

  /**
   * 获取任务的导航信息（用于自动寻路）
   */
  getQuestNavigation(questId: string, player: PlayerState, npcs: SmartNPC[]): QuestNavigation | null {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'accepted' && quest.status !== 'in_progress') {
      return null;
    }

    // 找到第一个未完成的目标
    const currentObjective = quest.objectives.find(o => o.current < o.required);
    
    if (!currentObjective) {
      // 所有目标都完成了，返回交付位置
      const giverNpc = npcs.find(n => n.id === quest.giver);
      return {
        questId: quest.id,
        questName: quest.name,
        currentObjective: null,
        nextLocation: giverNpc?.location || null,
        nextLocationName: this.getLocationName(giverNpc?.location || ''),
        npcTarget: quest.giver,
        npcTargetName: quest.giverName,
        itemTarget: null,
        itemCount: 0,
        currentCount: 0,
      };
    }

    let nextLocation: string | null = null;
    let nextLocationName: string | null = null;
    let npcTarget: string | null = null;
    let npcTargetName: string | null = null;
    let itemTarget: string | null = null;
    let itemCount = 0;
    let currentCount = 0;

    switch (currentObjective.type) {
      case 'visit':
        nextLocation = currentObjective.target;
        nextLocationName = this.getLocationName(currentObjective.target);
        break;
      
      case 'talk':
        const targetNpc = npcs.find(n => n.id === currentObjective.target);
        if (targetNpc) {
          nextLocation = targetNpc.location;
          nextLocationName = this.getLocationName(targetNpc.location);
          npcTarget = currentObjective.target;
          npcTargetName = targetNpc.name;
        }
        break;
      
      case 'collect':
        itemTarget = currentObjective.target;
        itemCount = currentObjective.required;
        currentCount = player.inventory[currentObjective.target] || 0;
        // 收集任务需要搜索，推荐去废墟
        nextLocation = 'ruins';
        nextLocationName = '废墟';
        break;
      
      case 'deliver':
        const giverForDeliver = npcs.find(n => n.id === quest.giver);
        if (giverForDeliver) {
          nextLocation = giverForDeliver.location;
          nextLocationName = this.getLocationName(giverForDeliver.location);
        }
        itemTarget = currentObjective.target;
        itemCount = currentObjective.required;
        currentCount = player.inventory[currentObjective.target] || 0;
        break;
      
      case 'relationship':
        const relNpc = npcs.find(n => n.id === currentObjective.target);
        if (relNpc) {
          nextLocation = relNpc.location;
          nextLocationName = this.getLocationName(relNpc.location);
          npcTarget = currentObjective.target;
          npcTargetName = relNpc.name;
        }
        break;
      
      case 'survive':
        // 生存任务不需要移动，只需要等待
        break;
    }

    return {
      questId: quest.id,
      questName: quest.name,
      currentObjective,
      nextLocation,
      nextLocationName,
      npcTarget,
      npcTargetName,
      itemTarget,
      itemCount,
      currentCount,
    };
  }

  /**
   * 获取地点名称（辅助方法）
   */
  private getLocationName(locationId: string): string {
    const locationNames: Record<string, string> = {
      'south_gate': '南门',
      'plaza': '中心广场',
      'tent': '北区帐篷',
      'market': '黑冰市场',
      'water': '净水站',
      'greenhouse': '穹顶绿洲',
      'ruins': '废墟区',
      'echo_well': '回声井',
      'home': '住所',
      'water_station': '净水站',
      'workshop': '工坊',
      'radio_tower': '通讯塔',
      'guard_post': '岗哨',
      'storage': '仓库',
    };
    return locationNames[locationId] || locationId;
  }

  /**
   * 自动完成任务的下一步（如果条件满足）
   */
  autoCompleteStep(questId: string, player: PlayerState, npcs: SmartNPC[]): { 
    updated: boolean; 
    message: string;
    quest?: Quest;
  } {
    const quest = this.quests.find(q => q.id === questId);
    if (!quest || quest.status !== 'accepted' && quest.status !== 'in_progress') {
      return { updated: false, message: '任务未接受或已完成' };
    }

    const nav = this.getQuestNavigation(questId, player, npcs);
    if (!nav) {
      return { updated: false, message: '无法获取导航信息' };
    }

    let updated = false;
    let message = '';

    // 如果在正确的位置，尝试完成当前目标
    if (nav.currentObjective) {
      switch (nav.currentObjective.type) {
        case 'visit':
          if (player.location === nav.currentObjective.target) {
            nav.currentObjective.current = nav.currentObjective.required;
            updated = true;
            message = `已到达 ${nav.nextLocationName}`;
          }
          break;
        
        case 'talk':
          // 对话需要玩家主动触发
          break;
        
        case 'collect':
          // 检查是否已经收集足够
          const collected = player.inventory[nav.currentObjective.target] || 0;
          if (collected >= nav.currentObjective.required) {
            nav.currentObjective.current = nav.currentObjective.required;
            updated = true;
            message = `已收集足够的 ${nav.currentObjective.target}`;
          }
          break;
        
        case 'deliver':
          // 检查是否已经有足够物品且在交付位置
          const haveItem = player.inventory[nav.currentObjective.target] || 0;
          if (haveItem >= nav.currentObjective.required && nav.nextLocation === player.location) {
            nav.currentObjective.current = nav.currentObjective.required;
            updated = true;
            message = `已交付 ${nav.currentObjective.target}`;
          }
          break;
        
        case 'relationship':
          const affinity = player.getRelationship(nav.currentObjective.target);
          if (affinity >= nav.currentObjective.required) {
            nav.currentObjective.current = nav.currentObjective.required;
            updated = true;
            message = `与目标NPC的好感度已达标`;
          }
          break;
        
        case 'survive':
          // 生存任务自动完成
          nav.currentObjective.current = nav.currentObjective.required;
          updated = true;
          message = `已度过所需天数`;
          break;
      }
    }

    // 更新任务状态
    if (updated) {
      const allDone = quest.objectives.every(o => o.current >= o.required);
      if (allDone) {
        quest.status = 'ready';
        message += ' → 任务准备就绪，可以交付！';
      } else {
        quest.status = 'in_progress';
      }
    }

    return { updated, message, quest };
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
  error?: 'not_at_location';
}

export interface QuestNavigation {
  questId: string;
  questName: string;
  currentObjective: QuestObjective | null;
  nextLocation: string | null;      // 下一个需要去的地点ID
  nextLocationName: string | null;  // 下一个需要去的地点名称
  npcTarget: string | null;         // 需要对话的NPC ID
  npcTargetName: string | null;     // 需要对话的NPC名称
  itemTarget: string | null;        // 需要收集的物品名称
  itemCount: number;                // 需要收集的数量
  currentCount: number;             // 当前数量
}
