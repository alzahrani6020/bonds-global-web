-- Admin Support Center
-- Tickets, assignments, SLA, escalations, notes, mentions and error/request linkage.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  advisory_client_id uuid REFERENCES public.advisory_clients(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent','critical')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'admin',
  request_id text,
  error_code text,
  related_url text,
  sla_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla ON public.support_tickets(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_request_id ON public.support_tickets(request_id);

CREATE TABLE IF NOT EXISTS public.support_ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  is_internal boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_notes_ticket
  ON public.support_ticket_notes(ticket_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_ticket_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.support_ticket_notes(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, note_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_support_mentions_user
  ON public.support_ticket_mentions(mentioned_user_id, acknowledged_at);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_mentions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_tickets FROM anon, authenticated;
REVOKE ALL ON public.support_ticket_notes FROM anon, authenticated;
REVOKE ALL ON public.support_ticket_mentions FROM anon, authenticated;
