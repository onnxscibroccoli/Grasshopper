# OmniKali Control Plane MCP

A single MCP surface for the OmniKali/Grasshopper execution boundary.

## Design

AI clients -> Streamable HTTP MCP -> policy -> capability adapters -> Broccoli/Rish/Android, host processes/files, application intelligence, human boundaries.

The same server can be consumed by ChatGPT, Gemini, and Grok. OpenAI supports remote MCP servers and Secure MCP Tunnel; Gemini Interactions supports remote MCP over Streamable HTTP; xAI supports Remote MCP over Streaming HTTP/SSE. We deliberately use Streamable HTTP so the primary transport is shared by all three. Provider APIs are also available through `model.ask` using environment-held credentials.

No provider API key is stored in source. Mutating tools require an explicit `confirm=true` argument and all tools are allowlisted. Human security boundaries remain human boundaries.

## Environment

`OMNIKALI_MCP_TOKEN` required.

Optional model credentials:
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `XAI_API_KEY`

Optional:
- `OMNIKALI_ROOT`
- `PORT` (default 8787)
- `HOST` (default 127.0.0.1)

## Production topology

Do not expose the raw process port directly. Put the service behind authenticated HTTPS or a Secure MCP Tunnel. The local agent may run on the Android orchestrator or a workstation and retain the only path to Rish.

The remote MCP endpoint should be the stable control-plane surface, not a temporary tunnel or chat-token-lived process.
