/**
 * PREMIUM PHOTOBOOTH CORE SCRIPT
 * Sinkron dengan index.html (Desain Baru)
 */

let videoStream = null;
let fotoMentah = null;
let currentDeviceId = null;

// Mengambil elemen dari HTML
const video = document.getElementById("video");
const canvas = document.getElementById("main-canvas");
const ctx = canvas.getContext("2d");
const videoWrapper = document.getElementById("video-wrapper");
const setupControls = document.getElementById("setup-controls");
const editorControls = document.getElementById("editor-controls");

/**
 * 1. INISIALISASI KAMERA (OTOMATIS)
 */
async function initApp() {
  try {
    // Meminta izin kamera terlebih dahulu agar label nama kamera muncul
    await navigator.mediaDevices.getUserMedia({ video: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput",
    );
    const select = document.getElementById("camera-select");

    // Isi dropdown kamera
    select.innerHTML = videoDevices
      .map(
        (d) =>
          `<option value="${d.deviceId}">${d.label || "Kamera " + d.deviceId.slice(0, 5)}</option>`,
      )
      .join("");

    if (videoDevices.length > 0) {
      currentDeviceId = videoDevices[0].deviceId;
      await startCamera(currentDeviceId);
    }
  } catch (err) {
    console.error("Gagal inisialisasi:", err);
    alert("Mohon izinkan akses kamera agar aplikasi dapat berjalan.");
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

// Event ganti kamera dari dropdown
document.getElementById("camera-select").onchange = (e) => {
  currentDeviceId = e.target.value;
  startCamera(currentDeviceId);
};

/**
 * 2. LOGIKA CAPTURE & TIMER
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

document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;

  // Proses Timer
  await runCountdown(durasi);

  // Ambil Gambar
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Simpan ke memori sebagai Image Object
  fotoMentah = new Image();
  fotoMentah.src = canvas.toDataURL("image/png");

  fotoMentah.onload = () => {
    // Transisi: Sembunyikan Video, Tampilkan Editor
    videoWrapper.classList.add("hidden");
    canvas.classList.remove("hidden");
    setupControls.classList.add("hidden");
    editorControls.classList.remove("hidden");

    drawAll(); // Gambar Frame Awal
  };
};

/**
 * 3. EDITOR & FRAME DESIGN
 */
function drawAll(filter = "none") {
  // 1. Bersihkan Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Gambar Foto dengan Filter
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(fotoMentah, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // 3. FRAME PREMIUM RAMADHAN
  // Border Emas
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 40;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Teks Ucapan
  ctx.fillStyle = "white";
  ctx.font = "bold 35px serif"; // Font serif agar terlihat mewah
  ctx.textAlign = "center";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 10;
  ctx.fillText("Tarhib Ramadhan 1447H", canvas.width / 2, canvas.height - 60);
}

// Fungsi Filter (Dipanggil dari onclick di HTML)
function applyFilter(f) {
  if (!fotoMentah) return;
  drawAll(f);
}

/**
 * 4. SHARE, SAVE & RESET
 */
function downloadImage() {
  const link = document.createElement("a");
  link.download = `Photo_Ramadhan_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function shareWA() {
  let num = document.getElementById("wa-number").value.replace(/\D/g, "");
  if (!num) return alert("Masukkan nomor WhatsApp yang valid!");

  downloadImage(); // Otomatis simpan sebagai backup
  const pesan = encodeURIComponent("Cek foto seru saya di Tarhib Ramadhan! 🌙");
  window.open(`https://wa.me/${num}?text=${pesan}`, "_blank");
}

function resetApp() {
  if (confirm("Ingin ambil foto ulang? Foto saat ini akan dihapus.")) {
    location.reload();
  }
}

// JALANKAN APLIKASI SAAT PAGE LOAD
initApp();

