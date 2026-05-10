/* ========== 辅助工具 ========== */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => (p || document).querySelectorAll(s);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ========== 全局状态 ========== */
const state = {
  currentPack: 'cet6',
  currentCat: 'all',
  currentMode: 'learn',
  currentIndex: 0,
  wordPool: [],       // 当前类别下的所有词汇
  mastered: {},
  quizScore: 0,
  quizIndex: 0,
  quizWords: [],
};

/* ========== 数据访问 ========== */
function getData() {
  return state.currentPack === 'cet6' ? cet6Data : ieltsData;
}

function getCatInfo(catKey) {
  const data = getData();
  return data[catKey] || null;
}

function getAllCategories() {
  const data = getData();
  return Object.keys(data).map(k => ({ key: k, name: data[k].name, icon: data[k].icon, count: data[k].words.length }));
}

function buildWordPool() {
  const data = getData();
  if (state.currentCat === 'all') {
    let words = [];
    Object.keys(data).forEach(k => {
      data[k].words.forEach(w => words.push({ ...w, category: k, categoryName: data[k].name }));
    });
    return words;
  }
  return data[state.currentCat].words.map(w => ({ ...w, category: state.currentCat, categoryName: data[state.currentCat].name }));
}

function refreshPool() {
  state.wordPool = buildWordPool();
  shuffle(state.wordPool);
  state.currentIndex = 0;
  $('#current-pool-count').textContent = state.wordPool.length;
}

/* ========== 本地存储 ========== */
function mkKey(word) {
  return state.currentPack + '|' + word;
}

function saveProgress() {
  localStorage.setItem('englearn_mastered', JSON.stringify(state.mastered));
  localStorage.setItem('englearn_pack', state.currentPack);
  localStorage.setItem('englearn_cat', state.currentCat);
}

function loadProgress() {
  try {
    const m = JSON.parse(localStorage.getItem('englearn_mastered'));
    if (m) state.mastered = m;
    const p = localStorage.getItem('englearn_pack');
    if (p && (p === 'cet6' || p === 'ielts')) state.currentPack = p;
    const c = localStorage.getItem('englearn_cat');
    if (c) state.currentCat = c;
  } catch (e) { /* ignore */ }
}

function isMastered(word) { return !!state.mastered[mkKey(word)]; }
function setMastered(word, val) { state.mastered[mkKey(word)] = val; saveProgress(); updateProgress(); }

/* ========== 进度更新 ========== */
function updateProgress() {
  const pool = state.wordPool;
  const masteredCount = pool.filter(w => isMastered(w.w)).length;
  $('#mastered-count').textContent = masteredCount;
  $('#total-count').textContent = pool.length;
  $('#progress-fill').style.width = pool.length ? (masteredCount / pool.length * 100) + '%' : '0%';

  const stored = JSON.parse(localStorage.getItem('englearn_quiz_stats') || '{}');
  const key = state.currentPack + '_' + state.currentCat;
  if (stored[key]) {
    const { correct, total } = stored[key];
    $('#accuracy').textContent = total ? Math.round(correct / total * 100) + '%' : '—';
  } else {
    $('#accuracy').textContent = '—';
  }
}

/* ========== 场景目录渲染 ========== */
function renderCategoryDirectory() {
  const cats = getAllCategories();
  const totalAll = cats.reduce((s, c) => s + c.count, 0);
  $('#cat-count-all').textContent = totalAll;

  // Sidebar category list
  const sidebarList = $('#cat-list');
  sidebarList.innerHTML = cats.map(c => `
    <button class="cat-btn-sidebar" data-cat="${c.key}">
      <span class="cat-icon">${c.icon}</span> ${c.name}
      <span class="cat-count">${c.count}</span>
    </button>
  `).join('');

  // Mobile category scroll
  const mobileScroll = $('#cat-scroll');
  let html = `<button class="cat-chip active" data-cat="all">📋 全部</button>`;
  html += cats.map(c => `<button class="cat-chip" data-cat="${c.key}">${c.icon} ${c.name}</button>`).join('');
  mobileScroll.innerHTML = html;

  // Highlight active category
  updateCategoryActive();
}

