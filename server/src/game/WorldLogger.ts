/**
 * WorldLogger.ts
 * 世界日志持久化 —— 按游戏日分文件保存所有 NPC 行为和事件
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WorldLogEntry {
  timestamp: string;      // 游戏时间 "Day3 14:00"
  realTime: string;       // 真实时间 ISO
  type: 'action' | 'encounter' | 'dialogue' | 'event' | 'system' | 'quest';
  source: string;         // NPC 名字 / "系统" / "玩家"
  location?: string;
  message: string;
  metadata?: Record<string, any>;
}

export class WorldLogger {
  private logDir: string;
  private currentDay: number = 0;
  private buffer: WorldLogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(logDir?: string) {
    this.logDir = logDir ?? path.join(__dirname, '..', '..', 'data', 'world-logs');

    // 确保目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 每 10 秒刷新缓冲区到磁盘
    this.flushTimer = setInterval(() => this.flush(), 10000);
  }

  /**
   * 记录一条日志
   */
  log(day: number, entry: Omit<WorldLogEntry, 'realTime'>): void {
    this.currentDay = day;
    this.buffer.push({
      ...entry,
      realTime: new Date().toISOString(),
    });
  }

  /**
   * 记录 NPC 行为
   */
  logAction(day: number, time: string, npcName: string, location: string, message: string): void {
    this.log(day, {
      timestamp: time,
      type: 'action',
      source: npcName,
      location,
      message,
    });
  }

  /**
   * 记录 NPC 相遇对话
   */
  logEncounter(day: number, time: string, location: string, participants: string[], dialogues: { speaker: string; dialogue: string }[]): void {
    const dialogueText = dialogues.map(d => `${d.speaker}: "${d.dialogue}"`).join('\n    ');
    this.log(day, {
      timestamp: time,
      type: 'encounter',
      source: participants.join('、'),
      location,
      message: `相遇对话:\n    ${dialogueText}`,
      metadata: { participants, dialogues },
    });
  }

  /**
   * 记录玩家与 NPC 对话
   */
  logDialogue(day: number, time: string, npcName: string, playerMessage: string, npcReply: string): void {
    this.log(day, {
      timestamp: time,
      type: 'dialogue',
      source: npcName,
      message: `玩家: "${playerMessage}" → ${npcName}: "${npcReply}"`,
    });
  }

  /**
   * 记录游戏事件
   */
  logEvent(day: number, time: string, eventName: string, message: string): void {
    this.log(day, {
      timestamp: time,
      type: 'event',
      source: '事件',
      message: `[${eventName}] ${message}`,
    });
  }

  /**
   * 记录任务变化
   */
  logQuest(day: number, time: string, action: string, questName: string, detail?: string): void {
    this.log(day, {
      timestamp: time,
      type: 'quest',
      source: '任务',
      message: `${action}: ${questName}${detail ? ' — ' + detail : ''}`,
    });
  }

  /**
   * 记录系统消息
   */
  logSystem(day: number, message: string): void {
    this.log(day, {
      timestamp: `Day${day}`,
      type: 'system',
      source: '系统',
      message,
    });
  }

  /**
   * 刷新缓冲区到磁盘
   */
  flush(): void {
    if (this.buffer.length === 0) return;

    // 按天分组
    const byDay: Record<number, WorldLogEntry[]> = {};
    for (const entry of this.buffer) {
      const day = this.extractDay(entry.timestamp);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(entry);
    }

    // 写入各天的文件
    for (const [day, entries] of Object.entries(byDay)) {
      const filePath = path.join(this.logDir, `day-${String(day).padStart(3, '0')}.log`);
      const lines = entries.map(e => this.formatEntry(e)).join('\n') + '\n';

      fs.appendFileSync(filePath, lines, 'utf-8');
    }

    this.buffer = [];
  }

  /**
   * 读取某天的日志
   */
  readDay(day: number): string | null {
    const filePath = path.join(this.logDir, `day-${String(day).padStart(3, '0')}.log`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 获取所有已记录的天数
   */
  getLoggedDays(): number[] {
    if (!fs.existsSync(this.logDir)) return [];
    const files = fs.readdirSync(this.logDir).filter(f => f.startsWith('day-') && f.endsWith('.log'));
    return files.map(f => parseInt(f.replace('day-', '').replace('.log', ''), 10)).sort((a, b) => a - b);
  }

  /**
   * 关闭（刷新并停止定时器）
   */
  close(): void {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private extractDay(timestamp: string): number {
    const match = timestamp.match(/Day(\d+)/);
    return match ? parseInt(match[1], 10) : this.currentDay;
  }

  private formatEntry(entry: WorldLogEntry): string {
    const typeIcon: Record<string, string> = {
      action: '🔧',
      encounter: '🎭',
      dialogue: '💬',
      event: '⚡',
      system: '⚙️',
      quest: '📋',
    };

    const icon = typeIcon[entry.type] || '•';
    const loc = entry.location ? ` [${entry.location}]` : '';
    return `[${entry.timestamp}] ${icon} ${entry.source}${loc}: ${entry.message}  (${entry.realTime})`;
  }
}
