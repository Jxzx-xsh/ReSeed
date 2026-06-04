/**
 * EventSystem.ts
 * 事件系统 —— 管理剧情触发、信息碎片发现条件
 */

import { PlayerState, TrustLevel } from './PlayerState';
import { SmartNPC } from '../agents/SmartNPC';
import { CHAPTER2_EVENTS } from './EventsChapter2';
import { CHAPTER3_EVENTS } from './EventsChapter3';

// ============================================================
// 事件定义
// ============================================================

export interface GameEvent {
  id: string;
  name: string;
  description: string;          // 玩家看到的描述
  triggerDay?: number;          // 在第几天触发（可选）
  triggerCondition?: (player: PlayerState, npcs: SmartNPC[]) => boolean;
  onTrigger: (player: PlayerState, npcs: SmartNPC[]) => EventResult;
  repeatable: boolean;
}

export interface EventResult {
  message: string;              // 显示给玩家的文本
  fragmentsDiscovered?: string[]; // 发现的信息碎片 ID
  relationshipChanges?: Record<string, number>; // NPC 好感变化
  inventoryChanges?: Record<string, number>;    // 物品变化
  choiceRequired?: EventChoice; // 需要玩家做选择
}

export interface EventChoice {
  prompt: string;
  options: { text: string; result: EventResult }[];
}

// ============================================================
// 第一章事件
// ============================================================

