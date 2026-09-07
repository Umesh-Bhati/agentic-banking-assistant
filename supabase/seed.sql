-- Seed data for 3 demo users: Prashant (PIN), Umesh (BIOMETRIC), Priyank (CREDENTIALS)
-- Run after all migrations have been applied

-- =============================================
-- Clean existing demo data
-- =============================================
DELETE FROM transactions WHERE account_id IN (
  SELECT id FROM bank_accounts WHERE customer_id IN (
    SELECT id FROM customer_profiles
  )
);
DELETE FROM customer_products WHERE customer_id IN (SELECT id FROM customer_profiles);
DELETE FROM cards WHERE customer_id IN (SELECT id FROM customer_profiles);
DELETE FROM bank_accounts WHERE customer_id IN (SELECT id FROM customer_profiles);
DELETE FROM chat_sessions WHERE user_id IN (SELECT user_id FROM customer_profiles);
DELETE FROM pending_actions WHERE user_id IN (SELECT user_id FROM customer_profiles);
DELETE FROM customer_profiles;
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('prashant@gmail.com','umesh@gmail.com','priyank@gmail.com','john.doe@gmail.com')
);
DELETE FROM auth.users WHERE email IN ('prashant@gmail.com','umesh@gmail.com','priyank@gmail.com','john.doe@gmail.com');

