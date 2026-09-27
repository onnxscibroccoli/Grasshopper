import { commandDisposition } from "../executor-contract.mjs";

const ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const CREDENTIAL_REF_RE = /^(secret-manager:|arn:aws:secretsmanager:|env:)[A-Za-z0-9:._/-]{1,200}$/;
const FORBIDDEN_REQUEST_KEY = /^(token|password|secret|cookie|authorization|apiKey|api_key|bearer)$/i;
const COMMAND_SECRET = /AGENT_TOKEN|PRIVATE KEY|aws_secret_access_key/i;

function requireId(name, value) {
  if (typeof value !== "string" || !ID_RE.test(value)) throw new Error("invalid " + name);
  return value;
}

export function grokOperationKey({ principalId, grokSessionId, clientOperationId }) {
  return [
    "grok",
    requireId("principalId", principalId),
    requireId("grokSessionId", grokSessionId),
    requireId("clientOperationId", clientOperationId)
  ].join(":");
}

function owns(task, principalId, request) {
  const origin = task?.origin;
  return origin?.kind === "grok"
    && origin.principalId === principalId
    && origin.grokSessionId === request.grokSessionId
    && origin.clientOperationId === request.clientOperationId;
}

export class GrokControlPlaneClient {
  constructor({ controlPlane, authenticate, executor, adapter } = {}) {
    if (executor || adapter) throw new Error("grok client cannot accept an executor");
    if (!controlPlane || typeof controlPlane.createTask !== "function" || typeof controlPlane.cancelTask !== "function" || typeof controlPlane.recordAudit !== "function" || typeof controlPlane.registerAgent !== "function") {
      throw new Error("authenticated control plane is required");
    }
    if (typeof authenticate !== "function") throw new Error("authenticator is required");
    this.controlPlane = controlPlane;
    this.authenticate = authenticate;
  }

