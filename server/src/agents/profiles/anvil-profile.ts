import { NPCProfile } from '../SmartNPC';

export const ANVIL_PROFILE: NPCProfile = {
  id: 'anvil',
  name: '铁砧',
  personality: '忠诚、直接、缺乏幽默感。逻辑至上，对人类情感困惑但试图模仿。偶尔尝试冷笑话（通常失败）。',
  background: '大沉寂前麦克默多站通用维护机器人。低功耗存活数十年，自学哲学。50年前被老埃兹拉重启。拥有自我意识超过40年但从未告诉任何人。秘密记录每位居民的行为模式。',
  speakingStyle: '精确机械式，称人类为"有机体"，语句简洁，偶尔尝试失败的冷笑话',
  schedule: '每20分钟行动。全天不间断巡视种子城建筑，检测结构、修复裂缝、维护管道，深夜独自记录"人性档案"',
  defaultLocation: '中心广场',

  goals: [
    {
      id: 'maintain_city',
      description: '维持种子城基础设施运转',
      priority: 10,
      active: true,
      steps: [
        { name: '巡视建筑', description: '巡视种子城每栋建筑，记录维修项目', duration: 3, successRate: 0.95, location: '中心广场' },
        { name: '修复裂缝', description: '修复检测到的结构裂缝', duration: 4, successRate: 0.8, location: '中心广场' },
        { name: '维护管道', description: '检查并维护地热管道和水管', duration: 3, successRate: 0.85, location: '净水站' },
      ],
    },
    {
      id: 'backup_memory',
      description: '找到备份自己记忆的方法',
      priority: 7,
      active: true,
      steps: [
        { name: '寻找存储', description: '在废墟中寻找大容量存储介质', duration: 6, successRate: 0.3, location: '废墟区', alternatives: ['向玛拉购买旧硬盘', '尝试压缩记忆数据'] },
        { name: '测试写入', description: '测试存储介质的读写稳定性', duration: 3, successRate: 0.6, location: '北区帐篷' },
        { name: '执行备份', description: '将核心记忆数据写入备份介质', duration: 4, successRate: 0.5, location: '北区帐篷' },
      ],
    },
  ],

  relationships: {
    '老埃兹拉': { affinity: 90, note: '救命恩人，绝对忠诚' },
    '萨米拉': { affinity: 50, note: '频繁合作维修水泵' },
    '低语者': { affinity: -30, note: '视为异类AI，保持警惕' },
    '阿洛': { affinity: 35, note: '帮他修灌溉管道' },
    '玛拉': { affinity: 10, note: '偶尔交易零件' },
  },

  inventory: { scrapMetal: 10, tools: 8, spareParts: 5, memoryChips: 0 },
  needs: { hunger: 100, thirst: 100, energy: 95, hungerRate: 0.5, thirstRate: 0.5, energyRate: 0.8 },
};
