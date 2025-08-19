// ========== Canvas + Setup ==========
const canvas = document.getElementById("gradientCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const glassEffect = document.getElementById("glassEffect");

const defaultSettings = {
  blur: 140,
  radius: 110,
  shadow: 4,
  count: 150,
  smoothness: 6.2,
  speed: 1.8,
  colors: ['#fffd8c', '#97fff4', '#ff6b6b', '#7091f5', '#d6a3ff', '#bae9bd', '#535ef9']
};

let blurAmount = defaultSettings.blur;
let baseRadiusFactor = 0.05; // 5% of screen width if wanted
let circleRadius = canvas.width * baseRadiusFactor || defaultSettings.radius;
let shadowBlur = defaultSettings.shadow;
let numPoints = defaultSettings.count;
let smoothnessFactor = defaultSettings.smoothness;
let speedFactor = defaultSettings.speed;

// Adjusted palette (used to draw) and base (edited/inverted)
let colors = [...defaultSettings.colors];
let baseColors = [...defaultSettings.colors];

let colorProgress = new Array(numPoints).fill(0.5);
let points = [];
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let isMouseMoving = false;
let mouseInactiveTimer = null;

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
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2 - max - min) : d/(max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l]; // h in 0..1, s/l in 0..1
}
function hslToRgb(h, s, l) {
  let r, g, b;
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l*s;
    const p = 2*l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}
function componentToHex(c) { const hex = c.toString(16); return hex.length === 1 ? '0' + hex : hex; }

function interpolateColors(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

// Forward Adobe-style adjustment: base -> adjusted
function adjustHexAdobe(hex, hueShiftDeg, satShiftPct, lightShiftPct) {
  const { r, g, b } = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b); // h in 0..1

  const hueShift = hueShiftDeg / 360; // degrees -> turns
  h = (h + hueShift) % 1; if (h < 0) h += 1;
  s = clamp(s + (satShiftPct / 100), 0, 1);
  l = clamp(l + (lightShiftPct / 100), 0, 1);

  const [r2, g2, b2] = hslToRgb(h, s, l);
  return `#${componentToHex(r2)}${componentToHex(g2)}${componentToHex(b2)}`;
}

// Inverse adjustment: adjusted -> base (given current global offsets)
function inverseAdjustHexAdobe(adjustedHex, hueShiftDeg, satShiftPct, lightShiftPct) {
  const { r, g, b } = hexToRgb(adjustedHex);
  let [h, s, l] = rgbToHsl(r, g, b); // h in 0..1

  const hueShift = hueShiftDeg / 360;
  h = (h - hueShift) % 1; if (h < 0) h += 1;
  s = clamp(s - (satShiftPct / 100), 0, 1);
  l = clamp(l - (lightShiftPct / 100), 0, 1);

  const [r2, g2, b2] = hslToRgb(h, s, l);
  return `#${componentToHex(r2)}${componentToHex(g2)}${componentToHex(b2)}`;
}

function getAdjustedColors(hueShiftDeg, satShiftPct, lightShiftPct) {
  return baseColors.map(hex => adjustHexAdobe(hex, hueShiftDeg, satShiftPct, lightShiftPct));
}

// ========== Gradient Color ==========
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

// Global adjustment sliders (query BEFORE loading URL)
const hueSlider = document.getElementById("hueSlider");
const brightnessSlider = document.getElementById("brightnessSlider"); // Lightness
const saturationSlider = document.getElementById("saturationSlider");
const resetPaletteSlidersBtn = document.getElementById("resetPaletteSlidersBtn");

