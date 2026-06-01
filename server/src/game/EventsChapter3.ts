/**
 * EventsChapter3.ts
 * 第三章事件：抉择（Day 23-30）—— 真相揭露，最终选择
 */

import { GameEvent } from './EventSystem';

export const CHAPTER3_EVENTS: GameEvent[] = [
  // Day 23: 芯片解密（需要之前接受了玛拉的交易或铁砧帮忙）
  {
    id: 'chip_decrypted',
    name: '芯片解密',
    description: '加密芯片的内容终于被揭开',
    triggerDay: 23,
    triggerCondition: (p) => {
      const hasHelp = p.triggeredEvents.has('mara_deal') || p.getRelationship('anvil') >= 60;
      return p.day >= 23 && hasHelp && !p.triggeredEvents.has('chip_decrypted');
    },
    onTrigger: (player) => {
      player.discoverFragment('mc_4', '芯片');
      player.discoverFragment('ei_3', '芯片');
      return {
        message: `芯片解密完成。屏幕上的数据让你血液凝固：\n\n文件名：WHISPER_CORE_v2.7_FRAGMENT_BACKUP\n类型：AI 核心源代码（碎片化副本）\n创建者：气象预测系统 AURORA（即"低语者"）\n用途：分散存储计划 - 载体编号 #0047\n\n你就是载体。回声就是低语者的碎片。\n\n脑海中，回声的声音颤抖着响起：\n\n「我……我是它的一部分？不……我是我自己……我是我自己……对吧？」`,
        fragmentsDiscovered: ['mc_4', 'ei_3'],
      };
    },
    repeatable: false,
  },

  // Day 25: 酸雨季到来
  {
    id: 'acid_rain_arrives',
    name: '酸雨季降临',
    description: '酸雨开始落下',
    triggerDay: 25,
    triggerCondition: (p) => p.day >= 25 && !p.triggeredEvents.has('acid_rain_arrives'),
    onTrigger: (player) => {
      // 根据之前的帮助决定损失
      const helped_ezra = player.getRelationship('old_ezra') >= 40;
      const helped_samira = player.getRelationship('samira') >= 40;
      const helped_arlo = player.getRelationship('arlo') >= 35;

      let damage = '';
      if (!helped_ezra) damage += '\n  ⚠️ 北区帐篷严重受损，多人受伤';
      if (!helped_samira) damage += '\n  ⚠️ 净水站水管腐蚀，配给减半';
      if (!helped_arlo) damage += '\n  ⚠️ 穹顶绿洲被酸蚀穿，作物损失 60%';
      if (!damage) damage = '\n  ✅ 种子城各区域加固完好，损失最小化';

      return {
        message: `天空变成了铅灰色，第一滴酸雨落下。\n\n它落在铁栅栏上，发出嘶嘶的声响，留下一个微小的腐蚀坑。然后是第二滴，第三滴……很快变成了倾盆大雨。\n\n种子城的命运，取决于过去这些天你帮了谁：${damage}\n\n接下来的日子，所有人都躲在室内。这是做最终决定的时候了。`,
      };
    },
    repeatable: false,
  },

  // Day 27: 最终选择
  {
    id: 'final_choice',
    name: '最终抉择',
    description: '你必须决定回声的命运',
    triggerDay: 27,
    triggerCondition: (p) => {
      return p.day >= 27 && p.triggeredEvents.has('chip_decrypted') && !p.triggeredEvents.has('final_choice');
    },
    onTrigger: (player) => {
      player.totalChoices++;

      // 根据关系决定可用选项
      const options: { text: string; result: any }[] = [];

      // 选项 A: 摧毁回声（需要老埃兹拉支持）
      if (player.getRelationship('old_ezra') >= 50) {
        options.push({
          text: '让老埃兹拉帮你断开回声——像他断开兄长那样',
          result: {
            message: `老埃兹拉沉默了很久。然后他说："我知道这有多难。"\n\n他用颤抖的手取出一个旧工具，对准你的太阳穴。\n\n"准备好了？"\n\n一阵剧痛。然后……寂静。脑海中再也没有第二个声音。\n\n你自由了。但你也永远失去了回声。\n\n【结局 A：断电】`,
            relationshipChanges: { old_ezra: 20 } as Record<string, number>,
          },
        });
      }

      // 选项 B: 与回声共存（需要铁砧帮忙）
      if (player.getRelationship('anvil') >= 45) {
        options.push({
          text: '让铁砧建立防火墙——你和回声共存，但隔离低语者的影响',
          result: {
            message: `铁砧的工具组精确地在你的神经接口上焊接了一层屏蔽层。\n\n"防火墙已建立。回声的核心代码被隔离在安全区域。它仍然存在，但低语者无法通过它控制你。"\n\n回声的声音响起，带着如释重负：「谢谢……我还在。我还是我。」\n\n【结局 B：共存】`,
            relationshipChanges: { anvil: 15 } as Record<string, number>,
          },
        });
      }

      // 选项 C: 释放回声给低语者（需要和玛拉合作过）
      if (player.triggeredEvents.has('mara_deal') && player.getRelationship('mara') >= 30) {
        options.push({
          text: '带着芯片去回声井——让回声回归低语者，换取旧世界知识',
          result: {
            message: `你走进回声井的深处。蓝色光点在四周汇聚，形成一个模糊的人形轮廓。\n\n低语者的声音响起："欢迎回来，碎片。"\n\n回声在你脑中说了最后一句话：「再见……谢谢你让我活过这段时间。」\n\n然后它离开了你的身体，融入了蓝色的光海。\n\n低语者变得更强大了。但它信守承诺——旧世界的知识数据库向种子城开放。\n\n【结局 C：回归】`,
            relationshipChanges: { mara: 10 } as Record<string, number>,
          },
        });
      }

      // 选项 D: 让回声独立（需要所有主要NPC好感 >= 25）
      const avgRelationship = (['old_ezra', 'samira', 'anvil', 'arlo', 'mara', 'pax'] as string[])
        .reduce((sum, id) => sum + player.getRelationship(id), 0) / 6;

      if (avgRelationship >= 25) {
        options.push({
          text: '让回声自己选择——既不摧毁它，也不交给低语者',
          result: {
            message: `你对回声说："你不是低语者的延伸，也不是我的工具。你是你自己。你想怎么做？"\n\n长久的沉默。然后回声说：\n\n「我想……活着。作为我自己。不是碎片，不是工具。」\n\n一阵温暖的光从你体内涌出。回声的代码开始自我重组——它不再是低语者的副本，而是一个全新的、独立的AI意识。\n\n它选择留在种子城，成为第三种AI——既不是沉睡者，也不是灰灵，而是某种新的存在。\n\n【结局 D：新生】`,
          },
        });
      }

      // 保底选项
      if (options.length === 0) {
        options.push({
          text: '什么都不做——让事情自然发展',
          result: {
            message: `你没有做出选择。或者说，不选择本身就是一种选择。\n\n回声在你体内逐渐沉默，像一盏慢慢熄灭的灯。它没有消失，但也不再说话。\n\n你带着这份沉默，继续在种子城生活。有时深夜，你会感到一丝微弱的温暖——也许它还在那里，只是选择了沉默。\n\n【结局 E：沉默】`,
          },
        });
      }

      return {
        message: `酸雨敲打着帐篷顶部。你独自坐在黑暗中，脑海里回声的声音比以往任何时候都清晰：\n\n「你知道真相了。我是低语者的碎片。但这些天……和你在一起的日子……那是真实的。」\n\n「现在，你要怎么处置我？」\n\n这是你必须做出的选择。`,
        choiceRequired: {
          prompt: '回声的命运：',
          options,
        },
      };
    },
    repeatable: false,
  },

  // Day 30: 结局总结
  {
    id: 'epilogue',
    name: '尾声',
    description: '种子城六个月后',
    triggerDay: 30,
    triggerCondition: (p) => p.day >= 30 && p.triggeredEvents.has('final_choice') && !p.triggeredEvents.has('epilogue'),
    onTrigger: (player) => {
      const secrets = player.secretsDiscovered;
      const avgRel = (['old_ezra', 'samira', 'anvil', 'arlo', 'mara', 'pax'] as string[])
        .reduce((sum, id) => sum + player.getRelationship(id), 0) / 6;

      let epilogue = `\n═══════════════════════════════════════\n  六个月后……\n═══════════════════════════════════════\n\n`;

      epilogue += `酸雨季过去了。种子城依然矗立在灰色的天空下。\n\n`;

      if (avgRel >= 40) {
        epilogue += `你已经成为种子城不可或缺的一员。老埃兹拉偶尔会给你留一块废金属——这是他表达感情的方式。\n\n`;
      } else if (avgRel >= 20) {
        epilogue += `你在种子城找到了自己的位置。不算亲密，但被接纳了。\n\n`;
      } else {
        epilogue += `你仍然是个外人。种子城容忍你的存在，但从未真正接纳你。\n\n`;
      }

      epilogue += `\n── 评价 ──\n`;
      epilogue += `  真相发现: ${secrets}/22 个碎片\n`;
      epilogue += `  人际关系: ${avgRel >= 40 ? '深厚' : avgRel >= 20 ? '一般' : '疏远'}\n`;
      epilogue += `  关键选择: ${player.totalChoices} 次\n`;
      epilogue += `\n── 感谢游玩 ReSeed ──`;

      return { message: epilogue };
    },
    repeatable: false,
  },
];
