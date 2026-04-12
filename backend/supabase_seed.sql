-- Agnostos: Full schema + seed data for Supabase
-- Paste this entire script into the Supabase SQL Editor and run it.

-- ============================================================
-- DROP existing tables (order matters for foreign keys)
-- ============================================================
DROP TABLE IF EXISTS job_listing_relevance CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS followup_schedule CASCADE;
DROP TABLE IF EXISTS outreach_emails CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS linkedin_signals CASCADE;
DROP TABLE IF EXISTS job_listings CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS company_research CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS adam_conversations CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- CREATE TABLES
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    name VARCHAR,
    nylas_grant_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ix_users_email ON users(email);

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    raw_cv_text TEXT,
    raw_linkedin_text TEXT,
    cv_file_url VARCHAR,
    parsed_skills JSONB,
    parsed_experience JSONB,
    parsed_projects JSONB,
    parsed_education JSONB,
    proof_points JSONB,
    soft_profile JSONB,
    what_they_bring TEXT,
    preferred_roles VARCHAR[],
    preferred_stages VARCHAR[],
    preferred_sectors VARCHAR[],
    location VARCHAR,
    open_to_relocation BOOLEAN DEFAULT false,
    visa_status VARCHAR,
    tone_formal INTEGER DEFAULT 5,
    tone_technical INTEGER DEFAULT 5,
    interview_completed BOOLEAN DEFAULT false,
    interview_turns INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE adam_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    audio_url VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    website VARCHAR,
    linkedin_url VARCHAR,
    stage VARCHAR,
    funding_amount_usd BIGINT,
    funding_date DATE,
    investors VARCHAR[],
    sector VARCHAR[],
    hq_location VARCHAR,
    headcount INTEGER,
    tech_stack VARCHAR[],
    hiring_score INTEGER DEFAULT 0,
    hiring_score_updated TIMESTAMPTZ,
    last_researched_at TIMESTAMPTZ,
    research_summary TEXT,
    source VARCHAR,
    source_batch VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_research (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    recent_news JSONB,
    blog_posts JSONB,
    founder_posts JSONB,
    product_updates JSONB,
    job_postings JSONB,
    scraped_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    role VARCHAR,
    seniority VARCHAR,
    linkedin_url VARCHAR UNIQUE,
    linkedin_data JSONB,
    professional_email VARCHAR,
    personal_email VARCHAR,
    email_confidence_score DOUBLE PRECISION,
    email_source VARCHAR,
    is_new_recruit BOOLEAN DEFAULT false,
    tenure_months INTEGER,
    is_founder BOOLEAN DEFAULT false,
    recent_posts JSONB,
    last_enriched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR DEFAULT 'queued',
    tone_settings JSONB,
    suppressed_until TIMESTAMPTZ,
    suppress_reason VARCHAR,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ
);

