#!/usr/bin/env python3
"""
model_routing_test.py
=====================
Verifies that the Moduly AI LLM routing logic behaves correctly when
individual providers are simulated as "down" (rate-limited or erroring).

Tests cover:
  1. Groq healthy            → response comes from Groq
  2. Groq 429               → OpenRouter fallback activates
  3. Groq 500               → OpenRouter fallback activates
  4. reasoningMode=True     → Z_AI (GLM-5) endpoint is called
  5. Z_AI 429              → OpenRouter fallback activates
  6. All providers fail     → raises descriptive error

Usage:
  python model_routing_test.py

Requirements:
  pip install requests python-dotenv
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch, call
from typing import Any

# ─── Minimal Python re-implementation of the routing logic ───────────────────
# This mirrors the TypeScript logic in src/lib/ai/llm.ts so we can unit test
# the routing decisions without calling real API endpoints.

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
Z_AI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

GROQ_MODEL = "llama-3.3-70b-versatile"
Z_AI_MODEL = "glm-5"
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct"

FALLBACK_STATUS_CODES = {429, 500, 502, 503, 504}
LONG_CONTEXT_THRESHOLD_CHARS = 100_000


class MockResponse:
    """Lightweight mock for requests.Response."""

    def __init__(self, status_code: int, body: dict[str, Any]):
        self.status_code = status_code
        self._body = body
        self.ok = status_code < 400

    def json(self) -> dict[str, Any]:
        return self._body

    def raise_for_status(self) -> None:
        if not self.ok:
            raise Exception(f"HTTP {self.status_code}")


def _make_llm_response(content: str, provider: str) -> MockResponse:
    """Build a mock successful LLM response payload."""
    return MockResponse(200, {
        "id": f"mock-{provider}-id",
        "choices": [{"message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
        "model": GROQ_MODEL if provider == "groq" else Z_AI_MODEL,
    })


def _make_error_response(status_code: int, provider: str) -> MockResponse:
    return MockResponse(status_code, {"error": f"Simulated {status_code} from {provider}"})


class LLMRouter:
    """
    Python mirror of llm.ts chatCompletion() for testing purposes.
    Accepts a `http_client` injectable for mocking HTTP calls.
    """

    def __init__(self, http_client: Any, env: dict[str, str]):
        self._http = http_client
        self._env = env

    def _get_key(self, var: str) -> str:
        key = self._env.get(var)
        if not key:
            raise ValueError(f"Missing API key: {var}")
        return key

    def _call_provider(self, base_url: str, env_var: str, model: str, messages: list, **_kwargs) -> tuple[str | None, bool]:
        """
        Returns (content_or_None, triggered_fallback).
        triggered_fallback=True means a 429/5xx was returned.
        """
        api_key = self._get_key(env_var)
        resp = self._http.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": model, "messages": messages},
        )
        if resp.ok:
            return resp.json()["choices"][0]["message"]["content"], False
        if resp.status_code in FALLBACK_STATUS_CODES:
            return None, True
        raise RuntimeError(f"Provider error {resp.status_code}")

    def _should_use_reasoning(self, messages: list, reasoning_mode: bool) -> bool:
        if reasoning_mode:
            return True
        total = sum(len(m.get("content", "")) for m in messages)
        return total > LONG_CONTEXT_THRESHOLD_CHARS

    def chat_completion(self, messages: list, reasoning_mode: bool = False) -> str:
        use_reasoning = self._should_use_reasoning(messages, reasoning_mode)

        if use_reasoning:
            primary_url = Z_AI_BASE_URL
            primary_env = "Z_AI_API_KEY"
            primary_model = Z_AI_MODEL
            primary_label = "Z_AI (GLM-5)"
        else:
            primary_url = GROQ_BASE_URL
            primary_env = "GROQ_API_KEY"
            primary_model = GROQ_MODEL
            primary_label = "Groq (llama-3.3-70b-versatile)"

        # Try primary
        try:
            content, triggered = self._call_provider(primary_url, primary_env, primary_model, messages)
            if not triggered:
                return content
            print(f"[router] {primary_label} triggered fallback (429/5xx)")
        except Exception as exc:
            print(f"[router] {primary_label} threw: {exc}. Activating OpenRouter fallback.")

        # Fallback: OpenRouter
        content, triggered = self._call_provider(
            OPENROUTER_BASE_URL, "OPENROUTER_API_KEY", OPENROUTER_MODEL, messages
        )
        if not triggered:
            return content

        raise RuntimeError(
            f"All LLM providers failed. Primary ({primary_label}) and OpenRouter both errored."
        )


# ─── Test Cases ──────────────────────────────────────────────────────────────

FAKE_ENV = {
    "GROQ_API_KEY": "gsk_test_key",
    "Z_AI_API_KEY": "zai_test_key",
    "OPENROUTER_API_KEY": "or_test_key",
    "NVIDIA_NIM_API_KEY": "nvapi_test_key",
}

SAMPLE_MESSAGES = [{"role": "user", "content": "Explain AVL tree rotations."}]


class TestLLMRouting(unittest.TestCase):

    # ── Test 1: Groq healthy ─────────────────────────────────────────────────
    def test_01_groq_healthy_returns_response(self):
        """When Groq is healthy, response must come directly from Groq."""
        http = MagicMock()
        http.post.return_value = _make_llm_response("AVL answer from Groq", "groq")

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(SAMPLE_MESSAGES)

        self.assertEqual(result, "AVL answer from Groq")
        # Only ONE call should have been made — directly to Groq
        self.assertEqual(http.post.call_count, 1)
        called_url = http.post.call_args[0][0]
        self.assertIn("groq.com", called_url)
        print("✅ Test 1 PASS: Groq healthy → response from Groq")

    # ── Test 2: Groq 429 → OpenRouter fallback ───────────────────────────────
    def test_02_groq_429_activates_openrouter(self):
        """A 429 from Groq must trigger the OpenRouter fallback."""
        http = MagicMock()
        http.post.side_effect = [
            _make_error_response(429, "groq"),                      # Groq → 429
            _make_llm_response("Fallback answer from OpenRouter", "openrouter"),  # OR → 200
        ]

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(SAMPLE_MESSAGES)

        self.assertEqual(result, "Fallback answer from OpenRouter")
        self.assertEqual(http.post.call_count, 2)
        fallback_url = http.post.call_args_list[1][0][0]
        self.assertIn("openrouter.ai", fallback_url)
        print("✅ Test 2 PASS: Groq 429 → OpenRouter fallback activated")

    # ── Test 3: Groq 500 → OpenRouter fallback ───────────────────────────────
    def test_03_groq_500_activates_openrouter(self):
        """A 500 server error from Groq must trigger the OpenRouter fallback."""
        http = MagicMock()
        http.post.side_effect = [
            _make_error_response(500, "groq"),
            _make_llm_response("Fallback answer from OpenRouter", "openrouter"),
        ]

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(SAMPLE_MESSAGES)

        self.assertEqual(result, "Fallback answer from OpenRouter")
        fallback_url = http.post.call_args_list[1][0][0]
        self.assertIn("openrouter.ai", fallback_url)
        print("✅ Test 3 PASS: Groq 500 → OpenRouter fallback activated")

    # ── Test 4: reasoningMode → Z_AI ─────────────────────────────────────────
    def test_04_reasoning_mode_routes_to_zai(self):
        """When reasoningMode=True, request must be routed to Z_AI (GLM-5), not Groq."""
        http = MagicMock()
        http.post.return_value = _make_llm_response("Deep reasoning answer from GLM-5", "z-ai")

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(SAMPLE_MESSAGES, reasoning_mode=True)

        self.assertEqual(result, "Deep reasoning answer from GLM-5")
        self.assertEqual(http.post.call_count, 1)
        called_url = http.post.call_args[0][0]
        self.assertIn("bigmodel.cn", called_url)
        # Verify correct model was passed
        call_json = http.post.call_args[1]["json"]
        self.assertEqual(call_json["model"], Z_AI_MODEL)
        print("✅ Test 4 PASS: reasoningMode=True → Z_AI (GLM-5) called")

    # ── Test 5: Z_AI 429 → OpenRouter fallback ───────────────────────────────
    def test_05_zai_429_activates_openrouter(self):
        """A 429 from Z_AI must trigger the OpenRouter fallback."""
        http = MagicMock()
        http.post.side_effect = [
            _make_error_response(429, "z-ai"),                       # Z_AI → 429
            _make_llm_response("Fallback from OpenRouter", "openrouter"),  # OR → 200
        ]

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(SAMPLE_MESSAGES, reasoning_mode=True)

        self.assertEqual(result, "Fallback from OpenRouter")
        fallback_url = http.post.call_args_list[1][0][0]
        self.assertIn("openrouter.ai", fallback_url)
        print("✅ Test 5 PASS: Z_AI 429 → OpenRouter fallback activated")

    # ── Test 6: All providers fail → raises error ─────────────────────────────
    def test_06_all_providers_fail_raises(self):
        """When ALL providers fail (incl. OpenRouter), a descriptive error must be raised."""
        http = MagicMock()
        http.post.side_effect = [
            _make_error_response(429, "groq"),     # Groq → 429
            _make_error_response(503, "openrouter"), # OpenRouter → 503
        ]

        router = LLMRouter(http, FAKE_ENV)
        with self.assertRaises(RuntimeError) as ctx:
            router.chat_completion(SAMPLE_MESSAGES)

        self.assertIn("All LLM providers failed", str(ctx.exception))
        print("✅ Test 6 PASS: All providers failed → descriptive RuntimeError raised")

    # ── Bonus: Long-context auto-routing to Z_AI ──────────────────────────────
    def test_07_long_context_auto_routes_to_zai(self):
        """Messages exceeding 100k chars must auto-route to Z_AI without explicit reasoningMode."""
        http = MagicMock()
        http.post.return_value = _make_llm_response("Long context answer from GLM-5", "z-ai")

        # Create a very long message (>100k chars)
        long_messages = [{"role": "user", "content": "x" * 101_000}]

        router = LLMRouter(http, FAKE_ENV)
        result = router.chat_completion(long_messages, reasoning_mode=False)

        self.assertEqual(result, "Long context answer from GLM-5")
        called_url = http.post.call_args[0][0]
        self.assertIn("bigmodel.cn", called_url)
        print("✅ Test 7 PASS: Long context (>100k chars) → Z_AI auto-routing triggered")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Moduly AI — LLM Model Routing Tests")
    print("  Tests: Groq primary | Z_AI reasoning | OpenRouter fallback")
    print("=" * 60)
    print()

    loader = unittest.TestLoader()
    loader.sortTestMethodsUsing = None  # Preserve definition order
    suite = loader.loadTestsFromTestCase(TestLLMRouting)

    runner = unittest.TextTestRunner(verbosity=0, stream=sys.stdout)
    result = runner.run(suite)

    print()
    print("=" * 60)
    if result.wasSuccessful():
        print(f"  ✅ ALL {result.testsRun} TESTS PASSED")
    else:
        failed = len(result.failures) + len(result.errors)
        print(f"  ❌ {failed}/{result.testsRun} TESTS FAILED")
        for test, tb in result.failures + result.errors:
            print(f"\n  FAIL: {test}")
            print(f"  {tb.splitlines()[-1]}")
    print("=" * 60)

    sys.exit(0 if result.wasSuccessful() else 1)
