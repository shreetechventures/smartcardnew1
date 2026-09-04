-- Add unique index on card handles (case-insensitive) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS cards_handle_unique_idx ON public.cards (LOWER(handle));
