"""
Seed script -- populates the database with realistic fake data.
Run: python seed.py
"""
import asyncio
import uuid
from datetime import datetime, timedelta, date, timezone
from sqlalchemy import text
from database import engine, async_session, Base
from shared.models import User, ActivityLog
from adam.models import UserProfile, AdamConversation, InterviewTranscript
from theos.models import Company, CompanyResearch, Contact, LinkedInSignal, JobListing
from mercury.models import Campaign, OutreachEmail, FollowupSchedule
from auth.service import hash_password
import chat.models  # noqa: F401
import knowledge.models  # noqa: F401


async def seed():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # --- USER ---
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="test@agnostos.com",
            password_hash=hash_password("password123"),
            name="Arjun Mehta",
        )
        db.add(user)

        # --- USER PROFILE ---
        profile = UserProfile(
            user_id=user_id,
            parsed_skills={
                "technical": ["Python", "React", "TypeScript", "FastAPI", "PostgreSQL", "Docker", "AWS", "Kafka", "Redis", "Next.js"],
                "soft": ["Leadership", "Problem Solving", "Technical Communication", "Mentoring"]
            },
            parsed_experience=[
                {"company": "Zephyr AI", "role": "Senior Backend Engineer", "duration_months": 18, "start_date": "2024-10", "end_date": "present", "description": "Led backend architecture for AI-powered analytics platform serving 50K users", "tech_used": ["Python", "FastAPI", "PostgreSQL", "Redis", "Kafka"]},
                {"company": "NovaTech Solutions", "role": "Full Stack Developer", "duration_months": 24, "start_date": "2022-10", "end_date": "2024-09", "description": "Built real-time collaboration tools and data pipelines for enterprise clients", "tech_used": ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"]},
                {"company": "StartupXYZ", "role": "Software Engineer Intern", "duration_months": 6, "start_date": "2022-04", "end_date": "2022-09", "description": "Developed customer-facing dashboard and internal tooling", "tech_used": ["React", "Python", "Flask"]},
            ],
            parsed_projects=[
                {"name": "DataFlow Engine", "description": "Real-time data processing pipeline handling 1M events/day with exactly-once semantics", "tech": ["Python", "Kafka", "PostgreSQL"], "url": "github.com/arjun/dataflow", "context": "built at Zephyr AI"},
                {"name": "CollabSpace", "description": "Real-time collaborative whiteboard with WebSocket sync and conflict resolution", "tech": ["React", "TypeScript", "WebSocket", "Redis"], "url": "", "context": "built at NovaTech"},
                {"name": "AuthGuard", "description": "Zero-downtime auth migration framework for microservices", "tech": ["FastAPI", "Redis", "JWT", "PostgreSQL"], "url": "", "context": "side project"},
                {"name": "MetricsDash", "description": "Internal analytics dashboard used by 30+ team members daily", "tech": ["React", "D3.js", "TypeScript"], "url": "", "context": "built at Zephyr AI"},
            ],
            parsed_education=[{"institution": "IIT Delhi", "degree": "B.Tech", "field": "Computer Science", "year": "2022"}],
            proof_points=[
                {"title": "DataFlow Engine", "project": "Real-time data processing pipeline", "problem": "Company had no way to process streaming data at scale, causing 4-hour delays in analytics", "impact": "Handles 1M events/day with 99.9% uptime, reduced processing latency from 4 hours to 12 seconds", "tech": ["Python", "Kafka", "PostgreSQL"], "context": "startup", "highlight": True},
                {"title": "Zero-Downtime Auth Migration", "project": "AuthGuard framework", "problem": "Legacy auth caused 2-hour monthly outages and was a security liability", "impact": "Migrated 50K users with zero downtime, eliminated monthly auth outages completely", "tech": ["FastAPI", "Redis", "JWT"], "context": "startup", "highlight": True},
                {"title": "CollabSpace Real-time Engine", "project": "WebSocket sync with CRDT conflict resolution", "problem": "Existing collab tools had 3-5 second lag, users constantly overwrote each other", "impact": "Sub-100ms sync latency, 40% increase in team collaboration metrics", "tech": ["React", "TypeScript", "WebSocket", "Redis"], "context": "startup", "highlight": True},
                {"title": "MetricsDash", "project": "Internal analytics dashboard", "problem": "Product team had no visibility into user behavior, relied on ad-hoc SQL queries", "impact": "Used by 30 internal users daily, directly drove 3 major product decisions", "tech": ["React", "D3.js", "TypeScript"], "context": "startup", "highlight": False},
                {"title": "CI/CD Pipeline Overhaul", "project": "Build pipeline optimization", "problem": "CI builds took 45 minutes, developers avoided running tests", "impact": "Reduced build time to 8 minutes, test coverage went from 40% to 85%", "tech": ["Docker", "GitHub Actions", "Python"], "context": "startup", "highlight": False},
            ],
            soft_profile={
                "personality": "Quiet intensity. Thinks deeply, speaks precisely. Gets genuinely excited about elegant architecture.",
                "communication_style": "technical",
                "core_motivations": ["Building things that work at scale", "Solving problems nobody has tackled", "Working with smart people"],
                "ambitions": {"short_term": "Lead engineering at an early-stage startup", "long_term": "CTO of a company solving real infrastructure problems"},
                "differentiators": ["Can go from system design to shipping production code in the same day", "Obsessed with reliability and observability"],
            },
            what_they_bring="Backend architect who's built production systems handling 1M+ events/day. Strong at Python, distributed systems, and going from zero to shipped. Has a track record of solving infrastructure problems that directly unlock product growth.",
            preferred_roles=["Senior Backend Engineer", "Founding Engineer", "Staff Engineer"],
            preferred_stages=["seed", "series-a"],
            preferred_sectors=["AI/ML", "Developer Tools", "Infrastructure", "FinTech"],
            location="Bangalore, India",
            open_to_relocation=True,
            tone_formal=4,
            tone_technical=7,
            interview_completed=True,
            interview_turns=12,
        )
        db.add(profile)

        # --- COMPANIES ---
        now = datetime.now(timezone.utc)

        companies_data = [
            {"name": "NeuralForge", "website": "https://neuralforge.ai", "stage": "seed", "funding_amount_usd": 4200000, "funding_date": date(2026, 3, 15), "investors": ["Y Combinator", "Sequoia Scout"], "sector": ["AI/ML", "Developer Tools"], "hq_location": "San Francisco, CA", "headcount": 12, "tech_stack": ["Python", "PyTorch", "FastAPI", "PostgreSQL", "Kubernetes"], "hiring_score": 85, "research_summary": "NeuralForge is building an AI model optimization platform that reduces inference costs by 10x. Recently closed a $4.2M seed round led by YC. Actively hiring backend engineers and ML infra roles. CEO posted about scaling challenges last week.", "source": "yc", "source_batch": "W26"},
            {"name": "Gridware", "website": "https://gridware.io", "stage": "series-a", "funding_amount_usd": 18000000, "investors": ["a16z", "Lightspeed"], "sector": ["Infrastructure", "Climate Tech"], "hq_location": "Austin, TX", "headcount": 45, "tech_stack": ["Go", "Python", "React", "PostgreSQL", "Kafka", "AWS"], "hiring_score": 72, "research_summary": "Gridware builds real-time monitoring for power grid infrastructure. Series A closed 2 months ago. Blog post about their data pipeline challenges. 8 open engineering roles on their careers page.", "source": "crunchbase", "funding_date": date(2026, 1, 20)},
            {"name": "Payflow", "website": "https://payflow.in", "stage": "seed", "funding_amount_usd": 2800000, "investors": ["Accel India", "Angel investors"], "sector": ["FinTech", "B2B SaaS"], "hq_location": "Bangalore, India", "headcount": 8, "tech_stack": ["Python", "FastAPI", "React", "PostgreSQL", "Redis"], "hiring_score": 90, "research_summary": "Payflow automates invoice processing for SMBs in India. Just closed seed round. Founder posted about looking for 'founding engineers who think in systems'. Very early stage, high signal.", "source": "inc42", "funding_date": date(2026, 3, 28)},
            {"name": "DocuMind", "website": "https://documind.co", "stage": "series-a", "funding_amount_usd": 12500000, "investors": ["Index Ventures", "Bessemer"], "sector": ["AI/ML", "Enterprise"], "hq_location": "London, UK", "headcount": 35, "tech_stack": ["Python", "TypeScript", "Next.js", "PostgreSQL", "OpenAI", "Pinecone"], "hiring_score": 65, "research_summary": "DocuMind uses AI to extract and understand enterprise documents. Series A 4 months ago. Growing steadily. Recent product update added multi-language support. Looking for senior engineers.", "source": "crunchbase", "funding_date": date(2025, 12, 5)},
            {"name": "Orbital", "website": "https://orbital.dev", "stage": "pre-seed", "funding_amount_usd": 850000, "investors": ["Entrepreneur First", "Angels"], "sector": ["Developer Tools", "DevOps"], "hq_location": "Berlin, Germany", "headcount": 4, "tech_stack": ["Rust", "TypeScript", "React", "PostgreSQL"], "hiring_score": 55, "research_summary": "Orbital is building a next-gen CI/CD platform with 100x faster builds using Rust-based containerization. Pre-seed, very early. Founded by ex-GitHub engineers. Looking for generalists.", "source": "ef"},
        ]

        company_objects = []
        for cd in companies_data:
            c = Company(**cd)
            db.add(c)
            company_objects.append(c)

        await db.flush()

        # --- COMPANY RESEARCH ---
        research_data = [
            {"company": company_objects[0], "recent_news": [{"headline": "NeuralForge raises $4.2M to make AI inference 10x cheaper", "url": "https://techcrunch.com/neuralforge", "date": "2026-03-15", "summary": "YC-backed NeuralForge closed seed round to build model optimization platform"}], "blog_posts": [{"title": "Why We're Building NeuralForge", "url": "https://neuralforge.ai/blog/why", "date": "2026-03-20", "summary": "Founder explains the cost problem in AI inference"}], "founder_posts": [{"author": "Sarah Chen", "content": "We just shipped our beta and the results are wild -- 8x cost reduction on GPT-4 workloads. Hiring backend engineers who want to work on this.", "date": "2026-04-01"}], "job_postings": [{"title": "Senior Backend Engineer", "url": "https://neuralforge.ai/careers/sbe", "department": "Engineering", "date": "2026-03-25"}, {"title": "ML Infrastructure Engineer", "url": "https://neuralforge.ai/careers/mle", "department": "ML", "date": "2026-03-25"}]},
            {"company": company_objects[1], "recent_news": [{"headline": "Gridware secures $18M Series A for power grid monitoring", "url": "https://gridware.io/news", "date": "2026-01-20", "summary": "a16z leads round for climate tech infrastructure startup"}], "blog_posts": [{"title": "Scaling Our Data Pipeline to 10B Events/Day", "url": "https://gridware.io/blog/scaling", "date": "2026-02-15", "summary": "Technical deep-dive into Kafka + Go architecture for real-time grid data"}], "founder_posts": [{"author": "Mike Torres", "content": "Looking for engineers who are excited about building infrastructure that actually matters. Our monitoring system just prevented a blackout in Texas.", "date": "2026-03-10"}], "job_postings": [{"title": "Senior Software Engineer - Backend", "url": "https://gridware.io/careers/sse", "department": "Engineering", "date": "2026-03-01"}, {"title": "Data Engineer", "url": "https://gridware.io/careers/de", "department": "Data", "date": "2026-03-01"}]},
            {"company": company_objects[2], "recent_news": [{"headline": "Payflow raises $2.8M to automate invoicing for Indian SMBs", "url": "https://inc42.com/payflow", "date": "2026-03-28", "summary": "Accel-backed Payflow targets India's $50B invoice processing market"}], "founder_posts": [{"author": "Rahul Verma", "content": "We're 3 engineers building for millions of businesses. Looking for founding engineers who think in systems and ship fast. DM me.", "date": "2026-04-05"}], "job_postings": [{"title": "Founding Engineer", "url": "https://payflow.in/careers/fe", "department": "Engineering", "date": "2026-04-01"}]},
            {"company": company_objects[3], "blog_posts": [{"title": "Introducing Multi-Language Document Understanding", "url": "https://documind.co/blog/multilang", "date": "2026-02-28", "summary": "DocuMind now supports 40+ languages for enterprise document AI"}], "product_updates": [{"title": "v2.3 - Multi-language + Table Extraction", "date": "2026-02-28", "summary": "Major update adding language support and improved table extraction accuracy"}], "job_postings": [{"title": "Senior Full Stack Engineer", "url": "https://documind.co/careers/sfs", "department": "Product", "date": "2026-03-15"}]},
            {"company": company_objects[4], "founder_posts": [{"author": "Lena Weber", "content": "Built our first prototype in Rust. 200x faster container startup than Docker. Now we need help making it production-ready. Generalists welcome.", "date": "2026-03-20"}]},
        ]

        for rd in research_data:
            cr = CompanyResearch(
                company_id=rd["company"].id,
                recent_news=rd.get("recent_news"),
                blog_posts=rd.get("blog_posts"),
                founder_posts=rd.get("founder_posts"),
                product_updates=rd.get("product_updates"),
                job_postings=rd.get("job_postings"),
            )
            db.add(cr)

        # --- CONTACTS ---
        contacts_data = [
            {"company": company_objects[0], "name": "Sarah Chen", "role": "CEO & Co-founder", "seniority": "c_suite", "professional_email": "sarah@neuralforge.ai", "is_founder": True, "tenure_months": 18, "linkedin_url": "https://linkedin.com/in/sarahchen-nf"},
            {"company": company_objects[0], "name": "Raj Patel", "role": "CTO & Co-founder", "seniority": "c_suite", "professional_email": "raj@neuralforge.ai", "is_founder": True, "tenure_months": 18, "linkedin_url": "https://linkedin.com/in/rajpatel-nf"},
            {"company": company_objects[1], "name": "Mike Torres", "role": "CEO", "seniority": "c_suite", "professional_email": "mike@gridware.io", "is_founder": True, "tenure_months": 30, "linkedin_url": "https://linkedin.com/in/miketorres"},
            {"company": company_objects[1], "name": "Priya Sharma", "role": "VP Engineering", "seniority": "vp", "professional_email": "priya@gridware.io", "is_founder": False, "tenure_months": 8, "is_new_recruit": True, "linkedin_url": "https://linkedin.com/in/priyasharma-gw"},
            {"company": company_objects[2], "name": "Rahul Verma", "role": "Founder & CEO", "seniority": "c_suite", "professional_email": "rahul@payflow.in", "is_founder": True, "tenure_months": 12, "linkedin_url": "https://linkedin.com/in/rahulverma-pf"},
            {"company": company_objects[2], "name": "Anika Das", "role": "Co-founder & CTO", "seniority": "c_suite", "professional_email": "anika@payflow.in", "is_founder": True, "tenure_months": 12, "linkedin_url": "https://linkedin.com/in/anikadas"},
            {"company": company_objects[3], "name": "James Wright", "role": "Head of Engineering", "seniority": "director", "professional_email": "james@documind.co", "is_founder": False, "tenure_months": 14, "linkedin_url": "https://linkedin.com/in/jameswright-dm"},
            {"company": company_objects[3], "name": "Elena Rossi", "role": "Senior Engineer", "seniority": "senior", "professional_email": "elena@documind.co", "is_founder": False, "tenure_months": 3, "is_new_recruit": True, "linkedin_url": "https://linkedin.com/in/elenarossi"},
            {"company": company_objects[4], "name": "Lena Weber", "role": "Founder & CEO", "seniority": "c_suite", "professional_email": "lena@orbital.dev", "is_founder": True, "tenure_months": 8, "linkedin_url": "https://linkedin.com/in/lenaweber-orbital"},
            {"company": company_objects[4], "name": "Tom Fischer", "role": "Co-founder & Engineer", "seniority": "senior", "professional_email": "tom@orbital.dev", "is_founder": True, "tenure_months": 8, "linkedin_url": "https://linkedin.com/in/tomfischer"},
        ]

        contact_objects = []
        for cd in contacts_data:
            company = cd.pop("company")
            c = Contact(company_id=company.id, email_confidence_score=0.95, email_source="apollo", **cd)
            db.add(c)
            contact_objects.append(c)

        await db.flush()

        # --- CAMPAIGNS ---
        campaign1 = Campaign(user_id=user_id, company_id=company_objects[2].id, status="active",
                            tone_settings={"formal": 3, "technical": 7}, last_activity_at=now - timedelta(hours=2))
        campaign2 = Campaign(user_id=user_id, company_id=company_objects[0].id, status="queued",
                            tone_settings={"formal": 5, "technical": 8})
        campaign3 = Campaign(user_id=user_id, company_id=company_objects[1].id, status="active",
                            tone_settings={"formal": 5, "technical": 6}, last_activity_at=now - timedelta(days=2))
        db.add_all([campaign1, campaign2, campaign3])
        await db.flush()

        # --- OUTREACH EMAILS ---
        emails = [
            OutreachEmail(campaign_id=campaign1.id, contact_id=contact_objects[4].id,
                subject="Your approach to SMB invoicing + a thought",
                body="Rahul -- saw your post about looking for founding engineers who think in systems. That's exactly what I do.\n\nAt Zephyr AI, I built a data pipeline that processes 1M events/day with exactly-once semantics. Before that, I led a zero-downtime auth migration for 50K users.\n\nPayflow's invoice processing problem is a systems problem at its core -- scale, reliability, real-time processing. That's my wheelhouse.\n\nWould love 15 minutes to hear where you're headed architecturally.",
                subject_options=["Your approach to SMB invoicing + a thought", "Founding engineer who thinks in systems", "Re: your LinkedIn post about Payflow"],
                tone_settings={"formal": 3, "technical": 7}, relevance_score=92.5,
                relevant_projects=[{"title": "DataFlow Engine", "reason": "Direct parallel to invoice processing scale"}, {"title": "Zero-Downtime Auth Migration", "reason": "Shows reliability focus"}],
                hook_used="Saw founder post about looking for founding engineers", status="sent",
                sent_at=now - timedelta(days=3)),
            OutreachEmail(campaign_id=campaign1.id, contact_id=contact_objects[5].id,
                subject="Your CTO perspective on Payflow's architecture",
                body="Anika -- Payflow's approach to automating invoice processing for Indian SMBs caught my attention. The scale of this market is enormous.\n\nI've been building backend systems at Zephyr AI -- most recently a streaming pipeline handling 1M events/day. Before that, I built collaborative real-time tools at NovaTech.\n\nI'd love to understand how you're thinking about Payflow's technical architecture as you scale. Happy to share ideas from building similar systems.\n\n15 minutes?",
                subject_options=["Your CTO perspective on Payflow's architecture", "Systems thinking for invoice processing", "Fellow backend engineer -- quick question"],
                tone_settings={"formal": 3, "technical": 7}, relevance_score=88.0,
                hook_used="Company just raised seed round", status="opened",
                opened_at=now - timedelta(days=1), sent_at=now - timedelta(days=3)),
            OutreachEmail(campaign_id=campaign2.id, contact_id=contact_objects[0].id,
                subject="NeuralForge's inference optimization + my background",
                body="Sarah -- read your blog post about why you're building NeuralForge. The 8x cost reduction numbers are impressive.\n\nI've been building high-throughput backend systems at Zephyr AI (1M events/day pipeline, zero-downtime migrations). The infrastructure challenges of model optimization at scale are exactly the kind of problems I love.\n\nWould love to hear what the backend architecture looks like at NeuralForge and where you need help most.\n\n15 min call?",
                subject_options=["NeuralForge's inference optimization + my background", "Backend infra for AI model optimization", "Re: your YC launch"],
                tone_settings={"formal": 5, "technical": 8}, relevance_score=87.0,
                hook_used="Read blog post about why building NeuralForge", status="draft"),
            OutreachEmail(campaign_id=campaign2.id, contact_id=contact_objects[1].id,
                subject="CTO to engineer -- NeuralForge's infra challenges",
                body="Raj -- congrats on the seed round. NeuralForge's approach to inference cost reduction is technically fascinating.\n\nI built a real-time data pipeline at Zephyr AI handling 1M+ events/day on Python + Kafka + PostgreSQL. The reliability and performance challenges sound similar to what you're tackling with model optimization.\n\nI'd love to learn more about your technical roadmap. Happy to share what I've learned building systems at this scale.\n\nQuick call this week?",
                subject_options=["CTO to engineer -- NeuralForge's infra challenges", "Python + distributed systems background for NeuralForge", "Inference optimization infrastructure"],
                tone_settings={"formal": 5, "technical": 8}, relevance_score=85.5,
                hook_used="Recent funding announcement", status="draft"),
            OutreachEmail(campaign_id=campaign3.id, contact_id=contact_objects[2].id,
                subject="Gridware's data pipeline + my experience at scale",
                body="Mike -- read your blog post on scaling to 10B events/day. The Kafka + Go architecture choices make a lot of sense for grid data.\n\nI've built similar high-throughput systems at Zephyr AI (1M events/day, exactly-once semantics, Python + Kafka). The real-time processing challenges of power grid monitoring are the kind of problems I find deeply interesting.\n\nWould love to hear what's next on the infrastructure roadmap.",
                subject_options=["Gridware's data pipeline + my experience at scale", "Real-time infra for power grid monitoring", "Re: your blog on scaling data pipelines"],
                status="sent", sent_at=now - timedelta(days=5), relevance_score=78.0,
                hook_used="Read blog post on scaling data pipeline"),
            OutreachEmail(campaign_id=campaign3.id, contact_id=contact_objects[3].id,
                subject="New VP Eng perspective on Gridware's stack",
                body="Priya -- noticed you recently joined Gridware as VP Engineering. Congrats on the move.\n\nAs someone who's been in similar roles at fast-growing startups, I imagine you're evaluating the team and architecture. I've built backend systems handling 1M+ events/day and led zero-downtime migrations -- problems that seem relevant to Gridware's scale.\n\nWould love to connect and hear how you're thinking about the engineering org.",
                subject_options=["New VP Eng perspective on Gridware's stack", "Fellow engineer -- welcome to Gridware", "Backend infrastructure for grid monitoring"],
                status="replied", replied_at=now - timedelta(hours=6), sent_at=now - timedelta(days=4),
                opened_at=now - timedelta(days=3), relevance_score=82.0,
                hook_used="New recruit signal -- recently joined as VP Engineering"),
        ]
        db.add_all(emails)
        await db.flush()

        # --- FOLLOWUP SCHEDULES ---
        for email in [emails[0], emails[4]]:
            for num, days in {1: 3, 2: 5, 3: 7}.items():
                fu = FollowupSchedule(
                    outreach_email_id=email.id,
                    followup_number=num,
                    scheduled_for=email.sent_at + timedelta(days=days),
                    status="pending" if num > 1 else "sent",
                )
                db.add(fu)

        # --- LINKEDIN SIGNALS ---
        signals = [
            LinkedInSignal(post_url="https://linkedin.com/posts/rahulverma-1", post_content="We're 3 engineers building for millions of businesses. If you think in systems and ship fast, DM me. #hiring #foundingEngineer", author_name="Rahul Verma", author_linkedin="https://linkedin.com/in/rahulverma-pf", signal_type="hiring_post", company_id=company_objects[2].id, resolved=True),
            LinkedInSignal(post_url="https://linkedin.com/posts/priyasharma-1", post_content="Thrilled to announce I'm joining Gridware as VP Engineering! Excited to build the infrastructure that keeps the lights on.", author_name="Priya Sharma", author_linkedin="https://linkedin.com/in/priyasharma-gw", signal_type="new_recruit", company_id=company_objects[1].id, resolved=True),
            LinkedInSignal(post_url="https://linkedin.com/posts/sarahchen-1", post_content="Just closed our seed round! $4.2M to make AI inference 10x cheaper. Grateful to @YC and @Sequoia for believing in us.", author_name="Sarah Chen", author_linkedin="https://linkedin.com/in/sarahchen-nf", signal_type="funding_announce", company_id=company_objects[0].id, resolved=True),
            LinkedInSignal(post_url="https://linkedin.com/posts/lenaweber-1", post_content="Our Rust-based container runtime does 200x faster startup than Docker. Looking for generalists who want to rewrite how CI/CD works.", author_name="Lena Weber", author_linkedin="https://linkedin.com/in/lenaweber-orbital", signal_type="hiring_post", company_id=company_objects[4].id, resolved=True),
            LinkedInSignal(post_url="https://linkedin.com/posts/unknown-1", post_content="Excited to share that our team just grew from 10 to 25 in the last quarter! #teamgrowth #startuplife", author_name="Unknown Founder", signal_type="expansion", resolved=False),
        ]
        db.add_all(signals)

        # --- JOB LISTINGS ---
        listings = [
            JobListing(company_id=company_objects[0].id, title="Senior Backend Engineer", url="https://neuralforge.ai/careers/sbe", description="Build the infrastructure behind our AI model optimization platform. Python, FastAPI, PostgreSQL required.", location="San Francisco, CA", employment_type="full-time", remote_ok=True, source="wellfound", posted_at=now - timedelta(days=5)),
            JobListing(company_id=company_objects[0].id, title="ML Infrastructure Engineer", url="https://neuralforge.ai/careers/mle", description="Design and build ML training and serving infrastructure. PyTorch, Kubernetes experience preferred.", location="San Francisco, CA", employment_type="full-time", remote_ok=True, source="lever", posted_at=now - timedelta(days=5)),
            JobListing(company_id=company_objects[1].id, title="Senior Software Engineer - Backend", url="https://gridware.io/careers/sse", description="Work on real-time data pipelines processing billions of events from power grid sensors.", location="Austin, TX", employment_type="full-time", remote_ok=False, source="greenhouse", posted_at=now - timedelta(days=15)),
            JobListing(company_id=company_objects[2].id, title="Founding Engineer", url="https://payflow.in/careers/fe", description="Join as founding engineer. Build the core platform from scratch. Full stack role.", location="Bangalore, India", employment_type="full-time", remote_ok=False, source="wellfound", posted_at=now - timedelta(days=2)),
            JobListing(company_id=company_objects[3].id, title="Senior Full Stack Engineer", url="https://documind.co/careers/sfs", description="Build enterprise document AI features. React + Python stack.", location="London, UK", employment_type="full-time", remote_ok=True, source="workable", posted_at=now - timedelta(days=10)),
            JobListing(title="Backend Developer", url="https://example.com/jobs/bd-1", description="FastAPI + PostgreSQL for fintech startup", location="Mumbai, India", employment_type="full-time", remote_ok=True, source="naukri", posted_at=now - timedelta(days=3)),
            JobListing(title="Software Engineer Intern", url="https://example.com/jobs/intern-1", description="React + Node.js internship opportunity", location="Bangalore, India", employment_type="internship", remote_ok=True, source="internshala", posted_at=now - timedelta(days=1)),
            JobListing(title="DevOps Engineer", url="https://example.com/jobs/devops-1", description="Kubernetes, Docker, CI/CD for infrastructure company", location="Berlin, Germany", employment_type="full-time", remote_ok=True, source="github", posted_at=now - timedelta(days=7)),
        ]
        db.add_all(listings)

        # --- ACTIVITY LOGS ---
        logs = [
            ActivityLog(user_id=user_id, actor="adam", action="cv_parsed", entity_type="user_profile", metadata_={"skills_count": 10, "experience_count": 3}),
            ActivityLog(user_id=user_id, actor="adam", action="interview_completed", entity_type="user_profile", metadata_={"turns": 12}),
            ActivityLog(user_id=user_id, actor="theos", action="company_enriched", entity_type="company", entity_id=company_objects[0].id, metadata_={"company_name": "NeuralForge", "hiring_score": 85}),
            ActivityLog(user_id=user_id, actor="theos", action="company_enriched", entity_type="company", entity_id=company_objects[1].id, metadata_={"company_name": "Gridware", "hiring_score": 72}),
            ActivityLog(user_id=user_id, actor="theos", action="company_enriched", entity_type="company", entity_id=company_objects[2].id, metadata_={"company_name": "Payflow", "hiring_score": 90}),
            ActivityLog(user_id=user_id, actor="theos", action="contacts_found", entity_type="company", entity_id=company_objects[2].id, metadata_={"count": 2}),
            ActivityLog(user_id=user_id, actor="theos", action="signal_detected", entity_type="linkedin_signal", metadata_={"signal_type": "hiring_post", "author": "Rahul Verma"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_generated", entity_type="campaign", entity_id=campaign1.id, metadata_={"company": "Payflow", "contact_count": 2}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_sent", entity_type="outreach_email", entity_id=emails[0].id, metadata_={"to": "Rahul Verma", "company": "Payflow"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_sent", entity_type="outreach_email", entity_id=emails[1].id, metadata_={"to": "Anika Das", "company": "Payflow"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_opened", entity_type="outreach_email", entity_id=emails[1].id, metadata_={"to": "Anika Das"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_sent", entity_type="outreach_email", entity_id=emails[4].id, metadata_={"to": "Mike Torres", "company": "Gridware"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_sent", entity_type="outreach_email", entity_id=emails[5].id, metadata_={"to": "Priya Sharma", "company": "Gridware"}),
            ActivityLog(user_id=user_id, actor="mercury", action="reply_received", entity_type="outreach_email", entity_id=emails[5].id, metadata_={"from": "Priya Sharma", "company": "Gridware"}),
            ActivityLog(user_id=user_id, actor="system", action="followup_scheduled", entity_type="outreach_email", entity_id=emails[0].id, metadata_={"followup_number": 1, "days": 3}),
            ActivityLog(user_id=user_id, actor="theos", action="signal_detected", entity_type="linkedin_signal", metadata_={"signal_type": "new_recruit", "author": "Priya Sharma"}),
            ActivityLog(user_id=user_id, actor="theos", action="signal_detected", entity_type="linkedin_signal", metadata_={"signal_type": "funding_announce", "author": "Sarah Chen"}),
            ActivityLog(user_id=user_id, actor="mercury", action="email_generated", entity_type="campaign", entity_id=campaign2.id, metadata_={"company": "NeuralForge", "contact_count": 2}),
            ActivityLog(user_id=user_id, actor="system", action="daily_limit_check", metadata_={"sent_today": 4, "limit": 25}),
            ActivityLog(user_id=user_id, actor="adam", action="profile_updated", entity_type="user_profile", metadata_={"fields": ["preferred_roles", "tone_settings"]}),
        ]
        db.add_all(logs)

        # --- ADAM CONVERSATIONS ---
        conversations = [
            AdamConversation(user_id=user_id, role="adam", content="Hey Arjun. Before I dive in -- what made you want to do this today? What are you actually hoping to find?"),
            AdamConversation(user_id=user_id, role="user", content="Honestly, I'm tired of applying through job portals and getting ghosted. I've built some really cool stuff but my resume doesn't tell the full story. I want to find startups where I can actually make an impact."),
            AdamConversation(user_id=user_id, role="adam", content="That frustration makes sense -- portals are terrible at showing what someone actually brings to a team. You mentioned building 'really cool stuff.' Walk me through the thing you've built that you're most proud of. Not the most impressive on paper -- the one that meant the most to you."),
            AdamConversation(user_id=user_id, role="user", content="The DataFlow Engine at Zephyr. When I joined, analytics was running on batch jobs that took 4 hours. I redesigned the entire pipeline to process events in real-time. Now it handles a million events a day with exactly-once semantics. It completely changed how the product team made decisions."),
            AdamConversation(user_id=user_id, role="adam", content="That's a significant before/after -- 4 hours to real-time. What specifically about that problem pulled you in? Was it the technical challenge of the distributed system, or more about seeing the product team actually use what you built?"),
            AdamConversation(user_id=user_id, role="user", content="Both, but if I'm honest, it was seeing the product team actually change how they worked. Before, they'd make decisions based on gut feeling because data was always stale. After, they'd pull up dashboards in meetings and make decisions on the spot. That felt real."),
        ]
        db.add_all(conversations)

        await db.commit()
        print("Seed completed successfully!")
        print(f"  User: test@agnostos.com / password123")
        print(f"  Companies: {len(company_objects)}")
        print(f"  Contacts: {len(contact_objects)}")
        print(f"  Campaigns: 3")
        print(f"  Emails: {len(emails)}")
        print(f"  Signals: {len(signals)}")
        print(f"  Job Listings: {len(listings)}")
        print(f"  Activity Logs: {len(logs)}")


if __name__ == "__main__":
    asyncio.run(seed())
