'use strict';

// ═══════════════════════════════════════════
//   TEACHFOCUS — POMODORO STUDY APP
// ═══════════════════════════════════════════

// ── CONFIG ──────────────────────────────────
const MODES = {
  pomodoro: { label: 'Focus Time',   duration: 25 * 60, color: 'tomato' },
  short:    { label: 'Short Break',  duration:  5 * 60, color: 'sky'    },
  long:     { label: 'Long Break',   duration: 15 * 60, color: 'mint'   },
};
const RING_CIRCUMFERENCE = 2 * Math.PI * 96; // r=96
const LONG_BREAK_INTERVAL = 4; // every 4 pomodoros

// ── QUOTES ──────────────────────────────────
const QUOTES = [
  '"The mediocre teacher tells. The good teacher explains. The superior teacher demonstrates. The great teacher inspires." — William Arthur Ward',
  '"Education is not the filling of a bucket, but the lighting of a fire." — W.B. Yeats',
  '"Teaching kids to count is fine, but teaching them what counts is best." — Bob Talbert',
  '"It is the supreme art of the teacher to awaken joy in creative expression and knowledge." — Albert Einstein',
  '"A teacher affects eternity; they can never tell where their influence stops." — Henry Adams',
  '"Every child deserves a champion — an adult who will never give up on them." — Rita Pierson',
  '"Tell me and I forget. Teach me and I remember. Involve me and I learn." — Benjamin Franklin',
  '"The best teachers are those who show you where to look, but don\'t tell you what to see." — Alexandra K. Trenfor',
  '"Teaching is the one profession that creates all other professions." — Anonymous',
  '"One child, one teacher, one book, one pen can change the world." — Malala Yousafzai',
  '"Children are not things to be moulded, but people to be unfolded." — Jess Lair',
  '"Play is the highest form of research." — Albert Einstein',
  '"Patience is the secret weapon of every great primary teacher." — Anonymous',
  '"In learning you will teach, and in teaching you will learn." — Phil Collins',
  '"What the teacher is, is more important than what they teach." — Karl Menninger',
  '"Children learn more from what you are than what you teach." — W.E.B. Du Bois',
];

// ── BREAK MESSAGES ──────────────────────────
const BREAK_MSGS = {
  short: [
    'Great work! Take 5 minutes to rest your eyes and stretch.',
    'You\'re doing brilliantly! Stand up, breathe, and relax.',
    'Short break — grab a glass of water and recharge.',
    'Well done! Step away from the desk for a few minutes.',
  ],
  long: [
    'Fantastic focus session! Enjoy a well-earned 15-minute break.',
    'Four pomodoros down — you\'re crushing it! Rest properly now.',
    'Time for a longer break. Make a cup of tea and celebrate your progress!',
    'Outstanding effort! Take 15 minutes to fully recharge.',
  ],
};

// ── STATE ────────────────────────────────────
const state = {
  mode: 'pomodoro',
  running: false,
  remaining: MODES.pomodoro.duration,
  total: MODES.pomodoro.duration,
  pomodoroCount: 0,       // completed this long-break cycle
  sessionsToday: 0,
  focusMinutes: 0,
  tasks: [],
  interval: null,
};

// ── DOM REFS ─────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  timerDisplay:   $('timer-display'),
  timerModeLabel: $('timer-mode-label'),
  ringProgress:   $('ring-progress'),
  btnStart:       $('btn-start'),
  btnReset:       $('btn-reset'),
  btnSkip:        $('btn-skip'),
  autoStart:      $('auto-start'),
  dots:           document.querySelectorAll('.dot'),
  modeTabs:       document.querySelectorAll('.mode-tab'),
  quoteText:      $('quote-text'),
  quoteRefresh:   $('quote-refresh'),
  topicSelect:    $('topic-select'),
  taskInput:      $('task-input'),
  btnAddTask:     $('btn-add-task'),
  taskList:       $('task-list'),
  taskCounter:    $('task-counter'),
  btnClearDone:   $('btn-clear-done'),
  notesArea:      $('notes-area'),
  btnClearNotes:  $('btn-clear-notes'),
  sessionsCount:  $('sessions-count'),
  focusTime:      $('focus-time'),
  breakOverlay:   $('break-overlay'),
  breakIcon:      $('break-icon'),
  breakTitle:     $('break-title'),
  breakMsg:       $('break-msg'),
  breakTimer:     $('break-timer'),
  btnBreakSkip:   $('btn-break-skip'),
  toast:          $('toast'),
  toastIcon:      $('toast-icon'),
  toastMsg:       $('toast-msg'),
  appHeader:      document.querySelector('.app-header'),
  body:           document.body,
};

