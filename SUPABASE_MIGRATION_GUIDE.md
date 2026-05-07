# Supabase Migration Guide

This guide will help you move your data from your personal Supabase account to your company account.

## Phase 1: Database Schema
1. Open your **New Supabase Project** (Company account).
2. Go to the **SQL Editor** in the left sidebar.
3. Click **"New Query"**.
4. Open the `supabase_migration.sql` file provided in the ZIP.
5. Copy the entire content and paste it into the SQL Editor.
6. Click **Run**. Your tables are now created!

## Phase 2: Exporting Data (Old Account)
1. Open your **Old Supabase Project**.
2. Go to the **Table Editor**.
3. Select a table (e.g., `workspaces`).
4. Click **Export to CSV**.
5. Repeat for all tables.

## Phase 3: Importing Data (New Account)
1. Open your **New Supabase Project**.
2. Go to the **Table Editor**.
3. Select the matching table.
4. Click **Insert** > **Import from CSV**.
5. Upload the CSV file you exported from the old account.
6. **Important:** Make sure the column names match during the import.

## Phase 4: Storage (Images)
1. In your **Old Account**, go to **Storage**.
2. Download all files from your buckets.
3. In your **New Account**, create buckets with the **exact same names**.
4. Upload the files into the new buckets.

## Phase 5: Update Environment Variables
1. Get your new **Project URL** and **Anon Key** from the new project settings.
2. Update your `.env.local` file with these new values.
