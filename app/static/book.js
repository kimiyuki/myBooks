const params = new URLSearchParams(window.location.search);
const isbn = params.get("isbn");

const detailStatus = document.getElementById("detail-status");
const bookDetailCard = document.getElementById("book-detail-card");
const detailThumb = document.getElementById("detail-thumb");
const detailTitle = document.getElementById("detail-title");
const detailFavorite = document.getElementById("detail-favorite");
const detailAuthors = document.getElementById("detail-authors");
const detailPublisher = document.getElementById("detail-publisher");
const detailIsbn = document.getElementById("detail-isbn");
const detailPublishedDate = document.getElementById("detail-published-date");
const detailRegisteredAt = document.getElementById("detail-registered-at");
const scrapToggleButton = document.getElementById("scrap-toggle-button");
const scrapCapturePanel = document.getElementById("scrap-capture-panel");
const scrapPageInput = document.getElementById("scrap-page-input");
const scrapCloseButton = document.getElementById("scrap-close-button");
const scrapVideo = document.getElementById("scrap-video");
const scrapCanvas = document.getElementById("scrap-canvas");
const scrapStartButton = document.getElementById("scrap-start-button");
const scrapCaptureButton = document.getElementById("scrap-capture-button");
const scrapRetakeButton = document.getElementById("scrap-retake-button");
const scrapSaveButton = document.getElementById("scrap-save-button");
const scrapStatus = document.getElementById("scrap-status");
const scrapList = document.getElementById("scrap-list");
const scrapItemTemplate = document.getElementById("scrap-item-template");

let captureState = {
  stream: null,
  capturedDataUrl: null,
};

function setDetailStatus(message, tone = "muted") {
  detailStatus.textContent = message;
  detailStatus.dataset.tone = tone;
}

function setScrapStatus(message, tone = "muted") {
  scrapStatus.textContent = message;
  scrapStatus.dataset.tone = tone;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function normalizeThumbnailUrl(url) {
  if (!url) return "";
  return String(url).replace(/^http:\/\//, "https://");
}

function renderBook(book) {
  if (book.thumbnail_url) {
    detailThumb.src = normalizeThumbnailUrl(book.thumbnail_url);
    detailThumb.alt = `${book.title} の表紙`;
  } else {
    detailThumb.removeAttribute("src");
    detailThumb.alt = "";
  }
  detailTitle.textContent = book.title;
  detailAuthors.textContent = book.authors;
  detailPublisher.textContent = book.publisher || "出版社未設定";
  detailIsbn.textContent = `ISBN ${book.isbn}`;
  detailPublishedDate.textContent = book.published_date ? `刊行 ${book.published_date}` : "刊行日未設定";
  detailRegisteredAt.textContent = `登録 ${formatDateTime(book.registered_at)}`;
  detailFavorite.hidden = !book.favorite;
  bookDetailCard.hidden = false;
}

function renderScraps(scraps) {
  scrapList.innerHTML = "";
  if (scraps.length === 0) {
    const empty = document.createElement("li");
    empty.className = "scrap-empty";
    empty.textContent = "まだ scrap はありません";
    scrapList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const scrap of scraps) {
    const node = scrapItemTemplate.content.firstElementChild.cloneNode(true);
    const image = node.querySelector(".scrap-image");
    const page = node.querySelector(".scrap-page");
    const createdAt = node.querySelector(".scrap-created-at");

    image.src = scrap.media_url;
    image.alt = `${scrap.page ?? "ページ未設定"} の scrap`;
    page.textContent = scrap.page == null ? "ページ未設定" : `page ${scrap.page}`;
    createdAt.textContent = formatDateTime(scrap.created_at);
    fragment.appendChild(node);
  }
  scrapList.appendChild(fragment);
}

async function loadBookDetail() {
  if (!isbn) {
    setDetailStatus("ISBN が指定されていません", "error");
    return;
  }
  setDetailStatus("読み込み中…");
  try {
    const [bookResponse, scrapsResponse] = await Promise.all([
      fetch(`/api/books/${encodeURIComponent(isbn)}`),
      fetch(`/api/books/${encodeURIComponent(isbn)}/scraps`),
    ]);
    if (!bookResponse.ok) {
      throw new Error(`本の取得に失敗しました (${bookResponse.status})`);
    }
    if (!scrapsResponse.ok) {
      throw new Error(`scrap の取得に失敗しました (${scrapsResponse.status})`);
    }

    const bookPayload = await bookResponse.json();
    const scrapsPayload = await scrapsResponse.json();
    renderBook(bookPayload.book);
    renderScraps(scrapsPayload.scraps);
    setDetailStatus("");
  } catch (error) {
    setDetailStatus(error.message, "error");
  }
}

function setCapturePanelOpen(open) {
  scrapCapturePanel.hidden = !open;
  scrapToggleButton.dataset.active = String(open);
}

function stopCamera() {
  if (captureState.stream) {
    for (const track of captureState.stream.getTracks()) {
      track.stop();
    }
  }
  captureState.stream = null;
  captureState.capturedDataUrl = null;
  scrapVideo.srcObject = null;
  scrapCanvas.hidden = true;
  scrapVideo.hidden = false;
  scrapCaptureButton.disabled = true;
  scrapRetakeButton.hidden = true;
  scrapSaveButton.hidden = true;
  scrapSaveButton.disabled = true;
  setScrapStatus("");
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setScrapStatus("このブラウザではカメラを起動できません", "error");
    return;
  }
  if (captureState.stream) {
    return;
  }
  setScrapStatus("カメラを起動しています…");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    captureState.stream = stream;
    scrapVideo.srcObject = stream;
    await scrapVideo.play();
    scrapCaptureButton.disabled = false;
    setScrapStatus("写したいページを中央に入れてください");
  } catch (error) {
    stopCamera();
    setScrapStatus(error.message, "error");
  }
}

