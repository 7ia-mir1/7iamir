CREATE TABLE IF NOT EXISTS online_presence (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_online_presence_last_seen
    ON online_presence (last_seen_at);
