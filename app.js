const lessons = [
  {
    title: "مرحله ۱: آشنایی با ساز",
    content: "شناخت اجزای سه‌تار، نحوه صحیح نشستن و گرفتن ساز.",
  },
  {
    title: "مرحله ۲: مضراب و دست راست",
    content: "تمرین ریز، تک‌مضراب و کنترل دینامیک با سرعت پایین.",
  },
  {
    title: "مرحله ۳: پرده‌گیری دست چپ",
    content: "جای‌گذاری انگشت‌ها و اجرای نت‌های پایه روی دسته.",
  },
  {
    title: "مرحله ۴: نت‌خوانی کاربردی",
    content: "تبدیل نت نوشتاری به صدای دقیق با تمرین هدفمند.",
  },
  {
    title: "مرحله ۵: درآمد و گوشه‌های ابتدایی",
    content: "شروع دستگاه شور و اجرای جمله‌های کوتاه آموزشی.",
  },
  {
    title: "مرحله ۶: تحلیل اجرا",
    content: "ضبط، گوش‌دادن مجدد، بررسی کوک و اصلاح خطاها.",
  },
];

const practiceNotes = [
  { name: "دو (C4)", freq: 261.63 },
  { name: "ر (D4)", freq: 293.66 },
  { name: "می (E4)", freq: 329.63 },
  { name: "فا (F4)", freq: 349.23 },
  { name: "سل (G4)", freq: 392.0 },
  { name: "لا (A4)", freq: 440.0 },
  { name: "سی (B4)", freq: 493.88 },
];

const lessonGrid = document.getElementById("lessonGrid");
const noteSelect = document.getElementById("noteSelect");
const playReferenceBtn = document.getElementById("playReferenceBtn");
const startMicBtn = document.getElementById("startMicBtn");
const stopMicBtn = document.getElementById("stopMicBtn");

const detectedNoteEl = document.getElementById("detectedNote");
const detectedFreqEl = document.getElementById("detectedFreq");
const detectedCentsEl = document.getElementById("detectedCents");
const playStatusEl = document.getElementById("playStatus");
const coachMessageEl = document.getElementById("coachMessage");
const meterNeedle = document.getElementById("meterNeedle");

let audioContext;
let analyser;
let micSource;
let stream;
let rafId;

renderLessons();
renderNotes();

playReferenceBtn.addEventListener("click", async () => {
  const selected = practiceNotes[noteSelect.selectedIndex];
  await playReferenceTone(selected.freq, 1.5);
  coachMessageEl.textContent = `صدای مرجع نت «${selected.name}» پخش شد. حالا همان را اجرا کنید.`;
});

startMicBtn.addEventListener("click", startListening);
stopMicBtn.addEventListener("click", stopListening);

function renderLessons() {
  lessonGrid.innerHTML = lessons
    .map(
      (lesson) => `
      <article class="lesson">
        <h3>${lesson.title}</h3>
        <p>${lesson.content}</p>
      </article>
    `,
    )
    .join("");
}

function renderNotes() {
  noteSelect.innerHTML = practiceNotes
    .map((note) => `<option value="${note.freq}">${note.name}</option>`)
    .join("");
}

async function playReferenceTone(freq, durationSec) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.frequency.value = freq;
  osc.type = "triangle";
  gain.gain.value = 0.0001;

  osc.connect(gain);
  gain.connect(audioContext.destination);

  const now = audioContext.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

async function startListening() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (!audioContext) {
      audioContext = new AudioContext();
    }

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    micSource = audioContext.createMediaStreamSource(stream);
    micSource.connect(analyser);

    startMicBtn.disabled = true;
    stopMicBtn.disabled = false;

    coachMessageEl.textContent =
      "در حال شنود... نت را پایدار اجرا کنید تا دقت آن به شما نمایش داده شود.";
    updatePitch();
  } catch {
    coachMessageEl.textContent =
      "دسترسی میکروفون رد شد یا در دسترس نیست. لطفاً مجوز میکروفون را فعال کنید.";
  }
}

function stopListening() {
  if (rafId) {
    cancelAnimationFrame(rafId);
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  startMicBtn.disabled = false;
  stopMicBtn.disabled = true;
  coachMessageEl.textContent = "شنود متوقف شد. برای ادامه، دوباره شروع را بزنید.";
}

function updatePitch() {
  const bufferLength = analyser.fftSize;
  const data = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(data);

  const freq = autoCorrelate(data, audioContext.sampleRate);
  if (freq !== -1) {
    const nearest = getNearestNote(freq);
    const target = practiceNotes[noteSelect.selectedIndex];
    const centsFromTarget = getCentsDifference(freq, target.freq);

    detectedNoteEl.textContent = nearest.name;
    detectedFreqEl.textContent = `${freq.toFixed(2)} Hz`;
    detectedCentsEl.textContent = `${Math.round(centsFromTarget)} سنت`;

    const needlePercent = Math.max(0, Math.min(100, 50 + centsFromTarget / 2));
    meterNeedle.style.left = `${needlePercent}%`;

    const absCents = Math.abs(centsFromTarget);
    if (absCents <= 10) {
      playStatusEl.textContent = "عالی (کوک)";
      playStatusEl.style.color = "var(--ok)";
      coachMessageEl.textContent = "خیلی خوب! نت را دقیق و کوک اجرا کردید.";
    } else if (absCents <= 25) {
      playStatusEl.textContent = "نزدیک";
      playStatusEl.style.color = "var(--warn)";
      coachMessageEl.textContent =
        centsFromTarget > 0
          ? "کمی زیرتر بزنید (فرکانس شما بالاتر از هدف است)."
          : "کمی بم‌تر بزنید (فرکانس شما پایین‌تر از هدف است).";
    } else {
      playStatusEl.textContent = "نیاز به اصلاح";
      playStatusEl.style.color = "var(--bad)";
      coachMessageEl.textContent =
        centsFromTarget > 0
          ? "اختلاف زیاد است؛ جای انگشت را کمی عقب‌تر بگذارید."
          : "اختلاف زیاد است؛ جای انگشت را کمی جلوتر بگذارید.";
    }
  }

  rafId = requestAnimationFrame(updatePitch);
}

function autoCorrelate(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) {
    return -1;
  }

  let r1 = 0;
  let r2 = buffer.length - 1;
  const threshold = 0.2;

  for (let i = 0; i < buffer.length / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buffer.length / 2; i += 1) {
    if (Math.abs(buffer[buffer.length - i]) < threshold) {
      r2 = buffer.length - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Array(trimmed.length).fill(0);

  for (let i = 0; i < trimmed.length; i += 1) {
    for (let j = 0; j < trimmed.length - i; j += 1) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) {
    d += 1;
  }

  let maxVal = -1;
  let maxPos = -1;

  for (let i = d; i < trimmed.length; i += 1) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  const t0 = maxPos;
  return sampleRate / t0;
}

function getNearestNote(freq) {
  const noteNames = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { name: `${noteNames[noteIndex]}${octave}`, midi };
}

function getCentsDifference(freq, targetFreq) {
  return 1200 * Math.log2(freq / targetFreq);
}