function updateCategoryActive() {
  // Sidebar
  $$('.cat-btn-sidebar').forEach(b => b.classList.toggle('active', b.dataset.cat === state.currentCat));
  $('#sidebar .cat-btn[data-cat="all"]')?.classList.toggle('active', state.currentCat === 'all');
  // The top-level "all" button
  const allBtns = $$('.cat-btn');
  allBtns.forEach(b => {
    if (b.dataset.cat === 'all') b.classList.toggle('active', state.currentCat === 'all');
  });

  // Mobile chips
  $$('.cat-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === state.currentCat));

  // Category indicator text
  const catInfo = state.currentCat === 'all' ? { name: '全部词汇', icon: '📋' } : getCatInfo(state.currentCat);
  if (catInfo) {
    $('#cat-indicator').innerHTML = `<span class="cat-indicator-text">${catInfo.icon} 当前场景：<strong>${catInfo.name}</strong></span>`;
  }
}

/* ========== 场景切换 ========== */
function switchCategory(cat) {
  state.currentCat = cat;
  saveProgress();
  updateCategoryActive();
  refreshPool();
  updateProgress();
  resetCurrentMode();
}

/* ========== 词汇包切换 ========== */
function switchPack(pack) {
  if (state.currentPack === pack) return;
  state.currentPack = pack;
  state.currentCat = 'all';
  saveProgress();
  renderCategoryDirectory();
  updateCategoryActive();
  refreshPool();
  updateProgress();
  resetCurrentMode();

  // Update pack buttons
  $$('.pack-btn').forEach(b => b.classList.toggle('active', b.dataset.pack === pack));
}

/* ========== 模式切换 ========== */
function resetCurrentMode() {
  switchMode(state.currentMode);
}

function switchMode(mode) {
  state.currentMode = mode;
  state.quizWords = [];
  state.quizIndex = 0;
  state.quizScore = 0;

  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#learn-mode').classList.add('hidden');
  $('#quiz-mode').classList.add('hidden');
  $('#spell-mode').classList.add('hidden');

  if (mode === 'learn') {
    $('#learn-mode').classList.remove('hidden');
    if (state.wordPool.length === 0) { showEmpty(); return; }
    renderLearnMode();
  } else if (mode === 'meaning' || mode === 'word') {
    $('#quiz-mode').classList.remove('hidden');
    if (state.wordPool.length < 4) { showEmpty(); return; }
    prepareQuizWords();
    renderQuiz();
  } else if (mode === 'spell') {
    $('#spell-mode').classList.remove('hidden');
    if (state.wordPool.length === 0) { showEmpty(); return; }
    renderSpell();
  }
}

function showEmpty() {
  const msg = state.currentCat === 'all' ? '词汇数据加载中，请切换词汇包试试' : '该场景暂无词汇，请选择其他场景';
  $('#word-text').textContent = '—';
  $('#word-text').parentElement.querySelector('.empty-state')?.remove();
}

/* ========== 学习模式 ========== */
function renderLearnMode() {
  if (state.wordPool.length === 0) { refreshPool(); if (state.wordPool.length === 0) return; }
  if (state.currentIndex >= state.wordPool.length) {
    shuffle(state.wordPool);
    state.currentIndex = 0;
  }

  const w = state.wordPool[state.currentIndex];
  $('#word-text').textContent = w.w;
  $('#phonetic-text').textContent = w.p;
  $('#meaning-text').textContent = w.m;
  $('#example-en').textContent = w.e;
  $('#example-zh').textContent = w.ez;
  $('#card-inner').classList.remove('flipped');

  const knownBtn = $('#known-btn');
  if (isMastered(w.w)) {
    knownBtn.textContent = '✓ 已掌握 ✓';
    knownBtn.style.opacity = '0.55';
  } else {
    knownBtn.textContent = '✓ 已掌握';
    knownBtn.style.opacity = '1';
  }
}

function flipCard() { $('#card-inner').classList.toggle('flipped'); }

function nextWord() {
  if (state.wordPool.length === 0) return;
  state.currentIndex++;
  if (state.currentIndex >= state.wordPool.length) {
    shuffle(state.wordPool);
    state.currentIndex = 0;
  }
  renderLearnMode();
}

/* ========== 测验模式 ========== */
function prepareQuizWords() {
  state.quizWords = [...state.wordPool];
  shuffle(state.quizWords);
  state.quizIndex = 0;
  state.quizScore = 0;
}

function getOptions(correctWord, type) {
  const pool = state.wordPool;
  const options = [correctWord];
  while (options.length < 4 && options.length < pool.length) {
    const rand = pool[Math.floor(Math.random() * pool.length)];
    if (!options.find(o => o.w === rand.w)) options.push(rand);
  }
  shuffle(options);
  return options;
}

function renderQuiz() {
  if (state.quizWords.length === 0) prepareQuizWords();
  if (state.quizIndex >= state.quizWords.length) prepareQuizWords();

  const w = state.quizWords[state.quizIndex];
  const isMeaningMode = state.currentMode === 'meaning';

  $('#quiz-prompt').textContent = isMeaningMode ? '请选择对应的中文释义：' : '请选择对应的英文单词：';
  $('#quiz-question').textContent = isMeaningMode ? w.w : w.m;
  $('#quiz-feedback').textContent = '';
  $('#quiz-feedback').className = 'quiz-feedback';
  $('#quiz-next-btn').classList.add('hidden');

  const options = getOptions(w, isMeaningMode ? 'meaning' : 'word');
  const container = $('#quiz-options');
  container.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = isMeaningMode ? opt.m : opt.w;
    btn.addEventListener('click', () => handleQuizAnswer(opt, w, btn));
    container.appendChild(btn);
  });

  $('#quiz-score').textContent = `得分: ${state.quizScore}`;
  $('#quiz-progress').textContent = `进度: ${state.quizIndex + 1}/${state.quizWords.length}`;
}

