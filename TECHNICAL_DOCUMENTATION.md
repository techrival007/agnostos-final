# Platform Technical Documentation
## Agentic Engineer Reference — Full System Specification

> **Version:** 1.0.0  
> **Last Updated:** April 2026  
> **Classification:** Internal Engineering  
> **Purpose:** End-to-end technical specification for building the hidden job market automation platform powered by three AI agents — Adam, Theos, and Mercury.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Core Philosophy & Architecture](#2-core-philosophy--architecture)
3. [Tech Stack](#3-tech-stack)
4. [Database Schema](#4-database-schema)
5. [Agent: Adam](#5-agent-adam)
6. [Agent: Theos](#6-agent-theos)
7. [Agent: Mercury](#7-agent-mercury)
8. [Inter-Agent Communication](#8-inter-agent-communication)
9. [Email Infrastructure](#9-email-infrastructure)
10. [Semantic Matching Layer](#10-semantic-matching-layer)
11. [Dashboard & Frontend](#11-dashboard--frontend)
12. [Rate Limiting & Safety](#12-rate-limiting--safety)
13. [Deployment Architecture](#13-deployment-architecture)
14. [Build Order & Milestones](#14-build-order--milestones)
15. [API Reference](#15-api-reference)
16. [Environment Variables](#16-environment-variables)

---

## 1. System Overview

This platform is an **outbound-first, hidden job market automation system**. It bypasses public job listings entirely by identifying the right decision-makers at recently-funded companies, researching them deeply, and sending highly personalized cold outreach on behalf of the user — automatically, at scale, with human-in-the-loop control at every critical stage.

### The Three Agents

| Agent | Role | Knows About |
|-------|------|-------------|
| **Adam** | User intelligence & knowledge base | The user — their story, skills, projects, ambitions |
| **Theos** | External intelligence & enrichment | The outside world — companies, people, signals |
| **Mercury** | Outreach & communication | Receives from both Adam + Theos, speaks for the user |

### Core User Journey

```
User onboards → Adam builds their profile via CV + voice interview
     ↓
Theos discovers relevant companies, finds contacts, enriches with research
     ↓
Theos packages a Company Brief → hands to Mercury
     ↓
Mercury generates personalized emails per contact
     ↓
User reviews in dashboard → approves → Mercury sends
     ↓
Mercury tracks opens, replies, schedules smart follow-ups (Day 0, 3, 5, 7)
     ↓
Dashboard shows full pipeline: Sent → Opened → Replied → Call → Offer
```

---

## 2. Core Philosophy & Architecture

### Architecture Pattern

- **Frontend:** Next.js (Vercel)
- **Backend:** FastAPI (Python) on Railway
- **Agent Jobs:** Celery + Redis (async task queue)
- **Database:** PostgreSQL via Supabase + pgvector extension
- **AI:** Claude API (Anthropic) as primary LLM
- **Voice:** Deepgram STT + TTS for Adam's interview
- **Scraping:** Proxycurl (LinkedIn), Apify (job boards, LinkedIn posts)
- **Email finding:** Apollo.io, ContactOut, Wiza (fallback chain)
- **Email sending:** Nylas (Gmail + Outlook OAuth abstraction)

### Agent Separation Principle

Agents are **strictly separated** by domain. They communicate only through structured data contracts (the Company Brief). No agent reaches into another's domain.

```
Adam    → owns: user_profiles, adam_conversations
Theos   → owns: companies, contacts, company_research, linkedin_signals, job_listings
Mercury → owns: campaigns, outreach_emails, followup_schedule
```

---

## 3. Tech Stack

### Frontend

```
Framework:        Next.js 14 (App Router)
Styling:          Tailwind CSS
Components:       Shadcn/ui
State:            Zustand (client), TanStack Query (server)
Auth UI:          Clerk
Voice (Adam UI):  Web Audio API + Deepgram WebSocket SDK
Real-time:        Supabase Realtime (for pipeline updates)
```

### Backend

```
Language:         Python 3.11+
Framework:        FastAPI (async)
Task Queue:       Celery 5.x
Message Broker:   Redis (Upstash)
ORM:              SQLAlchemy 2.0 (async) + Alembic migrations
Validation:       Pydantic v2
```

### AI & Voice

```
Primary LLM:      Claude claude-sonnet-4-20250514 (Anthropic)
Embeddings:       OpenAI text-embedding-3-small (1536 dims) or Cohere
Vector Store:     pgvector (on Supabase Postgres)
STT:              Deepgram Nova-3 (streaming, via WebSocket)
TTS:              Deepgram Aura-2 (voice synthesis for Adam responses)
```

### Data & Enrichment

```
LinkedIn data:    Proxycurl API
Email finding:    Apollo.io → ContactOut → Wiza (waterfall)
Scraping infra:   Apify (managed proxies, headless browser)
News/signals:     NewsAPI, Google News RSS, Apify LinkedIn scraper
Company data:     Crunchbase API, YC batch CSVs, Inc42 scrape
```

### Infrastructure

```
Frontend host:    Vercel
Backend host:     Railway (FastAPI + Celery workers as separate services)
Database:         Supabase (PostgreSQL + pgvector + Realtime)
Cache/Queue:      Upstash Redis
File storage:     Cloudflare R2 (CVs, resumes, attachments)
Auth:             Clerk
Email sending:    Nylas (Gmail + Outlook OAuth)
Monitoring:       Sentry (errors), Posthog (analytics)
```

---

## 4. Database Schema

Run all migrations via Alembic. Full schema below.

```sql
-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  nylas_grant_id  TEXT,          -- connected email account
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADAM — USER KNOWLEDGE BASE
-- ============================================================
CREATE TABLE user_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Raw inputs
  raw_cv_text           TEXT,
  raw_linkedin_text     TEXT,
  cv_file_url           TEXT,       -- R2 storage URL
  
  -- Structured parsed data (Claude extraction)
  parsed_skills         JSONB,      -- { technical: [], soft: [] }
  parsed_experience     JSONB,      -- [{ company, role, duration, description }]
  parsed_projects       JSONB,      -- [{ name, description, tech[], url }]
  parsed_education      JSONB,
  
  -- Proof points (high-value extracted moments)
  proof_points          JSONB,      -- [{ project, problem, impact, tech[], context }]
  
  -- Soft profile (from Adam interview)
  soft_profile          JSONB,      -- { tone, personality, communication_style, ambitions }
  what_they_bring       TEXT,       -- 2-3 line sharp summary Mercury uses as anchor
  
  -- Preferences
  preferred_roles       TEXT[],
  preferred_stages      TEXT[],     -- ['pre-seed', 'seed', 'series-a']
  preferred_sectors     TEXT[],
  location              TEXT,
  open_to_relocation    BOOLEAN DEFAULT FALSE,
  visa_status           TEXT,
  
  -- Tone settings (default, user can override per campaign)
  tone_formal           INT DEFAULT 5,    -- 1=casual, 10=formal
  tone_technical        INT DEFAULT 5,    -- 1=story, 10=technical
  
  -- Semantic embedding of full profile
  embedding             VECTOR(1536),
  
  interview_completed   BOOLEAN DEFAULT FALSE,
  interview_turns       INT DEFAULT 0,
  
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Adam conversation history
CREATE TABLE adam_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('adam', 'user')),
  content     TEXT NOT NULL,
  audio_url   TEXT,          -- R2 URL of the audio if voice turn
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- THEOS — COMPANIES
-- ============================================================
CREATE TABLE companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  website             TEXT,
  linkedin_url        TEXT,
  
  -- Funding data
  stage               TEXT,          -- 'pre-seed','seed','series-a','series-b'
  funding_amount_usd  BIGINT,
  funding_date        DATE,
  investors           TEXT[],
  
  -- Company data
  sector              TEXT[],
  hq_location         TEXT,
  headcount           INT,
  headcount_updated   DATE,
  tech_stack          TEXT[],
  
  -- Scoring
  hiring_score        INT DEFAULT 0,
  hiring_score_updated TIMESTAMPTZ,
  
  -- Research
  last_researched_at  TIMESTAMPTZ,
  research_summary    TEXT,          -- Claude-written 150-word brief
  
  -- Embedding for semantic match against user profile
  embedding           VECTOR(1536),
  
  -- Source tracking
  source              TEXT CHECK (source IN (
                        'yc', 'ef', 'inc42', 'tracxn', 'crunchbase',
                        'linkedin_signal', 'wellfound', 'manual'
                      )),
  source_batch        TEXT,          -- e.g. 'YC W25'
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Deep company research (Theos populates this)
CREATE TABLE company_research (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  recent_news     JSONB,     -- [{ headline, url, date, summary }]
  blog_posts      JSONB,     -- [{ title, url, date, summary }]
  founder_posts   JSONB,     -- [{ author, content, url, date }]
  product_updates JSONB,     -- [{ title, date, summary }]
  job_postings    JSONB,     -- [{ title, url, department, date }]
  
  scraped_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id)
);

-- ============================================================
-- THEOS — CONTACTS
-- ============================================================
CREATE TABLE contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  name                    TEXT NOT NULL,
  role                    TEXT,
  seniority               TEXT,   -- 'cxo','director','manager','senior','mid'
  
  linkedin_url            TEXT UNIQUE,
  linkedin_data           JSONB,  -- raw Proxycurl response
  
  professional_email      TEXT,
  personal_email          TEXT,
  email_confidence_score  FLOAT,  -- 0.0 to 1.0
  email_source            TEXT,   -- 'apollo','contactout','wiza'
  
  -- Flags
  is_new_recruit          BOOLEAN DEFAULT FALSE,
  tenure_months           INT,
  is_founder              BOOLEAN DEFAULT FALSE,
  
  -- Recent LinkedIn activity
  recent_posts            JSONB,  -- [{ content, date, url }]
  
  last_enriched_at        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LINKEDIN SIGNALS
-- ============================================================
CREATE TABLE linkedin_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_url        TEXT UNIQUE,
  post_content    TEXT,
  author_name     TEXT,
  author_linkedin TEXT,
  
  signal_type     TEXT CHECK (signal_type IN (
                    'hiring_post', 'new_recruit', 'funding_announce',
                    'expansion', 'team_growth'
                  )),
  
  company_id      UUID REFERENCES companies(id),   -- nullable, resolved async
  resolved        BOOLEAN DEFAULT FALSE,
  
  detected_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOB BOARD LISTINGS (Browse & Apply section)
-- ============================================================
CREATE TABLE job_listings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID REFERENCES companies(id),
  
  title                 TEXT NOT NULL,
  url                   TEXT UNIQUE NOT NULL,
  description           TEXT,
  
  location              TEXT,
  employment_type       TEXT,   -- 'full-time','part-time','internship','contract'
  experience_required   TEXT,
  remote_ok             BOOLEAN,
  
  source                TEXT CHECK (source IN (
                          'wellfound', 'lever', 'naukri', 'internshala',
                          'cutshort', 'github', 'greenhouse', 'workable'
                        )),
  
  posted_at             TIMESTAMPTZ,
  scraped_at            TIMESTAMPTZ DEFAULT NOW(),
  is_active             BOOLEAN DEFAULT TRUE,
  
  -- Relevance to user (computed per user, stored in separate table)
  UNIQUE(url)
);

-- Per-user relevance scores for job listings
CREATE TABLE job_listing_relevance (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  job_listing_id  UUID REFERENCES job_listings(id) ON DELETE CASCADE,
  relevance_score FLOAT,
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, job_listing_id)
);

-- ============================================================
-- MERCURY — CAMPAIGNS & OUTREACH
-- ============================================================
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  status          TEXT CHECK (status IN (
                    'queued','active','paused','completed','dormant'
                  )) DEFAULT 'queued',
  
  -- User tone overrides for this campaign
  tone_settings   JSONB,   -- { formal: 1-10, technical: 1-10 }
  
  -- Suppression
  suppressed_until TIMESTAMPTZ,   -- for dormant/rejected companies
  suppress_reason  TEXT,
  
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  
  UNIQUE(user_id, company_id)
);

CREATE TABLE outreach_emails (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id        UUID REFERENCES contacts(id) ON DELETE CASCADE,
  
  subject           TEXT,
  body              TEXT,
  subject_options   JSONB,   -- all 3 subject line options Claude generated
  
  -- Generation metadata
  tone_settings     JSONB,
  relevance_score   FLOAT,   -- 0-100, how well user maps to this company
  relevant_projects JSONB,   -- which proof points were chosen and why
  hook_used         TEXT,    -- which company signal was used to open
  
  -- Status tracking
  status            TEXT CHECK (status IN (
                      'draft','approved','sent','opened',
                      'replied','bounced','skipped'
                    )) DEFAULT 'draft',
  
  followup_number   INT DEFAULT 0,   -- 0=initial, 1/2/3=followups
  parent_email_id   UUID REFERENCES outreach_emails(id),  -- for followups
  
  -- Sending metadata
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  replied_at        TIMESTAMPTZ,
  thread_id         TEXT,    -- Gmail/Outlook thread ID (from Nylas)
  message_id        TEXT,    -- Nylas message ID
  
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE followup_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outreach_email_id   UUID REFERENCES outreach_emails(id) ON DELETE CASCADE,
  
  followup_number     INT NOT NULL,   -- 1, 2, or 3
  scheduled_for       TIMESTAMPTZ NOT NULL,
  
  status              TEXT CHECK (status IN (
                        'pending','sent','cancelled','skipped'
                      )) DEFAULT 'pending',
  
  -- Smart followup: new signal found since last email
  new_signal_found    BOOLEAN DEFAULT FALSE,
  new_signal_content  TEXT,
  override_body       TEXT,   -- if smart followup rewrote the body
  
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  
  actor         TEXT CHECK (actor IN ('adam', 'theos', 'mercury', 'user', 'system')),
  action        TEXT NOT NULL,   -- e.g. 'email_sent', 'company_enriched', 'reply_received'
  
  entity_type   TEXT,            -- 'company', 'contact', 'campaign', 'email'
  entity_id     UUID,
  
  metadata      JSONB,           -- any extra context
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_companies_hiring_score ON companies(hiring_score DESC);
CREATE INDEX idx_companies_funding_date ON companies(funding_date DESC);
CREATE INDEX idx_companies_embedding ON companies USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_user_profiles_embedding ON user_profiles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_outreach_emails_campaign ON outreach_emails(campaign_id);
CREATE INDEX idx_outreach_emails_thread ON outreach_emails(thread_id);
CREATE INDEX idx_followup_schedule_status ON followup_schedule(status, scheduled_for);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
```

---

## 5. Agent: Adam

### Overview

Adam is the user-facing intelligence agent. Its sole purpose is building the richest possible understanding of the user so Mercury can speak for them authentically. Adam never does research on the outside world — it only knows the user.

Adam has two interfaces:
1. **Voice Interview** — 15-20 turn AI conversation using Deepgram STT + TTS
2. **Text Chat** — ongoing, available anytime in dashboard

### 5.1 CV + LinkedIn Parsing Pipeline

```python
# services/adam/parser.py
import fitz  # PyMuPDF
import anthropic
import json

async def parse_user_documents(
    user_id: str,
    cv_file_bytes: bytes,
    linkedin_export_json: dict | None = None
) -> dict:
    
    # Step 1: Extract raw text from CV
    cv_text = extract_pdf_text(cv_file_bytes)
    linkedin_text = flatten_linkedin_export(linkedin_export_json) if linkedin_export_json else ""
    
    # Step 2: Structured extraction via Claude
    client = anthropic.Anthropic()
    
    extraction_prompt = f"""
    You are parsing a CV and LinkedIn profile to extract structured data.
    Return ONLY valid JSON — no explanation, no markdown.
    
    Extract the following structure exactly:
    {{
      "skills": {{
        "technical": ["list of technical skills"],
        "soft": ["list of soft skills"]
      }},
      "experience": [
        {{
          "company": "company name",
          "role": "job title",
          "duration_months": 12,
          "start_date": "YYYY-MM",
          "end_date": "YYYY-MM or present",
          "description": "what they did",
          "tech_used": ["list"]
        }}
      ],
      "projects": [
        {{
          "name": "project name",
          "description": "what it does",
          "tech": ["list"],
          "url": "if available",
          "context": "built at company / side project / hackathon"
        }}
      ],
      "education": [
        {{
          "institution": "",
          "degree": "",
          "field": "",
          "year": ""
        }}
      ],
      "certifications": ["list"],
      "location": "city, country",
      "open_to_relocation": true/false
    }}
    
    CV TEXT:
    {cv_text}
    
    LINKEDIN DATA:
    {linkedin_text}
    """
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": extraction_prompt}]
    )
    
    structured = json.loads(response.content[0].text)
    
    # Step 3: Extract proof points separately (high-value extraction)
    proof_points = await extract_proof_points(client, structured, cv_text)
    
    # Step 4: Generate embedding of full profile
    profile_text = build_profile_text(structured, proof_points)
    embedding = await generate_embedding(profile_text)
    
    # Step 5: Generate "what they bring" summary
    what_they_bring = await generate_summary(client, structured, proof_points)
    
    # Step 6: Upsert to DB
    await db.user_profiles.upsert(user_id, {
        "raw_cv_text": cv_text,
        "parsed_skills": structured["skills"],
        "parsed_experience": structured["experience"],
        "parsed_projects": structured["projects"],
        "parsed_education": structured["education"],
        "proof_points": proof_points,
        "what_they_bring": what_they_bring,
        "embedding": embedding
    })
    
    return structured


async def extract_proof_points(client, structured: dict, cv_text: str) -> list:
    """
    Proof points are the high-signal moments from a user's career.
    Format: what was built + what problem it solved + measurable impact + tech used.
    """
    prompt = f"""
    From this structured career data and raw CV, extract 5-8 "proof points".
    
    A proof point is NOT a job description. It is a specific, concrete moment where 
    this person built something, solved a real problem, and had a measurable impact.
    
    Return ONLY valid JSON array:
    [
      {{
        "title": "short name for this proof point",
        "project": "what they built",
        "problem": "what problem it solved",
        "impact": "measurable outcome if available, else qualitative",
        "tech": ["technologies used"],
        "context": "startup / internship / side project / academic",
        "highlight": true/false  // is this one of their best 2-3?
      }}
    ]
    
    Career data: {json.dumps(structured)}
    Raw CV: {cv_text[:3000]}
    """
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return json.loads(response.content[0].text)
```

### 5.2 The Adam Interview — Voice Flow

Adam's interview uses **Deepgram for both STT and TTS**, streamed over WebSocket. The frontend captures mic audio → streams to Deepgram → gets transcript → sends to Adam (Claude) → gets response text → Deepgram TTS reads it back.

#### Frontend WebSocket Flow

```typescript
// hooks/useAdamInterview.ts
import { createClient } from "@deepgram/sdk";

export function useAdamInterview(userId: string) {
  const deepgramRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [transcript, setTranscript] = useState("");
  const [adamSpeaking, setAdamSpeaking] = useState(false);
  const [turn, setTurn] = useState<"user" | "adam">("adam");

  // Start recording user's voice
  const startListening = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });

    // Connect to Deepgram STT via WebSocket
    const dgSocket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-3&language=en-IN&smart_format=true`,
      ["token", process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY!]
    );

    dgSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcriptChunk =
        data.channel?.alternatives?.[0]?.transcript || "";
      if (transcriptChunk && data.is_final) {
        setTranscript((prev) => prev + " " + transcriptChunk);
      }
    };

    mediaRecorder.ondataavailable = (event) => {
      if (dgSocket.readyState === WebSocket.OPEN) {
        dgSocket.send(event.data);
      }
    };

    mediaRecorder.start(250); // chunk every 250ms
    mediaRecorderRef.current = mediaRecorder;
    deepgramRef.current = dgSocket;
  };

  // User done speaking — send to Adam
  const stopListeningAndSend = async () => {
    mediaRecorderRef.current?.stop();
    deepgramRef.current?.close();

    if (!transcript.trim()) return;

    // Send transcript to Adam API
    const response = await fetch("/api/adam/chat", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, message: transcript }),
    });

    const { reply } = await response.json();

    // Adam speaks back via Deepgram TTS
    await speakAdamResponse(reply);
    setTranscript("");
  };

  // Adam speaks the response
  const speakAdamResponse = async (text: string) => {
    setAdamSpeaking(true);

    const response = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-2-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      setAdamSpeaking(false);
      setTurn("user");
    };

    audio.play();
  };

  return { startListening, stopListeningAndSend, transcript, adamSpeaking, turn };
}
```

#### Backend Adam Chat Endpoint

```python
# routers/adam.py
from fastapi import APIRouter, Depends
from anthropic import Anthropic

router = APIRouter(prefix="/api/adam")
client = Anthropic()

ADAM_SYSTEM_PROMPT = """
You are Adam. You are a warm, deeply curious AI whose only purpose is to 
understand this person so you can help them present their absolute best self 
to the world.

You already have their CV and LinkedIn data. Do NOT ask about things already 
there. Dig beneath the surface.

You are NOT an interviewer. You are a smart, caring friend who asks one 
thoughtful question at a time and genuinely listens. You follow up when 
something interesting comes up. You never judge.

Your goal across 15-20 turns is to understand:
- The story BEHIND their best work (why they built it, what it taught them)
- What kind of problems light them up vs drain them
- What they're genuinely proud of that their CV undersells
- What they want next, and the real reason why
- What makes them different from 100 others with the same skills
- Their communication personality (how they naturally talk, their humor, tone)

Rules:
- ONE question per turn. Never two.
- Keep your responses under 3 sentences + the question.
- If they say something interesting, explore it before moving on.
- Do NOT use corporate language. Talk like a smart human.
- Never say "Great answer!" or "That's fascinating!" — just respond naturally.
- If they give a short answer, gently push: "Say more about that."
- After turn 15, you can start wrapping up if you have enough.

The profile you have so far about them will be injected below.
"""

ADAM_STARTER_QUESTIONS = [
    "Before I dive in — what made you want to do this today? What are you actually hoping to find?",
    "Walk me through the thing you've built that you're most proud of. Not the most impressive on paper — the one that meant the most to you.",
    "What kind of work makes you completely lose track of time?",
]

@router.post("/chat")
async def adam_chat(user_id: str, message: str):
    # Pull conversation history
    history = await db.adam_conversations.get_all(user_id)
    profile = await db.user_profiles.get(user_id)
    
    # Build messages array
    messages = []
    for turn in history:
        messages.append({
            "role": "user" if turn.role == "user" else "assistant",
            "content": turn.content
        })
    messages.append({"role": "user", "content": message})
    
    # If first message, Adam starts with a warm opener
    if len(history) == 0:
        messages = [{"role": "user", "content": "__START_INTERVIEW__"}]
    
    system = ADAM_SYSTEM_PROMPT + f"""
    
    --- WHAT YOU KNOW ABOUT THEM SO FAR ---
    Skills: {profile.parsed_skills}
    Experience: {profile.parsed_experience}
    Projects: {profile.parsed_projects}
    Proof points extracted: {profile.proof_points}
    Interview turns completed: {len(history) // 2}
    ---
    """
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        system=system,
        messages=messages
    )
    
    reply = response.content[0].text
    
    # Save both turns to DB
    await db.adam_conversations.append_many(user_id, [
        {"role": "user", "content": message},
        {"role": "adam", "content": reply}
    ])
    
    # Every 5 turns, update soft profile
    if len(history) % 10 == 0 and len(history) > 0:
        update_soft_profile.delay(user_id)
    
    return {"reply": reply, "turn_number": len(history) // 2 + 1}


@celery.task
def update_soft_profile(user_id: str):
    """Synthesize Adam conversations into structured soft profile."""
    history = db.adam_conversations.get_all(user_id)
    
    prompt = f"""
    Based on this Adam interview transcript, extract a structured soft profile.
    Return ONLY valid JSON:
    {{
      "personality": "2-sentence description of their personality",
      "communication_style": "formal/casual/technical/storytelling",
      "core_motivations": ["list of what drives them"],
      "ambitions": {{
        "short_term": "what they want in next 12 months",
        "long_term": "where they see themselves in 5 years"
      }},
      "proud_of": ["top things they're proud of that CV undersells"],
      "differentiators": ["what makes them genuinely different"],
      "preferred_environment": "startup/scale-up/corporate/remote/in-person",
      "adam_summary": "3-sentence human summary Adam would write about them"
    }}
    
    Transcript:
    {format_transcript(history)}
    """
    
    result = claude_extract(prompt)
    db.user_profiles.update(user_id, {"soft_profile": result})
```

---

## 6. Agent: Theos

### Overview

Theos is the external intelligence engine. It runs entirely in the background via Celery workers. It never interacts directly with the user — it feeds the dashboard and Mercury.

Theos has three discovery modes and one enrichment pipeline. All are Celery task chains.

### 6.1 Funded Company Dataset Ingestion

```python
# tasks/theos/discovery.py

@celery.task
def ingest_yc_batch(batch: str = "W25"):
    """
    Scrape YC company list for a given batch.
    YC provides structured data at ycombinator.com/companies.
    Use Apify actor for this.
    """
    companies = apify.run_actor("yc-company-scraper", {
        "batch": batch,
        "fields": ["name", "website", "description", "linkedin", "founders"]
    })
    
    for company in companies:
        # Chain: enrich → contacts → emails → research → score
        pipeline = chain(
            enrich_company.s(company),
            find_contacts.s(),
            get_emails.s(),
            research_company.s(),
            score_company.s(),
            notify_relevant_users.s()   # check all users for match
        )
        pipeline.apply_async()
    
    log_activity("system", "theos", "yc_batch_ingested", metadata={"batch": batch, "count": len(companies)})


@celery.task
def ingest_inc42_funded():
    """
    Scrape Inc42 funded startups for India-based companies.
    Runs weekly. Uses Playwright via Apify.
    """
    companies = apify.run_actor("inc42-funding-scraper", {
        "max_results": 200,
        "days_back": 90
    })
    
    for company in companies:
        enrich_and_pipeline.delay(company, source="inc42")
```

### 6.2 Enrichment Pipeline

```python
# tasks/theos/enrichment.py

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def enrich_company(self, raw_company: dict) -> str:
    """
    Enrich company data via Proxycurl.
    Returns company_id.
    """
    try:
        proxycurl_data = proxycurl.company_profile(
            url=raw_company.get("linkedin_url"),
            fallback_to_cache="on-error",
            use_cache="if-present"
        )
        
        company_id = db.companies.upsert({
            "name": raw_company["name"],
            "website": raw_company.get("website"),
            "linkedin_url": raw_company.get("linkedin_url"),
            "headcount": proxycurl_data.get("company_size_on_linkedin"),
            "hq_location": proxycurl_data.get("hq"),
            "funding_amount_usd": raw_company.get("funding_amount"),
            "funding_date": raw_company.get("funding_date"),
            "stage": raw_company.get("stage"),
            "investors": raw_company.get("investors", []),
            "source": raw_company.get("source", "manual")
        })
        
        return company_id
        
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task
def find_contacts(company_id: str) -> list[str]:
    """
    Find relevant people at the company via Proxycurl employee search.
    Target: CXO, founders, directors, senior engineers, product leads.
    Exclude: HR, recruiters, interns.
    """
    company = db.companies.get(company_id)
    
    employees = proxycurl.employee_search(
        linkedin_company_profile_url=company.linkedin_url,
        page_size=25,
        enrich_profiles="enrich"   # get full profile data in one call
    )
    
    contact_ids = []
    
    INCLUDE_SENIORITIES = {"c_suite", "director", "vp", "manager", "senior", "entry"}
    EXCLUDE_ROLES = {"recruiter", "talent", "hr ", "human resources", "intern"}
    
    for emp in employees:
        role_lower = emp.get("title", "").lower()
        
        # Skip excluded roles
        if any(excl in role_lower for excl in EXCLUDE_ROLES):
            continue
        
        # Calculate tenure
        tenure_months = calculate_tenure(emp.get("experiences", []))
        is_new_recruit = tenure_months is not None and tenure_months < 6
        is_founder = any(
            keyword in role_lower 
            for keyword in ["founder", "co-founder", "ceo", "cto", "coo"]
        )
        
        contact_id = db.contacts.upsert({
            "company_id": company_id,
            "name": emp.get("full_name"),
            "role": emp.get("title"),
            "linkedin_url": emp.get("profile_url"),
            "linkedin_data": emp,
            "tenure_months": tenure_months,
            "is_new_recruit": is_new_recruit,
            "is_founder": is_founder,
            "recent_posts": emp.get("activities", [])[:5]
        })
        
        contact_ids.append(contact_id)
    
    return contact_ids


@celery.task
def get_emails(contact_ids: list[str]) -> list[str]:
    """
    Waterfall email finding: Apollo → ContactOut → Wiza.
    Only stores email if confidence > 0.7.
    """
    enriched = []
    
    for contact_id in contact_ids:
        contact = db.contacts.get(contact_id)
        email_data = None
        
        # Try Apollo first
        try:
            apollo_result = apollo.people_search(
                linkedin_url=contact.linkedin_url,
                reveal_personal_emails=True
            )
            if apollo_result and apollo_result.get("email_status") == "verified":
                email_data = {
                    "professional_email": apollo_result.get("email"),
                    "personal_email": apollo_result.get("personal_emails", [None])[0],
                    "confidence": 0.95,
                    "source": "apollo"
                }
        except Exception:
            pass
        
        # Fallback: ContactOut
        if not email_data:
            try:
                co_result = contactout.find(linkedin_url=contact.linkedin_url)
                if co_result.get("confidence", 0) > 0.7:
                    email_data = {
                        "professional_email": co_result.get("work_email"),
                        "personal_email": co_result.get("personal_email"),
                        "confidence": co_result["confidence"],
                        "source": "contactout"
                    }
            except Exception:
                pass
        
        # Fallback: Wiza
        if not email_data:
            try:
                wiza_result = wiza.find(linkedin_url=contact.linkedin_url)
                if wiza_result:
                    email_data = {
                        "professional_email": wiza_result.get("email"),
                        "confidence": 0.75,
                        "source": "wiza"
                    }
            except Exception:
                pass
        
        if email_data and email_data["confidence"] > 0.7:
            db.contacts.update_email(contact_id, email_data)
            enriched.append(contact_id)
    
    return enriched


@celery.task
def research_company(company_id: str) -> str:
    """
    Deep company research. Gathers all signals Theos can find.
    Summarized via Claude. Stored in company_research table.
    """
    company = db.companies.get(company_id)
    
    # Parallel fetch
    news = fetch_news(company.name, days_back=30)            # NewsAPI
    blog_posts = scrape_company_blog(company.website)        # Playwright
    founder_posts = get_founder_linkedin_posts(company_id)   # Proxycurl activities
    product_updates = scrape_changelog(company.website)      # Playwright
    job_postings = scrape_job_postings(company.website)      # Playwright + Apify
    
    research_data = {
        "news": news[:5],
        "blog_posts": blog_posts[:5],
        "founder_posts": founder_posts[:10],
        "product_updates": product_updates[:5],
        "job_postings": job_postings[:10]
    }
    
    # Summarize via Claude
    summary = claude_summarize(f"""
    Summarize what this company is currently working on, what problems 
    they're solving, and what signals suggest they may be hiring or 
    expanding. Max 150 words. Be specific.
    
    Company: {company.name}
    Data: {json.dumps(research_data)}
    """)
    
    # Embed the summary for semantic matching
    embedding = generate_embedding(
        company.name + " " + (company.research_summary or "") + " " + 
        " ".join([p["title"] for p in job_postings])
    )
    
    db.company_research.upsert(company_id, {**research_data, "summary": summary})
    db.companies.update(company_id, {
        "research_summary": summary,
        "embedding": embedding,
        "last_researched_at": now()
    })
    
    return company_id


@celery.task
def score_company(company_id: str) -> str:
    """
    Calculate and store the Active Hiring Score (0-100).
    """
    company = db.companies.get(company_id)
    research = db.company_research.get(company_id)
    
    score = 0
    days_since_funded = (date.today() - company.funding_date).days if company.funding_date else 999
    
    # Funding recency (max 40 pts)
    if days_since_funded < 30:    score += 40
    elif days_since_funded < 90:  score += 30
    elif days_since_funded < 180: score += 15
    
    # Active job postings (max 20 pts)
    job_count = len(research.job_postings or [])
    score += min(job_count * 5, 20)
    
    # Founder activity (max 15 pts)
    recent_posts = len([
        p for p in (research.founder_posts or [])
        if days_since(p.get("date")) < 30
    ])
    score += min(recent_posts * 3, 15)
    
    # Headcount growth (max 15 pts)
    if company.headcount_growth_pct and company.headcount_growth_pct > 0.15:
        score += 15
    elif company.headcount_growth_pct and company.headcount_growth_pct > 0.05:
        score += 8
    
    # New recruit signals (max 10 pts)
    new_recruits = db.contacts.count_new_recruits(company_id)
    score += min(new_recruits * 2, 10)
    
    db.companies.update(company_id, {
        "hiring_score": score,
        "hiring_score_updated": now()
    })
    
    return company_id


@celery.task
def notify_relevant_users(company_id: str):
    """
    After a company is fully enriched, check all users to see if it's 
    a semantic match. If yes, create a campaign and notify them.
    """
    company = db.companies.get(company_id)
    company_embedding = company.embedding
    
    # Find all users whose profile embedding is close to this company
    matched_users = db.user_profiles.find_similar(
        embedding=company_embedding,
        threshold=0.65,    # cosine similarity threshold
        limit=50
    )
    
    for user_profile in matched_users:
        # Don't duplicate campaigns
        if db.campaigns.exists(user_profile.user_id, company_id):
            continue
        
        # Create campaign in 'queued' state
        campaign_id = db.campaigns.insert(user_profile.user_id, company_id)
        
        # Queue Mercury to generate draft emails
        contacts = db.contacts.get_for_campaign(company_id)
        for contact in contacts:
            if contact.professional_email or contact.personal_email:
                generate_email.delay(user_profile.user_id, contact.id, campaign_id)
        
        # Push notification to user
        push_to_user.delay(
            user_profile.user_id,
            f"Found {len(contacts)} people at {company.name} worth reaching out to (Score: {company.hiring_score})"
        )
```

### 6.3 LinkedIn Signal Scraper

```python
# tasks/theos/signals.py

@celery.task
@periodic_task(run_every=crontab(hour="*/6"))   # every 6 hours
def scrape_linkedin_hiring_signals():
    """
    Scan LinkedIn for hiring signals.
    Uses Apify's LinkedIn post scraper.
    """
    SIGNAL_KEYWORDS = [
        "#hiring", "#wearehiring", "#joinus", "#opentowork",
        "we are hiring", "looking for", "join our team",
        "excited to join", "thrilled to announce I'm joining",   # new recruit signals
        "Series A", "Series B", "seed round", "just closed"     # funding signals
    ]
    
    for keyword in SIGNAL_KEYWORDS:
        posts = apify.run_actor("linkedin-post-scraper", {
            "query": keyword,
            "geo": "India",
            "datePosted": "past-week",
            "max_results": 50
        })
        
        for post in posts:
            # Classify signal type via Claude (fast, cheap call)
            signal_type = classify_signal_type(post["text"])
            
            if signal_type == "irrelevant":
                continue
            
            signal_id = db.linkedin_signals.upsert({
                "post_url": post["url"],
                "post_content": post["text"],
                "author_name": post["author"]["name"],
                "author_linkedin": post["author"]["profile_url"],
                "signal_type": signal_type,
                "detected_at": now()
            })
            
            # Async: try to resolve which company this is about
            resolve_signal_company.delay(signal_id)


def classify_signal_type(post_text: str) -> str:
    """Quick Claude classification. Returns signal type string."""
    response = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",   # use Haiku for cheap classification
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": f"""Classify this LinkedIn post into ONE of these categories:
            hiring_post / new_recruit / funding_announce / expansion / irrelevant
            
            Post: {post_text[:500]}
            
            Return ONLY the category word, nothing else."""
        }]
    )
    return response.content[0].text.strip()


@celery.task
def resolve_signal_company(signal_id: str):
    """
    Try to identify which company a LinkedIn signal is about.
    Update signal with company_id if found.
    """
    signal = db.linkedin_signals.get(signal_id)
    
    # Ask Claude to extract company name from post
    company_name = claude_extract_company(signal.post_content)
    
    if company_name:
        # Try to match to existing company in DB
        company = db.companies.find_by_name(company_name)
        
        if company:
            db.linkedin_signals.update(signal_id, {
                "company_id": company.id,
                "resolved": True
            })
        else:
            # New company — create stub and kick off enrichment pipeline
            company_id = db.companies.insert({
                "name": company_name,
                "source": "linkedin_signal"
            })
            db.linkedin_signals.update(signal_id, {"company_id": company_id, "resolved": True})
            enrich_company.delay({"name": company_name, "source": "linkedin_signal"})
```

---

## 7. Agent: Mercury

### Overview

Mercury is the outreach engine. It receives the Company Brief from Theos and the User Profile from Adam (via DB), generates personalized emails, manages the send queue, and handles the full follow-up lifecycle.

Mercury **never speaks without the user approving first** — all emails go to `draft` status and appear in the preview UI before any sending happens.

### 7.1 Email Generation

```python
# tasks/mercury/generator.py

MERCURY_SYSTEM_PROMPT = """
You are Mercury, a precision email writer. You write cold outreach emails 
on behalf of talented people trying to find opportunities at great companies.

Your emails must:
- Sound like they were written by a thoughtful human, not generated
- Open with something SPECIFIC about the company (recent news, what they're building, 
  a founder post) — never generic praise
- Connect 1-2 of the sender's concrete proof points to what the company is doing
- Have one clear, low-friction ask at the end
- Be under 150 words. Every sentence must earn its place.
- Never use: "I hope this finds you well", "I am writing to express my interest",
  "I came across your profile", "I would love to", "Please feel free to"
- Sound like a confident, curious human who did their homework

You will generate the email body AND 3 subject line options.
Return ONLY valid JSON in this exact format:
{
  "subject_lines": ["option 1", "option 2", "option 3"],
  "body": "the email body",
  "reasoning": "1 sentence on why you chose this angle"
}
"""

async def generate_email(
    user_id: str,
    contact_id: str,
    campaign_id: str
) -> str:
    """
    Generate a personalized draft email.
    Returns outreach_email_id.
    """
    # Pull all context
    user_profile = await db.user_profiles.get(user_id)
    contact = await db.contacts.get(contact_id)
    company = await db.companies.get(contact.company_id)
    research = await db.company_research.get(contact.company_id)
    campaign = await db.campaigns.get(campaign_id)
    tone = campaign.tone_settings or {
        "formal": user_profile.tone_formal,
        "technical": user_profile.tone_technical
    }
    
    # Find most relevant proof points for this company
    relevant_projects = await find_relevant_projects(
        proof_points=user_profile.proof_points,
        company_embedding=company.embedding,
        tech_stack=company.tech_stack or [],
        top_k=2
    )
    
    # Pick best hook (most recent, most specific signal)
    hook = pick_best_hook(research)
    
    # Calculate relevance score
    relevance_score = await compute_relevance_score(user_profile, company, research)
    
    # Build Mercury prompt
    user_prompt = f"""
    Write a cold outreach email with these exact inputs:
    
    SENDER:
    Name: {user_profile.name}
    What they bring: {user_profile.what_they_bring}
    Most relevant proof points for this company:
    {json.dumps(relevant_projects, indent=2)}
    
    RECIPIENT:
    Name: {contact.name}
    Role: {contact.role}
    Company: {company.name}
    Is founder: {contact.is_founder}
    Is new recruit: {contact.is_new_recruit}
    
    COMPANY CONTEXT:
    Research summary: {research.summary if research else 'No research available'}
    Best hook to open with: {hook}
    Tech stack: {', '.join(company.tech_stack or [])}
    
    TONE:
    Formality (1=very casual, 10=very formal): {tone['formal']}
    Technical depth (1=story-driven, 10=highly technical): {tone['technical']}
    
    SPECIAL INSTRUCTIONS:
    {"This person is a new recruit — use a peer-to-peer tone, ask for advice/referral, not a job directly." if contact.is_new_recruit else ""}
    {"This person is a founder — be direct, show you've done serious research, skip all fluff." if contact.is_founder else ""}
    """
    
    response = claude_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=MERCURY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    result = json.loads(response.content[0].text)
    
    # Apply humanizer pass (removes remaining AI-isms)
    humanized_body = await humanize_email(result["body"])
    
    # Store as draft
    email_id = await db.outreach_emails.insert({
        "campaign_id": campaign_id,
        "contact_id": contact_id,
        "subject": result["subject_lines"][0],
        "subject_options": result["subject_lines"],
        "body": humanized_body,
        "tone_settings": tone,
        "relevance_score": relevance_score,
        "relevant_projects": relevant_projects,
        "hook_used": hook,
        "status": "draft"
    })
    
    return email_id


async def humanize_email(email_body: str) -> str:
    """
    Final pass to remove AI patterns.
    Checks for and removes common AI-generated phrases and structures.
    """
    HUMANIZER_PROMPT = """
    Review this email and make it sound more human. 
    
    Remove or rewrite:
    - Any phrase that sounds like it came from a template
    - Overly structured sentences
    - Passive voice where active is more natural
    - Any remaining corporate buzzwords
    - Sentences that start with "I" three times in a row
    
    Keep the substance and length identical. Only improve naturalness.
    Return ONLY the improved email body, no explanation.
    
    Email: 
    """
    
    response = claude_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=[{"role": "user", "content": HUMANIZER_PROMPT + email_body}]
    )
    
    return response.content[0].text.strip()


def pick_best_hook(research: CompanyResearch | None) -> str:
    """
    Pick the most specific, recent signal to open the email with.
    Priority: news (7 days) > blog post > founder post > product update > funding
    """
    if not research:
        return ""
    
    # Check recent news (last 7 days)
    for item in (research.recent_news or []):
        if days_since(item.get("date")) <= 7:
            return f"Saw that {item['headline']}"
    
    # Check blog posts (last 30 days)
    for post in (research.blog_posts or []):
        if days_since(post.get("date")) <= 30:
            return f"Read your post on {post['title']}"
    
    # Check founder posts
    for post in (research.founder_posts or []):
        if days_since(post.get("date")) <= 14:
            return f"Noticed {post['author']} posted about {extract_topic(post['content'])}"
    
    # Fallback: funding
    return ""
```

### 7.2 Smart Follow-up Generation

```python
# tasks/mercury/followups.py

FOLLOWUP_TONES = {
    1: "Warm and brief. Reference the original email. If there's a new company signal, lead with it. One gentle push.",
    2: "Slightly more direct. Mention one specific way you can help them right now.",
    3: "Soft close. Acknowledge they're busy. Open door. No pressure. Last message."
}

@celery.task
def schedule_followups(outreach_email_id: str):
    """
    After initial email is sent, schedule follow-ups at Day 3, 5, 7.
    """
    FOLLOWUP_DAYS = {1: 3, 2: 5, 3: 7}
    
    sent_at = db.outreach_emails.get_sent_at(outreach_email_id)
    
    for followup_num, days in FOLLOWUP_DAYS.items():
        scheduled_for = sent_at + timedelta(days=days)
        
        db.followup_schedule.insert({
            "outreach_email_id": outreach_email_id,
            "followup_number": followup_num,
            "scheduled_for": scheduled_for,
            "status": "pending"
        })


@celery.task
@periodic_task(run_every=crontab(minute="*/15"))   # check every 15 min
def trigger_due_followups():
    """
    Check for follow-ups that are due. Generate and send them.
    """
    due = db.followup_schedule.get_due(status="pending", before=now())
    
    for followup in due:
        # Check if original thread already got a reply — if so, cancel
        email = db.outreach_emails.get(followup.outreach_email_id)
        if email.status == "replied":
            db.followup_schedule.update(followup.id, {"status": "cancelled"})
            continue
        
        generate_and_send_followup.delay(followup.id)


@celery.task
async def generate_and_send_followup(followup_schedule_id: str):
    """
    Generate smart follow-up email. Check for new signals since last email.
    """
    followup = db.followup_schedule.get(followup_schedule_id)
    original_email = db.outreach_emails.get(followup.outreach_email_id)
    contact = db.contacts.get(original_email.contact_id)
    company = db.companies.get(contact.company_id)
    campaign = db.campaigns.get(original_email.campaign_id)
    
    # Check for new company signals since original email was sent
    new_signals = get_new_signals_since(company.id, since=original_email.sent_at)
    hook = new_signals[0] if new_signals else None
    
    prompt = f"""
    Write follow-up #{followup.followup_number} to this cold email.
    
    ORIGINAL EMAIL:
    Subject: {original_email.subject}
    Body: {original_email.body}
    
    RECIPIENT: {contact.name}, {contact.role} at {company.name}
    DAYS SINCE SENT: {(now() - original_email.sent_at).days}
    
    {"NEW SIGNAL TO REFERENCE: " + hook['headline'] if hook else "No new signal available."}
    
    TONE GUIDE: {FOLLOWUP_TONES[followup.followup_number]}
    MAX LENGTH: 80 words. One paragraph. Do not repeat what was already said.
    
    Return ONLY the follow-up body text. No subject line needed (it's a reply in thread).
    """
    
    response = claude_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    
    followup_body = response.content[0].text.strip()
    
    # Update schedule with generated content
    db.followup_schedule.update(followup_schedule_id, {
        "override_body": followup_body,
        "new_signal_found": hook is not None,
        "new_signal_content": hook["headline"] if hook else None
    })
    
    # Send via Mercury / Nylas
    send_followup_email.delay(followup_schedule_id, campaign.user_id)
```

---

## 8. Inter-Agent Communication

### The Company Brief Contract

This is the data structure Theos assembles and makes available for Mercury to consume. It is stored in the DB (not passed directly) — Mercury reads from DB when generating emails.

```typescript
// types/company_brief.ts
interface CompanyBrief {
  company: {
    id: string;
    name: string;
    stage: string;
    funding_amount_usd: number;
    funding_date: string;
    investors: string[];
    hq_location: string;
    tech_stack: string[];
    hiring_score: number;
    research_summary: string;
    embedding: number[];
  };
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    seniority: string;
    professional_email: string;
    personal_email?: string;
    email_confidence_score: number;
    linkedin_url: string;
    is_founder: boolean;
    is_new_recruit: boolean;
    tenure_months: number;
    recent_posts: Array<{ content: string; date: string }>;
  }>;
  research: {
    recent_news: Array<{ headline: string; url: string; date: string; summary: string }>;
    blog_posts: Array<{ title: string; url: string; date: string; summary: string }>;
    founder_posts: Array<{ author: string; content: string; date: string }>;
    product_updates: Array<{ title: string; date: string; summary: string }>;
    job_postings: Array<{ title: string; url: string; date: string }>;
  };
  signal_source: "yc" | "ef" | "inc42" | "linkedin_signal" | "wellfound" | "manual";
}
```

### Celery Task Chain Diagram

```
THEOS PIPELINE:
ingest_yc_batch
  └─► enrich_company (Proxycurl)
        └─► find_contacts (Proxycurl employee search)
              └─► get_emails (Apollo → ContactOut → Wiza)
                    └─► research_company (news + blog + posts)
                          └─► score_company (hiring score calc)
                                └─► notify_relevant_users
                                      └─► [for each matched user]
                                            └─► create_campaign
                                                  └─► generate_email (Mercury)

MERCURY PIPELINE:
generate_email → [status: draft] → user approves in UI
  └─► send_email (Nylas)
        └─► schedule_followups
              └─► [Day 3] generate_and_send_followup
              └─► [Day 5] generate_and_send_followup  
              └─► [Day 7] generate_and_send_followup
```

---

## 9. Email Infrastructure

### Nylas Integration

Nylas abstracts Gmail and Outlook OAuth. Use it instead of building raw Google/Microsoft auth.

```python
# services/email/nylas_service.py
from nylas import Client
from nylas.models.auth import URLForAuthenticationConfig, CodeExchangeRequest

nylas = Client(api_key=NYLAS_API_KEY)

# Step 1: Generate OAuth URL for user to connect their Gmail
def get_auth_url(user_id: str) -> str:
    config = URLForAuthenticationConfig({
        "client_id": NYLAS_CLIENT_ID,
        "redirect_uri": f"{BASE_URL}/api/nylas/callback",
        "login_hint": None,
        "state": user_id    # pass user_id through state param
    })
    return nylas.auth.url_for_oauth2(config)

# Step 2: Exchange code for grant_id (stored per user)
async def exchange_code(code: str, user_id: str) -> str:
    exchange = nylas.auth.exchange_code_for_token(CodeExchangeRequest({
        "redirect_uri": f"{BASE_URL}/api/nylas/callback",
        "code": code
    }))
    grant_id = exchange.grant_id
    await db.users.update(user_id, {"nylas_grant_id": grant_id})
    return grant_id

# Step 3: Send email
async def send_outreach_email(
    user_id: str,
    outreach_email_id: str,
    resume_r2_url: str
) -> dict:
    email = await db.outreach_emails.get(outreach_email_id)
    contact = await db.contacts.get(email.contact_id)
    user = await db.users.get(user_id)
    
    # Download resume from R2 for attachment
    resume_bytes = await r2.download(resume_r2_url)
    
    # Respect send time window (8:30-9am Tue/Wed/Thu)
    if not is_valid_send_time():
        scheduled_time = next_valid_send_window()
        await schedule_for_later(outreach_email_id, scheduled_time)
        return {"status": "scheduled", "send_at": scheduled_time}
    
    # Check daily limit
    today_count = await db.outreach_emails.count_sent_today(user_id)
    if today_count >= 25:
        raise DailyLimitError("Daily send limit reached (25)")
    
    # Random jitter within window (spread sends over 25 min)
    jitter_seconds = random.randint(0, 1500)
    await asyncio.sleep(jitter_seconds)
    
    message = nylas.messages.send(
        identifier=user.nylas_grant_id,
        request_body={
            "to": [{"name": contact.name, "email": contact.professional_email}],
            "subject": email.subject,
            "body": email.body,
            "reply_to": [{"name": user.name, "email": user.email}],
            "attachments": [{
                "filename": "resume.pdf",
                "content_type": "application/pdf",
                "content": base64.b64encode(resume_bytes).decode()
            }],
            "tracking_options": {"opens": True, "thread_replies": True}
        }
    )
    
    await db.outreach_emails.update(outreach_email_id, {
        "status": "sent",
        "sent_at": now(),
        "thread_id": message.thread_id,
        "message_id": message.id
    })
    
    return {"status": "sent", "message_id": message.id}


# Nylas webhook handler — open and reply tracking
@app.post("/api/webhooks/nylas")
async def nylas_webhook(request: Request):
    payload = await request.json()
    
    for notification in payload.get("data", {}).get("payload", []):
        event_type = notification.get("type")
        
        if event_type == "message.opened":
            thread_id = notification["data"]["thread_id"]
            await db.outreach_emails.update_by_thread(thread_id, {
                "status": "opened",
                "opened_at": now()
            })
        
        elif event_type == "message.created":
            # Check if reply to one of our tracked threads
            thread_id = notification["data"]["thread_id"]
            original = await db.outreach_emails.find_by_thread(thread_id)
            
            if original and original.status != "replied":
                await db.outreach_emails.update(original.id, {
                    "status": "replied",
                    "replied_at": now()
                })
                # Cancel pending follow-ups
                await db.followup_schedule.cancel_for_email(original.id)
                # Notify user
                await push_notification(original.campaign.user_id, 
                    f"Reply from {original.contact.name} at {original.contact.company.name}!")
                # Log
                await log_activity(original.campaign.user_id, "mercury", 
                    "reply_received", "contact", original.contact_id)
    
    return {"status": "ok"}


def is_valid_send_time() -> bool:
    """Only send 8:30-9:00am, Tuesday through Thursday."""
    now = datetime.now(tz=IST)
    is_valid_day = now.weekday() in [1, 2, 3]   # Tue=1, Wed=2, Thu=3
    is_valid_hour = now.hour == 8 and now.minute >= 30 or now.hour == 9 and now.minute == 0
    return is_valid_day and is_valid_hour
```

---

## 10. Semantic Matching Layer

This is how Mercury knows which proof points to highlight, and how the system matches users to companies.

```python
# services/semantic.py
import numpy as np
from openai import OpenAI

openai_client = OpenAI()

async def generate_embedding(text: str) -> list[float]:
    """Generate 1536-dim embedding via OpenAI text-embedding-3-small."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:8000]   # max input
    )
    return response.data[0].embedding


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


async def find_relevant_projects(
    proof_points: list[dict],
    company_embedding: list[float],
    tech_stack: list[str],
    top_k: int = 2
) -> list[dict]:
    """
    Find which of the user's proof points best match the company's focus.
    Uses embedding similarity.
    """
    if not proof_points:
        return []
    
    # Embed each proof point
    scored = []
    for pp in proof_points:
        pp_text = f"{pp['project']} {pp['problem']} {pp['impact']} {' '.join(pp.get('tech', []))}"
        pp_embedding = await generate_embedding(pp_text)
        similarity = cosine_similarity(pp_embedding, company_embedding)
        
        # Bonus for tech stack overlap
        tech_overlap = len(set(pp.get("tech", [])) & set(tech_stack))
        adjusted_score = similarity + (tech_overlap * 0.05)
        
        scored.append((pp, adjusted_score))
    
    # Sort by score, return top_k
    scored.sort(key=lambda x: x[1], reverse=True)
    return [pp for pp, _ in scored[:top_k]]


async def compute_relevance_score(
    user_profile,
    company,
    research
) -> float:
    """
    Compute 0-100 relevance score between user and company.
    Used for sorting in dashboard and email preview.
    """
    if not user_profile.embedding or not company.embedding:
        return 50.0
    
    base_score = cosine_similarity(user_profile.embedding, company.embedding)
    
    # Boost for tech stack overlap
    user_tech = set([s.lower() for s in (user_profile.parsed_skills or {}).get("technical", [])])
    company_tech = set([t.lower() for t in (company.tech_stack or [])])
    tech_overlap = len(user_tech & company_tech)
    
    # Boost for sector preference match
    sector_match = any(
        s in (company.sector or [])
        for s in (user_profile.preferred_sectors or [])
    )
    
    score = (base_score * 70) + (min(tech_overlap, 5) * 4) + (10 if sector_match else 0)
    return min(round(score, 1), 100.0)


# Pgvector query for finding similar companies to user profile
async def find_matching_companies_for_user(user_id: str, limit: int = 20) -> list:
    """
    Run pgvector ANN search to find companies semantically similar to user.
    """
    user_profile = await db.user_profiles.get(user_id)
    
    # Raw SQL for pgvector cosine similarity search
    results = await db.execute("""
        SELECT id, name, hiring_score,
               1 - (embedding <=> $1::vector) AS similarity
        FROM companies
        WHERE embedding IS NOT NULL
          AND hiring_score > 20
        ORDER BY embedding <=> $1::vector
        LIMIT $2
    """, user_profile.embedding, limit)
    
    return results
```

---

## 11. Dashboard & Frontend

### Route Structure (Next.js App Router)

```
app/
├── (auth)/
│   ├── sign-in/page.tsx
│   └── sign-up/page.tsx
├── (dashboard)/
│   ├── layout.tsx           # sidebar nav
│   ├── page.tsx             # home / active hiring feed
│   ├── adam/
│   │   ├── page.tsx         # Adam chat + knowledge base view
│   │   └── interview/
│   │       └── page.tsx     # voice interview UI
│   ├── pipeline/
│   │   └── page.tsx         # Kanban: Sent→Opened→Replied→Offer
│   ├── companies/
│   │   └── page.tsx         # active hiring feed, filter, sort
│   ├── signals/
│   │   └── page.tsx         # LinkedIn signal feed
│   ├── browse/
│   │   └── page.tsx         # Browse & Apply job listings
│   ├── analytics/
│   │   └── page.tsx         # stats, open rates, reply rates
│   └── logs/
│       └── page.tsx         # activity log
├── api/
│   ├── adam/chat/route.ts
│   ├── adam/upload/route.ts
│   ├── theos/trigger/route.ts
│   ├── mercury/approve/route.ts
│   ├── mercury/send/route.ts
│   ├── nylas/callback/route.ts
│   └── webhooks/nylas/route.ts
```

### Key UI States

**Email Preview Interface (Mercury)**
```
For each campaign (company):
  - Company header: name, hiring score, source badge
  - Research summary (what Theos found)
  - List of contacts with individual email drafts
  
For each email draft:
  - Relevance score badge (e.g. "87% match")
  - Subject line (editable, dropdown to switch between 3 options)
  - Email body (editable inline)
  - Tone indicators
  - "Which projects Mercury highlighted" — expandable
  - Hook used — expandable  
  - CTA: [Skip Contact] [Approve & Queue]

Campaign footer:
  - [Skip Entire Company] [Approve All & Send]
```

**Pipeline Kanban**
```
Columns: Researching | Draft Ready | Approved | Sent | Opened | Replied | Call | Offer | Dormant

Each card:
  - Company name + logo
  - Contact name + role
  - Last activity timestamp
  - Next follow-up countdown (e.g. "Follow-up 2 in 2 days")
  - Quick actions: View email / Skip / Mark replied
```

---

## 12. Rate Limiting & Safety

```python
# services/safety.py

DAILY_LIMITS = {
    "emails_sent": 25,
    "followups_sent": 15,
    "new_campaigns_created": 10,
    "proxycurl_calls": 100,
    "apollo_calls": 50
}

SUPPRESSION_RULES = {
    "ghosted_after_3_followups": timedelta(days=90),
    "bounced_email": timedelta(days=180),
    "explicit_rejection": timedelta(days=180)
}

async def check_sending_limit(user_id: str) -> bool:
    count = await db.outreach_emails.count_sent_today(user_id)
    return count < DAILY_LIMITS["emails_sent"]

async def suppress_company(
    campaign_id: str,
    reason: str
):
    """Mark company as dormant, suppress for appropriate period."""
    suppression_period = SUPPRESSION_RULES.get(reason, timedelta(days=90))
    await db.campaigns.update(campaign_id, {
        "status": "dormant",
        "suppress_reason": reason,
        "suppressed_until": now() + suppression_period
    })

# Email warm-up: spread sends randomly within the window
def get_staggered_send_time(send_index: int) -> datetime:
    """
    Stagger sends within the 8:30-9:00am window.
    Max 25 emails → 1 every ~72 seconds on average.
    """
    window_start = get_next_send_window()  # next valid Tue/Wed/Thu 8:30am
    jitter = random.randint(0, 1800)       # spread over 30 min window
    extra = send_index * 60                 # 60s apart minimum
    return window_start + timedelta(seconds=jitter + extra)
```

---

## 13. Deployment Architecture

```
┌─────────────────────────────────────────────┐
│               Vercel (Frontend)              │
│  Next.js 14 · Clerk Auth · Realtime via      │
│  Supabase client SDK                         │
└──────────────────┬──────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────┐
│            Railway Service 1                 │
│              FastAPI Server                  │
│   Adam routes / Mercury routes /            │
│   Nylas webhooks / Auth middleware           │
└──────────────────┬──────────────────────────┘
                   │ Celery task dispatch
┌──────────────────▼──────────────────────────┐
│            Railway Service 2                 │
│           Celery Worker Pool                 │
│   Theos pipeline / Mercury scheduler /       │
│   Follow-up triggers / Signal scrapers       │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│   Supabase   │    │  Upstash Redis   │
│  PostgreSQL  │    │  Celery broker   │
│  + pgvector  │    │  + result cache  │
│  + Realtime  │    └──────────────────┘
└──────────────┘
        
┌─────────────────────────────────────────────┐
│            Cloudflare R2                     │
│   CV uploads / Resume attachments /          │
│   Audio recordings from Adam interview       │
└─────────────────────────────────────────────┘

External API Dependencies:
┌────────────────┬────────────────────────────┐
│ Anthropic      │ Claude (Adam, Mercury,      │
│                │ Theos research summarizer)  │
├────────────────┼────────────────────────────┤
│ Deepgram       │ STT (Nova-3) + TTS (Aura-2) │
├────────────────┼────────────────────────────┤
│ Proxycurl      │ LinkedIn enrichment         │
├────────────────┼────────────────────────────┤
│ Apollo.io      │ Email finding (primary)     │
├────────────────┼────────────────────────────┤
│ ContactOut     │ Email finding (fallback)    │
├────────────────┼────────────────────────────┤
│ Wiza           │ Email finding (fallback)    │
├────────────────┼────────────────────────────┤
│ Nylas          │ Gmail + Outlook OAuth send  │
├────────────────┼────────────────────────────┤
│ Apify          │ Web scraping infrastructure │
├────────────────┼────────────────────────────┤
│ OpenAI         │ text-embedding-3-small      │
├────────────────┼────────────────────────────┤
│ NewsAPI        │ Company news signals        │
└────────────────┴────────────────────────────┘
```

### Docker Compose (Local Dev)

```yaml
# docker-compose.yml
version: "3.9"

services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/platform
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    command: uvicorn main:app --reload --host 0.0.0.0

  worker:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/platform
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    command: celery -A tasks.celery worker --loglevel=info --concurrency=4

  beat:
    build: ./backend
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    command: celery -A tasks.celery beat --loglevel=info

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: platform
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

---

## 14. Build Order & Milestones

### Phase 1 — Foundation (Week 1-2)
- [ ] Supabase project + full schema deployed + pgvector enabled
- [ ] Clerk auth integrated (Next.js + FastAPI middleware)
- [ ] R2 bucket for file uploads
- [ ] Adam CV upload → PDF parse → structured extraction (Claude)
- [ ] User profile view in dashboard (read-only)

### Phase 2 — Adam Complete (Week 3-4)
- [ ] Adam voice interview (Deepgram STT + TTS + WebSocket frontend)
- [ ] Adam text chat fallback
- [ ] Soft profile extraction from interview turns
- [ ] Knowledge base view — user can see and edit what Adam knows
- [ ] Proof points display

### Phase 3 — Theos V1 (Week 5-6)
- [ ] YC batch CSV imported as seed data
- [ ] Proxycurl company enrichment task
- [ ] Proxycurl employee search + contact storage
- [ ] Apollo email finding integration
- [ ] ContactOut + Wiza fallbacks
- [ ] Companies visible in dashboard (basic list view)

### Phase 4 — Mercury V1 (Week 7-8)
- [ ] Email generation pipeline (Claude)
- [ ] Humanizer pass
- [ ] Email preview + edit UI
- [ ] Gmail OAuth via Nylas
- [ ] Manual approve-and-send flow (no scheduling yet)

### Phase 5 — Mercury Complete (Week 9-10)
- [ ] Celery follow-up scheduler (Day 0, 3, 5, 7)
- [ ] Nylas webhook for open + reply tracking
- [ ] Pipeline kanban view
- [ ] Auto-cancel follow-ups on reply
- [ ] Reply notification to user

### Phase 6 — Theos V2 (Week 11-12)
- [ ] Company research pipeline (news + blog + founder posts)
- [ ] Hiring score algorithm
- [ ] Active hiring feed sorted by score
- [ ] Semantic user-company matching (pgvector)
- [ ] Auto-campaign creation for matched companies

### Phase 7 — Scale (Week 13+)
- [ ] LinkedIn signal scraping (Apify)
- [ ] Smart follow-ups (new signal injection)
- [ ] Job board aggregation (Wellfound, Lever, Naukri, Internshala)
- [ ] Analytics dashboard (open rates, reply rates, conversion funnel)
- [ ] Weekly Adam summary email
- [ ] Warm intro detection (2nd-degree connection flag)

---

## 15. API Reference

### Adam Endpoints
```
POST   /api/adam/upload              Upload CV + LinkedIn export
GET    /api/adam/profile             Get user's full knowledge base
POST   /api/adam/chat                Send message to Adam (text)
GET    /api/adam/interview/start     Start voice interview session
POST   /api/adam/interview/turn      Submit one voice turn transcript
GET    /api/adam/interview/status    Get interview progress
PATCH  /api/adam/profile             User manually edits knowledge base
```

### Theos Endpoints
```
GET    /api/theos/companies          List companies (with scores, filters)
GET    /api/theos/companies/:id      Single company + research + contacts
POST   /api/theos/companies/:id/enqueue   Add company to user's queue
GET    /api/theos/signals            LinkedIn signal feed
GET    /api/theos/listings           Browse & Apply job listings
POST   /api/theos/trigger            Manually trigger Theos for a company
```

### Mercury Endpoints
```
GET    /api/mercury/campaigns        List user's campaigns
GET    /api/mercury/campaigns/:id    Single campaign + email drafts
POST   /api/mercury/emails/:id/approve    Approve a draft email
POST   /api/mercury/emails/:id/skip       Skip a contact
PATCH  /api/mercury/emails/:id       Edit draft subject/body
POST   /api/mercury/campaigns/:id/send-all   Approve all + queue send
GET    /api/mercury/pipeline         Kanban pipeline data
```

### Webhook Endpoints
```
POST   /api/webhooks/nylas           Email open + reply events (Nylas)
POST   /api/webhooks/clerk           User created/deleted (Clerk)
```

---

## 16. Environment Variables

```bash
# ── App ────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://yourapp.com
ENVIRONMENT=production   # development | production

# ── Auth (Clerk) ───────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# ── Database (Supabase) ────────────────────────────
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ── Cache / Queue (Upstash Redis) ──────────────────
REDIS_URL=rediss://...
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── File Storage (Cloudflare R2) ───────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# ── AI ─────────────────────────────────────────────
ANTHROPIC_API_KEY=
OPENAI_API_KEY=           # for embeddings

# ── Voice (Deepgram) ───────────────────────────────
DEEPGRAM_API_KEY=
NEXT_PUBLIC_DEEPGRAM_API_KEY=    # frontend WebSocket auth

# ── Email (Nylas) ──────────────────────────────────
NYLAS_API_KEY=
NYLAS_CLIENT_ID=
NYLAS_CLIENT_SECRET=
NYLAS_WEBHOOK_SECRET=

# ── Enrichment ─────────────────────────────────────
PROXYCURL_API_KEY=
APOLLO_API_KEY=
CONTACTOUT_API_KEY=
WIZA_API_KEY=

# ── Scraping ───────────────────────────────────────
APIFY_API_TOKEN=

# ── News ───────────────────────────────────────────
NEWS_API_KEY=

# ── Monitoring ─────────────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## Appendix: Naming Reference

| Name | Type | Domain | Description |
|------|------|--------|-------------|
| **Adam** | Agent | User | Builds and owns the user knowledge base. Conducts the voice interview. Never touches external world. |
| **Theos** | Agent | External | Discovers companies, finds contacts, enriches data, researches deeply. Never writes emails. |
| **Mercury** | Agent | Outreach | Generates emails, manages sends, schedules follow-ups. Never does research. |
| **Company Brief** | Data Contract | Theos → Mercury | Structured package Theos assembles. The only way Theos communicates to Mercury. |
| **Hiring Score** | Metric | Theos | 0-100 score indicating how actively a company is likely hiring right now. |
| **Proof Points** | Data | Adam | High-signal career moments: what was built, what problem, what impact, what tech. |
| **Active Hiring Feed** | UI | Dashboard | Companies sorted by Hiring Score. User's primary action surface. |
| **Referral Path** | Flow | Mercury | Separate outreach mode for new recruits. Peer-to-peer tone. Asks for advice, not a job. |
| **Smart Follow-up** | Feature | Mercury | Follow-up that references new company signals published since the last email. |

---

*End of Technical Documentation v1.0.0*
*This document should be treated as a living spec — update it as decisions are made.*
