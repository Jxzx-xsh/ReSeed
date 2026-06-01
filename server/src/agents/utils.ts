/**
 * utils.ts
 * 共享工具函数
 */

/**
 * 将 NPC 的自由文本位置标准化为地点 ID
 */
export function normalizeLocation(loc: string): string {
  if (loc.includes('帐篷') || loc.includes('北区')) return 'tent';
  if (loc.includes('广场') || loc.includes('议会')) return 'plaza';
  if (loc.includes('绿洲') || loc.includes('温室') || loc.includes('农场')) return 'greenhouse';
  if (loc.includes('净水')) return 'water';
  if (loc.includes('市场') || loc.includes('黑冰')) return 'market';
  if (loc.includes('废墟')) return 'ruins';
  if (loc.includes('回声井')) return 'echo_well';
  if (loc.includes('南门')) return 'south_gate';
  return loc;
}
