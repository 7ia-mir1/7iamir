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
    updated_at INTEGER NOT NULL
);

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