// ── AUDIO (Web Audio API) ────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.35) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

function playChime() {
  playTone(523.25, 0.25);
  setTimeout(() => playTone(659.25, 0.25), 120);
  setTimeout(() => playTone(783.99, 0.5),  240);
}

function playBreakEnd() {
  playTone(783.99, 0.25);
  setTimeout(() => playTone(659.25, 0.25), 120);
  setTimeout(() => playTone(523.25, 0.5),  240);
}

// ── STORAGE ──────────────────────────────────
const STORAGE_KEY = 'teachfocus_v1';

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks:        state.tasks,
      notes:        el.notesArea.value,
      sessionsToday: state.sessionsToday,
      focusMinutes: state.focusMinutes,
      savedDate:    new Date().toDateString(),
      topic:        el.topicSelect.value,
    }));
  } catch (_) {}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    // Reset daily stats if it's a new day
    if (data.savedDate !== new Date().toDateString()) {
      state.sessionsToday = 0;
      state.focusMinutes = 0;
    } else {
      state.sessionsToday = data.sessionsToday || 0;
      state.focusMinutes  = data.focusMinutes  || 0;
    }
    state.tasks = data.tasks || [];
    if (data.notes) el.notesArea.value = data.notes;
    if (data.topic) el.topicSelect.value = data.topic;
    renderTasks();
    updateStats();
  } catch (_) {}
}

// ── TIMER CORE ───────────────────────────────
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing() {
  const frac = state.remaining / state.total;
  const offset = RING_CIRCUMFERENCE * (1 - frac);
  el.ringProgress.style.strokeDashoffset = offset.toFixed(2);
}

function renderTimer() {
  el.timerDisplay.textContent = formatTime(state.remaining);
  updateRing();
}

function setMode(mode, silent = false) {
  state.mode = mode;
  state.remaining = MODES[mode].duration;
  state.total     = MODES[mode].duration;
  state.running   = false;
  clearInterval(state.interval);
  el.btnStart.textContent = 'Start';

  el.timerModeLabel.textContent = MODES[mode].label;

  // Update colour scheme
  el.body.dataset.modeActive = mode;
  el.appHeader.style.background = getCssVar(mode);

  // CSS variable trick: update ring and button via body dataset
  el.ringProgress.style.stroke = getCssVar(mode);

  // Buttons accent
  el.btnStart.style.background  = getCssVar(mode);
  el.btnAdd && (el.btnAdd.style.background = getCssVar(mode));

  // Mode tabs
  el.modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

  renderTimer();

  if (!silent) updateRing();
}

function getCssVar(mode) {
  const map = { pomodoro: '#E84040', short: '#29B6F6', long: '#26C6A0' };
  return map[mode] || '#E84040';
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  el.btnStart.textContent = 'Pause';

  state.interval = setInterval(() => {
    state.remaining--;
    renderTimer();

    if (state.mode === 'pomodoro') {
      state.focusMinutes += (1 / 60);
      updateStats();
    }

    if (state.remaining <= 0) {
      clearInterval(state.interval);
      state.running = false;
      onTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  state.running = false;
  clearInterval(state.interval);
  el.btnStart.textContent = 'Resume';
}

function resetTimer() {
  pauseTimer();
  state.remaining = state.total;
  el.btnStart.textContent = 'Start';
  renderTimer();
}

function skipTimer() {
  pauseTimer();
  onTimerComplete(true);
}

function onTimerComplete(skipped = false) {
  if (state.mode === 'pomodoro') {
    state.sessionsToday++;
    state.pomodoroCount++;
    updateStats();
    updateDots();
    playChime();
    if (!skipped) showToast('🍅', 'Pomodoro complete! Time for a break.');

    const isLong = state.pomodoroCount >= LONG_BREAK_INTERVAL;
    const nextMode = isLong ? 'long' : 'short';
    if (isLong) state.pomodoroCount = 0;

    showBreak(nextMode, skipped);
  } else {
    // Break finished
    playBreakEnd();
    hideBreak();
    if (!skipped) showToast('📚', 'Break over — back to studying!');
    setMode('pomodoro');
    if (el.autoStart.checked) {
      setTimeout(startTimer, 600);
    }
  }
  save();
}

// ── DOTS ─────────────────────────────────────
function updateDots() {
  el.dots.forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i < state.pomodoroCount)      dot.classList.add('done');
    else if (i === state.pomodoroCount) dot.classList.add('active');
  });
}

// ── BREAK OVERLAY ────────────────────────────
let breakInterval = null;

