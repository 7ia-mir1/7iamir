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
