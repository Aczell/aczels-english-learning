/* ========== 辅助工具 ========== */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => (p || document).querySelectorAll(s);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ========== 掌握度等级 ========== */
const MASTERY = [
  { level: 0, label: '未学习',   icon: '○', color: 'var(--text-muted)' },
  { level: 1, label: '初识',     icon: '🌱', color: 'var(--dusty-rose)' },
  { level: 2, label: '了解',     icon: '🌿', color: 'var(--sage-light)' },
  { level: 3, label: '掌握',     icon: '🌳', color: 'var(--sage-dark)' },
  { level: 4, label: '熟练',     icon: '⭐', color: 'var(--warm-gold)' },
];

/* ========== 全局状态 ========== */
const state = {
  currentPack: 'cet6',
  currentCat: 'all',
  currentMode: 'learn',
  currentIndex: 0,
  wordPool: [],
  mastery: {},       // { "pack|word": 0-4 }
  notes: {},         // { "pack|word": "reflection text" }
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
  return Object.keys(data).map(k => ({
    key: k, name: data[k].name, icon: data[k].icon, count: data[k].words.length
  }));
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
  return data[state.currentCat].words.map(w => ({
    ...w, category: state.currentCat, categoryName: data[state.currentCat].name
  }));
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
  localStorage.setItem('englearn_mastery', JSON.stringify(state.mastery));
  localStorage.setItem('englearn_notes', JSON.stringify(state.notes));
  localStorage.setItem('englearn_pack', state.currentPack);
  localStorage.setItem('englearn_cat', state.currentCat);
}

function loadProgress() {
  try {
    const m = JSON.parse(localStorage.getItem('englearn_mastery'));
    if (m) state.mastery = m;
    const n = JSON.parse(localStorage.getItem('englearn_notes'));
    if (n) state.notes = n;
    // Migrate old boolean-format data
    const oldMastered = JSON.parse(localStorage.getItem('englearn_mastered'));
    if (oldMastered && !localStorage.getItem('englearn_mastery')) {
      Object.keys(oldMastered).forEach(k => {
        if (oldMastered[k] === true) state.mastery[k] = 3;
      });
    }
    const p = localStorage.getItem('englearn_pack');
    if (p && (p === 'cet6' || p === 'ielts')) state.currentPack = p;
    const c = localStorage.getItem('englearn_cat');
    if (c) state.currentCat = c;
  } catch (e) { /* ignore */ }
}

function getMasteryLevel(word) {
  return state.mastery[mkKey(word)] || 0;
}

function setMasteryLevel(word, level) {
  state.mastery[mkKey(word)] = level;
  saveProgress();
  updateProgress();
  updateMasteryUI();
  updateLevelBtns();
}

function getNote(word) {
  return state.notes[mkKey(word)] || '';
}

function setNote(word, text) {
  if (text.trim()) {
    state.notes[mkKey(word)] = text;
  } else {
    delete state.notes[mkKey(word)];
  }
  saveProgress();
}

/* ========== 进度更新 ========== */
function updateProgress() {
  const pool = state.wordPool;
  // 加权计数: 等级 1=0.25, 2=0.5, 3=0.75, 4=1.0
  const weightedSum = pool.reduce((s, w) => {
    const lv = getMasteryLevel(w.w);
    return s + (lv === 0 ? 0 : lv === 1 ? 0.25 : lv === 2 ? 0.5 : lv === 3 ? 0.75 : 1);
  }, 0);
  const masteredCount = pool.filter(w => getMasteryLevel(w.w) >= 3).length;
  $('#mastered-count').textContent = masteredCount;
  $('#total-count').textContent = pool.length;
  $('#progress-fill').style.width = pool.length ? (weightedSum / pool.length * 100) + '%' : '0%';

  const stored = JSON.parse(localStorage.getItem('englearn_quiz_stats') || '{}');
  const key = state.currentPack + '_' + state.currentCat;
  if (stored[key]) {
    const { correct, total } = stored[key];
    $('#accuracy').textContent = total ? Math.round(correct / total * 100) + '%' : '—';
  } else {
    $('#accuracy').textContent = '—';
  }
}

/* ========== 掌握度 UI ========== */
function updateMasteryUI() {
  if (state.currentMode !== 'learn' || state.wordPool.length === 0) return;
  const w = state.wordPool[state.currentIndex];
  if (!w) return;
  const lv = getMasteryLevel(w.w);
  const info = MASTERY[lv];

  // Dots
  $$('.mastery-dot').forEach(dot => {
    const dotLv = parseInt(dot.dataset.lv);
    dot.className = 'mastery-dot';
    if (dotLv <= lv) dot.classList.add('lv' + dotLv);
  });

  // Label
  $('#mastery-label').textContent = info.label;
  $('#mastery-label').style.color = info.color;
}

