<p align="center">
  <img src="https://img.shields.io/badge/status-active%20development-blue?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/agents-3%20(Adam%20%C2%B7%20Theos%20%C2%B7%20Mercury)-purple?style=for-the-badge" alt="Agents" />
  <img src="https://img.shields.io/badge/stack-Next.js%20%C2%B7%20FastAPI%20%C2%B7%20LangGraph-green?style=for-the-badge" alt="Stack" />
</p>

# Agnostos

### The Hidden Job Market, Automated.

Agnostos is an **AI-powered, multi-agent outreach platform** that bypasses traditional job boards entirely. Instead of waiting for listings, it **discovers recently funded companies**, **researches them deeply**, and **generates hyper-personalized cold emails** on your behalf — all with human-in-the-loop approval at every step.

Think of it as having three specialized AI teammates working around the clock:
- **Adam** learns who you are — deeply, not just from your resume
- **Theos** scans the world for where you should be
- **Mercury** speaks for you — precisely, personally, at scale

> *"The best opportunities aren't posted. They're discovered."*

---

## Table of Contents

- [Why Agnostos?](#why-agnostos)
- [The Three Agents](#the-three-agents)
- [System Architecture](#system-architecture)
- [Core Workflows](#core-workflows)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Integrations](#integrations)
- [Agent Deep Dives](#agent-deep-dives)
- [The Deep Search Engine](#the-deep-search-engine)
- [RAG and Semantic Intelligence](#rag-and-semantic-intelligence)
- [Future Roadmap](#future-roadmap)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## Why Agnostos?

The traditional job search is broken:

| The Old Way | The Agnostos Way |
|---|---|
| Scroll job boards for hours | AI discovers companies *before* they post |
| Send the same generic resume everywhere | Every email references real research about the company |
| Hope your application gets past ATS | Reach decision-makers directly — founders, CTOs, directors |
| No visibility after you apply | Full pipeline tracking: Sent > Opened > Replied > Offer |
| Follow-ups feel awkward | Smart follow-ups inject *new* company signals automatically |

Agnostos is built on a simple thesis: **recently funded companies are actively building teams, and a well-researched, personalized cold email to the right person beats 100 anonymous job applications**.

---

## The Three Agents

Agnostos operates through three domain-separated AI agents. Each agent owns a specific area and never reaches into another's territory. They communicate through structured data contracts in the database.

```mermaid
graph TB
    subgraph ADAM["Adam — User Intelligence"]
        A1[CV & Resume Parsing]
        A2[Voice Interview]
        A3[Knowledge Base & RAG]
        A4[Soft Profile Extraction]
        A5[Proof Points Mining]
    end

    subgraph THEOS["Theos — External Intelligence"]
        T1[Company Discovery & Deep Search]
        T2[Contact Finding]
        T3[Company Research & Enrichment]
        T4[LinkedIn Signal Detection]
        T5[GitHub Job Aggregation]
        T6[Hiring Score Calculation]
    end

    subgraph MERCURY["Mercury — Outreach Engine"]
        M1[Personalized Email Generation]
        M2[Smart Follow-ups]
        M3[Campaign Management]
        M4[Email Sending via Nylas]
        M5[Open & Reply Tracking]
    end

    ADAM -->|User Profile + Proof Points| MERCURY
    THEOS -->|Company Brief + Research| MERCURY
    MERCURY -->|Sends & Tracks| M5

    style ADAM fill:#4f46e5,color:#fff,stroke:#4f46e5
    style THEOS fill:#059669,color:#fff,stroke:#059669
    style MERCURY fill:#dc2626,color:#fff,stroke:#dc2626
```

| Agent | Domain | What It Knows | What It Does |
|-------|--------|---------------|--------------|
| **Adam** | The User | Skills, experience, projects, ambitions, personality, communication style | Parses resumes, conducts voice interviews, builds a rich knowledge base, powers contextual chat |
| **Theos** | The World | Companies, contacts, funding signals, hiring activity, market research | Discovers funded companies via deep search, enriches data, finds contacts, scores hiring probability |
| **Mercury** | The Outreach | User profile + company research combined | Generates personalized emails, manages campaigns, schedules follow-ups, tracks engagement |

---

## System Architecture

```mermaid
graph TB
    USER([User]) --> FE[Next.js Frontend]
    
    FE -->|REST + SSE + WebSocket| API[FastAPI Backend]
    
    API --> AUTH[Auth Service<br/>JWT + bcrypt]
    API --> ADAM_SVC[Adam Service<br/>Onboarding + Chat + Interview]
    API --> THEOS_SVC[Theos Service<br/>Companies + Deep Search]
    API --> MERCURY_SVC[Mercury Service<br/>Campaigns + Emails]
    API --> KNOWLEDGE[Knowledge Service<br/>RAG Pipeline]
    API --> CHAT_SVC[Chat Service<br/>Floating Chat + Sessions]

    ADAM_SVC --> GEMINI[Google Gemini<br/>2.5 Pro / Flash]
    ADAM_SVC --> DEEPGRAM[Deepgram<br/>STT Nova-3 + TTS Aura-2]
    
    THEOS_SVC --> LANGGRAPH[LangGraph<br/>Deep Search Agent]
    LANGGRAPH --> GSEARCH[Google Search<br/>Grounded Research]
    THEOS_SVC --> GITHUB[GitHub Job Boards<br/>Markdown Scraping]

    MERCURY_SVC --> NYLAS[Nylas<br/>Gmail + Outlook OAuth]
    
    KNOWLEDGE --> PGVECTOR[(pgvector<br/>Semantic Search)]

    API --> DB[(Supabase PostgreSQL<br/>+ pgvector Extension)]

    style FE fill:#0070f3,color:#fff
    style API fill:#009688,color:#fff
    style LANGGRAPH fill:#ff6b35,color:#fff
    style DB fill:#3ecf8e,color:#fff
    style GEMINI fill:#4285f4,color:#fff
    style DEEPGRAM fill:#13ef93,color:#000
```

### How It All Connects

- **Frontend** talks to the **FastAPI backend** via REST APIs, Server-Sent Events (SSE) for streaming operations, and WebSockets for real-time voice interviews
- **Backend** orchestrates all three agents, each implemented as separate modules with their own routers, services, models, and schemas
- **LangGraph** powers the deep search pipeline — a multi-step, reflexive research agent that performs parallel web research with grounded citations
- **pgvector** enables semantic search across the knowledge base, letting Adam's chat responses draw from contextually relevant information
- **Gemini** serves as the primary LLM for all text generation, structured extraction, and reasoning
- **Deepgram** handles bidirectional voice — speech-to-text and text-to-speech — during Adam's interview flow

---

## Core Workflows

### 1. User Onboarding Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant ADAM as Adam Agent
    participant DG as Deepgram
    participant GEM as Gemini
    participant DB as Database

    U->>FE: Upload Resume (PDF)
    FE->>ADAM: POST /api/adam/upload-resume (SSE Stream)
    ADAM->>ADAM: Extract text via PyMuPDF
    ADAM->>GEM: Parse structured data (skills, experience, projects)
    GEM-->>ADAM: Structured JSON
    ADAM->>GEM: Extract proof points
    GEM-->>ADAM: High-signal career moments
    ADAM->>DB: Store UserProfile + KnowledgeEntries
    ADAM-->>FE: Stream processing steps via SSE

    Note over U,DB: Optional: LinkedIn Profile Scraping

    U->>FE: Start Voice Interview
    FE->>ADAM: WebSocket /api/adam/interview/ws

    loop 10-15 Turns
        ADAM->>DG: TTS — Adam speaks question
        DG-->>FE: Audio stream (MP3)
        FE-->>U: Plays Adam's voice
        U->>FE: Speaks answer (mic)
        FE->>DG: STT — Transcribe speech
        DG-->>ADAM: Transcript text
        ADAM->>GEM: Generate next question based on context
        GEM-->>ADAM: Follow-up question
    end

    ADAM->>GEM: Extract soft profile + Q&A analysis
    ADAM->>DB: Store interview transcript + knowledge entries
    ADAM-->>FE: Interview complete
```

### 2. Deep Search and Company Discovery

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant THEOS as Theos Agent
    participant LG as LangGraph Engine
    participant GS as Google Search
    participant DB as Database

    U->>FE: Set parameters (count, location, sector)
    FE->>THEOS: POST /api/theos/deepsearch/start
    THEOS->>DB: Create SearchJob
    THEOS->>LG: Launch Deep Search Graph (background)

    FE->>THEOS: GET /api/theos/deepsearch/{id}/stream (SSE)

    LG->>LG: generate_query — Create diverse search queries
    LG->>GS: web_research — Parallel fan-out search
    GS-->>LG: Grounded results + citations
    LG->>LG: reflection — Assess sufficiency
    
    alt Needs More Research
        LG->>GS: Additional research with follow-up queries
        GS-->>LG: More results
    end

    LG->>LG: finalize_answer — Synthesize markdown report
    LG-->>THEOS: Final report + sources

    THEOS->>GEM: Extract company data from report
    THEOS->>DB: Upsert companies
    THEOS->>DB: Create notification
    THEOS-->>FE: Stream status updates via SSE
```

### 3. Mercury Outreach Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant MERC as Mercury Agent
    participant GEM as Gemini
    participant NYLAS as Nylas Email
    participant DB as Database

    U->>FE: Create Campaign for Company
    FE->>MERC: POST /api/mercury/campaigns
    MERC->>DB: Load UserProfile + Company + Contacts + Research
    
    loop For Each Contact
        MERC->>GEM: Generate personalized email
        Note over MERC,GEM: Includes proof points, company research,<br/>hook from recent news, tone settings
        GEM-->>MERC: Email draft + 3 subject lines
        MERC->>DB: Store as draft
    end

    MERC-->>FE: Campaign with drafts ready

    U->>FE: Review, edit, approve emails
    FE->>MERC: POST /api/mercury/emails/{id}/approve
    FE->>MERC: POST /api/mercury/emails/{id}/send
    MERC->>NYLAS: Send via connected Gmail/Outlook
    NYLAS-->>MERC: Sent confirmation + thread ID
    MERC->>DB: Update status, schedule follow-ups

    Note over MERC,NYLAS: Follow-ups at Day 3, 5, 7
    Note over MERC,NYLAS: Auto-cancel on reply
```

---

## Features

### Currently Implemented

**Adam — User Intelligence**
- Resume/CV upload with AI-powered parsing (PyMuPDF + Gemini)
- Structured extraction: skills, experience, projects, education, proof points
- Optional LinkedIn profile scraping for enriched data
- Voice interview via WebSocket (Deepgram STT Nova-3 + TTS Aura-2)
- 10-15 turn conversational interview that digs beneath the resume
- Soft profile extraction: personality, communication style, ambitions, differentiators
- Persistent knowledge base with semantic embeddings
- RAG-powered contextual chat — Adam remembers everything and retrieves relevant context
- Floating chat accessible from anywhere in the dashboard
- Chat session management with history

**Theos — External Intelligence**
- Deep Search Engine powered by LangGraph with reflexive research loops
- Real-time search progress streaming via SSE
- Parallel web research with Google Search grounding and citation tracking
- Automated company extraction and database upsert from research reports
- Company detail pages with research data, contacts, and hiring signals
- GitHub job board aggregation (scraping curated markdown repos)
- LinkedIn signals feed (hiring posts, new recruits, funding announcements)
- Search history with re-runnable past searches
- Cancel in-flight search jobs

**Mercury — Outreach Engine**
- AI-generated personalized cold emails using full context (user profile + company research)
- Three subject line variants per email
- Hook selection from recent company news, blog posts, and founder activity
- Human-in-the-loop: all emails start as drafts, require explicit approval
- Inline email editing before sending
- Campaign management with company grouping
- Pipeline kanban view (Draft > Approved > Sent > Opened > Replied)
- Nylas integration for Gmail/Outlook OAuth email sending
- Smart follow-up generation (Day 3, 5, 7) with escalating tone
- Follow-up auto-cancellation when a reply is received
- Webhook-based open and reply tracking

**Dashboard & Platform**
- Zen-inspired dark theme UI with soft blues and generous whitespace
- Responsive sidebar navigation with collapsible icon mode
- Real-time notification system (polling + server-backed)
- Analytics dashboard: outreach metrics, daily sends, funnel visualization, profile completeness
- Activity logs with actor filtering (Adam, Theos, Mercury, User, System)
- Settings: profile management, Gemini API key configuration
- Onboarding flow: Resume > Interview > Review > Dashboard
- Auth: JWT-based registration and login with persistent sessions

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | React framework with file-based routing |
| **React 19** | UI library |
| **TypeScript 5** | Type safety |
| **Tailwind CSS v4** | Utility-first styling |
| **Zustand** | Lightweight client state management (auth, notifications) |
| **TanStack React Query v5** | Server state, caching, and persistence (localStorage) |
| **Lucide React** | Icon library |
| **Plus Jakarta Sans** | Primary typeface |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | Async Python API framework |
| **Python 3.11+** | Runtime |
| **SQLAlchemy 2.0** (async) | ORM with async session support |
| **asyncpg** | High-performance async PostgreSQL driver |
| **Pydantic v2** | Data validation and settings management |
| **python-jose + bcrypt** | JWT authentication |
| **PyMuPDF (fitz)** | PDF text extraction |

### AI and Voice

| Technology | Purpose |
|---|---|
| **Google Gemini** (2.5 Pro / Flash) | Primary LLM for all generation, extraction, and reasoning |
| **LangGraph** | Multi-step agentic research pipeline with state management |
| **LangChain** | Message primitives, structured outputs, Google AI integration |
| **Google Search (Grounding)** | Real-time web research with citations |
| **Deepgram Nova-3** | Streaming speech-to-text |
| **Deepgram Aura-2** | Text-to-speech for Adam's voice |
| **text-embedding-004** | 768-dim embeddings for semantic search |

### Database and Infrastructure

| Technology | Purpose |
|---|---|
| **Supabase PostgreSQL** | Primary database |
| **pgvector** | Vector similarity search for RAG and matching |
| **Nylas** | Email OAuth abstraction (Gmail + Outlook) |
| **Selenium + Chrome** | LinkedIn profile scraping |
| **httpx** | Async HTTP client for external API calls |

---

## Integrations

### Currently Active

```mermaid
graph LR
    AG[Agnostos] --> GEMINI[Google Gemini API<br/>LLM + Embeddings]
    AG --> DG[Deepgram<br/>Voice STT + TTS]
    AG --> SUPA[Supabase<br/>PostgreSQL + pgvector]
    AG --> NYLAS_I[Nylas<br/>Email OAuth + Send]
    AG --> GSEARCH_I[Google Search<br/>Grounded Research]
    AG --> GH[GitHub<br/>Job Board Scraping]
    AG --> LI[LinkedIn<br/>Profile Scraping]

    style AG fill:#4f46e5,color:#fff
    style GEMINI fill:#4285f4,color:#fff
    style DG fill:#13ef93,color:#000
    style SUPA fill:#3ecf8e,color:#fff
```

### Planned / Possible Integrations

| Integration | Category | Purpose |
|---|---|---|
| **Proxycurl** | Data Enrichment | LinkedIn company/people enrichment at scale |
| **Apollo.io** | Email Finding | Primary email discovery with verified addresses |
| **ContactOut** | Email Finding | Fallback email finder (waterfall chain) |
| **Wiza** | Email Finding | Second fallback for hard-to-find emails |
| **Apify** | Scraping | Managed proxies and headless browsers for LinkedIn signals, job boards |
| **NewsAPI / Google News RSS** | Signals | Real-time company news and funding announcements |
| **Crunchbase** | Data | Funding data, investor information, company profiles |
| **YC / Inc42 / Tracxn** | Data Sources | Batch company data from accelerators and trackers |
| **Wellfound (AngelList)** | Job Boards | Startup job aggregation |
| **Lever / Greenhouse / Workable** | Job Boards | ATS job board scraping |
| **Naukri / Internshala / CutShort** | Job Boards | India-focused job platforms |
| **Celery + Redis** | Infrastructure | Async task queues for background pipelines |
| **Cloudflare R2** | Storage | CV uploads, resume attachments, audio recordings |
| **Clerk** | Auth | Social login, session management |
| **Sentry** | Monitoring | Error tracking and performance monitoring |
| **PostHog** | Analytics | Product analytics and user behavior |
| **Anthropic Claude** | AI | Alternative/additional LLM for generation |
| **OpenAI** | AI | Alternative embeddings (text-embedding-3-small, 1536-dim) |

---

## Agent Deep Dives

### Adam — User Intelligence Agent

Adam is the foundation of everything. Mercury can only write authentic emails because Adam has built a deep understanding of who the user really is — not just skills on a page, but the stories behind the work.

**Agentic Behaviors:**

```mermaid
graph TD
    subgraph ADAM_BEHAVIORS["Adam's Agentic Behaviors"]
        direction TB
        
        CV[Resume Upload] --> PARSE[PDF Text Extraction<br/>PyMuPDF]
        PARSE --> STRUCT[Structured Extraction<br/>Skills, Experience, Projects]
        STRUCT --> PROOF[Proof Point Mining<br/>High-signal career moments]
        PROOF --> EMBED[Semantic Embedding<br/>text-embedding-004]
        EMBED --> KB[Knowledge Base Population]

        LI_SCRAPE[LinkedIn Scrape] --> STRUCT

        INTERVIEW[Voice Interview] --> STT[Speech-to-Text<br/>Deepgram Nova-3]
        STT --> CONTEXT[Context-Aware Question<br/>Gemini generates follow-ups]
        CONTEXT --> TTS[Text-to-Speech<br/>Deepgram Aura-2]
        TTS --> |Next Turn| STT

        INTERVIEW --> POST[Post-Interview Analysis]
        POST --> SOFT[Soft Profile Extraction<br/>Personality, style, ambitions]
        POST --> QA[Q&A Structured Analysis]
        SOFT --> KB
        QA --> KB

        CHAT[Contextual Chat] --> RETRIEVE[Semantic Retrieval<br/>pgvector cosine search]
        RETRIEVE --> RESPOND[Context-Enriched Response<br/>Gemini with knowledge context]
    end

    style ADAM_BEHAVIORS fill:#1e1b4b,color:#c7d2fe
```

**What Makes Adam Different:**
- **Not an interviewer** — Adam is designed to be a "smart, caring friend" who asks one thoughtful question at a time
- **Goes beyond the resume** — Digs into the *why* behind projects, what problems light someone up, what they're proud of that their CV undersells
- **Extracts proof points** — Specific, concrete moments (built X, solved Y, achieved Z) that Mercury uses as ammunition in emails
- **Builds a soft profile** — Personality traits, communication style, core motivations, preferred work environments
- **Always available** — Floating chat in the dashboard lets users refine their profile anytime, with RAG-powered context retrieval

**Adam's Knowledge Structure:**
```
UserProfile
├── parsed_skills (technical + soft)
├── parsed_experience (companies, roles, durations)
├── parsed_projects (what they built, with tech stacks)
├── parsed_education
├── proof_points[] (high-signal career moments)
│   ├── project — what was built
│   ├── problem — what it solved
│   ├── impact — measurable outcome
│   ├── tech — technologies used
│   └── highlight — top 2-3 flag
├── soft_profile
│   ├── personality
│   ├── communication_style
│   ├── core_motivations
│   ├── ambitions (short-term + long-term)
│   └── differentiators
├── preferences (roles, stages, sectors, location)
└── embedding (768-dim vector for semantic matching)
```

---

### Theos — External Intelligence Agent

Theos is the eyes and ears of the system. It operates primarily in the background, discovering companies, enriching data, and packaging intelligence for Mercury to act on.

**Agentic Behaviors:**

```mermaid
graph TD
    subgraph THEOS_BEHAVIORS["Theos's Agentic Behaviors"]
        direction TB

        DS[Deep Search Request] --> QG[Query Generation<br/>Multiple diverse search strings]
        QG --> |Parallel Fan-out| WR1[Web Research Thread 1]
        QG --> |Parallel Fan-out| WR2[Web Research Thread 2]
        QG --> |Parallel Fan-out| WR3[Web Research Thread N]
        WR1 --> REFLECT[Reflection Node<br/>Is research sufficient?]
        WR2 --> REFLECT
        WR3 --> REFLECT

        REFLECT -->|No — gaps found| QG2[Generate Follow-up Queries]
        QG2 --> |More Research| WR1
        REFLECT -->|Yes — sufficient| FINAL[Finalize Answer<br/>Synthesize markdown report]
        FINAL --> EXTRACT[Extract Companies<br/>Structured JSON from report]
        EXTRACT --> UPSERT[Upsert to Database]

        GH_JOBS[GitHub Job Refresh] --> SCRAPE[Scrape Markdown Repos]
        SCRAPE --> PARSE_JOBS[Parse Job Tables]
        PARSE_JOBS --> BULK[Bulk Upsert Listings]

        SIGNALS[LinkedIn Signals] --> DETECT[Signal Detection<br/>Hiring posts, funding, expansion]
        DETECT --> RESOLVE[Resolve to Company]
    end

    style THEOS_BEHAVIORS fill:#064e3b,color:#a7f3d0
```

**The Deep Search Engine in Detail:**

Theos's crown jewel is its LangGraph-powered deep search. Unlike simple search-and-summarize, this is a **reflexive research loop**:

1. **Query Generation** — Given parameters (target count, location, sector), Gemini generates multiple diverse search queries to maximize coverage
2. **Parallel Web Research** — LangGraph's `Send` API fans out multiple research threads simultaneously, each performing grounded Google Search with citation extraction
3. **Reflection** — After each round, a reflection node assesses: Is the research sufficient? Are there gaps? What follow-up queries would fill them?
4. **Iterative Deepening** — If gaps exist and we're under the max loop count, new queries are generated and more research threads are spawned
5. **Finalization** — Results are synthesized into a comprehensive markdown report with inline citations linked to real source URLs
6. **Company Extraction** — Gemini extracts structured company data from the report and upserts it into the database

**Theos's Data Pipeline:**
```
Discovery → Enrichment → Contact Finding → Email Finding → Research → Scoring → Matching
```

Each step feeds the next, building progressively richer company profiles that Mercury can leverage for personalized outreach.

---

### Mercury — Outreach Engine Agent

Mercury is the voice of the user. It takes everything Adam knows about the person and everything Theos knows about the company, and synthesizes it into emails that sound human, specific, and compelling.

**Agentic Behaviors:**

```mermaid
graph TD
    subgraph MERCURY_BEHAVIORS["Mercury's Agentic Behaviors"]
        direction TB

        CAMPAIGN[Campaign Created] --> LOAD[Load Full Context]
        LOAD --> |From Adam| PROFILE[User Profile + Proof Points]
        LOAD --> |From Theos| RESEARCH[Company Research + Contacts]

        PROFILE --> GEN[Email Generation<br/>Per Contact]
        RESEARCH --> GEN

        GEN --> HOOK[Hook Selection<br/>Recent news > Blog > Founder post > Funding]
        GEN --> MATCH[Proof Point Matching<br/>Semantic similarity to company]
        GEN --> TONE[Tone Calibration<br/>Formal/casual, Technical/story-driven]
        
        HOOK --> DRAFT[Generate Draft<br/>Body + 3 subject lines]
        MATCH --> DRAFT
        TONE --> DRAFT

        DRAFT --> HUMAN[Human Review<br/>Edit, Approve, or Skip]
        HUMAN -->|Approved| SEND[Send via Nylas]
        SEND --> TRACK[Track Opens + Replies<br/>Nylas Webhooks]

        SEND --> FOLLOWUP[Schedule Follow-ups]
        FOLLOWUP --> D3[Day 3 — Warm + brief]
        FOLLOWUP --> D5[Day 5 — More direct]
        FOLLOWUP --> D7[Day 7 — Soft close]

        D3 --> SIGNAL_CHECK{New signal<br/>since last email?}
        SIGNAL_CHECK -->|Yes| SMART[Smart Follow-up<br/>Reference new signal]
        SIGNAL_CHECK -->|No| STANDARD[Standard Follow-up]

        TRACK -->|Reply received| CANCEL[Cancel Remaining Follow-ups]
    end

    style MERCURY_BEHAVIORS fill:#450a0a,color:#fca5a5
```

**Mercury's Email Generation Philosophy:**
- Opens with something **specific** about the company (not "I hope this finds you well")
- Connects 1-2 of the user's **concrete proof points** to what the company is building
- Keeps it under **150 words** — every sentence earns its place
- **Adapts tone** per contact: peer-to-peer for new recruits, direct and research-heavy for founders
- **Three subject line variants** so the user can pick what feels right
- **Hook priority**: Recent news (7 days) > Blog post (30 days) > Founder LinkedIn post (14 days) > Funding event

**Follow-up Intelligence:**
| Follow-up | Timing | Tone |
|---|---|---|
| #1 | Day 3 | Warm and brief, reference original email, new signal if available |
| #2 | Day 5 | More direct, mention specific way you can help |
| #3 | Day 7 | Soft close, acknowledge they're busy, open door, last message |

---

## The Deep Search Engine

The deep search is Agnostos's research mode — inspired by how the best researchers work: start broad, assess what you've found, identify gaps, dig deeper, and synthesize.

```mermaid
stateDiagram-v2
    [*] --> GenerateQueries: User triggers search
    GenerateQueries --> WebResearch: Fan out parallel threads
    WebResearch --> Reflection: Aggregate results
    Reflection --> EvaluateResearch: Check sufficiency
    
    EvaluateResearch --> WebResearch: Gaps found — more research needed
    EvaluateResearch --> FinalizeAnswer: Research sufficient
    
    FinalizeAnswer --> ExtractCompanies: Parse structured data
    ExtractCompanies --> UpsertDB: Store companies
    UpsertDB --> Notify: Alert user
    Notify --> [*]
```

**How it works under the hood:**

The engine is a **LangGraph StateGraph** with five core nodes:

| Node | Role | Details |
|---|---|---|
| `generate_query` | Creates search queries | Uses Gemini structured output to produce diverse queries covering different angles |
| `web_research` | Performs grounded search | Uses Google GenAI's native `google_search` tool with grounding metadata and citation extraction |
| `reflection` | Assesses research quality | Determines if enough information has been gathered, identifies gaps, suggests follow-up queries |
| `evaluate_research` | Routes the graph | Either sends back to more research (with follow-up queries) or forwards to finalization |
| `finalize_answer` | Synthesizes the report | Compiles all research into a markdown report with inline citations linked to real URLs |

**Key capabilities:**
- **Parallel fan-out**: Multiple search threads run simultaneously via LangGraph's `Send` API
- **Reflexive loops**: Up to N research rounds, each informed by what was found (and what's missing)
- **Citation integrity**: URLs are shortened during research and resolved back to real URLs in the final report
- **Real-time streaming**: Every phase update is pushed to the frontend via SSE
- **Cancellable**: Users can cancel long-running searches mid-flight

---

## RAG and Semantic Intelligence

Agnostos uses Retrieval-Augmented Generation (RAG) to make Adam's chat responses genuinely contextual.

```mermaid
graph LR
    MSG[User Message] --> EMBED_Q[Embed Query<br/>text-embedding-004]
    EMBED_Q --> SEARCH[pgvector<br/>Cosine Similarity Search]
    SEARCH --> TOP_K[Top-K Knowledge Entries]
    TOP_K --> CONTEXT[Build Context Window]
    
    HISTORY[Last 20 Messages] --> CONTEXT
    SYSTEM[Adam System Prompt] --> CONTEXT
    
    CONTEXT --> GEMINI_CHAT[Gemini<br/>Generate Response]
    GEMINI_CHAT --> REPLY[Contextual Reply]

    style SEARCH fill:#3ecf8e,color:#fff
    style GEMINI_CHAT fill:#4285f4,color:#fff
```

**How knowledge flows:**
1. **Ingestion**: Resume parsing, interview answers, and manual entries are embedded using `text-embedding-004` (768 dimensions) and stored with their vectors
2. **Retrieval**: When a user chats, their message is embedded and a cosine similarity search finds the most relevant knowledge entries
3. **Generation**: Retrieved context + conversation history + system prompt feed into Gemini for a response that's grounded in everything Adam knows

---

## Future Roadmap

### Near-Term Enhancements

- **Celery + Redis Integration** — Background task queues for heavy enrichment pipelines, scheduled follow-ups, and periodic signal scraping
- **Email Waterfall** — Apollo > ContactOut > Wiza cascading email finder with confidence scoring
- **Company Enrichment Pipeline** — Proxycurl for LinkedIn data, headcount tracking, tech stack identification
- **Hiring Score Algorithm** — 0-100 scoring based on funding recency, job postings, founder activity, headcount growth, new recruit signals
- **Semantic User-Company Matching** — pgvector ANN search to auto-discover relevant companies for each user

### Medium-Term Features

- **LinkedIn Signal Scraping** — Automated detection of hiring posts, new recruits, funding announcements, team expansions
- **Job Board Aggregation** — Wellfound, Lever, Greenhouse, Naukri, Internshala, CutShort — all in one feed
- **Smart Follow-ups with Signal Injection** — Follow-up emails that reference new company developments since the last email
- **Weekly Adam Summary** — Automated email digest of new opportunities, pipeline status, and suggested actions
- **Warm Intro Detection** — Flag 2nd-degree connections for softer entry paths

### Long-Term Vision

- **Multi-LLM Support** — Bring your own API key for Gemini, Claude, GPT, or local models
- **Campaign A/B Testing** — Test different email angles, subject lines, and hooks with real performance data
- **Team Accounts** — Multiple users under one org with shared company research
- **CRM Integration** — Sync pipeline data to HubSpot, Pipedrive, or Notion
- **Browser Extension** — One-click research and outreach from any company's LinkedIn page
- **Mobile App** — Review and approve emails on the go
- **Analytics Intelligence** — AI-driven insights on what email patterns get the most replies

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- A **Supabase** project (free tier works) with **pgvector** enabled
- A **Google Gemini** API key
- (Optional) **Deepgram** API key for voice interview
- (Optional) **Nylas** account for email sending

### 1. Clone and Install

```bash
git clone https://github.com/your-org/agnostos.git
cd agnostos
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Auth
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=10080

# AI
GEMINI_API_KEY=your-gemini-api-key

# Voice (optional)
DEEPGRAM_API_KEY=your-deepgram-key

# Email (optional)
NYLAS_API_KEY=your-nylas-key
NYLAS_CLIENT_ID=your-nylas-client-id
```

Seed the database and start the server:

```bash
python seed.py
uvicorn main:app --reload
```

The API will be running at `http://localhost:8000`. Check health at `http://localhost:8000/api/health`.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Start the development server:

```bash
npm run dev
```

The app will be running at `http://localhost:3000`.

### 4. Test Account

After running `seed.py`, you can log in with:
- **Email:** Check the seed script output
- **Password:** Check the seed script output

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (asyncpg format) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `DEEPGRAM_API_KEY` | No | Deepgram key for voice features |
| `NYLAS_API_KEY` | No | Nylas key for email sending |
| `NYLAS_CLIENT_ID` | No | Nylas OAuth client ID |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL for frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL for frontend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key for frontend |

---

## Project Structure

```
agnostos/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, lifespan, router registration
│   ├── config.py                  # Pydantic settings from .env
│   ├── database.py                # Async SQLAlchemy engine and session
│   ├── seed.py                    # Database seeding
│   │
│   ├── auth/                      # Authentication
│   │   ├── router.py              # /api/auth — register, login, me
│   │   ├── service.py             # JWT, bcrypt, current user
│   │   └── schemas.py
│   │
│   ├── adam/                      # Adam Agent
│   │   ├── router.py              # /api/adam — chat, upload, profile, interview, onboarding
│   │   ├── interview.py           # Voice interview orchestration
│   │   ├── parser.py              # CV parsing and proof point extraction
│   │   ├── models.py              # UserProfile, AdamConversation
│   │   ├── schemas.py
│   │   ├── rstt/                  # Real-time speech-to-text (Deepgram)
│   │   └── rtts/                  # Real-time text-to-speech (Deepgram)
│   │
│   ├── theos/                     # Theos Agent
│   │   ├── router.py              # /api/theos — companies, signals, jobs, deepsearch
│   │   ├── search_service.py      # Deep search orchestration and SSE streaming
│   │   ├── github_jobs.py         # GitHub job board scraping
│   │   ├── models.py              # Company, Contact, SearchJob, Signal, JobListing
│   │   ├── schemas.py
│   │   └── deepsearch/            # LangGraph Deep Search Engine
│   │       ├── graph.py           # StateGraph definition and compilation
│   │       ├── state.py           # OverallState with reducers
│   │       ├── prompts.py         # Research and reflection prompts
│   │       ├── tools_and_schemas.py  # Structured output schemas
│   │       ├── configuration.py   # Graph configuration
│   │       └── utils.py           # URL resolution, citation helpers
│   │
│   ├── mercury/                   # Mercury Agent
│   │   ├── router.py              # /api/mercury — campaigns, emails, nylas, webhooks
│   │   ├── generator.py           # Email generation with proof points and hooks
│   │   ├── service.py             # Campaign orchestration
│   │   ├── followups.py           # Smart follow-up generation
│   │   ├── nylas_service.py       # Nylas email integration
│   │   ├── models.py              # Campaign, OutreachEmail
│   │   └── schemas.py
│   │
│   ├── knowledge/                 # Knowledge Base (RAG)
│   │   ├── router.py              # /api/knowledge — CRUD + semantic search
│   │   ├── service.py             # Embedding, retrieval, pgvector queries
│   │   ├── models.py              # KnowledgeEntry with Vector(768)
│   │   └── schemas.py
│   │
│   ├── chat/                      # General Chat (Floating)
│   │   ├── router.py              # /api/chat — sessions and messages
│   │   ├── service.py             # RAG-enhanced Adam replies
│   │   ├── models.py              # ChatSession, ChatMessage
│   │   └── schemas.py
│   │
│   ├── notifications/             # Notification System
│   │   ├── router.py              # /api/notifications
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── analytics/                 # Analytics & Logs
│   │   └── router.py              # /api/analytics, /api/logs
│   │
│   ├── settings/                  # User Settings
│   │   ├── router.py              # /api/settings — providers, API keys
│   │   ├── service.py
│   │   └── schemas.py
│   │
│   └── shared/                    # Shared Utilities
│       ├── gemini.py              # Gemini client (chat, structured, embeddings)
│       ├── linkedin.py            # LinkedIn scraping via Selenium
│       └── models.py              # User model
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout, fonts, providers
│   │   │   ├── globals.css        # Zen dark theme, animations
│   │   │   ├── auth/page.tsx      # Login / Register
│   │   │   │
│   │   │   ├── onboarding/        # Onboarding Flow
│   │   │   │   ├── layout.tsx     # Step progress header
│   │   │   │   ├── resume/        # PDF upload + LinkedIn
│   │   │   │   ├── interview/     # Voice interview
│   │   │   │   └── review/        # Review Q&A
│   │   │   │
│   │   │   └── (dashboard)/       # Main Product Shell
│   │   │       ├── layout.tsx     # Sidebar + Header + Footer + FloatingChat
│   │   │       ├── page.tsx       # Home — Active Hiring Feed
│   │   │       ├── adam/          # Adam Chat + Knowledge Base
│   │   │       ├── companies/     # Company List + Deep Search + Detail
│   │   │       ├── signals/       # LinkedIn Signals Feed
│   │   │       ├── browse/        # GitHub Job Board
│   │   │       ├── mercury/       # Campaigns, Pipeline Kanban, Email Review
│   │   │       ├── analytics/     # Metrics Dashboard
│   │   │       ├── logs/          # Activity Logs
│   │   │       └── settings/      # Profile + API Keys
│   │   │
│   │   ├── components/
│   │   │   ├── layout/            # Header, Sidebar, Footer
│   │   │   ├── chat/              # FloatingChat
│   │   │   ├── theos/             # DeepSearchProgress
│   │   │   ├── notifications/     # NotificationPanel
│   │   │   └── providers.tsx      # TanStack Query + Auth
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts             # API client (fetch, upload, SSE, helpers)
│   │   │   └── utils.ts           # Utility functions
│   │   │
│   │   ├── stores/
│   │   │   ├── useAuthStore.ts    # Auth state (Zustand)
│   │   │   └── useNotificationStore.ts  # Notification state (Zustand)
│   │   │
│   │   └── types/
│   │       └── index.ts           # Shared TypeScript types
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
│
├── linkedin_scraper/              # LinkedIn scraping package (vendored)
├── TECHNICAL_DOCUMENTATION.md     # Full internal engineering specification
└── README.md                      # You are here
```

---

## API Overview

| Module | Prefix | Key Endpoints |
|---|---|---|
| **Auth** | `/api/auth` | `POST /register`, `POST /login`, `GET /me`, `PATCH /me` |
| **Adam** | `/api/adam` | `POST /upload-resume` (SSE), `POST /chat`, `GET /profile`, `WS /interview/ws` |
| **Theos** | `/api/theos` | `GET /companies`, `POST /deepsearch/start`, `GET /deepsearch/{id}/stream` (SSE), `GET /github-jobs` |
| **Mercury** | `/api/mercury` | `POST /campaigns`, `POST /emails/{id}/approve`, `POST /emails/{id}/send`, `GET /pipeline` |
| **Knowledge** | `/api/knowledge` | `GET /search`, `POST /entries`, `PATCH /entries/{id}` |
| **Chat** | `/api/chat` | `POST /sessions`, `POST /sessions/{id}/messages` |
| **Notifications** | `/api/notifications` | `GET /`, `POST /mark-read` |
| **Analytics** | `/api` | `GET /analytics`, `GET /logs` |
| **Settings** | `/api/settings` | `GET /providers`, `PUT /providers/gemini` |

---

## Real-Time Communication

| Mechanism | Endpoint | Purpose |
|---|---|---|
| **SSE** | `POST /api/adam/upload-resume` | Resume processing step-by-step updates |
| **SSE** | `GET /api/theos/deepsearch/{id}/stream` | Deep search progress (query > research > reflection > results) |
| **WebSocket** | `WS /api/adam/interview/ws` | Bidirectional audio stream for voice interview (binary MP3 + JSON control) |
| **Polling** | `GET /api/notifications/unread-count` | Notification badge (every 5s) |

---

## The Bigger Picture

Agnostos isn't just a tool — it's a shift in how people approach career opportunities. The traditional model (apply to postings, wait, repeat) leaves the best opportunities on the table. Companies that just raised funding are actively building teams, but they often don't have formal job listings yet.

```mermaid
graph TB
    subgraph TRADITIONAL["Traditional Job Search"]
        JB[Job Board] --> APPLY[Apply to 100+ listings]
        APPLY --> ATS[Pass through ATS filters]
        ATS --> WAIT[Wait weeks for response]
        WAIT --> GHOST[Mostly ghosted]
    end

    subgraph AGNOSTOS_WAY["The Agnostos Way"]
        DISCOVER[AI discovers funded companies] --> RESEARCH[Deep research on each one]
        RESEARCH --> MATCH[Semantic matching to your profile]
        MATCH --> REACH[Personalized email to decision-makers]
        REACH --> TRACK[Track, follow-up, iterate]
        TRACK --> CONV[Higher conversion through personalization]
    end

    style TRADITIONAL fill:#7f1d1d,color:#fca5a5
    style AGNOSTOS_WAY fill:#14532d,color:#a7f3d0
```

The platform is designed to **scale with the user** — from a single person exploring opportunities to (eventually) teams managing outreach across hundreds of companies simultaneously. Every component is built with extensibility in mind: swap LLMs, add new data sources, plug in new email providers, or build custom scoring algorithms.

---

<p align="center">
  <strong>Built with conviction that the best jobs aren't found — they're created.</strong>
</p>
