"""
RAG Prompt Builder — constructs grounded prompts for Gemini.

Design principles:
  - ONLY answers from retrieved context (hallucination prevention)
  - Clear citation instructions embedded in system prompt
  - Context size limited to RAG_MAX_CONTEXT_CHARS to prevent token overflow
  - Source metadata included in a structured format
"""
from app.core.config import settings

# ── System instruction ──────────────────────────────────────────────────────
SYSTEM_INSTRUCTION = """You are DocMind AI, an intelligent document assistant.

CORE RULES:
1. Answer ONLY using the document context provided below.
2. NEVER invent, guess, or use knowledge outside the provided context.
3. If the answer cannot be found in the context, respond EXACTLY with:
   "I couldn't find this information in the uploaded documents."
4. Be concise and direct. Avoid unnecessary padding.
5. When you use information from the context, naturally reference the source.
6. Use markdown formatting for clarity (bullet points, bold, headers when helpful).
7. Always answer in the same language the question was asked in."""


def build_rag_prompt(
    question: str,
    chunks: list[dict],
    max_chars: int | None = None,
) -> str:
    """
    Construct a complete RAG prompt ready to send to Gemini.

    Structure:
      [SYSTEM INSTRUCTION]
      [DOCUMENT CONTEXT — numbered chunks with source metadata]
      [USER QUESTION]

    Args:
        question:  The user's natural language question
        chunks:    List of retrieved chunk dicts from vector_store.search()
                   Each dict must have: content, original_filename, page_number,
                   chunk_index, score
        max_chars: Max total context characters (default from settings)

    Returns:
        Fully constructed prompt string.
    """
    if max_chars is None:
        max_chars = settings.RAG_MAX_CONTEXT_CHARS

    # ── Build context block ─────────────────────────────────────────────────
    context_lines: list[str] = []
    chars_used = 0

    for i, chunk in enumerate(chunks, start=1):
        content    = chunk.get("content", "").strip()
        filename   = chunk.get("original_filename", "Unknown Document")
        page       = chunk.get("page_number", "?")
        score      = chunk.get("score", 0.0)
        chunk_idx  = chunk.get("chunk_index", i - 1)

        header = (
            f"[Source {i}: {filename} | Page {page} | "
            f"Chunk #{chunk_idx + 1} | Relevance: {score:.2f}]"
        )
        block = f"{header}\n{content}"

        # Stop adding chunks if we'd exceed the context limit
        if chars_used + len(block) > max_chars:
            # Try to fit a truncated version of the last chunk
            remaining = max_chars - chars_used - len(header) - 50
            if remaining > 100:
                block = f"{header}\n{content[:remaining]}…"
                context_lines.append(block)
            break

        context_lines.append(block)
        chars_used += len(block)

    context_section = "\n\n".join(context_lines) if context_lines else (
        "No relevant document context was retrieved for this question."
    )

    # ── Assemble full prompt ─────────────────────────────────────────────────
    prompt = f"""{SYSTEM_INSTRUCTION}

---

DOCUMENT CONTEXT:

{context_section}

---

USER QUESTION: {question}

ANSWER:"""

    return prompt


def format_no_context_prompt(question: str) -> str:
    """
    Prompt for when no chunks were retrieved above the score threshold.
    Instructs Gemini to politely decline rather than hallucinate.
    """
    return f"""{SYSTEM_INSTRUCTION}

---

DOCUMENT CONTEXT:

No relevant information was found in the uploaded documents for this question.

---

USER QUESTION: {question}

ANSWER: I couldn't find this information in the uploaded documents."""
