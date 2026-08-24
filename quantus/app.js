'use strict';

/* ===================================================================
   Quantus — app.js
   إدارة الحالة، الترجمة، والتنقل بين الشاشات.
   منطق الأسئلة نفسه غير مبني بعد — شاشة اللعب هنا placeholder فقط.
   =================================================================== */

/* ------------------------- كائن الترجمة ------------------------- */
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

    gamePlaceholderTitle: 'شاشة اللعب',
    gamePlaceholderText: 'منطق الأسئلة سيُبنى في مرحلة قادمة 🚧',
    summaryDifficulty: 'الطور المختار',
    summaryMode: 'النمط المختار',
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

    gamePlaceholderTitle: 'Game Screen',
    gamePlaceholderText: 'Question logic will be built in the next stage 🚧',
    summaryDifficulty: 'Selected difficulty',
    summaryMode: 'Selected mode',
  },
};

/* ------------------------- إعدادات كل طور (placeholder) -------------------------
   ستُستخدم لاحقًا عند بناء منطق الأسئلة: سرعة العد التنازلي، نطاق الأرقام، وعدد الأسئلة. */
const DIFFICULTY_CONFIG = {
  easy: { countdownSeconds: 15, numberRange: [1, 10], questionCount: 10 },
  medium: { countdownSeconds: 10, numberRange: [1, 50], questionCount: 15 },
  hard: { countdownSeconds: 6, numberRange: [1, 100], questionCount: 20 },
};

/* ------------------------- كائن الحالة (State) ------------------------- */
const state = {
  lang: localStorage.getItem('quantus_lang') || 'ar',
  soundOn: localStorage.getItem('quantus_sound') !== 'off',
  difficulty: null,
  mode: null,
  currentScreen: 'start',
};

/* ------------------------- عناصر DOM ثابتة ------------------------- */
const htmlEl = document.documentElement;
const langToggleBtn = document.getElementById('lang-toggle-btn');
const langToggleLabel = document.getElementById('lang-toggle-label');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIcon = document.getElementById('sound-icon');
const screens = document.querySelectorAll('.screen');
const summaryDifficultyEl = document.getElementById('summary-difficulty');
const summaryModeEl = document.getElementById('summary-mode');

/* ===================== الترجمة الديناميكية ===================== */
function applyTranslations() {
  const dict = translations[state.lang];

  // كل عنصر فيه data-i18n يتغيّر نصه حسب اللغة الحالية
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });

  // اتجاه ولغة الصفحة
  htmlEl.setAttribute('lang', state.lang);
  htmlEl.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');

  // زر تبديل اللغة يعرض اللغة البديلة (اللي رح تنتقل لها)
  langToggleLabel.textContent = state.lang === 'ar' ? 'EN' : 'AR';

  // تحديث ملخص شاشة اللعب إن كانت هناك قيم مختارة
  updateGameSummary();
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
  state.currentScreen = screenName;
  screens.forEach((screen) => {
    screen.classList.toggle('active', screen.dataset.screen === screenName);
  });
}

function updateGameSummary() {
  if (!summaryDifficultyEl || !summaryModeEl) return;
  const dict = translations[state.lang];

  summaryDifficultyEl.textContent = state.difficulty
    ? dict[`difficulty${capitalize(state.difficulty)}`]
    : '-';

  summaryModeEl.textContent = state.mode
    ? dict[`mode${capitalize(state.mode)}`]
    : '-';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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

  document.querySelectorAll('[data-action="back-to-mode"]').forEach((btn) => {
    btn.addEventListener('click', () => goToScreen('mode'));
  });

  // اختيار الطور
  document.querySelectorAll('[data-difficulty]').forEach((card) => {
    card.addEventListener('click', () => {
      state.difficulty = card.dataset.difficulty;
      goToScreen('mode');
    });
  });

  // اختيار النمط -> يذهب لشاشة اللعب (placeholder حاليًا)
  document.querySelectorAll('[data-mode]').forEach((card) => {
    card.addEventListener('click', () => {
      state.mode = card.dataset.mode;
      updateGameSummary();
      goToScreen('game');
      // TODO: مرحلة لاحقة — بدء الأسئلة فعليًا هنا باستخدام
      // DIFFICULTY_CONFIG[state.difficulty] و state.mode
    });
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
