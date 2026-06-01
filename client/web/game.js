/**
 * game.js
 * 前端游戏逻辑 —— WebSocket 连接 + UI 更新
 */

let ws;
let currentState = null;
let chattingWith = null;
let questMarkers = {};  // NPC 任务标记

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
    case 'questAvailable':
      showQuestOffer(msg.quest);
      break;
    case 'questUpdate':
      updateQuestPanel(msg.quests, msg.markers);
      if (msg.notification) addLog(msg.notification, 'event');
      break;
    case 'questSubmitted':
      showQuestComplete(msg.quest, msg.reward);
      if (msg.state) updateFullState(msg.state);
      break;
    case 'historyLogs':
      renderHistoryLogs(msg.logs);
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

  // 任务面板
  if (state.quests) {
    updateQuestPanel(state.quests, state.questMarkers);
  }

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

    // 任务标记
    let marker = '';
    if (questMarkers[npc.id] === 'ready') {
      marker = '<span class="quest-marker">✅</span>';
    } else if (questMarkers[npc.id] === 'available') {
      marker = '<span class="quest-marker">❗</span>';
    }

    card.innerHTML = `
      <div class="npc-name">${npc.name}${marker}</div>
      <div class="npc-info">${npc.activity} · ${npc.trust}</div>
    `;

    // 任务交互按钮
    const actions = document.createElement('div');
    actions.className = 'quest-actions';

    if (questMarkers[npc.id] === 'available') {
      const btn = document.createElement('button');
      btn.className = 'btn-quest-action';
      btn.textContent = '📋 查看任务';
      btn.onclick = (e) => { e.stopPropagation(); send({ type: 'questCheck', npcId: npc.id }); };
      actions.appendChild(btn);
    }

    if (questMarkers[npc.id] === 'ready') {
      const btn = document.createElement('button');
      btn.className = 'btn-quest-action submit';
      btn.textContent = '✅ 交付任务';
      btn.onclick = (e) => { e.stopPropagation(); send({ type: 'questSubmit', npcId: npc.id }); };
      actions.appendChild(btn);
    }

    if (actions.children.length > 0) {
      card.appendChild(actions);
    }

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
// 历史日志回显
// ============================================================

function renderHistoryLogs(logs) {
  const logContainer = document.getElementById('message-log');

  for (const line of logs) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    // 根据内容类型设置样式
    if (line.startsWith('═══')) {
      entry.className = 'log-entry event';
      entry.style.textAlign = 'center';
      entry.style.opacity = '0.7';
    } else if (line.includes('🎭')) {
      entry.className = 'log-entry npc-action';
    } else if (line.includes('💬')) {
      entry.className = 'log-entry info';
    } else if (line.includes('⚡')) {
      entry.className = 'log-entry event';
    } else if (line.includes('📋')) {
      entry.className = 'log-entry success';
    } else if (line.includes('...')) {
      entry.className = 'log-entry info';
      entry.style.opacity = '0.4';
    } else {
      entry.className = 'log-entry npc-action';
    }

    entry.style.animation = 'none'; // 历史日志不需要动画
    entry.textContent = line;
    logContainer.appendChild(entry);
  }

  // 添加分隔线
  const separator = document.createElement('div');
  separator.className = 'log-entry info';
  separator.style.textAlign = 'center';
  separator.style.opacity = '0.5';
  separator.style.borderLeft = 'none';
  separator.textContent = '─── 以上为历史记录 ───';
  logContainer.appendChild(separator);

  logContainer.scrollTop = logContainer.scrollHeight;
}

// ============================================================
// 任务系统 UI
// ============================================================

