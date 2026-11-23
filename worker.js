const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
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

function rateLimitResponse(message, retryAfterSeconds) {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      ...JSON_HEADERS,
      "retry-after": String(retryAfterSeconds),
    },
  });
}

async function enforceCacheRateLimit(request, scope, identity, limit, windowSeconds, message) {
  if (typeof caches === "undefined" || !caches.default) {
    console.error("Cloudflare Cache API is unavailable for rate limiting.");
    return errorResponse("Защита от частых запросов временно недоступна.", 503);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSeconds);
    const retryAfterSeconds = Math.max(1, (bucket + 1) * windowSeconds - now);
    const identityHash = (await digestBase64(`${scope}\n${identity}`))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const cacheUrl = new URL(
      `/_worker-rate-limit/${scope}/${identityHash}/${bucket}`,
      request.url,
    );
    const cacheKey = new Request(cacheUrl, { method: "GET" });
    const cachedCount = await caches.default.match(cacheKey);
    const count = cachedCount ? Number(await cachedCount.text()) : 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error("Invalid cached rate-limit counter.");
    }
    if (count >= limit) {
      return rateLimitResponse(message, retryAfterSeconds);
    }

    await caches.default.put(cacheKey, new Response(String(count + 1), {
      headers: {
        "cache-control": `public, max-age=${retryAfterSeconds}`,
        "content-type": "text/plain; charset=utf-8",
      },
    }));
    return null;
  } catch (error) {
    console.error("Cloudflare Cache API rate limiting failed.", error);
    return errorResponse("Защита от частых запросов временно недоступна.", 503);
  }
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

const SESSION_COOKIE_NAME = "gornitsa_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const PRESENCE_TTL_SECONDS = 180;
const PASSWORD_HASH_ITERATIONS = 100000;
const RESET_CODE_TTL_SECONDS = 10 * 60;
const RESET_CODE_COOLDOWN_SECONDS = 60;
const SEEDED_ACCOUNTS = [
  {
    id: "1001",
    email: "olvet9999@gmail.com",
    role: "user",
    passwordHash: "pbkdf2_sha256$100000$zRjwQS3vq05jzyIfk0gQJw==$kmHOWT1Pm7qfNAU2m1raCBlmL4MbJBrSl2nCIMZr7dw=",
  },
  {
    id: "1002",
    email: "king.kingparadise@gmail.com",
    role: "user",
    passwordHash: "pbkdf2_sha256$100000$lMq+8TCbTDP2f0hRpmKkCA==$QjpZBl9bIEBR38YGiERIUkd/eL4dySZ8I9TzuTk38ds=",
  },
  {
    id: "1003",
    email: "tataole@gmail.com",
    role: "admin",
    passwordHash: "pbkdf2_sha256$100000$urD7Up6YG8XI5ZIj91sO2g==$eHN5QJyxqYuIksqpcoXDjRVNWI8CyEcsgeLc/JB1BmU=",
  },
];
const accountSeedPromises = new WeakMap();

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  try {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function derivePasswordHash(password, salt, iterations = PASSWORD_HASH_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function createPasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2_sha256$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64(salt)}$${hash}`;
}

async function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") return false;
  const [algorithm, iterationsText, saltText, expectedHash] = encodedHash.split("$");
  const iterations = Number(iterationsText);
  const salt = base64ToBytes(saltText || "");
  if (algorithm !== "pbkdf2_sha256" ||
      iterations !== PASSWORD_HASH_ITERATIONS ||
      !salt || !expectedHash) {
    return false;
  }
  const actualHash = await derivePasswordHash(password, salt, iterations);
  const actual = new TextEncoder().encode(actualHash);
  const expected = new TextEncoder().encode(expectedHash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

async function digestBase64(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(bytes));
}

async function ensureSeedAccounts(env) {
  let pending = accountSeedPromises.get(env);
  if (!pending) {
    pending = (async () => {
      const now = Math.floor(Date.now() / 1000);
      for (const account of SEEDED_ACCOUNTS) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO users
           (id, email, password_hash, role, coins, updated_at)
           VALUES (?, ?, ?, ?, 800, ?)`,
        ).bind(
          account.id,
          account.email,
          account.passwordHash,
          account.role,
          now,
        ).run();
      }
    })();
    accountSeedPromises.set(env, pending);
    pending.catch(() => accountSeedPromises.delete(env));
  }
  return pending;
}

function readSessionToken(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader.split(";").map(item => item.trim())
    .find(item => item.startsWith(`${SESSION_COOKIE_NAME}=`));
  return cookie ? cookie.slice(SESSION_COOKIE_NAME.length + 1) : "";
}

async function getAuthSession(request, env) {
  const token = readSessionToken(request);
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const sessionHash = await digestBase64(token);
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `SELECT users.id, users.email, users.role, auth_sessions.expires_at
     FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.session_hash = ? AND auth_sessions.expires_at > ?`,
  ).bind(sessionHash, now).first();
  if (!result) return null;
  return { id: result.id, email: result.email, role: result.role };
}

function sessionCookie(token, maxAge) {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function authJsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

function newSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function newRecoveryCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(value).padStart(6, "0");
}