function handleQuizAnswer(selected, correct, clickedBtn) {
  const btns = $$('.quiz-option');
  btns.forEach(b => b.disabled = true);

  const isCorrect = selected.w === correct.w;
  const isMeaningMode = state.currentMode === 'meaning';

  if (isCorrect) {
    clickedBtn.classList.add('correct');
    $('#quiz-feedback').textContent = '✓ 正确！';
    $('#quiz-feedback').className = 'quiz-feedback correct';
    state.quizScore++;
  } else {
    clickedBtn.classList.add('wrong');
    const correctLabel = isMeaningMode ? correct.m : correct.w;
    $('#quiz-feedback').textContent = `✗ 错误！正确答案是：${correctLabel}`;
    $('#quiz-feedback').className = 'quiz-feedback wrong';
    btns.forEach(b => {
      if (b.textContent === correctLabel) b.classList.add('correct');
    });
  }

  $('#quiz-next-btn').classList.remove('hidden');
  saveQuizStats(isCorrect);
}

function nextQuiz() {
  state.quizIndex++;
  if (state.quizIndex >= state.quizWords.length) {
    $('#quiz-prompt').textContent = '';
    $('#quiz-question').textContent = '本轮结束！';
    $('#quiz-options').innerHTML = '';
    $('#quiz-feedback').textContent = `得分：${state.quizScore} / ${state.quizWords.length}`;
    $('#quiz-feedback').className = 'quiz-feedback correct';
    $('#quiz-next-btn').textContent = '再来一轮 →';
    $('#quiz-next-btn').classList.remove('hidden');
    $('#quiz-next-btn').onclick = () => {
      $('#quiz-next-btn').textContent = '继续 →';
      $('#quiz-next-btn').onclick = nextQuiz;
      prepareQuizWords();
      renderQuiz();
    };
    $('#quiz-score').textContent = `得分: ${state.quizScore}`;
    $('#quiz-progress').textContent = `进度: ${state.quizIndex}/${state.quizWords.length}`;
    return;
  }
  renderQuiz();
}

/* ========== 拼写模式 ========== */
function renderSpell() {
  if (!state.quizWords.length || state.quizIndex >= state.quizWords.length) {
    state.quizWords = [...state.wordPool];
    shuffle(state.quizWords);
    state.quizIndex = 0;
    state.quizScore = 0;
  }
  const w = state.quizWords[state.quizIndex];
  $('#spell-meaning').textContent = w.m;
  $('#spell-phonetic').textContent = w.p;
  $('#spell-feedback').textContent = '';
  $('#spell-feedback').className = 'spell-feedback';
  $('#spell-input').value = '';
  $('#spell-input').disabled = false;
  $('#spell-submit-btn').disabled = false;
  $('#spell-next-btn').classList.add('hidden');
  $('#spell-input').focus();
}

function handleSpellSubmit() {
  const w = state.quizWords[state.quizIndex];
  const input = $('#spell-input').value.trim().toLowerCase();
  const correct = w.w.toLowerCase();
  if (!input) return;

  if (input === correct) {
    $('#spell-feedback').textContent = '✓ 拼写正确！';
    $('#spell-feedback').className = 'spell-feedback correct';
    state.quizScore++;
  } else {
    $('#spell-feedback').textContent = `✗ 正确答案是：${w.w}`;
    $('#spell-feedback').className = 'spell-feedback wrong';
  }

  saveQuizStats(input === correct);
  $('#spell-next-btn').classList.remove('hidden');
  $('#spell-input').disabled = true;
  $('#spell-submit-btn').disabled = true;
}

