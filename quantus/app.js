'use strict';

/* ===================================================================
   Quantus — app.js

   تنظيم الملف:
   1. الترجمة (translations)
   2. إعدادات الطور (DIFFICULTY_CONFIG)
   3. الحالة العامة (state)
   4. عناصر الـ DOM
   5. أدوات رياضية/عشوائية مساعدة
   6. مولّدات الأسئلة لكل نمط (دوال نقية — لا تلمس DOM ولا state)
   7. generateQuestion() + checkAnswer() — الواجهة العامة لمحرك الأسئلة
   8. Game Runtime — يدير اللعب الحي (سؤال واحد بالذاكرة، مؤقت، نتيجة)
   9. التنقل بين الشاشات + ربط الأحداث + نقطة الانطلاق
   =================================================================== */

/* ------------------------- 1) كائن الترجمة ------------------------- */
const translations = {
  ar: {
    startSubtitle: 'تحديات رياضية سريعة، اختبر سرعة بديهتك',
    startBtn: 'ابدأ اللعبة',

    backBtn: 'رجوع',

    difficultyTitle: 'اختر الطور',
    difficultySubtitle: 'كل طور يغيّر سرعة العد التنازلي ونطاق الأرقام وعدد الأسئلة',
    difficultyEasy: 'سهل',
    difficultyEasyDesc: 'أرقام صغيرة ووقت أطول',
    difficultyMedium: 'متوسط',
    difficultyMediumDesc: 'توازن بين السرعة والصعوبة',
    difficultyHard: 'صعب',
    difficultyHardDesc: 'أرقام كبيرة ووقت قصير',

    modeTitle: 'اختر نمط اللعب',
    modeSubtitle: 'كل نمط له نوع تحدٍ مختلف',
    modeAddition: 'جمع',
    modeSubtraction: 'طرح',
    modeMultiplication: 'ضرب',
    modeDivision: 'قسمة',
    modePattern: 'إيجاد النمط',
    modeExponents: 'الأسس',

    hudQuestion: 'السؤال',
    hudScore: 'النتيجة',
    hudTime: 'الوقت',
    confirmBtn: 'تأكيد',

    resultTitle: 'انتهت اللعبة!',
    newHighScoreBadge: '🎉 رقم قياسي جديد!',
    resultScoreLabel: 'النقاط الكلية',
    resultCorrectLabel: 'الإجابات الصحيحة',
    resultStreakLabel: 'أطول سلسلة',
    resultBestLabel: 'أفضل نتيجة',
    playAgainBtn: 'العب مرة ثانية',
    homeBtn: 'الرئيسية',
  },

  en: {
    startSubtitle: 'Fast-paced math challenges, test your quick thinking',
    startBtn: 'Start Game',

    backBtn: 'Back',

    difficultyTitle: 'Choose Difficulty',
    difficultySubtitle: 'Each difficulty changes the countdown speed, number range, and question count',
    difficultyEasy: 'Easy',
    difficultyEasyDesc: 'Small numbers, more time',
    difficultyMedium: 'Medium',
    difficultyMediumDesc: 'Balanced speed and difficulty',
    difficultyHard: 'Hard',
    difficultyHardDesc: 'Big numbers, less time',

    modeTitle: 'Choose Game Mode',
    modeSubtitle: 'Each mode offers a different type of challenge',
    modeAddition: 'Addition',
    modeSubtraction: 'Subtraction',
    modeMultiplication: 'Multiplication',
    modeDivision: 'Division',
    modePattern: 'Pattern Finding',
    modeExponents: 'Exponents',

    hudQuestion: 'Question',
    hudScore: 'Score',
    hudTime: 'Time',
    confirmBtn: 'Confirm',

    resultTitle: 'Game Over!',
    newHighScoreBadge: '🎉 New High Score!',
    resultScoreLabel: 'Total Score',
    resultCorrectLabel: 'Correct Answers',
    resultStreakLabel: 'Longest Streak',
    resultBestLabel: 'Best Score',
    playAgainBtn: 'Play Again',
    homeBtn: 'Home',
  },
};

/* ------------------------- 2) إعدادات كل طور -------------------------
   تتحكم بسرعة العد التنازلي والنقاط الأساسية لكل سؤال. نطاق الأرقام
   الفعلي لكل نمط محدد داخل مولّد ذلك النمط نفسه لأن كل نمط له نطاقات
   مختلفة تمامًا. */
