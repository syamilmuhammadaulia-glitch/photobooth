/**
 * PREMIUM PHOTOBOOTH - MULTI UPLOAD
 * Fitur: Bikin Folder Per Sesi, Upload 4 Pose + 1 Grid (Total 5 File)
 */

// --- PASTE URL APPS SCRIPT BARU DI SINI ---
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

// 1. INIT KAMERA
async function initApp() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const select = document.getElementById("camera-select");
    select.innerHTML = videoDevices.map((d) => `<option value="${d.deviceId}">${d.label || "Kamera " + d.deviceId.slice(0, 5)}</option>`).join("");
    if (videoDevices.length > 0) {
      currentDeviceId = videoDevices[0].deviceId;
      await startCamera(currentDeviceId);
    }
  } catch (err) { console.error(err); alert("Izin kamera diperlukan."); }
}

async function startCamera(deviceId) {
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } });
    video.srcObject = videoStream;
  } catch (err) { console.error(err); }
}
document.getElementById("camera-select").onchange = (e) => { currentDeviceId = e.target.value; startCamera(currentDeviceId); };

// 2. CAPTURE LOGIC
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function runCountdown(seconds, poseNum) {
  return new Promise((resolve) => {
    const display = document.getElementById("timer-display");
    const status = document.getElementById("photo-status");
    let count = seconds;
    display.style.display = "flex"; display.innerText = count;
    status.style.display = "block"; status.innerText = `Pose ${poseNum} / 4`;
    const timer = setInterval(() => {
      count--;
      if (count <= 0) { clearInterval(timer); display.style.display = "none"; status.style.display = "none"; resolve(); } 
      else { display.innerText = count; }
    }, 1000);
  });
}

document.getElementById("btn-capture").onclick = async () => {
  const durasi = parseInt(document.getElementById("timer-duration").value) || 3;
  capturedPhotos = [];
  const btn = document.getElementById("btn-capture");
  btn.disabled = true; btn.innerText = "📸 Pose...";

  for (let i = 1; i <= 4; i++) {
    await runCountdown(durasi, i);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth; tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.translate(video.videoWidth, 0); tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    
    const img = new Image(); img.src = tempCanvas.toDataURL("image/jpeg", 0.9);
    await new Promise(r => img.onload = r);
    capturedPhotos.push(img); // Simpan foto mentah
    
    videoWrapper.style.opacity = "0.5"; await wait(200); videoWrapper.style.opacity = "1";
    if (i < 4) await wait(1000);
  }

  btn.disabled = false; btn.innerText = "📸 MULAI FOTO";
  videoWrapper.classList.add("hidden"); canvas.classList.remove("hidden");
  setupControls.classList.add("hidden"); editorControls.classList.remove("hidden");
  
  await drawAll();
};

// 3. DRAW & ORCHESTRATE UPLOAD
async function drawAll(filter = "none") {
  canvas.width = 1200; canvas.height = 1800;
  const cellW = canvas.width / 2; const cellH = canvas.height / 2;
  const positions = [{ x: 0, y: 0 }, { x: cellW, y: 0 }, { x: 0, y: cellH }, { x: cellW, y: cellH }];

  ctx.save(); ctx.filter = filter;
  capturedPhotos.forEach((img, i) => {
    if (i < 4) {
      const scale = Math.max(cellW / img.width, cellH / img.height);
      const x = (cellW / scale - img.width) / 2;
      const y = (cellH / scale - img.height) / 2;
      ctx.save(); ctx.translate(positions[i].x, positions[i].y);
      ctx.beginPath(); ctx.rect(0, 0, cellW, cellH); ctx.clip();
      ctx.scale(scale, scale); ctx.drawImage(img, x, y); ctx.restore();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"; ctx.lineWidth = 4;
      ctx.strokeRect(positions[i].x, positions[i].y, cellW, cellH);
    }
  });
  ctx.restore();

  // Overlay Text
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 15; ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 60px 'Cinzel', serif"; ctx.textAlign = "center";
  ctx.fillText("Tarhib Ramadhan", canvas.width / 2, canvas.height / 2 - 15);
  ctx.font = "30px sans-serif"; ctx.fillText("1447 H / 2026 M", canvas.width / 2, canvas.height / 2 + 35);
  ctx.restore();

  // --- MULAI PROSES MULTI UPLOAD ---
  await processSessionUpload();
}