// ========== Visual slider listeners ==========
blurSlider.addEventListener("input", () => {
  blurAmount = parseInt(blurSlider.value);
  glassEffect.style.backdropFilter = `blur(${blurAmount}px)`;
  updateShareableURLBox();
});
radiusSlider.addEventListener("input", () => {
  circleRadius = parseInt(radiusSlider.value);
  updateShareableURLBox();
});
shadowSlider.addEventListener("input", () => {
  shadowBlur = parseInt(shadowSlider.value);
  updateShareableURLBox();
});
smoothnessSlider.addEventListener("input", () => {
  smoothnessFactor = parseFloat(smoothnessSlider.value);
  updateShareableURLBox();
});
speedSlider.addEventListener("input", () => {
  speedFactor = parseFloat(speedSlider.value);
  points.forEach(p => {
    p.dx = (Math.random() - 0.5) * speedFactor;
    p.dy = (Math.random() - 0.5) * speedFactor;
  });
  updateShareableURLBox();
});
circleCountSlider.addEventListener("input", () => {
  numPoints = parseInt(circleCountSlider.value);
  circleCountValue.textContent = numPoints;
  initPoints(numPoints);
  updateShareableURLBox();
});

// ========== Palette UI ==========
function updateColorUI() {
  colorPaletteList.innerHTML = '';
  colors.forEach((adjHex, i) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const input = document.createElement("input");

    label.textContent = adjHex;
    input.type = "color";
    input.className = "colorInput";
    input.value = adjHex; // show ADJUSTED color so box correlates with canvas

    // Edit one color in adjusted space -> invert to base, then redraw all
    input.addEventListener("input", (e) => {
      const desiredAdjusted = e.target.value;
      const hueShift = parseInt(hueSlider.value) || 0;
      const satShift = parseInt(saturationSlider.value) || 0;
      const lightShift = parseInt(brightnessSlider.value) || 0;

      // Solve for base so that base + global offsets = desiredAdjusted
      const newBase = inverseAdjustHexAdobe(desiredAdjusted, hueShift, satShift, lightShift);

      baseColors[i] = newBase;
      colors = getAdjustedColors(hueShift, satShift, lightShift); // recompute all with same global offsets

      label.textContent = colors[i];
      if (i === 0) document.body.style.backgroundColor = colors[0];
      updateShareableURLBox();
    });

    li.appendChild(label);
    li.appendChild(input);
    colorPaletteList.appendChild(li);
  });

  document.body.style.backgroundColor = colors[0];
}

