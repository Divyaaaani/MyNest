-- myNest schema for PostgreSQL 16.
-- Load with:  docker cp schema.pg.sql mynest-pg:/tmp/schema.pg.sql
--             docker exec mynest-pg psql -U postgres -d mynest -f /tmp/schema.pg.sql
--
-- MySQL -> Postgres notes (kept as comments so the mapping stays obvious):
--   INT AUTO_INCREMENT -> SERIAL
--   ENUM('a','b')      -> TEXT + CHECK
--   TINYINT(1)         -> BOOLEAN
--   TINYINT/SMALLINT   -> SMALLINT
--   DATETIME           -> TIMESTAMP
--   `groups`           -> "groups" (GROUP is reserved)

DROP TABLE IF EXISTS
  notifications, rent_requests, group_join_requests,
  roommate_post_comments, roommate_posts,
  pg_facilities, facilities, roommate_applicants, roommate_requests,
  photos, payments, pgs, monthly_cycles, memberships, "groups",
  users, colleges
CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'owner')),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "groups" (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  owner_id   INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_group_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE memberships (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL,
  group_id     INT NOT NULL,
  monthly_due  NUMERIC(10,2) NOT NULL,
  phone        VARCHAR(20),
  rent_due_day SMALLINT NOT NULL DEFAULT 1,
  bill_due_day SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT uq_membership UNIQUE (group_id, user_id),
  CONSTRAINT fk_membership_user  FOREIGN KEY (user_id)  REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_membership_group FOREIGN KEY (group_id) REFERENCES "groups"(id)   ON DELETE CASCADE
);

CREATE TABLE monthly_cycles (
  id       SERIAL PRIMARY KEY,
  group_id INT NOT NULL,
  month    SMALLINT NOT NULL,
  year     SMALLINT NOT NULL,
  CONSTRAINT uq_cycle UNIQUE (group_id, month, year),
  CONSTRAINT fk_cycle_group FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id            SERIAL PRIMARY KEY,
  cycle_id      INT NOT NULL,
  membership_id INT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'rent'
                CHECK (type IN ('rent', 'bill')),
  amount        NUMERIC(10,2) NOT NULL,
  paid_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_payment UNIQUE (cycle_id, membership_id, type),
  CONSTRAINT fk_payment_cycle      FOREIGN KEY (cycle_id)      REFERENCES monthly_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_membership FOREIGN KEY (membership_id) REFERENCES memberships(id)     ON DELETE CASCADE
);

CREATE TABLE pgs (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  address        VARCHAR(255) NOT NULL,
  city           VARCHAR(100) NOT NULL,
  college_nearby VARCHAR(150),
  college_id     INT,
  monthly_rent   NUMERIC(10,2) NOT NULL,
  gender         TEXT NOT NULL DEFAULT 'any'
                 CHECK (gender IN ('any', 'male', 'female')),
  capacity       INT,
  bhk            INT,
  area_sqft      INT,
  furnished      BOOLEAN NOT NULL DEFAULT false,
  description    TEXT,
  latitude       NUMERIC(10,7),
  longitude      NUMERIC(10,7),
  owner_id       INT NOT NULL,
  group_id       INT NULL,
  CONSTRAINT uq_pg_group UNIQUE (group_id),
  CONSTRAINT fk_pg_owner FOREIGN KEY (owner_id) REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_pg_group FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE SET NULL
);
CREATE INDEX idx_pgs_college ON pgs(college_id);

CREATE TABLE photos (
  id    SERIAL PRIMARY KEY,
  pg_id INT NOT NULL,
  url   VARCHAR(500) NOT NULL,
  CONSTRAINT fk_photo_pg FOREIGN KEY (pg_id) REFERENCES pgs(id) ON DELETE CASCADE
);

CREATE TABLE facilities (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE pg_facilities (
  pg_id       INT NOT NULL,
  facility_id INT NOT NULL,
  PRIMARY KEY (pg_id, facility_id),
  CONSTRAINT fk_pgf_pg       FOREIGN KEY (pg_id)       REFERENCES pgs(id)        ON DELETE CASCADE,
  CONSTRAINT fk_pgf_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

CREATE TABLE colleges (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(150) NOT NULL,
  city      VARCHAR(100) NOT NULL,
  latitude  NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  CONSTRAINT uq_college UNIQUE (name, city)
);

ALTER TABLE pgs ADD CONSTRAINT fk_pg_college
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;

CREATE TABLE roommate_requests (
  id         SERIAL PRIMARY KEY,
  pg_id      INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(255) NOT NULL,
  slots      INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rr_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)   ON DELETE CASCADE,
  CONSTRAINT fk_rr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE roommate_applicants (
  id         SERIAL PRIMARY KEY,
  request_id INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(255),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_applicant UNIQUE (request_id, user_id),
  CONSTRAINT fk_ra_request FOREIGN KEY (request_id) REFERENCES roommate_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_user    FOREIGN KEY (user_id)    REFERENCES users(id)            ON DELETE CASCADE
);

CREATE TABLE roommate_posts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    TEXT NOT NULL,
  city       VARCHAR(100) NOT NULL,
  budget_max NUMERIC(10,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE roommate_post_comments (
  id         SERIAL PRIMARY KEY,
  post_id    INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rpc_post FOREIGN KEY (post_id) REFERENCES roommate_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rpc_user FOREIGN KEY (user_id) REFERENCES users(id)          ON DELETE CASCADE
);

CREATE TABLE group_join_requests (
  id         SERIAL PRIMARY KEY,
  group_id   INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_join_request UNIQUE (group_id, user_id),
  CONSTRAINT fk_gjr_group FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE,
  CONSTRAINT fk_gjr_user  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE CASCADE
);

CREATE TABLE rent_requests (
  id         SERIAL PRIMARY KEY,
  pg_id      INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_rent_request UNIQUE (pg_id, user_id),
  CONSTRAINT fk_rentreq_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)   ON DELETE CASCADE,
  CONSTRAINT fk_rentreq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info'
             CHECK (type IN ('info', 'rent', 'bill', 'request')),
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
