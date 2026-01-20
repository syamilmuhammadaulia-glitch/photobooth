/**
 * PREMIUM PHOTOBOOTH - UPLOAD TO GOOGLE DRIVE
 * Fitur: 4 Foto (2x2), Upload Otomatis, QR Code Link Drive
 */

// --- KONFIGURASI ---
// PASTE URL DARI LANGKAH 1 DI SINI (JANGAN SAMPAI SALAH/KURANG)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby2E6BKNotD6wjhjShjrwuF_8bkNZe8svvq5LqmquLxTE7u9641gpmxUqW8y1gGDnn_/exec"; 

let videoStream = null;
let capturedPhotos = []; 
let currentDeviceId = null;

const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");
const qrcodeContainer = document.getElementById("qrcode-container");

// 1. INISIALISASI KAMERA
async function initApp() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const select = document.getElementById("camera-select");

    select.innerHTML = videoDevices
      .map((d) => `<option value="${d.deviceId}">${d.label || "Kamera " + d.deviceId.slice(0, 5)}</option>`)
      .join("");

    if (videoDevices.length > 0) {
      currentDeviceId = videoDevices[0].deviceId;
      await startCamera(currentDeviceId);
    }
  } catch (err) {
    console.error("Gagal inisialisasi:", err);
    alert("Mohon izinkan akses kamera.");
  }
}

async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
  }
  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;
  } catch (err) {
    console.error("Gagal akses kamera:", err);
  }
}

document.getElementById("camera-select").onchange = (e) => {
  currentDeviceId = e.target.value;
  startCamera(currentDeviceId);
};

// 2. CAPTURE LOGIC
function runCountdown(seconds, poseNum) {
  return new Promise((resolve) => {
    const display = document.getElementById("timer-display");
    const status = document.getElementById("photo-status");
    let count = seconds;

    display.style.display = "flex";
    display.innerText = count;
    status.style.display = "block";
    status.innerText = `Pose ${poseNum} / 4`;

    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        display.style.display = "none";
        status.style.display = "none";
        resolve();
      } else {
        display.innerText = count;
      }
    }, 1000);
  });
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = [];
  const btn = document.getElementById("btn-capture");
  
  btn.disabled = true;
  btn.innerText = "📸 Pose...";

  for (let i = 1; i <= 4; i++) {
    await runCountdown(durasi, i);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.translate(video.videoWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    
    const img = new Image();
    img.src = tempCanvas.toDataURL("image/png");
    await new Promise(r => img.onload = r);
    capturedPhotos.push(img);
    
    videoWrapper.style.opacity = "0.5";
    await wait(200);
    videoWrapper.style.opacity = "1";
    if (i < 4) await wait(1000);
  }

  btn.disabled = false;
  btn.innerText = "📸 MULAI FOTO";

  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  // Render & Upload
  await drawAll();
};

// 3. RENDER, UPLOAD, & QR
async function drawAll(filter = "none") {
  canvas.width = 1200;
  canvas.height = 1800;
  
  const cellW = canvas.width / 2;
  const cellH = canvas.height / 2;
  const positions = [{ x: 0, y: 0 }, { x: cellW, y: 0 }, { x: 0, y: cellH }, { x: cellW, y: cellH }];

  ctx.save();
  ctx.filter = filter;

  capturedPhotos.forEach((img, i) => {
    if (i < 4) {
        const scale = Math.max(cellW / img.width, cellH / img.height);
        const x = (cellW / scale - img.width) / 2;
        const y = (cellH / scale - img.height) / 2;

        ctx.save();
        ctx.translate(positions[i].x, positions[i].y);
        ctx.beginPath();
        ctx.rect(0, 0, cellW, cellH);
        ctx.clip();
        ctx.scale(scale, scale);
        ctx.drawImage(img, x, y);
        ctx.restore();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 4;
        ctx.strokeRect(positions[i].x, positions[i].y, cellW, cellH);
    }
  });
  ctx.restore();

  // Overlay Text
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px 'Cinzel', serif";
  ctx.textAlign = "center";
  ctx.fillText("Tarhib Ramadhan", canvas.width / 2, canvas.height / 2 - 15);
  ctx.font = "30px sans-serif";
  ctx.fillText("1447 H / 2026 M", canvas.width / 2, canvas.height / 2 + 35);
  ctx.restore();

  // --- PROSES UPLOAD KE DRIVE ---
  await uploadAndGenerateQR();
}

