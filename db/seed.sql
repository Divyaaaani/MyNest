USE fairnest;

-- 3 users. Ananya (owner of both groups + all PGs) has a real hash so you can log
-- in as the OWNER and approve join/rent requests: ananya@example.com / ananya123
-- Rohan has a real hash too, so you can log in as a STUDENT:
-- rohan@example.com / rohan123. Divyani keeps the dummy hash.
INSERT INTO users (id, name, email, phone, password_hash, role) VALUES
  (1, 'Ananya Sharma', 'ananya@example.com', '9876500011', '$2b$10$kS4esCNj8hP2n0p4Ejn5rONB055XVKpDuXuho16zYcqsTLSXR5MeS', 'owner'),
  (2, 'Rohan Patel',  'rohan@example.com',  '9876500022', '$2b$10$vXpEE4IkQ0.aEgVS9LTWFuvW4i164FpyAK0Nf1FcfxAlKeXN9zamm', 'student'),
  (3, 'Divyani Singh', 'divyani@example.com', '9876500033', 'dummy-hash', 'student');

-- 2 groups: a PG group and a trip group (owner_id = who approves join requests)
INSERT INTO `groups` (id, name, owner_id) VALUES
  (1, 'Green Residency PG', 1),
  (2, 'Goa Trip 2026', 1);

-- memberships: who lives in which group + their fixed monthly due.
-- rent_due_day 29 = "rent due on the 29th of every month" (owner dashboard shows this).
INSERT INTO memberships (id, user_id, group_id, monthly_due, phone, rent_due_day, bill_due_day) VALUES
  (1, 1, 1, 6500.00, '9876500011', 29, 25),
  (2, 2, 1, 6500.00, '9876500022', 29, 25),
  (3, 3, 1, 6500.00, '9876500033', 29, 25),
  (4, 1, 2, 2500.00, '9876500011', 5, 1),
  (5, 3, 2, 2500.00, '9876500033', 5, 1);

-- monthly cycles: one per group per month
INSERT INTO monthly_cycles (id, group_id, month, year) VALUES
  (1, 1, 7, 2026),   -- July 2026
  (2, 1, 8, 2026),   -- August 2026 (current month)
  (3, 2, 8, 2026);

-- payments: Ananya and Rohan paid Aug rent. Divyani hasn't -> she OWES.
-- July: everyone paid. (type defaults to 'rent')
INSERT INTO payments (id, cycle_id, membership_id, amount) VALUES
  (1, 1, 1, 6500.00),
  (2, 1, 2, 6500.00),
  (3, 1, 3, 6500.00),
  (4, 2, 1, 6500.00),
  (5, 2, 2, 6500.00);

-- 5 PGs around COEP Pune (18.5295, 73.8569). Varying lat/lng = varying distance.
INSERT INTO pgs (id, name, address, city, college_nearby, monthly_rent, capacity, latitude, longitude, owner_id, group_id) VALUES
  (1, 'Green Residency',   '12 Shivaji Nagar, Near COEP',      'Pune', 'COEP',      6500.00, 4, 18.5295000, 73.8569000, 1, 1),
  (2, 'Sunrise PG',        '45 FC Road',                       'Pune', 'COEP',      7200.00, 3, 18.5312000, 73.8530000, 1, NULL),
  (3, 'City Boys Hostel',  '8 Jangli Maharaj Rd',              'Pune', 'COEP',      5800.00, 6, 18.5260000, 73.8582000, 1, NULL),
  (4, 'Comfort Stay',      '201 Shirole Road',                 'Pune', 'COEP',      6900.00, 2, 18.5275000, 73.8495000, 1, NULL),
  (5, 'Dream Home PG',     '3 Sadashiv Peth',                  'Pune', 'Fergusson College', 6100.00, 5, 18.5190000, 73.8410000, 1, NULL);

-- colleges: the searchable names. Users type these, we find coords.
INSERT INTO colleges (id, name, city, latitude, longitude) VALUES
  (1, 'YCCE Nagpur (Yeshwantrao Chavan College of Engineering)', 'Nagpur', 21.1195000, 79.0458000),
  (2, 'VNIT Nagpur',                 'Nagpur', 21.1274000, 79.0503000),
  (3, 'COEP Pune',                   'Pune',   18.5295000, 73.8569000),
  (4, 'Fergusson College Pune',      'Pune',   18.5225000, 73.8436000),
  (5, 'IIT Bombay',                  'Mumbai', 19.1334000, 72.9133000),
  (6, 'VJTI Mumbai',                 'Mumbai', 19.0222000, 72.8562000);

-- PGs near YCCE Nagpur (added so a Nagpur search returns results)
INSERT INTO pgs (id, name, address, city, college_nearby, monthly_rent, capacity, latitude, longitude, owner_id, group_id) VALUES
  (6, 'Sai Residency Nagpur', '15 Laxmi Nagar, Near YCCE', 'Nagpur', 'YCCE Nagpur',  5500.00, 3, 21.1205000, 79.0442000, 1, NULL),
  (7, 'Green Nest Hostel',    '200 Manish Nagar',          'Nagpur', 'YCCE Nagpur',  4800.00, 4, 21.1178000, 79.0475000, 1, NULL),
  (8, 'City PG Nagpur',       '7 Rameshwari',              'Nagpur', 'YCCE Nagpur',  5200.00, 2, 21.1219000, 79.0415000, 1, NULL),
  (9, 'Student Villa',        '42 Shankar Nagar',          'Nagpur', 'YCCE Nagpur',  6000.00, 5, 21.1250000, 79.0490000, 1, NULL);