async function processSessionUpload() {
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML = "<p>📂 Membuat Folder Sesi...</p>";

  if (GOOGLE_SCRIPT_URL.includes("TEMPEL")) return alert("URL Script belum dipasang!");

  try {
    // LANGKAH 1: Minta Backend Bikin Folder Baru
    const createRes = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST", body: JSON.stringify({ action: "create_folder" })
    });
    const folderData = await createRes.json();
    
    if (folderData.status !== "success") throw new Error("Gagal bikin folder");
    
    const folderId = folderData.folderId;
    const folderUrl = folderData.folderUrl;
    
    console.log("Folder Created:", folderUrl);
    
    // LANGKAH 2: Tampilkan QR Code Folder (Biar user bisa scan duluan)
    await generateQR(folderUrl);
    
    // LANGKAH 3: Upload 5 Foto (Background Process)
    qrcodeContainer.innerHTML += "<p style='font-size:12px; color:#aaa'>Mengirim foto ke folder...</p>";
    
    // A. Upload 4 Foto Mentah
    for (let i = 0; i < capturedPhotos.length; i++) {
       await uploadSingleFile(capturedPhotos[i].src, `Pose_${i+1}.jpg`, folderId);
    }
    
    // B. Upload Foto Grid Final (Ambil dari Canvas)
    const gridDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    await uploadSingleFile(gridDataUrl, "Grid_Final_Full.jpg", folderId);
    
    // Selesai
    const statusText = document.createElement("p");
    statusText.innerText = "✅ Semua Foto Tersimpan!";
    statusText.style.color = "lightgreen";
    statusText.style.fontSize = "12px";
    qrcodeContainer.appendChild(statusText);

  } catch (err) {
    console.error(err);
    qrcodeContainer.innerHTML += `<p style='color:red'>Error: ${err.message}</p>`;
  }
}

async function uploadSingleFile(base64Str, filename, folderId) {
  // Bersihkan header data:image...
  const cleanBase64 = base64Str.split(",")[1];
  
  await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "upload_file",
        folderId: folderId,
        image: cleanBase64,
        filename: filename
      })
  });
  console.log("Uploaded:", filename);
}

// --- FUNGSI PENDUKUNG LAINNYA ---
async function generateQR(url) {
  // Bersihkan container tapi jangan hapus status teks
  const oldStatus = qrcodeContainer.innerHTML;
  qrcodeContainer.innerHTML = "";
  
  const qrDiv = document.createElement("div");
  new QRCode(qrDiv, { text: url, width: 200, height: 200, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });
  await wait(500);
  
  const qrCanvas = qrDiv.querySelector("canvas");
  if (qrCanvas) {
      const uiImg = document.createElement("img");
      uiImg.src = qrCanvas.toDataURL();
      uiImg.style.width = "100%"; uiImg.style.maxWidth = "140px"; uiImg.style.border = "5px solid white"; uiImg.style.borderRadius = "8px";
      
      qrcodeContainer.innerHTML = "<p style='margin-bottom:5px; color:#gold; font-size:14px; font-weight:bold'>Scan Folder Disini:</p>";
      qrcodeContainer.appendChild(uiImg);
      
      // Gambar QR di Canvas Utama juga (Pojok)
      const qrSize = 150; const qrX = canvas.width - qrSize - 40; const qrY = canvas.height - qrSize - 40;
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(qrX-10, qrY-10, qrSize+20, qrSize+20);
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  }
}

function applyFilter(f) { if (capturedPhotos.length) drawAll(f); }
function downloadImage() { if (capturedPhotos.length) { const l = document.createElement("a"); l.download = `Photobooth_${Date.now()}.jpg`; l.href = canvas.toDataURL("image/jpeg", 0.95); l.click(); }}
function shareWA() { if (!capturedPhotos.length) return alert("Foto dulu!"); let n = document.getElementById("wa-number").value.replace(/\D/g, ""); if(!n) return alert("No WA?"); downloadImage(); window.open(`https://wa.me/${n}?text=Ini%20foto%20saya!`, "_blank"); }
function resetApp() { if (confirm("Ulang?")) location.reload(); }
window.onload = initApp;
