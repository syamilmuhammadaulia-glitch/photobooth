/**
 * PREMIUM PHOTOBOOTH - FINAL VERSION
 * Fix: CORS, Multi-Upload Parallel, & Center Cropping
 */

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxmy3vHV7orIJQVv-SocyPsH79eWDeR9zDr7m231nphytqJ1Qpjxv82V4iUN9w4UlE/exec"; 

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
  } catch (err) { 
    console.error(err); 
    alert("Izin kamera diperlukan."); 
  }
}

async function startCamera(deviceId) {
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        deviceId: deviceId ? { exact: deviceId } : undefined, 
        width: { ideal: 1280 }, 
        height: { ideal: 720 } 
      } 
    });
    video.srcObject = videoStream;
  } catch (err) { console.error(err); }
}

document.getElementById("camera-select").onchange = (e) => { 
  currentDeviceId = e.target.value; 
  startCamera(currentDeviceId); 
};

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
      if (count <= 0) { 
        clearInterval(timer); display.style.display = "none"; status.style.display = "none"; resolve(); 
      } else { display.innerText = count; }
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
    tempCanvas.width = video.videoWidth; 
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Mirroring Fix
    tempCtx.translate(video.videoWidth, 0); 
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    
    const img = new Image(); 
    img.src = tempCanvas.toDataURL("image/jpeg", 0.9);
    await new Promise(r => img.onload = r);
    capturedPhotos.push(img); 
    
    videoWrapper.style.opacity = "0.5"; await wait(200); videoWrapper.style.opacity = "1";
    if (i < 4) await wait(1000);
  }

  btn.disabled = false; btn.innerText = "📸 MULAI FOTO";
  videoWrapper.classList.add("hidden"); canvas.classList.remove("hidden");
  setupControls.classList.add("hidden"); editorControls.classList.remove("hidden");
  
  await drawAll();
};

// 3. DRAW LOGIC (CENTER CROPPING FIX)
async function drawAll(filter = "none") {
  canvas.width = 1200; 
  canvas.height = 1800;
  const cellW = canvas.width / 2; 
  const cellH = canvas.height / 2;
  const positions = [
    { x: 0, y: 0 }, { x: cellW, y: 0 }, 
    { x: 0, y: cellH }, { x: cellW, y: cellH }
  ];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  capturedPhotos.forEach((img, i) => {
    if (i < 4) {
      ctx.save();
      ctx.filter = filter;
      
      const posX = positions[i].x;
      const posY = positions[i].y;

      // LOGIKA CENTER CROP (Mencegah Foto Geser)
      const ratio = Math.max(cellW / img.width, cellH / img.height);
      const drawWidth = img.width * ratio;
      const drawHeight = img.height * ratio;

      const offsetX = (cellW - drawWidth) / 2;
      const offsetY = (cellH - drawHeight) / 2;

      ctx.beginPath();
      ctx.rect(posX, posY, cellW, cellH);
      ctx.clip(); // Potong bagian yang luber

      ctx.drawImage(img, posX + offsetX, posY + offsetY, drawWidth, drawHeight);
      
      ctx.restore();
      // Border putih antar foto
      ctx.strokeStyle = "white";
      ctx.lineWidth = 10;
      ctx.strokeRect(posX, posY, cellW, cellH);
    }
  });

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

  await processSessionUpload();
}

// 4. UPLOAD LOGIC
async function processSessionUpload() {
  qrcodeContainer.style.display = "block";
  qrcodeContainer.innerHTML = "<p>📂 Menghubungkan ke Drive...</p>";

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      body: JSON.stringify({ action: "create_folder" }),
      headers: { "Content-Type": "text/plain;charset=utf-8" } 
    });

    const folderData = await response.json();
    if (folderData.status !== "success") throw new Error(folderData.message);
    
    const folderId = folderData.folderId;
    const folderUrl = folderData.folderUrl;
    
    await generateQR(folderUrl);
    
    qrcodeContainer.innerHTML += "<p style='font-size:12px; color:#aaa'>Mengirim foto...</p>";
    
    // Upload Paralel agar Cepat
    const uploads = capturedPhotos.map((img, i) => 
      uploadSingleFile(img.src, `Pose_${i+1}.jpg`, folderId)
    );
    const gridDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    uploads.push(uploadSingleFile(gridDataUrl, "Grid_Final_Full.jpg", folderId));

    await Promise.all(uploads);
    qrcodeContainer.innerHTML += "<p style='color:lightgreen; font-size:12px'>✅ Tersimpan!</p>";

  } catch (err) {
    console.error("Upload Error:", err);
    qrcodeContainer.innerHTML = `<p style='color:red'>Gagal: ${err.message}</p>`;
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
      filename: filename
    })
  });
}

// 5. QR CODE LOGIC
async function generateQR(url) {
  qrcodeContainer.innerHTML = "";
  const qrDiv = document.createElement("div");
  new QRCode(qrDiv, { 
    text: url, width: 200, height: 200, 
    colorDark : "#000000", colorLight : "#ffffff", 
    correctLevel : QRCode.CorrectLevel.L 
  });

  await wait(500);
  const qrCanvas = qrDiv.querySelector("canvas");
  if (qrCanvas) {
    const uiImg = document.createElement("img");
    uiImg.src = qrCanvas.toDataURL();
    uiImg.style.width = "100%"; uiImg.style.maxWidth = "140px"; uiImg.style.border = "5px solid white"; uiImg.style.borderRadius = "8px";
    qrcodeContainer.innerHTML = "<p style='margin-bottom:5px; color:gold; font-size:14px; font-weight:bold'>Scan Folder Drive:</p>";
    qrcodeContainer.appendChild(uiImg);
    
    const qrSize = 150; 
    const qrX = canvas.width - qrSize - 40; 
    const qrY = canvas.height - qrSize - 40;
    ctx.fillStyle = "rgba(255,255,255,0.9)"; 
    ctx.fillRect(qrX-10, qrY-10, qrSize+20, qrSize+20);
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  }
}

function applyFilter(f) { if (capturedPhotos.length) drawAll(f); }
function downloadImage() { 
  if (capturedPhotos.length) { 
    const l = document.createElement("a"); l.download = `Photo_${Date.now()}.jpg`; 
    l.href = canvas.toDataURL("image/jpeg", 0.95); l.click(); 
  }
}
function shareWA() { 
  let n = document.getElementById("wa-number").value.replace(/\D/g, ""); 
  if(!n) return alert("Masukkan nomor WA!"); 
  window.open(`https://wa.me/${n}?text=Ini hasil foto photobooth saya!`, "_blank"); 
}
function resetApp() { if (confirm("Ulang sesi?")) location.reload(); }

window.onload = initApp;
