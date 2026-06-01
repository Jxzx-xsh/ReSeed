/**
 * audio.js
 * 音效/氛围系统 —— 使用 Web Audio API 生成程序化音效
 * 无需外部音频文件，全部用代码合成
 */

let audioCtx;
let ambientNode;
let isAudioInit = false;

// 初始化（需要用户交互后才能启动）
function initAudio() {
  if (isAudioInit) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  isAudioInit = true;
  startAmbient();
}

// ============================================================
// 环境音
// ============================================================

function startAmbient() {
  if (!audioCtx) return;

  // 低频嗡鸣（模拟地热井）
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55; // 低沉的嗡鸣
  gain.gain.value = 0.02;

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();

  // 随机风声（白噪音 + 滤波）
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.015;

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start();

  ambientNode = { osc, noise, gain, noiseGain };
}

// ============================================================
// 音效
// ============================================================

function playSound(type) {
  if (!audioCtx) return;

  switch (type) {
    case 'move':
      playFootstep();
      break;
    case 'talk':
      playBlip();
      break;
    case 'event':
      playAlert();
      break;
    case 'echo':
      playEchoSound();
      break;
    case 'encounter':
      playChime();
      break;
  }
}

function playFootstep() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 80 + Math.random() * 40;
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playBlip() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 600 + Math.random() * 200;
  gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

function playAlert() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

function playEchoSound() {
  // 空灵的回声音效
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const delay = audioCtx.createDelay();
  delay.delayTime.value = 0.3;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

  osc.connect(gain);
  gain.connect(delay);
  delay.connect(audioCtx.destination);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
}

function playChime() {
  [523, 659, 784].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.1);
    osc.stop(audioCtx.currentTime + i * 0.1 + 0.3);
  });
}

// 导出
window.initAudio = initAudio;
window.playSound = playSound;
