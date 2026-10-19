-- CampusBook test data
-- Every demo account uses the password: CampusBook123
-- Emails use a test domain, so no real inbox is ever contacted
USE campusbook;

INSERT INTO users (user_id, full_name, email, password_hash, role, student_number) VALUES
 (1, 'Jabulile Mashibini',     'jabulile.mashibini@campusbook.test', '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'lecturer', NULL),
 (2, 'Lusukama Selemani',      'lusukama.selemani@campusbook.test',  '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'lecturer', NULL),
 (3, 'Willem Gerber',          'willem.gerber@campusbook.test',      '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'student', 'TEST0001'),
 (4, 'Oscar Khumalo',          'oscar.khumalo@campusbook.test',      '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'student', 'TEST0002'),
 (5, 'Thomas du Plessis',      'thomas.duplessis@campusbook.test',   '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'student', 'TEST0003'),
 (6, 'Lebohang Tlaitlai',      'lebohang.tlaitlai@campusbook.test',  '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'student', 'TEST0004'),
 (7, 'Gerhardus van den Berg', 'gerhardus.vandenberg@campusbook.test', '$2a$10$Y3N9Uet6JPTW94eaiShE0OS6wgEbzlrk69TM71iQnUget2onsKsMW', 'student', 'TEST0005');

INSERT INTO lecturer_profiles (lecturer_id, department, office) VALUES
 (1, 'Software Engineering', 'Room B12'),
 (2, 'Information Technology', 'Room B14');

INSERT INTO consultation_slots (lecturer_id, slot_date, start_time, end_time, location) VALUES
 (1, CURDATE() + INTERVAL 1 DAY, '09:00', '09:30', 'Room B12'),
 (1, CURDATE() + INTERVAL 1 DAY, '09:30', '10:00', 'Room B12'),
 (1, CURDATE() + INTERVAL 2 DAY, '14:00', '14:30', 'Teams'),
 (2, CURDATE() + INTERVAL 1 DAY, '11:00', '11:30', 'Room B14'),
 (2, CURDATE() + INTERVAL 3 DAY, '10:00', '10:30', 'Room B14');