export const CHAPTER1_EVENTS: GameEvent[] = [
  // Day 1: 到达种子城
  {
    id: 'arrival',
    name: '抵达种子城',
    description: '你从南门进入种子城',
    triggerCondition: (p) => p.day === 1 && p.location === 'south_gate' && !p.triggeredEvents.has('arrival'),
    onTrigger: (player) => {
      player.discoverFragment('ct_1', '观察');
      return {
        message: `哨塔上的守卫朝你喊了一声："新来的？去中心广场找议会登记。别乱跑，这里不欢迎闲人。"\n\n你注意到远处一座歪斜的铁塔——通讯塔，天线断了一半，显然已经废弃很久了。`,
        fragmentsDiscovered: ['ct_1'],
      };
    },
    repeatable: false,
  },

  // 到达中心广场：登记
  {
    id: 'register_at_plaza',
    name: '在议会登记',
    description: '你到中心广场找议会登记',
    triggerCondition: (p) => p.location === 'plaza' && p.triggeredEvents.has('arrival') && !p.triggeredEvents.has('register_at_plaza'),
    onTrigger: (player) => {
      return {
        message: `你走进锈蚀议会帐篷。一个满脸皱纹的老人抬头看了你一眼——是老严。\n\n他从桌上拿起一本破旧的登记簿，用铅笔头在上面划了一笔：\n"名字？"\n\n你报上名字。他哼了一声："行，登了。每天去净水站领 2 升水，穹顶绿洲领一份口粮。别惹事。"\n\n他顿了顿，盯着你的眼睛："十天后议会投票决定你能不能留下。在那之前——证明你有用。"`,
        relationshipChanges: { old_ezra: 5 } as Record<string, number>,
      };
    },
    repeatable: false,
  },

  // Day 3: 锈蚀风暴
  {
    id: 'rust_storm_day3',
    name: '锈蚀风暴来袭',
    description: '一场锈蚀风暴正在逼近种子城',
    triggerDay: 3,
    triggerCondition: (p) => p.day >= 3 && !p.triggeredEvents.has('rust_storm_day3'),
    onTrigger: (player, npcs) => {
      return {
        message: `天空变成了暗橙色，风中夹杂着细碎的铁屑。锈蚀风暴来了！\n\n广播响起沈沫的声音："所有人注意，风暴预计持续 6 小时。各区负责人立即加固！"\n\n你看到老严正朝北区帐篷跑去，沈沫则冲向净水站的水管。`,
        choiceRequired: {
          prompt: '风暴来了，你只能帮一个人：',
          options: [
            {
              text: '帮老严加固北区帐篷',
              result: {
                message: '你和老严一起用废铁板加固了帐篷。他粗声说了句"还行"，这对他来说已经是最高赞美了。',
                relationshipChanges: { old_ezra: 15, samira: -5 } as Record<string, number>,
                fragmentsDiscovered: ['ct_3'],
              },
            },
            {
              text: '帮沈沫保护净水站水管',
              result: {
                message: '你帮沈沫用防锈布包裹了暴露的水管。她点了点头："不错，知道轻重。"',
                relationshipChanges: { samira: 15, old_ezra: -5 } as Record<string, number>,
              },
            },
            {
              text: '帮铁砧加固中心广场结构',
              result: {
                message: '你协助铁砧焊接了广场的支撑桩。它的屏幕闪了闪："效率提升 12%。感谢，有机体。"',
                relationshipChanges: { anvil: 10 } as Record<string, number>,
              },
            },
          ],
        },
      };
    },
    repeatable: false,
  },

  // 和老严对话 3 次后触发
  {
    id: 'ezra_reveals_plan',
    name: '老严透露修塔计划',
    description: '老严开始信任你',
    triggerCondition: (p) => {
      const trust = p.getTrustLevel('old_ezra');
      return (trust === 'trusted' || trust === 'confidant') && !p.triggeredEvents.has('ezra_reveals_plan');
    },
    onTrigger: (player) => {
      player.discoverFragment('ct_2', 'old_ezra');
      player.discoverFragment('ct_3', 'old_ezra');
      return {
        message: `老严看了你一眼，从口袋里掏出一个破损的零件：\n\n"切……你既然不是废物，就听好了。通讯塔需要 5 个无线电零件才能修好。我已经找了三个月，一个都没凑齐。苏漫那边有，但那女人要价 150 信用点——抢劫。"\n\n他顿了顿："你要是能帮忙弄到零件，我不会忘的。"`,
        fragmentsDiscovered: ['ct_2', 'ct_3'],
      };
    },
    repeatable: false,
  },

  // 和小白聊天发现黑市
  {
    id: 'pax_mentions_mara',
    name: '小白提到苏漫',
    description: '小白无意中透露了苏漫的信息',
    triggerCondition: (p) => {
      return p.getRelationship('pax') >= 15 && !p.triggeredEvents.has('pax_mentions_mara');
    },
    onTrigger: (player) => {
      player.discoverFragment('ms_1', 'pax');
      return {
        message: `小白整理背包时随口说道：\n\n"对了……你要是需要什么特殊物资，可以去黑冰市场找苏漫。岩洞里面，荧光苔藓照明的那个。不过小心，她的价格跟她的笑容一样——看着甜，咬下去全是刺。"\n\n他眨了眨眼："还有……我有次深夜看到她一个人往回声井方向走。可能是我看错了。"`,
        fragmentsDiscovered: ['ms_1'],
      };
    },
    repeatable: false,
  },

  // 铁砧提到回声井
  {
    id: 'anvil_mentions_chip',
    name: '铁砧注意到你的芯片',
    description: '铁砧对你的加密芯片产生兴趣',
    triggerCondition: (p) => {
      return p.getRelationship('anvil') >= 20 && p.inventory['加密芯片'] > 0 && !p.triggeredEvents.has('anvil_mentions_chip');
    },
    onTrigger: (player) => {
      player.discoverFragment('mc_1', 'anvil');
      player.discoverFragment('mc_2', 'anvil');
      return {
        message: `铁砧的屏幕突然转向你腰间的芯片：\n\n"检测到异常加密信号。该芯片使用旧世界军用级加密协议——AES-4096 变体。当前种子城没有设备能解密。"\n\n它停顿了一下："但回声井底部的量子计算机……理论上具备足够算力。前提是你能说服它的'住户'配合。"`,
        fragmentsDiscovered: ['mc_1', 'mc_2'],
      };
    },
    repeatable: false,
  },

  // Day 7: 小白出发
  {
    id: 'pax_departure',
    name: '小白准备出发',
    description: '小白要离开种子城执行信使任务',
    triggerDay: 7,
    triggerCondition: (p) => p.day >= 7 && !p.triggeredEvents.has('pax_departure'),
    onTrigger: (player) => {
      return {
        message: `小白在南门整理背包，看起来比平时更紧张。\n\n"这次要穿过灰灵活跃区……一个人有点发毛。"他看了你一眼，"如果你有什么信要带给外面的人，现在给我。两个月后我会回来。"`,
        choiceRequired: {
          prompt: '小白即将出发：',
          options: [
            {
              text: '托他打听南美定居点的消息（关于芯片来源）',
              result: {
                message: '小白点头："我会留意的。南美那边……说不定能找到什么线索。"',
                relationshipChanges: { pax: 5 },
              },
            },
            {
              text: '给他一份干粮作为路上的补给',
              result: {
                message: '小白接过干粮，眼眶微红："谢谢……这条路上，一份干粮可能就是一条命。"',
                relationshipChanges: { pax: 15 },
                inventoryChanges: { '干粮': -1 },
              },
            },
            {
              text: '只是道别',
              result: {
                message: '你挥了挥手。小白背起巨大的背包，一瘸一拐地走向冰架。他的身影很快消失在灰色的地平线上。',
              },
            },
          ],
        },
      };
    },
    repeatable: false,
  },

  // 到达回声井：低语者接触
  {
    id: 'whisperer_contact',
    name: '低语者的声音',
    description: '你第一次听到回声井底部的低语',
    triggerCondition: (p) => p.location === 'echo_well' && !p.triggeredEvents.has('whisperer_contact'),
    onTrigger: (player) => {
      player.discoverFragment('wsp_1', '低语者');
      return {
        message: `你站在回声井边缘，深不见底的黑暗中传来奇怪的声音……\n\n"……数据流……在缝隙中……\n……痛苦是……低效的……\n……有机体……你来了……"\n\n声音断断续续，像是从很远的地方传来，又像是在你脑海中直接响起。你感到一阵眩晕，但同时也感觉到一种奇异的吸引力。\n\n低语者似乎在观察你……`,
        fragmentsDiscovered: ['wsp_1'],
      };
    },
    repeatable: false,
  },

  // Day 10: 议会投票
  {
    id: 'council_vote',
    name: '议会投票',
    description: '锈蚀议会决定是否接纳你为正式居民',
    triggerDay: 10,
    triggerCondition: (p) => p.day >= 10 && !p.triggeredEvents.has('council_vote'),
    onTrigger: (player) => {
      const totalAffinity = (player.getRelationship('old_ezra') + player.getRelationship('samira') + player.getRelationship('anvil') + player.getRelationship('arlo')) / 4;
      const accepted = totalAffinity >= 10;

      if (accepted) {
        return {
          message: `锈蚀议会帐篷里，老严敲了敲桌子：\n\n"这个人……还行。至少不是废物。"\n沈沫点头："遵守规则，没浪费水。"\n铁砧的屏幕显示绿色："数据支持接纳。"\n\n议会通过——你正式成为种子城居民。每日配给从明天开始。`,
          inventoryChanges: { '信用点': 20 },
        };
      } else {
        return {
          message: `锈蚀议会帐篷里气氛紧张。\n\n老严皱眉："这人来了十天，干了什么？"\n沈沫翻了翻笔记本："配给消耗正常，但贡献不足。"\n\n议会决定：再观察 5 天。你的配给减半。`,
          inventoryChanges: { '信用点': -10 },
        };
      }
    },
    repeatable: false,
  },
];

