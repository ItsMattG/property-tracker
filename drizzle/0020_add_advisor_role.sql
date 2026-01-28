-- Add advisor role to portfolio_member_role enum
ALTER TYPE "portfolio_member_role" ADD VALUE IF NOT EXISTS 'advisor';

-- Add advisor role to entity_member_role enum
ALTER TYPE "entity_member_role" ADD VALUE IF NOT EXISTS 'advisor';
