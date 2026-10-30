import { now } from "../model.mjs";
import { assertProvider, providerResult } from "./provider-contract.mjs";

export class MemoryInstanceProvider {
  constructor(name = "memory") { this.name = name; this.instances = new Map(); }
  async provision(instance) {
    const current = this.instances.get(instance.id);
    if (current) return providerResult(this, "provision", { ok: true, state: current.state, resourceId: current.resourceId, capabilities: current.capabilities, evidence: "existing" });
    const resource = { resourceId: "mem_" + instance.id, instanceId: instance.id, provider: this.name, state: "stopped", capabilities: Array.isArray(instance.desired?.capabilities) ? [...instance.desired.capabilities] : [], createdAt: now() };
    this.instances.set(instance.id, resource); return providerResult(this, "provision", resource);
  }
  async start(instance) { const current = this.instances.get(instance.id) || (await this.provision(instance), this.instances.get(instance.id)); current.state = "ready"; current.startedAt = now(); return providerResult(this, "start", current); }
  async stop(instance) { const current = this.instances.get(instance.id); if (!current) return providerResult(this, "stop", { ok: false, state: "absent" }); current.state = "stopped"; current.stoppedAt = now(); return providerResult(this, "stop", current); }
  async destroy(instance) { const current = this.instances.get(instance.id); if (!current) return providerResult(this, "destroy", { state: "destroyed", evidence: "already-absent" }); this.instances.delete(instance.id); return providerResult(this, "destroy", { state: "destroyed", resourceId: current.resourceId }); }
  async inspect(instance) { const current = this.instances.get(instance.id); return providerResult(this, "inspect", current ? { state: current.state, resourceId: current.resourceId, capabilities: current.capabilities } : { ok: false, state: "absent" }); }
}
export function createMemoryProvider() { const provider = new MemoryInstanceProvider(); assertProvider(provider); return provider; }
