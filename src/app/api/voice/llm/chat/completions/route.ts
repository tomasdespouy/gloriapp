// ElevenLabs Custom LLM (OpenAI-compatible) appends "/chat/completions" to the
// configured base URL. We set the base URL to ".../api/voice/llm", so the real
// request lands here. Re-export the same handler so both the base path and the
// /chat/completions path hit identical logic. Covered by the same middleware
// exemption (startsWith "/api/voice/llm").
export { POST, maxDuration } from "../../route";