CREATE TABLE outreach_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    subject VARCHAR,
    body TEXT,
    subject_options JSONB,
    tone_settings JSONB,
    relevance_score DOUBLE PRECISION,
    relevant_projects JSONB,
    hook_used TEXT,
    status VARCHAR DEFAULT 'draft',
    followup_number INTEGER DEFAULT 0,
    parent_email_id UUID REFERENCES outreach_emails(id),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    thread_id VARCHAR,
    message_id VARCHAR,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE followup_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outreach_email_id UUID NOT NULL REFERENCES outreach_emails(id) ON DELETE CASCADE,
    followup_number INTEGER NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR DEFAULT 'pending',
    new_signal_found BOOLEAN DEFAULT false,
    new_signal_content TEXT,
    override_body TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE linkedin_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_url VARCHAR UNIQUE,
    post_content TEXT,
    author_name VARCHAR,
    author_linkedin VARCHAR,
    signal_type VARCHAR,
    company_id UUID REFERENCES companies(id),
    resolved BOOLEAN DEFAULT false,
    detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    title VARCHAR NOT NULL,
    url VARCHAR NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR,
    employment_type VARCHAR,
    experience_required VARCHAR,
    remote_ok BOOLEAN,
    source VARCHAR,
    posted_at TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE job_listing_relevance (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_listing_id UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    relevance_score DOUBLE PRECISION,
    computed_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, job_listing_id)
);

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    entity_type VARCHAR,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Fixed UUIDs for referential integrity
DO $$
DECLARE
    v_user_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    v_company_neuralforge UUID := 'c0000001-0000-0000-0000-000000000001';
    v_company_gridware UUID := 'c0000002-0000-0000-0000-000000000002';
    v_company_payflow UUID := 'c0000003-0000-0000-0000-000000000003';
    v_company_documind UUID := 'c0000004-0000-0000-0000-000000000004';
    v_company_orbital UUID := 'c0000005-0000-0000-0000-000000000005';
    v_contact_sarah UUID := 'd0000001-0000-0000-0000-000000000001';
    v_contact_raj UUID := 'd0000002-0000-0000-0000-000000000002';
    v_contact_mike UUID := 'd0000003-0000-0000-0000-000000000003';
    v_contact_priya UUID := 'd0000004-0000-0000-0000-000000000004';
    v_contact_rahul UUID := 'd0000005-0000-0000-0000-000000000005';
    v_contact_anika UUID := 'd0000006-0000-0000-0000-000000000006';
    v_contact_james UUID := 'd0000007-0000-0000-0000-000000000007';
    v_contact_elena UUID := 'd0000008-0000-0000-0000-000000000008';
    v_contact_lena UUID := 'd0000009-0000-0000-0000-000000000009';
    v_contact_tom UUID := 'd000000a-0000-0000-0000-000000000010';
    v_campaign1 UUID := 'e0000001-0000-0000-0000-000000000001';
    v_campaign2 UUID := 'e0000002-0000-0000-0000-000000000002';
    v_campaign3 UUID := 'e0000003-0000-0000-0000-000000000003';
    v_email1 UUID := 'f0000001-0000-0000-0000-000000000001';
    v_email2 UUID := 'f0000002-0000-0000-0000-000000000002';
    v_email3 UUID := 'f0000003-0000-0000-0000-000000000003';
    v_email4 UUID := 'f0000004-0000-0000-0000-000000000004';
    v_email5 UUID := 'f0000005-0000-0000-0000-000000000005';
    v_email6 UUID := 'f0000006-0000-0000-0000-000000000006';
    v_now TIMESTAMPTZ := now();
BEGIN

-- USER
INSERT INTO users (id, email, password_hash, name) VALUES (
    v_user_id,
    'test@agnostos.com',
    '$2b$12$8pae9nGYa5pHkQ5Bwg.evucMbDfdaGymbTY3.7IKEvrEjpECpy7sC',
    'Arjun Mehta'
);

