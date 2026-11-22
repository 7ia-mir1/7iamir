(function () {
  const CONTENT_STORAGE_KEY = "GORNITSA_CONTENT_OVERRIDES_V1";
  const IMAGE_STORAGE_KEY = "GORNITSA_CONTENT_IMAGES_V1";
  const state = {
    texts: {},
    labels: {},
    defaultTexts: {},
    defaultLabels: {},
    book: null,
    bookDefaults: null,
    apiAvailable: false,
    apiError: "",
  };
  const imageCache = new Map();

  function readLocalJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Не удалось прочитать локальные данные ${key}.`, error);
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    return response.json();
  }

  async function loadJsonFallback(url, fallback) {
    try {
      return await fetchJson(url);
    } catch (error) {
      console.info(`Используется резервный контент вместо ${url}:`, error.message);
      return fallback;
    }
  }

  function mergeStringMap(target, source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string") target[key] = value;
    }
  }

  function localOverrides() {
    const value = readLocalJson(CONTENT_STORAGE_KEY, {});
    return value && typeof value === "object" ? value : {};
  }

  function applyLocalBookOverrides(book, values, deleted) {
    const next = {
      pages: [...(book.pages || [])],
      toc: [...(book.toc || [])],
    };
    for (const [key, value] of Object.entries(values || {})) {
      if (key === "toc") {
        try {
          const toc = JSON.parse(value);
          if (Array.isArray(toc)) next.toc = toc;
        } catch (error) {
          console.warn("Локальное оглавление книги повреждено.", error);
        }
        continue;
      }
      const pageMatch = /^page:(\d{1,4})$/.exec(key);
      if (!pageMatch) continue;
      try {
        const page = JSON.parse(value);
        if (!page || page.p !== Number(pageMatch[1])) continue;
        const index = next.pages.findIndex(item => item.p === page.p);
        if (index < 0) next.pages.push(page);
        else next.pages[index] = page;
      } catch (error) {
        console.warn(`Локальная страница книги ${key} повреждена.`, error);
      }
    }
    for (const key of Object.keys(deleted || {})) {
      if (key === "toc") {
        next.toc = [];
        continue;
      }
      const pageMatch = /^page:(\d{1,4})$/.exec(key);
      if (pageMatch) {
        const pageNumber = Number(pageMatch[1]);
        next.pages = next.pages.filter(item => item.p !== pageNumber);
      }
    }
    return next;
  }

  async function loadBook() {
    if (state.book) return state.book;
    const fallback = await loadJsonFallback("content/book.json", { pages: [], toc: [] });
    state.bookDefaults = fallback;
    let book = fallback;
    try {
      const payload = await fetchJson("/api/content?category=book");
      if (payload && payload.book) {
        book = {
          pages: Array.isArray(payload.book.pages) ? payload.book.pages : fallback.pages,
          toc: Array.isArray(payload.book.toc) ? payload.book.toc : fallback.toc,
        };
        state.apiAvailable = true;
        state.apiError = "";
      }
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = error.message;
    }
    const local = localOverrides();
    state.book = applyLocalBookOverrides(
      book,
      local.values && local.values.book,
      local.deleted && local.deleted.book,
    );
    return state.book;
  }

  async function initialize() {
    const [defaultTexts, defaultLabels] = await Promise.all([
      loadJsonFallback("content/texts.json", {}),
      loadJsonFallback("content/labels.json", {}),
    ]);
    state.defaultTexts = { ...defaultTexts };
    state.defaultLabels = { ...defaultLabels };
    mergeStringMap(state.texts, defaultTexts);
    mergeStringMap(state.labels, defaultLabels);

    try {
      const remote = await fetchJson("/api/content");
      mergeStringMap(state.texts, remote.texts);
      mergeStringMap(state.labels, remote.labels);
      state.apiAvailable = true;
      state.apiError = "";
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = error.message;
    }

    const local = localOverrides();
    mergeStringMap(state.texts, local.values && local.values.texts);
    mergeStringMap(state.labels, local.values && local.values.labels);
    for (const key of Object.keys(local.deleted && local.deleted.texts || {})) delete state.texts[key];
    for (const key of Object.keys(local.deleted && local.deleted.labels || {})) delete state.labels[key];
  }

  function lookup(map, key, fallback) {
    if (typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key)) {
      return map[key];
    }
    return typeof fallback === "string" ? fallback : key;
  }

  function applyLabels(root) {
    const scope = root || document;
    const elements = scope.nodeType === Node.ELEMENT_NODE
      ? [scope, ...scope.querySelectorAll("*")]
      : scope.querySelectorAll("*");
    for (const element of elements) {
      for (const attribute of ["title", "aria-label", "placeholder"]) {
        const value = element.getAttribute(attribute);
        if (value && Object.prototype.hasOwnProperty.call(state.labels, value)) {
          element.setAttribute(attribute, state.labels[value]);
        }
      }
    }

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const original = node.nodeValue;
      const trimmed = original.trim();
      if (!trimmed || !Object.prototype.hasOwnProperty.call(state.labels, trimmed)) continue;
      const start = original.indexOf(trimmed);
      node.nodeValue = original.slice(0, start) + state.labels[trimmed] +
        original.slice(start + trimmed.length);
    }
  }

  function imageOverrides() {
    const value = readLocalJson(IMAGE_STORAGE_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  async function resolveImage(name, fallback) {
    const local = imageOverrides().find(item => item.name === name);
    if (local && typeof local.data_url === "string") return local.data_url;
    if (!imageCache.has(name)) {
      imageCache.set(name, fetch(`/api/images?name=${encodeURIComponent(name)}`, {
        cache: "no-store",
      }).then(response => {
        if (!response.ok) return null;
        return response.blob().then(blob => URL.createObjectURL(blob));
      }).catch(() => null));
    }
    return (await imageCache.get(name)) || fallback;
  }

  async function applyImages(root) {
    const scope = root || document;
    const images = scope.matches && scope.matches("img")
      ? [scope, ...scope.querySelectorAll("img")]
      : scope.querySelectorAll("img");
    for (const image of images) {
      const path = image.getAttribute("src") || "";
      if (!path.startsWith("images/")) continue;
      const name = path.slice("images/".length);
      const fallback = image.src;
      const source = await resolveImage(name, fallback);
      if (source !== fallback) image.src = source;
    }
  }

  function saveLocalValue(category, key, value) {
    const local = localOverrides();
    if (!local.values) local.values = {};
    if (!local.values[category]) local.values[category] = {};
    local.values[category][key] = value;
    if (local.deleted && local.deleted[category]) delete local.deleted[category][key];
    writeLocalJson(CONTENT_STORAGE_KEY, local);
  }

  async function saveContent(category, key, value) {
    saveLocalValue(category, key, value);
    try {
      const response = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, key, value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      state.apiAvailable = true;
      state.apiError = "";
      if (category === "texts") state.texts[key] = value;
      if (category === "labels") state.labels[key] = value;
      if (category === "book" && state.book) {
        state.book = applyLocalBookOverrides(state.book, { [key]: value });
      }
      return { persisted: "cloud" };
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = error.message;
      if (category === "texts") state.texts[key] = value;
      if (category === "labels") state.labels[key] = value;
      if (category === "book" && state.book) {
        state.book = applyLocalBookOverrides(state.book, { [key]: value });
      }
      return { persisted: "local", error: error.message };
    }
  }

  async function deleteContent(category, key) {
    const local = localOverrides();
    const defaults = category === "texts" ? state.defaultTexts : state.defaultLabels;
    const defaultValue = category === "book" ? null : defaults[key];
    try {
      const query = new URLSearchParams({ category, key });
      const response = await fetch(`/api/admin/content?${query}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (local.values && local.values[category]) delete local.values[category][key];
      if (local.deleted && local.deleted[category]) delete local.deleted[category][key];
      writeLocalJson(CONTENT_STORAGE_KEY, local);
      state.apiAvailable = true;
      state.apiError = "";
      if (category === "texts") delete state.texts[key];
      if (category === "labels") delete state.labels[key];
      if (category === "book" && state.book && state.bookDefaults) {
        if (key === "toc") state.book.toc = [];
        else {
          const pageMatch = /^page:(\d{1,4})$/.exec(key);
          if (pageMatch) {
            const pageNumber = Number(pageMatch[1]);
            state.book.pages = state.book.pages.filter(item => item.p !== pageNumber);
          }
        }
      }
      return { persisted: "cloud" };
    } catch (error) {
      if (!local.values) local.values = {};
      if (!local.values[category]) local.values[category] = {};
      if (!local.deleted) local.deleted = {};
      if (!local.deleted[category]) local.deleted[category] = {};
      local.deleted[category][key] = true;
      delete local.values[category][key];
      writeLocalJson(CONTENT_STORAGE_KEY, local);
      state.apiAvailable = false;
      state.apiError = error.message;
      if (category === "texts") delete state.texts[key];
      if (category === "labels") delete state.labels[key];
      if (category === "book" && state.book) {
        state.book = applyLocalBookOverrides(state.book, {}, { [key]: true });
      }
      return { persisted: "local", error: error.message };
    }
  }

  async function getImages() {
    const manifest = await loadJsonFallback("images/manifest.json", []);
    const items = new Map((Array.isArray(manifest) ? manifest : []).map(item => [item.name, item]));
    try {
      const payload = await fetchJson("/api/images");
      for (const item of payload.items || []) items.set(item.name, item);
      state.apiAvailable = true;
      state.apiError = "";
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = error.message;
    }
    for (const item of imageOverrides()) {
      items.set(item.name, {
        id: item.id,
        name: item.name,
        path: item.data_url,
        source: "local-upload",
        mimeType: item.mime_type,
        sizeBytes: item.size_bytes,
        deletable: true,
      });
    }
    return [...items.values()];
  }

  async function saveImage(name, dataUrl, mimeType, sizeBytes) {
    try {
      const response = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, data_url: dataUrl }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const payload = await response.json();
      imageCache.delete(name);
      state.apiAvailable = true;
      state.apiError = "";
      return { persisted: "cloud", item: payload.item };
    } catch (error) {
      const images = imageOverrides().filter(item => item.name !== name);
      images.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        data_url: dataUrl,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      });
      writeLocalJson(IMAGE_STORAGE_KEY, images);
      imageCache.delete(name);
      state.apiAvailable = false;
      state.apiError = error.message;
      return { persisted: "local", error: error.message };
    }
  }

  async function deleteImage(item) {
    if (item.source === "local-upload") {
      writeLocalJson(IMAGE_STORAGE_KEY, imageOverrides().filter(image => image.id !== item.id));
      imageCache.delete(item.name);
      return { persisted: "local" };
    }
    try {
      const response = await fetch(`/api/admin/images?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      imageCache.delete(item.name);
      state.apiAvailable = true;
      state.apiError = "";
      return { persisted: "cloud" };
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = error.message;
      return { persisted: "failed", error: error.message };
    }
  }

  window.GornitsaContent = {
    ready: initialize(),
    get state() { return state; },
    get texts() { return state.texts; },
    get labels() { return state.labels; },
    label: (key, fallback) => lookup(state.labels, key, fallback),
    text: (key, fallback) => lookup(state.texts, key, fallback),
    resolveImage,
    applyLabels,
    applyImages,
    loadBook,
    saveContent,
    deleteContent,
    getImages,
    saveImage,
    deleteImage,
    contentStorageKey: CONTENT_STORAGE_KEY,
  };
}());
