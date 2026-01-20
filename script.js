/**
 * PREMIUM PHOTOBOOTH - 4 GRID FULL FRAME
 * Fitur: 4 Foto (2x2), Full Layar Tanpa Footer, QR Code Overlay
 */

let videoStream = null;
let capturedPhotos = []; // Array untuk menyimpan 4 foto
let currentDeviceId = null;

// Mengambil elemen
const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");
const qrcodeContainer = document.getElementById("qrcode-container");

/**
 * 1. INISIALISASI KAMERA
 */
async function initApp() {
  try {
    // Meminta resolusi HD
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

/**
 * 2. LOGIKA CAPTURE (LOOP 4 FOTO)
 */
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

  // --- LOOP 4 KALI ---
  for (let i = 1; i <= 4; i++) {
    await runCountdown(durasi, i);
    
    // Capture Frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Mirror Effect
    tempCtx.translate(video.videoWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    
    // Simpan Image
    const img = new Image();
    img.src = tempCanvas.toDataURL("image/png");
    await new Promise(r => img.onload = r);
    capturedPhotos.push(img);
    
    // Flash Effect
    videoWrapper.style.opacity = "0.5";
    await wait(200);
    videoWrapper.style.opacity = "1";
    
    if (i < 4) await wait(1000); // Jeda antar pose
  }

  btn.disabled = false;
  btn.innerText = "📸 MULAI FOTO";

  // Pindah ke Editor
  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  // Render Hasil Full Frame
  drawAll();
};

/**
 * 3. EDITOR: 4 GRID FULL CANVAS (NO FOOTER)
 */
async function drawAll(filter = "none") {
  // Ukuran Canvas Portrait Standar (2:3 Ratio)
  // Tidak ada area header/footer khusus, semua dipakai foto
  canvas.width = 1200;
  canvas.height = 1800;
  
  // Hitung ukuran per sel (2 kolom x 2 baris)
  const cellW = canvas.width / 2;
  const cellH = canvas.height / 2;

  // Koordinat 4 sel
  const positions = [
    { x: 0, y: 0 },         // Kiri Atas
    { x: cellW, y: 0 },     // Kanan Atas
    { x: 0, y: cellH },     // Kiri Bawah
    { x: cellW, y: cellH }  // Kanan Bawah
  ];

  ctx.save();
  ctx.filter = filter;

  capturedPhotos.forEach((img, i) => {
    if (i < 4) {
        // Logika Crop Center agar foto video pas di kotak portrait
        const scale = Math.max(cellW / img.width, cellH / img.height);
        const x = (cellW / scale - img.width) / 2;
        const y = (cellH / scale - img.height) / 2;

        ctx.save();
        ctx.translate(positions[i].x, positions[i].y);
        
        // Kliping agar tidak bocor ke sel sebelah
        ctx.beginPath();
        ctx.rect(0, 0, cellW, cellH);
        ctx.clip();

        ctx.scale(scale, scale);
        ctx.drawImage(img, x, y);
        ctx.restore();
        
        // Border Tipis Putih sebagai pemisah antar grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 4;
        ctx.strokeRect(positions[i].x, positions[i].y, cellW, cellH);
    }
  });
  ctx.restore();

  // --- OVERLAY ELEMENT (TEKS & QR) ---
  // Karena tidak ada footer hitam, kita taruh di atas foto (Overlay)

  // 1. Teks Judul (Di Tengah/Center dengan Shadow Kuat)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 60px 'Cinzel', serif";
  ctx.textAlign = "center";
  
  // Taruh teks di titik temu 4 foto (Center)
  ctx.fillText("Tarhib Ramadhan", canvas.width / 2, canvas.height / 2 - 15);
  ctx.font = "30px sans-serif";
  ctx.fillText("1447 H / 2026 M", canvas.width / 2, canvas.height / 2 + 35);
  ctx.restore();

  // 2. Generate & Draw QR Code Overlay (Kecil)
  await generateAndDrawQR();
}

async function generateAndDrawQR() {
  qrcodeContainer.innerHTML = "";
  const linkData = window.location.href; 
  
  const qrDiv = document.createElement("div");
  const qrCode = new QRCode(qrDiv, {
    text: linkData,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });

  // Tampilkan di Web UI (Kanan)
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML = "<p style='margin-bottom:5px; color:#aaa; font-size:12px'>Scan:</p>";
  
  await wait(300);
  
  const qrImgRaw = qrDiv.querySelector("img");
  if (qrImgRaw) {
      // Clone ke UI web
      const uiImg = qrImgRaw.cloneNode(true);
      uiImg.style.width = "100%";
      uiImg.style.maxWidth = "120px";
      uiImg.style.border = "4px solid white";
      qrcodeContainer.appendChild(uiImg);

      // --- GAMBAR QR DI CANVAS (OVERLAY POJOK) ---
      const qrSize = 140; // Ukuran QR kecil
      // Posisi: Pojok Kanan Bawah (dengan sedikit margin)
      const qrX = canvas.width - qrSize - 30;
      const qrY = canvas.height - qrSize - 30;

      // Buat kotak putih semi-transparan di belakang QR agar terbaca
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      // Rounded rect manual atau kotak biasa
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
  link.download = `Photobooth_4Grid_${Date.now()}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.95);
  link.click();
}

function shareWA() {
  if (capturedPhotos.length === 0) return alert("Belum ada foto!");
  let num = document.getElementById("wa-number").value.replace(/\D/g, "");
  if (!num) return alert("Masukkan nomor WA!");

  downloadImage(); 
  const pesan = encodeURIComponent("Ini hasil foto grid 4 pose saya! 🌙");
  window.open(`https://wa.me/${num}?text=${pesan}`, "_blank");
}

function resetApp() {
  if (confirm("Foto akan hilang. Ulangi?")) {
    location.reload();
  }
}

// Auto Init
window.addEventListener('load', initApp);