const DIFFICULTY_CONFIG = {
  easy: { countdownSeconds: 15, basePoints: 10 },
  medium: { countdownSeconds: 10, basePoints: 20 },
  hard: { countdownSeconds: 6, basePoints: 35 },
};

// عدد الأسئلة بكل جولة — ثابت لكل الأطوار
const ROUND_LENGTH = 10;

// مدة عرض التغذية الراجعة (أخضر/أحمر) قبل الانتقال للسؤال التالي
const FEEDBACK_DELAY_MS = 500;

/* ------------------------- إعدادات نظام النقاط ------------------------- */
const SPEED_BONUS_RATIO = 0.5; // نسبة النقاط الإضافية إذا أجاب بأقل من نصف الوقت
const STREAK_THRESHOLD = 3; // عدد الإجابات المتتالية اللازم لتفعيل مضاعف السلسلة
const STREAK_MULTIPLIER = 1.5;

/* ------------------------- 3) كائن الحالة (State) -------------------------
   حالة اللعب الحي (currentQuestion, score...) هنا أيضًا — بدون أي مصفوفة
   تتراكم فيها كل الأسئلة، فقط آخر سؤالين لمنع التكرار المباشر. */
const state = {
  lang: localStorage.getItem('quantus_lang') || 'ar',
  soundOn: localStorage.getItem('quantus_sound') !== 'off',
  difficulty: null,
  mode: null,
  currentScreen: 'start',

  currentQuestion: null, // السؤال الحالي فقط — يُستبدل بالكامل عند كل سؤال جديد
  recentQuestions: [], // آخر سؤالين (نص) فقط، لمنع تكرار نفس السؤال مباشرة
  score: 0,
  correctCount: 0, // عدد الإجابات الصحيحة من أصل ROUND_LENGTH
  currentStreak: 0, // يزيد بكل إجابة صحيحة متتالية، يرجع صفر عند أي خطأ/تايم آوت
  longestStreak: 0, // أطول سلسلة تحققت خلال الجولة الحالية
  questionIndex: 0,
  timerId: null,
  timeLeft: 0,
  questionStartTime: 0, // وقت بدء السؤال الحالي (Date.now()) — لحساب مكافأة السرعة بدقة
};

/* ------------------------- 4) عناصر DOM ثابتة ------------------------- */
const htmlEl = document.documentElement;
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langToggleLabel = document.getElementById('lang-toggle-label');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const screens = document.querySelectorAll('.screen');

const hudQuestionCountEl = document.getElementById('hud-question-count');
const hudScoreEl = document.getElementById('hud-score');
const hudTimeEl = document.getElementById('hud-time');
const timerBarFillEl = document.getElementById('timer-bar-fill');
const questionTextEl = document.getElementById('question-text');
const optionsGridEl = document.getElementById('options-grid');
const inputAnswerAreaEl = document.getElementById('input-answer-area');
const answerInputEl = document.getElementById('answer-input');
const confirmAnswerBtn = document.getElementById('confirm-answer-btn');
const streakIndicatorEl = document.getElementById('streak-indicator');
const streakCountEl = document.getElementById('streak-count');
const gamePlayViewEl = document.getElementById('game-play-view');
const gameResultViewEl = document.getElementById('game-result-view');
const newHighScoreBadgeEl = document.getElementById('new-high-score-badge');
const resultScoreValueEl = document.getElementById('result-score-value');
const resultCorrectCountEl = document.getElementById('result-correct-count');
const resultLongestStreakEl = document.getElementById('result-longest-streak');
const resultHighScoreEl = document.getElementById('result-high-score');

/* ------------------------- 5) أدوات رياضية/عشوائية مساعدة ------------------------- */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* ------------------------- 6) مولّدات الأسئلة لكل نمط ------------------------- */