-- =============================================
-- User 1: Prashant Kumar — PIN auth (PIN: 1234)
-- =============================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('a1000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'prashant@gmail.com', crypt('prashant123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Prashant Kumar"}', false, 'authenticated', 'authenticated', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('a1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'prashant@gmail.com', '{"sub":"a1000001-0000-0000-0000-000000000001","email":"prashant@gmail.com"}', 'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_profiles (id, user_id, full_name, email, phone, kyc_status, auth_preference, pin_hash)
VALUES ('b1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', 'Prashant Kumar', 'prashant@gmail.com', '+971501111111', 'VERIFIED', 'PIN', crypt('1234', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Prashant's Accounts
INSERT INTO bank_accounts (id, customer_id, account_number, balance, currency, type, status) VALUES
  ('c1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'AE110001234567890001', 32500.00, 'AED', 'CURRENT', 'ACTIVE'),
  ('c1000002-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'AE110001234567890002', 18000.00, 'AED', 'SAVINGS', 'ACTIVE')
ON CONFLICT (account_number) DO NOTHING;

-- Prashant's Cards
INSERT INTO cards (id, customer_id, last_4, status, network, card_type, expiry_month, expiry_year) VALUES
  ('d1000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', '4421', 'ACTIVE', 'MASTERCARD', 'Platinum', 12, 2028),
  ('d1000002-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', '8832', 'ACTIVE', 'MASTERCARD', 'Gold', 6, 2027),
  ('d1000003-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', '5519', 'ACTIVE', 'VISA', 'Classic', 3, 2029)
ON CONFLICT DO NOTHING;

-- Prashant's Transactions (Current Account)
INSERT INTO transactions (id, account_id, amount, currency, type, category, description, merchant_name, created_at) VALUES
  ('e1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -220.00, 'AED', 'DEBIT', 'PAYMENT', 'Carrefour Groceries', 'Carrefour', now() - interval '1 day'),
  ('e1000002-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -85.00, 'AED', 'DEBIT', 'PAYMENT', 'Starbucks Coffee', 'Starbucks', now() - interval '2 days'),
  ('e1000003-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 8000.00, 'AED', 'CREDIT', 'DEPOSIT', 'Salary Credit', 'Employer Corp', now() - interval '3 days'),
  ('e1000004-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -1500.00, 'AED', 'DEBIT', 'PAYMENT', 'Rent Payment', 'Landlord', now() - interval '5 days'),
  ('e1000005-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -350.00, 'AED', 'DEBIT', 'PAYMENT', 'DEWA Utility Bill', 'DEWA', now() - interval '7 days'),
  ('e1000006-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -45.00, 'AED', 'DEBIT', 'PAYMENT', 'Du Mobile Recharge', 'Du', now() - interval '10 days'),
  ('e1000007-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -180.00, 'AED', 'DEBIT', 'PAYMENT', 'ADNOC Fuel', 'ADNOC', now() - interval '12 days'),
  ('e1000008-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -620.00, 'AED', 'DEBIT', 'PAYMENT', 'Noon Electronics', 'Noon', now() - interval '15 days'),
  ('e1000009-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 500.00, 'AED', 'CREDIT', 'DEPOSIT', 'Cash Deposit ATM', 'Al Masraf ATM', now() - interval '20 days'),
  ('e1000010-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', -95.00, 'AED', 'DEBIT', 'PAYMENT', 'Netflix & Spotify', 'Netflix', now() - interval '25 days')
ON CONFLICT DO NOTHING;

-- Prashant's Products (for multi-product statements)
INSERT INTO customer_products (id, customer_id, product_type, product_name, product_number, linked_account_id, linked_card_id, balance, currency, status) VALUES
  ('91000001-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'CURRENT_ACCOUNT', 'Current Account', 'AE110001234567890001', 'c1000001-0000-0000-0000-000000000001', null, 32500.00, 'AED', 'ACTIVE'),
  ('91000002-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'SAVINGS_ACCOUNT', 'Savings Account', 'AE110001234567890002', 'c1000002-0000-0000-0000-000000000001', null, 18000.00, 'AED', 'ACTIVE'),
  ('91000003-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'CREDIT_CARD', 'Platinum Credit Card', '•••• 4421', null, 'd1000001-0000-0000-0000-000000000001', -2450.00, 'AED', 'ACTIVE'),
  ('91000004-0000-0000-0000-000000000001', 'b1000001-0000-0000-0000-000000000001', 'HOME_LOAN', 'Home Loan #HL-2024-001', 'HL-2024-001', null, null, -850000.00, 'AED', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Prashant's Chat Session
INSERT INTO chat_sessions (id, user_id, active_workflow_state)
VALUES ('f1000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', null)
ON CONFLICT (id) DO NOTHING;


-- =============================================
-- User 2: Umesh Singh — BIOMETRIC auth (PIN: 5678)
-- =============================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('a2000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'umesh@gmail.com', crypt('umesh123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Umesh Singh"}', false, 'authenticated', 'authenticated', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('a2000002-0000-0000-0000-000000000002', 'a2000002-0000-0000-0000-000000000002', 'umesh@gmail.com', '{"sub":"a2000002-0000-0000-0000-000000000002","email":"umesh@gmail.com"}', 'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_profiles (id, user_id, full_name, email, phone, kyc_status, auth_preference, pin_hash)
VALUES ('b2000002-0000-0000-0000-000000000002', 'a2000002-0000-0000-0000-000000000002', 'Umesh Singh', 'umesh@gmail.com', '+971502222222', 'VERIFIED', 'BIOMETRIC', crypt('5678', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Umesh's Accounts
INSERT INTO bank_accounts (id, customer_id, account_number, balance, currency, type, status) VALUES
  ('c2000001-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'AE220002345678900001', 45000.00, 'AED', 'CURRENT', 'ACTIVE'),
  ('c2000002-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'AE220002345678900002', 28500.00, 'AED', 'SAVINGS', 'ACTIVE')
ON CONFLICT (account_number) DO NOTHING;

-- Umesh's Cards
INSERT INTO cards (id, customer_id, last_4, status, network, card_type, expiry_month, expiry_year) VALUES
  ('d2000001-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', '7712', 'ACTIVE', 'MASTERCARD', 'World Elite', 9, 2028),
  ('d2000002-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', '3345', 'ACTIVE', 'MASTERCARD', 'Titanium', 1, 2027)
ON CONFLICT DO NOTHING;

-- Umesh's Transactions (Current Account)
INSERT INTO transactions (id, account_id, amount, currency, type, category, description, merchant_name, created_at) VALUES
  ('e2000001-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -450.00, 'AED', 'DEBIT', 'PAYMENT', 'Spinneys Supermarket', 'Spinneys', now() - interval '1 day'),
  ('e2000002-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -120.00, 'AED', 'DEBIT', 'PAYMENT', 'Etisalat Internet', 'Etisalat', now() - interval '3 days'),
  ('e2000003-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', 12000.00, 'AED', 'CREDIT', 'DEPOSIT', 'Salary Credit', 'TechCorp', now() - interval '4 days'),
  ('e2000004-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -2200.00, 'AED', 'DEBIT', 'PAYMENT', 'Rent Payment', 'Landlord', now() - interval '6 days'),
  ('e2000005-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -75.00, 'AED', 'DEBIT', 'PAYMENT', 'Careem Ride', 'Careem', now() - interval '8 days'),
  ('e2000006-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -560.00, 'AED', 'DEBIT', 'PAYMENT', 'Fitness First Gym', 'Fitness First', now() - interval '10 days'),
  ('e2000007-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -310.00, 'AED', 'DEBIT', 'PAYMENT', 'Apple Store', 'Apple', now() - interval '13 days'),
  ('e2000008-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -890.00, 'AED', 'DEBIT', 'PAYMENT', 'Emirates Flight', 'Emirates', now() - interval '17 days'),
  ('e2000009-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', 2000.00, 'AED', 'CREDIT', 'DEPOSIT', 'Freelance Payment', 'Client', now() - interval '22 days'),
  ('e2000010-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000002', -150.00, 'AED', 'DEBIT', 'PAYMENT', 'Amazon.ae Order', 'Amazon', now() - interval '28 days')
ON CONFLICT DO NOTHING;

-- Umesh's Products
INSERT INTO customer_products (id, customer_id, product_type, product_name, product_number, linked_account_id, linked_card_id, balance, currency, status) VALUES
  ('92000001-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'CURRENT_ACCOUNT', 'Current Account', 'AE220002345678900001', 'c2000001-0000-0000-0000-000000000002', null, 45000.00, 'AED', 'ACTIVE'),
  ('92000002-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'SAVINGS_ACCOUNT', 'Savings Account', 'AE220002345678900002', 'c2000002-0000-0000-0000-000000000002', null, 28500.00, 'AED', 'ACTIVE'),
  ('92000003-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'CREDIT_CARD', 'World Elite Credit Card', '•••• 7712', null, 'd2000001-0000-0000-0000-000000000002', -5200.00, 'AED', 'ACTIVE'),
  ('92000004-0000-0000-0000-000000000002', 'b2000002-0000-0000-0000-000000000002', 'CREDIT_CARD', 'Titanium Credit Card', '•••• 3345', null, 'd2000002-0000-0000-0000-000000000002', -1800.00, 'AED', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Umesh's Chat Session
INSERT INTO chat_sessions (id, user_id, active_workflow_state)
VALUES ('f2000001-0000-0000-0000-000000000002', 'a2000002-0000-0000-0000-000000000002', null)
ON CONFLICT (id) DO NOTHING;


-- =============================================
-- User 3: Priyank Patel — CREDENTIALS auth (PIN: 9012)
-- =============================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES ('a3000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'priyank@gmail.com', crypt('priyank123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priyank Patel"}', false, 'authenticated', 'authenticated', '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES ('a3000003-0000-0000-0000-000000000003', 'a3000003-0000-0000-0000-000000000003', 'priyank@gmail.com', '{"sub":"a3000003-0000-0000-0000-000000000003","email":"priyank@gmail.com"}', 'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_profiles (id, user_id, full_name, email, phone, kyc_status, auth_preference, pin_hash)
VALUES ('b3000003-0000-0000-0000-000000000003', 'a3000003-0000-0000-0000-000000000003', 'Priyank Patel', 'priyank@gmail.com', '+971503333333', 'VERIFIED', 'CREDENTIALS', crypt('9012', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Priyank's Accounts
INSERT INTO bank_accounts (id, customer_id, account_number, balance, currency, type, status) VALUES
  ('c3000001-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', 'AE330003456789010001', 19750.00, 'AED', 'CURRENT', 'ACTIVE')
ON CONFLICT (account_number) DO NOTHING;

-- Priyank's Cards
INSERT INTO cards (id, customer_id, last_4, status, network, card_type, expiry_month, expiry_year) VALUES
  ('d3000001-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', '6601', 'ACTIVE', 'MASTERCARD', 'Standard', 8, 2027),
  ('d3000002-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', '2298', 'ACTIVE', 'VISA', 'Gold', 11, 2028)
ON CONFLICT DO NOTHING;

-- Priyank's Transactions (Current Account)
INSERT INTO transactions (id, account_id, amount, currency, type, category, description, merchant_name, created_at) VALUES
  ('e3000001-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -300.00, 'AED', 'DEBIT', 'PAYMENT', 'Lulu Hypermarket', 'Lulu', now() - interval '1 day'),
  ('e3000002-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -55.00, 'AED', 'DEBIT', 'PAYMENT', 'Costa Coffee', 'Costa', now() - interval '2 days'),
  ('e3000003-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', 6500.00, 'AED', 'CREDIT', 'DEPOSIT', 'Salary Credit', 'DesignHub LLC', now() - interval '5 days'),
  ('e3000004-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -1800.00, 'AED', 'DEBIT', 'PAYMENT', 'Rent Payment', 'Landlord', now() - interval '7 days'),
  ('e3000005-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -200.00, 'AED', 'DEBIT', 'PAYMENT', 'Salik Toll Charges', 'Salik', now() - interval '9 days'),
  ('e3000006-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -420.00, 'AED', 'DEBIT', 'PAYMENT', 'IKEA Home Items', 'IKEA', now() - interval '11 days'),
  ('e3000007-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -65.00, 'AED', 'DEBIT', 'PAYMENT', 'McDonalds', 'McDonalds', now() - interval '14 days'),
  ('e3000008-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -1200.00, 'AED', 'DEBIT', 'PAYMENT', 'Emirates Airlines', 'Emirates', now() - interval '18 days'),
  ('e3000009-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', 800.00, 'AED', 'CREDIT', 'DEPOSIT', 'Freelance Income', 'Client', now() - interval '23 days'),
  ('e3000010-0000-0000-0000-000000000003', 'c3000001-0000-0000-0000-000000000003', -175.00, 'AED', 'DEBIT', 'PAYMENT', 'Zara Fashion', 'Zara', now() - interval '27 days')
ON CONFLICT DO NOTHING;

-- Priyank's Products
INSERT INTO customer_products (id, customer_id, product_type, product_name, product_number, linked_account_id, linked_card_id, balance, currency, status) VALUES
  ('93000001-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', 'CURRENT_ACCOUNT', 'Current Account', 'AE330003456789010001', 'c3000001-0000-0000-0000-000000000003', null, 19750.00, 'AED', 'ACTIVE'),
  ('93000002-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', 'PERSONAL_LOAN', 'Personal Loan #PL-2025-042', 'PL-2025-042', null, null, -35000.00, 'AED', 'ACTIVE'),
  ('93000003-0000-0000-0000-000000000003', 'b3000003-0000-0000-0000-000000000003', 'AUTO_LOAN', 'Auto Loan #AL-2024-018', 'AL-2024-018', null, null, -120000.00, 'AED', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Priyank's Chat Session
INSERT INTO chat_sessions (id, user_id, active_workflow_state)
VALUES ('f3000001-0000-0000-0000-000000000003', 'a3000003-0000-0000-0000-000000000003', null)
ON CONFLICT (id) DO NOTHING;
