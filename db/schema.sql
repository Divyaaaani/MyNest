CREATE DATABASE IF NOT EXISTS fairnest;
USE fairnest;

-- Drop in reverse FK order so re-runs stay clean (dev only)
DROP TABLE IF EXISTS notifications, rent_requests, group_join_requests, roommate_post_comments, roommate_posts, pg_facilities, facilities, roommate_applicants, roommate_requests, photos, payments, pgs, monthly_cycles, memberships, `groups`, users, colleges;

-- Users: everyone who signs up. `role` splits the app in two:
--   'student' = a tenant who rents a PG / joins a group
--   'owner'   = a PG owner who runs the building + collects rent
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','owner') NOT NULL DEFAULT 'student',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Groups: a shared living unit (a flat, a PG room, a trip)
CREATE TABLE `groups` (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  owner_id   INT NOT NULL,            -- who runs the group & approves join requests
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_group_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Memberships: one row = one user in one group, with their fixed monthly due
CREATE TABLE memberships (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  group_id    INT NOT NULL,
  monthly_due DECIMAL(10,2) NOT NULL,
  phone       VARCHAR(20),                -- tenant's contact number (owner dashboard)
  rent_due_day TINYINT NOT NULL DEFAULT 1,-- day of month rent is due (e.g. 29th)
  bill_due_day TINYINT NOT NULL DEFAULT 1,-- day of month bill is due (e.g. 25th)
  UNIQUE KEY uq_membership (group_id, user_id),
  CONSTRAINT fk_membership_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_membership_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);

-- MonthlyCycles: one row per group per month, so dues are grouped by month
CREATE TABLE monthly_cycles (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  month    TINYINT NOT NULL,  -- 1-12
  year     SMALLINT NOT NULL,
  UNIQUE KEY uq_cycle (group_id, month, year),
  CONSTRAINT fk_cycle_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);

-- Payments: a record that a member paid for a specific month's cycle.
-- `type` = 'rent' (room rent) or 'bill' (electricity / maintenance), so the
-- owner dashboard can show "rent paid?" and "bill paid?" separately.
CREATE TABLE payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cycle_id      INT NOT NULL,
  membership_id INT NOT NULL,
  type          ENUM('rent','bill') NOT NULL DEFAULT 'rent',
  amount        DECIMAL(10,2) NOT NULL,
  paid_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment (cycle_id, membership_id, type),  -- one payment per member per month per type
  CONSTRAINT fk_payment_cycle      FOREIGN KEY (cycle_id)      REFERENCES monthly_cycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_membership FOREIGN KEY (membership_id) REFERENCES memberships(id)   ON DELETE CASCADE
);

-- PGs: the accommodation listings (the "find PG near college" feature)
CREATE TABLE pgs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NOT NULL,
  city            VARCHAR(100) NOT NULL,
  college_nearby  VARCHAR(150),
  college_id      INT,                -- FK to colleges (for reliable search matching)
  monthly_rent    DECIMAL(10,2) NOT NULL,
  gender          ENUM('any','male','female') NOT NULL DEFAULT 'any',  -- who can stay here
  capacity        INT,
  bhk             INT,                    -- e.g. 2 for a "2 BHK" listing
  area_sqft       INT,                    -- property area in square feet
  furnished       TINYINT(1) NOT NULL DEFAULT 0,  -- 1 = furnished, 0 = not
  description     TEXT,                   -- owner-written description
  latitude        DECIMAL(10,7),  -- 7 decimal places = ~1cm accuracy
  longitude       DECIMAL(10,7),
  owner_id        INT NOT NULL,
  group_id        INT NULL,       -- optional link to a group using this PG
  UNIQUE KEY uq_pg_group (group_id),
  KEY idx_pgs_college (college_id),
  CONSTRAINT fk_pg_owner FOREIGN KEY (owner_id) REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_pg_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL
);

-- Photos: separate table because MySQL has no native array/list type
CREATE TABLE photos (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  pg_id INT NOT NULL,
  url   VARCHAR(500) NOT NULL,
  CONSTRAINT fk_photo_pg FOREIGN KEY (pg_id) REFERENCES pgs(id) ON DELETE CASCADE
);

-- Facilities: every amenity that can exist (AC, WiFi, fridge...)
CREATE TABLE facilities (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- pg_facilities: MANY-TO-MANY join table (a PG has many facilities, a facility is in many PGs)
CREATE TABLE pg_facilities (
  pg_id       INT NOT NULL,
  facility_id INT NOT NULL,
  PRIMARY KEY (pg_id, facility_id),
  CONSTRAINT fk_pgf_pg       FOREIGN KEY (pg_id)       REFERENCES pgs(id)       ON DELETE CASCADE,
  CONSTRAINT fk_pgf_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- Colleges: name -> coordinates. This is what users search by.
CREATE TABLE colleges (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(150) NOT NULL,
  city      VARCHAR(100) NOT NULL,
  latitude  DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  UNIQUE KEY uq_college (name, city)
);

-- FK added separately because `colleges` is created after `pgs` above.
ALTER TABLE pgs ADD CONSTRAINT fk_pg_college
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;

-- Roommate requests: a student living here says "I need a roommate".
CREATE TABLE roommate_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  pg_id      INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(255) NOT NULL,
  slots      INT NOT NULL DEFAULT 1,   -- how many roommates they need
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rr_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)  ON DELETE CASCADE,
  CONSTRAINT fk_rr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Roommate applicants: another student asks to join that request.
-- ENUM is a MySQL type (Postgres handles this differently - a lesson for later!).
CREATE TABLE roommate_applicants (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(255),
  status     ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_applicant (request_id, user_id),  -- can't apply twice
  CONSTRAINT fk_ra_request FOREIGN KEY (request_id) REFERENCES roommate_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
);

-- Community: Brainly-style "find the perfect roommate" posts.
-- Separate from roommate_requests (those are tied to a specific PG);
-- these are personals people post from anywhere.
CREATE TABLE roommate_posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    TEXT NOT NULL,
  city       VARCHAR(100) NOT NULL,
  budget_max DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments on community posts (1-to-many: one post, many comments).
-- This is the classic relation you'll be asked about in interviews.
CREATE TABLE roommate_post_comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  post_id    INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rpc_post FOREIGN KEY (post_id) REFERENCES roommate_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_rpc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Join requests: a student asks to join a group; the owner accepts/rejects.
-- "pending" -> owner decides -> "accepted" (creates a membership) or "rejected".
CREATE TABLE group_join_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  group_id   INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500),
  status     ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_join_request (group_id, user_id),  -- one request per user per group
  CONSTRAINT fk_gjr_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_gjr_user  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE
);

-- Rent requests: a student applies to rent a PG without a roommate.
-- The PG owner accepts -> that PG gets a group (if it has none) + a membership.
CREATE TABLE rent_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  pg_id      INT NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500),
  status     ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rent_request (pg_id, user_id),  -- one rent request per user per PG
  CONSTRAINT fk_rentreq_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)  ON DELETE CASCADE,
  CONSTRAINT fk_rentreq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications: everything a user should be told about.
-- Rows are inserted when things happen (request accepted, payment received),
-- and "rent due in 5 days" reminders are computed on the fly from memberships.
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  type       ENUM('info','rent','bill','request') NOT NULL DEFAULT 'info',
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
