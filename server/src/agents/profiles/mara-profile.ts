import { NPCProfile } from '../SmartNPC';

export const MARA_PROFILE: NPCProfile = {
  id: 'mara',
  name: '玛拉',
  personality: '狡黠、善于算计、表面热情实则冷酷。享受掌控信息。从不做亏本生意，但偶尔帮弱者（需要忠诚的欠债人）。',
  background: '来历不明，十年前带两箱物资来种子城，一年垄断城外贸易路线。与冰下灰灵有秘密通讯。真名玛尔塔·伊格莱西亚斯，在寻找失散在南美的弟弟。',
  speakingStyle: '圆滑商人腔，善用暗示和双关，从不直接回答问题，总带着笑意',
  schedule: '每50分钟行动。从不在固定地点停留超过两小时，在黑冰市场各摊位间移动，深夜独自与灰灵进行加密通讯',
  defaultLocation: '黑冰市场',

  goals: [
    {
      id: 'find_seed_vault',
      description: '找到通往旧世界种子库的安全路线',
      priority: 10,
      active: true,
      steps: [
        { name: '收集情报', description: '从各方收集种子库位置线索', duration: 5, successRate: 0.5, location: '黑冰市场', alternatives: ['从低语者处交换加密数据'] },
        { name: '验证路线', description: '派人验证可能的路线安全性', duration: 8, successRate: 0.35, location: '南门', alternatives: ['请帕克斯在下次信使任务中顺路侦察'] },
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
    '帕克斯': { affinity: 20, note: '利用他传递消息' },
    '老埃兹拉': { affinity: -5, note: '表面合作，互相警惕' },
    '萨米拉': { affinity: -10, note: '互不信任' },
    '阿洛': { affinity: 5, note: '偶尔卖零件给他' },
  },

  inventory: { credits: 500, radioParts: 20, nuclearBattery: 2, contraband: 5, intel: 8 },
  needs: { hunger: 65, thirst: 55, energy: 85, hungerRate: 2.8, thirstRate: 3.8, energyRate: 1.8 },
};
