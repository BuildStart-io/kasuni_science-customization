-- Migration: Add medium column to orders table
-- Tracks student medium choice (sinhala, english, etc.)

ALTER TABLE kasuni_science.orders 
ADD COLUMN IF NOT EXISTS medium text;

COMMENT ON COLUMN kasuni_science.orders.medium IS 'Selected medium: sinhala, english, etc.';
