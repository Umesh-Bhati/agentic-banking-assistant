-- Seed data for demo user John Doe
-- This file should be run after the initial schema migration

-- Create a demo user (this would normally be created by Supabase Auth)
-- We use a fixed UUID for the demo user for reproducibility
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'john.doe@almasraf.ae',
  crypt('demo1234', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"John Doe"}',
  false,
  'authenticated'
) on conflict (id) do nothing;

-- Create identity for the user
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'john.doe@almasraf.ae',
  '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","email":"john.doe@almasraf.ae"}',
  'email',
  now(),
  now(),
  now()
) on conflict (id) do nothing;

-- Create customer profile for John Doe
insert into customer_profiles (
  id,
  user_id,
  full_name,
  email,
  phone,
  kyc_status
) values (
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'John Doe',
  'john.doe@almasraf.ae',
  '+971501234567',
  'VERIFIED'
) on conflict (user_id) do nothing;

-- Create 2 bank accounts for John Doe (1 Current, 1 Savings)
insert into bank_accounts (id, customer_id, account_number, balance, currency, type, status) values
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'AE123456789012345678901', 25000.00, 'AED', 'CURRENT', 'ACTIVE'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'AE123456789012345678902', 15000.00, 'AED', 'SAVINGS', 'ACTIVE')
on conflict (account_number) do nothing;

-- Create 3 Mastercards for John Doe
insert into cards (id, customer_id, last_4, status, network, card_type, expiry_month, expiry_year) values
  ('d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '1234', 'ACTIVE', 'MASTERCARD', 'Platinum', 12, 2027),
  ('d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '5678', 'ACTIVE', 'MASTERCARD', 'Gold', 6, 2026),
  ('d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '9012', 'ACTIVE', 'MASTERCARD', 'Titanium', 3, 2028)
on conflict do nothing;

-- Create 30 mock transactions for John Doe's Current Account
insert into transactions (id, account_id, amount, currency, type, category, description, merchant_name, created_at) values
  ('e001bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -150.00, 'AED', 'DEBIT', 'PAYMENT', 'Carrefour - Groceries', 'Carrefour', now() - interval '1 day'),
  ('e002bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -45.50, 'AED', 'DEBIT', 'PAYMENT', 'Starbucks Coffee', 'Starbucks', now() - interval '2 days'),
  ('e003bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -800.00, 'AED', 'DEBIT', 'PAYMENT', 'Emirates NBD Transfer', 'Emirates NBD', now() - interval '3 days'),
  ('e004bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 5000.00, 'AED', 'CREDIT', 'DEPOSIT', 'Salary Credit', 'Al Masraf Bank', now() - interval '4 days'),
  ('e005bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -200.00, 'AED', 'DEBIT', 'PAYMENT', 'ADNOC Fuel', 'ADNOC', now() - interval '5 days'),
  ('e006bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -350.00, 'AED', 'DEBIT', 'PAYMENT', 'Noon Electronics', 'Noon', now() - interval '6 days'),
  ('e007bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -75.00, 'AED', 'DEBIT', 'PAYMENT', 'Du Mobile Recharge', 'Du', now() - interval '7 days'),
  ('e008bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -1200.00, 'AED', 'DEBIT', 'PAYMENT', 'DEWA Utility Bill', 'DEWA', now() - interval '8 days'),
  ('e009bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -89.99, 'AED', 'DEBIT', 'PAYMENT', 'Netflix Subscription', 'Netflix', now() - interval '9 days'),
  ('e010bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -500.00, 'AED', 'DEBIT', 'TRANSFER', 'Transfer to Savings', null, now() - interval '10 days'),
  ('e011bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -250.00, 'AED', 'DEBIT', 'PAYMENT', 'Spinneys Supermarket', 'Spinneys', now() - interval '11 days'),
  ('e012bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -180.00, 'AED', 'DEBIT', 'PAYMENT', 'Salik Toll Charges', 'Salik', now() - interval '12 days'),
  ('e013bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -450.00, 'AED', 'DEBIT', 'PAYMENT', 'IKEA Furniture', 'IKEA', now() - interval '13 days'),
  ('e014bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1000.00, 'AED', 'CREDIT', 'DEPOSIT', 'Freelance Payment', 'Client Transfer', now() - interval '14 days'),
  ('e015bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -95.00, 'AED', 'DEBIT', 'PAYMENT', 'Etisalat Internet', 'Etisalat', now() - interval '15 days'),
  ('e016bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -300.00, 'AED', 'DEBIT', 'PAYMENT', 'Fitness First Gym', 'Fitness First', now() - interval '16 days'),
  ('e017bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -65.00, 'AED', 'DEBIT', 'PAYMENT', 'Careem Ride', 'Careem', now() - interval '17 days'),
  ('e018bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -420.00, 'AED', 'DEBIT', 'PAYMENT', 'Lulu Hypermarket', 'Lulu', now() - interval '18 days'),
  ('e019bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -1000.00, 'AED', 'DEBIT', 'PAYMENT', 'Annual Insurance Premium', 'AXA Insurance', now() - interval '19 days'),
  ('e020bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -55.00, 'AED', 'DEBIT', 'PAYMENT', 'Costa Coffee', 'Costa', now() - interval '20 days'),
  ('e021bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -1500.00, 'AED', 'DEBIT', 'PAYMENT', 'Rent Payment', 'Landlord', now() - interval '21 days'),
  ('e022bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -280.00, 'AED', 'DEBIT', 'PAYMENT', 'Zara Fashion', 'Zara', now() - interval '22 days'),
  ('e023bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -110.00, 'AED', 'DEBIT', 'PAYMENT', 'Dubai Metro', 'RTA', now() - interval '23 days'),
  ('e024bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 500.00, 'AED', 'CREDIT', 'DEPOSIT', 'Cash Deposit ATM', 'Al Masraf ATM', now() - interval '24 days'),
  ('e025bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -600.00, 'AED', 'DEBIT', 'PAYMENT', 'Apple Store', 'Apple', now() - interval '25 days'),
  ('e026bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -35.00, 'AED', 'DEBIT', 'FEE', 'Bank Service Fee', 'Al Masraf Bank', now() - interval '26 days'),
  ('e027bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -220.00, 'AED', 'DEBIT', 'PAYMENT', 'Waitrose Groceries', 'Waitrose', now() - interval '27 days'),
  ('e028bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -75.00, 'AED', 'DEBIT', 'PAYMENT', 'McDonalds', 'McDonalds', now() - interval '28 days'),
  ('e029bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -900.00, 'AED', 'DEBIT', 'PAYMENT', 'Emirates Airlines Ticket', 'Emirates', now() - interval '29 days'),
  ('e030bc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -125.00, 'AED', 'DEBIT', 'PAYMENT', 'Amazon.ae', 'Amazon', now() - interval '30 days')
on conflict do nothing;

-- Create chat session for John Doe
insert into chat_sessions (id, user_id, active_workflow_state) values
  ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', null)
on conflict (user_id) do nothing;
