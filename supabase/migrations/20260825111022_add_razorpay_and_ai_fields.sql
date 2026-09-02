/*
# Add Razorpay + AI Fields to Payments and Reviews

## Overview
Adds Razorpay order/payment tracking columns to the payments table, and an
AI-generated reply column to the reviews table for the AI Review Management
feature.

## Modified Tables
1. payments — adds razorpay_order_id, razorpay_payment_id, razorpay_signature
   columns to track Razorpay checkout transactions.
2. reviews — adds ai_reply column to store AI-generated responses to reviews,
   and ai_reply_at timestamp.

## Security
- No new tables. Existing RLS policies remain unchanged.
*/

-- Add Razorpay tracking columns to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_signature text;

-- Add AI reply columns to reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_reply text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_reply_at timestamptz;

-- Add image_url to posters if not already present (for AI-generated images)
ALTER TABLE posters ADD COLUMN IF NOT EXISTS image_url text;
