// ElevenLabs Custom LLM (OpenAI-compatible) appends "/chat/completions" to the
// configured base URL. We set the base URL to ".../api/voice/llm", so the real
// request lands here. Re-export the same handlers so both the base path and the
// /chat/completions path hit identical logic. Covered by the same middleware
// exemption (startsWith "/api/voice/llm").
//
// GET is re-exported too: en App Router este archivo compila a una FUNCIÓN
// serverless distinta del base, con su propio cold start. El prewarm debe pegarle
// a ESTE path (el que ElevenLabs realmente usa por POST), no al base, para
// calentar la lambda correcta.
export { GET, POST, maxDuration } from "../../route";
