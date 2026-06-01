/**
 * GameServer.ts
 * WebSocket 游戏服务器 —— 连接前端与 SmartNPC 系统
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { SmartNPC } from '../agents/SmartNPC';
import { ALL_PROFILES } from '../agents/profiles';
import { WorldState } from '../agents/WorldState';
import { SocialEngine } from '../agents/SocialEngine';
import { LLMClient } from '../llm/LLMClient';
import { PlayerState, getTrustLevelCN } from '../game/PlayerState';
import { EventSystem } from '../game/EventSystem';
import { EchoCompanion } from '../game/EchoCompanion';

const PORT = 3000;
const CLIENT_DIR = path.join(__dirname, '..', '..', '..', 'client', 'web');

// ============================================================
// 地点数据
// ============================================================

const LOCATIONS = [
  { id: 'tent', name: '北区帐篷', desc: '居住区，老埃兹拉和帕克斯住这里' },
  { id: 'plaza', name: '中心广场', desc: '种子城核心，锈蚀议会所在地' },
  { id: 'greenhouse', name: '穹顶绿洲', desc: '阿洛的温室农场' },
  { id: 'water', name: '净水站', desc: '萨米拉管理的水处理设施' },
  { id: 'market', name: '黑冰市场', desc: '玛拉的地下交易所' },
  { id: 'echo_well', name: '回声井', desc: '低语者栖居的深井，危险' },
  { id: 'ruins', name: '废墟区', desc: '锈蚀废墟，有资源也有危险' },
  { id: 'south_gate', name: '南门', desc: '种子城唯一出入口' },
];

// ============================================================
// 游戏服务器
// ============================================================

export class GameServer {
  private wss: WebSocketServer;
  private httpServer: http.Server;
  private world: WorldState;
  private npcs: SmartNPC[];
  private social: SocialEngine;
  private llmWorld: LLMClient;   // 世界运行用（qwen3-4b，快速）
  private llmChat: LLMClient;    // 对话用（gemma-3-4b，质量高）
  private player: PlayerState;
  private events: EventSystem;
  private tick: number = 0;
  private observeTimer: ReturnType<typeof setInterval> | null = null;
  private echo: EchoCompanion;
  private worldTimer: ReturnType<typeof setInterval> | null = null;
  private connectedClients: Set<WebSocket> = new Set();
  private worldPaused: boolean = false;
  private lockedNpcId: string | null = null;
  private chatHistory: Record<string, { speaker: string; text: string }[]> = {}; // npcId → 对话记录

  constructor() {
    // 两个 LLM 实例：世界运行（快速）vs 对话（质量高）
    this.llmWorld = new LLMClient({ model: process.env.LLM_MODEL_WORLD || 'qwen/qwen3-4b-2507', maxTokens: 256 });
    this.llmChat = new LLMClient({ model: process.env.LLM_MODEL_CHAT || 'google/gemma-3-4b', maxTokens: 512 });

    this.world = new WorldState();
    this.social = new SocialEngine(this.llmWorld);
    this.npcs = ALL_PROFILES.map(p => new SmartNPC(p, this.world, this.llmWorld));
    this.player = new PlayerState();
    this.events = new EventSystem();
    this.echo = new EchoCompanion(this.llmChat);

    // 尝试加载存档
    this.loadGame();

    // HTTP 服务（提供静态文件）
    this.httpServer = http.createServer((req, res) => {
      this.serveStatic(req, res);
    });

    // WebSocket
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on('connection', (ws) => this.onConnection(ws));
  }

  start(): void {
    this.httpServer.listen(PORT, () => {
      console.log(`🌍 种子城服务器启动: http://localhost:${PORT}`);
      console.log(`⏱️  世界运行中（1秒=1分钟 | 1分钟=1小时 | 26分钟=1天 | 13小时=1季）`);
    });

    // 世界持续运行：每 10 秒 = 10 游戏分钟
    // 1分钟=1小时 | 26分钟=1天 | 13小时=1季
    this.worldTimer = setInterval(async () => {
      if (!this.worldPaused) {
        await this.worldTick();
      }
    }, 10000);
  }

  // ============================================================
  // 静态文件服务
  // ============================================================

  private serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
    let filePath = path.join(CLIENT_DIR, req.url === '/' ? 'index.html' : req.url!);

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };

    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  // ============================================================
  // WebSocket 处理
  // ============================================================

  private onConnection(ws: WebSocket): void {
    console.log('👤 玩家连接');
    this.connectedClients.add(ws);

    // 发送初始状态
    this.send(ws, 'init', this.getFullState());

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await this.handleMessage(ws, msg);
      } catch (e: any) {
        this.send(ws, 'error', { message: e.message });
      }
    });

    ws.on('close', () => {
      console.log('👤 玩家断开');
      this.connectedClients.delete(ws);
      if (this.observeTimer) {
        clearInterval(this.observeTimer);
        this.observeTimer = null;
      }
    });
  }

  private async handleMessage(ws: WebSocket, msg: any): Promise<void> {
    switch (msg.type) {
      case 'move':
        await this.handleMove(ws, msg.locationId);
        break;
      case 'talk':
        await this.handleTalk(ws, msg.npcId, msg.message);
        break;
      case 'endTalk':
        this.lockedNpcId = null;
        break;
      case 'getChatHistory':
        this.send(ws, 'chatHistory', {
          npcId: msg.npcId,
          history: this.chatHistory[msg.npcId] ?? [],
        });
        break;
      case 'collect':
        this.handleCollect(ws);
        break;
      case 'observe':
        await this.handleObserve(ws, msg.ticks ?? 10);
        break;
      case 'observeLive':
        this.handleObserveLive(ws, msg.speed ?? 3000);
        break;
      case 'observeStop':
        this.handleObserveStop(ws);
        break;
      case 'echo':
        await this.handleEcho(ws, msg.message);
        break;
      case 'getState':
        this.send(ws, 'state', this.getFullState());
        break;
    }
  }

  // ============================================================
  // 动作处理
  // ============================================================

  private async handleMove(ws: WebSocket, locationId: string): Promise<void> {
    const loc = LOCATIONS.find(l => l.id === locationId);
    if (!loc) {
      this.send(ws, 'error', { message: '未知地点' });
      return;
    }

    this.player.location = locationId;

    // 检查事件
    const event = this.events.checkEvents(this.player, this.npcs);

    this.send(ws, 'moved', {
      state: this.getFullState(),
      event: event ?? undefined,
    });
  }

  private async handleTalk(ws: WebSocket, npcId: string, message: string): Promise<void> {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) {
      this.send(ws, 'error', { message: '找不到该 NPC' });
      return;
    }

    const actualMessage = message.replace('__continue__', '');

    // 锁定 NPC 位置（不暂停世界，因为用不同的 LLM）
    this.lockedNpcId = npcId;

    try {
      // 用对话专用 LLM
      const reply = await npc.speakWith(actualMessage, this.player.name, this.llmChat);
      this.player.changeRelationship(npcId, 2);

      // 保存对话记录
      if (!this.chatHistory[npcId]) this.chatHistory[npcId] = [];
      this.chatHistory[npcId].push({ speaker: '你', text: actualMessage });
      this.chatHistory[npcId].push({ speaker: npc.name, text: reply });
      // 限制每个 NPC 最多保留 50 条
      if (this.chatHistory[npcId].length > 50) {
        this.chatHistory[npcId] = this.chatHistory[npcId].slice(-50);
      }

      this.send(ws, 'npcReply', {
        npcId,
        npcName: npc.name,
        reply,
        trustLevel: getTrustLevelCN(this.player.getTrustLevel(npcId)),
        state: this.getFullState(),
      });
    } catch {
      this.send(ws, 'npcReply', {
        npcId,
        npcName: npc.name,
        reply: '……',
        trustLevel: getTrustLevelCN(this.player.getTrustLevel(npcId)),
        state: this.getFullState(),
      });
    }
  }

  private handleCollect(ws: WebSocket): void {
    const rationKey = `ration_day_${this.player.day}`;
    if (this.player.triggeredEvents.has(rationKey)) {
      this.send(ws, 'message', { text: '今天已经领过配给了', type: 'info' });
      return;
    }

    const loc = this.player.location;
    if (loc === 'water') {
      this.player.triggeredEvents.add(rationKey);
      this.player.inventory['净水'] = (this.player.inventory['净水'] ?? 0) + 2;
      this.send(ws, 'message', { text: '萨米拉递给你水壶："2升，别洒了。"', type: 'success' });
    } else if (loc === 'greenhouse') {
      this.player.triggeredEvents.add(rationKey);
      this.player.inventory['干粮'] = (this.player.inventory['干粮'] ?? 0) + 1;
      this.send(ws, 'message', { text: '阿洛递给你螺旋藻饼："蛋白质含量不错的。"', type: 'success' });
    } else {
      this.send(ws, 'message', { text: '需要去净水站或穹顶绿洲领取', type: 'info' });
      return;
    }

    // 领取后发送更新状态 + 隐藏按钮信号
    this.send(ws, 'collected', { state: this.getFullState() });
  }

  /**
   * 观察模式：快速推进 N 个 tick，实时推送 NPC 行为
   */
  private async handleObserve(ws: WebSocket, ticks: number): Promise<void> {
    this.send(ws, 'message', { text: `⏩ 观察模式：快进 ${ticks} 小时...`, type: 'info' });

    for (let i = 0; i < ticks; i++) {
      this.tick++;
      this.world.advanceHour();
      const timeStr = `Day${this.world.currentDay} ${String(this.world.currentHour).padStart(2, '0')}:00`;

      // 记录每个 NPC update 前的日志长度和版本
      const logSnapshots = this.npcs.map(n => ({ len: n.getLog().length, ver: n.getLogVersion() }));

      // NPC 行动
      for (const npc of this.npcs) {
        await npc.update(1);
      }

      // 收集新产生的日志（处理压缩导致的长度变化）
      const tickLogs: any[] = [];
      for (let j = 0; j < this.npcs.length; j++) {
        const npc = this.npcs[j];
        const currentLog = npc.getLog();
        const snap = logSnapshots[j];

        // 如果版本变了说明发生了压缩，取最后几条
        if (npc.getLogVersion() !== snap.ver) {
          const newEntries = currentLog.slice(-5);
          for (const entry of newEntries) {
            tickLogs.push({ time: timeStr, npc: npc.name, location: npc.location, type: entry.type, message: entry.message });
          }
        } else {
          const newEntries = currentLog.slice(snap.len);
          for (const entry of newEntries) {
            tickLogs.push({ time: timeStr, npc: npc.name, location: npc.location, type: entry.type, message: entry.message });
          }
        }
      }

      // 推送世界日志
      if (tickLogs.length > 0) {
        this.send(ws, 'worldLog', { time: timeStr, entries: tickLogs });
      }

      // 社交引擎
      const encounters = await this.social.processEncounters(this.npcs, this.tick);
      for (const enc of encounters) {
        this.send(ws, 'encounter', {
          time: timeStr,
          location: enc.location,
          participants: enc.participants.map(n => n.name),
          dialogues: enc.dialogues,
        });
      }
    }

    // 同步玩家天数
    const daysPassed = Math.floor(ticks / 26);
    for (let d = 0; d < daysPassed; d++) {
      this.player.newDay();
    }

    this.send(ws, 'observeEnd', { state: this.getFullState() });
  }

  /**
   * 实时观察模式（LLM 驱动）—— NPC 持续生活，可随时停止
   */
  private handleObserveLive(ws: WebSocket, speed: number): void {
    // 停掉之前的
    if (this.observeTimer) {
      clearInterval(this.observeTimer);
    }

    this.send(ws, 'message', { text: `👁️ 实时观察开始（每 ${speed / 1000} 秒 = 1 游戏小时）`, type: 'event' });
    this.send(ws, 'observeStarted', { speed });

    this.observeTimer = setInterval(async () => {
      this.tick++;
      this.world.advanceHour();
      const timeStr = `Day${this.world.currentDay} ${String(this.world.currentHour).padStart(2, '0')}:00`;

      // 记录日志快照
      const logSnapshots = this.npcs.map(n => ({ len: n.getLog().length, ver: n.getLogVersion() }));

      // NPC 行动（会调 LLM 生成思考/独白）
      for (const npc of this.npcs) {
        await npc.update(1);
      }

      // 收集新日志
      const tickLogs: any[] = [];
      for (let j = 0; j < this.npcs.length; j++) {
        const npc = this.npcs[j];
        const currentLog = npc.getLog();
        const snap = logSnapshots[j];

        if (npc.getLogVersion() !== snap.ver) {
          const newEntries = currentLog.slice(-5);
          for (const entry of newEntries) {
            tickLogs.push({ time: timeStr, npc: npc.name, location: npc.location, type: entry.type, message: entry.message });
          }
        } else {
          const newEntries = currentLog.slice(snap.len);
          for (const entry of newEntries) {
            tickLogs.push({ time: timeStr, npc: npc.name, location: npc.location, type: entry.type, message: entry.message });
          }
        }
      }

      // 推送
      if (tickLogs.length > 0) {
        this.send(ws, 'worldLog', { time: timeStr, entries: tickLogs });
      }

      // 社交引擎（LLM 对话）
      const encounters = await this.social.processEncounters(this.npcs, this.tick);
      for (const enc of encounters) {
        this.send(ws, 'encounter', {
          time: timeStr,
          location: enc.location,
          participants: enc.participants.map(n => n.name),
          dialogues: enc.dialogues,
        });
      }

      // 推送状态更新
      this.send(ws, 'state', this.getFullState());

    }, speed);
  }

  /**
   * 停止实时观察
   */
  private handleObserveStop(ws: WebSocket): void {
    if (this.observeTimer) {
      clearInterval(this.observeTimer);
      this.observeTimer = null;
    }
    this.send(ws, 'message', { text: '⏸️ 观察已暂停', type: 'info' });
    this.send(ws, 'observeStopped', { state: this.getFullState() });
  }

  private async handleEcho(ws: WebSocket, message: string): Promise<void> {
    const context = {
      location: LOCATIONS.find(l => l.id === this.player.location)?.name ?? '',
      day: this.world.currentDay,
      recentEvents: Array.from(this.player.triggeredEvents).slice(-5),
    };

    try {
      const reply = await this.echo.talk(message, context);
      this.send(ws, 'echoReply', {
        reply,
        phase: this.echo.state.phase,
        trust: this.echo.state.trust,
      });
    } catch (e: any) {
      this.send(ws, 'echoReply', {
        reply: '……（静电噪音）……',
        phase: this.echo.state.phase,
        trust: this.echo.state.trust,
      });
    }
  }

  // ============================================================
  // 世界持续运行
  // ============================================================

  /**
   * 世界 Tick —— 每 10 秒执行，NPC 按各自节奏行动
   */
  private async worldTick(): Promise<void> {
    this.tick++;
    this.world.advanceHour();

    const timeStr = this.world.getTimeStr();

    // 每个 NPC 有不同的行动频率（模拟不同节奏）
    // tick % interval === offset 时该 NPC 行动
    const npcSchedule: Record<string, { interval: number; offset: number }> = {
      old_ezra:  { interval: 3, offset: 0 },  // 每 3 tick = 36秒 ≈ 30游戏分钟
      arlo:      { interval: 4, offset: 1 },  // 每 4 tick = 48秒 ≈ 40游戏分钟
      samira:    { interval: 3, offset: 2 },  // 每 3 tick = 36秒 ≈ 30游戏分钟
      anvil:     { interval: 2, offset: 0 },  // 每 2 tick = 24秒 ≈ 20游戏分钟
      mara:      { interval: 5, offset: 3 },  // 每 5 tick = 60秒 ≈ 50游戏分钟
      pax:       { interval: 4, offset: 2 },  // 每 4 tick = 48秒 ≈ 40游戏分钟
      whisperer: { interval: 6, offset: 5 },  // 每 6 tick = 72秒 ≈ 60游戏分钟
    };

    // 逐个检查哪些 NPC 该行动了
    for (const npc of this.npcs) {
      if (npc.id === this.lockedNpcId) continue;

      const schedule = npcSchedule[npc.id] ?? { interval: 3, offset: 0 };
      if (this.tick % schedule.interval !== schedule.offset) continue;

      const logBefore = npc.getLog().length;
      const verBefore = npc.getLogVersion();

      await npc.update(1);

      // 收集新日志并推送
      const currentLog = npc.getLog();
      let newEntries;
      if (npc.getLogVersion() !== verBefore) {
        newEntries = currentLog.slice(-3);
      } else {
        newEntries = currentLog.slice(logBefore);
      }

      if (newEntries.length > 0) {
        const entries = newEntries.map(entry => ({
          time: timeStr,
          npc: npc.name,
          location: npc.location,
          type: entry.type,
          message: entry.message,
        }));
        this.broadcast('worldLog', { time: timeStr, entries });
      }
    }

    // 社交引擎（每 3 tick 检查一次）
    if (this.tick % 3 === 0) {
      const encounters = await this.social.processEncounters(this.npcs, this.tick);
      for (const enc of encounters) {
        this.broadcast('encounter', {
          time: timeStr,
          location: enc.location,
          participants: enc.participants.map(n => n.name),
          dialogues: enc.dialogues,
        });
      }
    }

    // 更新玩家天数（新的一天开始时）
    if (this.world.currentHour === 0 && this.world.currentMinute === 0) {
      this.player.newDay();
      this.broadcast('newDay', { day: this.world.currentDay });
    }

    // 广播状态更新
    this.broadcast('state', this.getFullState());

    // 每 18 ticks（3分钟）自动存档
    if (this.tick % 18 === 0) {
      this.saveGame();
    }
  }

  // ============================================================
  // 工具
  // ============================================================

  private broadcast(type: string, data: any): void {
    const msg = JSON.stringify({ type, ...data });
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  // ============================================================
  // 存档 / 读档
  // ============================================================

  private saveGame(): void {
    const saveDir = path.join(__dirname, '..', '..', 'data');
    const savePath = path.join(saveDir, 'savegame.json');

    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

    const data = {
      tick: this.tick,
      world: {
        currentHour: this.world.currentHour,
        currentMinute: this.world.currentMinute,
        currentDay: this.world.currentDay,
        season: this.world.season,
        events: Array.from(this.world.events),
      },
      player: {
        name: this.player.name,
        location: this.player.location,
        day: this.player.day,
        inventory: this.player.inventory,
        relationships: this.player.relationships,
        triggeredEvents: Array.from(this.player.triggeredEvents),
        secretsDiscovered: this.player.secretsDiscovered,
        notebook: this.player.notebook,
      },
      npcs: this.npcs.map(n => n.serialize()),
      echo: this.echo.serialize(),
      chatHistory: this.chatHistory,
    };

    fs.writeFileSync(savePath, JSON.stringify(data));
  }

  private loadGame(): boolean {
    const savePath = path.join(__dirname, '..', '..', 'data', 'savegame.json');
    if (!fs.existsSync(savePath)) return false;

    try {
      const raw = fs.readFileSync(savePath, 'utf-8');
      const data = JSON.parse(raw);

      // 恢复世界
      this.tick = data.tick ?? 0;
      if (data.world) {
        this.world.currentHour = data.world.currentHour;
        this.world.currentMinute = data.world.currentMinute ?? 0;
        this.world.currentDay = data.world.currentDay;
        this.world.season = data.world.season;
        this.world.events = new Set(data.world.events ?? []);
      }

      // 恢复玩家
      if (data.player) {
        this.player.name = data.player.name ?? '旅人';
        this.player.location = data.player.location ?? 'south_gate';
        this.player.day = data.player.day ?? 1;
        this.player.inventory = data.player.inventory ?? {};
        this.player.relationships = data.player.relationships ?? {};
        this.player.triggeredEvents = new Set(data.player.triggeredEvents ?? []);
        this.player.secretsDiscovered = data.player.secretsDiscovered ?? 0;
        if (data.player.notebook) this.player.notebook = data.player.notebook;
      }

      // 恢复 NPC
      if (data.npcs) {
        for (const saved of data.npcs as any[]) {
          const npc = this.npcs.find(n => n.id === saved.id);
          if (npc) {
            npc.location = saved.location ?? npc.location;
            npc.mood = saved.mood ?? npc.mood;
            npc.hunger = saved.hunger ?? npc.hunger;
            npc.thirst = saved.thirst ?? npc.thirst;
            npc.energy = saved.energy ?? npc.energy;
            npc.social = saved.social ?? npc.social;
            npc.totalHoursElapsed = saved.totalHoursElapsed ?? 0;
            if (saved.inventory) npc.inventory = saved.inventory;
            if (saved.memories) npc.memories = saved.memories;
            if (saved.relationships) npc.relationships = saved.relationships;
          }
        }
      }

      // 恢复回声
      if (data.echo) {
        this.echo = new EchoCompanion(this.llmChat, data.echo);
      }

      // 恢复对话记录
      if (data.chatHistory) {
        this.chatHistory = data.chatHistory;
      }

      console.log(`💾 存档加载成功 (Day${this.world.currentDay} ${this.world.currentHour}:00, tick ${this.tick})`);
      return true;
    } catch (e: any) {
      console.log(`⚠️ 存档加载失败: ${e.message}`);
      return false;
    }
  }

  private getFullState() {
    const locId = this.player.location;
    const npcsHere = this.npcs.filter(npc => {
      const npcLoc = this.normalizeLocation(npc.location);
      return npcLoc === locId;
    });

    return {
      player: {
        location: locId,
        locationName: LOCATIONS.find(l => l.id === locId)?.name ?? '',
        day: this.world.currentDay,
        time: this.world.getTimeStr(),
        inventory: this.player.inventory,
      },
      locations: LOCATIONS,
      npcsHere: npcsHere.map(n => ({
        id: n.id,
        name: n.name,
        mood: n.mood,
        activity: n.getCurrentActivity(),
        trust: getTrustLevelCN(this.player.getTrustLevel(n.id)),
      })),
      allNpcs: this.npcs.map(n => ({
        id: n.id,
        name: n.name,
        location: n.location,
        mood: n.mood,
      })),
      worldLog: this.npcs.flatMap(n => n.getLog().slice(-2).map(l => ({
        npc: n.name,
        message: l.message,
        type: l.type,
      }))).slice(-10),
    };
  }

  private normalizeLocation(loc: string): string {
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

  private send(ws: WebSocket, type: string, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
    }
  }
}
