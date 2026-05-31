-- Drop the duplicated phone column from user_profiles
-- User phone numbers should be retrieved via members table
ALTER TABLE user_profiles DROP COLUMN IF EXISTS phone;