// ============================================================
// 事件管理器
// ============================================================

export class EventSystem {
  private events: GameEvent[];

  constructor() {
    this.events = [...CHAPTER1_EVENTS, ...CHAPTER2_EVENTS, ...CHAPTER3_EVENTS];
  }

  /**
   * 每次行动后检查是否有事件触发
   */
  checkEvents(player: PlayerState, npcs: SmartNPC[]): EventResult | null {
    for (const event of this.events) {
      if (player.triggeredEvents.has(event.id)) continue;

      // 检查日期条件
      if (event.triggerDay && player.day < event.triggerDay) continue;

      // 检查自定义条件
      if (event.triggerCondition && !event.triggerCondition(player, npcs)) continue;

      // 触发事件
      player.triggeredEvents.add(event.id);
      const result = event.onTrigger(player, npcs);

      // 应用效果
      if (result.relationshipChanges) {
        for (const [npcId, delta] of Object.entries(result.relationshipChanges)) {
          player.changeRelationship(npcId, delta);
        }
      }
      if (result.inventoryChanges) {
        for (const [item, delta] of Object.entries(result.inventoryChanges)) {
          player.inventory[item] = (player.inventory[item] ?? 0) + delta;
        }
      }
      if (result.fragmentsDiscovered) {
        for (const fragId of result.fragmentsDiscovered) {
          player.discoverFragment(fragId, '事件');
        }
      }

      return result;
    }

    return null;
  }
}
