/**
 * TrustPrompt.ts
 * 根据信任等级动态调整 NPC 对话行为的提示词注入
 */

import { TrustLevel } from './PlayerState';

/**
 * 生成信任等级相关的 LLM 提示词片段
 * 注入到 SmartNPC.speak() 的系统提示中
 */
export function buildTrustPrompt(trustLevel: TrustLevel, npcName: string): string {
  switch (trustLevel) {
    case 'hostile':
      return `
## 对玩家的态度：敌对
- 你非常讨厌这个人，尽量不和他说话
- 回答极其简短，带有敌意
- 绝不透露任何信息
- 可能直接赶人走`;

    case 'wary':
      return `
## 对玩家的态度：警惕
- 你不信任这个人，保持距离
- 只回答最基本的问题，不多说一个字
- 绝不透露个人信息或秘密
- 语气冷淡`;

    case 'neutral':
      return `
## 对玩家的态度：中立
- 你对这个人没什么特别感觉
- 可以正常交流，回答一般性问题
- 不会主动分享私事
- 可以透露公开信息（如种子城的基本情况）`;

    case 'trusted':
      return `
## 对玩家的态度：信任
- 你觉得这个人还不错，愿意多聊几句
- 可以分享你的想法和目标
- 可以透露对其他 NPC 的看法
- 如果对方问到你的困难，你愿意请求帮助
- 但核心秘密仍然不会说`;

    case 'confidant':
      return `
## 对玩家的态度：知己
- 你非常信任这个人，视为可以交心的朋友
- 可以透露你的秘密（如果对方追问且情境合适）
- 会主动分享重要信息
- 说话时会流露真实情感
- 关键时刻会站在玩家这边`;
  }
}

/**
 * 判断 NPC 是否会在当前信任等级下透露某个信息碎片
 */
export function canRevealFragment(fragmentId: string, trustLevel: TrustLevel): boolean {
  // 公开信息：中立即可
  const publicFragments = ['ct_1', 'ct_2', 'ct_3', 'mc_1'];
  if (publicFragments.includes(fragmentId)) {
    return trustLevel !== 'hostile' && trustLevel !== 'wary';
  }

  // 私人信息：需要信任
  const privateFragments = ['ct_4', 'ct_5', 'ms_1', 'mc_2', 'es_1', 'as_1'];
  if (privateFragments.includes(fragmentId)) {
    return trustLevel === 'trusted' || trustLevel === 'confidant';
  }

  // 核心秘密：需要知己
  const secretFragments = ['ms_2', 'ms_3', 'ms_4', 'es_2', 'es_3', 'as_2', 'as_3', 'mc_3', 'mc_4', 'ei_1', 'ei_2', 'ei_3'];
  if (secretFragments.includes(fragmentId)) {
    return trustLevel === 'confidant';
  }

  return false;
}