function updateQuestPanel(quests, markers) {
  if (markers) questMarkers = markers;

  const container = document.getElementById('quest-list');
  container.innerHTML = '';

  const active = quests.filter(q => ['accepted', 'in_progress', 'ready'].includes(q.status));
  const completed = quests.filter(q => q.status === 'completed');

  if (active.length === 0) {
    container.innerHTML = '<div style="opacity:0.4;font-size:11px">暂无进行中的任务</div>';
  } else {
    for (const quest of active) {
      const card = document.createElement('div');
      card.className = `quest-card ${quest.status === 'ready' ? 'quest-ready' : ''}`;

      const totalRequired = quest.objectives.reduce((s, o) => s + o.required, 0);
      const totalCurrent = quest.objectives.reduce((s, o) => s + Math.min(o.current, o.required), 0);
      const percent = totalRequired > 0 ? (totalCurrent / totalRequired) * 100 : 0;

      let statusIcon = '⏳';
      if (quest.status === 'ready') statusIcon = '✅';

      let objectivesHtml = '';
      for (const obj of quest.objectives) {
        const done = obj.current >= obj.required;
        objectivesHtml += `<div class="quest-card-objective">${done ? '✓' : '○'} ${obj.description} [${Math.min(obj.current, obj.required)}/${obj.required}]</div>`;
      }

      card.innerHTML = `
        <div class="quest-card-name">${statusIcon} ${quest.name}</div>
        ${objectivesHtml}
        <div class="quest-card-giver">委托人: ${quest.giverName}</div>
        <div class="quest-progress-bar">
          <div class="quest-progress-fill ${percent >= 100 ? 'complete' : ''}" style="width:${percent}%"></div>
        </div>
      `;

      container.appendChild(card);
    }
  }

  // 已完成计数
  const toggle = document.getElementById('quest-completed-toggle');
  if (completed.length > 0) {
    toggle.classList.remove('hidden');
    document.getElementById('quest-completed-count').textContent = `📜 已完成 (${completed.length})`;
  } else {
    toggle.classList.add('hidden');
  }

  // 重新渲染 NPC 列表（更新标记）
  if (currentState && currentState.npcsHere) {
    renderNPCs(currentState.npcsHere);
  }
}

function showQuestOffer(quest) {
  const modal = document.getElementById('quest-offer-modal');
  document.getElementById('quest-offer-name').textContent = quest.name;
  document.getElementById('quest-offer-desc').textContent = quest.description;

  // 目标
  let objHtml = '<div style="margin-bottom:5px;color:#a8d8ea">目标:</div>';
  for (const obj of quest.objectives) {
    objHtml += `<div>○ ${obj.description} ×${obj.required}</div>`;
  }
  document.getElementById('quest-offer-objectives').innerHTML = objHtml;

  // 奖励
  let rewardHtml = '<div style="margin-bottom:5px">奖励:</div>';
  if (quest.reward.items) {
    for (const [item, qty] of Object.entries(quest.reward.items)) {
      rewardHtml += `<div>  💰 ${item} +${qty}</div>`;
    }
  }
  if (quest.reward.relationships) {
    for (const [npc, delta] of Object.entries(quest.reward.relationships)) {
      rewardHtml += `<div>  ❤️ 好感 +${delta}</div>`;
    }
  }
  document.getElementById('quest-offer-reward').innerHTML = rewardHtml;

  // 期限
  if (quest.dayLimit) {
    document.getElementById('quest-offer-limit').textContent = `⏰ 期限: ${quest.dayLimit} 天`;
  } else {
    document.getElementById('quest-offer-limit').textContent = '⏰ 无期限';
  }

  // 按钮绑定
  document.getElementById('btn-quest-accept').onclick = () => {
    modal.classList.add('hidden');
    send({ type: 'questAccept', questId: quest.id });
    addLog(`接受任务: ${quest.name}`, 'event');
    if (window.playSound) window.playSound('quest');
  };

  document.getElementById('btn-quest-decline').onclick = () => {
    modal.classList.add('hidden');
    send({ type: 'questDecline', questId: quest.id });
    addLog(`拒绝了任务: ${quest.name}`, 'info');
  };

  modal.classList.remove('hidden');
}

function showQuestComplete(quest, reward) {
  const modal = document.getElementById('quest-complete-modal');
  document.getElementById('quest-complete-name').textContent = quest.name;
  document.getElementById('quest-complete-message').textContent = reward.message;

  let rewardsHtml = '';
  if (reward.items) {
    for (const [item, qty] of Object.entries(reward.items)) {
      rewardsHtml += `<div class="reward-line">💰 ${item} +${qty}</div>`;
    }
  }
  if (reward.relationships) {
    for (const [npc, delta] of Object.entries(reward.relationships)) {
      rewardsHtml += `<div class="reward-line">❤️ 好感 +${delta}</div>`;
    }
  }
  if (reward.fragments && reward.fragments.length > 0) {
    rewardsHtml += `<div class="reward-line">📓 发现新线索</div>`;
  }
  document.getElementById('quest-complete-rewards').innerHTML = rewardsHtml;

  document.getElementById('btn-quest-confirm').onclick = () => {
    modal.classList.add('hidden');
  };

  modal.classList.remove('hidden');
  addLog(`✅ 完成任务: ${quest.name}`, 'success');
  if (window.playSound) window.playSound('quest_complete');
}

// ============================================================
// 启动
// ============================================================

window.onload = init;
