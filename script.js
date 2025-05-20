// ========== Canvas + Setup ==========
const canvas = document.getElementById("gradientCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const glassEffect = document.getElementById("glassEffect");

const defaultSettings = {
  blur: 90,
  radius: 100,
  shadow: 4,
  count: 120,
  smoothness: 6.6,
  speed: 1.7,
  colors: ['#fffd8c', '#97fff4', '#ff6b6b', '#7091f5', '#d6a3ff', '#bae9bd', '#535ef9']
};

let blurAmount = defaultSettings.blur;
let circleRadius = defaultSettings.radius;
let shadowBlur = defaultSettings.shadow;
let numPoints = defaultSettings.count;
let smoothnessFactor = defaultSettings.smoothness;
let speedFactor = defaultSettings.speed;
let colors = [...defaultSettings.colors];

let colorProgress = new Array(numPoints).fill(0.5);
let points = [];
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let isMouseMoving = false;
let mouseInactiveTimer = null;

// ========== Point Initialization ==========
function initPoints(count) {
  points = [];
  colorProgress = new Array(count).fill(0.5);
  for (let i = 0; i < count; i++) {
    points.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      dx: (Math.random() - 0.5) * speedFactor,
      dy: (Math.random() - 0.5) * speedFactor,
      radius: circleRadius,
      randomOffset: Math.random() * 0.2,
      isMovingToMouse: false,
    });
  }
}
initPoints(numPoints);

// ========== Mouse Tracking ==========
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  isMouseMoving = true;
  clearTimeout(mouseInactiveTimer);
  mouseInactiveTimer = setTimeout(() => isMouseMoving = false, 1000);
});

// ========== Color Utilities ==========
function hexToRgb(hex) {
  return {
    r: parseInt(hex.substr(1, 2), 16),
    g: parseInt(hex.substr(3, 2), 16),
    b: parseInt(hex.substr(5, 2), 16)
  };
}

