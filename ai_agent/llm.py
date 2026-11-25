"""Optional OpenAI-compatible LLM client with zero external dependencies."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


class LLMClient:
    """Calls any OpenAI-compatible chat completions endpoint when configured."""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: int = 30,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("OPENAI_API_KEY", "")
        self.base_url = (
            base_url
            if base_url is not None
            else os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
        ).rstrip("/")
        self.model = model if model is not None else os.environ.get("LLM_MODEL", "gpt-4o-mini")
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key) or "localhost" in self.base_url or "127.0.0.1" in self.base_url

    def complete(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str | None:
        """Returns model text if configured and reachable, otherwise None."""
        if not self.is_configured:
            return None

        url = f"{self.base_url}/chat/completions"
        payload: dict[str, Any] = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"].strip()
        except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
            return None