function captureScrap() {
  if (!captureState.stream) {
    return;
  }
  scrapCanvas.width = scrapVideo.videoWidth;
  scrapCanvas.height = scrapVideo.videoHeight;
  const context = scrapCanvas.getContext("2d");
  context.drawImage(scrapVideo, 0, 0, scrapCanvas.width, scrapCanvas.height);
  captureState.capturedDataUrl = scrapCanvas.toDataURL("image/jpeg", 0.88);
  scrapVideo.hidden = true;
  scrapCanvas.hidden = false;
  scrapCaptureButton.disabled = true;
  scrapRetakeButton.hidden = false;
  scrapSaveButton.hidden = false;
  scrapSaveButton.disabled = false;
  setScrapStatus("撮影しました。保存するか、撮り直してください", "success");
}

function retakeScrap() {
  captureState.capturedDataUrl = null;
  scrapCanvas.hidden = true;
  scrapVideo.hidden = false;
  scrapCaptureButton.disabled = false;
  scrapRetakeButton.hidden = true;
  scrapSaveButton.hidden = true;
  scrapSaveButton.disabled = true;
  setScrapStatus("もう一度写したいページを中央に入れてください");
}

async function saveScrap() {
  if (!captureState.capturedDataUrl) {
    setScrapStatus("先に撮影してください", "error");
    return;
  }
  scrapSaveButton.disabled = true;
  setScrapStatus("保存しています…");
  try {
    const pageValue = scrapPageInput.value.trim();
    const response = await fetch(`/api/books/${encodeURIComponent(isbn)}/scraps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page: pageValue === "" ? null : pageValue,
        image_data_url: captureState.capturedDataUrl,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `scrap 保存に失敗しました (${response.status})`);
    }
    setScrapStatus("保存しました", "success");
    scrapPageInput.value = "";
    stopCamera();
    setCapturePanelOpen(false);
    await loadBookDetail();
  } catch (error) {
    scrapSaveButton.disabled = false;
    setScrapStatus(error.message, "error");
  }
}

scrapToggleButton.addEventListener("click", async () => {
  const willOpen = scrapCapturePanel.hidden;
  setCapturePanelOpen(willOpen);
  if (willOpen) {
    await startCamera();
  } else {
    stopCamera();
  }
});

scrapStartButton.addEventListener("click", async () => {
  await startCamera();
});

scrapCloseButton.addEventListener("click", () => {
  setCapturePanelOpen(false);
  stopCamera();
});

scrapCaptureButton.addEventListener("click", () => {
  captureScrap();
});

scrapRetakeButton.addEventListener("click", () => {
  retakeScrap();
});

scrapSaveButton.addEventListener("click", async () => {
  await saveScrap();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopCamera();
    setCapturePanelOpen(false);
  }
});

window.addEventListener("beforeunload", () => {
  stopCamera();
});

loadBookDetail();
