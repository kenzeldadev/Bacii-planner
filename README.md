# Bacii study tracker

1. Supabase → SQL Editor: run `schema.sql` to create/update the tables (including the lesson confidence column), then run `seed.sql` on an empty database. The starter seed creates 7 subjects, 4 chapters per subject, and 4 lessons per chapter. To replace existing study data before seeding, run `truncate subjects cascade;` first; this permanently removes the existing study tree.
2. Supabase → Authentication → Users: add the two accounts (tick "Auto Confirm User").
3. Edit `.env` with your Project URL and anon key (Project Settings → API).
4. `npm install` then `npm run dev`.
