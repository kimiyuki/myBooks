const searchInput = document.getElementById("search-input");
const favoriteToggle = document.getElementById("favorite-toggle");
const addForm = document.getElementById("add-form");
const isbnInput = document.getElementById("isbn-input");
const addButton = document.getElementById("add-button");
const bookList = document.getElementById("book-list");
const statusText = document.getElementById("status-text");
const countText = document.getElementById("count-text");
const template = document.getElementById("book-item-template");

let activeAbortController = null;

function setStatus(message, tone = "muted") {
  statusText.textContent = message;
  statusText.dataset.tone = tone;
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
  if (favoriteToggle.checked) {
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

async function addBook(isbn) {
  addButton.disabled = true;
  setStatus("追加しています…");
  try {
    const response = await fetch("/api/books", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isbn }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `追加に失敗しました (${response.status})`);
    }
    isbnInput.value = "";
    setStatus(`追加しました: ${payload.book.title}`, "success");
    await loadBooks();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    addButton.disabled = false;
  }
}

searchInput.addEventListener("input", () => {
  window.clearTimeout(loadBooks.timerId);
  loadBooks.timerId = window.setTimeout(loadBooks, 150);
});

favoriteToggle.addEventListener("change", () => {
  loadBooks();
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const isbn = isbnInput.value.replaceAll("-", "").trim();
  if (!isbn) {
    setStatus("ISBN を入力してください", "error");
    return;
  }
  await addBook(isbn);
});

loadBooks();