-- USER PROFILE
INSERT INTO user_profiles (user_id, parsed_skills, parsed_experience, parsed_projects, parsed_education, proof_points, soft_profile, what_they_bring, preferred_roles, preferred_stages, preferred_sectors, location, open_to_relocation, tone_formal, tone_technical, interview_completed, interview_turns) VALUES (
    v_user_id,
    '{"technical": ["Python", "React", "TypeScript", "FastAPI", "PostgreSQL", "Docker", "AWS", "Kafka", "Redis", "Next.js"], "soft": ["Leadership", "Problem Solving", "Technical Communication", "Mentoring"]}',
    '[{"company": "Zephyr AI", "role": "Senior Backend Engineer", "duration_months": 18, "start_date": "2024-10", "end_date": "present", "description": "Led backend architecture for AI-powered analytics platform serving 50K users", "tech_used": ["Python", "FastAPI", "PostgreSQL", "Redis", "Kafka"]}, {"company": "NovaTech Solutions", "role": "Full Stack Developer", "duration_months": 24, "start_date": "2022-10", "end_date": "2024-09", "description": "Built real-time collaboration tools and data pipelines for enterprise clients", "tech_used": ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"]}, {"company": "StartupXYZ", "role": "Software Engineer Intern", "duration_months": 6, "start_date": "2022-04", "end_date": "2022-09", "description": "Developed customer-facing dashboard and internal tooling", "tech_used": ["React", "Python", "Flask"]}]',
    '[{"name": "DataFlow Engine", "description": "Real-time data processing pipeline handling 1M events/day with exactly-once semantics", "tech": ["Python", "Kafka", "PostgreSQL"], "url": "github.com/arjun/dataflow", "context": "built at Zephyr AI"}, {"name": "CollabSpace", "description": "Real-time collaborative whiteboard with WebSocket sync and conflict resolution", "tech": ["React", "TypeScript", "WebSocket", "Redis"], "url": "", "context": "built at NovaTech"}, {"name": "AuthGuard", "description": "Zero-downtime auth migration framework for microservices", "tech": ["FastAPI", "Redis", "JWT", "PostgreSQL"], "url": "", "context": "side project"}, {"name": "MetricsDash", "description": "Internal analytics dashboard used by 30+ team members daily", "tech": ["React", "D3.js", "TypeScript"], "url": "", "context": "built at Zephyr AI"}]',
    '[{"institution": "IIT Delhi", "degree": "B.Tech", "field": "Computer Science", "year": "2022"}]',
    '[{"title": "DataFlow Engine", "project": "Real-time data processing pipeline", "problem": "Company had no way to process streaming data at scale, causing 4-hour delays in analytics", "impact": "Handles 1M events/day with 99.9% uptime, reduced processing latency from 4 hours to 12 seconds", "tech": ["Python", "Kafka", "PostgreSQL"], "context": "startup", "highlight": true}, {"title": "Zero-Downtime Auth Migration", "project": "AuthGuard framework", "problem": "Legacy auth caused 2-hour monthly outages and was a security liability", "impact": "Migrated 50K users with zero downtime, eliminated monthly auth outages completely", "tech": ["FastAPI", "Redis", "JWT"], "context": "startup", "highlight": true}, {"title": "CollabSpace Real-time Engine", "project": "WebSocket sync with CRDT conflict resolution", "problem": "Existing collab tools had 3-5 second lag, users constantly overwrote each other", "impact": "Sub-100ms sync latency, 40% increase in team collaboration metrics", "tech": ["React", "TypeScript", "WebSocket", "Redis"], "context": "startup", "highlight": true}, {"title": "MetricsDash", "project": "Internal analytics dashboard", "problem": "Product team had no visibility into user behavior, relied on ad-hoc SQL queries", "impact": "Used by 30 internal users daily, directly drove 3 major product decisions", "tech": ["React", "D3.js", "TypeScript"], "context": "startup", "highlight": false}, {"title": "CI/CD Pipeline Overhaul", "project": "Build pipeline optimization", "problem": "CI builds took 45 minutes, developers avoided running tests", "impact": "Reduced build time to 8 minutes, test coverage went from 40% to 85%", "tech": ["Docker", "GitHub Actions", "Python"], "context": "startup", "highlight": false}]',
    '{"personality": "Quiet intensity. Thinks deeply, speaks precisely. Gets genuinely excited about elegant architecture.", "communication_style": "technical", "core_motivations": ["Building things that work at scale", "Solving problems nobody has tackled", "Working with smart people"], "ambitions": {"short_term": "Lead engineering at an early-stage startup", "long_term": "CTO of a company solving real infrastructure problems"}, "differentiators": ["Can go from system design to shipping production code in the same day", "Obsessed with reliability and observability"]}',
    'Backend architect who''s built production systems handling 1M+ events/day. Strong at Python, distributed systems, and going from zero to shipped. Has a track record of solving infrastructure problems that directly unlock product growth.',
    ARRAY['Senior Backend Engineer', 'Founding Engineer', 'Staff Engineer'],
    ARRAY['seed', 'series-a'],
    ARRAY['AI/ML', 'Developer Tools', 'Infrastructure', 'FinTech'],
    'Bangalore, India',
    true, 4, 7, true, 12
);

-- COMPANIES
INSERT INTO companies (id, name, website, stage, funding_amount_usd, funding_date, investors, sector, hq_location, headcount, tech_stack, hiring_score, research_summary, source, source_batch) VALUES
    (v_company_neuralforge, 'NeuralForge', 'https://neuralforge.ai', 'seed', 4200000, '2026-03-15', ARRAY['Y Combinator', 'Sequoia Scout'], ARRAY['AI/ML', 'Developer Tools'], 'San Francisco, CA', 12, ARRAY['Python', 'PyTorch', 'FastAPI', 'PostgreSQL', 'Kubernetes'], 85, 'NeuralForge is building an AI model optimization platform that reduces inference costs by 10x. Recently closed a $4.2M seed round led by YC. Actively hiring backend engineers and ML infra roles. CEO posted about scaling challenges last week.', 'yc', 'W26'),
    (v_company_gridware, 'Gridware', 'https://gridware.io', 'series-a', 18000000, '2026-01-20', ARRAY['a16z', 'Lightspeed'], ARRAY['Infrastructure', 'Climate Tech'], 'Austin, TX', 45, ARRAY['Go', 'Python', 'React', 'PostgreSQL', 'Kafka', 'AWS'], 72, 'Gridware builds real-time monitoring for power grid infrastructure. Series A closed 2 months ago. Blog post about their data pipeline challenges. 8 open engineering roles on their careers page.', 'crunchbase', NULL),
    (v_company_payflow, 'Payflow', 'https://payflow.in', 'seed', 2800000, '2026-03-28', ARRAY['Accel India', 'Angel investors'], ARRAY['FinTech', 'B2B SaaS'], 'Bangalore, India', 8, ARRAY['Python', 'FastAPI', 'React', 'PostgreSQL', 'Redis'], 90, 'Payflow automates invoice processing for SMBs in India. Just closed seed round. Founder posted about looking for ''founding engineers who think in systems''. Very early stage, high signal.', 'inc42', NULL),
    (v_company_documind, 'DocuMind', 'https://documind.co', 'series-a', 12500000, '2025-12-05', ARRAY['Index Ventures', 'Bessemer'], ARRAY['AI/ML', 'Enterprise'], 'London, UK', 35, ARRAY['Python', 'TypeScript', 'Next.js', 'PostgreSQL', 'OpenAI', 'Pinecone'], 65, 'DocuMind uses AI to extract and understand enterprise documents. Series A 4 months ago. Growing steadily. Recent product update added multi-language support. Looking for senior engineers.', 'crunchbase', NULL),
    (v_company_orbital, 'Orbital', 'https://orbital.dev', 'pre-seed', 850000, NULL, ARRAY['Entrepreneur First', 'Angels'], ARRAY['Developer Tools', 'DevOps'], 'Berlin, Germany', 4, ARRAY['Rust', 'TypeScript', 'React', 'PostgreSQL'], 55, 'Orbital is building a next-gen CI/CD platform with 100x faster builds using Rust-based containerization. Pre-seed, very early. Founded by ex-GitHub engineers. Looking for generalists.', 'ef', NULL);

