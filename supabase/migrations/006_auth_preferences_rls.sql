-- Migration 006: Auth Preferences & Row-Level Security
-- Adds per-user auth method preference and enables RLS on all core tables

-- =============================================
-- Add auth preference column to customer_profiles
-- =============================================
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS auth_preference text
    NOT NULL DEFAULT 'PIN'
    CHECK (auth_preference IN ('PIN', 'BIOMETRIC', 'CREDENTIALS'));

-- =============================================
-- Enable Row-Level Security on ALL core tables
-- =============================================
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies: customer_profiles
-- Users can only see/update their own profile
-- =============================================
CREATE POLICY "customer_profiles_select_own" ON customer_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "customer_profiles_update_own" ON customer_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- RLS Policies: bank_accounts
-- Users can only see accounts linked to their customer profile
-- =============================================
CREATE POLICY "bank_accounts_select_own" ON bank_accounts
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );

-- =============================================
-- RLS Policies: cards
-- Users can only see/update their own cards
-- =============================================
CREATE POLICY "cards_select_own" ON cards
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "cards_update_own" ON cards
  FOR UPDATE USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );

-- =============================================
-- RLS Policies: transactions
-- Users can only see/insert transactions for their own accounts
-- =============================================
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (
    account_id IN (
      SELECT ba.id FROM bank_accounts ba
      JOIN customer_profiles cp ON ba.customer_id = cp.id
      WHERE cp.user_id = auth.uid()
    )
  );
CREATE POLICY "transactions_insert_own" ON transactions
  FOR INSERT WITH CHECK (
    account_id IN (
      SELECT ba.id FROM bank_accounts ba
      JOIN customer_profiles cp ON ba.customer_id = cp.id
      WHERE cp.user_id = auth.uid()
    )
  );

-- =============================================
-- RLS Policies: chat_sessions
-- Users can only access their own chat sessions
-- =============================================
CREATE POLICY "chat_sessions_select_own" ON chat_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "chat_sessions_insert_own" ON chat_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "chat_sessions_update_own" ON chat_sessions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "chat_sessions_delete_own" ON chat_sessions
  FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- RLS Policies: pending_actions
-- Users can only access their own pending actions
-- =============================================
CREATE POLICY "pending_actions_select_own" ON pending_actions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pending_actions_insert_own" ON pending_actions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pending_actions_update_own" ON pending_actions
  FOR UPDATE USING (user_id = auth.uid());
