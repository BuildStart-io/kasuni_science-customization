-- Migration: 06_add_medium_to_products.sql
-- Add medium column to products table for Kasuni Science catalog

ALTER TABLE kasuni_science.products 
ADD COLUMN IF NOT EXISTS medium text DEFAULT 'sinhala';

COMMENT ON COLUMN kasuni_science.products.medium IS 'Medium of instruction: sinhala, english, or both';