-- COMPANY RESEARCH
INSERT INTO company_research (company_id, recent_news, blog_posts, founder_posts, product_updates, job_postings) VALUES
    (v_company_neuralforge, '[{"headline": "NeuralForge raises $4.2M to make AI inference 10x cheaper", "url": "https://techcrunch.com/neuralforge", "date": "2026-03-15", "summary": "YC-backed NeuralForge closed seed round to build model optimization platform"}]', '[{"title": "Why We''re Building NeuralForge", "url": "https://neuralforge.ai/blog/why", "date": "2026-03-20", "summary": "Founder explains the cost problem in AI inference"}]', '[{"author": "Sarah Chen", "content": "We just shipped our beta and the results are wild -- 8x cost reduction on GPT-4 workloads. Hiring backend engineers who want to work on this.", "date": "2026-04-01"}]', NULL, '[{"title": "Senior Backend Engineer", "url": "https://neuralforge.ai/careers/sbe", "department": "Engineering", "date": "2026-03-25"}, {"title": "ML Infrastructure Engineer", "url": "https://neuralforge.ai/careers/mle", "department": "ML", "date": "2026-03-25"}]'),
    (v_company_gridware, '[{"headline": "Gridware secures $18M Series A for power grid monitoring", "url": "https://gridware.io/news", "date": "2026-01-20", "summary": "a16z leads round for climate tech infrastructure startup"}]', '[{"title": "Scaling Our Data Pipeline to 10B Events/Day", "url": "https://gridware.io/blog/scaling", "date": "2026-02-15", "summary": "Technical deep-dive into Kafka + Go architecture for real-time grid data"}]', '[{"author": "Mike Torres", "content": "Looking for engineers who are excited about building infrastructure that actually matters. Our monitoring system just prevented a blackout in Texas.", "date": "2026-03-10"}]', NULL, '[{"title": "Senior Software Engineer - Backend", "url": "https://gridware.io/careers/sse", "department": "Engineering", "date": "2026-03-01"}, {"title": "Data Engineer", "url": "https://gridware.io/careers/de", "department": "Data", "date": "2026-03-01"}]'),
    (v_company_payflow, '[{"headline": "Payflow raises $2.8M to automate invoicing for Indian SMBs", "url": "https://inc42.com/payflow", "date": "2026-03-28", "summary": "Accel-backed Payflow targets India''s $50B invoice processing market"}]', NULL, '[{"author": "Rahul Verma", "content": "We''re 3 engineers building for millions of businesses. Looking for founding engineers who think in systems and ship fast. DM me.", "date": "2026-04-05"}]', NULL, '[{"title": "Founding Engineer", "url": "https://payflow.in/careers/fe", "department": "Engineering", "date": "2026-04-01"}]'),
    (v_company_documind, NULL, '[{"title": "Introducing Multi-Language Document Understanding", "url": "https://documind.co/blog/multilang", "date": "2026-02-28", "summary": "DocuMind now supports 40+ languages for enterprise document AI"}]', NULL, '[{"title": "v2.3 - Multi-language + Table Extraction", "date": "2026-02-28", "summary": "Major update adding language support and improved table extraction accuracy"}]', '[{"title": "Senior Full Stack Engineer", "url": "https://documind.co/careers/sfs", "department": "Product", "date": "2026-03-15"}]'),
    (v_company_orbital, NULL, NULL, '[{"author": "Lena Weber", "content": "Built our first prototype in Rust. 200x faster container startup than Docker. Now we need help making it production-ready. Generalists welcome.", "date": "2026-03-20"}]', NULL, NULL);

