const formats = [
  { id: "bowl", name: "Bowl", note: "No shell", calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, fiber: 0, sugar: 0 },
  { id: "burrito", name: "Burrito", note: "Flour tortilla", calories: 320, protein: 8, carbs: 50, fat: 9, sodium: 600, fiber: 3, sugar: 0 },
  { id: "salad", name: "Salad", note: "Greens base", calories: 15, protein: 1, carbs: 3, fat: 0, sodium: 20, fiber: 2, sugar: 1 },
  { id: "tacos", name: "Tacos", note: "3 crispy shells", calories: 210, protein: 3, carbs: 30, fat: 9, sodium: 0, fiber: 3, sugar: 0 },
  { id: "quesadilla", name: "Quesadilla", note: "Tortilla + cheese", calories: 430, protein: 14, carbs: 51, fat: 17, sodium: 790, fiber: 3, sugar: 1 }
];

const ingredients = [
  { id: "white-rice", group: "Rice and beans", name: "White rice", calories: 210, protein: 4, carbs: 40, fat: 4, sodium: 350, fiber: 1, sugar: 0 },
  { id: "brown-rice", group: "Rice and beans", name: "Brown rice", calories: 210, protein: 4, carbs: 36, fat: 6, sodium: 190, fiber: 2, sugar: 0 },
  { id: "black-beans", group: "Rice and beans", name: "Black beans", calories: 130, protein: 8, carbs: 22, fat: 1.5, sodium: 210, fiber: 7, sugar: 2 },
  { id: "pinto-beans", group: "Rice and beans", name: "Pinto beans", calories: 130, protein: 8, carbs: 21, fat: 1.5, sodium: 210, fiber: 8, sugar: 1 },
  { id: "chicken", group: "Protein", name: "Chicken", calories: 180, protein: 32, carbs: 0, fat: 7, sodium: 310, fiber: 0, sugar: 0 },
  { id: "steak", group: "Protein", name: "Steak", calories: 150, protein: 21, carbs: 1, fat: 6, sodium: 330, fiber: 1, sugar: 0 },
  { id: "barbacoa", group: "Protein", name: "Barbacoa", calories: 170, protein: 24, carbs: 2, fat: 7, sodium: 530, fiber: 1, sugar: 0 },
  { id: "sofritas", group: "Protein", name: "Sofritas", calories: 150, protein: 8, carbs: 9, fat: 10, sodium: 560, fiber: 3, sugar: 5 },
  { id: "fajita", group: "Toppings", name: "Fajita vegetables", calories: 20, protein: 1, carbs: 5, fat: 0, sodium: 150, fiber: 1, sugar: 2 },
  { id: "fresh-salsa", group: "Salsas", name: "Fresh tomato salsa", calories: 25, protein: 0, carbs: 4, fat: 0, sodium: 550, fiber: 1, sugar: 1 },
  { id: "corn-salsa", group: "Salsas", name: "Roasted chili-corn salsa", calories: 80, protein: 3, carbs: 16, fat: 1.5, sodium: 330, fiber: 3, sugar: 4 },
  { id: "green-salsa", group: "Salsas", name: "Tomatillo green salsa", calories: 15, protein: 0, carbs: 4, fat: 0, sodium: 260, fiber: 0, sugar: 2 },
  { id: "cheese", group: "Toppings", name: "Cheese", calories: 110, protein: 6, carbs: 1, fat: 8, sodium: 190, fiber: 0, sugar: 0 },
  { id: "sour-cream", group: "Toppings", name: "Sour cream", calories: 110, protein: 2, carbs: 2, fat: 9, sodium: 30, fiber: 0, sugar: 1 },
  { id: "guac", group: "Toppings", name: "Guacamole", calories: 230, protein: 2, carbs: 8, fat: 22, sodium: 370, fiber: 6, sugar: 1 },
  { id: "chips", group: "Sides", name: "Chips", calories: 540, protein: 7, carbs: 73, fat: 25, sodium: 390, fiber: 7, sugar: 1 }
];

const presets = [
  { name: "Lean Chicken Bowl", format: "bowl", items: { chicken: 1, "brown-rice": 0.5, "black-beans": 0.5, fajita: 1, "fresh-salsa": 1 } },
  { name: "High Protein Double Chicken", format: "bowl", items: { chicken: 2, "white-rice": 1, "black-beans": 1, fajita: 1 } },
  { name: "Burrito Reality Check", format: "burrito", items: { chicken: 1, "white-rice": 1, "pinto-beans": 1, cheese: 1, "sour-cream": 1, "fresh-salsa": 1 } },
  { name: "Chips + Guac Add-on", format: "bowl", items: { chips: 1, guac: 1 } }
];

