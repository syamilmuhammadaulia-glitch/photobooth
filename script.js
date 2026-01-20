/**
 * PREMIUM PHOTOBOOTH CORE SCRIPT
 * Sinkron dengan index.html
 */

let videoStream = null;
let capturedPhotos = []; // [BARU] Array untuk menyimpan 4 foto
let currentDeviceId = null;

// Mengambil elemen dari HTML
const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");
const statusDisplay = document.getElementById("photo-status"); // [BARU]

/**
 * 1. INISIALISASI KAMERA (OTOMATIS)
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
function runCountdown(seconds) {
  return new Promise((resolve) => {
    const display = document.getElementById("timer-display");
    let count = seconds;
    display.style.display = "block";
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

// [BARU] Fungsi Helper untuk jeda sebentar antar foto
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = []; // Reset array
  
  // Ambil 4 Foto
  for (let i = 1; i <= 4; i++) {
    // Update Status
    statusDisplay.style.display = 'block';
    statusDisplay.innerText = `Siap-siap! Foto ${i} dari 4`;
    
    // Countdown
    await runCountdown(durasi);
    
    // Capture ke canvas sementara (virtual)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);
    
    // Simpan data gambar
    const imgData = tempCanvas.toDataURL("image/png");
    const imgObj = new Image();
    imgObj.src = imgData;
    await new Promise(r => imgObj.onload = r); // Tunggu load
    capturedPhotos.push(imgObj);
    
    // Flash effect atau jeda singkat
    statusDisplay.innerText = "Cekrek! 📸";
    await wait(1000); 
  }

  statusDisplay.style.display = 'none';

  // Transisi ke Editor
  videoWrapper.classList.add("hidden");
  canvas.classList.remove("hidden");
  setupControls.classList.add("hidden");
  editorControls.classList.remove("hidden");

  drawAll(); // Render Grid 2x2
};

/**
 * 3. EDITOR & FRAME DESIGN (GRID 2x2 + QR)
 */
function drawAll(filter = "none") {
  // Atur ukuran canvas utama (misal HD)
  canvas.width = 1280; 
  canvas.height = 960; // 4:3 Aspect Ratio (sedikit lebih tinggi untuk footer teks)
  
  // Warna Background Frame
  ctx.fillStyle = "#1a1d21";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ukuran per foto dalam grid
  const w = canvas.width / 2;
  const h = (canvas.height - 100) / 2; // -100px untuk space teks/QR di bawah

  // Koordinat Grid 2x2
  const positions = [
    { x: 0, y: 0 },         // Kiri Atas
    { x: w, y: 0 },         // Kanan Atas
    { x: 0, y: h },         // Kiri Bawah
    { x: w, y: h }          // Kanan Bawah
  ];

  ctx.save();
  ctx.filter = filter;

  // Gambar 4 Foto
  capturedPhotos.forEach((img, index) => {
      if(index < 4) {
          // Crop/Fit image agar sesuai kotak (object-fit: cover logic sederhana)
          // Asumsi video kamera landscape, kita draw full saja
          ctx.drawImage(img, positions[index].x, positions[index].y, w, h);
          
          // Garis pemisah tipis
          ctx.strokeStyle = "white";
          ctx.lineWidth = 5;
          ctx.strokeRect(positions[index].x, positions[index].y, w, h);
      }
  });
  ctx.restore();

  // --- ELEMEN TAMBAHAN ---
  
  // 1. Footer Background
  ctx.fillStyle = "#0f1113";
  ctx.fillRect(0, canvas.height - 100, canvas.width, 100);

  // 2. Garis Emas
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 100);
  ctx.lineTo(canvas.width, canvas.height - 100);
  ctx.stroke();

  // 3. Teks
  ctx.fillStyle = "white";
  ctx.font = "bold 40px serif";
  ctx.textAlign = "center";
  ctx.fillText("Tarhib Ramadhan 1447H", canvas.width / 2, canvas.height - 35);

  // 4. GENERATE & DRAW QR CODE
  generateAndDrawQR();
}

// [BARU] Fungsi Generate QR Code ke Canvas
function generateAndDrawQR() {
    // Konten QR: Link Website saat ini atau Nomor WA
    // Karena tidak ada server upload gambar, kita arahkan ke link umum atau text sapaan.
    const qrContent = "https://wa.me/?text=Halo%20saya%20baru%20saja%20foto%20di%20Tarhib%20Ramadhan!";
    
    const qrContainer = document.getElementById("qrcode-container");
    qrContainer.innerHTML = ""; // Bersihkan dulu
    
    // Generate QR di elemen tersembunyi
    const qrCode = new QRCode(qrContainer, {
        text: qrContent,
        width: 120,
        height: 120
    });

    // Tunggu sebentar agar QR ter-render di dalam div, lalu gambar ke canvas
    setTimeout(() => {
        const qrCanvas = qrContainer.querySelector("canvas");
        if (qrCanvas) {
            // Gambar QR di Pojok Kanan Bawah
            const qrX = canvas.width - 110; 
            const qrY = canvas.height - 110; // Sedikit overlap ke atas footer
            
            // Kotak Putih di belakang QR agar kontras
            ctx.fillStyle = "white";
            ctx.fillRect(qrX - 5, qrY - 5, 90, 90);
            
            // Draw QR
            ctx.drawImage(qrCanvas, qrX, qrY, 80, 80);
        }
    }, 100);
}

// Fungsi Filter
function applyFilter(f) {
  if (capturedPhotos.length === 0) return;
  drawAll(f);
}

/**
 * 4. SHARE, SAVE & RESET
 */
function downloadImage() {
  const link = document.createElement("a");
  link.download = `Grid_Ramadhan_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function shareWA() {
  let num = document.getElementById("wa-number").value.replace(/\D/g, "");
  if (!num) return alert("Masukkan nomor WhatsApp yang valid!");

  downloadImage(); // Auto save
  const pesan = encodeURIComponent("Lihat foto seru 4 pose saya di Tarhib Ramadhan! 🌙");
  window.open(`https://wa.me/${num}?text=${pesan}`, "_blank");
}

function resetApp() {
  if (confirm("Ingin foto ulang?")) {
    location.reload();
  }
}

initApp();