-- CONTACTS
INSERT INTO contacts (id, company_id, name, role, seniority, professional_email, is_founder, tenure_months, linkedin_url, email_confidence_score, email_source, is_new_recruit) VALUES
    (v_contact_sarah, v_company_neuralforge, 'Sarah Chen', 'CEO & Co-founder', 'c_suite', 'sarah@neuralforge.ai', true, 18, 'https://linkedin.com/in/sarahchen-nf', 0.95, 'apollo', false),
    (v_contact_raj, v_company_neuralforge, 'Raj Patel', 'CTO & Co-founder', 'c_suite', 'raj@neuralforge.ai', true, 18, 'https://linkedin.com/in/rajpatel-nf', 0.95, 'apollo', false),
    (v_contact_mike, v_company_gridware, 'Mike Torres', 'CEO', 'c_suite', 'mike@gridware.io', true, 30, 'https://linkedin.com/in/miketorres', 0.95, 'apollo', false),
    (v_contact_priya, v_company_gridware, 'Priya Sharma', 'VP Engineering', 'vp', 'priya@gridware.io', false, 8, 'https://linkedin.com/in/priyasharma-gw', 0.95, 'apollo', true),
    (v_contact_rahul, v_company_payflow, 'Rahul Verma', 'Founder & CEO', 'c_suite', 'rahul@payflow.in', true, 12, 'https://linkedin.com/in/rahulverma-pf', 0.95, 'apollo', false),
    (v_contact_anika, v_company_payflow, 'Anika Das', 'Co-founder & CTO', 'c_suite', 'anika@payflow.in', true, 12, 'https://linkedin.com/in/anikadas', 0.95, 'apollo', false),
    (v_contact_james, v_company_documind, 'James Wright', 'Head of Engineering', 'director', 'james@documind.co', false, 14, 'https://linkedin.com/in/jameswright-dm', 0.95, 'apollo', false),
    (v_contact_elena, v_company_documind, 'Elena Rossi', 'Senior Engineer', 'senior', 'elena@documind.co', false, 3, 'https://linkedin.com/in/elenarossi', 0.95, 'apollo', true),
    (v_contact_lena, v_company_orbital, 'Lena Weber', 'Founder & CEO', 'c_suite', 'lena@orbital.dev', true, 8, 'https://linkedin.com/in/lenaweber-orbital', 0.95, 'apollo', false),
    (v_contact_tom, v_company_orbital, 'Tom Fischer', 'Co-founder & Engineer', 'senior', 'tom@orbital.dev', true, 8, 'https://linkedin.com/in/tomfischer', 0.95, 'apollo', false);

-- CAMPAIGNS
INSERT INTO campaigns (id, user_id, company_id, status, tone_settings, last_activity_at) VALUES
    (v_campaign1, v_user_id, v_company_payflow, 'active', '{"formal": 3, "technical": 7}', v_now - interval '2 hours'),
    (v_campaign2, v_user_id, v_company_neuralforge, 'queued', '{"formal": 5, "technical": 8}', NULL),
    (v_campaign3, v_user_id, v_company_gridware, 'active', '{"formal": 5, "technical": 6}', v_now - interval '2 days');