async function sendRecoveryEmail(env, email, code) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "Код восстановления пароля",
      text: `Ваш код восстановления: ${code}. Он действует 10 минут.`,
    }),
  });
  return response.ok;
}

async function handleAuth(request, env, pathname) {
  if (pathname === "/api/auth/register") {
    return errorResponse("Регистрация не поддерживается.", 405);
  }
  await ensureSeedAccounts(env);

  if (pathname === "/api/auth/me") {
    if (request.method !== "GET") return errorResponse("Метод не поддерживается.", 405);
    const user = await getAuthSession(request, env);
    return user
      ? authJsonResponse({ user }, 200)
      : errorResponse("Требуется вход.", 401);
  }

  if (request.method !== "POST") return errorResponse("Метод не поддерживается.", 405);
  if (!isSameOriginRequest(request)) return errorResponse("Запрос с другого источника запрещён.", 403);
  const body = await readJson(request);
  if (!body) return errorResponse("Ожидается JSON-объект.");

  if (pathname === "/api/auth/login") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !password || password.length > 128) {
      return errorResponse("Проверьте адрес электронной почты и пароль.");
    }

    try {
      const user = await env.DB.prepare(
        "SELECT id, email, password_hash, role FROM users WHERE email = ?",
      ).bind(email).first();
      const hashToCheck = user ? user.password_hash : SEEDED_ACCOUNTS[0].passwordHash;
      const valid = await verifyPassword(password, hashToCheck);
      if (!user || !valid) {
        return errorResponse("Неверный адрес электронной почты или пароль.", 401);
      }

      const token = newSessionToken();
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now).run();
      await env.DB.prepare(
        "INSERT INTO auth_sessions (session_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      ).bind(
        await digestBase64(token),
        user.id,
        now + SESSION_TTL_SECONDS,
        now,
      ).run();

      return authJsonResponse(
        { user: { id: user.id, email: user.email, role: user.role } },
        200,
        { "set-cookie": sessionCookie(token, SESSION_TTL_SECONDS) },
      );
    } catch (error) {
      console.error("Ошибка обработки входа.", error);
      return errorResponse("Внутренняя ошибка сервера.", 500);
    }
  }

  if (pathname === "/api/auth/logout") {
    const token = readSessionToken(request);
    if (token) {
      await env.DB.prepare("DELETE FROM auth_sessions WHERE session_hash = ?")
        .bind(await digestBase64(token)).run();
    }
    return authJsonResponse(
      { status: "ok" },
      200,
      { "set-cookie": sessionCookie("", 0) },
    );
  }

  if (pathname === "/api/auth/forgot-password") {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      return errorResponse("Восстановление временно недоступно: настройте почтовый сервис.", 503);
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return errorResponse("Введите корректный адрес электронной почты.");
    }
    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    ).bind(email).first();
    if (!user) {
      return authJsonResponse(
        { message: "Если адрес зарегистрирован, код восстановления будет отправлен." },
        202,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const previous = await env.DB.prepare(
      "SELECT requested_at FROM password_reset_codes WHERE user_id = ?",
    ).bind(user.id).first();
    if (previous && previous.requested_at > now - RESET_CODE_COOLDOWN_SECONDS) {
      return authJsonResponse(
        { message: "Если адрес зарегистрирован, код восстановления будет отправлен." },
        202,
      );
    }

    const code = newRecoveryCode();
    await env.DB.prepare(
      `INSERT INTO password_reset_codes (user_id, code_hash, expires_at, requested_at, attempts)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         requested_at = excluded.requested_at,
         attempts = 0`,
    ).bind(
      user.id,
      await createPasswordHash(code),
      now + RESET_CODE_TTL_SECONDS,
      now,
    ).run();
    try {
      if (!await sendRecoveryEmail(env, email, code)) {
        throw new Error("Почтовый сервис отклонил запрос.");
      }
    } catch (error) {
      await env.DB.prepare("DELETE FROM password_reset_codes WHERE user_id = ?")
        .bind(user.id).run();
      console.error("Не удалось отправить письмо восстановления.", error);
      return errorResponse("Не удалось отправить письмо. Проверьте настройки почты.", 502);
    }
    return authJsonResponse(
      { message: "Если адрес зарегистрирован, код восстановления будет отправлен." },
      202,
    );
  }

  if (pathname === "/api/auth/reset-password") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code) ||
        password.length < 8 || password.length > 128) {
      return errorResponse("Укажите почту, шестизначный код и новый пароль (не менее 8 символов).");
    }
    const user = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    ).bind(email).first();
    if (!user) return errorResponse("Код недействителен или срок его действия истёк.", 400);
    const reset = await env.DB.prepare(
      "SELECT code_hash, expires_at, attempts FROM password_reset_codes WHERE user_id = ?",
    ).bind(user.id).first();
    const now = Math.floor(Date.now() / 1000);
    if (!reset || reset.expires_at <= now || reset.attempts >= 5) {
      return errorResponse("Код недействителен или срок его действия истёк.", 400);
    }
    await env.DB.prepare(
      "UPDATE password_reset_codes SET attempts = attempts + 1 WHERE user_id = ?",
    ).bind(user.id).run();
    if (!await verifyPassword(code, reset.code_hash)) {
      return errorResponse("Код недействителен или срок его действия истёк.", 400);
    }

    const consumed = await env.DB.prepare(
      "DELETE FROM password_reset_codes WHERE user_id = ? AND code_hash = ? AND expires_at > ?",
    ).bind(user.id, reset.code_hash, now).run();
    if (!consumed.meta.changes) {
      return errorResponse("Код недействителен или срок его действия истёк.", 400);
    }
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(await createPasswordHash(password), now, user.id),
      env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(user.id),
    ]);
    return authJsonResponse({ status: "ok", message: "Пароль обновлён. Теперь войдите с новым паролем." }, 200);
  }

  return errorResponse("Маршрут авторизации не найден.", 404);
}

