-- mock_media_broadcasts.sql
DO $$ 
DECLARE
  aid uuid := '4833e9ed-0ff9-4b25-96a9-0d8528a2356f';
  video_att_id uuid;
  doc_att_id uuid;
  audio_att_id uuid;
BEGIN

  -- 1. Insert Video Attachment
  INSERT INTO public.communication_attachments 
    (assembly_id, storage_tier, storage_provider, storage_bucket, storage_path, mime_type, file_size_bytes, media_category)
  VALUES 
    (aid, 'hot', 'supabase', 'campaigns-media-private', 'video/sunday_service.mp4', 'video/mp4', '50000000', 'video')
  RETURNING id INTO video_att_id;

  -- 2. Insert Document Attachment
  INSERT INTO public.communication_attachments 
    (assembly_id, storage_tier, storage_provider, storage_bucket, storage_path, mime_type, file_size_bytes, media_category)
  VALUES 
    (aid, 'hot', 'supabase', 'campaigns-media-private', 'docs/outreach.pdf', 'application/pdf', '3500000', 'document')
  RETURNING id INTO doc_att_id;

  -- 3. Insert Audio Attachment
  INSERT INTO public.communication_attachments 
    (assembly_id, storage_tier, storage_provider, storage_bucket, storage_path, mime_type, file_size_bytes, media_category)
  VALUES 
    (aid, 'hot', 'supabase', 'campaigns-media-private', 'audio/prayer_circle.mp3', 'audio/mp3', '12500000', 'audio')
  RETURNING id INTO audio_att_id;

  -- 4. Insert Video Campaign
  INSERT INTO public.communication_campaigns
    (assembly_id, attachment_id, title, channel, audience_type, status, total_recipients)
  VALUES
    (aid, video_att_id, 'Sunday Service: Finding Peace in Chaos', 'video', 'assembly', 'sent', 1248);

  -- 5. Insert Document Campaign
  INSERT INTO public.communication_campaigns
    (assembly_id, attachment_id, title, channel, audience_type, status, total_recipients, body)
  VALUES
    (aid, doc_att_id, 'Monthly Community Outreach Journal', 'document', 'assembly', 'sent', 342, 'A 12-page PDF covering local missions, financial transparency reports, and upcoming volunteer opportunities for the holiday season.');

  -- 6. Insert Audio Campaign
  INSERT INTO public.communication_campaigns
    (assembly_id, attachment_id, title, channel, audience_type, status, total_recipients, body)
  VALUES
    (aid, audio_att_id, 'Weekly Prayer Circle Audio', 'audio', 'group', 'sent', 156, 'Short audio meditation and prayer points for this week''s leadership gathering.');

  -- 7. Insert Text Campaign
  INSERT INTO public.communication_campaigns
    (assembly_id, title, channel, audience_type, status, total_recipients, body)
  VALUES
    (aid, 'Fall Retreat Update', 'sms', 'group', 'sent', 212, 'Hey everyone! Quick reminder about the packing list for this weekend''s retreat. Don''t forget your warm layers and a journal. See you Friday at 4 PM at the North Gate!');

END $$;
