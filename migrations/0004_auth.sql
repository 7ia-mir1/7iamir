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
    ('1001', 'olvet9999@gmail.com', 'pbkdf2_sha256$210000$LaxjowQ1KGPlDPyaj+CWqg==$W+Cycg07fYGVqITc+CMvC+L3t5Ky3MGBJXoRgbiYtGI=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1002', 'king.kingparadise@gmail.com', 'pbkdf2_sha256$210000$yWZZ9zAkeSFDF37oTka0oA==$smd2LZ7lIpdwV3UhuJY/RK9xPt2GqdCzYIm0qA5g1+w=', 'user', 800, CAST(strftime('%s', 'now') AS INTEGER)),
    ('1003', 'tataole@gmail.com', 'pbkdf2_sha256$210000$6SMep+FpV+hb/Jl1LPxUtg==$elbu/zMBuKXGnU0+Ww25kag+lZVLpZls4vIKOPT3lj0=', 'admin', 800, CAST(strftime('%s', 'now') AS INTEGER));
