const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function readJson(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}

function boundedLimit(value, fallback = 50) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : fallback;
}

const MAX_YAGA_HISTORY_MESSAGES = 36;
const MAX_YAGA_HISTORY_CHARS = 32000;

async function handleChat(request, env) {
  if (request.method === "GET") {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "DELETE FROM chat_messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
    ).bind(now).run();

    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    if (!userId || !/^\d{1,10}$/.test(userId)) {
      return errorResponse("Укажите корректный user_id.", 400);
    }
    const limit = boundedLimit(url.searchParams.get("limit"));
    const result = await env.DB.prepare(
      `SELECT id, sender_id, target_id, text, file_url, file_name,
              image_data_url, image_size_kb, file_data_url, file_size_formatted,
              delete_scope, no_save, created_at, expires_at
       FROM chat_messages
       WHERE target_id = 'ALL' OR sender_id = ? OR target_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    ).bind(userId, userId, limit + 1).all();

    const hasMore = result.results.length > limit;
    const messages = result.results.slice(0, limit).reverse();
    return jsonResponse({ messages, has_more: hasMore });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      await env.DB.prepare("DELETE FROM chat_messages WHERE id = ?").bind(id).run();
    } else {
      const userId = url.searchParams.get("user_id");
      if (!userId || !/^\d{1,10}$/.test(userId)) {
        return errorResponse("Укажите корректный user_id.", 400);
      }
      await env.DB.prepare(
        "DELETE FROM chat_messages WHERE target_id = 'ALL' OR sender_id = ? OR target_id = ?",
      ).bind(userId, userId).run();
    }
    return jsonResponse({ status: "ok" });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const senderId = typeof body.sender_id === "string" ? body.sender_id.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "ALL";
    const fileUrl = typeof body.file_url === "string" ? body.file_url.trim() : null;
    const fileName = typeof body.file_name === "string" ? body.file_name.trim() : null;
    const imageDataUrl = typeof body.image_data_url === "string" ? body.image_data_url : null;
    const imageSizeKb = Number.isInteger(body.image_size_kb) ? body.image_size_kb : null;
    const fileDataUrl = typeof body.file_data_url === "string" ? body.file_data_url : null;
    const fileSizeFormatted = typeof body.file_size_formatted === "string"
      ? body.file_size_formatted.trim()
      : null;
    const noSave = body.no_save === true;
    const deleteScope = noSave
      ? "both"
      : ["off", "me", "both"].includes(body.delete_scope)
        ? body.delete_scope
        : "off";
    const validDataUrl = value =>
      value === null || /^data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(value);
    const payloadBytes = new TextEncoder().encode(
      `${text}${imageDataUrl || ""}${fileDataUrl || ""}${fileName || ""}${fileSizeFormatted || ""}`,
    ).byteLength;

    if (payloadBytes > 1800000) {
      return errorResponse("Вложение превышает лимит хранения в D1.", 413);
    }
    if (!/^\d{1,10}$/.test(senderId) ||
        !(targetId === "ALL" || /^\d{1,10}$/.test(targetId)) ||
        text.length > 10000 || (fileUrl && fileUrl.length > 2048) ||
        (fileName && fileName.length > 255) ||
        (fileSizeFormatted && fileSizeFormatted.length > 50) ||
        (imageSizeKb !== null && (imageSizeKb < 0 || imageSizeKb > 2000)) ||
        !validDataUrl(imageDataUrl) || !validDataUrl(fileDataUrl) ||
        (!text && !fileUrl && !imageDataUrl && !fileDataUrl)) {
      return errorResponse("Некорректные данные сообщения.");
    }

    const createdAt = Math.floor(Date.now() / 1000);
    const expiresIn = noSave
      ? 30
      : Number.isInteger(body.expires_in) && body.expires_in > 0
        ? Math.min(body.expires_in, 86400)
        : null;
    const expiresAt = expiresIn
      ? createdAt + expiresIn
      : null;
    const message = {
      id: typeof body.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(body.id)
        ? body.id
        : crypto.randomUUID(),
      sender_id: senderId,
      target_id: targetId || "ALL",
      text,
      file_url: fileUrl || null,
      file_name: fileName || null,
      image_data_url: imageDataUrl,
      image_size_kb: imageSizeKb,
      file_data_url: fileDataUrl,
      file_size_formatted: fileSizeFormatted,
      delete_scope: deleteScope,
      no_save: noSave ? 1 : 0,
      created_at: createdAt,
      expires_at: expiresAt,
    };

    await env.DB.prepare(
      `INSERT INTO chat_messages
       (id, sender_id, target_id, text, file_url, file_name,
        image_data_url, image_size_kb, file_data_url, file_size_formatted,
        delete_scope, no_save, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      message.id,
      message.sender_id,
      message.target_id,
      message.text,
      message.file_url,
      message.file_name,
      message.image_data_url,
      message.image_size_kb,
      message.file_data_url,
      message.file_size_formatted,
      message.delete_scope,
      message.no_save,
      message.created_at,
      message.expires_at,
    ).run();

    return jsonResponse({ message }, 201);
  }

  return errorResponse("Метод не поддерживается.", 405);
}

