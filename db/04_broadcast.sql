-- ============================================================================
-- 04_broadcast.sql — WhatsApp Broadcast Campaigns & Queue for kasuni_science
-- Run after 01_schema.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS kasuni_science.broadcast_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text DEFAULT 'Promotional Broadcast'::text NOT NULL,
    title text DEFAULT 'Promotional Broadcast'::text NOT NULL,
    segment text DEFAULT 'all'::text NOT NULL,
    audience_filter text DEFAULT 'all'::text NOT NULL,
    message text,
    message_template text,
    media_url text,
    media_type text,
    total_recipients integer DEFAULT 0 NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    delay_seconds integer DEFAULT 10 NOT NULL,
    delay_seconds_min integer DEFAULT 8 NOT NULL,
    delay_seconds_max integer DEFAULT 15 NOT NULL,
    batch_size integer DEFAULT 30 NOT NULL,
    batch_cooldown_seconds integer DEFAULT 120 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT broadcast_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sending'::text, 'in_progress'::text, 'completed'::text, 'paused'::text, 'cancelled'::text, 'failed'::text])))
);

CREATE TABLE IF NOT EXISTS kasuni_science.broadcast_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    campaign_id uuid NOT NULL REFERENCES kasuni_science.broadcast_campaigns(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    customer_name text,
    recipient_name text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT broadcast_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text])))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_user_id ON kasuni_science.broadcast_campaigns USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_campaign_id ON kasuni_science.broadcast_queue USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON kasuni_science.broadcast_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_user_id ON kasuni_science.broadcast_queue USING btree (user_id);

-- Row Level Security
ALTER TABLE kasuni_science.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasuni_science.broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Policies for broadcast_campaigns
DROP POLICY IF EXISTS "Users can manage own broadcast campaigns" ON kasuni_science.broadcast_campaigns;
CREATE POLICY "Users can manage own broadcast campaigns" ON kasuni_science.broadcast_campaigns
    FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- Policies for broadcast_queue
DROP POLICY IF EXISTS "Users can manage own broadcast queue" ON kasuni_science.broadcast_queue;
CREATE POLICY "Users can manage own broadcast queue" ON kasuni_science.broadcast_queue
    FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- Permissions
GRANT ALL ON TABLE kasuni_science.broadcast_campaigns TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE kasuni_science.broadcast_queue TO anon, authenticated, service_role, postgres;
