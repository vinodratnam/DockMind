# DocMind AI — Enterprise Document Intelligence & RAG Platform

> A full-stack, enterprise-grade Retrieval-Augmented Generation (RAG) platform powered by **Next.js 15**, **FastAPI**, **Qdrant Vector Database**, **BAAI/bge-small-en-v1.5 embeddings**, and **Google Gemini 2.5 Flash**.

---

## 🚀 Key Features

* **🧠 Grounded RAG Pipeline:** Generates strictly factual answers sourced exclusively from uploaded documents with zero hallucinations.
* **⚡ Server-Sent Events (SSE) Streaming:** Real-time token-by-token response streaming with live typing indicators.
* **🔍 Hybrid Search Engine:** Combines dense semantic vector search with sparse keyword search (**BM25 + Reciprocal Rank Fusion**) for high recall and precision.
* **📄 Multi-Format Ingestion:** Ingests PDFs and image files (`.png`, `.jpg`, `.jpeg`, `.webp`).
* **📷 Intelligent OCR Fallback:** Automatically switches to **Tesseract OCR** for scanned PDFs and image documents.
* **📌 Strict Citation System:** Every generated statement includes verifiable document citations (filename, page number, relevance match score, and excerpt preview).
* **🗂️ Document & Chunk Inspector:** Interactive document processing, chunk visualization, embedding inspector, and vector store health monitoring.
* **🔐 Enterprise Security:** JWT token authentication (Access + Refresh), password hashing (bcrypt), and strict document tenant isolation.

---

## 🏛️ RAG Architecture & Pipeline

```
[ User Query ]
       │
       ▼
 1. Embed Query (BAAI/bge-small-en-v1.5 → 384d vector)
       │
       ├───────────────────────────────┐
       ▼                               ▼
 2a. Semantic Search (Qdrant)    2b. BM25 Keyword Search
       │                               │
       └───────────────┬───────────────┘
                       ▼
 3. Reciprocal Rank Fusion (RRF: score = Σ 1/(60 + rank))
                       │
                       ▼
 4. Grounded Prompt Construction (System Rules + Ranked Chunks)
                       │
                       ▼
 5. Generation & Streaming (Gemini 2.5 Flash via SSE)
                       │
                       ▼
 [ Real-time Token Stream + Citations + Latency Stats ]
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | FastAPI, Python 3.11+, Pydantic v2, SQLAlchemy (Async), Alembic |
| **LLM & Generation** | Google Gemini 2.5 Flash (`google-genai` SDK) |
| **Embeddings** | `BAAI/bge-small-en-v1.5` via `sentence-transformers` (384 dimensions) |
| **Vector Database** | Qdrant (In-Memory / HTTP Server) |
| **Keyword Search** | `rank-bm25` (BM25Okapi) + Reciprocal Rank Fusion (RRF) |
| **Document Processing** | PyMuPDF (fitz), Tesseract OCR (`pytesseract`), Pillow |
| **Relational Database** | PostgreSQL / SQLite |

---

## 📁 Project Structure

```
DockMind/
├── frontend/                     # Next.js 15 App Router
│   ├── app/
│   │   ├── (auth)/               # Login, Register, Forgot Password
│   │   ├── dashboard/            # System analytics & quick actions
│   │   ├── documents/            # Document library & chunk inspector
│   │   ├── upload/               # File dropzone (PDF + Images)
│   │   ├── chat/                 # Streaming RAG Chat interface
│   │   └── settings/             # System health & RAG parameters
│   ├── components/               # Reusable UI components
│   └── lib/                      # API clients & SSE streaming helpers
│
└── backend/                      # FastAPI Backend
    ├── app/
    │   ├── api/v1/               # REST & SSE endpoints (auth, documents, chats)
    │   ├── core/                 # Config, security, dependencies
    │   ├── models/               # SQLAlchemy ORM models
    │   ├── schemas/              # Pydantic validation schemas
    │   └── services/             # Core business logic
    │       ├── gemini_service.py              # Gemini 2.5 Flash client & streaming
    │       ├── embedding_service.py           # BGE embeddings
    │       ├── vector_store_service.py        # Qdrant client
    │       ├── hybrid_search_service.py       # BM25 + RRF fusion
    │       ├── ocr_service.py                 # Tesseract OCR engine
    │       ├── document_processing_service.py # Text extraction & chunking
    │       └── rag_service.py                 # End-to-end RAG orchestrator
    └── requirements.txt
```

---

## ⚙️ Quick Start Guide

### 1. Backend Setup

```powershell
cd backend

# Create & activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1       # Windows
# source .venv/bin/activate        # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Open .env and add your GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

* **API Docs (Swagger UI):** `http://localhost:8000/docs`
* **Health Check:** `http://localhost:8000/health`

### 2. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

* **Application URL:** `http://localhost:3000`

---

## 📄 Environment Configuration (`backend/.env`)

```env
# Application
APP_NAME=DocMind AI
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/docmind

# Security
SECRET_KEY=your-32-char-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# Qdrant & Embedding
QDRANT_MODE=memory
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# RAG & Search Features
RAG_TOP_K=5
RAG_SCORE_THRESHOLD=0.25
HYBRID_SEARCH=true
OCR_ENABLED=true
```

---

## 🛡️ License

MIT License © 2026 Vinod Ratnam