-- OUTREACH EMAILS
INSERT INTO outreach_emails (id, campaign_id, contact_id, subject, body, subject_options, tone_settings, relevance_score, relevant_projects, hook_used, status, sent_at, opened_at, replied_at) VALUES
    (v_email1, v_campaign1, v_contact_rahul,
     'Your approach to SMB invoicing + a thought',
     E'Rahul -- saw your post about looking for founding engineers who think in systems. That''s exactly what I do.\n\nAt Zephyr AI, I built a data pipeline that processes 1M events/day with exactly-once semantics. Before that, I led a zero-downtime auth migration for 50K users.\n\nPayflow''s invoice processing problem is a systems problem at its core -- scale, reliability, real-time processing. That''s my wheelhouse.\n\nWould love 15 minutes to hear where you''re headed architecturally.',
     '["Your approach to SMB invoicing + a thought", "Founding engineer who thinks in systems", "Re: your LinkedIn post about Payflow"]',
     '{"formal": 3, "technical": 7}', 92.5,
     '[{"title": "DataFlow Engine", "reason": "Direct parallel to invoice processing scale"}, {"title": "Zero-Downtime Auth Migration", "reason": "Shows reliability focus"}]',
     'Saw founder post about looking for founding engineers', 'sent',
     v_now - interval '3 days', NULL, NULL),

    (v_email2, v_campaign1, v_contact_anika,
     'Your CTO perspective on Payflow''s architecture',
     E'Anika -- Payflow''s approach to automating invoice processing for Indian SMBs caught my attention. The scale of this market is enormous.\n\nI''ve been building backend systems at Zephyr AI -- most recently a streaming pipeline handling 1M events/day. Before that, I built collaborative real-time tools at NovaTech.\n\nI''d love to understand how you''re thinking about Payflow''s technical architecture as you scale. Happy to share ideas from building similar systems.\n\n15 minutes?',
     '["Your CTO perspective on Payflow''s architecture", "Systems thinking for invoice processing", "Fellow backend engineer -- quick question"]',
     '{"formal": 3, "technical": 7}', 88.0, NULL,
     'Company just raised seed round', 'opened',
     v_now - interval '3 days', v_now - interval '1 day', NULL),

    (v_email3, v_campaign2, v_contact_sarah,
     'NeuralForge''s inference optimization + my background',
     E'Sarah -- read your blog post about why you''re building NeuralForge. The 8x cost reduction numbers are impressive.\n\nI''ve been building high-throughput backend systems at Zephyr AI (1M events/day pipeline, zero-downtime migrations). The infrastructure challenges of model optimization at scale are exactly the kind of problems I love.\n\nWould love to hear what the backend architecture looks like at NeuralForge and where you need help most.\n\n15 min call?',
     '["NeuralForge''s inference optimization + my background", "Backend infra for AI model optimization", "Re: your YC launch"]',
     '{"formal": 5, "technical": 8}', 87.0, NULL,
     'Read blog post about why building NeuralForge', 'draft',
     NULL, NULL, NULL),

    (v_email4, v_campaign2, v_contact_raj,
     'CTO to engineer -- NeuralForge''s infra challenges',
     E'Raj -- congrats on the seed round. NeuralForge''s approach to inference cost reduction is technically fascinating.\n\nI built a real-time data pipeline at Zephyr AI handling 1M+ events/day on Python + Kafka + PostgreSQL. The reliability and performance challenges sound similar to what you''re tackling with model optimization.\n\nI''d love to learn more about your technical roadmap. Happy to share what I''ve learned building systems at this scale.\n\nQuick call this week?',
     '["CTO to engineer -- NeuralForge''s infra challenges", "Python + distributed systems background for NeuralForge", "Inference optimization infrastructure"]',
     '{"formal": 5, "technical": 8}', 85.5, NULL,
     'Recent funding announcement', 'draft',
     NULL, NULL, NULL),

    (v_email5, v_campaign3, v_contact_mike,
     'Gridware''s data pipeline + my experience at scale',
     E'Mike -- read your blog post on scaling to 10B events/day. The Kafka + Go architecture choices make a lot of sense for grid data.\n\nI''ve built similar high-throughput systems at Zephyr AI (1M events/day, exactly-once semantics, Python + Kafka). The real-time processing challenges of power grid monitoring are the kind of problems I find deeply interesting.\n\nWould love to hear what''s next on the infrastructure roadmap.',
     '["Gridware''s data pipeline + my experience at scale", "Real-time infra for power grid monitoring", "Re: your blog on scaling data pipelines"]',
     NULL, 78.0, NULL,
     'Read blog post on scaling data pipeline', 'sent',
     v_now - interval '5 days', NULL, NULL),

    (v_email6, v_campaign3, v_contact_priya,
     'New VP Eng perspective on Gridware''s stack',
     E'Priya -- noticed you recently joined Gridware as VP Engineering. Congrats on the move.\n\nAs someone who''s been in similar roles at fast-growing startups, I imagine you''re evaluating the team and architecture. I''ve built backend systems handling 1M+ events/day and led zero-downtime migrations -- problems that seem relevant to Gridware''s scale.\n\nWould love to connect and hear how you''re thinking about the engineering org.',
     '["New VP Eng perspective on Gridware''s stack", "Fellow engineer -- welcome to Gridware", "Backend infrastructure for grid monitoring"]',
     NULL, 82.0, NULL,
     'New recruit signal -- recently joined as VP Engineering', 'replied',
     v_now - interval '4 days', v_now - interval '3 days', v_now - interval '6 hours');