  async submit(request) {
    const gate = await this.#gate(request);
    if (gate.denied) return gate.denied;
    const { principal, body } = gate;

    let disposition;
    try {
      disposition = commandDisposition({ commandDisposition: body.commandDisposition });
    } catch {
      return this.#deny(body, "invalid_disposition", principal.principalId);
    }
    if (typeof body.command !== "string" || body.command.length === 0 || body.command.length > 8192 || COMMAND_SECRET.test(body.command)) {
      return this.#deny(body, "command_rejected", principal.principalId);
    }
    if (body.environment != null && (typeof body.environment !== "string" || !/^[a-z0-9._-]{1,64}$/.test(body.environment))) {
      return this.#deny(body, "invalid_environment", principal.principalId);
    }

    const operationKey = grokOperationKey({
      principalId: principal.principalId,
      grokSessionId: body.grokSessionId,
      clientOperationId: body.clientOperationId
    });
    const existing = await this.#findTask(operationKey);
    if (existing && !owns(existing, principal.principalId, body)) {
      return this.#deny(body, "operation_forbidden", principal.principalId, { operationKey });
    }

    const agentId = await this.#agentId(principal.principalId, body.environment || "unspecified");
    let task;
    try {
      task = await this.controlPlane.createTask({
        agentId,
        operationKey,
        command: body.command,
        cwd: body.cwd,
        commandDisposition: disposition,
        origin: {
          kind: "grok",
          principalId: principal.principalId,
          grokSessionId: body.grokSessionId,
          clientOperationId: body.clientOperationId,
          credentialRef: body.credentialRef
        }
      });
    } catch {
      return this.#deny(body, "control_plane_rejected", principal.principalId, { operationKey });
    }
    if (!owns(task, principal.principalId, body)) {
      return this.#deny(body, "operation_forbidden", principal.principalId, { operationKey });
    }

    await this.#audit("grok.operation.accepted", {
      principalId: principal.principalId,
      grokSessionId: body.grokSessionId,
      clientOperationId: body.clientOperationId,
      credentialRef: body.credentialRef,
      operationKey,
      taskId: task.id,
      taskState: task.state,
      duplicate: Boolean(existing)
    });
    return {
      accepted: true,
      duplicate: Boolean(existing),
      operationKey,
      task,
      guarantee: "control-plane-ownership-only"
    };
  }

  async cancel(request) {
    const gate = await this.#gate(request);
    if (gate.denied) return { ...gate.denied, acknowledged: false };
    const { principal, body } = gate;
    const operationKey = grokOperationKey({
      principalId: principal.principalId,
      grokSessionId: body.grokSessionId,
      clientOperationId: body.clientOperationId
    });
    const task = await this.#findTask(operationKey);
    if (!task) return this.#deny(body, "unknown_operation", principal.principalId, { operationKey, acknowledged: false });
    if (!owns(task, principal.principalId, body)) {
      return this.#deny(body, "operation_forbidden", principal.principalId, { operationKey, acknowledged: false });
    }

    let result;
    try {
      result = await this.controlPlane.cancelTask(task.id);
    } catch {
      return this.#deny(body, "control_plane_rejected", principal.principalId, { operationKey, taskId: task.id, acknowledged: false });
    }
    await this.#audit("grok.cancel.requested", {
      principalId: principal.principalId,
      grokSessionId: body.grokSessionId,
      clientOperationId: body.clientOperationId,
      credentialRef: body.credentialRef,
      operationKey,
      taskId: task.id,
      acknowledged: Boolean(result?.acknowledged),
      reason: result?.reason || null
    });
    return { accepted: true, operationKey, taskId: task.id, ...result, guarantee: "control-plane-ownership-only" };
  }

  async #gate(request) {
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      return { denied: await this.#deny({}, "invalid_request") };
    }
    if (Object.keys(request).some(key => FORBIDDEN_REQUEST_KEY.test(key))) {
      return { denied: await this.#deny(request, "credential_material_rejected") };
    }
    if (typeof request.credentialRef !== "string" || !CREDENTIAL_REF_RE.test(request.credentialRef)) {
      return { denied: await this.#deny(request, "invalid_credential_ref") };
    }

    let principal;
    try {
      principal = await this.authenticate({
        credentialRef: request.credentialRef,
        presentedProof: request.presentedProof
      });
    } catch {
      return { denied: await this.#deny(request, "unauthenticated") };
    }
    if (!principal || typeof principal.principalId !== "string" || !ID_RE.test(principal.principalId)) {
      return { denied: await this.#deny(request, "unauthenticated") };
    }
    try {
      requireId("grokSessionId", request.grokSessionId);
      requireId("clientOperationId", request.clientOperationId);
    } catch {
      return { denied: await this.#deny(request, "invalid_operation_identity", principal.principalId) };
    }
    return { principal, body: request };
  }

  async #agentId(principalId, environment) {
    const name = "grok:" + principalId;
    const state = await this.controlPlane.store.load();
    const existing = Object.values(state.agents || {}).find(agent => agent.name === name);
    if (existing) return existing.id;
    await this.controlPlane.registerAgent({ name, environment });
    const after = await this.controlPlane.store.load();
    const created = Object.values(after.agents || {}).find(agent => agent.name === name);
    if (!created) throw new Error("grok agent registration failed");
    return created.id;
  }

  async #findTask(operationKey) {
    const state = await this.controlPlane.store.load();
    return Object.values(state.tasks || {}).find(task => task.operationKey === operationKey) || null;
  }

  async #deny(request, reason, principalId, extra = {}) {
    const { acknowledged, ...auditExtra } = extra;
    await this.#audit("grok.operation.denied", {
      reason,
      principalId: principalId || null,
      grokSessionId: request?.grokSessionId || null,
      clientOperationId: request?.clientOperationId || null,
      credentialRef: request?.credentialRef || null,
      ...auditExtra
    });
    return { accepted: false, reason, ...extra };
  }

  async #audit(type, data) {
    await this.controlPlane.recordAudit(type, data);
  }
}
