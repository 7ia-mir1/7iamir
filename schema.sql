CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    target_id TEXT NOT NULL DEFAULT 'ALL',
    text TEXT NOT NULL DEFAULT '',
    file_url TEXT,
    file_name TEXT,
    image_data_url TEXT,
    image_size_kb INTEGER,
    file_data_url TEXT,
    file_size_formatted TEXT,
    delete_scope TEXT NOT NULL DEFAULT 'off',
    no_save INTEGER NOT NULL DEFAULT 0 CHECK (no_save IN (0, 1)),
    created_at INTEGER NOT NULL,
    expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
    ON chat_messages (created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_expires_at
    ON chat_messages (expires_at);

CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'server',
    disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_items_category_position
    ON media_items (category, position);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 800 CHECK (coins >= 0),
    updated_at INTEGER NOT NULL,
    email TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS password_reset_codes (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    requested_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires
    ON password_reset_codes (expires_at);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
    attempt_key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO users (id, email, password_hash, role, coins, updated_at) VALUES
    ('1001', 'olvet9999@gmail.com', 'pbkdf2_sha256$210000$LaxjowQ1KGPlDPyaj+CWqg==$W+Cycg07fYGVqITc+CMvC+L3t5Ky3MGBJXoRgbiYtGI=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1002', 'king.kingparadise@gmail.com', 'pbkdf2_sha256$210000$yWZZ9zAkeSFDF37oTka0oA==$smd2LZ7lIpdwV3UhuJY/RK9xPt2GqdCzYIm0qA5g1+w=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1003', 'tataole@gmail.com', 'pbkdf2_sha256$210000$6SMep+FpV+hb/Jl1LPxUtg==$elbu/zMBuKXGnU0+Ww25kag+lZVLpZls4vIKOPT3lj0=', 'admin', 800, CAST(strftime('%s', 'now') AS INTEGER));

CREATE TABLE IF NOT EXISTS site_content (
    category TEXT NOT NULL CHECK (category IN ('texts', 'labels', 'book')),
    content_key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    PRIMARY KEY (category, content_key)
);

CREATE TABLE IF NOT EXISTS site_images (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    file_data BLOB NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 262144),
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_content_category
    ON site_content (category);