-- FOLLOWUP SCHEDULES
INSERT INTO followup_schedule (outreach_email_id, followup_number, scheduled_for, status) VALUES
    (v_email1, 1, (v_now - interval '3 days') + interval '3 days', 'sent'),
    (v_email1, 2, (v_now - interval '3 days') + interval '5 days', 'pending'),
    (v_email1, 3, (v_now - interval '3 days') + interval '7 days', 'pending'),
    (v_email5, 1, (v_now - interval '5 days') + interval '3 days', 'sent'),
    (v_email5, 2, (v_now - interval '5 days') + interval '5 days', 'pending'),
    (v_email5, 3, (v_now - interval '5 days') + interval '7 days', 'pending');

-- LINKEDIN SIGNALS
INSERT INTO linkedin_signals (post_url, post_content, author_name, author_linkedin, signal_type, company_id, resolved) VALUES
    ('https://linkedin.com/posts/rahulverma-1', 'We''re 3 engineers building for millions of businesses. If you think in systems and ship fast, DM me. #hiring #foundingEngineer', 'Rahul Verma', 'https://linkedin.com/in/rahulverma-pf', 'hiring_post', v_company_payflow, true),
    ('https://linkedin.com/posts/priyasharma-1', 'Thrilled to announce I''m joining Gridware as VP Engineering! Excited to build the infrastructure that keeps the lights on.', 'Priya Sharma', 'https://linkedin.com/in/priyasharma-gw', 'new_recruit', v_company_gridware, true),
    ('https://linkedin.com/posts/sarahchen-1', 'Just closed our seed round! $4.2M to make AI inference 10x cheaper. Grateful to @YC and @Sequoia for believing in us.', 'Sarah Chen', 'https://linkedin.com/in/sarahchen-nf', 'funding_announce', v_company_neuralforge, true),
    ('https://linkedin.com/posts/lenaweber-1', 'Our Rust-based container runtime does 200x faster startup than Docker. Looking for generalists who want to rewrite how CI/CD works.', 'Lena Weber', 'https://linkedin.com/in/lenaweber-orbital', 'hiring_post', v_company_orbital, true),
    ('https://linkedin.com/posts/unknown-1', 'Excited to share that our team just grew from 10 to 25 in the last quarter! #teamgrowth #startuplife', 'Unknown Founder', NULL, 'expansion', NULL, false);

-- JOB LISTINGS
INSERT INTO job_listings (company_id, title, url, description, location, employment_type, remote_ok, source, posted_at) VALUES
    (v_company_neuralforge, 'Senior Backend Engineer', 'https://neuralforge.ai/careers/sbe', 'Build the infrastructure behind our AI model optimization platform. Python, FastAPI, PostgreSQL required.', 'San Francisco, CA', 'full-time', true, 'wellfound', v_now - interval '5 days'),
    (v_company_neuralforge, 'ML Infrastructure Engineer', 'https://neuralforge.ai/careers/mle', 'Design and build ML training and serving infrastructure. PyTorch, Kubernetes experience preferred.', 'San Francisco, CA', 'full-time', true, 'lever', v_now - interval '5 days'),
    (v_company_gridware, 'Senior Software Engineer - Backend', 'https://gridware.io/careers/sse', 'Work on real-time data pipelines processing billions of events from power grid sensors.', 'Austin, TX', 'full-time', false, 'greenhouse', v_now - interval '15 days'),
    (v_company_payflow, 'Founding Engineer', 'https://payflow.in/careers/fe', 'Join as founding engineer. Build the core platform from scratch. Full stack role.', 'Bangalore, India', 'full-time', false, 'wellfound', v_now - interval '2 days'),
    (v_company_documind, 'Senior Full Stack Engineer', 'https://documind.co/careers/sfs', 'Build enterprise document AI features. React + Python stack.', 'London, UK', 'full-time', true, 'workable', v_now - interval '10 days'),
    (NULL, 'Backend Developer', 'https://example.com/jobs/bd-1', 'FastAPI + PostgreSQL for fintech startup', 'Mumbai, India', 'full-time', true, 'naukri', v_now - interval '3 days'),
    (NULL, 'Software Engineer Intern', 'https://example.com/jobs/intern-1', 'React + Node.js internship opportunity', 'Bangalore, India', 'internship', true, 'internshala', v_now - interval '1 day'),
    (NULL, 'DevOps Engineer', 'https://example.com/jobs/devops-1', 'Kubernetes, Docker, CI/CD for infrastructure company', 'Berlin, Germany', 'full-time', true, 'github', v_now - interval '7 days');

