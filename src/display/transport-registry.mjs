import { assertDisplayTransport } from "./transport-contract.mjs";

export class DisplayTransportRegistry {
  constructor(transports = {}) {
    this.transports = {};
    for (const transport of Object.values(transports)) this.register(transport);
  }

  register(transport) {
    assertDisplayTransport(transport);
    this.transports[transport.name] = transport;
    return transport;
  }

  get(name) {
    const transport = this.transports[name];
    if (!transport) throw new Error("display transport not registered: " + String(name));
    return transport;
  }

  capabilities() {
    return Object.keys(this.transports).sort();
  }
}

export function createDisplayTransportRegistry(transports = {}) {
  return new DisplayTransportRegistry(transports);
}
