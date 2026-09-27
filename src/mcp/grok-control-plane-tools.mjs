/**
 * Thin MCP tool facade for Grok.
 * Routes only through GrokControlPlaneClient (submit + cancel).
 * Does not import or construct an executor.
 */

export const GROK_CONTROL_PLANE_TOOL_NAMES = Object.freeze([
  "omnikali_submit_operation",
  "omnikali_cancel_operation"
]);

const SHARED_PROPERTIES = Object.freeze({
  credentialRef: {
    type: "string",
    description: "Credential reference only (secret-manager:, arn:aws:secretsmanager:, or env:). Never a secret payload."
  },
  presentedProof: {
    description: "Authenticator proof input. Not persisted by the control-plane path."
  },
  grokSessionId: {
    type: "string",
    description: "Grok session identity component of the durable operation key."
  },
  clientOperationId: {
    type: "string",
    description: "Client operation identity component of the durable operation key."
  }
});

const SUBMIT_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "credentialRef",
    "presentedProof",
    "grokSessionId",
    "clientOperationId",
    "command",
    "commandDisposition"
  ],
  properties: {
    ...SHARED_PROPERTIES,
    command: {
      type: "string",
      description: "Command string for the control-plane task."
    },
    commandDisposition: {
      type: "string",
      description: "Required disposition; never stripped by this facade."
    },
    environment: {
      type: "string",
      description: "Optional environment label."
    },
    cwd: {
      type: "string",
      description: "Optional working directory."
    }
  }
});

const CANCEL_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "credentialRef",
    "presentedProof",
    "grokSessionId",
    "clientOperationId"
  ],
  properties: {
    ...SHARED_PROPERTIES
  }
});

function requireClient(client) {
  if (
    !client
    || typeof client.submit !== "function"
    || typeof client.cancel !== "function"
  ) {
    throw new Error("GrokControlPlaneClient with submit and cancel is required");
  }
  return client;
}

export function listGrokControlPlaneTools() {
  return [
    {
      name: "omnikali_submit_operation",
      description: "Submit a Grok operation through GrokControlPlaneClient to the OmniKali control plane.",
      inputSchema: SUBMIT_INPUT_SCHEMA
    },
    {
      name: "omnikali_cancel_operation",
      description: "Cancel a Grok operation through GrokControlPlaneClient to the OmniKali control plane.",
      inputSchema: CANCEL_INPUT_SCHEMA
    }
  ];
}

export function createGrokControlPlaneToolHandlers(options = {}) {
  if (options.executor || options.adapter) {
    throw new Error("grok client cannot accept an executor");
  }
  const client = requireClient(options.client);

  return Object.freeze({
    omnikali_submit_operation: async (args) => client.submit(args),
    omnikali_cancel_operation: async (args) => client.cancel(args)
  });
}

export async function callGrokControlPlaneTool(handlers, name, args) {
  if (!handlers || typeof handlers !== "object") {
    return { accepted: false, reason: "unknown_tool" };
  }
  const handler = handlers[name];
  if (typeof handler !== "function") {
    return { accepted: false, reason: "unknown_tool" };
  }
  return handler(args);
}
