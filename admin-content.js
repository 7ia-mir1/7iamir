(function () {
  const selectedKeys = { texts: "", labels: "" };
  let book = null;
  let textValues = {};
  let labelValues = {};

  function setStatus(id, message, isError) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.style.color = isError ? "#8b1e0b" : "#1b5e20";
  }

  function fillKeyList(select, values, category) {
    const keys = Object.keys(values).sort((a, b) => a.localeCompare(b, "ru"));
    select.replaceChildren();
    for (const key of keys) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${key.slice(0, 100)}${key.length > 100 ? "…" : ""}`;
      select.appendChild(option);
    }
    if (keys.length && !keys.includes(selectedKeys[category])) {
      selectedKeys[category] = keys[0];
    }
    select.value = selectedKeys[category];
  }

  function selectContentEntry(category) {
    const isText = category === "texts";
    const select = document.getElementById(isText ? "contentTextKeyList" : "contentLabelKeyList");
    const editor = document.getElementById(isText ? "contentTextValue" : "contentLabelValue");
    const values = isText ? textValues : labelValues;
    selectedKeys[category] = select.value;
    sessionStorage.setItem(`GORNITSA_ADMIN_CONTENT_${category}`, select.value);
    editor.value = Object.prototype.hasOwnProperty.call(values, select.value)
      ? values[select.value]
      : "";
    document.getElementById(isText ? "newTextKey" : "newLabelKey").value = "";
  }

  function beginNewContentEntry(category) {
    const isText = category === "texts";
    const keyInput = document.getElementById(isText ? "newTextKey" : "newLabelKey");
    selectedKeys[category] = "";
    sessionStorage.removeItem(`GORNITSA_ADMIN_CONTENT_${category}`);
    document.getElementById(isText ? "contentTextKeyList" : "contentLabelKeyList").selectedIndex = -1;
    document.getElementById(isText ? "contentTextValue" : "contentLabelValue").value = "";
    keyInput.focus();
  }

  async function saveSelectedContent(category) {
    const isText = category === "texts";
    const keyInput = document.getElementById(isText ? "newTextKey" : "newLabelKey");
    const key = keyInput.value.trim() || selectedKeys[category];
    const value = document.getElementById(isText ? "contentTextValue" : "contentLabelValue").value;
    const statusId = isText ? "textContentStatus" : "labelContentStatus";
    if (!key) {
      setStatus(statusId, "Выберите запись или укажите ключ новой записи.", true);
      return;
    }
    if (!value.trim()) {
      setStatus(statusId, "Текст не может быть пустым.", true);
      return;
    }

    const result = await window.GornitsaContent.saveContent(category, key, value);
    const values = isText ? textValues : labelValues;
    values[key] = value;
    selectedKeys[category] = key;
    sessionStorage.setItem(`GORNITSA_ADMIN_CONTENT_${category}`, key);
    fillKeyList(document.getElementById(isText ? "contentTextKeyList" : "contentLabelKeyList"), values, category);
    keyInput.value = "";
    if (result.persisted === "cloud") {
      setStatus(statusId, "Сохранено в Cloudflare D1.", false);
    } else {
      setStatus(statusId, `Сохранено в этом браузере; API недоступно (${result.error}).`, true);
    }
  }

  async function deleteSelectedContent(category) {
    const isText = category === "texts";
    const key = selectedKeys[category];
    const statusId = isText ? "textContentStatus" : "labelContentStatus";
    if (!key) {
      setStatus(statusId, "Сначала выберите запись.", true);
      return;
    }
    if (!window.confirm(`Удалить переопределение «${key}»?`)) return;
    const result = await window.GornitsaContent.deleteContent(category, key);
    const values = isText ? textValues : labelValues;
    delete values[key];
    selectedKeys[category] = "";
    fillKeyList(document.getElementById(isText ? "contentTextKeyList" : "contentLabelKeyList"), values, category);
    selectContentEntry(category);
    if (result.persisted === "cloud") {
      setStatus(statusId, "Запись удалена из контента сайта.", false);
    } else {
      setStatus(statusId, `Запись скрыта локально; API недоступно (${result.error}).`, true);
    }
  }

  function fillBookPageList() {
    const select = document.getElementById("bookPageList");
    select.replaceChildren();
    for (const page of book.pages) {
      const option = document.createElement("option");
      option.value = String(page.p);
      option.textContent = `${page.p}. ${page.t}`;
      select.appendChild(option);
    }
    if (select.options.length) {
      const savedPage = sessionStorage.getItem("GORNITSA_ADMIN_BOOK_PAGE");
      if (savedPage && Array.from(select.options).some(option => option.value === savedPage)) {
        select.value = savedPage;
      } else {
        select.selectedIndex = 0;
      }
      loadBookPage();
    }
  }

  function loadBookPage() {
    const pageNumber = Number(document.getElementById("bookPageList").value);
    if (Number.isInteger(pageNumber) && pageNumber > 0) {
      sessionStorage.setItem("GORNITSA_ADMIN_BOOK_PAGE", String(pageNumber));
    }
    const page = book && book.pages.find(item => item.p === pageNumber);
    document.getElementById("bookPageTitle").value = page ? page.t : "";
    document.getElementById("bookPageHtml").value = page ? page.h : "";
  }

  async function saveBookPage() {
    const pageNumber = Number(document.getElementById("bookPageList").value);
    const title = document.getElementById("bookPageTitle").value.trim();
    const html = document.getElementById("bookPageHtml").value;
    if (!Number.isInteger(pageNumber) || !title || !html.trim()) {
      setStatus("bookContentStatus", "Заполните заголовок и содержимое страницы.", true);
      return;
    }
    const page = { p: pageNumber, t: title, h: html };
    const result = await window.GornitsaContent.saveContent(
      "book",
      `page:${pageNumber}`,
      JSON.stringify(page),
    );
    const index = book.pages.findIndex(item => item.p === pageNumber);
    if (index < 0) book.pages.push(page);
    else book.pages[index] = page;
    fillBookPageList();
    document.getElementById("bookPageList").value = String(pageNumber);
    loadBookPage();
    if (result.persisted === "cloud") {
      setStatus("bookContentStatus", "Страница сохранена в Cloudflare D1.", false);
    } else {
      setStatus("bookContentStatus", `Страница сохранена в этом браузере; API недоступно (${result.error}).`, true);
    }
  }

  async function deleteBookPage() {
    const pageNumber = Number(document.getElementById("bookPageList").value);
    if (!Number.isInteger(pageNumber)) {
      setStatus("bookContentStatus", "Сначала выберите страницу.", true);
      return;
    }
    const page = book.pages.find(item => item.p === pageNumber);
    if (!page || !window.confirm(`Удалить страницу «${page.t}»?`)) return;
    const result = await window.GornitsaContent.deleteContent("book", `page:${pageNumber}`);
    book.pages = book.pages.filter(item => item.p !== pageNumber);
    book.toc = book.toc.filter(item => item.p !== pageNumber);
    fillBookPageList();
    if (result.persisted === "cloud") {
      setStatus("bookContentStatus", "Страница удалена из контента сайта.", false);
    } else {
      setStatus("bookContentStatus", `Страница удалена локально; API недоступно (${result.error}).`, true);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Не удалось прочитать файл изображения."));
      reader.readAsDataURL(file);
    });
  }

  function makeImageCard(item) {
    const card = document.createElement("article");
    card.className = "image-card";
    const preview = document.createElement("img");
    preview.className = "image-preview";
    preview.loading = "lazy";
    preview.decoding = "async";
    preview.alt = item.name;
    preview.src = item.path.startsWith("images/") ? item.path : item.path;

    const title = document.createElement("strong");
    title.style.cssText = "display:block; overflow-wrap:anywhere; margin:8px 0 3px;";
    title.textContent = item.name;
    const meta = document.createElement("div");
    meta.style.cssText = "font-size:12px; color:#6a4928; margin-bottom:8px;";
    const size = Number(item.sizeBytes) || 0;
    const purpose = item.purpose || (
      item.source && item.source.startsWith("embedded:")
        ? `Изображение страницы ${item.source.slice("embedded:".length)}`
        : item.source === "uploaded" || item.source === "local-upload"
          ? "Загруженное изображение"
          : "Статическое изображение проекта"
    );
    meta.textContent = `Назначение: ${purpose} · ${(size / 1024).toFixed(1)} КБ`;

    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
    file.setAttribute("aria-label", `Заменить ${item.name}`);
    file.addEventListener("change", () => {
      if (file.files && file.files[0]) replaceImage(item.name, file.files[0]);
    });
    const actions = document.createElement("div");
    actions.style.cssText = "display:grid; gap:7px; margin-top:7px;";
    actions.append(file);
    if (item.deletable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "action-btn danger";
      remove.textContent = "🗑 Удалить загруженное";
      remove.addEventListener("click", () => removeImage(item));
      actions.appendChild(remove);
    }
    card.append(preview, title, meta, actions);
    return card;
  }

  async function renderImages() {
    const gallery = document.getElementById("imageGallery");
    gallery.replaceChildren();
    try {
      const items = await window.GornitsaContent.getImages();
      for (const item of items) gallery.appendChild(makeImageCard(item));
      setStatus("imageContentStatus", `Изображений в проекте: ${items.length}.`, false);
    } catch (error) {
      setStatus("imageContentStatus", `Не удалось загрузить список изображений: ${error.message}`, true);
    }
  }

  async function persistImage(name, file) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)) {
      setStatus("imageContentStatus", "Имя файла должно содержать только латинские буквы, цифры, точку, дефис или подчёркивание.", true);
      return;
    }
    if (file.size > 262144) {
      setStatus("imageContentStatus", "D1 принимает изображения размером не более 256 КБ.", true);
      return;
    }
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
      setStatus("imageContentStatus", "Поддерживаются JPG, PNG, WebP, GIF и AVIF.", true);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await window.GornitsaContent.saveImage(name, dataUrl, file.type, file.size);
      if (result.persisted === "cloud") {
        setStatus("imageContentStatus", `${name} сохранено в Cloudflare D1.`, false);
      } else {
        setStatus("imageContentStatus", `${name} сохранено только в этом браузере (${result.error}).`, true);
      }
      await renderImages();
    } catch (error) {
      setStatus("imageContentStatus", error.message, true);
    }
  }

  function replaceImage(name, file) {
    persistImage(name, file);
  }

  function uploadNewImage() {
    const input = document.getElementById("newImageFile");
    const file = input.files && input.files[0];
    if (!file) {
      setStatus("imageContentStatus", "Выберите файл изображения.", true);
      return;
    }
    const nameInput = document.getElementById("newImageName");
    const name = nameInput.value.trim() || file.name;
    persistImage(name, file).then(() => {
      if (!window.GornitsaContent.state.apiError) {
        nameInput.value = "";
        input.value = "";
      }
    });
  }

  async function removeImage(item) {
    if (!window.confirm(`Удалить загруженное изображение «${item.name}»?`)) return;
    const result = await window.GornitsaContent.deleteImage(item);
    if (result.persisted === "failed") {
      setStatus("imageContentStatus", `Не удалось удалить изображение: ${result.error}`, true);
      return;
    }
    setStatus("imageContentStatus", `${item.name} удалено.`, false);
    await renderImages();
  }

  async function initialize() {
    await window.GornitsaContent.ready;
    textValues = { ...window.GornitsaContent.texts };
    labelValues = { ...window.GornitsaContent.labels };
    selectedKeys.texts = sessionStorage.getItem("GORNITSA_ADMIN_CONTENT_texts") || "";
    selectedKeys.labels = sessionStorage.getItem("GORNITSA_ADMIN_CONTENT_labels") || "";
    fillKeyList(document.getElementById("contentTextKeyList"), textValues, "texts");
    fillKeyList(document.getElementById("contentLabelKeyList"), labelValues, "labels");
    document.getElementById("contentTextKeyList").addEventListener("change", () => selectContentEntry("texts"));
    document.getElementById("contentLabelKeyList").addEventListener("change", () => selectContentEntry("labels"));
    document.getElementById("bookPageList").addEventListener("change", loadBookPage);
    selectContentEntry("texts");
    selectContentEntry("labels");
    book = await window.GornitsaContent.loadBook();
    fillBookPageList();
    await renderImages();
  }

  window.beginNewContentEntry = beginNewContentEntry;
  window.saveSelectedContent = saveSelectedContent;
  window.deleteSelectedContent = deleteSelectedContent;
  window.saveBookPage = saveBookPage;
  window.deleteBookPage = deleteBookPage;
  window.uploadNewImage = uploadNewImage;
  window.addEventListener("DOMContentLoaded", initialize);
}());
