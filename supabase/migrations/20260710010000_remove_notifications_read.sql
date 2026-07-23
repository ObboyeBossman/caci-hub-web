-- =============================================================================
-- Migration: remove_notifications_read
-- Removes the 'notifications.read' permission from system_permissions.
-- This permission was redundant as all members read their own notifications
-- by default. Dropping it prevents it from cluttering the UI and grants.
-- =============================================================================

-- Ensure no existing member_permissions are referencing this key before dropping
DELETE FROM public.member_permissions WHERE permission = 'notifications.read';

-- Remove the permission from the system registry
DELETE FROM public.system_permissions WHERE key = 'notifications.read';
