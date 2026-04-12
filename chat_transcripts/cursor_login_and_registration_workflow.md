# Login and registration workflow enhancement
_Exported on 4/12/2026 at 06:02:03 GMT+5:30 from Cursor (3.0.16)_

---

**User**

update the login page. also have the register page there. 
after user registers. i want to have a workflow types screen progression before reaching the dashboard.
in the progression. adam will ask for the resume in the form of pdf, then linkedin url. then integrat3e it witht he gemini 3.1 flash. read the cv and linkedin throughly and add it in the dynamic knowledge-base. VERY CRITICALY THOROUGH.
then go to the next stage. ask for a 10min interview. use the deepgram. i have added the deeptgram api in .env. use the stt and tts.
https://github.com/deepgram/deepgram-python-sdk?tab=readme-ov-file#installation 
read this implement it. its the deepgram python sdk. for the tts and stt.
then get the transcript and store it in the database. make a another table for the transcripts which will be stored for each particualr user as user can also interact with adam in future in the form of interview.
aftre getting the transcript. sue gemini 3.1 flash to analyse it and store it in the knowedlge base
use the standard get to know professional approx 10 question in the interview. serarch over internet find these qeusiton or get help.

then the user proceed it forward to the set of quesiton which he just answered in the interview. he can edit and tell more there. the queston answer which are got form teh analysed transcript. 

add a floating adam chatbox also. so i can chat with him anytime. and give him the access to the knowledge-base. 
make knowledge base dynamic in the postgres. it should have semantic search and standard practice should be applicable.

dont use pre filled chat history. update to have chat sessions, use can add more chat sessions. chat sessions will be stored in the databse again. everything should be dynamic. create backend connections as per necessary as possible. with the frontend, and supabse postgres. 
also check for the supabase connectivity.

ask anythign before proceeding. must. 

---

**Cursor**

Let me explore the codebase first to understand the current architecture before asking questions.

Let me read a few more key files to understand the current implementation details.

Let me check a few more files for the existing adam interview page and database models.

I've thoroughly explored the codebase. Before creating the plan, I have a couple of critical clarifications needed.

**Clarifications Before Planning**

> **"Gemini 3.1 Flash" doesn't exist as a model name. The codebase currently uses gemini-2.0-flash. Which Gemini model do you want?**
> - gemini-2.0-flash (current, fast and capable)
> - gemini-1.5-flash (older, cheaper)
> - gemini-2.5-flash (latest flash model)
>
> Answer: use the gemini 2.5 pro for analyse and resume pdf and linekdin. and use gemini 2.5 flash for the chatbox queries.

> **For LinkedIn URL processing: scraping LinkedIn requires a paid API like Proxycurl (~$0.01/request). How do you want to handle LinkedIn data extraction?**
> - User pastes their LinkedIn profile text manually (free, reliable)
> - Use Proxycurl API to scrape LinkedIn (paid, requires API key)
> - Just store the URL, no extraction - rely on CV + interview only
>
> Answer: https://github.com/joeyism/linkedin_scraper use this for the linkedin profile scraping

Now I have all the context I need. Let me create the plan.

---

**User**

also structure the architecutre better for the codebase. the structre be seperate for each agents, seperate folders. for each agent, and the adam. update the architecture.

---

**Cursor**

Now I have a complete picture of the codebase and all requirements. Let me search for the standard professional interview questions before finalizing the plan.

Now I have everything needed. Let me create the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Let me start implementing the plan. I'll begin with the backend architecture restructure.

First, let me read all the existing backend files I need to move, then I'll create the new structure in parallel.

Now let me read the remaining model files.

Now I have a complete picture of all existing code. Let me create the new agent-based directory structure. I'll create all the new files in parallel batches.

**Batch 1: shared/, auth/, and __init__.py files**

**Batch 2: adam/, theos/, mercury/ modules**

Now create `knowledge/` and `chat/` module stubs and update `main.py`:

Now delete the old directory structure:

Now update the `seed.py` file to reference the new model locations:

Backend restructure is complete. Now let me mark that todo and move to the next ones. I'll work on multiple tasks in parallel using subagents.

Now I'll work on DB models (knowledge + chat), shared services, and requirements in parallel:

Now update `main.py` to import the new models and register the new routers:

Now build the knowledge and chat routers/services, then tackle the frontend. Let me create all backend modules in parallel:

Now let me build the interview WebSocket handler and the onboarding upload endpoint:

Now add the WebSocket route and enhanced upload endpoint to the adam router:

Now add the new endpoints at the end of the adam router:

Backend is complete. Now let me tackle the frontend. I'll read the existing frontend files I need, then build everything.

Now I'll update the types, create the auth page, onboarding pages, and floating chatbox. I'll dispatch subagents for the frontend work:

