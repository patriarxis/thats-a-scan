import "server-only";

import { getPayload, type Payload } from "payload";
import config from "@payload-config";

let payloadInstance: Payload | null = null;
let payloadInit: Promise<Payload> | null = null;

export async function getPayloadClient(): Promise<Payload> {
  if (payloadInstance) return payloadInstance;
  if (!payloadInit) {
    payloadInit = getPayload({ config }).then((instance) => {
      payloadInstance = instance;
      return instance;
    });
  }
  return payloadInit;
}
