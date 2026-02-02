-- Enable pgvector extension for vector similarity search
-- This is required before running migrations that use vector types
CREATE EXTENSION IF NOT EXISTS vector;
