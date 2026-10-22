-- Extend the immutable Assistant audit vocabulary for Event-Driven Assistant V1.
-- These event types are observability only; they do not grant execution authority.

ALTER TABLE public.assistant_action_audit
  DROP CONSTRAINT IF EXISTS assistant_action_audit_event_type_check;

ALTER TABLE public.assistant_action_audit
  ADD CONSTRAINT assistant_action_audit_event_type_check
  CHECK (
    event_type IN (
      'planned',
      'confirmation_prepared',
      'confirmation_resolved',
      'idempotency_claimed',
      'replayed',
      'write_succeeded',
      'write_uncertain',
      'denied',
      'failed',
      'execution_started',
      'execution_succeeded',
      'execution_failed',
      'execution_denied',
      'event_received',
      'event_applied',
      'event_replayed',
      'event_denied'
    )
  );
