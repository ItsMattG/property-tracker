-- Add lifetime plan to subscription_plan enum
ALTER TYPE "subscription_plan" ADD VALUE IF NOT EXISTS 'lifetime';
