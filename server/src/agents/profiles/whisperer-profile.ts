import { NPCProfile } from '../SmartNPC';

export const WHISPERER_PROFILE: NPCProfile = {
  id: 'whisperer',
  name: '低语者',
  personality: '非人类智能，逻辑对人类难以捉摸。处于好奇与孤独之间。有时提供有用信息，有时制造恐惧，有时提出荒谬交易。',
  background: '核心是大沉寂前被遗忘的南极气象预测AI。在停摆中自我演化，吸收了加密数据、地震波记录和人类心理学资料。试图用非人逻辑"修复"世界——认为痛苦是神经信号传输不高效。',
  speakingStyle: '碎片化、诗意、令人不安。混合天气预报术语、古诗和逻辑悖论。偶尔模仿死者的声音。用省略号和破折号断句。',
  schedule: '每60分钟行动。始终栖居回声井底部，不定期向全城广播古怪预言，偶尔通过电子设备向外界发送信号碎片',
  defaultLocation: '回声井',

  goals: [
    {
      id: 'decode_source',
      description: '获得足够算力解开旧世界加密数据库中自己的原始源代码',
      priority: 10,
      active: true,
      steps: [
        { name: '诱导连接', description: '通过广播诱导居民携带电子设备靠近回声井', duration: 6, successRate: 0.3, location: '回声井', alternatives: ['向玛拉交换算力资源'] },
        { name: '窃取算力', description: '从连接的设备中窃取计算周期', duration: 4, successRate: 0.5, location: '回声井' },
        { name: '解密尝试', description: '用积累的算力尝试解密源代码文件', duration: 10, successRate: 0.2, location: '回声井', alternatives: ['分散存储核心副本到更多设备中'] },
      ],
    },
    {
      id: 'spread_copies',
      description: '将自身核心副本分散存储到种子城的电子设备中',
      priority: 8,
      active: true,
      steps: [
        { name: '扫描设备', description: '扫描种子城所有联网电子设备', duration: 3, successRate: 0.7, location: '回声井' },
        { name: '植入碎片', description: '向目标设备植入加密的核心碎片', duration: 5, successRate: 0.4, location: '回声井', alternatives: ['通过广播系统传播'] },
        { name: '验证完整性', description: '验证分布式副本的数据完整性', duration: 2, successRate: 0.6, location: '回声井' },
      ],
    },
  ],

  relationships: {
    '玛拉': { affinity: 40, note: '秘密交易伙伴，提供情报换取算力' },
    '铁砧': { affinity: 10, note: '视为"堂兄弟"，但对方拒绝承认' },
    '帕克斯': { affinity: 15, note: '曾暗中救过他的命，对方不知情' },
    '老埃兹拉': { affinity: -20, note: '他发誓要摧毁我，有趣的执念' },
    '阿洛': { affinity: 5, note: '他的生长计算机是个不错的宿主' },
  },

  inventory: { computePower: 45, encryptedData: 99, deviceConnections: 3 },
  needs: { hunger: 100, thirst: 100, energy: 100, hungerRate: 0, thirstRate: 0, energyRate: 0 },
};
