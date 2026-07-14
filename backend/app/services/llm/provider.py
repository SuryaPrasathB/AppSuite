import os
import json
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseLLMProvider(ABC):
    @abstractmethod
    def generate_plan_json(self, request_payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        """
        Sends the prompt and payload to the LLM and returns the parsed execution plan JSON dictionary.
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        pass


class OllamaProvider(BaseLLMProvider):
    def __init__(self, host: str = None, model: str = None):
        self.host = host or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3:8b")

    def get_provider_name(self) -> str:
        return "Ollama"

    def generate_plan_json(self, request_payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        url = f"{self.host}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2
            }
        }
        try:
            response = requests.post(url, json=payload, timeout=300)
            response.raise_for_status()
            res_json = response.json()
            raw_text = res_json.get("response", "")
            return json.loads(raw_text)
        except requests.exceptions.ConnectionError:
            raise RuntimeError("Ollama is not running. Please launch the Ollama desktop application or run 'ollama serve' in your terminal, or select a cloud provider like Gemini or OpenAI in the Create Project form.")
        except Exception as e:
            raise RuntimeError(f"Ollama provider failed: {str(e)}")


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def get_provider_name(self) -> str:
        return "OpenAI"

    def generate_plan_json(self, request_payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("OpenAI API key is missing. Set OPENAI_API_KEY env variable.")
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "You are a professional project planner. You must output JSON only matching the schema."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            raw_text = res_json["choices"][0]["message"]["content"]
            return json.loads(raw_text)
        except Exception as e:
            raise RuntimeError(f"OpenAI provider failed: {str(e)}")


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    def get_provider_name(self) -> str:
        return "Gemini"

    def generate_plan_json(self, request_payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("Gemini API key is missing. Set GEMINI_API_KEY env variable.")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2
            }
        }
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)
        except Exception as e:
            raise RuntimeError(f"Gemini provider failed: {str(e)}")


class ClaudeProvider(BaseLLMProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")

    def get_provider_name(self) -> str:
        return "Claude"

    def generate_plan_json(self, request_payload: Dict[str, Any], prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("Anthropic API key is missing. Set ANTHROPIC_API_KEY env variable.")
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            res_json = response.json()
            raw_text = res_json["content"][0]["text"]
            # Extract JSON from potential Claude markdown wrapping
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            return json.loads(raw_text)
        except Exception as e:
            raise RuntimeError(f"Claude provider failed: {str(e)}")


# Provider factory
def get_llm_provider(provider_name: str) -> BaseLLMProvider:
    name = provider_name.lower().strip()
    if name == "ollama":
        return OllamaProvider()
    elif name == "openai":
        return OpenAIProvider()
    elif name == "gemini":
        return GeminiProvider()
    elif name == "claude":
        return ClaudeProvider()
    else:
        raise ValueError(f"Unknown provider '{provider_name}'. Supported: Ollama, OpenAI, Gemini, Claude.")
