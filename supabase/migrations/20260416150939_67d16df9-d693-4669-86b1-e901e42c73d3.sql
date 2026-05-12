
-- Add image_url to messages for image sharing
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add typing tracking columns to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user1_typing_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user2_typing_at TIMESTAMP WITH TIME ZONE;

-- Chat images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-images', 'chat-images', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Chat images publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'chat-images');
CREATE POLICY "Users can upload chat images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
