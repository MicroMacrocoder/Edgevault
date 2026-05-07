-- Supabase Database Migration Script
-- Run this in the SQL Editor of your NEW Supabase project

-- 1. Create Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    client_id TEXT UNIQUE NOT NULL,
    workspace_title TEXT,
    instrument TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Trade Logs Table
CREATE TABLE IF NOT EXISTS public.trade_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    asset TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Buy' or 'Sell'
    entry_price NUMERIC,
    exit_price NUMERIC,
    size NUMERIC,
    pnl NUMERIC,
    rr TEXT,
    status TEXT, -- 'Open', 'Closed'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Journal Entries Table
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT,
    content TEXT, -- Markdown or JSON for rich text
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Create Policies (Allow users to see only their own data)
CREATE POLICY "Users can view their own workspaces" ON public.workspaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own workspaces" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workspaces" ON public.workspaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workspaces" ON public.workspaces FOR DELETE USING (auth.uid() = user_id);

-- Repeat for other tables...
CREATE POLICY "Users can view their own trade_logs" ON public.trade_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own trade_logs" ON public.trade_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own journal_entries" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own journal_entries" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
