const searchInput = document.getElementById("search-input");
const favoriteToggle = document.getElementById("favorite-toggle");
const registerToggle = document.getElementById("register-toggle");
const registerPanel = document.getElementById("register-panel");
const addForm = document.getElementById("add-form");
const isbnInput = document.getElementById("isbn-input");
const addButton = document.getElementById("add-button");
const scanButton = document.getElementById("scan-button");
const scannerPanel = document.getElementById("scanner-panel");
const scannerCloseButton = document.getElementById("scanner-close-button");
const scannerVideo = document.getElementById("scanner-video");
const scannerStatus = document.getElementById("scanner-status");
const bookList = document.getElementById("book-list");
const statusText = document.getElementById("status-text");
const countText = document.getElementById("count-text");
const template = document.getElementById("book-item-template");

let activeAbortController = null;
let scannerState = {
  stream: null,
  detector: null,
  scanTimerId: null,
  active: false,
  busy: false,
  lastDetectedText: null,
};
let favoritesOnly = false;
const FAVORITES_ONLY_STORAGE_KEY = "mybooks:favorites-only";

function loadPersistedFavoritesOnly() {
  try {
    return window.localStorage.getItem(FAVORITES_ONLY_STORAGE_KEY) === "true";
  } catch (error) {
    return false;
  }
}

function persistFavoritesOnly(value) {
  try {
    window.localStorage.setItem(FAVORITES_ONLY_STORAGE_KEY, String(value));
  } catch (error) {
    // Ignore storage failures and keep the UI usable.
  }
}

function setRegisterPanelOpen(open) {
  registerPanel.hidden = !open;
  registerToggle.setAttribute("aria-expanded", String(open));
  registerToggle.dataset.active = String(open);
}

function setFavoriteToggle(active) {
  favoritesOnly = active;
  favoriteToggle.setAttribute("aria-pressed", String(active));
  favoriteToggle.dataset.active = String(active);
  persistFavoritesOnly(active);
}

function setStatus(message, tone = "muted") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
}

function setScannerStatus(message, tone = "muted") {
  scannerStatus.textContent = message;
  scannerStatus.dataset.tone = tone;
}

function formatRegisteredAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function normalizeIsbn(text) {
  return String(text || "")
    .replaceAll("-", "")
    .trim()
    .toUpperCase();
}

