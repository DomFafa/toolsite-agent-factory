if (new URLSearchParams(location.search).get("shot") === "mobile") {
  document.body.classList.add("shot-mobile");
}

const passage = "Steady practice builds speed. Focus on each word, keep a calm rhythm, and correct mistakes before they become habits.";
const input = document.querySelector("#typing-input");
const progressBar = document.querySelector("#progress-bar");
const progressValue = document.querySelector("#progress-value");
const wpm = document.querySelector("#wpm");
const cpm = document.querySelector("#cpm");
const accuracy = document.querySelector("#accuracy");
const mistakes = document.querySelector("#mistakes");

function reset() {
  input.value = "";
  progressBar.style.width = "0%";
  progressValue.textContent = "0%";
  wpm.textContent = "0";
  cpm.textContent = "0";
  accuracy.textContent = "100%";
  mistakes.textContent = "0";
  if (window.innerWidth > 760) input.focus();
}

input.addEventListener("input", () => {
  const typed = input.value;
  let wrong = 0;
  for (let i = 0; i < typed.length; i += 1) if (typed[i] !== passage[i]) wrong += 1;
  const correct = Math.max(0, typed.length - wrong);
  const pct = Math.min(100, Math.round((typed.length / passage.length) * 100));
  progressBar.style.width = pct + "%";
  progressValue.textContent = pct + "%";
  cpm.textContent = String(correct * 5);
  wpm.textContent = String(Math.round(correct / 5));
  mistakes.textContent = String(wrong);
  accuracy.textContent = Math.round((correct / Math.max(typed.length, 1)) * 100) + "%";
});

document.querySelectorAll(".segmented").forEach(group => {
  group.addEventListener("click", event => {
    if (event.target.tagName !== "BUTTON") return;
    group.querySelectorAll("button").forEach(button => button.classList.remove("active"));
    event.target.classList.add("active");
    reset();
  });
});

document.querySelector("#restart").addEventListener("click", reset);
document.querySelector("#new-passage").addEventListener("click", reset);
reset();