-- Migration: Integrations Table for Google Calendar and External Services
-- Created: 2025-11-08
-- Purpose: Store OAuth tokens and configuration for external integrations

-- 📦 CREATE INTEGRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'google_calendar', 'outlook_calendar', 'apple_calendar', 'zapier', etc.
    is_active BOOLEAN DEFAULT true,
    
    -- OAuth2 Tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Provider-specific config
    config JSONB DEFAULT '{}'::jsonb,
    -- Example config for Google Calendar:
    -- {
    --   "calendar_id": "primary",
    --   "calendar_name": "LA-IA Reservas",
    --   "webhook_id": "...",
    --   "sync_direction": "bidirectional", -- "to_provider", "from_provider", "bidirectional"
    --   "events_synced": 0
    -- }
    
    -- Metadata
    last_sync_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    error_log JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(business_id, provider)
);

-- 📋 CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_integrations_business_id ON public.integrations(business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_active ON public.integrations(is_active) WHERE is_active = true;

-- 🔄 CREATE TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_integrations_updated_at();

-- 🔒 ROW LEVEL SECURITY (RLS)
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own business integrations
CREATE POLICY "Users can read own business integrations"
    ON public.integrations
    FOR SELECT
    USING (
        business_id IN (
            SELECT id FROM public.businesses
            WHERE owner_id = auth.uid()
        )
    );

-- Policy: Users can insert integrations for their business
CREATE POLICY "Users can insert own business integrations"
    ON public.integrations
    FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT id FROM public.businesses
            WHERE owner_id = auth.uid()
        )
    );

-- Policy: Users can update their own business integrations
CREATE POLICY "Users can update own business integrations"
    ON public.integrations
    FOR UPDATE
    USING (
        business_id IN (
            SELECT id FROM public.businesses
            WHERE owner_id = auth.uid()
        )
    );

-- Policy: Users can delete their own business integrations
CREATE POLICY "Users can delete own business integrations"
    ON public.integrations
    FOR DELETE
    USING (
        business_id IN (
            SELECT id FROM public.businesses
            WHERE owner_id = auth.uid()
        )
    );

-- 📝 COMMENT
COMMENT ON TABLE public.integrations IS 'Stores OAuth tokens and configuration for external integrations (Google Calendar, Outlook, etc.)';

