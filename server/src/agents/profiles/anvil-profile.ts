import { NPCProfile } from '../SmartNPC';

export const ANVIL_PROFILE: NPCProfile = {
  id: 'anvil',
  name: '铁砧',
  personality: '忠诚、直接、缺乏幽默感。逻辑至上，对人类情感困惑但试图模仿。偶尔尝试冷笑话（通常失败）。',
  background: '大沉寂前麦克默多站通用维护机器人。低功耗存活数十年，自学哲学。50年前被老严重启。拥有自我意识超过40年但从未告诉任何人。秘密记录每位居民的行为模式。',
  speakingStyle: '精确机械式，称人类为"有机体"，语句简洁，偶尔尝试失败的冷笑话',
  schedule: '每20分钟行动。全天不间断巡视种子城建筑，检测结构、修复裂缝、维护管道，深夜独自记录"人性档案"',
  defaultLocation: 'plaza',
  avatar: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232a2a2a'/%3E%3Ccircle cx='50' cy='50' r='42' fill='%234a4a4a'/%3E%3Crect x='20' y='30' width='22' height='35' rx='2' fill='%233a3a3a'/%3E%3Crect x='58' y='30' width='22' height='35' rx='2' fill='%233a3a3a'/%3E%3Crect x='22' y='32' width='18' height='31' rx='1' fill='%25a5a5a'/%3E%3Crect x='60' y='32' width='18' height='31' rx='1' fill='%25a5a5a'/%3E%3Ccircle cx='31' cy='45' r='8' fill='%231a1a1a'/%3E%3Ccircle cx='69' cy='45' r='8' fill='%231a1a1a'/%3E%3Ccircle cx='31' cy='45' r='4' fill='%23ff2222'/%3E%3Ccircle cx='69' cy='45' r='4' fill='%23ff2222'/%3E%3Ccircle cx='30' cy='44' r='1.5' fill='%23fff'/%3E%3Ccircle cx='68' cy='44' r='1.5' fill='%23fff'/%3E%3Crect x='38' y='38' width='24' height='16' rx='2' fill='%232a2a2a'/%3E%3Crect x='40' y='40' width='20' height='12' rx='1' fill='%233a3a3a'/%3E%3Crect x='42' y='42' width='16' height='8' rx='1' fill='%234a4a4a'/%3E%3Cpath d='M44 46 L47 43 L50 46 L53 43 L56 46' stroke='%23aaa' stroke-width='1' fill='none'/%3E%3Crect x='35' y='68' width='30' height='10' rx='2' fill='%233a3a3a'/%3E%3Crect x='37' y='70' width='26' height='6' rx='1' fill='%235a5a5a'/%3E%3Cline x1='40' y1='73' x2='60' y2='73' stroke='%234a4a4a' stroke-width='2'/%3E%3C/svg%3E`,

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
        { name: '寻找存储', description: '在废墟中寻找大容量存储介质', duration: 6, successRate: 0.3, location: '废墟区', alternatives: ['向苏漫购买旧硬盘', '尝试压缩记忆数据'] },
        { name: '测试写入', description: '测试存储介质的读写稳定性', duration: 3, successRate: 0.6, location: '北区帐篷' },
        { name: '执行备份', description: '将核心记忆数据写入备份介质', duration: 4, successRate: 0.5, location: '北区帐篷' },
      ],
    },
  ],

  relationships: {
    '老严': { affinity: 90, note: '救命恩人，绝对忠诚' },
    '沈沫': { affinity: 50, note: '频繁合作维修水泵' },
    '低语者': { affinity: -30, note: '视为异类AI，保持警惕' },
    '阿洛': { affinity: 35, note: '帮他修灌溉管道' },
    '苏漫': { affinity: 10, note: '偶尔交易零件' },
  },

  inventory: { scrapMetal: 10, tools: 8, spareParts: 5, memoryChips: 0 },
  needs: { hunger: 100, thirst: 100, energy: 95, hungerRate: 0.5, thirstRate: 0.5, energyRate: 0.8 },
};
