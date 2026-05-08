// script.js
const passageBank = {
  Words: {
    Easy: [
      "green river bright window simple garden open morning soft paper clean light",
      "fresh apple quiet table small flower warm summer happy pencil silver cloud"
    ],
    Standard: [
      "Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.",
      "Clear typing begins with relaxed hands, steady eyes, and a patient rhythm that turns small gains into reliable speed."
    ],
    Advanced: [
      "Accurate momentum develops when deliberate correction, consistent pacing, and focused attention work together under time pressure.",
      "Professional typing rewards controlled movement, rapid recognition, and the discipline to recover smoothly after each error."
    ]
  },
  Sentences: {
    Easy: [
      "The desk is clear. The timer is ready. Type each word with care.",
      "A calm start helps your hands move well. Keep your eyes on the next word."
    ],
    Standard: [
      "Typing speed improves when accuracy comes first. A smooth rhythm often beats a rushed and uneven pace.",
      "Each short test gives useful feedback. Review your mistakes, restart with focus, and build control."
    ],
    Advanced: [
      "The most useful benchmark is not only fast, but repeatable, readable, and calm under changing passage patterns.",
      "When pressure rises, accurate typists maintain rhythm by scanning ahead while correcting small errors before they spread."
    ]
  },
  Practice: {
    Easy: [
      "Practice slowly at first, then increase your pace when the words feel natural.",
      "Keep your shoulders relaxed, breathe evenly, and let each line guide the next."
    ],
    Standard: [
      "Use this practice round to notice where your rhythm breaks, then restart and aim for cleaner movement.",
      "The goal is not a lucky score. The goal is a stable pace that you can repeat across many passages."
    ],
    Advanced: [
      "Advanced practice should expose weak transitions, uneven punctuation timing, and moments where speed outruns attention.",
      "Measure the pattern behind each mistake so the next round improves both confidence and control."
    ]
  },
  Numbers: {
    Easy: [
      "12 24 36 48 60 72 84 96 108 120",
      "101 202 303 404 505 606 707 808 909"
    ],
    Standard: [
      "Order 4821 ships in 24 hours, batch 7305 closes at 18:45, and code 9920 resets after review.",
      "The report shows 125 WPM, 625 CPM, 100% accuracy, 48 mistakes, and 100% progress as test values."
    ],
    Advanced: [
      "Invoice 384-9921 requires 7 checks, 14 notes, 28 updates, and 56 confirmations before 23:59.",
      "Sequence 91827, 74610, 58392, and 10486 should be typed carefully without swapping digits or skipping spaces."
    ]
  }
};

const state = {
  duration: 30,
  mode: "Words",
  difficulty: "Standard",
  passageIndex: 0,
  passage: "",
  started: false,
  finished: false,
  startTime: null,
  timerId: null,
  remaining: 30
};

const els = {
  durationButtons: document.querySelectorAll("[data-duration]"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  difficultyButtons: document.querySelectorAll("[data-difficulty]"),
  passageDisplay: document.getElementById("passageDisplay"),
  passageMeta: document.getElementById("passageMeta"),
  input: document.getElementById("typingInput"),
  restart: document.getElementById("restartButton"),
  newPassage: document.getElementById("newPassageButton"),
  runStatus: document.getElementById("runStatus"),
  time: document.getElementById("timeMetric"),
  wpm: document.getElementById("wpmMetric"),
  cpm: document.getElementById("cpmMetric"),
  accuracy: document.getElementById("accuracyMetric"),
  mistakes: document.getElementById("mistakesMetric"),
  progress: document.getElementById("progressMetric")
};

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

function getPassages() {
  return passageBank[state.mode][state.difficulty];
}

function setStatus(label, type = "idle") {
  els.runStatus.textContent = label;
  els.runStatus.classList.toggle("running", type === "running");
  els.runStatus.classList.toggle("finished", type === "finished");
}

function syncActiveButtons() {
  els.durationButtons.forEach(button => {
    button.classList.toggle("active", Number(button.dataset.duration) === state.duration);
  });

  els.modeButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  els.difficultyButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.difficulty === state.difficulty);
  });
}