async function uploadAndGenerateQR() {
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML = "<p>Sedang mengupload foto ke Cloud...</p>";
  
  // 1. Ambil Data Base64 dari Canvas
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const base64Data = dataUrl.split(",")[1]; // Hapus header "data:image/..."
  
  // 2. Kirim ke Google Apps Script
  if (GOOGLE_SCRIPT_URL === "TEMPEL_URL_GOOGLE_APPS_SCRIPT_DISINI") {
      alert("ERROR: URL Google Apps Script belum dipasang di script.js!");
      qrcodeContainer.innerHTML = "<p style='color:red'>Setup Error: URL Script Kosong</p>";
      return;
  }

  try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
              image: base64Data,
              mimeType: "image/jpeg",
              filename: "Photobooth_" + Date.now() + ".jpg"
          })
      });

      const result = await response.json();
      
      if (result.status === "success") {
          // Upload Berhasil! Gunakan URL dari Drive
          const driveUrl = result.url;
          console.log("File Uploaded:", driveUrl);
          
          generateQR(driveUrl);
      } else {
          throw new Error(result.message);
      }

  } catch (error) {
      console.error("Upload Gagal:", error);
      qrcodeContainer.innerHTML = "<p style='color:red'>Gagal Upload. Cek Koneksi.</p>";
      alert("Gagal upload ke Google Drive. Pastikan script benar.");
  }
}

async function generateQR(url) {
  qrcodeContainer.innerHTML = "";
  
  const qrDiv = document.createElement("div");
  // Generate QR isi Link Drive
  const qrCode = new QRCode(qrDiv, {
    text: url,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.L // Level L agar QR tidak terlalu rumit
  });

  await wait(500);
  
  const qrImgRaw = qrDiv.querySelector("img");
  if (qrImgRaw) {
      // Tampilan Web UI
      const uiImg = qrImgRaw.cloneNode(true);
      uiImg.style.width = "100%";
      uiImg.style.maxWidth = "120px";
      uiImg.style.border = "4px solid white";
      qrcodeContainer.innerHTML = "<p style='margin-bottom:5px; color:#aaa; font-size:12px'>Scan untuk Download:</p>";
      qrcodeContainer.appendChild(uiImg);

      // Gambar QR di Canvas (Overlay)
      const qrSize = 140; 
      const qrX = canvas.width - qrSize - 30;
      const qrY = canvas.height - qrSize - 30;

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.drawImage(qrImgRaw, qrX, qrY, qrSize, qrSize);
  }
}

function applyFilter(f) {
  if (capturedPhotos.length === 0) return;
  drawAll(f);
}

function downloadImage() {
  if (capturedPhotos.length === 0) return;
  const link = document.createElement("a");
  link.download = `Photobooth_${Date.now()}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.click();
}

function shareWA() {
  if (capturedPhotos.length === 0) return alert("Belum ada foto!");
  let num = document.getElementById("wa-number").value.replace(/\D/g, "");
  if (!num) return alert("Masukkan nomor WA!");
  
  // Karena sekarang foto di-upload, kita bisa kirim LINK DRIVE-nya juga di WA!
  // (Jika upload sudah selesai dan kita simpan URL-nya di variabel global, tapi versi simple kirim teks saja dulu)
  
  downloadImage();
  const pesan = encodeURIComponent("Lihat hasil foto Photobooth Tarhib Ramadhan saya! 🌙");
  window.open(`https://wa.me/${num}?text=${pesan}`, "_blank");
}

function resetApp() {
  if (confirm("Foto akan hilang. Ulangi?")) {
    location.reload();
  }
}

window.addEventListener('load', initApp);


