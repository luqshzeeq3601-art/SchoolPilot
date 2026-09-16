-- Enable pgvector extension in the primary application database
CREATE EXTENSION IF NOT EXISTS vector;

-- Create dedicated database for n8n internal storage
SELECT 'CREATE DATABASE n8n'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\gexec

-- Connect to n8n database and ensure extensions if needed
\c n8n
CREATE EXTENSION IF NOT EXISTS vector;
\c schoolops
