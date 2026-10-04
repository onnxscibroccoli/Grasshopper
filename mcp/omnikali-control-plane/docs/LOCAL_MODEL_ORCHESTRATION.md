# Local Model Orchestration

The MCP server is deliberately model-provider agnostic.

The preferred phone architecture is:

`local LLM -> MCP -> Android UI adapter -> Rish/Shizuku -> installed APK`

Remote ChatGPT, Gemini, or Grok may also connect to the same MCP endpoint, but they are optional planners. They are not required for an APK to be automatable.

A local model can receive:

- normalized UI hierarchy
- screenshot when required
- current package/activity
- recent action/result history
- known application layout observations
- task goal

It returns a structured action proposal. The MCP executor validates that proposal against the fresh UI snapshot before acting.

The long-term design should support multiple local inference backends without coupling the UI executor to any one model runtime.
