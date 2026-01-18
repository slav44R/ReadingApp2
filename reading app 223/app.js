const fileInput = document.getElementById("fileInput");
const previewImage = document.getElementById("previewImage");
const previewBox = document.getElementById("previewBox");
const startOcr = document.getElementById("startOcr");
const clearBtn = document.getElementById("clearBtn");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const resultText = document.getElementById("resultText");
const speakBtn = document.getElementById("speakBtn");
const stopBtn = document.getElementById("stopBtn");
const statusPill = document.getElementById("statusPill");
const langSelect = document.getElementById("langSelect");
const voiceSelect = document.getElementById("voiceSelect");
const rateRange = document.getElementById("rateRange");

let currentImage = null;
let currentWorker = null;
let voices = [];
let isPaused = false;
let activeLang = null;
let checkedLangs = new Set();
let checkedAssets = new Set();

const statusStates = {
  idle: "Ready",
  ocr: "Reading image",
  done: "Text ready",
  speaking: "Speaking",
};

const setStatus = (state) => {
  statusPill.textContent = statusStates[state] || statusStates.idle;
};

const updateProgress = (progress) => {
  const pct = Math.round(progress * 100);
  progressBar.style.width = `${pct}%`;
  progressText.textContent = pct ? `OCR ${pct}%` : "Idle";
};

const resetOutput = () => {
  resultText.value = "";
  speakBtn.disabled = true;
  stopBtn.disabled = true;
  updateProgress(0);
  setStatus("idle");
};

const handleFile = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 1600;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      currentImage = canvas.toDataURL("image/jpeg", 0.9);
      previewImage.src = currentImage;
      previewImage.style.display = "block";
      previewBox.classList.add("has-image");
      previewBox.querySelector(".empty").style.display = "none";
      startOcr.disabled = false;
      clearBtn.disabled = false;
      resetOutput();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  handleFile(file);
});

const onDrop = (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  handleFile(file);
};

previewBox.addEventListener("dragover", (event) => {
  event.preventDefault();
});

previewBox.addEventListener("drop", onDrop);

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  previewImage.src = "";
  previewImage.style.display = "none";
  previewBox.querySelector(".empty").style.display = "block";
  currentImage = null;
  startOcr.disabled = true;
  clearBtn.disabled = true;
  resetOutput();
});

const getSelectedVoice = () => {
  const selected = voiceSelect.value;
  return voices.find((voice) => voice.name === selected) || null;
};

const getSpeechLangPrefixes = () => {
  const selected = langSelect.value;
  if (selected === "bul") return ["bg"];
  return ["en"];
};

const loadVoices = () => {
  voices = window.speechSynthesis.getVoices();
  const prefixes = getSpeechLangPrefixes();
  voiceSelect.innerHTML = "";
  const filtered = voices.filter((voice) =>
    prefixes.some((prefix) => voice.lang?.toLowerCase().startsWith(prefix))
  );
  const list = filtered.length ? filtered : voices;
  list.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
};