Now create all the frontend pages. I'll build them in parallel batches:

Now create the onboarding pages:

Now create the floating chatbox component and update the dashboard layout:

Now update the dashboard layout to include FloatingChat and add onboarding redirect:

Now delete the old separate login and register pages since we have the combined auth page:

Now let me update the `apiFetch` to handle the redirect to the new auth page path, and fix any references to `/login`:

Now let me check the sidebar for any `/login` references:

Good, the only `/login` reference is the API endpoint path which is correct. Let me check the sidebar/header for navigation references:

Good, sidebar is clean. Now let me update all the remaining todos and verify the existing `(auth)` page acts as the landing/login page. The Next.js `(auth)` route group with `page.tsx` will be accessible at the root `/` path. But we already have a `(dashboard)` route group with `page.tsx` also at `/`. I need to handle this differently.

The `(auth)` route group cannot also serve `/` since `(dashboard)/page.tsx` already handles that. I'll keep the auth page at a dedicated path instead:

I need to fix the routing. The `(auth)` route group conflicts with `(dashboard)` since both map to `/`. Let me move the auth page to `/auth`:

Now clean up the empty old login/register directories:

Also remove the empty old backend directories:

Now let me install the new backend dependencies and verify things compile:

Good, dependencies installed. Now let me mark the remaining todos and verify the frontend builds:

Let me verify the frontend builds correctly:

Frontend builds successfully with all the new routes. Let me also verify the backend can start by doing a quick syntax check:

All Python files parse correctly. Let me also check the `adam/parser.py` uses the correct import for `generate_structured` since I updated the signature:

Good. The `generate_structured` function still works without the `use_pro` kwarg since it defaults to `False`. Let me verify the final directory structure looks right:

Everything is in place. Let me do a final check on the `auth/page.tsx` to make sure it redirects properly when a logged-in user navigates to it:

I need to add a redirect for already-authenticated users who visit `/auth`:

Let me do a final build check to make sure everything still compiles:

Everything builds cleanly. Here's a summary of everything that was implemented:

---

**Backend Architecture Restructure** -- Moved from flat `routers/models/schemas/services/` into agent-centric modules:
- `auth/` -- JWT auth (router, schemas, service)
- `adam/` -- Adam agent (router, schemas, models, parser, interview WebSocket)
- `theos/` -- Theos agent (router, schemas, models)
- `mercury/` -- Mercury agent (router, schemas, models)
- `knowledge/` -- Dynamic knowledge base with pgvector (router, schemas, service, models)
- `chat/` -- Chat sessions for floating chatbox (router, schemas, service, models)
- `analytics/` -- Analytics endpoints (router, schemas)
- `shared/` -- Shared models (User, ActivityLog), Gemini (dual model), Deepgram STT/TTS, LinkedIn scraper

**New Database Models:**
- `InterviewTranscript` -- raw + analyzed interview data per user
- `KnowledgeEntry` -- pgvector-backed semantic search entries (768-dim embeddings via `text-embedding-004`)
- `ChatSession` / `ChatMessage` -- persistent chat sessions for the floating chatbox
- Added `onboarding_completed` and `onboarding_step` to `UserProfile`

**Shared Services:**
- `shared/gemini.py` -- `gemini-2.5-pro` for analysis, `gemini-2.5-flash` for chat, `text-embedding-004` for embeddings
- `shared/deepgram.py` -- STT (nova-3), TTS (aura-2), live streaming support
- `shared/linkedin.py` -- `linkedin_scraper` v3 wrapper with Playwright

**Auth Page** -- Combined login/register at `/auth` with tabbed UI, onboarding redirect logic

**Onboarding Progression:**
- `/onboarding/resume` -- PDF upload + LinkedIn URL, Gemini 2.5 Pro analysis, knowledge base ingestion
- `/onboarding/interview` -- WebSocket voice interview with Deepgram STT/TTS, 10 adaptive questions via Gemini 2.5 Pro, transcript analysis
- `/onboarding/review` -- Edit extracted Q&A, re-analyze, complete onboarding

**Floating Adam Chatbox** -- `FloatingChat` component in dashboard layout, multiple sessions, KB-augmented responses via Gemini 2.5 Flash

**Supabase Health** -- DB connectivity check on startup, pgvector extension auto-creation, `/api/health/db` endpoint

**New API Endpoints:**
- `POST /api/adam/upload-resume`, `GET/PATCH /api/adam/onboarding/*`
- `WS /api/adam/interview/ws`, `GET /api/adam/interview/transcript`, `PATCH /api/adam/interview/answers`
- `GET/POST/PATCH/DELETE /api/knowledge/*`, `GET /api/knowledge/search`
- `GET/POST/DELETE /api/chat/sessions/*`, `GET/POST /api/chat/sessions/{id}/messages`

