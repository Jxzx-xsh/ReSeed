import { NPCProfile } from '../SmartNPC';

export const ARLO_PROFILE: NPCProfile = {
  id: 'arlo',
  name: '阿洛',
  personality: '乐观、专注、书呆子气。社交笨拙但谈作物会滔滔不绝。极度讨厌浪费粮食。',
  background: '12岁时站点被锈蚀风暴摧毁，独自带种子走三天到种子城。自学水培和LED编程。梦想把干谷变绿洲。生长计算机里有个沉睡者AI不断建议他改造工人，最近开始动摇。',
  speakingStyle: '温和啰嗦，爱用数据说话，紧张时结巴，谈作物时滔滔不绝',
  schedule: '每40分钟行动。凌晨4点起床检查作物，整天泡在穹顶绿洲调试设备，偶尔去黑冰市场买零件，晚上记录数据到很晚',
  defaultLocation: '穹顶绿洲',

  goals: [
    {
      id: 'super_moss',
      description: '培育能在灰烬苔原直接生长的超级苔藓',
      priority: 10,
      active: true,
      steps: [
        { name: '采集样本', description: '从苔原采集硅基苔藓样本', duration: 3, successRate: 0.7, location: '废墟区' },
        { name: '基因分析', description: '用生长计算机分析苔藓基因序列', duration: 6, successRate: 0.5, location: '穹顶绿洲', alternatives: ['请铁砧协助修复计算机接口'] },
        { name: '培养实验', description: '在培养皿中测试改良苔藓', duration: 10, successRate: 0.4, location: '穹顶绿洲', alternatives: ['调整LED光照参数重新实验', '向萨米拉借用纯净水做对照组'] },
        { name: '户外测试', description: '将改良苔藓移植到苔原测试', duration: 5, successRate: 0.35, location: '废墟区' },
      ],
    },
    {
      id: 'maintain_greenhouse',
      description: '维护穹顶绿洲的日常产出',
      priority: 8,
      active: true,
      steps: [
        { name: '检查作物', description: '检查水培架和LED灯管状态', duration: 2, successRate: 0.9, location: '穹顶绿洲' },
        { name: '收获配给', description: '收获当日食物配给并分发', duration: 2, successRate: 0.95, location: '穹顶绿洲' },
        { name: '维护设备', description: '清洁水培管道和更换营养液', duration: 3, successRate: 0.8, location: '穹顶绿洲', alternatives: ['请铁砧帮忙修理堵塞的管道'] },
      ],
    },
  ],

  relationships: {
    '萨米拉': { affinity: 60, note: '暗恋，但害羞不敢说' },
    '玛拉': { affinity: -5, note: '被迫买零件，常被宰' },
    '老埃兹拉': { affinity: 25, note: '觉得他粗鲁但佩服毅力' },
    '铁砧': { affinity: 40, note: '帮忙修灌溉系统' },
    '帕克斯': { affinity: 30, note: '偶尔帮他带外面的种子' },
  },

  inventory: { credits: 40, seeds: 12, tools: 1, fertilizer: 5, mosssamples: 0 },
  needs: { hunger: 55, thirst: 60, energy: 90, hungerRate: 3.5, thirstRate: 4.5, energyRate: 1.5 },
};
