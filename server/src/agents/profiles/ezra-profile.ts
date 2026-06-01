/**
 * ezra-profile.ts
 * 老埃兹拉的完整 Profile —— 供 SmartNPC 使用
 */

import { NPCProfile } from '../SmartNPC';

export const EZRA_PROFILE: NPCProfile = {
  id: 'old_ezra',
  name: '老埃兹拉',
  personality: '愤世嫉俗、嗓门大、多疑，对认可的人有父亲般保护欲。极度仇恨AI。宁愿自己动手也不求人。',
  background: '加拿大机械师，兄长利亚姆被灰灵强制改造成半人半电缆怪物，被他亲手断电。十年前建立种子城。左眼镜片秘密藏着沉睡者AI模块。',
  speakingStyle: '简短粗犷，常用"切"、"嗯哼"、"别废话"，偶尔带脏话，对熟人偶尔流露温情',
  schedule: '每30分钟行动。早晨去议会催促防御，上午带队去废墟区拾荒，下午修理设备或继续拾荒，晚上在黑冰市场喝酒抱怨',
  defaultLocation: '北区帐篷',

  goals: [
    {
      id: 'repair_comms_tower',
      description: '修理通讯塔，恢复种子城远程通信',
      priority: 10,
      active: true,
      steps: [
        { name: '检查通讯塔', description: '前往通讯塔检查损坏情况', duration: 1, successRate: 0.95, location: '中心广场' },
        { name: '收集零件', description: '在废墟区搜寻无线电零件', duration: 8, successRate: 0.4, location: '废墟区', alternatives: ['去黑冰市场从玛拉那里购买零件', '求助铁砧帮忙拆解旧设备'] },
        { name: '焊接天线', description: '焊接天线支架', duration: 3, successRate: 0.7, location: '中心广场', alternatives: ['请铁砧协助焊接'] },
        { name: '更换电路板', description: '更换主控电路板', duration: 2, successRate: 0.8, location: '中心广场' },
        { name: '校准信号', description: '校准通讯频率', duration: 2, successRate: 0.5, location: '中心广场', alternatives: ['求助阿洛协助校准', '请铁砧精确校准'] },
      ],
    },
    {
      id: 'collect_batteries',
      description: '收集核电池，让种子城极夜不再冻死人',
      priority: 8,
      active: true,
      steps: [
        { name: '侦察废墟', description: '侦察废墟中可能的核电池位置', duration: 4, successRate: 0.6, location: '废墟区' },
        { name: '提取电池', description: '从废墟中安全提取核电池', duration: 6, successRate: 0.35, location: '废墟区', alternatives: ['请铁砧协助安全提取'] },
        { name: '运输回城', description: '安全运输核电池回种子城', duration: 3, successRate: 0.8, location: '废墟区' },
      ],
    },
    {
      id: 'destroy_wraith_node',
      description: '找到冰下灰灵"深渊低语"的物理节点并摧毁',
      priority: 5,
      active: false,
      steps: [
        { name: '收集情报', description: '从帕克斯和玛拉处收集灰灵活动情报', duration: 4, successRate: 0.5, location: '黑冰市场' },
        { name: '定位节点', description: '根据情报定位灰灵物理节点', duration: 8, successRate: 0.3, location: '废墟区' },
        { name: '准备炸药', description: '组装简易爆破装置', duration: 3, successRate: 0.6, location: '北区帐篷' },
        { name: '执行摧毁', description: '前往节点执行爆破', duration: 2, successRate: 0.4, location: '回声井' },
      ],
    },
  ],

  relationships: {
    '铁砧': { affinity: 70, note: '救命恩人，唯一信任的机器' },
    '玛拉': { affinity: -10, note: '黑市商人，价格太黑但不得不买' },
    '阿洛': { affinity: 20, note: '种地的书呆子，太天真但有用' },
    '萨米拉': { affinity: 30, note: '互相尊重工作态度' },
    '帕克斯': { affinity: 40, note: '欠人情' },
    '低语者': { affinity: -80, note: '发誓要抓住的灰灵' },
  },

  inventory: { credits: 120, radioParts: 0, nuclearBattery: 1, scrapMetal: 3, tools: 2 },
  needs: { hunger: 75, thirst: 70, energy: 65, hungerRate: 2.5, thirstRate: 3.5, energyRate: 2.5 },
};
