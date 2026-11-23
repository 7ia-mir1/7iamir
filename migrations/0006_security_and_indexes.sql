CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
    ON chat_messages (created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_target
    ON chat_messages (sender_id, target_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions (expires_at);
