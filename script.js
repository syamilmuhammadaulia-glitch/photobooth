/* --- CONFIGURATION --- */
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxmy3vHV7orIJQVv-SocyPsH79eWDeR9zDr7m231nphytqJ1Qpjxv82V4iUN9w4UlE/exec";

/* --- STATE MANAGEMENT --- */
let videoStream = null;
let capturedPhotos = [];
let currentDeviceId = null;
let lastFolderUrl = "";

/* --- DOM ELEMENTS --- */
const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");
const qrcodeContainer = document.getElementById("qrcode-container");
const appContainer = document.querySelector(".app-container");
const btnExpand = document.getElementById("btn-expand");
const previewArea = document.getElementById("main-preview-area");
const btnCapture = document.getElementById("btn-capture");
const cameraSelect = document.getElementById("camera-select");

/* --- INITIALIZATION --- */
async function initApp() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");

    cameraSelect.innerHTML = videoDevices
      .map(
        (d, i) =>
          `<option value="${d.deviceId}">${d.label || "Camera " + (i + 1)}</option>`,
      )
      .join("");

    if (videoDevices.length > 0) {
      currentDeviceId = videoDevices[0].deviceId;
      await startCamera(currentDeviceId);
    }
  } catch (err) {
    console.error("Izin kamera diperlukan:", err);
    alert("Mohon izinkan akses kamera untuk menggunakan Photobooth.");
  }
}

async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
  }
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: 1280, height: 720 },
    });
    video.srcObject = videoStream;
  } catch (err) {
    console.error("Error starting camera:", err);
  }
}

/* --- UTILITIES --- */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

cameraSelect.onchange = (e) => startCamera(e.target.value);

/* --- FULLSCREEN/EXPAND LOGIC --- */
btnExpand.onclick = () => {
  previewArea.classList.toggle("is-expanded");
  if (navigator.vibrate) navigator.vibrate(50);
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewArea.classList.contains("is-expanded")) {
    previewArea.classList.remove("is-expanded");
  }
});

/* --- CAPTURE ENGINE --- */
async function runCountdown(seconds, poseNum) {
  const display = document.getElementById("timer-display");
  const status = document.getElementById("photo-status");

  display.style.display = "flex";
  status.style.display = "block";

  for (let i = seconds; i > 0; i--) {
    display.innerText = i;
    status.innerText = `Pose ${poseNum} / 4`;
    await wait(1000);
  }

  display.style.display = "none";
  status.style.display = "none";
}

