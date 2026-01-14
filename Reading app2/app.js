const chat = document.getElementById('chat');
const statusEl = document.getElementById('status');
const progParent = document.getElementById('progressParent');
const progBar = document.getElementById('progressBar');

const stopContainer = document.getElementById('stopContainer');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');

const uploadBtn = document.getElementById('uploadBtn');
const fileGallery = document.getElementById('fileGallery');

// picker
const pickerOverlay = document.getElementById('pickerOverlay');
const pickerSheet = document.getElementById('pickerSheet');
const pickCamera = document.getElementById('pickCamera');
const pickGallery = document.getElementById('pickGallery');
const pickCancel = document.getElementById('pickCancel');

// camera modal
const camOverlay = document.getElementById('camOverlay');
const camClose = document.getElementById('camClose');
const camVideo = document.getElementById('camVideo');
const camCanvas = document.getElementById('camCanvas');
const camShoot = document.getElementById('camShoot');
const camFlip = document.getElementById('camFlip');

let worker = null;
let workerLang = null;
let isBusy = false;

let isPaused = false;
let currentUtterance = null;

// camera state
let camStream = null;
let camFacingMode = 'environment'; // environment/user

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function addBotMessage(htmlText) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="avatar bot"><i class="fas fa-robot"></i></div>
    <div class="bubble bot"><div class="meta">Lector AI</div>${htmlText}</div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function addUserImage(url) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <div class="avatar user"><i class="fas fa-user"></i></div>
    <div class="bubble user">
      <div class="meta">You</div>
      <img class="user-img" src="${url}" alt="Image">
    </div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

/* ======= Picker ======= */
function openPicker() {
  pickerOverlay.classList.remove('hidden');
  pickerOverlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => pickerSheet.classList.add('open'));
}

function closePicker() {
  pickerSheet.classList.remove('open');
  setTimeout(() => {
    pickerOverlay.classList.add('hidden');
    pickerOverlay.setAttribute('aria-hidden', 'true');
  }, 180);
}

/* ======= Camera ======= */
function cameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

async function stopCameraStream() {
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
}

async function startCameraStream() {
  await stopCameraStream();
  try {
    const constraints = {
      video: { facingMode: { ideal: camFacingMode } },
      audio: false
    };
    camStream = await navigator.mediaDevices.getUserMedia(constraints);
    camVideo.srcObject = camStream;
    await camVideo.play();
  } catch (e) {
    console.error(e);
    addBotMessage("Не успях да отворя камерата. Провери разрешенията или дали сайтът е през HTTPS.");
    closeCamera();
  }
}

async function openCamera() {
  if (!cameraSupported()) {
    addBotMessage("Камерата не се поддържа в този браузър. Използвай Галерия.");
    return;
  }
  camOverlay.classList.remove('hidden');
  camOverlay.setAttribute('aria-hidden', 'false');
  await startCameraStream();
}

function closeCamera() {
  stopCameraStream();
  camOverlay.classList.add('hidden');
  camOverlay.setAttribute('aria-hidden', 'true');
}

async function shootFromCamera() {
  if (!camVideo || camVideo.readyState < 2) return;

  const w = camVideo.videoWidth || 1280;
  const h = camVideo.videoHeight || 720;

  camCanvas.width = w;
  camCanvas.height = h;

  const ctx = camCanvas.getContext('2d');
  ctx.drawImage(camVideo, 0, 0, w, h);

  const blob = await new Promise(resolve => camCanvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) return;

  const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });

  closeCamera();
  await runOCR(file);
}

/* ======= OCR ======= */
async function getWorker(lang) {
  if (!worker) {
    worker = await Tesseract.createWorker({
      cacheMethod: 'none',
      logger: m => {
        if (m.status === 'recognizing text') {
          const p = Math.round(m.progress * 100);
          progBar.style.width = p + '%';
          statusEl.textContent = `Анализ: ${p}%`;
        }
      }
    });
  }
  if (workerLang !== lang) {
    statusEl.textContent = "Зареждане на език...";
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    workerLang = lang;
  }
  return worker;
}