const multipliers = [0.5, 1, 1.5, 2];
let selectedFormat = "bowl";
let selected = {};

function fmt(value, unit) {
  return `${Math.round(value)}${unit}`;
}

function render() {
  document.querySelector("#format-grid").innerHTML = formats.map(format => `
    <button class="format-button ${format.id === selectedFormat ? "active" : ""}" data-format="${format.id}">
      <strong>${format.name}</strong><span>${format.note} | ${format.calories} cal</span>
    </button>
  `).join("");

  const groups = [...new Set(ingredients.map(item => item.group))];
  document.querySelector("#ingredient-groups").innerHTML = groups.map(group => `
    <div class="ingredient-group">
      <h3>${group}</h3>
      <div class="ingredient-list">
        ${ingredients.filter(item => item.group === group).map(item => `
          <div class="ingredient-card ${selected[item.id] ? "active" : ""}">
            <button class="item-toggle" data-item="${item.id}">
              <strong>${item.name}</strong><span>${item.calories} cal | ${item.protein}g protein</span>
            </button>
            <div class="portion-row">
              ${multipliers.map(multiplier => `<button data-portion="${item.id}:${multiplier}" class="${selected[item.id] === multiplier ? "active" : ""}">${multiplier === 0.5 ? "0.5x" : multiplier === 1 ? "1x" : multiplier === 1.5 ? "1.5x" : "2x"}</button>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  document.querySelector("#preset-list").innerHTML = presets.map((preset, index) => `
    <button class="preset-button" data-preset="${index}"><strong>${preset.name}</strong></button>
  `).join("");

  bindEvents();
  updateTotals();
}

function updateTotals() {
  const totals = { ...formats.find(format => format.id === selectedFormat) };
  Object.entries(selected).forEach(([id, multiplier]) => {
    const item = ingredients.find(candidate => candidate.id === id);
    ["calories", "protein", "carbs", "fat", "sodium", "fiber", "sugar"].forEach(key => {
      totals[key] += item[key] * multiplier;
    });
  });
  document.querySelector("#total-calories").textContent = Math.round(totals.calories);
  document.querySelector("#total-protein").textContent = fmt(totals.protein, "g");
  document.querySelector("#total-carbs").textContent = fmt(totals.carbs, "g");
  document.querySelector("#total-fat").textContent = fmt(totals.fat, "g");
  document.querySelector("#total-sodium").textContent = fmt(totals.sodium, "mg");
  document.querySelector("#total-fiber").textContent = fmt(totals.fiber, "g");
  document.querySelector("#total-sugar").textContent = fmt(totals.sugar, "g");
}

function bindEvents() {
  document.querySelectorAll("[data-format]").forEach(button => {
    button.addEventListener("click", () => {
      selectedFormat = button.dataset.format;
      render();
    });
  });
  document.querySelectorAll("[data-item]").forEach(button => {
    button.addEventListener("click", event => {
      const id = button.dataset.item;
      selected[id] ? delete selected[id] : selected[id] = 1;
      render();
    });
  });
  document.querySelectorAll("[data-portion]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const [id, value] = button.dataset.portion.split(":");
      selected[id] = Number(value);
      render();
    });
  });
  document.querySelectorAll("[data-preset]").forEach(button => {
    button.addEventListener("click", () => {
      const preset = presets[Number(button.dataset.preset)];
      selectedFormat = preset.format;
      selected = { ...preset.items };
      render();
    });
  });
}

function applyPreset(index) {
  const preset = presets[index];
  if (!preset) return;
  selectedFormat = preset.format;
  selected = { ...preset.items };
}

document.querySelector("#clear-all").addEventListener("click", () => {
  selected = {};
  selectedFormat = "bowl";
  render();
});

document.querySelector("#copy-summary").addEventListener("click", async () => {
  const summary = `Meal estimate: ${document.querySelector("#total-calories").textContent} calories, ${document.querySelector("#total-protein").textContent} protein, ${document.querySelector("#total-carbs").textContent} carbs, ${document.querySelector("#total-fat").textContent} fat.`;
  await navigator.clipboard.writeText(summary);
});

const params = new URLSearchParams(window.location.search);
if (params.has("preset")) {
  applyPreset(Number(params.get("preset")));
}

render();
