-- Migration 008: Set Customer PIN RPC
-- Used during signup to set a customer's 4-digit banking PIN

CREATE OR REPLACE FUNCTION set_customer_pin(
  p_customer_id uuid,
  p_pin text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customer_profiles
  SET pin_hash = crypt(p_pin, gen_salt('bf'))
  WHERE id = p_customer_id;
END;
$$;
