-- Migration: Remove current_day column from user_challenges table
-- Date: 2025-10-22
-- Reason: currentDay is now calculated dynamically from activatedAt using calculateChallengeDay()
--         No need to maintain this column in the database

-- Remove current_day column
ALTER TABLE user_challenges DROP COLUMN IF EXISTS current_day;

-- Log migration
-- This column was replaced with runtime calculation based on activated_at
