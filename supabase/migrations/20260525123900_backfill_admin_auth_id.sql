-- =============================================================================
-- CACI Hub — Migration 20260525123848
-- Purpose:  Phase 1.2 - Backfill admin auth_user_id
-- =============================================================================

UPDATE public.members
SET auth_user_id = 'deed0df7-d6de-404a-853d-0428c4196c9a'
WHERE id = '8cf54258-0050-423d-b9a3-7f344ead04df';
