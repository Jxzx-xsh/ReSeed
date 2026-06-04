import { NPCProfile } from '../SmartNPC';

export const MARA_PROFILE: NPCProfile = {
  id: 'mara',
  name: '苏漫',
  personality: '狡黠、善于算计、表面热情实则冷酷。享受掌控信息。从不做亏本生意，但偶尔帮弱者（需要忠诚的欠债人）。',
  background: '来历不明，十年前带两箱物资来种子城，一年垄断城外贸易路线。与冰下灰灵有秘密通讯。真名玛尔塔·伊格莱西亚斯，在寻找失散在南美的弟弟。',
  speakingStyle: '圆滑商人腔，善用暗示和双关，从不直接回答问题，总带着笑意',
  schedule: '每50分钟行动。从不在固定地点停留超过两小时，在黑冰市场各摊位间移动，深夜独自与灰灵进行加密通讯',
  defaultLocation: 'market',
  avatar: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232a1a3a'/%3E%3Ccircle cx='50' cy='50' r='42' fill='%23e8c4a0'/%3E%3Cpath d='M20 28 Q50 15 80 28 L76 55 Q50 62 24 55 Z' fill='%233a1a4a'/%3E%3Cpath d='M28 52 Q50 47 72 52 L70 70 Q50 75 30 70 Z' fill='%234a2a5a'/%3E%3Crect x='25' y='40' width='50' height='10' rx='3' fill='%23d4b490'/%3E%3Ccircle cx='38' cy='45' r='5' fill='%232a1a1a'/%3E%3Ccircle cx='62' cy='45' r='5' fill='%232a1a1a'/%3E%3Ccircle cx='36' cy='44' r='2' fill='%23fff'/%3E%3Ccircle cx='60' cy='44' r='2' fill='%23fff'/%3E%3Cpath d='M42 60 Q50 66 58 60' stroke='%238a4a5a' stroke-width='2' fill='none'/%3E%3Crect x='15' y='38' width='12' height='20' rx='2' fill='%235a3a6a'/%3E%3Crect x='73' y='38' width='12' height='20' rx='2' fill='%235a3a6a'/%3E%3Ccircle cx='21' cy='48' r='3' fill='%23c9a9b9' opacity='0.6'/%3E%3Ccircle cx='79' cy='48' r='3' fill='%23c9a9b9' opacity='0.6'/%3E%3Crect x='40' y='78' width='20' height='8' rx='2' fill='%236a4a7a'/%3E%3Ccircle cx='45' cy='82' r='1.5' fill='%238a6a9a'/%3E%3Ccircle cx='55' cy='82' r='1.5' fill='%238a6a9a'/%3E%3C/svg%3E`,

  goals: [
    {
      id: 'find_seed_vault',
      description: '找到通往旧世界种子库的安全路线',
      priority: 10,
      active: true,
      steps: [
        { name: '收集情报', description: '从各方收集种子库位置线索', duration: 5, successRate: 0.5, location: '黑冰市场', alternatives: ['从低语者处交换加密数据'] },
        { name: '验证路线', description: '派人验证可能的路线安全性', duration: 8, successRate: 0.35, location: '南门', alternatives: ['请小白在下次信使任务中顺路侦察'] },
        { name: '组织探险', description: '组织一支小队前往种子库', duration: 6, successRate: 0.3, location: '南门' },
      ],
    },
    {
      id: 'manage_market',
      description: '维持黑冰市场的运营和信息垄断',
      priority: 9,
      active: true,
      steps: [
        { name: '盘点库存', description: '清点市场库存并调整价格', duration: 2, successRate: 0.95, location: '黑冰市场' },
        { name: '接待客户', description: '处理当日交易和情报交换', duration: 3, successRate: 0.9, location: '黑冰市场' },
        { name: '加密通讯', description: '深夜与外部联系人进行加密通讯', duration: 2, successRate: 0.8, location: '黑冰市场' },
      ],
    },
  ],

  relationships: {
    '低语者': { affinity: 40, note: '秘密交易伙伴' },
    '小白': { affinity: 20, note: '利用他传递消息' },
    '老严': { affinity: -5, note: '表面合作，互相警惕' },
    '沈沫': { affinity: -10, note: '互不信任' },
    '阿洛': { affinity: 5, note: '偶尔卖零件给他' },
  },

  inventory: { credits: 500, radioParts: 20, nuclearBattery: 2, contraband: 5, intel: 8 },
  needs: { hunger: 65, thirst: 55, energy: 85, hungerRate: 2.8, thirstRate: 3.8, energyRate: 1.8 },
};