// جمع / طرح
function generateAdditionSubtraction(mode, difficulty) {
  const isAddition = mode === 'addition';
  const sign = isAddition ? '+' : '-';
  let a, b;
  let extraTerm = null;

  if (difficulty === 'easy') {
    a = randInt(1, 20);
    b = randInt(1, 20);
  } else if (difficulty === 'medium') {
    a = randInt(10, 100);
    b = randInt(10, 100);
  } else {
    a = randInt(50, 500);
    b = randInt(50, 500);
    if (Math.random() < 0.5) extraTerm = randInt(10, 200); // احتمال عملية ثالثة بالطور الصعب
  }

  // بالطرح نضمن أن الناتج غير سالب
  if (!isAddition && a < b) [a, b] = [b, a];

  let expression = `${a} ${sign} ${b}`;
  let answer = isAddition ? a + b : a - b;

  if (extraTerm !== null) {
    const extraSign = Math.random() < 0.5 ? '+' : '-';
    // إذا الطرح الإضافي بيخلي الناتج سالب، نستبدله بجمع لضمان نتيجة موجبة
    const safeSign = extraSign === '-' && answer < extraTerm ? '+' : extraSign;
    answer = safeSign === '+' ? answer + extraTerm : answer - extraTerm;
    expression += ` ${safeSign} ${extraTerm}`;
  }

  return { question: expression, answer };
}

// ضرب
function generateMultiplication(difficulty) {
  let a, b;
  if (difficulty === 'easy') {
    a = randInt(1, 10);
    b = randInt(1, 10);
  } else if (difficulty === 'medium') {
    a = randInt(2, 20);
    b = randInt(2, 20);
  } else {
    a = randInt(10, 99);
    b = randInt(10, 99);
  }
  return { question: `${a} × ${b}`, answer: a * b };
}

// قسمة — دائمًا ناتج صحيح بدون باقي (نبني المقسوم من الناتج × المقسوم عليه)
function generateDivision(difficulty) {
  let quotient, divisor;
  if (difficulty === 'easy') {
    quotient = randInt(1, 10);
    divisor = randInt(1, 10);
  } else if (difficulty === 'medium') {
    quotient = randInt(1, 20);
    divisor = randInt(2, 12);
  } else {
    quotient = randInt(1, 50);
    divisor = randInt(2, 25);
  }
  const dividend = quotient * divisor;
  return { question: `${dividend} ÷ ${divisor}`, answer: quotient };
}

// إيجاد النمط — نعرض 4-5 حدود ونطلب الحد التالي
function buildArithmeticSequence(start, step, length) {
  const seq = [start];
  for (let i = 1; i < length; i++) seq.push(seq[i - 1] + step);
  return seq;
}

function buildGeometricSequence(start, factor, length) {
  const seq = [start];
  for (let i = 1; i < length; i++) seq.push(seq[i - 1] * factor);
  return seq;
}

function generatePattern(difficulty) {
  const length = randInt(4, 5);
  let terms;
  let next;

  if (difficulty === 'easy') {
    // قاعدة جمع/طرح ثابت بسيط
    const step = pickRandom([2, 3, 4, 5, -2, -3, -4]);
    // بداية كافية تضمن عدم الوصول لأرقام سالبة حتى مع أكبر طول متتالية (5 حدود + الحد التالي)
    const start = step >= 0 ? randInt(1, 20) : randInt(Math.abs(step) * 6, Math.abs(step) * 6 + 20);
    terms = buildArithmeticSequence(start, step, length);
    next = terms[terms.length - 1] + step;
  } else if (difficulty === 'medium') {
    if (Math.random() < 0.5) {
      // قاعدة ضرب ثابت
      const start = randInt(2, 5);
      const factor = randInt(2, 3);
      terms = buildGeometricSequence(start, factor, length);
      next = terms[terms.length - 1] * factor;
    } else {
      // قاعدة طرح متغير: الفرق بين الحدود يكبر تدريجيًا
      const start = randInt(60, 120);
      const baseStep = randInt(2, 4);
      const stepIncrement = randInt(1, 2);
      terms = [start];
      let step = baseStep;
      for (let i = 1; i < length; i++) {
        terms.push(terms[i - 1] - step);
        step += stepIncrement;
      }
      next = terms[terms.length - 1] - step;
    }
  } else {
    // قاعدة مركبة: ×2 ثم +ثابت بالتناوب
    const start = randInt(2, 6);
    const addend = randInt(1, 3);
    terms = [start];
    for (let i = 1; i < length; i++) {
      terms.push(i % 2 === 1 ? terms[i - 1] * 2 : terms[i - 1] + addend);
    }
    next = length % 2 === 1 ? terms[terms.length - 1] * 2 : terms[terms.length - 1] + addend;
  }

  const separator = state.lang === 'ar' ? '، ' : ', ';
  const questionMark = state.lang === 'ar' ? '؟' : '?';
  const question = `${terms.join(separator)}${separator}${questionMark}`;

  return { question, answer: next };
}

