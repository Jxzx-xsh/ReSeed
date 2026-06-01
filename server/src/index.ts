/**
 * index.ts
 * 服务器入口 —— 启动 WebSocket 游戏服务器
 */

import { config } from 'dotenv';
import * as path from 'path';

// 根据 NODE_ENV 加载对应的 .env 文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
config({ path: path.join(__dirname, '..', envFile) });

import { GameServer } from './websocket/GameServer';

const server = new GameServer();
server.start();
