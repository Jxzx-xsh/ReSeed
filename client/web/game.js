/**
 * game.js
 * 前端游戏逻辑 —— WebSocket 连接 + UI 更新
 */

let ws;
let currentState = null;
let chattingWith = null;

// ============================================================
// 初始化
// ============================================================

function init() {
  connectWebSocket();
  bindEvents();
  if (window.initMapCanvas) window.initMapCanvas();
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => addLog('已连接到种子城服务器', 'success');
  ws.onclose = () => addLog('连接断开，刷新页面重连', 'warning');
  ws.onerror = () => addLog('连接错误', 'warning');

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };
}

function bindEvents() {
  // 对话输入
  document.getElementById('chat-input').onkeydown = (e) => {
    if (e.key === 'Enter') sendChat();
  };
  document.getElementById('btn-send').onclick = sendChat;

  // 关闭对话
  document.getElementById('btn-close-chat').onclick = closeChat;

  // 领取配给
  document.getElementById('btn-collect').onclick = () => {
    send({ type: 'collect' });
  };

  // 回声对话
  document.getElementById('echo-input').onkeydown = (e) => {
    if (e.key === 'Enter') sendEcho();
  };
  document.getElementById('btn-echo').onclick = sendEcho;

  // 音效开关
  document.getElementById('btn-audio').onclick = () => {
    if (window.initAudio) window.initAudio();
    document.getElementById('btn-audio').textContent = '🔊';
  };
}

// ============================================================
// 服务器消息处理
// ============================================================

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init':
    case 'state':
      updateFullState(msg);
      break;
    case 'moved':
      updateFullState(msg.state);
      if (msg.event) showEvent(msg.event);
      addLog(`你来到了 ${msg.state.player.locationName}`, 'info');
      if (window.playSound) window.playSound('move');
      break;
    case 'npcReply':
      addChatBubble(msg.npcName, msg.reply, 'npc');
      document.getElementById('chat-trust').textContent = `[${msg.trustLevel}]`;
      if (msg.state) updateFullState(msg.state);
      if (window.playSound) window.playSound('talk');
      break;
    case 'message':
      addLog(msg.text, msg.type || 'info');
      break;
    case 'collected':
      document.getElementById('btn-collect').classList.add('hidden');
      if (msg.state) updateFullState(msg.state);
      break;
    case 'chatHistory':
      // 加载历史对话
      if (msg.history && msg.history.length > 0) {
        for (const entry of msg.history) {
          addChatBubble(entry.speaker, entry.text, entry.speaker === '你' ? 'player' : 'npc');
        }
      } else if (chattingWith) {
        addChatBubble(chattingWith.name, `(${chattingWith.activity})`, 'npc');
      }
      break;
    case 'newDay':
      addLog(`☀️ Day ${msg.day} 开始`, 'event');
      if (msg.state) updateFullState(msg.state);
      break;
    case 'worldLog':
      for (const entry of msg.entries) {
        addLog(`[${msg.time}] ${entry.npc}: ${entry.message}`, 'npc-action');
      }
      break;
    case 'encounter':
      addLog(`🎭 [${msg.time}] ${msg.participants.join('、')} 在${msg.location}相遇`, 'event');
      for (const line of msg.dialogues) {
        addLog(`   ${line.speaker}: "${line.dialogue}"`, 'info');
      }
      if (window.playSound) window.playSound('encounter');
      break;
    case 'echoReply':
      // 移除等待消息
      const typingEcho = document.querySelector('.typing-echo');
      if (typingEcho) typingEcho.remove();
      // 显示回复
      addEchoMessage('回声', msg.reply, 'echo-msg-reply');
      document.getElementById('echo-status').textContent = `${msg.phase} | 信任: ${msg.trust}`;
      if (window.playSound) window.playSound('echo');
      break;
    case 'error':
      addLog(`错误: ${msg.message}`, 'warning');
      break;
  }
}

// ============================================================
// UI 更新
// ============================================================

function updateFullState(state) {
  if (!state || !state.player) return;
  currentState = state;

  // 状态栏
  document.getElementById('day-display').textContent = `Day ${state.player.day}`;
  document.getElementById('time-display').textContent = `🕐 ${state.player.time || ''}`;
  document.getElementById('location-display').textContent = `📍 ${state.player.locationName}`;

  // Canvas 地图
  if (window.updateMapState) window.updateMapState(state);

  // NPC 列表
  renderNPCs(state.npcsHere);

  // 背包
  renderInventory(state.player.inventory);

  // 领取配给按钮（在净水站或绿洲且今天未领取时显示）
  const collectBtn = document.getElementById('btn-collect');
  const canCollect = (state.player.location === 'water' || state.player.location === 'greenhouse') && !state.player.collectedToday;
  if (canCollect) {
    collectBtn.classList.remove('hidden');
  } else {
    collectBtn.classList.add('hidden');
  }
}