function nextSpell() {
  state.quizIndex++;
  if (state.quizIndex >= state.quizWords.length) {
    $('#spell-meaning').textContent = '本轮结束！';
    $('#spell-phonetic').textContent = '';
    $('#spell-feedback').textContent = `得分：${state.quizScore} / ${state.quizWords.length}`;
    $('#spell-feedback').className = 'spell-feedback correct';
    $('#spell-input').value = '';
    $('#spell-next-btn').textContent = '再来一轮 →';
    $('#spell-next-btn').classList.remove('hidden');
    $('#spell-next-btn').onclick = () => {
      $('#spell-next-btn').textContent = '继续 →';
      $('#spell-next-btn').onclick = nextSpell;
      state.quizWords = [];
      state.quizIndex = 0;
      state.quizScore = 0;
      renderSpell();
    };
    return;
  }
  renderSpell();
}

/* ========== 测验统计存储 ========== */
function saveQuizStats(isCorrect) {
  const key = state.currentPack + '_' + state.currentCat;
  const stored = JSON.parse(localStorage.getItem('englearn_quiz_stats') || '{}');
  if (!stored[key]) stored[key] = { correct: 0, total: 0 };
  stored[key].total++;
  if (isCorrect) stored[key].correct++;
  localStorage.setItem('englearn_quiz_stats', JSON.stringify(stored));
  updateProgress();
}

/* ========== 移动端侧边栏 ========== */
function toggleSidebar() {
  $('#sidebar').classList.toggle('open');
  $('#overlay').classList.toggle('hidden');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.add('hidden');
}

/* ========== 事件绑定 ========== */
function bindEvents() {
  // 词汇包切换
  $$('.pack-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPack(btn.dataset.pack));
  });

  // 场景切换 - 侧边栏
  $('#cat-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn-sidebar');
    if (btn) switchCategory(btn.dataset.cat);
  });

  // 场景切换 - "全部"按钮
  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (btn.dataset.cat) switchCategory(btn.dataset.cat); });
  });

  // 场景切换 - 移动端
  $('#cat-scroll').addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (chip) switchCategory(chip.dataset.cat);
  });

  // 模式切换
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // 学习模式
  $('#flip-btn').addEventListener('click', flipCard);
  $('#flip-back-btn').addEventListener('click', flipCard);
  $('#known-btn').addEventListener('click', () => {
    if (state.wordPool.length === 0) return;
    const w = state.wordPool[state.currentIndex];
    if (w) setMastered(w.w, true);
    nextWord();
  });
  $('#review-btn').addEventListener('click', () => {
    if (state.wordPool.length === 0) return;
    const w = state.wordPool[state.currentIndex];
    if (w) setMastered(w.w, false);
    nextWord();
  });
  $('#skip-btn').addEventListener('click', nextWord);

  // 测验模式
  $('#quiz-next-btn').addEventListener('click', nextQuiz);

  // 拼写模式
  $('#spell-submit-btn').addEventListener('click', handleSpellSubmit);
  $('#spell-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleSpellSubmit(); });
  $('#spell-next-btn').addEventListener('click', nextSpell);

  // 主题切换
  $('#theme-toggle-desktop')?.addEventListener('click', toggleTheme);
  $('#theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  // 移动端菜单
  $('#menu-toggle').addEventListener('click', toggleSidebar);
  $('#overlay').addEventListener('click', closeSidebar);

  // 键盘快捷键（学习模式）
  document.addEventListener('keydown', e => {
    if (state.currentMode !== 'learn') return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowRight') nextWord();
  });
}

/* ========== 主题切换 ========== */
function getTheme() {
  return localStorage.getItem('englearn_theme') || 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('englearn_theme', theme);
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/* ========== 初始化 ========== */
function init() {
  // 应用保存的主题
  applyTheme(getTheme());

  loadProgress();

  // 验证当前 category 是否在数据中存在
  const data = getData();
  if (state.currentCat !== 'all' && !data[state.currentCat]) {
    state.currentCat = 'all';
  }

  // 渲染场景目录
  renderCategoryDirectory();
  updateCategoryActive();

  // 高亮当前词汇包
  $$('.pack-btn').forEach(b => b.classList.toggle('active', b.dataset.pack === state.currentPack));

  // 构建词汇池
  refreshPool();
  updateProgress();
  switchMode('learn');
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