const MAX_YAGA_HISTORY_MESSAGES = 36;
const MAX_YAGA_HISTORY_CHARS = 32000;
const MAX_CHAT_IMAGE_BYTES = 350 * 1024;
const D1_FREE_STORAGE_LIMIT_BYTES = 500_000_000;
const D1_STORAGE_WARNING_BYTES = 400_000_000;
const CHAT_DUMP_PAGE_SIZE = 250;

async function handlePresence(request, env, session) {
  if (request.method !== "GET" && request.method !== "POST") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const now = Math.floor(Date.now() / 1000);
  if (request.method === "POST") {
    await env.DB.prepare(
      `INSERT INTO online_presence (user_id, last_seen_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    ).bind(session.id, now).run();
  }

  const result = await env.DB.prepare(
    `SELECT users.id AS id, users.role AS role
     FROM users
     LEFT JOIN online_presence AS presence ON presence.user_id = users.id
     WHERE users.id <> ?
       AND (
         presence.last_seen_at >= ?
         OR EXISTS (
           SELECT 1 FROM auth_sessions
           WHERE auth_sessions.user_id = users.id
             AND auth_sessions.expires_at > ?
         )
       )
     ORDER BY users.id`,
  ).bind(session.id, now - PRESENCE_TTL_SECONDS, now).all();

  const users = result.results.map(user => ({
    id: user.id,
    role: user.role,
    online: true,
  }));

  return jsonResponse({
    users,
    online_count: users.length + 1,
  });
}

function isSafeChatFileUrl(value, baseUrl) {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value, baseUrl);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseChatDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  try {
    return { mimeType: match[1].toLowerCase(), byteLength: atob(match[2]).length };
  } catch {
    return null;
  }
}

async function handleChat(request, env, session) {
  if (request.method === "GET") {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "DELETE FROM chat_messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
    ).bind(now).run();

    const url = new URL(request.url);
    const userId = session.id;
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
    const messages = result.results.slice(0, limit).reverse().map(message => ({
      ...message,
      file_url: isSafeChatFileUrl(message.file_url, request.url) ? message.file_url : null,
    }));
    return jsonResponse({ messages, has_more: hasMore });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const message = await env.DB.prepare(
        "SELECT sender_id, target_id FROM chat_messages WHERE id = ?",
      ).bind(id).first();
      if (message && message.sender_id !== session.id && message.target_id !== session.id) {
        return errorResponse("Нельзя удалить сообщение другого пользователя.", 403);
      }
      await env.DB.prepare("DELETE FROM chat_messages WHERE id = ?").bind(id).run();
    } else {
      const userId = session.id;
      await env.DB.prepare(
        "DELETE FROM chat_messages WHERE sender_id = ? OR target_id = ?",
      ).bind(userId, userId).run();
    }
    return jsonResponse({ status: "ok" });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const senderId = session.id;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const targetId = typeof body.target_id === "string" ? body.target_id.trim() : "ALL";
    const fileUrl = typeof body.file_url === "string" ? body.file_url.trim() : null;
    const fileName = typeof body.file_name === "string" ? body.file_name.trim() : null;
    const imageDataUrl = typeof body.image_data_url === "string" ? body.image_data_url : null;
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
    const payloadBytes = new TextEncoder().encode(
      `${text}${imageDataUrl || ""}${fileDataUrl || ""}${fileName || ""}${fileSizeFormatted || ""}`,
    ).byteLength;

    if (payloadBytes > 1800000) {
      return errorResponse("Вложение превышает лимит хранения в D1.", 413);
    }
    if (fileUrl && !isSafeChatFileUrl(fileUrl, request.url)) {
      return errorResponse("Ссылка на вложение должна использовать HTTP или HTTPS.");
    }

    const imageInfo = imageDataUrl ? parseChatDataUrl(imageDataUrl) : null;
    const fileInfo = fileDataUrl ? parseChatDataUrl(fileDataUrl) : null;
    const allowedImageTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    const allowedFileTypes = /^(?:image\/(?:jpeg|png|webp|gif|avif)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/(?:pdf|octet-stream|zip)|text\/plain)$/;
    const imageDataValid = imageDataUrl === null ||
      Boolean(imageInfo && allowedImageTypes.has(imageInfo.mimeType));
    const fileDataValid = fileDataUrl === null ||
      Boolean(fileInfo && allowedFileTypes.test(fileInfo.mimeType));
    if ((imageInfo && imageInfo.byteLength > MAX_CHAT_IMAGE_BYTES) ||
        (fileInfo && fileInfo.mimeType.startsWith("image/") &&
          fileInfo.byteLength > MAX_CHAT_IMAGE_BYTES)) {
      return errorResponse("Изображение превышает серверный лимит 350 КБ.", 413);
    }
    const imageSizeKb = imageInfo ? Math.ceil(imageInfo.byteLength / 1024) : null;

    if (!/^\d{1,10}$/.test(senderId) ||
        !(targetId === "ALL" || /^\d{1,10}$/.test(targetId)) ||
        text.length > 10000 || (fileUrl && fileUrl.length > 2048) ||
        (fileName && fileName.length > 255) ||
        (fileSizeFormatted && fileSizeFormatted.length > 50) ||
        !imageDataValid || !fileDataValid ||
        (!text && !fileUrl && !imageDataUrl && !fileDataUrl)) {
      return errorResponse("Некорректные данные сообщения.");
    }

    if (targetId !== "ALL") {
      if (targetId === senderId) {
        return errorResponse("Нельзя отправить личное сообщение самому себе.");
      }
      const recipient = await env.DB.prepare(
        "SELECT id FROM users WHERE id = ?",
      ).bind(targetId).first();
      if (!recipient) return errorResponse("Аккаунт собеседника не найден.", 404);
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

async function handleCoins(request, env, session) {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const requestedId = url.searchParams.get("user_id");
    const userId = session.role === "admin" && requestedId ? requestedId : session.id;
    const user = await env.DB.prepare(
      "SELECT id, coins, updated_at FROM users WHERE id = ?",
    ).bind(userId).first();

    return jsonResponse({ user: user || { id: userId, coins: 800, updated_at: null } });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const requestedUserId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (requestedUserId && requestedUserId !== session.id) {
      return errorResponse("Нельзя менять баланс другого пользователя.", 403);
    }
    const userId = session.id;
    const coins = body.coins;
    if (!userId || userId.length > 100 || !Number.isSafeInteger(coins) ||
        coins < 0 || coins > 1000000000) {
      return errorResponse("Укажите целое число монет от 0 до 1000000000.");
    }

    const updatedAt = Math.floor(Date.now() / 1000);
    const update = await env.DB.prepare(
      "UPDATE users SET coins = ?, updated_at = ? WHERE id = ?",
    ).bind(coins, updatedAt, userId).run();
    if (!update.meta || !update.meta.changes) {
      return errorResponse("Пользователь не найден.", 404);
    }

    return jsonResponse({ user: { id: userId, coins, updated_at: updatedAt } });
  }

  return errorResponse("Метод не поддерживается.", 405);
}

async function readAssetJson(env, request, pathname) {
  const assetUrl = new URL(pathname, request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl));
  if (!response.ok) {
    throw new Error(`Unable to load static resource: ${pathname}`);
  }
  return response.json();
}

async function handleContent(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  if (category && !["texts", "labels", "book"].includes(category)) {
    return errorResponse("Неизвестная категория контента.");
  }

  if (category === "book") {
    const book = await readAssetJson(env, request, "/content/book.json");
    const overrides = await env.DB.prepare(
      "SELECT content_key, value, is_deleted FROM site_content WHERE category = 'book'",
    ).all();
    const pages = Array.isArray(book.pages) ? book.pages : [];
    let toc = Array.isArray(book.toc) ? book.toc : [];

    for (const override of overrides.results) {
      if (override.is_deleted) {
        if (override.content_key === "toc") {
          toc = [];
          continue;
        }
        const deletedPage = /^page:(\d{1,4})$/.exec(override.content_key);
        if (deletedPage) {
          const index = pages.findIndex(page => page.p === Number(deletedPage[1]));
          if (index >= 0) pages.splice(index, 1);
        }
        continue;
      }
      if (override.content_key === "toc") {
        toc = JSON.parse(override.value);
        continue;
      }
      const pageMatch = /^page:(\d{1,4})$/.exec(override.content_key);
      if (!pageMatch) continue;
      const page = JSON.parse(override.value);
      const pageIndex = pages.findIndex(item => item.p === page.p);
      if (pageIndex < 0) pages.push(page);
      else pages[pageIndex] = page;
    }
    const availablePages = new Set(pages.map(page => page.p));
    toc = toc.filter(item => availablePages.has(item.p));

    return jsonResponse({ book: { pages, toc } });
  }

  const [defaultTexts, defaultLabels, overrides] = await Promise.all([
    readAssetJson(env, request, "/content/texts.json"),
    readAssetJson(env, request, "/content/labels.json"),
    env.DB.prepare(
      "SELECT category, content_key, value, is_deleted FROM site_content WHERE category IN ('texts', 'labels')",
    ).all(),
  ]);
  const texts = { ...defaultTexts };
  const labels = { ...defaultLabels };
  for (const item of overrides.results) {
    const target = item.category === "texts" ? texts : labels;
    if (item.is_deleted) delete target[item.content_key];
    else target[item.content_key] = item.value;
  }

  return jsonResponse({ texts, labels });
}

async function handleAdminContent(request, env) {
  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const category = typeof body.category === "string" ? body.category : "";
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const value = typeof body.value === "string" ? body.value : null;
    if (!["texts", "labels", "book"].includes(category) ||
        !key || key.length > 200 || value === null || value.length > 900000) {
      return errorResponse("Некорректная запись контента.");
    }
    if (category === "book") {
      if (key === "toc") {
        let toc;
        try {
          toc = JSON.parse(value);
        } catch {
          return errorResponse("Оглавление должно быть корректным JSON.");
        }
        if (!Array.isArray(toc) || toc.length > 1000 ||
            toc.some(item => !item || !Number.isInteger(item.p) ||
              typeof item.t !== "string" || item.t.length > 500)) {
          return errorResponse("Некорректное оглавление книги.");
        }
      } else {
        const pageMatch = /^page:(\d{1,4})$/.exec(key);
        if (!pageMatch) return errorResponse("Некорректный ключ страницы книги.");
        let page;
        try {
          page = JSON.parse(value);
        } catch {
          return errorResponse("Страница книги должна быть корректным JSON.");
        }
        if (!page || page.p !== Number(pageMatch[1]) ||
            typeof page.t !== "string" || page.t.length > 500 ||
            typeof page.h !== "string") {
          return errorResponse("Некорректная страница книги.");
        }
      }
    }

    const updatedAt = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO site_content (category, content_key, value, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(category, content_key) DO UPDATE SET
         value = excluded.value, updated_at = excluded.updated_at, is_deleted = 0`,
    ).bind(category, key, value, updatedAt).run();
    return jsonResponse({ status: "ok", category, key, updated_at: updatedAt });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const key = url.searchParams.get("key") || "";
    if (!["texts", "labels", "book"].includes(category) || !key || key.length > 200) {
      return errorResponse("Укажите категорию и ключ записи.");
    }
    await env.DB.prepare(
      `INSERT INTO site_content (category, content_key, value, updated_at, is_deleted)
       VALUES (?, ?, '', ?, 1)
       ON CONFLICT(category, content_key) DO UPDATE SET
         value = '', updated_at = excluded.updated_at, is_deleted = 1`,
    ).bind(category, key, Math.floor(Date.now() / 1000)).run();
    return jsonResponse({ status: "ok", category, key });
  }

  return errorResponse("Метод не поддерживается.", 405);
}

function quoteSqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export a non-finite SQL number.");
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof ArrayBuffer) {
    return `X'${Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("")}'`;
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `X'${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}'`;
  }
  if (value === undefined) throw new Error("Cannot export an undefined SQL value.");
  throw new Error(`Unsupported SQL export value type: ${typeof value}`);
}

async function* createSqlDump(env, tables) {
  yield "-- 7iamir Cloudflare D1 backup\n";
  yield "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n";

  for (const table of tables) {
    const tableName = String(table.name);
    if (typeof table.sql !== "string") continue;
    const createSql = table.sql.replace(
      /^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i,
      "CREATE TABLE IF NOT EXISTS ",
    );
    if (!/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i.test(createSql)) {
      throw new Error(`Unsupported table definition for ${tableName}.`);
    }

    yield `\n${createSql};\n`;
    const pragmaResult = await env.DB.prepare(
      `PRAGMA table_info(${quoteSqlIdentifier(tableName)})`,
    ).all();
    const columns = pragmaResult.results.map(column => String(column.name));
    if (!columns.length) throw new Error(`No columns found for ${tableName}.`);

    const columnList = columns.map(quoteSqlIdentifier).join(", ");
    const query = `SELECT * FROM ${quoteSqlIdentifier(tableName)} LIMIT ? OFFSET ?`;
    let offset = 0;
    while (true) {
      const page = await env.DB.prepare(query)
        .bind(CHAT_DUMP_PAGE_SIZE, offset)
        .all();
      const rows = page.results || [];
      if (!rows.length) break;

      const insertLines = rows.map(row => {
        const values = columns.map(column => sqlLiteral(row[column])).join(", ");
        return `INSERT INTO ${quoteSqlIdentifier(tableName)} (${columnList}) VALUES (${values});`;
      });
      yield `${insertLines.join("\n")}\n`;
      offset += rows.length;
      if (rows.length < CHAT_DUMP_PAGE_SIZE) break;
    }
  }

  const indexes = await env.DB.prepare(
    `SELECT sql FROM sqlite_master
     WHERE type = 'index' AND sql IS NOT NULL
       AND substr(name, 1, 7) <> 'sqlite_'
       AND substr(name, 1, 4) <> '_cf_'
     ORDER BY name`,
  ).all();
  for (const index of indexes.results) {
    const indexSql = index.sql.replace(
      /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/i,
      (_, unique = "") => `CREATE ${unique}INDEX IF NOT EXISTS `,
    );
    yield `${indexSql};\n`;
  }

  yield "COMMIT;\nPRAGMA foreign_keys=ON;\n";
}