if ("speechSynthesis" in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

langSelect.addEventListener("change", () => {
  loadVoices();
});

const TESSERACT_VERSION = "5.1.1";
const TESSERACT_ASSET_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist`;
const TESSERACT_CACHE_BUST = `?v=${TESSERACT_VERSION}`;

const ensureWorker = async (lang) => {
  if (currentWorker) return currentWorker;
  const options = {
    langPath: "tessdata",
    workerPath: `${TESSERACT_ASSET_BASE}/worker.min.js${TESSERACT_CACHE_BUST}`,
    corePath: `${TESSERACT_ASSET_BASE}/tesseract-core.wasm.js${TESSERACT_CACHE_BUST}`,
    wasmPath: `${TESSERACT_ASSET_BASE}/tesseract-core.wasm${TESSERACT_CACHE_BUST}`,
  };
  let worker;
  const fallbackLang = lang || langSelect.value || "eng";
  worker = await Tesseract.createWorker([fallbackLang], 1, {}, options);
  progressText.textContent = "Loading OCR engine...";
  updateProgress(0.12);
  await worker.load();
  currentWorker = worker;
  return worker;
};

const checkAsset = async (path) => {
  if (checkedAssets.has(path)) return true;
  try {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) return false;
    checkedAssets.add(path);
    return true;
  } catch {
    return false;
  }
};

const checkLangFile = async (lang) => {
  if (checkedLangs.has(lang)) return true;
  try {
    const response = await fetch(`tessdata/${lang}.traineddata`, {
      cache: "no-cache",
    });
    if (!response.ok) return false;
    checkedLangs.add(lang);
    return true;
  } catch {
    return false;
  }
};

const prepareLanguage = async (worker, lang) => {
  if (activeLang === lang) return;
  progressText.textContent = "Loading language data...";
  updateProgress(0.2);
  const langValue = Array.isArray(lang) ? lang.join("+") : lang;
  await worker.loadLanguage(langValue);
  progressText.textContent = "Initializing OCR...";
  updateProgress(0.45);
  await worker.initialize(langValue);
  activeLang = lang;
  updateProgress(0.6);
};

startOcr.addEventListener("click", async () => {
  if (!currentImage) return;
  try {
    setStatus("ocr");
    updateProgress(0.02);
    progressText.textContent = "Starting OCR...";
    startOcr.disabled = true;
    const lang = langSelect.value;
    const assetsOk =
      (await checkAsset("tesseract/worker.min.js")) &&
      (await checkAsset("tesseract/tesseract-core.wasm.js")) &&
      (await checkAsset("tesseract/tesseract-core.wasm"));
    if (!assetsOk) {
      progressText.textContent = "Missing OCR engine files.";
      setStatus("idle");
      startOcr.disabled = false;
      return;
    }
    const hasLang = await checkLangFile(lang);
    if (!hasLang) {
      progressText.textContent = `Missing tessdata/${lang}.traineddata`;
      setStatus("idle");
      startOcr.disabled = false;
      return;
    }
    const worker = await ensureWorker(lang);
    await prepareLanguage(worker, lang);
    progressText.textContent = "Recognizing text...";
    updateProgress(0.75);
    const { data } = await worker.recognize(currentImage);
    resultText.value = data.text.trim();
    speakBtn.disabled = resultText.value.length === 0;
    setStatus("done");
    updateProgress(1);
    startOcr.disabled = false;
  } catch (error) {
    console.error(error);
    progressText.textContent = "OCR failed. Check tessdata files.";
    setStatus("idle");
    startOcr.disabled = false;
  }
});

const speakText = () => {
  if (!resultText.value.trim()) return;
  if (!("speechSynthesis" in window)) {
    alert("Speech Synthesis is not supported in this browser.");
    return;
  }
  if (window.speechSynthesis.speaking && isPaused) {
    window.speechSynthesis.resume();
    setStatus("speaking");
    speakBtn.textContent = "Pause";
    isPaused = false;
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    setStatus("done");
    speakBtn.textContent = "Play";
    isPaused = true;
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(resultText.value);
  const voice = getSelectedVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = Number(rateRange.value);
  setStatus("speaking");
  speakBtn.disabled = true;
  stopBtn.disabled = false;
  speakBtn.textContent = "Pause";
  isPaused = false;
  utterance.onend = () => {
    setStatus("done");
    speakBtn.disabled = false;
    stopBtn.disabled = true;
    speakBtn.textContent = "Play";
    isPaused = false;
  };
  window.speechSynthesis.speak(utterance);
};

speakBtn.addEventListener("click", speakText);

stopBtn.addEventListener("click", () => {
  window.speechSynthesis.cancel();
  setStatus("done");
  speakBtn.disabled = false;
  stopBtn.disabled = true;
  speakBtn.textContent = "Play";
  isPaused = false;
});

window.addEventListener("beforeunload", async () => {
  if (currentWorker) {
    await currentWorker.terminate();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

