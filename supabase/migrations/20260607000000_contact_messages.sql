-- ============================================
-- Contact Messages Table
-- Stores submissions from the contact form
-- ============================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  sector text,
  service text,
  message text NOT NULL,
  read boolean DEFAULT false,
  source text DEFAULT 'website',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.contact_messages IS 'Contact form submissions';

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Only service_role / admin can read contact messages
CREATE POLICY "Service role can read contact messages"
  ON public.contact_messages FOR SELECT
  USING (false); -- Block direct access; admin API uses service_role

-- Anyone can insert (for the contact form)
CREATE POLICY "Anyone can submit contact message"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);