function renderNPCs(npcsHere) {
  const container = document.getElementById('npc-cards');
  container.innerHTML = '';

  if (npcsHere.length === 0) {
    container.innerHTML = '<div style="opacity:0.5;font-size:12px">这里没有人</div>';
    return;
  }

  for (const npc of npcsHere) {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.innerHTML = `
      <div class="npc-name">${npc.name}</div>
      <div class="npc-info">${npc.activity} · ${npc.trust}</div>
    `;
    card.onclick = () => openChat(npc);
    container.appendChild(card);
  }
}

function renderInventory(inventory) {
  const container = document.getElementById('inventory-items');
  container.innerHTML = '';

  for (const [item, qty] of Object.entries(inventory)) {
    if (qty > 0) {
      const div = document.createElement('div');
      div.className = 'inv-item';
      div.textContent = `${item}: ${qty}`;
      container.appendChild(div);
    }
  }
}

// ============================================================
// 对话系统
// ============================================================

function openChat(npc) {
  chattingWith = npc;
  document.getElementById('chat-area').classList.remove('hidden');
  document.getElementById('message-log').classList.add('hidden');
  document.getElementById('chat-npc-name').textContent = npc.name;
  document.getElementById('chat-trust').textContent = `[${npc.trust}]`;
  document.getElementById('chat-messages').innerHTML = '';
  document.getElementById('chat-input').focus();

  // 请求历史对话记录
  send({ type: 'getChatHistory', npcId: npc.id });
}

function closeChat() {
  chattingWith = null;
  document.getElementById('chat-area').classList.add('hidden');
  document.getElementById('message-log').classList.remove('hidden');
  send({ type: 'endTalk' });
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || !chattingWith) return;

  input.value = '';
  addChatBubble('你', message, 'player');

  // 显示加载
  const loading = document.createElement('div');
  loading.className = 'chat-bubble npc typing';
  loading.id = 'typing-indicator';
  document.getElementById('chat-messages').appendChild(loading);
  scrollChat();

  // 后续对话不消耗行动点
  const prefix = document.getElementById('chat-messages').children.length > 3 ? '__continue__' : '';
  send({ type: 'talk', npcId: chattingWith.id, message: prefix + message });
}

function addChatBubble(speaker, text, type) {
  // 移除加载指示
  const typing = document.getElementById('typing-indicator');
  if (typing) typing.remove();

  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  bubble.innerHTML = `<div class="speaker">${speaker}</div><div>${text}</div>`;
  container.appendChild(bubble);
  scrollChat();
}

function scrollChat() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

// ============================================================
// 消息日志
// ============================================================

function addLog(text, type = 'info') {
  const log = document.getElementById('message-log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ============================================================
// 事件弹窗
// ============================================================

function showEvent(event) {
  if (!event.message) return;

  const modal = document.getElementById('event-modal');
  document.getElementById('event-text').textContent = event.message;

  const choicesDiv = document.getElementById('event-choices');
  choicesDiv.innerHTML = '';

  if (event.choiceRequired) {
    for (let i = 0; i < event.choiceRequired.options.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'event-choice';
      btn.textContent = event.choiceRequired.options[i].text;
      btn.onclick = () => {
        modal.classList.add('hidden');
        addLog(`你选择了: ${event.choiceRequired.options[i].text}`, 'event');
        send({ type: 'eventChoice', choiceIndex: i });
      };
      choicesDiv.appendChild(btn);
    }
  } else {
    const btn = document.createElement('button');
    btn.className = 'event-choice';
    btn.textContent = '继续';
    btn.onclick = () => modal.classList.add('hidden');
    choicesDiv.appendChild(btn);
  }

  modal.classList.remove('hidden');
}

// ============================================================
// 回声对话
// ============================================================

function sendEcho() {
  const input = document.getElementById('echo-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';

  // 显示玩家消息
  addEchoMessage('你', message, 'player-msg');

  // 显示等待
  addEchoMessage('回声', '……', 'echo-msg-reply typing-echo');

  send({ type: 'echo', message });
}

function addEchoMessage(speaker, text, className) {
  const container = document.getElementById('echo-messages');
  const div = document.createElement('div');
  div.className = `echo-msg ${className}`;
  div.textContent = speaker === '回声' ? `「${text}」` : `> ${text}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ============================================================
// 工具
// ============================================================

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function normalizeNpcLocation(loc) {
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

// ============================================================
// 启动
// ============================================================

window.onload = init;
