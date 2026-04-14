-- Migration: add manual item columns to cart_state
ALTER TABLE public.cart_state
  ADD COLUMN IF NOT EXISTS source   text NOT NULL DEFAULT 'menu'
                                     CHECK (source IN ('menu', 'manual')),
  ADD COLUMN IF NOT EXISTS qty      numeric,
  ADD COLUMN IF NOT EXISTS unit     text,
  ADD COLUMN IF NOT EXISTS category text;
