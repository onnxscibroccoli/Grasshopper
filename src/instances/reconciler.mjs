import { now } from "../model.mjs";
import { assertProvider } from "./provider-contract.mjs";

const TRANSITIONS = Object.freeze({
  provisioning: new Set(["provisioning", "ready", "stopped", "degraded"]),
  ready: new Set(["ready", "stopped", "destroying", "degraded"]),
  stopped: new Set(["stopped", "ready", "destroying", "degraded"]),
  destroying: new Set(["destroying", "destroyed", "degraded"]),
  destroyed: new Set(["destroyed"]),
  degraded: new Set(["degraded", "provisioning", "ready", "stopped", "destroying"])
});

export class InstanceReconciler {
  constructor(controlPlane, providers = {}) { this.controlPlane = controlPlane; this.providers = providers; }
  providerFor(instance) {
    const name = instance.provider || instance.desired?.provider || "memory";
    const provider = this.providers[name]; if (!provider) throw new Error("no provider registered: " + name);
    return assertProvider(provider);
  }
  async current(instanceId) { const state = await this.controlPlane.store.load(); return state.instances?.[instanceId]; }
  async reconcileInstance(instanceId) {
    const state = await this.controlPlane.store.load(); const instance = state.instances?.[instanceId];
    if (!instance) throw new Error("unknown instance: " + instanceId);
    if (instance.state === "destroyed") return instance;
    const provider = this.providerFor(instance);
    try {
      const observed = await provider.inspect(instance);
      if (observed.ok === false && instance.state !== "provisioning") return this.fail(instanceId, "provider absent");
      if (instance.state === "provisioning") {
        const provisioned = await provider.provision(instance);
        if (provisioned.ok === false) return this.fail(instanceId, "provision failed");
        if (instance.desired?.running === false) { await this.set(instanceId, "stopped", { resourceId: provisioned.resourceId, provider: provisioned.provider, capabilities: provisioned.capabilities }); return this.current(instanceId); }
        const started = await provider.start(instance);
        if (started.ok === false) return this.fail(instanceId, "start failed");
        await this.set(instanceId, "ready", { resourceId: started.resourceId, provider: started.provider, capabilities: started.capabilities }); return this.current(instanceId);
      }
      if (instance.state === "ready" && observed.state === "stopped") {
        const started = await provider.start(instance); if (started.ok === false) return this.fail(instanceId, "resume failed");
        await this.set(instanceId, "ready", { resourceId: started.resourceId, provider: started.provider, capabilities: started.capabilities }); return this.current(instanceId);
      }
      if (instance.state === "stopped" && instance.desired?.running === true) {
        const started = await provider.start(instance); if (started.ok === false) return this.fail(instanceId, "start failed");
        return this.set(instanceId, "ready", { resourceId: started.resourceId, provider: started.provider, capabilities: started.capabilities });
      }
      return instance;
    } catch (error) { return this.fail(instanceId, error instanceof Error ? error.message : String(error)); }
  }
  async destroyInstance(instanceId) {
    const state = await this.controlPlane.store.load(); const instance = state.instances?.[instanceId];
    if (!instance) throw new Error("unknown instance: " + instanceId);
    if (instance.mode !== "ephemeral") throw new Error("persistent instance must be stopped, not destroyed");
    const provider = this.providerFor(instance); await this.set(instanceId, "destroying");
    const result = await provider.destroy(instance); if (result.ok === false) return this.fail(instanceId, "destroy failed");
    return this.set(instanceId, "destroyed", { resourceId: result.resourceId, provider: result.provider });
  }
  async stopInstance(instanceId) {
    const state = await this.controlPlane.store.load(); const instance = state.instances?.[instanceId];
    if (!instance) throw new Error("unknown instance: " + instanceId);
    if (instance.state === "destroyed") return instance;
    const provider = this.providerFor(instance); const result = await provider.stop(instance);
    if (result.ok === false) return this.fail(instanceId, "stop failed");
    return this.set(instanceId, "stopped", { resourceId: result.resourceId, provider: result.provider });
  }
  async set(instanceId, stateName, metadata = {}) {
    return this.controlPlane.store.update(state => {
      const instance = state.instances?.[instanceId]; if (!instance) throw new Error("unknown instance: " + instanceId);
      if (!TRANSITIONS[instance.state]?.has(stateName)) throw new Error(`invalid instance transition: ${instance.state} -> ${stateName}`);
      instance.state = stateName; instance.updatedAt = now(); Object.assign(instance, metadata);
      state.events.push({ id: "evt_" + crypto.randomUUID(), type: "instance.reconciled", at: now(), data: { instanceId, state: stateName, ...metadata } }); return state;
    });
  }
  async fail(instanceId, reason) { return this.set(instanceId, "degraded", { error: reason }); }
}
