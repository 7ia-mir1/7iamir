ALTER TABLE chat_messages ADD COLUMN image_data_url TEXT;
ALTER TABLE chat_messages ADD COLUMN image_size_kb INTEGER;
ALTER TABLE chat_messages ADD COLUMN file_data_url TEXT;
ALTER TABLE chat_messages ADD COLUMN file_size_formatted TEXT;
ALTER TABLE chat_messages ADD COLUMN delete_scope TEXT NOT NULL DEFAULT 'off';
ALTER TABLE chat_messages ADD COLUMN no_save INTEGER NOT NULL DEFAULT 0 CHECK (no_save IN (0, 1));