// الأسس
function generateExponents(difficulty) {
  let base, exp;
  if (difficulty === 'easy') {
    base = randInt(2, 5);
    exp = 2;
  } else if (difficulty === 'medium') {
    base = randInt(2, 10);
    exp = randInt(2, 3);
  } else {
    base = randInt(2, 12);
    exp = randInt(2, 4);
  }
  const superscripts = { 2: '²', 3: '³', 4: '⁴' };
  return { question: `${base}${superscripts[exp]}`, answer: base ** exp };
}

/* ------------------------- 7) الواجهة العامة لمحرك الأسئلة ------------------------- */

// يبني خيارات إجابة (4 خيارات فريدة) قريبة من الإجابة الصحيحة
function generateOptions(correct) {
  const options = new Set([correct]);
  const spread = Math.max(2, Math.round(Math.abs(correct) * 0.2));
  let guard = 0;

  while (options.size < 4 && guard < 50) {
    const offset = randInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = correct + offset;
    if (candidate >= 0) options.add(candidate);
    guard++;
  }

  // احتياط نادر (أرقام صغيرة جدًا ما تكفي لتوليد 4 خيارات مختلفة)
  let filler = correct + 101;
  while (options.size < 4) options.add(filler++);

  return shuffleArray([...options]);
}

function buildRawQuestion(mode, difficulty) {
  switch (mode) {
    case 'addition':
    case 'subtraction':
      return generateAdditionSubtraction(mode, difficulty);
    case 'multiplication':
      return generateMultiplication(difficulty);
    case 'division':
      return generateDivision(difficulty);
    case 'pattern':
      return generatePattern(difficulty);
    case 'exponents':
      return generateExponents(difficulty);
    default:
      throw new Error(`Unknown game mode: ${mode}`);
  }
}

/**
 * يولّد سؤالًا واحدًا فقط عند الطلب (lazy) — لا يخزّن أي أرشيف من الأسئلة.
 * @param {string} mode - جمع/طرح/ضرب/قسمة/نمط/أسس
 * @param {string} difficulty - easy/medium/hard
 * @returns {{question: string, answer: number, options: number[]}}
 */
function generateQuestion(mode, difficulty) {
  let raw;
  let attempts = 0;

  // نحاول تفادي تكرار نفس نص السؤال مباشرة (نقارن بآخر سؤالين فقط)
  do {
    raw = buildRawQuestion(mode, difficulty);
    attempts++;
  } while (state.recentQuestions.includes(raw.question) && attempts < 10);

  state.recentQuestions.push(raw.question);
  if (state.recentQuestions.length > 2) state.recentQuestions.shift();

  return {
    question: raw.question,
    answer: raw.answer,
    options: generateOptions(raw.answer),
  };
}

/**
 * يقارن إجابة اللاعب بالإجابة الصحيحة.
 * يرفض صراحة الإدخال الفاضي/الفراغات فقط/غير الرقمي بدل الاعتماد على تحويل
 * Number() الضمني (اللي كان يحوّل '' إلى 0 ويعطي true بالغلط لو الإجابة 0).
 * @returns {boolean}
 */
function checkAnswer(userInput, correctAnswer) {
  if (userInput === null || userInput === undefined) return false;

  const trimmed = typeof userInput === 'string' ? userInput.trim() : userInput;
  if (trimmed === '') return false;

  const numericInput = Number(trimmed);
  if (Number.isNaN(numericInput)) return false;

  return numericInput === Number(correctAnswer);
}

/**
 * يحسب نقاط إجابة صحيحة واحدة (دالة نقية — لا تلمس state).
 * الترتيب: نقاط أساسية حسب الطور -> + مكافأة سرعة (50% إذا أقل من نص الوقت)
 * -> × 1.5 إذا وصلت السلسلة (بعد احتساب هذه الإجابة) لـ 3 فأكثر.
 * @param {string} difficulty - easy/medium/hard
 * @param {number} elapsedSeconds - الوقت المستغرق فعليًا للإجابة
 * @param {number} totalSeconds - الوقت الكلي المتاح للسؤال (DIFFICULTY_CONFIG)
 * @param {number} streakBefore - عدد الإجابات الصحيحة المتتالية قبل هذه الإجابة
 * @returns {{points: number, newStreak: number}}
 */