function loadPassage() {
  const list = getPassages();
  state.passage = list[state.passageIndex % list.length];
  els.passageMeta.textContent = `${state.mode} · ${state.difficulty}`;
  renderPassage();
}

function resetTest({ keepPassage = true, status = "Ready" } = {}) {
  clearInterval(state.timerId);
  state.started = false;
  state.finished = false;
  state.startTime = null;
  state.remaining = state.duration;
  els.input.value = "";
  els.input.disabled = false;

  if (!keepPassage) {
    loadPassage();
  }

  renderPassage();
  updateMetrics();
  setStatus(status);
}

function calculateStats() {
  const typed = els.input.value;
  const elapsedSeconds = state.started
    ? Math.max(1, (Date.now() - state.startTime) / 1000)
    : 0;

  let correct = 0;
  let mistakes = 0;

  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === state.passage[i]) {
      correct++;
    } else {
      mistakes++;
    }
  }

  const minutes = elapsedSeconds / 60;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const cpm = minutes > 0 ? Math.round(correct / minutes) : 0;
  const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  const progress = Math.min(100, Math.round((typed.length / state.passage.length) * 100));

  return { typed, correct, mistakes, wpm, cpm, accuracy, progress };
}

function updateMetrics() {
  const stats = calculateStats();

  els.time.textContent = formatTime(state.remaining);
  els.wpm.textContent = `${stats.wpm} WPM`;
  els.cpm.textContent = `${stats.cpm} CPM`;
  els.accuracy.textContent = `${stats.accuracy}%`;
  els.mistakes.textContent = `${stats.mistakes} ${stats.mistakes === 1 ? "mistake" : "mistakes"}`;
  els.progress.textContent = `${stats.progress}%`;
}

function renderPassage() {
  const typed = els.input.value;
  const chars = [...state.passage];

  els.passageDisplay.innerHTML = chars.map((char, index) => {
    const typedChar = typed[index];
    const classes = ["char"];

    if (char === " ") classes.push("space");
    if (typedChar != null) {
      classes.push(typedChar === char ? "correct" : "wrong");
    }
    if (!state.finished && index === typed.length) {
      classes.push("current");
    }

    const output = char === " " ? "&nbsp;" : escapeHtml(char);
    return `<span class="${classes.join(" ")}">${output}</span>`;
  }).join("");
}

function escapeHtml(char) {
  return char
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function startTimer() {
  state.started = true;
  state.startTime = Date.now();
  setStatus("Running", "running");

  state.timerId = setInterval(() => {
    const elapsed = (Date.now() - state.startTime) / 1000;
    state.remaining = Math.max(0, state.duration - elapsed);
    updateMetrics();

    if (state.remaining <= 0) {
      finishTest();
    }
  }, 250);
}

function finishTest() {
  clearInterval(state.timerId);
  state.finished = true;
  state.remaining = Math.max(0, state.remaining);
  els.input.disabled = true;
  renderPassage();
  updateMetrics();
  setStatus("Complete", "finished");
}

function handleTyping() {
  if (state.finished) return;

  if (els.input.value.length > state.passage.length) {
    els.input.value = els.input.value.slice(0, state.passage.length);
  }

  if (!state.started && els.input.value.length > 0) {
    startTimer();
  }

  renderPassage();
  updateMetrics();

  if (els.input.value.length >= state.passage.length) {
    finishTest();
  }
}

els.input.addEventListener("input", handleTyping);

els.durationButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.duration = Number(button.dataset.duration);
    state.remaining = state.duration;
    syncActiveButtons();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.mode = button.dataset.mode;
    state.passageIndex = 0;
    syncActiveButtons();
    loadPassage();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.difficultyButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.difficulty = button.dataset.difficulty;
    state.passageIndex = 0;
    syncActiveButtons();
    loadPassage();
    resetTest({ keepPassage: true, status: "Reset" });
  });
});

els.restart.addEventListener("click", () => {
  resetTest({ keepPassage: true, status: "Restarted" });
  els.input.focus();
});

els.newPassage.addEventListener("click", () => {
  state.passageIndex = (state.passageIndex + 1) % getPassages().length;
  loadPassage();
  resetTest({ keepPassage: true, status: "New passage" });
  els.input.focus();
});

syncActiveButtons();
loadPassage();
resetTest();
