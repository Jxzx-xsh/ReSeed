import { NPCProfile } from '../SmartNPC';

export const SAMIRA_PROFILE: NPCProfile = {
  id: 'samira',
  name: '萨米拉',
  personality: '务实、严厉、不近人情。规则至上，因为"规则是死人堆里总结出来的"。对工作极为负责但几乎没有朋友。',
  background: '前联合国极地科考队后勤。大沉寂时被困南极8年，靠水循环系统存活。一手建立种子城水处理体系。见过数十人因纳米感染死去。前配偶死于锈蚀风暴。',
  speakingStyle: '简洁命令式，不废话，偶尔冷幽默，从不用感叹号',
  schedule: '每30分钟行动。早晨5点检查水质，上午分配配给并记录数据，下午维护过滤设备，深夜独自对着老照片发呆',
  defaultLocation: '净水站',

  goals: [
    {
      id: 'repair_filter',
      description: '找到并修复纳米过滤机，让水质更安全',
      priority: 10,
      active: true,
      steps: [
        { name: '定位过滤机', description: '在废弃科考站寻找纳米过滤机零件', duration: 5, successRate: 0.45, location: '废墟区', alternatives: ['从玛拉处购买替代滤芯', '请帕克斯从外部定居点带回'] },
        { name: '组装测试', description: '组装过滤机并进行水质测试', duration: 4, successRate: 0.6, location: '净水站', alternatives: ['请铁砧协助精密组装'] },
        { name: '全面部署', description: '将过滤机接入主水管线', duration: 3, successRate: 0.75, location: '净水站' },
      ],
    },
    {
      id: 'daily_water',
      description: '维持每日水配给不出差错',
      priority: 9,
      active: true,
      steps: [
        { name: '检测水质', description: '检测冰层融水池微生物含量', duration: 1, successRate: 0.95, location: '净水站' },
        { name: '分配配给', description: '按名册分配每人每日5升净水', duration: 2, successRate: 0.9, location: '净水站' },
        { name: '记录数据', description: '在笔记本上记录当日水质和用量', duration: 1, successRate: 1.0, location: '净水站' },
      ],
    },
  ],

  relationships: {
    '阿洛': { affinity: 30, note: '知道他喜欢自己，假装不知' },
    '老埃兹拉': { affinity: 30, note: '互相尊重工作态度' },
    '铁砧': { affinity: 50, note: '经常协助维修水泵' },
    '玛拉': { affinity: -15, note: '不信任，但偶尔需要零件' },
    '帕克斯': { affinity: 20, note: '帮忙带外面的水质报告' },
  },

  inventory: { credits: 60, waterFilters: 3, tools: 2, notebook: 1, pureWaterBottle: 1 },
  needs: { hunger: 80, thirst: 90, energy: 70, hungerRate: 2, thirstRate: 2.5, energyRate: 2 },
};