// ========== Reset adjust sliders to CENTER (for any min/max) ==========
function resetAdjustmentSlidersToCenter() {
  const center = s => {
    const min = parseFloat(s.min ?? -100);
    const max = parseFloat(s.max ?? 100);
    return (min + max) / 2;
  };
  hueSlider.value = center(hueSlider);           // typically 0 for -180..180
  saturationSlider.value = center(saturationSlider); // 0 for -100..100
  brightnessSlider.value = center(brightnessSlider); // 0 for -100..100

  [hueSlider, saturationSlider, brightnessSlider].forEach(slider => {
    const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${value}%`);
  });
}

// Generate New Palette: reset sliders to center, randomize BASE, re-derive adjusted
document.getElementById("changeColorButton").addEventListener("click", () => {
  resetAdjustmentSlidersToCenter();
  baseColors = [`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`].concat(
    Array.from({ length: 6 }, () =>
      `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`)
  );
  applyAdjustments(); // re-derive adjusted from centered sliders
});

// ========== Global Adjustments ==========
function applyAdjustments() {
  const hueShift = parseInt(hueSlider.value) || 0;          // -180..+180 (or expanded in HTML)
  const lightShift = parseInt(brightnessSlider.value) || 0; // -100..+100
  const satShift = parseInt(saturationSlider.value) || 0;   // -100..+100
  colors = getAdjustedColors(hueShift, satShift, lightShift);
  updateColorUI();
  updateShareableURLBox();
}

resetPaletteSlidersBtn.addEventListener("click", () => {
  resetAdjustmentSlidersToCenter();
  applyAdjustments(); // derive from base (identity if center=0)
});

// Live global preview as sliders move (no baking)
[hueSlider, saturationSlider, brightnessSlider].forEach(slider => {
  slider.addEventListener("input", applyAdjustments);
});

// ========== Collapse/Expand Panel Logic ==========
document.querySelectorAll(".collapseBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const panel = btn.closest(".mini-panel");
    const isCollapsed = panel.classList.toggle("collapsed");
    btn.textContent = isCollapsed ? "+" : "−";
  });
});

// ========== Embed (snapshot current adjusted state) ==========
function generateEmbedCode() {
  const embedColors = colors.map(c => `'${c}'`).join(", ");
  const embedCode = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Fluid Gradient Background (Embed)</title>
<style>
  html, body { margin:0; padding:0; overflow:hidden; background:${colors[0]}; }
  #gradientCanvas { position:fixed; inset:0; width:100vw; height:100vh; display:block; }
  #glassEffect { position:fixed; inset:0; backdrop-filter: blur(${blurAmount}px); pointer-events:none; }
</style>
</head>
<body>
<canvas id="gradientCanvas"></canvas>
<div id="glassEffect"></div>
<script>
  (function(){
    const canvas = document.getElementById('gradientCanvas');
    const ctx = canvas.getContext('2d');
    function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize, { passive: true }); resize();

    const blurAmount = ${blurAmount};
    const circleRadius = ${circleRadius};
    const shadowBlur = ${shadowBlur};
    const numPoints = ${numPoints};
    const smoothnessFactor = ${smoothnessFactor};
    const speedFactor = ${speedFactor};
    const colors = [${embedColors}];

    let colorProgress = new Array(numPoints).fill(0.5);
    let points = [];
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let isMouseMoving = false;
    let mouseInactiveTimer = null;

    const glass = document.getElementById('glassEffect');
    if (glass && glass.style) glass.style.backdropFilter = 'blur(' + blurAmount + 'px)';

    function hexToRgb(hex){ return { r:parseInt(hex.substr(1,2),16), g:parseInt(hex.substr(3,2),16), b:parseInt(hex.substr(5,2),16) }; }
    function interpolateColors(c1,c2,t){
      const a=hexToRgb(c1), b=hexToRgb(c2);
      return 'rgb(' + Math.round(a.r+(b.r-a.r)*t) + ', ' + Math.round(a.g+(b.g-a.g)*t) + ', ' + Math.round(a.b+(b.b-a.b)*t) + ')';
    }
    function getGradientColor(progress, offset){
      const count = colors.length - 1;
      const t = (progress + offset) * (count - 1);
      const i = Math.floor(t) + 1;
      const next = (i + 1 > count) ? 1 : i + 1;
      return interpolateColors(colors[i], colors[next], t - Math.floor(t));
    }

    function initPoints(count){
      points = []; colorProgress = new Array(count).fill(0.5);
      for (let i=0;i<count;i++){
        points.push({
          x: Math.random()*canvas.width,
          y: Math.random()*canvas.height,
          dx: (Math.random()-0.5)*speedFactor,
          dy: (Math.random()-0.5)*speedFactor,
          randomOffset: Math.random()*0.2,
          isMovingToMouse: false
        });
      }
    }
    initPoints(numPoints);

    document.addEventListener('mousemove', (e)=>{
      mouseX = e.clientX; mouseY = e.clientY;
      isMouseMoving = true;
      clearTimeout(mouseInactiveTimer);
      mouseInactiveTimer = setTimeout(()=> isMouseMoving = false, 1000);
    }, { passive: true });

    function draw(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (let i=0;i<points.length;i++){
        const p = points[i];
        const dist = Math.hypot(mouseX - p.x, mouseY - p.y);
        const t = dist / Math.hypot(canvas.width, canvas.height);
        if (isMouseMoving) colorProgress[i] += (t - colorProgress[i]) * 0.05;

        const color = getGradientColor(colorProgress[i], p.randomOffset);
        const maxDistForPush = 160;

        if (dist < maxDistForPush) {
          const angle = Math.atan2(mouseY - p.y, mouseX - p.x);
          const smooth = 1 - t;
          p.x -= Math.cos(angle) * smoothnessFactor * smooth;
          p.y -= Math.sin(angle) * smoothnessFactor * smooth;
        }

        p.x += p.dx; p.y += p.dy;

        if (p.x < -${circleRadius}) p.x = canvas.width + ${circleRadius};
        if (p.x > canvas.width + ${circleRadius}) p.x = -${circleRadius};
        if (p.y < -${circleRadius}) p.y = canvas.height + ${circleRadius};
        if (p.y > canvas.height + ${circleRadius}) p.y = -${circleRadius};

        ctx.shadowBlur = ${shadowBlur};
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ${circleRadius}, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();
</script>
</body>
</html>`;
  const out = document.getElementById("embedOutput");
  if (out) out.value = embedCode;
}

// ========== Shareable URL ==========
function getSharableURL() {
  const params = new URLSearchParams();
  params.set("viewOnly", "true");
  params.set("blur", blurAmount);
  params.set("radius", circleRadius);
  params.set("shadow", shadowBlur);
  params.set("count", numPoints);
  params.set("smoothness", smoothnessFactor);
  params.set("speed", speedFactor);

  // Save base + offsets
  params.set("baseColors", baseColors.map(c => c.replace('#', '')).join(','));
  params.set("hue", parseInt(hueSlider.value) || 0);
  params.set("sat", parseInt(saturationSlider.value) || 0);
  params.set("light", parseInt(brightnessSlider.value) || 0);

  // Legacy adjusted (for old links)
  params.set("colors", colors.map(c => c.replace('#', '')).join(','));

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
function updateShareableURLBox() {
  const el = document.getElementById("shareableURL");
  if (el) el.value = getSharableURL();
}

document.getElementById("copyShareURLBtn").addEventListener("click", () => {
  const url = getSharableURL();
  const box = document.getElementById("shareableURL");
  if (box) box.value = url;
  navigator.clipboard.writeText(url).then(() => {
    alert("Shareable URL copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy URL:", err);
    alert("Failed to copy. Try manually.");
  });
});

document.getElementById("copyEmbedBtn").addEventListener("click", () => {
  const embedCode = document.getElementById("embedOutput").value;
  navigator.clipboard.writeText(embedCode).then(() => {
    alert("Embed code copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy text: ", err);
    alert("Failed to copy. Please try manually.");
  });
});

// Range fill UI nicety
document.querySelectorAll('input[type="range"]').forEach(slider => {
  const updateGradient = () => {
    const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${value}%`);
  };
  slider.addEventListener('input', updateGradient);
  updateGradient();
});

// ========== URL Load ==========
function loadSettingsFromURL() {
  const params = new URLSearchParams(window.location.search);

  // Visual settings
  if (params.has("blur"))       blurAmount = parseFloat(params.get("blur"));
  if (params.has("radius"))     circleRadius = parseFloat(params.get("radius"));
  if (params.has("shadow"))     shadowBlur = parseFloat(params.get("shadow"));
  if (params.has("count"))      numPoints = parseInt(params.get("count"));
  if (params.has("smoothness")) smoothnessFactor = parseFloat(params.get("smoothness"));
  if (params.has("speed"))      speedFactor = parseFloat(params.get("speed"));

  // Palette (prefer baseColors; fall back to legacy colors)
  if (params.has("baseColors")) {
    baseColors = params.get("baseColors").split(",").map(h => `#${h}`);
  } else if (params.has("colors")) {
    baseColors = params.get("colors").split(",").map(h => `#${h}`);
  }

  // Offsets (persist across sessions)
  if (params.has("hue"))   hueSlider.value = parseInt(params.get("hue"));
  if (params.has("sat"))   saturationSlider.value = parseInt(params.get("sat"));
  if (params.has("light")) brightnessSlider.value = parseInt(params.get("light"));
}

// ========== Points ==========
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

// ========== Init (order matters) ==========
loadSettingsFromURL();         // read URL into state + slider values
applyAdjustments();            // derive adjusted from base + global offsets
initPoints(numPoints);         // then init points
glassEffect.style.backdropFilter = `blur(${blurAmount}px)`;
createFluidEffect();

// ========== View-Only Mode ==========
const params = new URLSearchParams(window.location.search);
if (params.get("viewOnly") === "true") {
  const panelContainer = document.getElementById("panelContainer");
  const toggleBtn = document.getElementById("togglePanelBtn");
  document.body.classList.add("panels-hidden");
  if (panelContainer) panelContainer.style.display = "none";
  if (toggleBtn) toggleBtn.style.display = "none";
}