function calculatePoints(difficulty, elapsedSeconds, totalSeconds, streakBefore) {
  const basePoints = DIFFICULTY_CONFIG[difficulty].basePoints;
  const speedBonus = elapsedSeconds < totalSeconds / 2 ? basePoints * SPEED_BONUS_RATIO : 0;
  const subtotal = basePoints + speedBonus;

  const newStreak = streakBefore + 1;
  const multiplier = newStreak >= STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1;

  return { points: Math.round(subtotal * multiplier), newStreak };
}

/**
 * مفتاح localStorage لأفضل نتيجة لكل تركيبة (نمط + طور).
 */
function highScoreKey(mode, difficulty) {
  return `quantus_highscore_${mode}_${difficulty}`;
}

function getHighScore(mode, difficulty) {
  return Number(localStorage.getItem(highScoreKey(mode, difficulty))) || 0;
}

function setHighScore(mode, difficulty, score) {
  localStorage.setItem(highScoreKey(mode, difficulty), String(score));
}

/* ===================== أدوات تصحيح مؤقتة (Debug) ===================== */

/**
 * تطبع 18 حالة (6 أنماط × 3 أطوار) عبر generateQuestion() في الكونسول
 * للمراجعة اليدوية السريعة. استدعها يدويًا من كونسول المتصفح: debugTestQuestions()
 * دالة مؤقتة لمرحلة الاختبار — ما تُستدعى تلقائيًا بأي مكان بالتطبيق.
 */
function debugTestQuestions() {
  const modes = ['addition', 'subtraction', 'multiplication', 'division', 'pattern', 'exponents'];
  const difficulties = ['easy', 'medium', 'hard'];
  const rows = [];

  modes.forEach((mode) => {
    difficulties.forEach((difficulty) => {
      const q = generateQuestion(mode, difficulty);
      rows.push({
        mode,
        difficulty,
        question: q.question,
        answer: q.answer,
        options: q.options ? q.options.join(' / ') : 'null (إدخال مباشر)',
      });
    });
  });

  console.table(rows);
  return rows;
}

/* ===================== 8) Game Runtime — إدارة اللعب الحي ===================== */

function startGame() {
  resetRoundStats();

  gameResultViewEl.classList.add('hidden');
  gamePlayViewEl.classList.remove('hidden');
  hudScoreEl.textContent = '0';
  updateStreakIndicatorUI();

  loadNextQuestion();
}

/**
 * يصفّر إحصائيات الجولة (نقاط/سلسلة/إجابات صحيحة) بدون التأثير على
 * الطور/النمط/اللغة/الصوت المختارين.
 */
function resetRoundStats() {
  state.score = 0;
  state.correctCount = 0;
  state.currentStreak = 0;
  state.longestStreak = 0;
  state.questionIndex = 0;
  state.recentQuestions = [];
  state.currentQuestion = null;
}

function loadNextQuestion() {
  if (state.questionIndex >= ROUND_LENGTH) {
    endGame();
    return;
  }

  // نستبدل currentQuestion بسؤال جديد — القيمة القديمة تُهمل ويتكفل بها الـ GC
  state.currentQuestion = generateQuestion(state.mode, state.difficulty);
  state.questionIndex++;

  renderQuestion();
  startTimer(DIFFICULTY_CONFIG[state.difficulty].countdownSeconds);
}

function renderQuestion() {
  hudQuestionCountEl.textContent = `${state.questionIndex} / ${ROUND_LENGTH}`;
  questionTextEl.textContent = state.currentQuestion.question;

  if (state.currentQuestion.options) {
    // اختيار من متعدد
    inputAnswerAreaEl.classList.add('hidden');
    optionsGridEl.classList.remove('hidden');
    optionsGridEl.innerHTML = '';
    state.currentQuestion.options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-card answer-option';
      btn.textContent = option;
      btn.addEventListener('click', () => finishQuestion(option, btn));
      optionsGridEl.appendChild(btn);
    });
  } else {
    // إدخال مباشر
    optionsGridEl.classList.add('hidden');
    optionsGridEl.innerHTML = '';
    inputAnswerAreaEl.classList.remove('hidden');
    answerInputEl.value = '';
    answerInputEl.disabled = false;
    answerInputEl.classList.remove('correct', 'wrong');
    confirmAnswerBtn.disabled = false;
    answerInputEl.focus();
  }
}

