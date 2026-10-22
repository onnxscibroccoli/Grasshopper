# Control Plane Architecture

```text
                    Remote / Local LLMs
             ChatGPT | Gemini | Grok | Local
                           |
                           v
                 Streamable HTTP MCP
                           |
                    policy + evidence
                           |
              +------------+-------------+
              |                          |
         host capabilities          Android adapter
              |                          |
       files/process/apps             Rish
                                         |
                                      Shizuku
                                         |
                                   Android system
                                         |
                              +----------+----------+
                              | installed APK UIs |
                              +---------------------+
```

The application UI is the portable integration surface. Application-specific APIs become optional accelerators, never hard dependencies.

The Android adapter is intentionally separated from model providers. This is what allows a locally running LLM to drive the same capabilities without paying for or depending on a remote model API.
