-- Enable Supabase Realtime for the notifications table
-- so the bell icon updates instantly when new notifications arrive
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
