# DocMind AI — Production-Ready Foundation

> An intelligent document assistant built on Next.js 15 + FastAPI, ready for RAG integration.

---

## Project Structure

```
DockMind/
├── frontend/          # Next.js 15 App Router (TypeScript + Tailwind)
└── backend/           # FastAPI + SQLAlchemy + Alembic
```

---

## Frontend Setup

### Prerequisites
- Node.js 18+

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**

### Environment Variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Pages

| Route | Description | Auth Required |
|---|---|---|
| `/` | Landing page | ❌ |
| `/login` | Sign in | ❌ |
| `/register` | Create account | ❌ |
| `/dashboard` | Overview + stats | ✅ |
| `/upload` | Upload documents | ✅ |
| `/chat` | AI chat interface | ✅ |

---

## Backend Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+

### Install & Run

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and SECRET_KEY

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

API runs at **http://localhost:8000**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Backend Architecture

```
backend/app/
├── api/v1/
│   ├── auth.py          # POST /auth/register, /login, /refresh | GET /me
│   ├── documents.py     # CRUD /documents
│   ├── chats.py         # CRUD /chats + /messages
│   └── router.py        # Aggregated router
├── core/
│   ├── config.py        # Pydantic Settings (env-driven)
│   ├── security.py      # JWT + bcrypt
│   └── dependencies.py  # get_db, get_current_user
├── database/
│   ├── base.py          # SQLAlchemy DeclarativeBase
│   └── session.py       # Async engine + session factory
├── middleware/
│   └── cors.py          # CORS config
├── models/              # ORM: User, Document, Chat, Message
├── schemas/             # Pydantic v2 request/response schemas
├── services/            # Business logic layer
│   ├── auth_service.py
│   ├── user_service.py
│   ├── document_service.py
│   └── chat_service.py
└── main.py              # FastAPI app entry point
```

### Database Schema

```sql
-- Users
id, name, email, password_hash, is_active, created_at

-- Documents
id, user_id (FK→users), filename, file_path, file_size, mime_type, created_at

-- Chats
id, user_id (FK→users), title, created_at, updated_at

-- Messages
id, chat_id (FK→chats), role (user|assistant|system), content, created_at
```

---

## API Reference

### Auth
```
POST /api/v1/auth/register   { name, email, password }
POST /api/v1/auth/login      { email, password }
POST /api/v1/auth/refresh    { refresh_token }
GET  /api/v1/auth/me         → UserRead
```

### Documents
```
GET    /api/v1/documents/       → DocumentRead[]
POST   /api/v1/documents/       { filename, file_path, file_size?, mime_type? }
GET    /api/v1/documents/{id}   → DocumentRead
DELETE /api/v1/documents/{id}
```

### Chats
```
GET    /api/v1/chats/                  → ChatRead[]
POST   /api/v1/chats/                  { title? }
GET    /api/v1/chats/{id}              → ChatRead
PATCH  /api/v1/chats/{id}             { title? }
DELETE /api/v1/chats/{id}
GET    /api/v1/chats/{id}/messages     → MessageRead[]
POST   /api/v1/chats/{id}/messages    { role, content }
```

---

## What's Included (Foundation Phase)

✅ Next.js 15 App Router + TypeScript  
✅ Tailwind CSS with custom design tokens  
✅ Dark / light theme toggle (next-themes)  
✅ Framer Motion animations throughout  
✅ Responsive sidebar + top navigation  
✅ JWT authentication (login, register, refresh, me)  
✅ Protected route architecture (AuthGuard)  
✅ Landing page (Hero, Features, Architecture, CTA, Footer)  
✅ Dashboard with stats + empty states  
✅ Upload page with drag-and-drop UI  
✅ Chat page with message bubbles + typing indicator  
✅ FastAPI with async SQLAlchemy 2.0  
✅ Alembic migrations (initial schema)  
✅ Full CRUD services for documents, chats, messages  

---

## What's Next (RAG Phase)

- [ ] Actual file upload to disk / S3
- [ ] Document text extraction (PyMuPDF, python-docx)
- [ ] Text chunking + embedding (OpenAI / local model)
- [ ] Vector storage (pgvector or Chroma)
- [ ] RAG retrieval chain (LangChain / LlamaIndex)
- [ ] Streaming AI responses (SSE / WebSocket)
- [ ] Document status tracking (processing, ready, error)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, CSS Variables |
| Animations | Framer Motion |
| HTTP Client | Axios |
| Auth State | React Context + localStorage |
| Backend | FastAPI, Python 3.11+ |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Database | PostgreSQL 15+ |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Validation | Pydantic v2 |