function interpolateColors(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function getGradientColor(progress, offset) {
  const count = colors.length - 1;
  const t = (progress + offset) * (count - 1);
  const i = Math.floor(t) + 1;
  const next = (i + 1 > count) ? 1 : i + 1;
  return interpolateColors(colors[i], colors[next], t - Math.floor(t));
}

// ========== Animation ==========
function createFluidEffect() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  points.forEach((p, i) => {
    const dist = Math.hypot(mouseX - p.x, mouseY - p.y);
    const t = dist / Math.hypot(canvas.width, canvas.height);
    if (isMouseMoving) colorProgress[i] += (t - colorProgress[i]) * 0.05;

    const color = getGradientColor(colorProgress[i], p.randomOffset);
    const maxDistForPush = 160;

    if (dist < maxDistForPush) {
      const angle = Math.atan2(mouseY - p.y, mouseX - p.x);
      const smoothFactor = 1 - t;
      p.x -= Math.cos(angle) * smoothnessFactor * smoothFactor;
      p.y -= Math.sin(angle) * smoothnessFactor * smoothFactor;
    }

    if (!isMouseMoving && !p.isMovingToMouse) {
      const angleToMouse = Math.atan2(mouseY - p.y, mouseX - p.x);
      p.x += Math.cos(angleToMouse) * 0.5;
      p.y += Math.sin(angleToMouse) * 0.5;
      p.isMovingToMouse = true;
      setTimeout(() => p.isMovingToMouse = false, 1000);
    }

    p.x += p.dx;
    p.y += p.dy;

    if (p.x < -circleRadius) p.x = canvas.width + circleRadius;
    if (p.x > canvas.width + circleRadius) p.x = -circleRadius;
    if (p.y < -circleRadius) p.y = canvas.height + circleRadius;
    if (p.y > canvas.height + circleRadius) p.y = -circleRadius;

    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  requestAnimationFrame(createFluidEffect);
}

// ========== UI & Controls ==========
const blurSlider = document.getElementById("blurSlider");
const radiusSlider = document.getElementById("radiusSlider");
const shadowSlider = document.getElementById("shadowSlider");
const smoothnessSlider = document.getElementById("smoothnessSlider");
const speedSlider = document.getElementById("speedSlider");
const circleCountSlider = document.getElementById("circleCountSlider");
const circleCountValue = document.getElementById("circleCountValue");
const colorPaletteList = document.getElementById("colorPaletteList");

blurSlider.addEventListener("input", () => {
  blurAmount = parseInt(blurSlider.value);
  glassEffect.style.backdropFilter = `blur(${blurAmount}px)`;
});
radiusSlider.addEventListener("input", () => {
  circleRadius = parseInt(radiusSlider.value);
});
shadowSlider.addEventListener("input", () => {
  shadowBlur = parseInt(shadowSlider.value);
});
smoothnessSlider.addEventListener("input", () => {
  smoothnessFactor = parseFloat(smoothnessSlider.value);
});
speedSlider.addEventListener("input", () => {
  speedFactor = parseFloat(speedSlider.value);
  points.forEach(p => {
    p.dx = (Math.random() - 0.5) * speedFactor;
    p.dy = (Math.random() - 0.5) * speedFactor;
  });
});
circleCountSlider.addEventListener("input", () => {
  numPoints = parseInt(circleCountSlider.value);
  circleCountValue.textContent = numPoints;
  initPoints(numPoints);
});

// ========== Palette UI ==========
function updateColorUI() {
  colorPaletteList.innerHTML = '';
  colors.forEach((hex, i) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const input = document.createElement("input");

    label.textContent = hex;
    input.type = "color";
    input.className = "colorInput";
    input.value = hex;

    input.addEventListener("input", (e) => {
      colors[i] = e.target.value;
      label.textContent = e.target.value;
      if (i === 0) document.body.style.backgroundColor = e.target.value;
    });

    li.appendChild(label);
    li.appendChild(input);
    colorPaletteList.appendChild(li);
  });
  document.body.style.backgroundColor = colors[0];
}

document.getElementById("changeColorButton").addEventListener("click", () => {
  colors = [`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`].concat(
    Array.from({ length: 6 }, () =>
      `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`)
  );
  updateColorUI();
});

document.getElementById("tweakColorButton").addEventListener("click", () => {
  function hexToHSL(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rP = r / 255, gP = g / 255, bP = b / 255;
    const max = Math.max(rP, gP, bP), min = Math.min(rP, gP, bP);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rP: h = (gP - bP) / d + (gP < bP ? 6 : 0); break;
        case gP: h = (bP - rP) / d + 2; break;
        case bP: h = (rP - gP) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function HSLToHex({ h, s, l }) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (h < 60)      [r, g, b] = [c, x, 0];
    else if (h < 120)[r, g, b] = [x, c, 0];
    else if (h < 180)[r, g, b] = [0, c, x];
    else if (h < 240)[r, g, b] = [0, x, c];
    else if (h < 300)[r, g, b] = [x, 0, c];
    else             [r, g, b] = [c, 0, x];

    const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  colors = colors.map(hex => {
    const hsl = hexToHSL(hex);
    hsl.h = (hsl.h + 30) % 360;
    return HSLToHex(hsl);
  });

  updateColorUI();
});

document.getElementById("lightDarkButton").addEventListener("click", () => {
  const isNowDark = document.body.classList.toggle("gradient-dark-mode");
  colors = colors.map(hex => {
    const { r, g, b } = hexToRgb(hex);
    const adjust = (v) => {
      const amount = 30;
      return isNowDark
        ? Math.max(0, v - amount)
        : Math.min(255, v + amount);
    };
    const toHex = (v) => adjust(v).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });
  updateColorUI();
});

// ========== Toggle Panel Button ==========
const toggleBtn = document.getElementById("togglePanelBtn");
const panelContainer = document.getElementById("panelContainer");

toggleBtn.addEventListener("click", () => {
  const isHidden = panelContainer.classList.toggle("hidden");
  document.body.classList.toggle("panels-hidden", isHidden); // Important fix for fade logic
  toggleBtn.textContent = isHidden ? "☰ Show Controls" : "☰ Hide Controls";
});

document.querySelectorAll('input[type="range"]').forEach(slider => {
  const updateGradient = () => {
    const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${value}%`);
  };
  slider.addEventListener('input', updateGradient);
  updateGradient(); // initialize
});

// ========== Init ==========
glassEffect.style.backdropFilter = `blur(${blurAmount}px)`;
updateColorUI();
createFluidEffect();
