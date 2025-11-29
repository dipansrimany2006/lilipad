-- D1 Database Schema for Lilipad Projects

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    github_url TEXT,
    website_url TEXT,
    docs_url TEXT,
    x_url TEXT,
    project_token TEXT NOT NULL,
    creator_wallet TEXT NOT NULL,
    funding_amount REAL DEFAULT 0,
    backers_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_creator ON projects(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
