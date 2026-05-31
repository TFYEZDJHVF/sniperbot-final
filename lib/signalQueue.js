import { createLogger } from "./logger.js";
import { send } from "../outputs/tradewiz.js";
const log = createLogger("signalQueue");

const queue = [];
let processing = false;

export function pushSignal(signal) {
  queue.push({ ...signal, queuedAt: Date.now() });
  log.info("Signal queued", { mint: signal.mint, queueLength: queue.length });
  if (!processing) drain();
}

async function drain() {
  if (processing || !queue.length) return;
  processing = true;
  while (queue.length) {
    const signal = queue.shift();
    try { await send(signal); }
    catch (e) { log.error("Output failed", { mint: signal.mint, error: e.message }); }
  }
  processing = false;
}