async function handleAdminDatabaseExport(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const result = await env.DB.prepare(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'table'
       AND substr(name, 1, 7) <> 'sqlite_'
       AND substr(name, 1, 4) <> '_cf_'
     ORDER BY name`,
  ).all();
  const tables = result.results || [];
  const encoder = new TextEncoder();
  const iterator = createSqlDump(env, tables)[Symbol.asyncIterator]();
  const body = new ReadableStream({
    async pull(controller) {
      try {
        const chunk = await iterator.next();
        if (chunk.done) controller.close();
        else controller.enqueue(encoder.encode(chunk.value));
      } catch (error) {
        console.error("Не удалось сформировать SQL-резервную копию D1.", error);
        controller.error(error);
      }
    },
    async cancel() {
      if (typeof iterator.return === "function") await iterator.return();
    },
  });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/sql; charset=utf-8",
      "content-disposition": `attachment; filename="7iamir-db-backup-${date}.sql"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function handleAdminFilesExport(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const headers = {
    "User-Agent": "Cloudflare-Worker",
    "Accept": "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  let archiveResponse;
  try {
    archiveResponse = await fetch(
      "https://api.github.com/repos/7ia-mir1/7iamir/zipball/main",
      { headers },
    );
  } catch (error) {
    console.error("Не удалось запросить архив сайта у GitHub.", error);
    return errorResponse("Не удалось связаться с GitHub для получения архива.", 502);
  }

  const upstreamContentType = archiveResponse.headers.get("content-type") || "";
  if (!archiveResponse.ok ||
      !/application\/(?:zip|octet-stream|x-zip-compressed)/i.test(upstreamContentType) ||
      !archiveResponse.body) {
    console.error(
      "GitHub не вернул ZIP-архив сайта.",
      archiveResponse.status,
      upstreamContentType,
    );
    return errorResponse("GitHub не смог предоставить ZIP-архив сайта.", 502);
  }

  return new Response(archiveResponse.body, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="7iamir-site-files.zip"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function normalizeSql(sql) {
  return sql.toLowerCase()
    .replace(/\bif\s+not\s+exists\b/g, "")
    .replace(/[`"\[\]\s]/g, "");
}

async function estimateDatabaseSizeFromTables(env, tableNames) {
  let totalBytes = 0;
  for (const tableName of tableNames) {
    const tableInfo = await env.DB.prepare(
      `PRAGMA table_info(${quoteSqlIdentifier(tableName)})`,
    ).all();
    const columns = (tableInfo.results || []).map(column => String(column.name));
    if (!columns.length) continue;

    const sizeExpression = columns.map(column =>
      `COALESCE(LENGTH(CAST(${quoteSqlIdentifier(column)} AS BLOB)), 0)`,
    ).join(" + ");
    const result = await env.DB.prepare(
      `SELECT COALESCE(SUM(${sizeExpression}), 0) AS size
       FROM ${quoteSqlIdentifier(tableName)}`,
    ).first();
    const tableBytes = Number(result && result.size);
    if (!Number.isSafeInteger(tableBytes) || tableBytes < 0) {
      throw new Error(`Invalid estimated size for table ${tableName}.`);
    }
    totalBytes += tableBytes;
    if (!Number.isSafeInteger(totalBytes)) {
      throw new Error("Estimated D1 size exceeds the safe integer range.");
    }
  }
  return totalBytes;
}

async function handleAdminSystemHealth(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const tableResult = await env.DB.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND substr(name, 1, 7) <> 'sqlite_'
       AND substr(name, 1, 4) <> '_cf_'`,
  ).all();
  const tableNames = new Set((tableResult.results || []).map(table => table.name));
  const rowCounts = {};
  for (const name of ["users", "auth_sessions", "chat_messages", "media_items"]) {
    if (!tableNames.has(name)) {
      rowCounts[name] = 0;
      continue;
    }
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM ${quoteSqlIdentifier(name)}`,
    ).first();
    rowCounts[name] = Number(countResult && countResult.count) || 0;
  }

  let databaseSizeBytes = null;
  let databaseSizeMethod = null;
  let databaseSizeError = null;
  try {
    const dbstatRow = await env.DB.prepare(
      "SELECT SUM(pgsize) AS size FROM dbstat;",
    ).first();
    const dbstatSize = Number(dbstatRow && dbstatRow.size);
    if (!dbstatRow || dbstatRow.size === null ||
        !Number.isSafeInteger(dbstatSize) || dbstatSize < 0) {
      throw new Error("D1 dbstat returned invalid size metrics.");
    }
    databaseSizeBytes = dbstatSize;
    databaseSizeMethod = "dbstat";
  } catch (dbstatError) {
    console.warn("D1 dbstat недоступен; оценивается объём данных таблиц.", dbstatError);
    try {
      databaseSizeBytes = await estimateDatabaseSizeFromTables(env, tableNames);
      databaseSizeMethod = "table-data-estimate";
    } catch (fallbackError) {
      console.error("Не удалось оценить размер D1 по данным таблиц.", fallbackError);
      databaseSizeError = "Недоступны dbstat и оценка объёма данных таблиц.";
    }
  }

  const indexResult = await env.DB.prepare(
    `SELECT name, sql FROM sqlite_master
     WHERE type = 'index'
       AND name IN (?, ?, ?)`,
  ).bind(
    "idx_chat_messages_created_at",
    "idx_chat_messages_sender_target",
    "idx_auth_sessions_expires_at",
  ).all();
  const indexes = new Map((indexResult.results || [])
    .map(index => [index.name, normalizeSql(index.sql || "")]));
  const indexStatus = {
    chatCreatedAt: indexes.get("idx_chat_messages_created_at") ===
      "createindexidx_chat_messages_created_atonchat_messages(created_at)",
    chatSenderTarget: indexes.get("idx_chat_messages_sender_target") ===
      "createindexidx_chat_messages_sender_targetonchat_messages(sender_id,target_id)",
    authSessionsExpires: indexes.get("idx_auth_sessions_expires_at") ===
      "createindexidx_auth_sessions_expires_atauth_sessions(expires_at)",
  };
  const usagePercent = databaseSizeBytes === null
    ? null
    : Math.min(100, (databaseSizeBytes / D1_FREE_STORAGE_LIMIT_BYTES) * 100);
  const cacheApiAvailable = typeof caches !== "undefined" && Boolean(caches.default);

  return jsonResponse({
    database: "Cloudflare D1 (SQLite)",
    storage: {
      sizeBytes: databaseSizeBytes,
      sizeKb: databaseSizeBytes === null ? null : databaseSizeBytes / 1024,
      sizeMb: databaseSizeBytes === null ? null : databaseSizeBytes / 1_000_000,
      method: databaseSizeMethod,
      estimated: databaseSizeMethod === "table-data-estimate",
      freeLimitBytes: D1_FREE_STORAGE_LIMIT_BYTES,
      warningLimitBytes: D1_STORAGE_WARNING_BYTES,
      remainingBytes: databaseSizeBytes === null
        ? null
        : Math.max(0, D1_FREE_STORAGE_LIMIT_BYTES - databaseSizeBytes),
      usagePercent,
      warning: databaseSizeBytes !== null &&
        databaseSizeBytes >= D1_STORAGE_WARNING_BYTES,
      error: databaseSizeError,
    },
    tableCount: tableNames.size,
    rowCounts,
    dailyLimits: {
      d1RowReads: 5_000_000,
      d1RowWrites: 100_000,
      workerRequests: 100_000,
      usageAvailableFromWorker: false,
    },
    security: {
      indexes: indexStatus,
      chatImageMaxBytes: MAX_CHAT_IMAGE_BYTES,
      siteImageMaxBytes: 262144,
      loginAttemptsPerWindow: 10,
      aiRateLimitConfigured: cacheApiAvailable,
      loginWindowSeconds: 300,
      cacheRateLimits: {
        enabled: cacheApiAvailable,
        auth: { maxAttempts: 10, windowSeconds: 300 },
        ai: { maxMessages: 20, windowSeconds: 600 },
        chat: { maxMessagesPerIp: 30, maxMessagesPerUser: 30, windowSeconds: 60 },
      },
    },
  });
}

function decodeImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  let binary;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }
  if (binary.length === 0 || binary.length > 262144) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { mimeType: match[1], bytes };
}

async function handleImages(request, env) {
  if (request.method !== "GET") {
    return errorResponse("Метод не поддерживается.", 405);
  }

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  if (name) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)) {
      return errorResponse("Некорректное имя изображения.");
    }

    const image = await env.DB.prepare(
      "SELECT mime_type, file_data FROM site_images WHERE name = ?",
    ).bind(name).first();
    if (image) {
      return new Response(image.file_data, {
        headers: {
          "content-type": image.mime_type,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    const assetUrl = new URL(`/images/${name}`, url.origin);
    const asset = await env.ASSETS.fetch(new Request(assetUrl));
    if (!asset.ok) return errorResponse("Изображение не найдено.", 404);

    const headers = new Headers(asset.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(asset.body, { status: asset.status, headers });
  }

  const [manifest, uploaded] = await Promise.all([
    readAssetJson(env, request, "/images/manifest.json"),
    env.DB.prepare(
      "SELECT id, name, mime_type, size_bytes, created_at FROM site_images ORDER BY name",
    ).all(),
  ]);
  return jsonResponse({
    items: [
      ...(Array.isArray(manifest) ? manifest : []),
      ...uploaded.results.map(item => ({
        id: item.id,
        name: item.name,
        path: `/api/images?name=${encodeURIComponent(item.name)}`,
        source: "uploaded",
        mimeType: item.mime_type,
        sizeBytes: item.size_bytes,
        deletable: true,
        createdAt: item.created_at,
      })),
    ],
  });
}

async function handleAdminImages(request, env) {
  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse("Ожидается JSON-объект.");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const dataUrl = typeof body.data_url === "string" ? body.data_url : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(name)) {
      return errorResponse("Имя файла содержит недопустимые символы.");
    }
    const image = decodeImageDataUrl(dataUrl);
    if (!image) {
      return errorResponse("Изображение должно быть JPG, PNG, WebP, GIF или AVIF и не превышать 256 КБ.", 413);
    }

    const id = crypto.randomUUID();
    const createdAt = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO site_images (id, name, mime_type, file_data, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         id = excluded.id, mime_type = excluded.mime_type,
         file_data = excluded.file_data, size_bytes = excluded.size_bytes,
         created_at = excluded.created_at`,
    ).bind(id, name, image.mimeType, image.bytes, image.bytes.byteLength, createdAt).run();
    return jsonResponse({
      item: {
        id,
        name,
        path: `/api/images?name=${encodeURIComponent(name)}`,
        source: "uploaded",
        mimeType: image.mimeType,
        sizeBytes: image.bytes.byteLength,
        deletable: true,
        createdAt,
      },
    }, 201);
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (!id || id.length > 100) return errorResponse("Укажите id загруженного изображения.");
    const result = await env.DB.prepare("DELETE FROM site_images WHERE id = ?").bind(id).run();
    if (!result.meta.changes) return errorResponse("Загруженное изображение не найдено.", 404);
    return jsonResponse({ status: "ok", id });
  }

  return errorResponse("Метод не поддерживается.", 405);
}

async function handleWorkerRequest(request, env) {
    const requestUrl = new URL(request.url);
    const { pathname } = requestUrl;

    try {
      if (pathname.startsWith("/api/") &&
          request.method !== "GET" &&
          !isSameOriginRequest(request)) {
        return errorResponse("Запрос с другого источника запрещён.", 403);
      }

      if (pathname.startsWith("/api/auth/")) {
        if (request.method === "POST" &&
            ["/api/auth/login", "/api/auth/register"].includes(pathname)) {
          const limited = await enforceCacheRateLimit(
            request,
            "auth",
            request.headers.get("CF-Connecting-IP") || "unknown",
            10,
            300,
            "Слишком много попыток входа, подождите 5 минут",
          );
          if (limited) return limited;
        }
        return await handleAuth(request, env, pathname);
      }

      const isApiRequest = pathname.startsWith("/api/");
      const isChatRoute = pathname === "/api/chat" || pathname.startsWith("/api/chat/");
      const isAiRoute = pathname === "/api/yaga-chat" ||
        pathname === "/api/ai" ||
        pathname.startsWith("/api/ai/");
      if (request.method === "POST" && isAiRoute) {
        const limited = await enforceCacheRateLimit(
          request,
          "ai",
          request.headers.get("CF-Connecting-IP") || "unknown",
          20,
          600,
          "Слишком много сообщений в AI-чате. Подождите 10 минут.",
        );
        if (limited) return limited;
      }
      if (request.method === "POST" && isChatRoute) {
        const limited = await enforceCacheRateLimit(
          request,
          "chat-ip",
          request.headers.get("CF-Connecting-IP") || "unknown",
          30,
          60,
          "Слишком много сообщений в чате. Подождите минуту.",
        );
        if (limited) return limited;
      }
      const isHtmlPage =
        pathname === "/" ||
        (/\.html?$/i.test(pathname) && pathname !== "/login.html");
      const isProtectedResource =
        isHtmlPage ||
        (pathname.startsWith("/content/") && pathname.endsWith(".json")) ||
        pathname.startsWith("/images/");
      let session = null;
      if (isApiRequest || isProtectedResource) {
        session = await getAuthSession(request, env);
        if (!session) {
          if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
            return errorResponse("Требуются права администратора.", 403);
          }
          if (isHtmlPage) {
            const loginUrl = new URL("/login.html", request.url);
            loginUrl.searchParams.set("next", `${pathname}${requestUrl.search}`);
            return Response.redirect(loginUrl, 302);
          }
          return errorResponse("Требуется вход.", 401);
        }
      }

      if (request.method === "POST" && isChatRoute) {
        const limited = await enforceCacheRateLimit(
          request,
          "chat-user",
          session.id,
          30,
          60,
          "Слишком много сообщений в чате. Подождите минуту.",
        );
        if (limited) return limited;
      }

      const adminOnly =
        pathname === "/api/admin" ||
        pathname.startsWith("/api/admin/") ||
        (pathname === "/api/media" && request.method !== "GET") ||
        (pathname === "/api/coins" && request.method !== "GET") ||
        pathname === "/admin.html";
      if (adminOnly && session.role !== "admin") {
        if (pathname === "/admin.html") {
          return Response.redirect(new URL("/index.html", request.url), 302);
        }
        return errorResponse("Требуются права администратора.", 403);
      }
      if (pathname === "/api/admin/export-db") {
        return await handleAdminDatabaseExport(request, env);
      }
      if (pathname === "/api/admin/export-files") {
        return await handleAdminFilesExport(request, env);
      }
      if (pathname === "/api/admin/system-health") {
        return await handleAdminSystemHealth(request, env);
      }
      if (pathname === "/api/presence") return await handlePresence(request, env, session);
      if (pathname === "/api/chat") return await handleChat(request, env, session);
      if (pathname === "/api/yaga-chat") return await handleYagaChat(request, env);
      if (pathname === "/api/media") return await handleMedia(request, env);
      if (pathname === "/api/coins") return await handleCoins(request, env, session);
      if (pathname === "/api/content") return await handleContent(request, env);
      if (pathname === "/api/admin/content") return await handleAdminContent(request, env);
      if (pathname === "/api/images") return await handleImages(request, env);
      if (pathname === "/api/admin/images") return await handleAdminImages(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Worker request failed:", error);
      return errorResponse("Внутренняя ошибка сервера.", 500);
    }
}

export default {
  async fetch(request, env) {
    return withSecurityHeaders(await handleWorkerRequest(request, env));
  },
};
