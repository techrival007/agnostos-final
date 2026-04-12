# Agnostos

**The hidden job market, decoded by AI.**

---

## The Problem

Over 70% of jobs are never publicly posted. They live in referral chains, internal Slack channels, investor updates, and quiet LinkedIn conversations. Traditional job boards only scratch the surface, and most job seekers spend weeks applying to the same overcrowded listings as everyone else.

The hidden job market isn't hidden because it's secret — it's hidden because accessing it requires research, relationships, and relentless outreach that most people simply don't have time for.

## The Vision

Agnostos is an AI-powered platform that gives every job seeker the same unfair advantage that well-connected insiders have always had. It automates the entire journey — from deeply understanding who you are, to discovering companies before they post, to crafting personalized outreach that actually gets replies.

Three specialized AI agents work together as your career intelligence team:

---

## The Three Agents

### Adam — The Profile Architect

Adam is the agent that *knows you*. Through conversational onboarding, resume parsing, LinkedIn profile analysis, and even voice-based mock interviews, Adam builds a rich, structured understanding of your skills, experience, goals, and personality.

- **Resume Intelligence** — Upload a PDF and Adam extracts structured data: roles, skills, education, achievements
- **LinkedIn Scraping** — Connect your LinkedIn profile for a deeper professional snapshot
- **Conversational Onboarding** — A guided chat that captures what resumes can't: your motivations, preferred culture, deal-breakers
- **Voice Interviews** — Real-time voice sessions powered by Deepgram for interview practice and deeper profile enrichment
- **Knowledge Ingestion** — Everything Adam learns feeds into a personal knowledge base with semantic search (pgvector embeddings)

### Theos — The Opportunity Engine

Theos is the research agent. It continuously discovers companies, tracks hiring signals, and surfaces opportunities that match your profile — before they're posted publicly.

- **Company Discovery** — Browse and search a growing database of target companies with detailed profiles
- **Hiring Signals** — Track funding rounds, leadership changes, team growth, and other indicators that a company is about to hire
- **Deep Search** — A LangGraph-powered multi-step agent that autonomously researches companies, enriches data, and finds hidden opportunities across the web
- **GitHub Job Listings** — Automated scraping of curated open-source job boards for fresh postings
- **Contact Intelligence** — Identify key decision-makers and hiring managers at target companies

### Mercury — The Outreach Commander

Mercury turns opportunities into conversations. It manages multi-step outreach campaigns with AI-generated, hyper-personalized emails — and can send them directly from your inbox.

- **Campaign Management** — Create, organize, and track outreach campaigns across target companies
- **AI Email Generation** — Gemini-powered drafts that reference specific company signals, your background, and mutual connections
- **Pipeline Tracking** — A Kanban-style board with stages: Draft → Approved → Sent → Opened → Replied → Meeting → Offer
- **Inbox Integration** — Connect Gmail or Outlook via Nylas OAuth to send and track emails natively
- **Webhook Tracking** — Real-time delivery and engagement tracking through Nylas webhooks

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│           Next.js 16 · React 19 · Tailwind 4        │
│         Zustand · TanStack Query · dnd-kit          │
└──────────────────────┬──────────────────────────────┘
                       │ REST + JWT
┌──────────────────────▼──────────────────────────────┐
│                    Backend                           │
│              FastAPI · SQLAlchemy 2 Async            │
│                                                      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  Adam   │ │  Theos  │ │ Mercury  │ │   Chat   │ │
│  │ Profile │ │ Search  │ │ Outreach │ │ Assistant│ │
│  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬─────┘ │
│       │           │           │             │        │
│  ┌────▼───────────▼───────────▼─────────────▼─────┐ │
│  │          Shared Services Layer                  │ │
│  │  Gemini AI · Knowledge Base · Auth · Analytics  │ │
│  └────────────────────┬───────────────────────────┘ │
└───────────────────────┼─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              PostgreSQL (Supabase)                    │
│           pgvector · 768-dim embeddings              │
└──────────────────────────────────────────────────────┘
```

### Frontend

| Technology | Purpose |
|---|---|
| **Next.js 16** | App Router, SSR, file-based routing |
| **React 19** | UI rendering with latest concurrent features |
| **Tailwind CSS 4** | Utility-first styling |
| **Zustand** | Lightweight global state (auth, notifications) |
| **TanStack Query** | Server state, caching, and localStorage persistence |
| **@dnd-kit** | Drag-and-drop for the Mercury pipeline board |
| **Lucide React** | Icon system |

### Backend

| Technology | Purpose |
|---|---|
| **FastAPI** | Async REST API with automatic OpenAPI docs |
| **SQLAlchemy 2 (async)** | ORM with asyncpg driver for PostgreSQL |
| **Pydantic v2** | Request/response validation and settings management |
| **LangGraph + LangChain** | Multi-step agent orchestration for Deep Search |
| **Google Gemini** | LLM for chat, structured extraction, email generation, and embeddings |
| **Deepgram** | Real-time speech-to-text and text-to-speech for voice interviews |
| **Nylas** | Email OAuth, send, and webhook tracking |
| **Selenium + lxml** | LinkedIn profile scraping |
| **PyMuPDF** | PDF resume parsing |
| **pgvector** | Vector similarity search for the knowledge base |

---

## Key Pages & Flows

| Route | Description |
|---|---|
| `/auth` | Login and registration |
| `/onboarding` | Multi-step onboarding: resume upload → voice interview → profile review |
| `/` | Dashboard home with overview metrics |
| `/adam` | Profile management, chat-based refinement, knowledge base |
| `/adam/interview` | Real-time voice interview with AI |
| `/browse` | Discover and explore companies |
| `/companies/:id` | Deep-dive into a specific company: contacts, signals, jobs |
| `/signals` | Hiring signal feed across tracked companies |
| `/mercury` | Outreach campaign management and email drafts |
| `/pipeline` | Kanban board tracking outreach status |
| `/analytics` | Outreach metrics, profile completeness, activity logs |
| `/logs` | Detailed activity log history |
| `/settings` | API key management, provider status, inbox connection |

---

## Design Principles

- **Graceful Degradation** — Every external service (Gemini, Deepgram, Nylas) is optional. The platform runs with mock responses when API keys aren't configured, making local development frictionless.
- **Semantic Memory** — The knowledge base isn't just storage. Every piece of information is embedded as a 768-dimensional vector, enabling genuine semantic search across your entire professional context.
- **Agent Autonomy** — Deep Search doesn't just call an API. It's a LangGraph state machine that plans, researches, validates, and enriches data across multiple steps autonomously.
- **Real Pipeline, Real Email** — Mercury isn't a demo. Connect your inbox via Nylas and it sends real emails, tracks opens, and updates pipeline stages automatically.

---

## Getting Started

See the [setup instructions in the README](./README.md) for installation, environment configuration, and running the platform locally.

---

*Agnostos — because the best opportunities were never meant to stay hidden.*
