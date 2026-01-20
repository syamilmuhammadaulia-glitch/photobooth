/**
 * PREMIUM PHOTOBOOTH CORE SCRIPT
 * Fitur: 4 Foto Grid, QR Code Otomatis, Kirim WA, Filter
 */

let videoStream = null;
let capturedPhotos = []; // Array untuk menyimpan 4 foto
let currentDeviceId = null;

// Mengambil elemen dari HTML
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

    display.style.display = "flex"; // Pastikan CSS-nya flex biar di tengah
    display.innerText = count;
    
    // Tampilkan status pose
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

// Fungsi helper untuk jeda
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = []; // Reset array foto
  const btn = document.getElementById("btn-capture");
  
  btn.disabled = true;
  btn.innerText = "Sedang Mengambil Foto...";

  // LOOP 4 KALI
  for (let i = 1; i <= 4; i++) {
    await runCountdown(durasi, i);
    
    // Capture Frame Video Mentah
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Efek Mirror (Opsional, sesuaikan selera)
    tempCtx.translate(video.videoWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    
    // Simpan sebagai Image Object
    const img = new Image();
    img.src = tempCanvas.toDataURL("image/png");
    await new Promise(r => img.onload = r);
    capturedPhotos.push(img);
    
    // Efek Flash Layar
    videoWrapper.style.opacity = "0.5";
    await wait(200);
    videoWrapper.style.opacity = "1";
    
    // Jeda antar foto agar user bisa ganti gaya
    if (i < 4) await wait(1000); 
  }

  btn.disabled = false;
  btn.innerText = "📸 MULAI CAPTURE (4 POSE)";

  // Transisi ke Editor
  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  // Gambar Grid + QR
  drawAll();
};

/**
 * 3. EDITOR: GRID 4 FOTO + QR CODE
 */
async function drawAll(filter = "none") {
  // Atur Ukuran Canvas Portrait (Misal: 1000 x 1500 px)
  canvas.width = 1000;
  canvas.height = 1500;
  
  const margin = 50;
  const gap = 20;
  const headerHeight = 150;
  const footerHeight = 300; // Ruang untuk QR Code & Teks Bawah

  // 1. Background Frame
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#15171b");
  gradient.addColorStop(1, "#000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Judul Header
  ctx.fillStyle = "#d4af37"; // Warna Emas
  ctx.font = "bold 60px serif";
  ctx.textAlign = "center";
  ctx.fillText("Tarhib Ramadhan", canvas.width / 2, 100);
  ctx.fillStyle = "#fff";
  ctx.font = "30px sans-serif";
  ctx.fillText("1447 Hijriah", canvas.width / 2, 145);

  // 3. Grid 4 Foto
  const gridW = canvas.width - (margin * 2);
  const gridH = canvas.height - headerHeight - footerHeight - margin;
  const cellW = (gridW - gap) / 2;
  const cellH = (gridH - gap) / 2;

  const positions = [
    { x: margin, y: headerHeight },
    { x: margin + cellW + gap, y: headerHeight },
    { x: margin, y: headerHeight + cellH + gap },
    { x: margin + cellW + gap, y: headerHeight + cellH + gap }
  ];

  ctx.save();
  ctx.filter = filter; // Terapkan filter ke foto saja

  capturedPhotos.forEach((img, i) => {
    if (i < 4) {
        // Crop Center (Agar foto landscape pas di kotak portrait)
        const scale = Math.max(cellW / img.width, cellH / img.height);
        const x = (cellW / scale - img.width) / 2;
        const y = (cellH / scale - img.height) / 2;
        
        ctx.save();
        ctx.translate(positions[i].x, positions[i].y);
        ctx.scale(scale, scale);
        ctx.drawImage(img, x, y);
        ctx.restore();
        
        // Border Putih Tipis per Foto
        ctx.strokeStyle = "white";
        ctx.lineWidth = 10;
        ctx.strokeRect(positions[i].x, positions[i].y, cellW, cellH);
    }
  });
  ctx.restore();

  // 4. Border Emas Luar
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 20;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // 5. GENERATE & GAMBAR QR CODE
  await generateAndDrawQR();
}

async function generateAndDrawQR() {
  // Hapus QR lama jika ada
  qrcodeContainer.innerHTML = "";
  
  // Link simulasi (Ganti dengan logika upload jika sudah ada server)
  const linkData = window.location.href; 
  
  // Buat elemen QR tersembunyi
  const qrDiv = document.createElement("div");
  const qrCode = new QRCode(qrDiv, {
    text: linkData,
    width: 200,
    height: 200,
    colorDark : "#000000",
    colorLight : "#ffffff",
    correctLevel : QRCode.CorrectLevel.H
  });

  // Tampilkan QR di Panel Kanan Web (sesuai request)
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML = "<p style='margin-bottom:10px; color:#aaa; font-size:14px'>Scan untuk akses:</p>";
  
  // Tunggu sebentar agar QR tergenerate
  await wait(300);
  
  const qrImg = qrDiv.querySelector("img");
  if (qrImg) {
      // Clone untuk ditampilkan di Web UI
      const uiImg = qrImg.cloneNode(true);
      uiImg.style.width = "100%";
      uiImg.style.maxWidth = "150px";
      uiImg.style.border = "5px solid white";
      qrcodeContainer.appendChild(uiImg);

      // Gambar ke Canvas (Bagian Bawah)
      const qrSize = 180;
      const qrX = canvas.width / 2 - (qrSize / 2); // Center bawah
      const qrY = canvas.height - 240;
      
      // Background kotak putih untuk QR di canvas
      ctx.fillStyle = "white";
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      
      // Teks bawah QR
      ctx.fillStyle = "white";
      ctx.font = "italic 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scan QR untuk menyimpan foto ini", canvas.width / 2, qrY + qrSize + 40);
  }
}

function applyFilter(f) {
  if (capturedPhotos.length === 0) return;
  drawAll(f);
}

/**
 * 4. SHARE, SAVE & RESET (FITUR LAMA DIKEMBALIKAN)
 */
function downloadImage() {
  const link = document.createElement("a");
  link.download = `Photo_Ramadhan_${Date.now()}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.9);
  link.click();
}

function shareWA() {
  let num = document.getElementById("wa-number").value.replace(/\D/g, "");
  if (!num) return alert("Masukkan nomor WhatsApp yang valid!");

  // Simpan foto dulu agar user punya file-nya
  downloadImage(); 
  
  const pesan = encodeURIComponent("Halo! Lihat foto seru saya di Photobooth Tarhib Ramadhan 🌙");
  // Arahkan ke WA (Hanya kirim teks, karena WA API web tidak bisa kirim gambar langsung dari localhost)
  window.open(`https://wa.me/${num}?text=${pesan}`, "_blank");
}

function resetApp() {
  if (confirm("Foto akan hilang. Mulai ulang?")) {
    location.reload();
  }
}

// Start
initApp();
