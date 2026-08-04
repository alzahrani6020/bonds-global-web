-- Track last automatic profile-completion reminder to avoid spamming users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_reminder_sent_at
  ON public.profiles(profile_reminder_sent_at);
