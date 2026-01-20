/**
 * PREMIUM PHOTOBOOTH SCRIPT - PORTRAIT EDITION
 */

let videoStream = null;
let capturedPhotos = []; 
let currentDeviceId = null;
let currentFilter = 'none'; // Menyimpan filter yang aktif

const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");
const statusDisplay = document.getElementById("photo-status");

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
  // [UBAH] Meminta resolusi yang lebih tinggi agar tajam saat di-crop portrait
  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1920 }, 
      height: { ideal: 1080 },
    },
    audio: false,
  };
  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;
  } catch (err) {
    console.error("Gagal akses kamera:", err);
    // Fallback jika kamera HD tidak didukung
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = videoStream;
    } catch(e) { alert("Kamera tidak dapat diakses.") }
  }
}

document.getElementById("camera-select").onchange = (e) => {
  currentDeviceId = e.target.value;
  startCamera(currentDeviceId);
};

/**
 * 2. LOGIKA CAPTURE (LOOP 4 FOTO)
 */
function runCountdown(seconds) {
  return new Promise((resolve) => {
    const display = document.getElementById("timer-display");
    let count = seconds;
    display.style.display = "flex"; // Menggunakan flex agar terpusat (sesuai CSS baru)
    display.innerText = count;

    const timer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timer);
        display.style.display = "none";
        resolve();
      } else {
        display.innerText = count;
      }
    }, 1000);
  });
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi Helper: Crop tengah (Center Cut) dari video landscape ke kotak portrait
function cropCenter(sourceCanvas, targetWidth, targetHeight) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tCtx = tempCanvas.getContext('2d');

    // Hitung aspek rasio
    const sourceAspect = sourceCanvas.width / sourceCanvas.height;
    const targetAspect = targetWidth / targetHeight;

    let renderW, renderH, offsetX, offsetY;

    if (sourceAspect > targetAspect) {
        // Source lebih lebar (landscape), crop sisi kiri-kanan
        renderH = targetHeight;
        renderW = sourceCanvas.width * (targetHeight / sourceCanvas.height);
        offsetX = (targetWidth - renderW) / 2;
        offsetY = 0;
    } else {
        // Source lebih tinggi (jarang terjadi di webcam), crop atas-bawah
        renderW = targetWidth;
        renderH = sourceCanvas.height * (targetWidth / sourceCanvas.width);
        offsetX = 0;
        offsetY = (targetHeight - renderH) / 2;
    }

    tCtx.drawImage(sourceCanvas, offsetX, offsetY, renderW, renderH);
    return tempCanvas;
}


document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = [];
  
  document.getElementById("btn-capture").classList.remove("btn-pulse"); // Stop animasi tombol

  for (let i = 1; i <= 4; i++) {
    statusDisplay.style.display = 'block';
    statusDisplay.innerHTML = `Pose <b>${i}</b> / 4`;
    
    await runCountdown(durasi);
    
    // Capture resolusi penuh dari video
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = video.videoWidth;
    rawCanvas.height = video.videoHeight;
    const rawCtx = rawCanvas.getContext('2d');
    rawCtx.drawImage(video, 0, 0); // Gambar video asli (biasanya landscape)

    // Simpan gambar asli
    const imgObj = new Image();
    imgObj.src = rawCanvas.toDataURL("image/jpeg", 0.9);
    await new Promise(r => imgObj.onload = r);
    capturedPhotos.push(imgObj);
    
    statusDisplay.innerHTML = "✨ Cekrek! ✨";
    await wait(800); 
  }

  statusDisplay.style.display = 'none';

  // Transisi UI
  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  drawAll();
  showLargeQRInUI(); // [BARU] Tampilkan QR Besar di panel samping
};

/**
 * 3. EDITOR & FRAME DESIGN (PORTRAIT + GRID 2x2)
 */
function drawAll(filter = currentFilter) {
  currentFilter = filter;
  
  // [UBAH] Dimensi Portrait (3:4 ratio resolution)
  canvas.width = 900;  
  canvas.height = 1200;
  
  const footerHeight = 180; // Area bawah untuk teks & QR kecil
  const gridAreaHeight = canvas.height - footerHeight;
  const padding = 30; // Jarak pinggir frame

  // Warna Background Frame Mewah
  const gradientBg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradientBg.addColorStop(0, "#15171b");
  gradientBg.addColorStop(1, "#0a0b0d");
  ctx.fillStyle = gradientBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border Emas Luar
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 15;
  ctx.strokeRect(7.5, 7.5, canvas.width - 15, canvas.height - 15);
  // Border Emas Dalam Tipis
  ctx.lineWidth = 2;
  ctx.strokeRect(padding - 10, padding - 10, canvas.width - (padding*2) + 20, gridAreaHeight - (padding*2) + 20);

  // Perhitungan Grid
  // Area bersih untuk 4 foto
  const usableWidth = canvas.width - (padding * 2);
  const usableHeight = gridAreaHeight - (padding * 2);
  
  const cellW = usableWidth / 2;
  const cellH = usableHeight / 2;
  const gap = 15; // Jarak antar foto

  // Koordinat 4 Foto
  const positions = [
    { x: padding, y: padding },
    { x: padding + cellW + gap, y: padding },
    { x: padding, y: padding + cellH + gap },
    { x: padding + cellW + gap, y: padding + cellH + gap }
  ];

  ctx.save();
  ctx.filter = filter;

  // Gambar 4 Foto dalam Grid
  capturedPhotos.forEach((img, index) => {
      if(index < 4) {
        // Crop foto landscape menjadi kotak portrait agar pas di cell
        const croppedCanvas = cropCenter(img, cellW, cellH);
        
        const posX = positions[index].x;
        const posY = positions[index].y;

        // Shadow di belakang foto
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        
        // Gambar foto yang sudah di-crop
        ctx.drawImage(croppedCanvas, posX, posY, cellW, cellH);

        // Reset shadow untuk border
        ctx.shadowColor = "transparent";
        
        // Border putih tipis di sekeliling tiap foto
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        ctx.strokeRect(posX, posY, cellW, cellH);
      }
  });
  ctx.restore();
