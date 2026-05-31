import { upsertWebhook } from "../lib/helius.js";
import { createLogger }  from "../lib/logger.js";
const log = createLogger("setup");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (req.query.secret !== process.env.SETUP_SECRET) return res.status(401).end();
  const wallets = (process.env.WATCHED_WALLETS || "").split(",").filter(Boolean);
  if (!wallets.length) return res.status(400).json({ error: "WATCHED_WALLETS is empty" });
  try {
    const result = await upsertWebhook(wallets);
    log.info("Setup complete");
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    log.error("Setup failed", { error: e.message });
    return res.status(500).json({ error: e.message });
  }
}