-- roommate requests: someone at these PGs needs a roommate
INSERT INTO roommate_requests (id, pg_id, user_id, message, slots) VALUES
  (1, 1, 1, '2BHK at Green Residency, need one more flatmate', 1),
  (2, 1, 2, 'Looking for a quiet roommate, same floor',        1),
  (3, 6, 3, 'Need 2 roommates for Sai Residency',              2);

-- one applicant: Divyani applied to request #1
INSERT INTO roommate_applicants (id, request_id, user_id, message, status) VALUES
  (1, 1, 3, 'Hi, I am interested! Final year CS student.', 'pending');

-- join request: Rohan (only in Green Residency) asks to join the Goa group.
-- Owner = Ananya, so log in as ananya@example.com / ananya123 to approve it.
INSERT INTO group_join_requests (id, group_id, user_id, message, status) VALUES
  (1, 2, 2, 'Hi! Want to join for the Goa trip, can pay my share.', 'pending');

-- photos for every PG (realistic room/apartment photos from Unsplash)
INSERT INTO photos (id, pg_id, url) VALUES
  (1, 1, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=70'),
  (2, 1, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=70'),
  (3, 2, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=70'),
  (4, 3, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=70'),
  (5, 4, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=70'),
  (6, 5, 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=800&q=70'),
  (7, 6, 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=800&q=70'),
  (8, 7, 'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?auto=format&fit=crop&w=800&q=70'),
  (9, 8, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=70'),
  (10, 9, 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=70');

-- facilities: the catalog of every amenity we track
INSERT INTO facilities (id, name) VALUES
  (1, 'AC'),
  (2, 'WiFi'),
  (3, 'Study Table'),
  (4, 'Fridge'),
  (5, 'Attached Bathroom'),
  (6, 'Geyser'),
  (7, 'Meals'),
  (8, 'Laundry'),
  (9, 'Parking'),
  (10, 'Housekeeping'),
  (11, 'TV'),
  (12, 'Kitchen'),
  (13, 'Mess'),
  (14, 'Washing Machine'),
  (15, 'Bills Included'),
  (16, 'Time Restriction'),
  (17, 'Cleaning (Biweekly)');

-- pg_facilities: which PG has which facility (many-to-many)
INSERT INTO pg_facilities (pg_id, facility_id) VALUES
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
  (2, 2), (2, 3), (2, 6), (2, 7),
  (3, 2), (3, 7), (3, 8), (3, 10),
  (4, 1), (4, 2), (4, 4), (4, 5), (4, 12),
  (5, 2), (5, 3), (5, 6), (5, 9),
  (6, 1), (6, 2), (6, 3), (6, 4),
  (7, 2), (7, 7), (7, 10),
  (8, 3), (8, 6), (8, 11),
  (9, 1), (9, 2), (9, 3), (9, 8), (9, 12);

-- community posts: Brainly-style personals where people find their perfect roommate
INSERT INTO roommate_posts (id, user_id, title, message, city, budget_max) VALUES
  (1, 3, 'Female roommate wanted near COEP Pune',
   'As a first-year student new to the city, I am looking for a female roommate who keeps the place clean and also agrees to keep my cat with me. Clean, safe and exactly as shown in the photos.',
   'Pune', 7000.00),
  (2, 2, 'Software engineer shifting to Pune (Hinjewadi)',
   'I am a software engineer joining a company in Hinjewadi next month. Looking for a professional roommate working in the same area who wants to split a flat. Prefer someone who is tidy and respects quiet hours.',
   'Pune', 9000.00),
  (3, 1, 'Final-year student looking for a calm roommate',
   'Need a roommate near YCCE Nagpur. I study late, so looking for someone calm and non-noisy. Budget friendly, shared kitchen.',
   'Nagpur', 5000.00);

-- comments on those posts (one-to-many)
INSERT INTO roommate_post_comments (id, post_id, user_id, message) VALUES
  (1, 1, 1, 'Hi! I am a female student at COEP and would love to join. I am clean and love cats.'),
  (2, 2, 3, 'I am also joining a company in Hinjewadi. Can we connect?'),
  (3, 1, 2, 'Is the cat friendly with guests? Would love to visit and see the place.');

-- rent requests: Rohan (only in Green Residency) applies to rent Sunrise PG.
-- Owner = Ananya, so log in as ananya@example.com / ananya123 to approve it.
INSERT INTO rent_requests (id, pg_id, user_id, message, status) VALUES
  (1, 2, 2, 'Hi! Single room wanted at Sunrise PG from next month, no roommate needed.', 'pending');

-- notifications: seeded examples so the bell has content on first login
INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES
  (1, 2, 'Rent request sent', 'Your rent request for Sunrise PG is pending owner approval.', 'request', 0),
  (2, 1, 'New rent request', 'Rohan Patel wants to rent a room at Sunrise PG.', 'request', 0);