function updateLevelBtns() {
  if (state.currentMode !== 'learn' || state.wordPool.length === 0) return;
  const w = state.wordPool[state.currentIndex];
  if (!w) return;
  const lv = getMasteryLevel(w.w);

  $$('.level-btn').forEach(btn => {
    const btnLv = parseInt(btn.dataset.level);
    btn.classList.toggle('active', btnLv === lv);
  });
}

/* ========== 场景目录渲染 ========== */
function renderCategoryDirectory() {
  const cats = getAllCategories();
  const totalAll = cats.reduce((s, c) => s + c.count, 0);
  $('#cat-count-all').textContent = totalAll;

  const sidebarList = $('#cat-list');
  sidebarList.innerHTML = cats.map(c => `
    <button class="cat-btn-sidebar" data-cat="${c.key}">
      <span class="cat-icon">${c.icon}</span> ${c.name}
      <span class="cat-count">${c.count}</span>
    </button>
  `).join('');

  const mobileScroll = $('#cat-scroll');
  let html = `<button class="cat-chip active" data-cat="all">📋 全部</button>`;
  html += cats.map(c => `<button class="cat-chip" data-cat="${c.key}">${c.icon} ${c.name}</button>`).join('');
  mobileScroll.innerHTML = html;

  updateCategoryActive();
}

function updateCategoryActive() {
  $$('.cat-btn-sidebar').forEach(b => b.classList.toggle('active', b.dataset.cat === state.currentCat));
  $('#sidebar .cat-btn[data-cat="all"]')?.classList.toggle('active', state.currentCat === 'all');
  $$('.cat-btn').forEach(b => {
    if (b.dataset.cat === 'all') b.classList.toggle('active', state.currentCat === 'all');
  });
  $$('.cat-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === state.currentCat));

  const catInfo = state.currentCat === 'all' ? { name: '全部词汇', icon: '📋' } : getCatInfo(state.currentCat);
  if (catInfo) {
    $('#cat-indicator').innerHTML = `<span class="cat-indicator-text">${catInfo.icon} 当前场景：<strong>${catInfo.name}</strong></span>`;
  }
}

/* ========== 切换逻辑 ========== */
function switchCategory(cat) {
  state.currentCat = cat;
  saveProgress();
  updateCategoryActive();
  refreshPool();
  updateProgress();
  resetCurrentMode();
  closeSearch();
}

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
  closeSearch();
  $$('.pack-btn').forEach(b => b.classList.toggle('active', b.dataset.pack === pack));
}

function resetCurrentMode() { switchMode(state.currentMode); }

function switchMode(mode) {
  // 离开学习模式前，先瞬间把卡片翻回正面
  if (state.currentMode === 'learn' && mode !== 'learn') {
    const card = $('#card-inner');
    if (card.classList.contains('flipped')) {
      card.style.transition = 'none';
      card.classList.remove('flipped');
      void card.offsetHeight;
      card.style.transition = '';
    }
    if (state.wordPool.length > 0) {
      const w = state.wordPool[state.currentIndex];
      if (w) setNote(w.w, $('#notes-input').value);
    }
  }

  state.currentMode = mode;
  state.quizWords = [];
  state.quizIndex = 0;
  state.quizScore = 0;

  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#learn-mode').classList.add('hidden');
  $('#quiz-mode').classList.add('hidden');
  $('#spell-mode').classList.add('hidden');

  if (mode === 'learn') {
    if (state.wordPool.length === 0) return;
    $('#learn-mode').classList.remove('hidden');
    renderLearnMode();
  } else if (mode === 'meaning' || mode === 'word') {
    $('#quiz-mode').classList.remove('hidden');
    if (state.wordPool.length < 4) return;
    prepareQuizWords();
    renderQuiz();
  } else if (mode === 'spell') {
    $('#spell-mode').classList.remove('hidden');
    if (state.wordPool.length === 0) return;
    renderSpell();
  }
}