-- ACTIVITY LOGS
INSERT INTO activity_logs (user_id, actor, action, entity_type, entity_id, metadata) VALUES
    (v_user_id, 'adam', 'cv_parsed', 'user_profile', NULL, '{"skills_count": 10, "experience_count": 3}'),
    (v_user_id, 'adam', 'interview_completed', 'user_profile', NULL, '{"turns": 12}'),
    (v_user_id, 'theos', 'company_enriched', 'company', v_company_neuralforge, '{"company_name": "NeuralForge", "hiring_score": 85}'),
    (v_user_id, 'theos', 'company_enriched', 'company', v_company_gridware, '{"company_name": "Gridware", "hiring_score": 72}'),
    (v_user_id, 'theos', 'company_enriched', 'company', v_company_payflow, '{"company_name": "Payflow", "hiring_score": 90}'),
    (v_user_id, 'theos', 'contacts_found', 'company', v_company_payflow, '{"count": 2}'),
    (v_user_id, 'theos', 'signal_detected', 'linkedin_signal', NULL, '{"signal_type": "hiring_post", "author": "Rahul Verma"}'),
    (v_user_id, 'mercury', 'email_generated', 'campaign', v_campaign1, '{"company": "Payflow", "contact_count": 2}'),
    (v_user_id, 'mercury', 'email_sent', 'outreach_email', v_email1, '{"to": "Rahul Verma", "company": "Payflow"}'),
    (v_user_id, 'mercury', 'email_sent', 'outreach_email', v_email2, '{"to": "Anika Das", "company": "Payflow"}'),
    (v_user_id, 'mercury', 'email_opened', 'outreach_email', v_email2, '{"to": "Anika Das"}'),
    (v_user_id, 'mercury', 'email_sent', 'outreach_email', v_email5, '{"to": "Mike Torres", "company": "Gridware"}'),
    (v_user_id, 'mercury', 'email_sent', 'outreach_email', v_email6, '{"to": "Priya Sharma", "company": "Gridware"}'),
    (v_user_id, 'mercury', 'reply_received', 'outreach_email', v_email6, '{"from": "Priya Sharma", "company": "Gridware"}'),
    (v_user_id, 'system', 'followup_scheduled', 'outreach_email', v_email1, '{"followup_number": 1, "days": 3}'),
    (v_user_id, 'theos', 'signal_detected', 'linkedin_signal', NULL, '{"signal_type": "new_recruit", "author": "Priya Sharma"}'),
    (v_user_id, 'theos', 'signal_detected', 'linkedin_signal', NULL, '{"signal_type": "funding_announce", "author": "Sarah Chen"}'),
    (v_user_id, 'mercury', 'email_generated', 'campaign', v_campaign2, '{"company": "NeuralForge", "contact_count": 2}'),
    (v_user_id, 'system', 'daily_limit_check', NULL, NULL, '{"sent_today": 4, "limit": 25}'),
    (v_user_id, 'adam', 'profile_updated', 'user_profile', NULL, '{"fields": ["preferred_roles", "tone_settings"]}');

-- ADAM CONVERSATIONS
INSERT INTO adam_conversations (user_id, role, content) VALUES
    (v_user_id, 'adam', 'Hey Arjun. Before I dive in -- what made you want to do this today? What are you actually hoping to find?'),
    (v_user_id, 'user', 'Honestly, I''m tired of applying through job portals and getting ghosted. I''ve built some really cool stuff but my resume doesn''t tell the full story. I want to find startups where I can actually make an impact.'),
    (v_user_id, 'adam', 'That frustration makes sense -- portals are terrible at showing what someone actually brings to a team. You mentioned building ''really cool stuff.'' Walk me through the thing you''ve built that you''re most proud of. Not the most impressive on paper -- the one that meant the most to you.'),
    (v_user_id, 'user', 'The DataFlow Engine at Zephyr. When I joined, analytics was running on batch jobs that took 4 hours. I redesigned the entire pipeline to process events in real-time. Now it handles a million events a day with exactly-once semantics. It completely changed how the product team made decisions.'),
    (v_user_id, 'adam', 'That''s a significant before/after -- 4 hours to real-time. What specifically about that problem pulled you in? Was it the technical challenge of the distributed system, or more about seeing the product team actually use what you built?'),
    (v_user_id, 'user', 'Both, but if I''m honest, it was seeing the product team actually change how they worked. Before, they''d make decisions based on gut feeling because data was always stale. After, they''d pull up dashboards in meetings and make decisions on the spot. That felt real.');

END $$;