function showBreak(mode, autoSkip = false) {
  const isLong = mode === 'long';
  el.breakIcon.textContent  = isLong ? '🌟' : '☕';
  el.breakTitle.textContent = isLong ? 'Long Break!' : 'Short Break!';
  el.breakMsg.textContent   = randomItem(BREAK_MSGS[isLong ? 'long' : 'short']);

  const dur = MODES[mode].duration;
  let rem   = dur;

  el.breakTimer.textContent  = formatTime(rem);
  el.breakTimer.style.color  = isLong ? getCssVar('long') : getCssVar('short');
  el.breakOverlay.classList.remove('hidden');

  clearInterval(breakInterval);

  if (autoSkip) {
    setMode('pomodoro');
    el.breakOverlay.classList.add('hidden');
    return;
  }

  breakInterval = setInterval(() => {
    rem--;
    el.breakTimer.textContent = formatTime(rem);
    if (rem <= 0) {
      clearInterval(breakInterval);
      onTimerComplete(false);
    }
  }, 1000);
}

function hideBreak() {
  clearInterval(breakInterval);
  el.breakOverlay.classList.add('hidden');
}

// ── STATS ────────────────────────────────────
function updateStats() {
  el.sessionsCount.textContent = state.sessionsToday;
  const mins = Math.floor(state.focusMinutes);
  el.focusTime.textContent = mins >= 60
    ? `${Math.floor(mins/60)}h ${mins%60}m`
    : `${mins}m`;
}

// ── TASKS ────────────────────────────────────
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  state.tasks.push({ id: Date.now(), text: trimmed, done: false });
  renderTasks();
  save();
}

function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (t) t.done = !t.done;
  renderTasks();
  save();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  renderTasks();
  save();
}

function renderTasks() {
  el.taskList.innerHTML = '';
  state.tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = task.done;
    check.addEventListener('change', () => toggleTask(task.id));

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', () => deleteTask(task.id));

    li.appendChild(check);
    li.appendChild(span);
    li.appendChild(del);
    el.taskList.appendChild(li);
  });

  const done  = state.tasks.filter(t => t.done).length;
  const total = state.tasks.length;
  el.taskCounter.textContent = `${done}/${total}`;
}

// ── QUOTES ───────────────────────────────────
function showQuote() {
  el.quoteText.textContent = randomItem(QUOTES);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── TOAST ────────────────────────────────────
let toastTimeout = null;
function showToast(icon, msg) {
  el.toastIcon.textContent = icon;
  el.toastMsg.textContent  = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.toast.classList.add('hidden'), 3500);
}

// ── DOCUMENT TITLE ───────────────────────────
function updateTitle() {
  if (state.running) {
    document.title = `${formatTime(state.remaining)} — TeachFocus`;
  } else {
    document.title = 'TeachFocus — Pomodoro Study App';
  }
}

// ── EVENT LISTENERS ──────────────────────────
el.btnStart.addEventListener('click', () => {
  if (state.running) pauseTimer();
  else startTimer();
});

el.btnReset.addEventListener('click', resetTimer);
el.btnSkip.addEventListener('click',  skipTimer);

el.modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (state.running) pauseTimer();
    setMode(tab.dataset.mode);
  });
});

el.btnAddTask.addEventListener('click', () => {
  addTask(el.taskInput.value);
  el.taskInput.value = '';
  el.taskInput.focus();
});

el.taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addTask(el.taskInput.value);
    el.taskInput.value = '';
  }
});

el.btnClearDone.addEventListener('click', () => {
  state.tasks = state.tasks.filter(t => !t.done);
  renderTasks();
  save();
});

el.notesArea.addEventListener('input', save);
el.topicSelect.addEventListener('change', save);

el.quoteRefresh.addEventListener('click', () => {
  el.quoteText.style.opacity = '0';
  setTimeout(() => {
    showQuote();
    el.quoteText.style.opacity = '1';
  }, 180);
});
el.quoteText.style.transition = 'opacity .18s';

el.btnBreakSkip.addEventListener('click', () => {
  clearInterval(breakInterval);
  hideBreak();
  setMode('pomodoro');
  if (el.autoStart.checked) {
    setTimeout(startTimer, 600);
  }
});

// Update page title every second while running
setInterval(updateTitle, 1000);

// Keyboard shortcut: Space = start/pause, R = reset
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.running) pauseTimer();
    else startTimer();
  }
  if (e.code === 'KeyR') resetTimer();
});

// ── INIT ──────────────────────────────────────
function init() {
  load();
  setMode('pomodoro', true);
  showQuote();
  updateDots();
  updateStats();
  renderTasks();
  renderTimer();
}

init();
