-- CampusBook database schema
-- Project: CampusBook, a lecturer consultation booking system for CTU Training Solutions
-- Group: SE2 Group 3
-- Database: MySQL 8 (also runs on MariaDB 10.6+)
-- Run with: mysql -u root -p < database/schema.sql

DROP DATABASE IF EXISTS campusbook;
CREATE DATABASE campusbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campusbook;

-- All people who log in. Students and lecturers share one table, told apart by role
CREATE TABLE users (
    user_id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('student', 'lecturer') NOT NULL,
    student_number  VARCHAR(20) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_student_number (student_number),
    CONSTRAINT chk_student_number CHECK (role = 'lecturer' OR student_number IS NOT NULL)
) ENGINE = InnoDB;

-- Extra details that only lecturers have (one to one with users)
CREATE TABLE lecturer_profiles (
    lecturer_id  INT UNSIGNED NOT NULL,
    department   VARCHAR(100) NOT NULL,
    office       VARCHAR(50) NULL,
    PRIMARY KEY (lecturer_id),
    CONSTRAINT fk_profile_user FOREIGN KEY (lecturer_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- Consultation times that a lecturer publishes
CREATE TABLE consultation_slots (
    slot_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    lecturer_id  INT UNSIGNED NOT NULL,
    slot_date    DATE NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    location     VARCHAR(100) NOT NULL,
    status       ENUM('open', 'booked', 'cancelled') NOT NULL DEFAULT 'open',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (slot_id),
    UNIQUE KEY uq_slot_lecturer_time (lecturer_id, slot_date, start_time),
    KEY idx_slot_date_status (slot_date, status),
    CONSTRAINT fk_slot_lecturer FOREIGN KEY (lecturer_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT chk_slot_times CHECK (end_time > start_time)
) ENGINE = InnoDB;

-- A student booking of one slot
-- active_slot_id is only filled while a booking is confirmed, so the unique key
-- stops two confirmed bookings on the same slot (no double-booking)
CREATE TABLE bookings (
    booking_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slot_id         INT UNSIGNED NOT NULL,
    student_id      INT UNSIGNED NOT NULL,
    reason          VARCHAR(255) NOT NULL,
    status          ENUM('confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'confirmed',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active_slot_id  INT UNSIGNED AS (IF(status = 'confirmed', slot_id, NULL)) STORED,
    PRIMARY KEY (booking_id),
    UNIQUE KEY uq_one_active_booking_per_slot (active_slot_id),
    KEY idx_booking_student (student_id),
    CONSTRAINT fk_booking_slot FOREIGN KEY (slot_id) REFERENCES consultation_slots (slot_id),
    CONSTRAINT fk_booking_student FOREIGN KEY (student_id) REFERENCES users (user_id)
) ENGINE = InnoDB;

-- Emails sent for a booking: confirmation, reminder or cancellation
CREATE TABLE notifications (
    notification_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id       INT UNSIGNED NOT NULL,
    type             ENUM('confirmation', 'reminder', 'cancellation') NOT NULL,
    send_at          DATETIME NOT NULL,
    sent_at          DATETIME NULL,
    status           ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
    PRIMARY KEY (notification_id),
    KEY idx_notification_due (status, send_at),
    CONSTRAINT fk_notification_booking FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE CASCADE
) ENGINE = InnoDB;