function handleInputConfirm() {
  if (answerInputEl.disabled) return;
  const value = answerInputEl.value === '' ? null : Number(answerInputEl.value);
  finishQuestion(value, answerInputEl);
}

function startTimer(totalSeconds) {
  stopTimer();
  state.timeLeft = totalSeconds;
  state.questionStartTime = Date.now(); // لحساب مكافأة السرعة بدقة (أدق من عدّاد الثواني)
  updateTimerUI(totalSeconds, totalSeconds);

  state.timerId = setInterval(() => {
    state.timeLeft--;
    updateTimerUI(state.timeLeft, totalSeconds);

    if (state.timeLeft <= 0) {
      stopTimer();
      finishQuestion(null, null); // انتهاء الوقت = إجابة خاطئة تلقائيًا
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateTimerUI(secondsLeft, totalSeconds) {
  const clamped = Math.max(secondsLeft, 0);
  hudTimeEl.textContent = clamped;
  const percent = (clamped / totalSeconds) * 100;
  timerBarFillEl.style.width = `${percent}%`;
  timerBarFillEl.classList.toggle('low-time', clamped <= totalSeconds * 0.3);
}

/**
 * ينهي السؤال الحالي (سواء بضغطة خيار، تأكيد إدخال، أو انتهاء الوقت)،
 * يعرض تغذية راجعة سريعة، ثم ينتقل للسؤال التالي عبر generateQuestion().
 * @param {number|null} selectedValue - إجابة اللاعب، أو null إذا انتهى الوقت بدون إجابة
 * @param {HTMLElement|null} feedbackEl - العنصر اللي يُلوَّن (زر الخيار أو حقل الإدخال)
 */
function finishQuestion(selectedValue, feedbackEl) {
  stopTimer();

  // تعطيل كل عناصر الإدخال (أزرار أو حقل الإدخال) لمنع إجابة مزدوجة لنفس السؤال
  optionsGridEl.querySelectorAll('.answer-option').forEach((btn) => (btn.disabled = true));
  answerInputEl.disabled = true;
  confirmAnswerBtn.disabled = true;

  const isCorrect = selectedValue !== null && checkAnswer(selectedValue, state.currentQuestion.answer);

  if (isCorrect) {
    const totalSeconds = DIFFICULTY_CONFIG[state.difficulty].countdownSeconds;
    const elapsedSeconds = (Date.now() - state.questionStartTime) / 1000;
    const { points, newStreak } = calculatePoints(state.difficulty, elapsedSeconds, totalSeconds, state.currentStreak);

    state.score += points;
    state.correctCount++;
    state.currentStreak = newStreak;
    state.longestStreak = Math.max(state.longestStreak, newStreak);

    if (feedbackEl) feedbackEl.classList.add('correct');
  } else {
    // إجابة خاطئة أو انتهاء وقت: صفر نقاط لهذا السؤال، وكسر السلسلة فورًا
    state.currentStreak = 0;
    if (feedbackEl) feedbackEl.classList.add('wrong');
  }

  // باختيار من متعدد: نبرز الإجابة الصحيحة دائمًا حتى لو اللاعب أخطأ أو ما جاوب
  optionsGridEl.querySelectorAll('.answer-option').forEach((btn) => {
    if (Number(btn.textContent) === state.currentQuestion.answer) {
      btn.classList.add('correct');
    }
  });

  hudScoreEl.textContent = state.score;
  updateStreakIndicatorUI();

  // نمسح الـ interval فورًا (فوق) ثم نمنح وقت قصير لعرض اللون قبل توليد السؤال التالي
  setTimeout(loadNextQuestion, FEEDBACK_DELAY_MS);
}

/**
 * مؤشر السلسلة "🔥 N" يظهر فقط لما تكون السلسلة نشطة (فعّلت المضاعف بالفعل).
 */
function updateStreakIndicatorUI() {
  if (state.currentStreak >= STREAK_THRESHOLD) {
    streakCountEl.textContent = state.currentStreak;
    streakIndicatorEl.classList.remove('hidden');
  } else {
    streakIndicatorEl.classList.add('hidden');
  }
}

function endGame() {
  gamePlayViewEl.classList.add('hidden');
  gameResultViewEl.classList.remove('hidden');

  resultScoreValueEl.textContent = state.score;
  resultCorrectCountEl.textContent = `${state.correctCount} / ${ROUND_LENGTH}`;
  resultLongestStreakEl.textContent = state.longestStreak;

  const previousHighScore = getHighScore(state.mode, state.difficulty);
  const isNewHighScore = state.score > previousHighScore;

  if (isNewHighScore) {
    setHighScore(state.mode, state.difficulty, state.score);
    newHighScoreBadgeEl.classList.remove('hidden');
    resultHighScoreEl.textContent = state.score;
  } else {
    newHighScoreBadgeEl.classList.add('hidden');
    resultHighScoreEl.textContent = previousHighScore;
  }
}

/* ===================== 9) الترجمة الديناميكية ===================== */
function applyTranslations() {
  const dict = translations[state.lang];

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  htmlEl.setAttribute('lang', state.lang);
  htmlEl.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
  langToggleLabel.textContent = state.lang === 'ar' ? 'EN' : 'AR';
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('quantus_lang', lang);
  applyTranslations();
}

function toggleLanguage() {
  setLanguage(state.lang === 'ar' ? 'en' : 'ar');
}

/* ===================== إعدادات الصوت ===================== */
function applySoundIcon() {
  soundIcon.textContent = state.soundOn ? '🔊' : '🔇';
  soundToggleBtn.setAttribute('aria-pressed', String(!state.soundOn));
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  localStorage.setItem('quantus_sound', state.soundOn ? 'on' : 'off');
  applySoundIcon();
}

/* ===================== التنقل بين الشاشات ===================== */
function goToScreen(screenName) {
  // نوقف أي مؤقت شغال قبل أي تنقل بين الشاشات — يمنع تراكم عدة intervals
  // (لو كنا بشاشة اللعب وطالعين منها لغيرها). ما يأثر إذا ما فيه مؤقت شغال أصلًا.
  stopTimer();

  state.currentScreen = screenName;
  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === screenName);
  });
}

/* ===================== ربط الأحداث ===================== */
function initEvents() {
  langToggleBtn.addEventListener('click', toggleLanguage);
  soundToggleBtn.addEventListener('click', toggleSound);

  document.getElementById('start-game-btn').addEventListener('click', () => {
    goToScreen('difficulty');
  });

  document.querySelectorAll('[data-action="back-to-start"]').forEach((btn) => {
    btn.addEventListener('click', () => goToScreen('start'));
  });

  document.querySelectorAll('[data-action="back-to-difficulty"]').forEach((btn) => {
    btn.addEventListener('click', () => goToScreen('difficulty'));
  });

  // الرجوع لشاشة الأنماط أثناء اللعب — goToScreen توقف المؤقت تلقائيًا
  document.querySelectorAll('[data-action="quit-game"]').forEach((btn) => {
    btn.addEventListener('click', () => goToScreen('mode'));
  });

  // اختيار الطور
  document.querySelectorAll('[data-difficulty]').forEach((card) => {
    card.addEventListener('click', () => {
      state.difficulty = card.dataset.difficulty;
      goToScreen('mode');
    });
  });

  // اختيار النمط -> يبدأ اللعبة فعليًا
  document.querySelectorAll('[data-mode]').forEach((card) => {
    card.addEventListener('click', () => {
      state.mode = card.dataset.mode;
      goToScreen('game');
      startGame();
    });
  });

  // من شاشة النتيجة: "العب مرة ثانية" يرجع لاختيار الطور والنمط، "الرئيسية" يرجع للبداية
  // (goToScreen توقف المؤقت تلقائيًا؛ resetRoundStats يصفّر النقاط/السلسلة/عدد الصحيح)
  document.getElementById('play-again-btn').addEventListener('click', () => {
    resetRoundStats();
    goToScreen('difficulty');
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    resetRoundStats();
    goToScreen('start');
  });

  // نمط الإدخال المباشر (options === null): زر التأكيد أو مفتاح Enter
  confirmAnswerBtn.addEventListener('click', handleInputConfirm);
  answerInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleInputConfirm();
  });
}

/* ===================== نقطة الانطلاق ===================== */
function init() {
  applyTranslations();
  applySoundIcon();
  goToScreen(state.currentScreen);
  initEvents();
}

document.addEventListener('DOMContentLoaded', init);
