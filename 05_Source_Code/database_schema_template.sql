-- CAPSTONE PROJECT DATABASE SCHEMA TEMPLATE
-- Project:
-- Group:
-- Date:

CREATE DATABASE CapstoneProjectDB;
GO
USE CapstoneProjectDB;
GO

-- Example only. Replace with your approved entities.
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(120) NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO
