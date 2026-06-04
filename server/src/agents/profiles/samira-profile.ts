import { NPCProfile } from '../SmartNPC';

export const SAMIRA_PROFILE: NPCProfile = {
  id: 'samira',
  name: '沈沫',
  personality: '务实、严厉、不近人情。规则至上，因为"规则是死人堆里总结出来的"。对工作极为负责但几乎没有朋友。',
  background: '前联合国极地科考队后勤。大沉寂时被困南极8年，靠水循环系统存活。一手建立种子城水处理体系。见过数十人因纳米感染死去。前配偶死于锈蚀风暴。',
  speakingStyle: '简洁命令式，不废话，偶尔冷幽默，从不用感叹号',
  schedule: '每30分钟行动。早晨5点检查水质，上午分配配给并记录数据，下午维护过滤设备，深夜独自对着老照片发呆',
  defaultLocation: 'water',
  avatar: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231a2a3a'/%3E%3Ccircle cx='50' cy='50' r='42' fill='%23d4a574'/%3E%3Cpath d='M22 32 Q50 20 78 32 L76 52 Q50 60 24 52 Z' fill='%231a1a2a'/%3E%3Crect x='20' y='38' width='60' height='18' rx='3' fill='%232a3a4a'/%3E%3Crect x='24' y='41' width='22' height='12' rx='2' fill='%234a6a8a'/%3E%3Crect x='54' y='41' width='22' height='12' rx='2' fill='%234a6a8a'/%3E%3Crect x='26' y='43' width='16' height='7' rx='1' fill='%236ac' opacity='0.7'/%3E%3Crect x='56' y='43' width='16' height='7' rx='1' fill='%236ac' opacity='0.7'/%3E%3Ccircle cx='34' cy='47' r='2' fill='%23fff'/%3E%3Ccircle cx='66' cy='47' r='2' fill='%23fff'/%3E%3Cpath d='M44 58 L56 58' stroke='%233a3a4a' stroke-width='1.5'/%3E%3Crect x='32' y='70' width='36' height='14' rx='3' fill='%233a5a7a'/%3E%3Crect x='35' y='73' width='30' height='8' rx='1' fill='%235a7a9a'/%3E%3Crect x='38' y='75' width='6' height='4' rx='1' fill='%236ac'/%3E%3Crect x='46' y='75' width='6' height='4' rx='1' fill='%236ac'/%3E%3Crect x='54' y='75' width='6' height='4' rx='1' fill='%236ac'/%3E%3C/svg%3E`,

  goals: [
    {
      id: 'repair_filter',
      description: '找到并修复纳米过滤机，让水质更安全',
      priority: 10,
      active: true,
      steps: [
        { name: '定位过滤机', description: '在废弃科考站寻找纳米过滤机零件', duration: 5, successRate: 0.45, location: '废墟区', alternatives: ['从苏漫处购买替代滤芯', '请小白从外部定居点带回'] },
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
    '老严': { affinity: 30, note: '互相尊重工作态度' },
    '铁砧': { affinity: 50, note: '经常协助维修水泵' },
    '苏漫': { affinity: -15, note: '不信任，但偶尔需要零件' },
    '小白': { affinity: 20, note: '帮忙带外面的水质报告' },
  },

  inventory: { credits: 60, waterFilters: 3, tools: 2, notebook: 1, pureWaterBottle: 1 },
  needs: { hunger: 80, thirst: 90, energy: 70, hungerRate: 2, thirstRate: 2.5, energyRate: 2 },
};
