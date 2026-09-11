-- Personal 1-on-1 chats (DMs) for myNest.
-- Load locally:  docker cp db/chat.pg.sql mynest-pg:/tmp/chat.pg.sql
--                 docker exec mynest-pg psql -U postgres -d mynest -f /tmp/chat.pg.sql
-- On Neon (prod): paste this file into the SQL Editor and Run.
--
-- A conversation is always stored with user_a_id < user_b_id so each pair
-- has exactly one thread (UNIQUE), no matter who messaged first.

CREATE TABLE conversations (
  id         SERIAL PRIMARY KEY,
  user_a_id  INT NOT NULL,
  user_b_id  INT NOT NULL,
  post_id    INT NULL,  -- which roommate post sparked it (context, optional)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_conversation UNIQUE (user_a_id, user_b_id),
  CONSTRAINT fk_conv_a FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_b FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_post FOREIGN KEY (post_id) REFERENCES roommate_posts(id) ON DELETE SET NULL
);

CREATE TABLE messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  body            VARCHAR(2000) NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)       REFERENCES users(id)        ON DELETE CASCADE
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, id);

CREATE TABLE password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL,
  otp_hash   VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
