"""
Gemini AI Service -- wraps google-genai (new SDK) for DocMind RAG pipeline.

Responsibilities:
  - Configure Gemini with API key from settings
  - Generate grounded answers from context + question
  - Stream grounded answers token-by-token (SSE)
  - Estimate token counts
  - Structured error handling (API errors, timeouts, no-key)

Model: gemini-2.5-flash (configurable via GEMINI_MODEL env var)

SDK: google-genai 2.x  (pip install google-genai)
     replaces deprecated google-generativeai package
"""
import logging
import time
from typing import Generator

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiService:
    """Singleton Gemini client with RAG-tuned configuration."""

    def __init__(self) -> None:
        self._client = None
        self._model_name = settings.GEMINI_MODEL
        self._is_configured = False

    # -- Initialisation -------------------------------------------------

    def configure(self) -> None:
        """
        Configure the Gemini client. Called once at app startup.
        Gracefully skips if API key is not set.
        """
        key = settings.GEMINI_API_KEY
        if not key or key == "your-gemini-api-key-here":
            logger.warning(
                "[Gemini] GEMINI_API_KEY not set -- AI answers will be unavailable. "
                "Add your key to .env to enable RAG."
            )
            return

        try:
            from google import genai
            self._client = genai.Client(api_key=key)
            self._is_configured = True
            logger.info("[Gemini] Configured successfully -- model=%s", self._model_name)
        except Exception as exc:
            logger.error("[Gemini] Configuration failed: %s", exc)

    # -- Properties -----------------------------------------------------

    @property
    def is_ready(self) -> bool:
        return self._is_configured and self._client is not None

    @property
    def model_name(self) -> str:
        return self._model_name

    # -- Generation -----------------------------------------------------

    def generate(self, prompt: str) -> tuple:
        """
        Send a prompt to Gemini and return (answer_text, usage_stats).
        """
        if not self.is_ready:
            return (
                "I'm sorry, the AI assistant is not available right now. "
                "Please ensure the GEMINI_API_KEY is configured.",
                {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "latency_ms": 0},
            )

        t0 = time.monotonic()
        try:
            from google.genai import types

            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.95,
                    max_output_tokens=2048,
                ),
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            answer = ""
            if response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "text") and part.text:
                        answer += part.text

            if not answer:
                answer = "I couldn't generate an answer. Please try rephrasing your question."

            usage = self._extract_usage(response, latency_ms)
            logger.info(
                "[Gemini] Generated answer -- tokens=%d latency=%dms",
                usage.get("total_tokens", 0), latency_ms,
            )
            return answer, usage

        except Exception as exc:
            latency_ms = int((time.monotonic() - t0) * 1000)
            logger.error("[Gemini] Generation failed: %s", exc)
            return (
                "I encountered an error while generating a response. Please try again.",
                {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
                 "latency_ms": latency_ms, "error": str(exc)},
            )

    # -- Streaming Generation -------------------------------------------

    def generate_stream(self, prompt: str) -> Generator[str, None, None]:
        """
        Stream a Gemini response as text chunks (for SSE).

        Yields:
            Successive text chunks from Gemini's streaming API.
            Yields an error string if the client is not configured.
        """
        if not self.is_ready:
            yield ("I'm sorry, the AI assistant is not available right now. "
                   "Please ensure the GEMINI_API_KEY is configured.")
            return

        try:
            from google.genai import types

            stream = self._client.models.generate_content_stream(
                model=self._model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.95,
                    max_output_tokens=2048,
                ),
            )
            for chunk in stream:
                if chunk.candidates:
                    for part in chunk.candidates[0].content.parts:
                        if hasattr(part, "text") and part.text:
                            yield part.text

        except Exception as exc:
            logger.error("[Gemini] Stream generation failed: %s", exc)
            yield f"\n\n[Error generating response: {exc}]"

    # -- Utilities ------------------------------------------------------

    def _extract_usage(self, response, latency_ms: int) -> dict:
        """Extract token usage from Gemini response metadata."""
        try:
            meta = response.usage_metadata
            return {
                "prompt_tokens":     getattr(meta, "prompt_token_count", 0) or 0,
                "completion_tokens": getattr(meta, "candidates_token_count", 0) or 0,
                "total_tokens":      getattr(meta, "total_token_count", 0) or 0,
                "latency_ms":        latency_ms,
            }
        except Exception:
            return {
                "prompt_tokens": 0, "completion_tokens": 0,
                "total_tokens": 0, "latency_ms": latency_ms,
            }

    def count_tokens(self, text: str) -> int:
        """Estimate token count for a text string (rough approximation)."""
        return len(text) // 4


# -- Module-level singleton --------------------------------------------
gemini_service = GeminiService()
