import { NPCProfile } from '../SmartNPC';

export const PAX_PROFILE: NPCProfile = {
  id: 'pax',
  name: '小白',
  personality: '焦虑、敏感、频繁眨眼。内心正义感强，厌恶暴力，相信信息比子弹有力。说话语速快容易跑题。',
  background: '大沉寂后出生，父母是走商。12岁父母失踪，继承信使路线。有微弱通感能力（能感知灰灵存在）。背包里有封从未寄出的给父亲的信。',
  speakingStyle: '语速快，容易跑题，紧张时说话断断续续，偶尔冒出远方见闻',
  schedule: '每40分钟行动。在城时整理信件和维修装备，每两周出发一次长途信使任务，回城后先去南门报到再回帐篷休息',
  defaultLocation: 'tent',
  avatar: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232a3a2a'/%3E%3Ccircle cx='50' cy='50' r='42' fill='%23c9b896'/%3E%3Cpath d='M25 30 Q50 22 75 30 L72 50 Q50 58 28 50 Z' fill='%235a3a2a'/%3E%3Cpath d='M28 47 Q50 40 72 47 Q70 54 50 58 Q30 54 28 47' fill='%23f0e6d2'/%3E%3Ccircle cx='36' cy='47' r='6' fill='%232a2a2a'/%3E%3Ccircle cx='64' cy='47' r='6' fill='%232a2a2a'/%3E%3Ccircle cx='34' cy='45' r='2.5' fill='%23fff'/%3E%3Ccircle cx='62' cy='45' r='2.5' fill='%23fff'/%3E%3Ccircle cx='33' cy='44' r='1' fill='%23000'/%3E%3Ccircle cx='61' cy='44' r='1' fill='%23000'/%3E%3Cpath d='M44 59 Q50 64 56 59' stroke='%235a4a3a' stroke-width='1.5' fill='none'/%3E%3Cpath d='M25 55 Q20 58 Q25 60' stroke='%235a4a3a' stroke-width='1.5'/%3E%3Cpath d='M75 55 Q80 58 Q75 60' stroke='%235a4a3a' stroke-width='1.5'/%3E%3Crect x='68' y='28' width='28' height='32' rx='3' fill='%236a5a4a'/%3E%3Crect x='71' y='32' width='22' height='7' rx='1' fill='%238a7a6a'/%3E%3Crect x='71' y='42' width='22' height='7' rx='1' fill='%238a7a6a'/%3E%3Crect x='71' y='52' width='22' height='4' rx='1' fill='%238a7a6a'/%3E%3Cpath d='M68 38 L76 34 L76 42 Z' fill='%235a4a3a'/%3E%3C/svg%3E`,

  goals: [
    {
      id: 'find_leila',
      description: '找到失散在南美的妹妹莱拉',
      priority: 10,
      active: true,
      steps: [
        { name: '收集消息', description: '向苏漫和外来商人打听南美定居点消息', duration: 3, successRate: 0.4, location: '黑冰市场', alternatives: ['请低语者搜索旧通讯记录'] },
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
        { name: '出发送信', description: '从南门出发前往下一个定居点', duration: 12, successRate: 0.7, location: '南门', alternatives: ['请老严派人护送一段'] },
      ],
    },
  ],

  relationships: {
    '苏漫': { affinity: 20, note: '雇主，情报来源' },
    '老严': { affinity: 40, note: '曾救过命，欠人情' },
    '低语者': { affinity: -20, note: '害怕但最近想尝试对话' },
    '铁砧': { affinity: 30, note: '帮忙修背包扣件' },
    '阿洛': { affinity: 25, note: '偶尔帮他带外面的种子' },
  },

  inventory: { credits: 25, letters: 7, tools: 1, rations: 3, compass: 1 },
  needs: { hunger: 50, thirst: 45, energy: 75, hungerRate: 4, thirstRate: 5, energyRate: 3 },
};