function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(isbn[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(isbn[12]);
}

function scoreBarcodeCandidate(candidate) {
  const value = normalizeIsbn(candidate?.rawValue);
  if (!/^\d{13}$/.test(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  if (value.startsWith("978") || value.startsWith("979")) {
    score += 100;
  }
  if (isValidIsbn13(value)) {
    score += 50;
  }
  if (value.startsWith("192")) {
    score -= 120;
  }

  const top = candidate?.boundingBox?.y;
  if (typeof top === "number") {
    score += Math.max(0, 500 - top) / 100;
  }

  return score;
}

function chooseDetectedIsbn(barcodes) {
  const ranked = barcodes
    .map((candidate) => ({
      candidate,
      value: normalizeIsbn(candidate?.rawValue),
      score: scoreBarcodeCandidate(candidate),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    return null;
  }

  const best = ranked[0];
  if (best.score < 120) {
    return null;
  }
  return best.value;
}

function renderBooks(books) {
  bookList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const book of books) {
    const node = template.content.firstElementChild.cloneNode(true);
    const thumb = node.querySelector(".thumb");
    const title = node.querySelector(".book-title");
    const authors = node.querySelector(".book-authors");
    const publisher = node.querySelector(".book-publisher");
    const bookIsbn = node.querySelector(".book-isbn");
    const bookDate = node.querySelector(".book-date");
    const bookRegistered = node.querySelector(".book-registered");
    const favoriteChip = node.querySelector(".favorite-chip");

    if (book.thumbnail_url) {
      thumb.src = book.thumbnail_url;
      thumb.alt = `${book.title} の表紙`;
    } else {
      thumb.replaceWith(document.createTextNode("No image"));
      node.querySelector(".thumb-wrap").classList.add("thumb-wrap-empty");
    }

    title.textContent = book.title;
    authors.textContent = book.authors;
    publisher.textContent = book.publisher || "出版社未設定";
    bookIsbn.textContent = `ISBN ${book.isbn}`;
    bookDate.textContent = book.published_date ? `刊行 ${book.published_date}` : "刊行日未設定";
    bookRegistered.textContent = `登録 ${formatRegisteredAt(book.registered_at)}`;

    if (book.favorite) {
      favoriteChip.hidden = false;
    }

    fragment.appendChild(node);
  }

  bookList.appendChild(fragment);
}

async function loadBooks() {
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();

  const params = new URLSearchParams();
  const query = searchInput.value.trim();
  if (query) {
    params.set("q", query);
  }
  if (favoritesOnly) {
    params.set("favorite", "1");
  }

  const url = `/api/books?${params.toString()}`;
  try {
    const response = await fetch(url, {
      signal: activeAbortController.signal,
    });
    if (!response.ok) {
      throw new Error(`一覧取得に失敗しました (${response.status})`);
    }
    const payload = await response.json();
    renderBooks(payload.books);
    countText.textContent = `${payload.count} 冊`;
    setStatus("");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    renderBooks([]);
    countText.textContent = "";
    setStatus(error.message, "error");
  }
}

function setAddButtonsDisabled(disabled) {
  addButton.disabled = disabled;
  scanButton.disabled = disabled;
  registerToggle.disabled = disabled;
}

async function addBook(isbn) {
  const normalizedIsbn = normalizeIsbn(isbn);
  setAddButtonsDisabled(true);
  setStatus("追加しています…");
  try {
    const response = await fetch("/api/books", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isbn: normalizedIsbn }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `追加に失敗しました (${response.status})`);
    }
    isbnInput.value = "";
    setStatus(`追加しました: ${payload.book.title}`, "success");
    setRegisterPanelOpen(false);
    await loadBooks();
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    return false;
  } finally {
    setAddButtonsDisabled(false);
  }
}

function stopScanner() {
  if (scannerState.scanTimerId !== null) {
    window.clearTimeout(scannerState.scanTimerId);
  }
  scannerState.scanTimerId = null;
  scannerState.active = false;
  scannerState.busy = false;
  scannerState.lastDetectedText = null;
  if (scannerState.stream) {
    for (const track of scannerState.stream.getTracks()) {
      track.stop();
    }
  }
  scannerState.stream = null;
  scannerState.detector = null;
  scannerVideo.srcObject = null;
  scannerPanel.hidden = true;
  scanButton.disabled = false;
  scannerCloseButton.disabled = false;
  setScannerStatus("");
}

async function scanLoop() {
  if (!scannerState.active || scannerState.busy || !scannerState.detector) {
    return;
  }
  scannerState.busy = true;
  try {
    const barcodes = await scannerState.detector.detect(scannerVideo);
    const isbn = chooseDetectedIsbn(barcodes);
    if (isbn) {
      if (isbn && isbn !== scannerState.lastDetectedText) {
        scannerState.lastDetectedText = isbn;
        setScannerStatus(`読み取りました: ${isbn}`, "success");
        isbnInput.value = isbn;
        stopScanner();
        await addBook(isbn);
        return;
      }
    }
    if (scannerState.active) {
      const sawPriceCode = barcodes.some((item) => normalizeIsbn(item?.rawValue).startsWith("192"));
      if (sawPriceCode) {
        setScannerStatus("価格コードを読んでいます。上側の ISBN バーコードを中央に入れてください", "error");
      } else {
        setScannerStatus("ISBN バーコードを枠の中に入れてください");
      }
    }
  } catch (error) {
    setScannerStatus(`読み取りに失敗しました: ${error.message}`, "error");
    stopScanner();
    return;
  } finally {
    scannerState.busy = false;
  }

  if (scannerState.active) {
    scannerState.scanTimerId = window.setTimeout(scanLoop, 180);
  }
}

async function buildDetector() {
  if (!("BarcodeDetector" in window)) {
    throw new Error("このブラウザではバーコード読み取りに対応していません");
  }
  const formats = await window.BarcodeDetector.getSupportedFormats();
  const preferredFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
  const supportedFormats = preferredFormats.filter((format) => formats.includes(format));
  if (supportedFormats.length === 0) {
    throw new Error("この端末では ISBN 向けバーコード形式が使えません");
  }
  return new window.BarcodeDetector({ formats: supportedFormats });
}

async function startScanner() {
  if (scannerState.active) {
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("このブラウザではカメラを起動できません", "error");
    return;
  }

  scanButton.disabled = true;
  scannerPanel.hidden = false;
  setScannerStatus("カメラを起動しています…");

  try {
    const detector = await buildDetector();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    scannerState.detector = detector;
    scannerState.stream = stream;
    scannerState.active = true;
    setRegisterPanelOpen(true);
    scannerVideo.srcObject = stream;
    await scannerVideo.play();
    setScannerStatus("バーコードを枠の中に入れてください");
    scannerState.scanTimerId = window.setTimeout(scanLoop, 250);
  } catch (error) {
    stopScanner();
    setStatus(error.message, "error");
  }
}

searchInput.addEventListener("input", () => {
  window.clearTimeout(loadBooks.timerId);
  loadBooks.timerId = window.setTimeout(loadBooks, 150);
});

favoriteToggle.addEventListener("click", () => {
  setFavoriteToggle(!favoritesOnly);
  loadBooks();
});

registerToggle.addEventListener("click", () => {
  const willOpen = registerPanel.hidden;
  if (!willOpen) {
    stopScanner();
  }
  setRegisterPanelOpen(willOpen);
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isbn = normalizeIsbn(isbnInput.value);
  if (!isbn) {
    setStatus("ISBN を入力してください", "error");
    return;
  }
  await addBook(isbn);
});

scanButton.addEventListener("click", async () => {
  await startScanner();
});

scannerCloseButton.addEventListener("click", () => {
  stopScanner();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && scannerState.active) {
    stopScanner();
  }
});

window.addEventListener("beforeunload", () => {
  stopScanner();
});

setRegisterPanelOpen(false);
setFavoriteToggle(loadPersistedFavoritesOnly());
loadBooks();
