import { NPCProfile } from '../SmartNPC';

export const PAX_PROFILE: NPCProfile = {
  id: 'pax',
  name: '帕克斯',
  personality: '焦虑、敏感、频繁眨眼。内心正义感强，厌恶暴力，相信信息比子弹有力。说话语速快容易跑题。',
  background: '大沉寂后出生，父母是走商。12岁父母失踪，继承信使路线。有微弱通感能力（能感知灰灵存在）。背包里有封从未寄出的给父亲的信。',
  speakingStyle: '语速快，容易跑题，紧张时说话断断续续，偶尔冒出远方见闻',
  schedule: '每40分钟行动。在城时整理信件和维修装备，每两周出发一次长途信使任务，回城后先去南门报到再回帐篷休息',
  defaultLocation: '北区帐篷',

  goals: [
    {
      id: 'find_leila',
      description: '找到失散在南美的妹妹莱拉',
      priority: 10,
      active: true,
      steps: [
        { name: '收集消息', description: '向玛拉和外来商人打听南美定居点消息', duration: 3, successRate: 0.4, location: '黑冰市场', alternatives: ['请低语者搜索旧通讯记录'] },
        { name: '规划路线', description: '规划前往南美的安全路线', duration: 4, successRate: 0.5, location: '北区帐篷' },
        { name: '准备物资', description: '为长途旅行准备足够物资', duration: 3, successRate: 0.6, location: '北区帐篷' },
      ],
    },
    {
      id: 'messenger_duty',
      description: '完成当前信使任务（传递信件和包裹）',
      priority: 8,
      active: true,
      steps: [
        { name: '整理信件', description: '整理待送信件和包裹', duration: 2, successRate: 0.95, location: '北区帐篷' },
        { name: '检查装备', description: '检查背包、水袋和导航工具', duration: 1, successRate: 0.9, location: '北区帐篷' },
        { name: '出发送信', description: '从南门出发前往下一个定居点', duration: 12, successRate: 0.7, location: '南门', alternatives: ['请老埃兹拉派人护送一段'] },
      ],
    },
  ],

  relationships: {
    '玛拉': { affinity: 20, note: '雇主，情报来源' },
    '老埃兹拉': { affinity: 40, note: '曾救过命，欠人情' },
    '低语者': { affinity: -20, note: '害怕但最近想尝试对话' },
    '铁砧': { affinity: 30, note: '帮忙修背包扣件' },
    '阿洛': { affinity: 25, note: '偶尔帮他带外面的种子' },
  },

  inventory: { credits: 25, letters: 7, tools: 1, rations: 3, compass: 1 },
  needs: { hunger: 50, thirst: 45, energy: 75, hungerRate: 4, thirstRate: 5, energyRate: 3 },
};