async function runOCR(file) {
  if (!file || isBusy) return;
  isBusy = true;

  window.speechSynthesis.cancel();
  stopContainer.style.display = 'none';
  isPaused = false;
  updatePauseButton();

  const imgUrl = URL.createObjectURL(file);
  addUserImage(imgUrl);

  statusEl.textContent = "Подготовка...";
  progParent.style.display = 'block';
  progBar.style.width = '0%';

  try {
    const currentLang = document.getElementById('lang').value;
    const w = await getWorker(currentLang);

    const { data: { text } } = await w.recognize(file);

    progParent.style.display = 'none';
    statusEl.textContent = "Готово";

    const resultText = (text || "").trim() || "Не открих ясен текст. Опитай с по-ясна снимка/по-добра светлина.";
    const safeHtml = escapeHtml(resultText).replace(/\n/g, "<br>");
    addBotMessage(safeHtml);

    readAloud(resultText);
  } catch (err) {
    console.error(err);
    progParent.style.display = 'none';
    statusEl.textContent = "Грешка";
    addBotMessage("Възникна грешка при разчитане. Опитай пак с друга снимка.");
  } finally {
    isBusy = false;
    setTimeout(() => URL.revokeObjectURL(imgUrl), 1500);
  }
}

/* ======= Speech ======= */
function readAloud(msg) {
  currentUtterance = new SpeechSynthesisUtterance(msg);
  const selectedLang = document.getElementById('lang').value;

  currentUtterance.lang = (selectedLang === 'bul') ? 'bg-BG' : 'en-US';
  currentUtterance.rate = 0.95;

  currentUtterance.onstart = () => {
    stopContainer.style.display = 'flex';
    isPaused = false;
    updatePauseButton();
  };

  currentUtterance.onend = () => {
    stopContainer.style.display = 'none';
    isPaused = false;
    updatePauseButton();
  };

  currentUtterance.onerror = () => {
    stopContainer.style.display = 'none';
    isPaused = false;
    updatePauseButton();
  };

  window.speechSynthesis.speak(currentUtterance);
}

function togglePause() {
  if (!window.speechSynthesis.speaking && !window.speechSynthesis.paused) return;

  if (isPaused) {
    window.speechSynthesis.resume();
    isPaused = false;
  } else {
    window.speechSynthesis.pause();
    isPaused = true;
  }
  updatePauseButton();
}

function updatePauseButton() {
  if (!pauseBtn) return;
  const icon = pauseBtn.querySelector('i');
  const text = pauseBtn.querySelector('span');

  if (isPaused) {
    icon.className = 'fas fa-play';
    text.textContent = 'ПРОДЪЛЖИ';
    pauseBtn.className = 'btn primary';
  } else {
    icon.className = 'fas fa-pause';
    text.textContent = 'ПАУЗА';
    pauseBtn.className = 'btn';
  }
}

function stopReading() {
  window.speechSynthesis.cancel();
  stopContainer.style.display = 'none';
  isPaused = false;
  updatePauseButton();
}

/* ======= Events ======= */
uploadBtn?.addEventListener('click', openPicker);

pickCancel?.addEventListener('click', closePicker);
pickerOverlay?.addEventListener('click', (e) => { if (e.target === pickerOverlay) closePicker(); });

pickCamera?.addEventListener('click', async () => {
  closePicker();
  await openCamera();
});

// iPhone Safari: click трябва да е директно от handler (без setTimeout)
pickGallery?.addEventListener('click', () => {
  closePicker();
  fileGallery.value = '';
  fileGallery.click();
});

fileGallery?.addEventListener('change', e => runOCR(e.target.files?.[0]));

camClose?.addEventListener('click', closeCamera);
camOverlay?.addEventListener('click', (e) => { if (e.target === camOverlay) closeCamera(); });

camShoot?.addEventListener('click', shootFromCamera);

camFlip?.addEventListener('click', async () => {
  camFacingMode = (camFacingMode === 'environment') ? 'user' : 'environment';
  await startCameraStream();
});

stopBtn?.addEventListener('click', stopReading);
pauseBtn?.addEventListener('click', togglePause);
