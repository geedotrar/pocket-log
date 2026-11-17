-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Tables

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'user')),
    pin_hash TEXT,
    pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trusted Devices
CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_token_hash TEXT NOT NULL UNIQUE,
    device_name TEXT,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Accounts & Budget Pockets
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'ewallet', 'investment', 'other')),
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    include_in_budget BOOLEAN NOT NULL DEFAULT TRUE,
    color TEXT,
    pocket_name TEXT,
    pocket_color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT,
    color TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Debts & Receivables
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('i_owe', 'they_owe')),
    person TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    remaining_amount NUMERIC(15, 2),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'paid')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Payday Cycles
CREATE TABLE IF NOT EXISTS public.cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Monthly Archives
CREATE TABLE IF NOT EXISTS public.monthly_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    period_label TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_income NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_expense NUMERIC(15, 2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    data_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Investments
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'mutual_fund',
    platform TEXT,
    invested_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Investment Logs
CREATE TABLE IF NOT EXISTS public.investment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('initial', 'update_value', 'top_up', 'withdraw', 'dividend')),
    value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Push Subscriptions (Web Push / PWA)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    notify_daily BOOLEAN NOT NULL DEFAULT TRUE,
    notify_weekly BOOLEAN NOT NULL DEFAULT TRUE,
    notify_monthly BOOLEAN NOT NULL DEFAULT TRUE,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Trusted Devices
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON public.trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token ON public.trusted_devices(device_token_hash);

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON public.accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_user_name ON public.accounts(user_id, name);
CREATE INDEX IF NOT EXISTS idx_accounts_include_in_budget ON public.accounts(user_id, include_in_budget);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);
CREATE INDEX IF NOT EXISTS idx_categories_user_name ON public.categories(user_id, name);

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_created ON public.transactions(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON public.transactions(user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON public.transactions(to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id) WHERE category_id IS NOT NULL;

-- Debts
CREATE INDEX IF NOT EXISTS idx_debts_user_status_date ON public.debts(user_id, status, date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_date ON public.debts(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debts_account ON public.debts(account_id) WHERE account_id IS NOT NULL;

-- Cycles
CREATE INDEX IF NOT EXISTS idx_cycles_user_active ON public.cycles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cycles_user_start_date ON public.cycles(user_id, start_date DESC);

-- Monthly Archives
CREATE INDEX IF NOT EXISTS idx_monthly_archives_user_period ON public.monthly_archives(user_id, period DESC);

-- Investments
CREATE INDEX IF NOT EXISTS idx_investments_user_status ON public.investments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_investments_user_start_date ON public.investments(user_id, start_date DESC);

-- Investment Logs
CREATE INDEX IF NOT EXISTS idx_investment_logs_investment ON public.investment_logs(investment_id, date ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_investment_logs_user_date ON public.investment_logs(user_id, date ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_investment_logs_account ON public.investment_logs(account_id) WHERE account_id IS NOT NULL;

-- Push Subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Row Level Security

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;
CREATE POLICY "Users can manage own profile" ON public.users
    FOR ALL TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can manage own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can manage own trusted devices" ON public.trusted_devices
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own accounts" ON public.accounts;
CREATE POLICY "Users can manage own accounts" ON public.accounts
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own categories" ON public.categories;
CREATE POLICY "Users can manage own categories" ON public.categories
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own debts" ON public.debts;
CREATE POLICY "Users can manage own debts" ON public.debts
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own cycles" ON public.cycles;
CREATE POLICY "Users can manage own cycles" ON public.cycles
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own monthly archives" ON public.monthly_archives;
CREATE POLICY "Users can manage own monthly archives" ON public.monthly_archives
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own investments" ON public.investments;
CREATE POLICY "Users can manage own investments" ON public.investments
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own investment logs" ON public.investment_logs;
CREATE POLICY "Users can manage own investment logs" ON public.investment_logs
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- Functions

CREATE OR REPLACE FUNCTION public.verify_user_pin(
    p_email TEXT,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user RECORD;
    v_clean_pin TEXT;
    v_is_valid BOOLEAN := FALSE;
    v_max_attempts INT := 5;
    v_lockout_duration INTERVAL := INTERVAL '5 minutes';
BEGIN
    v_clean_pin := trim(p_pin);

    IF v_clean_pin !~ '^[0-9]{4}$' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'PIN must be exactly 4 numeric digits.'
        );
    END IF;

    SELECT * INTO v_user 
    FROM public.users 
    WHERE email = lower(trim(p_email)) 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid email or PIN.'
        );
    END IF;

    IF v_user.pin_locked_until IS NOT NULL AND v_user.pin_locked_until > now() THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'locked', TRUE,
            'locked_until', v_user.pin_locked_until,
            'error', 'Account temporarily locked due to too many failed PIN attempts. Try again later.'
        );
    END IF;

    IF v_user.pin_hash IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No PIN configured for this account. Please sign in with password.'
        );
    END IF;

    v_is_valid := (v_user.pin_hash = crypt(v_clean_pin, v_user.pin_hash));

    IF v_is_valid THEN
        UPDATE public.users 
        SET pin_failed_attempts = 0,
            pin_locked_until = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_user.id;

        RETURN jsonb_build_object(
            'success', TRUE,
            'user', jsonb_build_object(
                'id', v_user.id,
                'email', v_user.email,
                'full_name', v_user.full_name,
                'role', v_user.role,
                'currency', 'IDR'
            )
        );
    ELSE
        UPDATE public.users
        SET pin_failed_attempts = v_user.pin_failed_attempts + 1,
            pin_locked_until = CASE 
                WHEN v_user.pin_failed_attempts + 1 >= v_max_attempts 
                THEN now() + v_lockout_duration 
                ELSE NULL 
            END,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_user.id;

        IF v_user.pin_failed_attempts + 1 >= v_max_attempts THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'locked', TRUE,
                'locked_until', now() + v_lockout_duration,
                'error', 'Too many failed attempts. PIN login locked for 5 minutes.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', FALSE,
                'remaining_attempts', v_max_attempts - (v_user.pin_failed_attempts + 1),
                'error', 'Incorrect PIN. ' || (v_max_attempts - (v_user.pin_failed_attempts + 1)) || ' attempt(s) remaining.'
            );
        END IF;
    END IF;
END;
$$;

-- Set or Update 4-Digit PIN
CREATE OR REPLACE FUNCTION public.set_user_pin(
    p_user_id UUID,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clean_pin TEXT;
    v_hashed_pin TEXT;
BEGIN
    IF p_pin IS NULL OR trim(p_pin) = '' THEN
        UPDATE public.users
        SET pin_hash = NULL,
            pin_failed_attempts = 0,
            pin_locked_until = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_user_id;

        RETURN jsonb_build_object('success', TRUE);
    END IF;

    v_clean_pin := trim(p_pin);

    IF v_clean_pin !~ '^[0-9]{4}$' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'PIN must be exactly 4 numeric digits.'
        );
    END IF;

    v_hashed_pin := crypt(v_clean_pin, gen_salt('bf', 10));

    UPDATE public.users
    SET pin_hash = v_hashed_pin,
        pin_failed_attempts = 0,
        pin_locked_until = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'User not found.');
    END IF;

    RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_bytes bigint;
BEGIN
  SELECT pg_database_size(current_database()) INTO v_bytes;
  RETURN jsonb_build_object(
    'used_bytes', v_bytes,
    'max_bytes', 524288000 -- 500 MB Free Tier
  );
END;
$$;

-- Triggers

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    -- Insert into public.users
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'PocketLog User'),
        'user'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert Default Categories
    INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
    (NEW.id, 'Food & Dining', 'expense', 'Utensils', '#EF4444', true),
    (NEW.id, 'Transportation', 'expense', 'Car', '#F97316', true),
    (NEW.id, 'Bills & Utilities', 'expense', 'Zap', '#F59E0B', true),
    (NEW.id, 'Shopping', 'expense', 'ShoppingBag', '#10B981', true),
    (NEW.id, 'Entertainment', 'expense', 'Film', '#06B6D4', true),
    (NEW.id, 'Education', 'expense', 'GraduationCap', '#6366F1', true),
    (NEW.id, 'Housing', 'expense', 'Home', '#8B5CF6', true),
    (NEW.id, 'Subscription', 'expense', 'CreditCard', '#EC4899', true),
    (NEW.id, 'Debt Repayment', 'expense', 'Handshake', '#6366F1', true),
    (NEW.id, 'Other Expense', 'expense', 'Tag', '#64748B', true),
    (NEW.id, 'Monthly Salary', 'income', 'Briefcase', '#10B981', true),
    (NEW.id, 'Freelance & Bonus', 'income', 'Award', '#06B6D4', true),
    (NEW.id, 'Investment & Returns', 'income', 'TrendingUp', '#3B82F6', true),
    (NEW.id, 'Other Income', 'income', 'Coins', '#64748B', true)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- Permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_db_size() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_pin(UUID, TEXT) TO anon, authenticated;
