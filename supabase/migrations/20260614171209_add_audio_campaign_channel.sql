-- Add 'audio' as a valid channel for communication_campaigns
-- The audio broadcast tab uses channel='audio' but it was missing from the CHECK constraint.

ALTER TABLE public.communication_campaigns
  DROP CONSTRAINT communication_campaigns_channel_check;

ALTER TABLE public.communication_campaigns
  ADD CONSTRAINT communication_campaigns_channel_check
  CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp', 'push', 'audio'));
