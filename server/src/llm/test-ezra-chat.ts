/**
 * test-ezra-chat.ts
 * 老严 LLM 对话测试 —— 验证人格系统是否正常工作
 *
 * 运行: npx ts-node src/llm/test-ezra-chat.ts
 */

import { LLMClient } from './LLMClient';
import { EzraPersonality, EzraContext } from './EzraPersonality';
import * as readline from 'readline';

async function runTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  老严 LLM 对话测试                   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const llm = new LLMClient();
  const ezra = new EzraPersonality(llm);

  // 模拟上下文
  const context: EzraContext = {
    currentPlan: '修理通讯塔',
    currentStep: '收集无线电零件',
    hunger: 60,
    thirst: 50,
    energy: 70,
    playerRelationship: 0,
    recentEvents: [
      '收集零件失败了一次',
      '苏漫把零件价格涨到了150信用点',
    ],
    memories: [
      '上次锈蚀风暴差点把通讯塔吹倒',
    ],
  };

  // --- 测试 1: 初次见面 ---
  console.log('📝 测试 1: 玩家初次打招呼');
  console.log('   玩家: "你好，你是谁？"');
  try {
    const reply1 = await ezra.talk('你好，你是谁？', context);
    console.log(`   老严: "${reply1}"\n`);
  } catch (e: any) {
    console.log(`   ❌ 错误: ${e.message}\n`);
    return;
  }

  // --- 测试 2: 询问当前任务 ---
  console.log('📝 测试 2: 玩家询问在做什么');
  console.log('   玩家: "你在忙什么？需要帮忙吗？"');
  try {
    const reply2 = await ezra.talk('你在忙什么？需要帮忙吗？', context);
    console.log(`   老严: "${reply2}"\n`);
  } catch (e: any) {
    console.log(`   ❌ 错误: ${e.message}\n`);
    return;
  }

  // --- 测试 3: 提到 AI ---
  console.log('📝 测试 3: 玩家提到 AI');
  console.log('   玩家: "听说共生体能力很强，你考虑过接入AI吗？"');
  try {
    const reply3 = await ezra.talk('听说共生体能力很强，你考虑过接入AI吗？', context);
    console.log(`   老严: "${reply3}"\n`);
  } catch (e: any) {
    console.log(`   ❌ 错误: ${e.message}\n`);
    return;
  }

  // --- 测试 4: 自言自语 ---
  console.log('📝 测试 4: 内心独白');
  try {
    const monologue = await ezra.monologue(context, '零件又没找到，苏漫还涨价了');
    console.log(`   (老严内心): "${monologue}"\n`);
  } catch (e: any) {
    console.log(`   ❌ 错误: ${e.message}\n`);
    return;
  }

  // --- 测试 5: 好感度高时 ---
  console.log('📝 测试 5: 好感度高时的对话');
  const friendlyContext = { ...context, playerRelationship: 50, memories: [...(context.memories ?? []), '这个人之前帮我找到了3个零件'] };
  console.log('   玩家: "老头，今天怎么样？"');
  try {
    const reply5 = await ezra.talk('老头，今天怎么样？', friendlyContext);
    console.log(`   老严: "${reply5}"\n`);
  } catch (e: any) {
    console.log(`   ❌ 错误: ${e.message}\n`);
    return;
  }

  console.log('═══════════════════════════════════════════');
  console.log('  ✅ 所有对话测试完成');
  console.log('═══════════════════════════════════════════');
}

async function interactiveMode() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  老严 交互对话模式                    ║');
  console.log('║  输入 quit 退出                          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const llm = new LLMClient();
  const ezra = new EzraPersonality(llm);

  const context: EzraContext = {
    currentPlan: '修理通讯塔',
    currentStep: '收集无线电零件',
    hunger: 60,
    thirst: 50,
    energy: 70,
    playerRelationship: 0,
    recentEvents: ['收集零件失败了一次', '苏漫涨价了'],
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): void => {
    rl.question('\n你: ', async (input) => {
      const trimmed = input.trim();
      if (trimmed === 'quit' || trimmed === 'exit' || trimmed === '退出') {
        console.log('\n(老严转身走开，金属脚发出咔哒声)');
        rl.close();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        const reply = await ezra.talk(trimmed, context);
        console.log(`\n老严: ${reply}`);
      } catch (e: any) {
        console.log(`\n[系统错误: ${e.message}]`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// 入口
const mode = process.argv[2];
if (mode === 'chat') {
  interactiveMode();
} else {
  runTests();
}
