import { parseNativeTransfers, detectPumpFunLaunch } from "../lib/tracker.js";
import { registerTransfer, getChainForWallet, markChainSniped, initWatchedWallets } from "../lib/chainState.js";
import { pushSignal } from "../lib/signalQueue.js";
import { addWalletsToWebhook } from "../lib/helius.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("webhook");
initWatchedWallets((process.env.WATCHED_WALLETS || "").split(","));
const MIN_SOL = parseFloat(process.env.MIN_SOL_THRESHOLD || "0.1");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) return res.status(401).end();

  const txs   = Array.isArray(req.body) ? req.body : [req.body];
  const start = Date.now();
  await Promise.allSettled(txs.map(processTx));
  log.debug("Handler done", { ms: Date.now() - start, txCount: txs.length });
  return res.status(200).json({ ok: true });
}

async function processTx(tx) {
  const t0 = Date.now();
  try {
    const launch = detectPumpFunLaunch(tx);
    if (launch) {
      const chain = getChainForWallet(launch.feePayer);
      if (chain && !chain.sniped) {
        const latencyMs = Date.now() - t0;
        log.info("🚨 LAUNCH", { mint: launch.mint, hops: chain.hops.length, latencyMs });
        markChainSniped(chain.rootWallet);
        pushSignal({ mint: launch.mint, dex: launch.dex, solAmount: launch.solAmount, chain, launch, latencyMs });
      }
      return;
    }
    const transfers = parseNativeTransfers(tx);
    await Promise.allSettled(
      transfers.filter(t => t.solAmount >= MIN_SOL).map(async t => {
        const chain = registerTransfer(t);
        if (chain) await addWalletsToWebhook([t.to]);
      })
    );
  } catch (e) {
    log.error("processTx failed", { error: e.message });
  }
}