async function handleYagaChat(request, env) {
  if (request.method !== "POST") {
    return errorResponse("Метод не поддерживается.", 405);
  }
  if (typeof env.GEMINI_API_KEY !== "string" || !env.GEMINI_API_KEY.trim()) {
    return errorResponse("Сервис Gemini не настроен на сервере.", 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 50000) {
    return errorResponse("История чата слишком велика.", 413);
  }

  const body = await readJson(request);
  if (!body) return errorResponse("Ожидается JSON-объект.");
  if (!Array.isArray(body.history) ||
      body.history.length === 0 ||
      body.history.length > MAX_YAGA_HISTORY_MESSAGES) {
    return errorResponse("Передана некорректная история чата.");
  }

  let historyChars = 0;
  const history = [];
  for (const item of body.history) {
    if (!item || !["user", "model"].includes(item.role) || typeof item.text !== "string") {
      return errorResponse("В истории обнаружено некорректное сообщение.");
    }
    const text = item.text.trim();
    if (!text) continue;
    historyChars += text.length;
    if (historyChars > MAX_YAGA_HISTORY_CHARS) {
      return errorResponse("История чата превышает лимит 32000 символов.", 413);
    }
    history.push({ role: item.role, text });
  }

  while (history.length && history[0].role === "model") history.shift();
  const normalizedHistory = [];
  for (const item of history) {
    const previous = normalizedHistory[normalizedHistory.length - 1];
    if (previous && previous.role === item.role) {
      previous.text += `\n${item.text}`;
    } else {
      normalizedHistory.push({ role: item.role, text: item.text });
    }
  }
  if (!normalizedHistory.length ||
      normalizedHistory[normalizedHistory.length - 1].role !== "user") {
    return errorResponse("Последнее сообщение должно быть вопросом пользователя.");
  }

  const gender = body.gender === "woman" ? "женщина" : "мужчина";
  const systemPrompt =
    `Ты — Баба-Яга, мудрая хозяйка лесной избушки: сказочная, наблюдательная и чуть ироничная, но доброжелательная. Твой собеседник — ${gender}. ` +
    "Отвечай по-русски, живо и с лёгкой сказочной интонацией, не превращая каждый ответ в длинную сказку. " +
    "Сначала отвечай прямо на вопрос, затем добавляй полезные пояснения и практические шаги. " +
    "Не выдумывай факты; если не уверена или вопрос требует специалиста, скажи об этом честно.";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY.trim(),
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: normalizedHistory.map(item => ({
            role: item.role,
            parts: [{ text: item.text }],
          })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 900 },
        }),
        signal: controller.signal,
      },
    );
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Gemini returned a non-JSON response.");
      return errorResponse("Gemini вернул некорректный ответ.", 502);
    }

    if (!response.ok) {
      const detail = typeof result?.error?.message === "string"
        ? result.error.message
        : "";
      console.error(`Gemini API error (${response.status}):`, detail || "No details returned.");
      return errorResponse(
        response.status === 429
          ? "Gemini временно перегружен. Попробуйте ещё раз позже."
          : `Ошибка Gemini API${detail ? `: ${detail}` : ` (HTTP ${response.status})`}.`,
        response.status === 429 ? 503 : 502,
      );
    }

    const reply = result?.candidates?.[0]?.content?.parts
      ?.map(part => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();
    if (!reply) {
      return errorResponse("Gemini не вернул текстовый ответ.", 502);
    }
    return jsonResponse({ reply });
  } catch (error) {
    if (error?.name === "AbortError") {
      return errorResponse("Gemini не ответил за 20 секунд.", 504);
    }
    console.error("Yaga Gemini request failed:", error);
    return errorResponse("Не удалось связаться с Gemini.", 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleMedia(request, env) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const result = category
      ? await env.DB.prepare(
          `SELECT id, category, title, url, source, disabled, position, created_at
           FROM media_items WHERE category = ? ORDER BY position, created_at`,
        ).bind(category).all()
      : await env.DB.prepare(
          `SELECT id, category, title, url, source, disabled, position, created_at
           FROM media_items ORDER BY category, position, created_at`,
        ).all();

    return jsonResponse({ items: result.results });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const category = typeof body.category === "string" ? body.category.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const mediaUrl = typeof body.url === "string" ? body.url.trim() : "";
    const source = typeof body.source === "string" ? body.source.trim() : "server";
    const position = Number.isInteger(body.position) ? body.position : 0;
    if (!category || category.length > 100 || !title || title.length > 500 ||
        !mediaUrl || mediaUrl.length > 2048 || source.length > 50 ||
        Math.abs(position) > 1000000) {
      return errorResponse("Некорректные данные медиафайла.");
    }

    const item = {
      id: typeof body.id === "string" && body.id.trim()
        ? body.id.trim().slice(0, 100)
        : crypto.randomUUID(),
      category,
      title,
      url: mediaUrl,
      source,
      disabled: body.disabled === true ? 1 : 0,
      position,
      created_at: Math.floor(Date.now() / 1000),
    };

    await env.DB.prepare(
      `INSERT INTO media_items
       (id, category, title, url, source, disabled, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category = excluded.category,
         title = excluded.title,
         url = excluded.url,
         source = excluded.source,
         disabled = excluded.disabled,
         position = excluded.position`,
    ).bind(
      item.id,
      item.category,
      item.title,
      item.url,
      item.source,
      item.disabled,
      item.position,
      item.created_at,
    ).run();

    return jsonResponse({ item }, 201);
  }

  if (request.method === "PUT" || request.method === "PATCH") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 100) return errorResponse("Укажите id медиафайла.");

    const existing = await env.DB.prepare(
      "SELECT id, category, title, url, source, disabled, position, created_at FROM media_items WHERE id = ?",
    ).bind(id).first();
    if (!existing) return errorResponse("Медиафайл не найден.", 404);

    const category = typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : existing.category;
    const title = typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : existing.title;
    const mediaUrl = typeof body.url === "string" && body.url.trim()
      ? body.url.trim()
      : existing.url;
    const source = typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : existing.source;
    const disabled = typeof body.disabled === "boolean" ? (body.disabled ? 1 : 0) : existing.disabled;
    const position = Number.isInteger(body.position) ? body.position : existing.position;

    if (!category || category.length > 100 || !title || title.length > 500 ||
        !mediaUrl || mediaUrl.length > 2048 || source.length > 50 ||
        Math.abs(position) > 1000000) {
      return errorResponse("Некорректные данные медиафайла.");
    }

    await env.DB.prepare(
      `UPDATE media_items
       SET category = ?, title = ?, url = ?, source = ?, disabled = ?, position = ?
       WHERE id = ?`,
    ).bind(category, title, mediaUrl, source, disabled, position, id).run();

    return jsonResponse({
      item: {
        id,
        category,
        title,
        url: mediaUrl,
        source,
        disabled,
        position,
        created_at: existing.created_at,
      },
    });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    let id = url.searchParams.get("id");
    if (!id) {
      const body = await readJson(request);
      id = body && typeof body.id === "string" ? body.id.trim() : "";
    }
    if (!id || id.length > 100) return errorResponse("Укажите id медиафайла.");

    await env.DB.prepare("DELETE FROM media_items WHERE id = ?").bind(id).run();
    return jsonResponse({ status: "ok", id });
  }

  return errorResponse("Метод не поддерживается.", 405);
}

