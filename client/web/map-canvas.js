/**
 * map-canvas.js
 * Canvas 地图渲染 —— 种子城俯瞰图 + NPC 实时位置
 */

const MAP_CONFIG = {
  width: 400,
  height: 500,
  padding: 30,
  locations: {
    tent:       { x: 200, y: 80,  label: '北区帐篷', color: '#8b5e3c' },
    echo_well:  { x: 80,  y: 160, label: '回声井',   color: '#4a0080' },
    greenhouse: { x: 320, y: 160, label: '穹顶绿洲', color: '#2e7d32' },
    plaza:      { x: 200, y: 240, label: '中心广场', color: '#b71c1c' },
    market:     { x: 80,  y: 340, label: '黑冰市场', color: '#1a237e' },
    water:      { x: 320, y: 340, label: '净水站',   color: '#0277bd' },
    ruins:      { x: 80,  y: 440, label: '废墟区',   color: '#4e342e' },
    south_gate: { x: 320, y: 440, label: '南门',     color: '#546e7a' },
  },
  connections: [
    ['tent', 'plaza'], ['tent', 'echo_well'], ['tent', 'greenhouse'], ['tent', 'ruins'],
    ['plaza', 'market'], ['plaza', 'water'], ['plaza', 'greenhouse'],
    ['market', 'echo_well'],
    ['water', 'south_gate'],
    ['ruins', 'south_gate'],
  ],
  npcColors: {
    old_ezra: '#e94560',
    arlo: '#4caf50',
    samira: '#2196f3',
    anvil: '#ff9800',
    mara: '#9c27b0',
    pax: '#00bcd4',
    whisperer: '#7c4dff',
  },
};

let canvas, ctx;
let currentNPCPositions = {};
let playerLocation = 'south_gate';

function initMapCanvas() {
  canvas = document.getElementById('map-canvas');
  if (!canvas) return;

  canvas.width = MAP_CONFIG.width;
  canvas.height = MAP_CONFIG.height;
  ctx = canvas.getContext('2d');

  canvas.onclick = handleMapClick;
  drawMap();
}

function drawMap() {
  if (!ctx) return;

  // 背景
  ctx.fillStyle = '#0f0f23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 连接线
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  for (const [a, b] of MAP_CONFIG.connections) {
    const locA = MAP_CONFIG.locations[a];
    const locB = MAP_CONFIG.locations[b];
    if (locA && locB) {
      ctx.beginPath();
      ctx.moveTo(locA.x, locA.y);
      ctx.lineTo(locB.x, locB.y);
      ctx.stroke();
    }
  }

  // 地点
  for (const [id, loc] of Object.entries(MAP_CONFIG.locations)) {
    const isPlayer = id === playerLocation;
    const radius = isPlayer ? 22 : 18;

    // 圆形区域
    ctx.beginPath();
    ctx.arc(loc.x, loc.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isPlayer ? loc.color : loc.color + '80';
    ctx.fill();

    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 标签
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(loc.label, loc.x, loc.y + radius + 14);
  }

  // NPC 小点
  const locationNPCs = {};
  for (const [npcId, locId] of Object.entries(currentNPCPositions)) {
    if (!locationNPCs[locId]) locationNPCs[locId] = [];
    locationNPCs[locId].push(npcId);
  }

  for (const [locId, npcs] of Object.entries(locationNPCs)) {
    const loc = MAP_CONFIG.locations[locId];
    if (!loc) continue;

    npcs.forEach((npcId, i) => {
      const angle = (i / npcs.length) * Math.PI * 2 - Math.PI / 2;
      const dist = 28;
      const nx = loc.x + Math.cos(angle) * dist;
      const ny = loc.y + Math.sin(angle) * dist;

      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, Math.PI * 2);
      ctx.fillStyle = MAP_CONFIG.npcColors[npcId] || '#fff';
      ctx.fill();

      // NPC 名字首字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = getNPCInitial(npcId);
      ctx.fillText(initial, nx, ny);
    });
  }

  // 玩家标记
  const playerLoc = MAP_CONFIG.locations[playerLocation];
  if (playerLoc) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('你', playerLoc.x, playerLoc.y);
  }
}

function handleMapClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // 检查点击了哪个地点
  for (const [id, loc] of Object.entries(MAP_CONFIG.locations)) {
    const dist = Math.sqrt((x - loc.x) ** 2 + (y - loc.y) ** 2);
    if (dist < 25 && id !== playerLocation) {
      send({ type: 'move', locationId: id });
      break;
    }
  }
}

function updateMapState(state) {
  if (!state) return;

  playerLocation = state.player.location;

  // 更新 NPC 位置
  currentNPCPositions = {};
  if (state.allNpcs) {
    for (const npc of state.allNpcs) {
      const locId = normalizeNpcLocation(npc.location);
      currentNPCPositions[npc.id] = locId;
    }
  }

  drawMap();
}

function getNPCInitial(npcId) {
  const map = {
    old_ezra: '埃',
    arlo: '洛',
    samira: '萨',
    anvil: '砧',
    mara: '玛',
    pax: '帕',
    whisperer: '语',
  };
  return map[npcId] || '?';
}

// 导出给 game.js 使用
window.initMapCanvas = initMapCanvas;
window.updateMapState = updateMapState;
