-- Migration 007: Customer Products Table
-- Models all financial products a customer holds that are eligible for statements
-- Supports: accounts, credit cards, loans

CREATE TABLE IF NOT EXISTS customer_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customer_profiles(id) ON DELETE CASCADE NOT NULL,
  product_type text NOT NULL CHECK (product_type IN (
    'CURRENT_ACCOUNT', 'SAVINGS_ACCOUNT', 'CREDIT_CARD', 'PERSONAL_LOAN', 'HOME_LOAN', 'AUTO_LOAN'
  )),
  product_name text NOT NULL,
  product_number text NOT NULL,
  linked_account_id uuid REFERENCES bank_accounts(id),
  linked_card_id uuid REFERENCES cards(id),
  balance decimal(15,2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE customer_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_products_select_own" ON customer_products
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customer_profiles WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS customer_products_customer_idx ON customer_products(customer_id);
CREATE INDEX IF NOT EXISTS customer_products_type_idx ON customer_products(product_type);

-- Auto-update updated_at
CREATE TRIGGER update_customer_products_updated_at
  BEFORE UPDATE ON customer_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