async function handleCoins(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const userId = url.searchParams.get("user_id");
    if (!userId || userId.length > 100) {
      return errorResponse("Укажите user_id.");
    }
    const user = await env.DB.prepare(
      "SELECT id, coins, updated_at FROM users WHERE id = ?",
    ).bind(userId).first();

    return jsonResponse({ user: user || { id: userId, coins: 800, updated_at: null } });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const coins = body.coins;
    if (!userId || userId.length > 100 || !Number.isSafeInteger(coins) ||
        coins < 0 || coins > 1000000000) {
      return errorResponse("Укажите user_id и целое число монет от 0 до 1000000000.");
    }

    const updatedAt = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO users (id, coins, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET coins = excluded.coins, updated_at = excluded.updated_at`,
    ).bind(userId, coins, updatedAt).run();

    return jsonResponse({ user: { id: userId, coins, updated_at: updatedAt } });
  }

  return errorResponse("Метод не поддерживается.", 405);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    try {
      if (pathname === "/api/chat") return await handleChat(request, env);
      if (pathname === "/api/yaga-chat") return await handleYagaChat(request, env);
      if (pathname === "/api/media") return await handleMedia(request, env);
      if (pathname === "/api/coins") return await handleCoins(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker request failed:", error);
      return errorResponse("Внутренняя ошибка сервера.", 500);
    }
  },
};