/* ========== 学习模式 ========== */
function renderLearnMode() {
  if (state.wordPool.length === 0) { refreshPool(); if (state.wordPool.length === 0) return; }
  if (state.currentIndex >= state.wordPool.length) {
    shuffle(state.wordPool);
    state.currentIndex = 0;
  }

  const w = state.wordPool[state.currentIndex];

  // 如果卡片处于翻转状态，先瞬间翻回正面再更新内容，避免看到新单词的释义
  const card = $('#card-inner');
  if (card.classList.contains('flipped')) {
    card.style.transition = 'none';
    card.classList.remove('flipped');
    // 强制回流，确保 transition: none 生效后再恢复
    void card.offsetHeight;
    card.style.transition = '';
  }

  $('#word-text').textContent = w.w;
  $('#phonetic-text').textContent = w.p;
  $('#meaning-text').textContent = w.m;
  $('#example-en').textContent = w.e;
  $('#example-zh').textContent = w.ez;

  // 反思笔记
  $('#notes-input').value = getNote(w.w);

  // 掌握度指示器
  updateMasteryUI();
  updateLevelBtns();
}

function flipCard() { $('#card-inner').classList.toggle('flipped'); }

function prevWord() {
  if (state.wordPool.length === 0) return;
  const w = state.wordPool[state.currentIndex];
  if (w) setNote(w.w, $('#notes-input').value);

  state.currentIndex--;
  if (state.currentIndex < 0) {
    state.currentIndex = state.wordPool.length - 1;
  }
  renderLearnMode();
}

