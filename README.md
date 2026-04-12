# Agnostos

Hidden job market automation platform powered by three AI agents -- Adam, Theos, and Mercury.

## Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase project (https://supabase.com)

### 1. Database (Supabase)

1. Create a new project on [Supabase](https://supabase.com)
2. Copy your connection string from Project Settings > Database > Connection string (URI) > Session mode
3. Replace `postgres://` prefix with `postgresql+asyncpg://` in the connection string
4. Paste it as `DATABASE_URL` in `backend/.env`

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Fill in backend/.env with your Supabase credentials and API keys
# Then seed the database:
python seed.py

# Start the server:
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Test Account (after seeding)
- Email: `test@agnostos.com`
- Password: `password123`

## Environment Variables

### Backend (`backend/.env`)
- `SUPABASE_URL` -- Supabase project URL
- `SUPABASE_ANON_KEY` -- Supabase anonymous/public key
- `SUPABASE_SERVICE_ROLE_KEY` -- Supabase service role key (server-side only)
- `DATABASE_URL` -- Supabase PostgreSQL connection string (use `postgresql+asyncpg://` prefix)
- `JWT_SECRET` -- Secret for JWT token signing
- `GEMINI_API_KEY` -- Google Gemini API key (optional, uses mock responses without it)
- `DEEPGRAM_API_KEY` -- Deepgram API key for voice interview (optional)

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` -- Backend URL (default: http://localhost:8000)
- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anonymous/public key