btnCapture.onclick = async () => {
  // Tutup mode expand jika sedang aktif
  previewArea.classList.remove("is-expanded");

  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = [];
  btnCapture.disabled = true;

  for (let i = 1; i <= 4; i++) {
    await runCountdown(durasi, i);

    // Flash Effect & Capture
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tCtx = tempCanvas.getContext("2d");

    // Mirroring if needed (matching video preview)
    tCtx.translate(tempCanvas.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(video, 0, 0);

    const img = new Image();
    img.src = tempCanvas.toDataURL("image/jpeg", 0.9);
    await new Promise((r) => (img.onload = r));
    capturedPhotos.push(img);

    // Flash UI
    videoWrapper.style.opacity = "0.2";
    await wait(150);
    videoWrapper.style.opacity = "1";

    if (i < 4) await wait(1000);
  }

  // Switch UI Mode
  btnCapture.disabled = false;
  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  // Re-anchor Unit Panel
  const unitPanel = document.getElementById("unit-panel");
  const bottomAnchor = document.getElementById("unit-bottom-anchor");
  if (unitPanel && bottomAnchor) {
    bottomAnchor.appendChild(unitPanel);
  }

  appContainer.classList.add("editing-mode");
  await drawAll();
};

/* --- CANVAS RENDERING --- */
async function drawAll() {
  canvas.width = 1200;
  canvas.height = 1800;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const selectedUnitElement = document.querySelector(
    'input[name="school-unit"]:checked',
  );
  const selectedUnit = selectedUnitElement ? selectedUnitElement.value : "UMUM";

  const photoW = 502;
  const photoH = 500;
  const gapX = 22;
  const gapY = 22;
  const startX = 88;
  const startY = 388;

  capturedPhotos.forEach((img, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (photoW + gapX);
    const y = startY + row * (photoH + gapY);

    ctx.save();
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const nw = img.width * scale;
    const nh = img.height * scale;

    ctx.beginPath();
    ctx.rect(x, y, photoW, photoH);
    ctx.clip();
    ctx.drawImage(img, x + (photoW - nw) / 2, y + (photoH - nh) / 2, nw, nh);
    ctx.restore();
  });

  const frameImg = new Image();
  frameImg.src = `frame-${selectedUnit.toLowerCase()}.png`;
  try {
    await new Promise((resolve, reject) => {
      frameImg.onload = resolve;
      frameImg.onerror = reject;
    });
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
  } catch (e) {
    console.warn("Frame tidak ditemukan, melanjutkan tanpa frame.");
  }

  // Jalankan upload otomatis setelah render selesai
  await processSessionUpload();
}

/* --- CLOUD STORAGE & QR --- */
async function processSessionUpload() {
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML =
    "<p style='color: white;'>📂 Menyiapkan Link Drive...</p>";

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "create_folder" }),
    });
    const folderData = await response.json();

    if (folderData.status === "success") {
      lastFolderUrl = folderData.folderUrl;
      await generateQR(folderData.folderUrl);

      const uploads = capturedPhotos.map((img, i) =>
        uploadSingleFile(img.src, `Pose_${i + 1}.jpg`, folderData.folderId),
      );

      uploads.push(
        uploadSingleFile(
          canvas.toDataURL("image/jpeg", 0.95),
          "Final_Photobooth.jpg",
          folderData.folderId,
        ),
      );

      await Promise.all(uploads);
      qrcodeContainer.insertAdjacentHTML(
        "beforeend",
        "<p style='color:lightgreen; font-size:12px'>✅ Tersimpan di Cloud!</p>",
      );
    }
  } catch (err) {
    console.error("Upload Error:", err);
    qrcodeContainer.innerHTML = `<p style='color:red'>Gagal upload: ${err.message}</p>`;
  }
}

async function uploadSingleFile(base64Str, filename, folderId) {
  const cleanBase64 = base64Str.split(",")[1];
  return fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      action: "upload_file",
      folderId: folderId,
      image: cleanBase64,
      filename: filename,
    }),
  });
}

async function generateQR(url) {
  qrcodeContainer.innerHTML = "";
  const qrDiv = document.createElement("div");

  new QRCode(qrDiv, {
    text: url,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.H,
  });

  await wait(600); // Tunggu QRCode selesai render
  const qrCanvas = qrDiv.querySelector("canvas");

  if (qrCanvas) {
    // Tampilkan di UI
    const uiImg = document.createElement("img");
    uiImg.src = qrCanvas.toDataURL("image/png");
    uiImg.className = "qr-preview-img"; // Bisa tambahkan class CSS
    uiImg.style.width = "100%";
    uiImg.style.maxWidth = "130px";
    uiImg.style.border = "4px solid white";

    qrcodeContainer.innerHTML =
      "<p style='color:gold; font-size:12px; margin-bottom:5px'>Scan Drive:</p>";
    qrcodeContainer.appendChild(uiImg);

    // Gambar ke Canvas Utama (Pojok Kanan Bawah)
    const qrSize = 235;
    const qrX = 852;
    const qrY = 1460;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  }
}

/* --- ACTION FUNCTIONS --- */
function shareWA() {
  const waNumber = document.getElementById("wa-number").value.trim();
  if (!waNumber || !lastFolderUrl) {
    alert("Mohon masukkan nomor WhatsApp dan tunggu folder siap.");
    return;
  }

  let cleanNumber = waNumber.replace(/\D/g, "");
  if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.slice(1);

  const message = encodeURIComponent(
    `*BAITUL MAAL PHOTOBOOTH*\n\nHasil foto Anda sudah siap! Silakan unduh melalui link Google Drive berikut:\n\n${lastFolderUrl}`,
  );
  window.open(`https://wa.me/${cleanNumber}?text=${message}`, "_blank");
  document.getElementById("wa-number").value = "";
}

function updateUnitSelection() {
  if (capturedPhotos.length > 0) drawAll();
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = `Photobooth_BM_${Date.now()}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.98);
  link.click();
}

function resetApp() {
  if (confirm("Ulangi sesi foto? Data yang belum tersimpan akan hilang.")) {
    location.reload();
  }
}

/* --- EVENT LISTENERS --- */
window.onload = initApp;