function nextWord() {
  if (state.wordPool.length === 0) return;
  const w = state.wordPool[state.currentIndex];
  if (w) setNote(w.w, $('#notes-input').value);

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

function getOptions(correctWord) {
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

  const options = getOptions(w);
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
    // 答对自动提升掌握度
    const currentLv = getMasteryLevel(correct.w);
    if (currentLv < 4) setMasteryLevel(correct.w, currentLv + 1);
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
    const currentLv = getMasteryLevel(w.w);
    if (currentLv < 4) setMasteryLevel(w.w, currentLv + 1);
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

/* ========== 测验统计 ========== */
function saveQuizStats(isCorrect) {
  const key = state.currentPack + '_' + state.currentCat;
  const stored = JSON.parse(localStorage.getItem('englearn_quiz_stats') || '{}');
  if (!stored[key]) stored[key] = { correct: 0, total: 0 };
  stored[key].total++;
  if (isCorrect) stored[key].correct++;
  localStorage.setItem('englearn_quiz_stats', JSON.stringify(stored));
  updateProgress();
}

/* ========== 发音功能 ========== */
function getAccent() {
  return localStorage.getItem('englearn_accent') || 'us';
}

function setAccent(accent) {
  localStorage.setItem('englearn_accent', accent);
  $('#accent-btn').textContent = accent === 'uk' ? '🇬🇧' : '🇺🇸';
}

function getEnglishVoice() {
  const voices = speechSynthesis.getVoices();
  const accent = getAccent();
  const preferLang = accent === 'uk' ? 'en-GB' : 'en-US';

  // 精确匹配首选口音
  let voice = voices.find(v => v.lang === preferLang && v.localService);
  // 模糊匹配首选口音
  if (!voice) voice = voices.find(v => v.lang.startsWith(preferLang.substring(0, 4)) && v.localService);
  // 回退：同语系本地语音
  if (!voice) voice = voices.find(v => v.lang.startsWith('en-') && v.localService);
  // 任意英文语音
  if (!voice) voice = voices.find(v => v.lang.startsWith('en-'));
  // 系统默认
  if (!voice) voice = voices[0];

  return voice || null;
}

function speakWord(word) {
  speechSynthesis.cancel();
  const btn = $('#speak-btn');
  btn.classList.add('speaking');

  const utter = new SpeechSynthesisUtterance(word);
  utter.voice = getEnglishVoice();
  utter.lang = getAccent() === 'uk' ? 'en-GB' : 'en-US';
  utter.rate = 0.85;
  utter.pitch = 1;

  utter.onend = () => btn.classList.remove('speaking');
  utter.onerror = () => btn.classList.remove('speaking');

  speechSynthesis.speak(utter);
}

function toggleAccent() {
  setAccent(getAccent() === 'uk' ? 'us' : 'uk');
  // 如果正在学习模式，立即用新口音朗读当前单词
  if (state.currentMode === 'learn' && state.wordPool.length > 0) {
    const w = state.wordPool[state.currentIndex];
    if (w) speakWord(w.w);
  }
}

/* 预加载语音列表（部分浏览器异步获取） */
speechSynthesis.getVoices();

/* ========== 搜索功能 ========== */
let searchDebounceTimer = null;

function searchWords(query) {
  const q = query.trim().toLowerCase();
  const data = getData();
  const results = [];

  if (!q) return results;

  Object.keys(data).forEach(catKey => {
    const cat = data[catKey];
    cat.words.forEach(w => {
      if (w.w.toLowerCase().includes(q) || w.m.includes(q)) {
        results.push({ ...w, category: catKey, categoryName: cat.name });
      }
    });
  });

  // 精确匹配排前，前缀匹配次之
  results.sort((a, b) => {
    const aExact = a.w.toLowerCase() === q || a.m === q;
    const bExact = b.w.toLowerCase() === q || b.m === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    const aPrefix = a.w.toLowerCase().startsWith(q);
    const bPrefix = b.w.toLowerCase().startsWith(q);
    if (aPrefix && !bPrefix) return -1;
    if (!aPrefix && bPrefix) return 1;
    return 0;
  });

  return results;
}

function renderSearchResults(results) {
  const container = $('#search-results');
  container.innerHTML = '';

  if (!results.length) {
    container.innerHTML = '<div class="search-empty">未找到匹配的单词</div>';
    container.classList.remove('hidden');
    return;
  }

  results.slice(0, 30).forEach((w, i) => {
    const lv = getMasteryLevel(w.w);
    const lvInfo = MASTERY[lv];
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <span class="search-result-word">${w.w}</span>
      <span class="search-result-meaning">${w.m}</span>
      <span class="search-result-level" style="background:${lvInfo.color}20;color:${lvInfo.color}">${lvInfo.label}</span>
    `;
    item.addEventListener('click', () => selectSearchResult(w));
    item.addEventListener('mousedown', e => e.preventDefault()); // 防止blur先触发
    container.appendChild(item);
  });

  if (results.length > 30) {
    const more = document.createElement('div');
    more.className = 'search-empty';
    more.textContent = `还有 ${results.length - 30} 个结果，请输入更精确的关键词`;
    container.appendChild(more);
  }

  container.classList.remove('hidden');
}

function selectSearchResult(word) {
  // 先检查当前 pool 中是否有该词
  let idx = state.wordPool.findIndex(w => w.w === word.w);
  if (idx < 0) {
    // 不在当前场景，切换到 all 后重建 pool
    if (state.currentCat !== 'all') {
      state.currentCat = 'all';
      saveProgress();
      updateCategoryActive();
    }
    refreshPool();
    idx = state.wordPool.findIndex(w => w.w === word.w);
  }
  state.currentIndex = idx >= 0 ? idx : 0;
  // 切换到学习模式并渲染
  switchMode('learn');
  renderLearnMode();
  // 关闭搜索
  $('#search-results').classList.add('hidden');
  $('#search-input').value = '';
  $('#search-clear').classList.add('hidden');
}

function handleSearchInput() {
  const query = $('#search-input').value;
  if (query.trim()) {
    $('#search-clear').classList.remove('hidden');
  } else {
    $('#search-clear').classList.add('hidden');
    $('#search-results').classList.add('hidden');
    return;
  }

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const results = searchWords(query);
    renderSearchResults(results);
  }, 150);
}

function closeSearch() {
  $('#search-results').classList.add('hidden');
}

/* ========== 重置进度 ========== */
function resetProgress() {
  const pool = state.wordPool;
  if (pool.length === 0) return;

  // 构建确认消息
  const masteredInPool = pool.filter(w => getMasteryLevel(w.w) > 0).length;
  const notesInPool = pool.filter(w => getNote(w.w)).length;

  if (masteredInPool === 0 && notesInPool === 0) {
    alert('当前场景暂无掌握度或笔记可清除。');
    return;
  }

  let msg = `确定清除当前场景「${state.currentCat === 'all' ? '全部词汇' : getCatInfo(state.currentCat)?.name || state.currentCat}」的数据？\n\n`;
  if (masteredInPool > 0) msg += `• ${masteredInPool} 个单词的掌握度将被清零\n`;
  if (notesInPool > 0) msg += `• ${notesInPool} 条反思笔记将被删除\n`;

  if (!confirm(msg)) return;

  // 清除
  const prefix = state.currentPack + '|';
  pool.forEach(w => {
    const key = prefix + w.w;
    delete state.mastery[key];
    delete state.notes[key];
  });

  // 也清除测验统计
  const quizKey = state.currentPack + '_' + state.currentCat;
  const quizStats = JSON.parse(localStorage.getItem('englearn_quiz_stats') || '{}');
  delete quizStats[quizKey];
  localStorage.setItem('englearn_quiz_stats', JSON.stringify(quizStats));

  saveProgress();
  updateProgress();

  if (state.currentMode === 'learn') {
    updateMasteryUI();
    updateLevelBtns();
    $('#notes-input').value = '';
  }
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
  $$('.pack-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPack(btn.dataset.pack));
  });

  $('#cat-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn-sidebar');
    if (btn) switchCategory(btn.dataset.cat);
  });

  $$('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (btn.dataset.cat) switchCategory(btn.dataset.cat); });
  });

  $('#cat-scroll').addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (chip) switchCategory(chip.dataset.cat);
  });

  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });

  // 学习模式 - 卡片翻转
  $('#flip-btn').addEventListener('click', flipCard);
  $('#flip-back-btn').addEventListener('click', flipCard);

  // 发音按钮
  $('#speak-btn').addEventListener('click', () => {
    if (state.wordPool.length === 0) return;
    const w = state.wordPool[state.currentIndex];
    if (w) speakWord(w.w);
  });

  // 口音切换
  $('#accent-btn').addEventListener('click', toggleAccent);

  // 掌握度等级按钮
  $$('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.wordPool.length === 0) return;
      const w = state.wordPool[state.currentIndex];
      if (w) setMasteryLevel(w.w, parseInt(btn.dataset.level));
    });
  });

  // 掌握度圆点点击
  $('#mastery-indicator').addEventListener('click', (e) => {
    const dot = e.target.closest('.mastery-dot');
    if (!dot || state.wordPool.length === 0) return;
    const w = state.wordPool[state.currentIndex];
    if (w) setMasteryLevel(w.w, parseInt(dot.dataset.lv));
  });

  // 上一个 / 下一个
  $('#prev-btn').addEventListener('click', prevWord);
  $('#skip-btn').addEventListener('click', nextWord);

  // 笔记自动保存（失焦时）
  $('#notes-input').addEventListener('blur', () => {
    if (state.wordPool.length === 0) return;
    const w = state.wordPool[state.currentIndex];
    if (w) setNote(w.w, $('#notes-input').value);
  });

  // 重置进度
  $('#reset-btn').addEventListener('click', resetProgress);

  // 测验
  $('#quiz-next-btn').addEventListener('click', nextQuiz);

  // 拼写
  $('#spell-submit-btn').addEventListener('click', handleSpellSubmit);
  $('#spell-input').addEventListener('keydown', e => { if (e.key === 'Enter') handleSpellSubmit(); });
  $('#spell-next-btn').addEventListener('click', nextSpell);

  // 主题
  $('#theme-toggle-desktop')?.addEventListener('click', toggleTheme);
  $('#theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  // 搜索
  $('#search-input').addEventListener('input', handleSearchInput);
  $('#search-input').addEventListener('focus', () => {
    if ($('#search-input').value.trim()) handleSearchInput();
  });
  $('#search-input').addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); $('#search-input').blur(); }
  });
  $('#search-clear').addEventListener('click', () => {
    $('#search-input').value = '';
    $('#search-clear').classList.add('hidden');
    $('#search-results').classList.add('hidden');
    $('#search-input').focus();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-area')) closeSearch();
  });

  // 移动端菜单
  $('#menu-toggle').addEventListener('click', toggleSidebar);
  $('#overlay').addEventListener('click', closeSidebar);

  // 键盘快捷键
  document.addEventListener('keydown', e => {
    if (state.currentMode !== 'learn') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevWord(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextWord(); }
    if (e.key === 's' && state.wordPool.length > 0) {
      const w = state.wordPool[state.currentIndex];
      if (w) speakWord(w.w);
    }
    // 数字键 1-4 快速设置掌握度
    if (e.key >= '1' && e.key <= '4' && state.wordPool.length > 0) {
      const w = state.wordPool[state.currentIndex];
      if (w) setMasteryLevel(w.w, parseInt(e.key));
    }
  });
}

/* ========== 主题切换 ========== */
function getTheme() { return localStorage.getItem('englearn_theme') || 'light'; }
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('englearn_theme', theme);
}
function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/* ========== 初始化 ========== */
function init() {
  applyTheme(getTheme());
  loadProgress();
  setAccent(getAccent());

  const data = getData();
  if (state.currentCat !== 'all' && !data[state.currentCat]) {
    state.currentCat = 'all';
  }

  renderCategoryDirectory();
  updateCategoryActive();
  $$('.pack-btn').forEach(b => b.classList.toggle('active', b.dataset.pack === state.currentPack));

  refreshPool();
  updateProgress();
  // 首次加载不播放入场动画
  $('#learn-mode').classList.add('no-anim');
  switchMode('learn');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $('#learn-mode').classList.remove('no-anim');
    });
  });
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
