ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

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
    ('1001', 'olvet9999@gmail.com', 'pbkdf2_sha256$100000$zRjwQS3vq05jzyIfk0gQJw==$kmHOWT1Pm7qfNAU2m1raCBlmL4MbJBrSl2nCIMZr7dw=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1002', 'king.kingparadise@gmail.com', 'pbkdf2_sha256$100000$lMq+8TCbTDP2f0hRpmKkCA==$QjpZBl9bIEBR38YGiERIUkd/eL4dySZ8I9TzuTk38ds=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1003', 'tataole@gmail.com', 'pbkdf2_sha256$100000$urD7Up6YG8XI5ZIj91sO2g==$eHN5QJyxqYuIksqpcoXDjRVNWI8CyEcsgeLc/JB1BmU=', 'admin', 800, CAST(strftime('%s', 'now') AS INTEGER));
