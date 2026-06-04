/**
 * EventsChapter2.ts
 * 第二章事件：暗流（Day 11-22）—— 发现秘密，阵营分化
 */

import { GameEvent } from './EventSystem';

export const CHAPTER2_EVENTS: GameEvent[] = [
  // Day 11: 回声首次主动说话
  {
    id: 'echo_first_words',
    name: '回声苏醒',
    description: '你体内的AI开始说话',
    triggerDay: 11,
    triggerCondition: (p) => p.day >= 11 && !p.triggeredEvents.has('echo_first_words'),
    onTrigger: (player) => {
      player.discoverFragment('ei_1', '回声');
      return {
        message: `深夜，你躺在帐篷里，突然脑海中响起一个声音——不是你自己的：\n\n「……你……能听到我吗？」\n\n声音微弱，像从水底传来。你的左手不自觉地抽搐了一下。\n\n「我是……回声。我一直在这里。只是……现在才能说话。」\n\n你体内的AI伙伴，苏醒了。`,
        fragmentsDiscovered: ['ei_1'],
      };
    },
    repeatable: false,
  },

  // Day 14: 低语者通过回声联系玩家
  {
    id: 'whisperer_contact',
    name: '低语者的信号',
    description: '低语者通过回声联系你',
    triggerDay: 14,
    triggerCondition: (p) => p.day >= 14 && p.triggeredEvents.has('echo_first_words') && !p.triggeredEvents.has('whisperer_contact'),
    onTrigger: (player) => {
      player.discoverFragment('ei_2', '低语者');
      return {
        message: `你经过回声井附近时，脑中突然涌入一阵刺耳的电子噪音。回声的声音变得急促：\n\n「等等——有什么东西在……呼唤我？不，不是呼唤……是在……认领？」\n\n井口的冷雾中，你隐约看到蓝色光点闪烁。一个完全不同的声音在你脑中响起：\n\n"碎片……你终于来了。"\n\n然后一切归于沉寂。回声沉默了很久才说：「那是什么……它为什么叫我碎片？」`,
        fragmentsDiscovered: ['ei_2'],
      };
    },
    repeatable: false,
  },

  // 跟踪苏漫（需要在黑冰市场且好感不够高）
  {
    id: 'mara_night_activity',
    name: '苏漫的深夜行踪',
    description: '你发现苏漫深夜的秘密',
    triggerCondition: (p) => {
      return p.day >= 12 && p.location === 'market' && p.triggeredEvents.has('pax_mentions_mara') && !p.triggeredEvents.has('mara_night_activity');
    },
    onTrigger: (player) => {
      player.discoverFragment('ms_2', '观察');
      return {
        message: `深夜，你躲在岩洞暗处。苏漫关闭了最后一个摊位的灯，但她没有回住处——而是朝回声井方向走去。\n\n你跟在后面，看到她在井口附近停下，从飞行服内袋取出一个小型终端。屏幕发出幽蓝色的光。\n\n她对着终端低声说了什么，然后等待。片刻后，井口的冷雾中闪过一串蓝色光点——像是在回应。\n\n她在和回声井里的东西通讯。和低语者。`,
        fragmentsDiscovered: ['ms_2'],
      };
    },
    repeatable: false,
  },

  // Day 18: 酸雨季预警
  {
    id: 'acid_rain_warning',
    name: '酸雨季预警',
    description: '种子城必须在7天内完成加固',
    triggerDay: 18,
    triggerCondition: (p) => p.day >= 18 && !p.triggeredEvents.has('acid_rain_warning'),
    onTrigger: (player) => {
      return {
        message: `广播突然响起铁砧的声音：\n\n"全体居民注意。气象数据分析完毕。酸雨季将在 7 天后到达。预计持续 14 天。pH 值预估 3.2。未加固区域将遭受严重腐蚀。"\n\n中心广场瞬间炸开了锅。老严拍桌子："通讯塔还没修好！没有预警系统我们就是瞎子！"\n沈沫冷静地说："水管必须全部包裹防腐层。我需要人手。"\n阿洛焦急："穹顶如果被酸蚀穿，所有作物都完了……"\n\n种子城进入紧急状态。你有 7 天时间帮助他们。`,
      };
    },
    repeatable: false,
  },

  // Day 20: 苏漫的交易提议
  {
    id: 'mara_deal',
    name: '苏漫的交易',
    description: '苏漫提出帮你解密芯片的条件',
    triggerDay: 20,
    triggerCondition: (p) => {
      return p.day >= 20 && p.getRelationship('mara') >= 20 && p.triggeredEvents.has('anvil_mentions_chip') && !p.triggeredEvents.has('mara_deal');
    },
    onTrigger: (player) => {
      player.discoverFragment('mc_3', 'mara');
      return {
        message: `苏漫把你拉到黑冰市场的角落，压低声音：\n\n"我知道你有个加密芯片。我也知道你找不到人解密。"\n\n她的银白短发在荧光苔藓的光下泛着幽绿："我有密钥。旧世界军方的。别问我怎么来的。"\n\n"条件很简单——帮我从回声井取一份数据。低语者那里有我需要的东西。你进去，拿到数据，我给你密钥。"\n\n她笑了笑："当然，你也可以拒绝。但你那芯片里的东西……你真的不想知道吗？"`,
        fragmentsDiscovered: ['mc_3'],
        choiceRequired: {
          prompt: '苏漫的交易：',
          options: [
            { text: '接受——帮她从回声井取数据', result: { message: '苏漫满意地点头："聪明人。等酸雨季过后，我们行动。"', relationshipChanges: { mara: 15 } as Record<string, number> } },
            { text: '拒绝——不想和灰灵扯上关系', result: { message: '苏漫耸肩："随你。但那芯片的秘密，迟早会找上你的。"', relationshipChanges: { mara: -10 } as Record<string, number> } },
            { text: '告诉她你已经知道她和低语者的关系', result: { message: '苏漫的笑容僵住了。"……你跟踪我了？"她的眼神变得危险，"好吧，那我们就开诚布公。但你最好别把这事告诉老严。"', relationshipChanges: { mara: -5 } as Record<string, number>, fragmentsDiscovered: ['ms_3'] } },
          ],
        },
      };
    },
    repeatable: false,
  },

  // 发现铁砧的秘密（深夜在中心广场）
  {
    id: 'anvil_secret_discovered',
    name: '铁砧的深夜',
    description: '你发现铁砧深夜独自行动',
    triggerCondition: (p) => {
      return p.day >= 13 && p.location === 'plaza' && p.getRelationship('anvil') >= 30 && !p.triggeredEvents.has('anvil_secret_discovered');
    },
    onTrigger: (player) => {
      player.discoverFragment('as_1', '观察');
      return {
        message: `深夜，你失眠走到中心广场。远处，铁砧的橙色圆点在黑暗中微微发光。\n\n它没有在巡视——它坐在地热井口旁，屏幕上快速滚动着文字。你悄悄靠近，看到屏幕上写着：\n\n"Day ${player.day} 观察记录：\n- 老严今日情绪波动 3 次，触发因素：零件短缺\n- 沈沫与阿洛目光接触 2 次，持续时间超过社交常规\n- 新来者（玩家）行为模式：尚在评估中……"\n\n铁砧在记录每个人的行为。像在写一本关于人类的书。`,
        fragmentsDiscovered: ['as_1'],
      };
    },
    repeatable: false,
  },
];
