export default async function handler(req, res) {
  const url = (process.env.SUPABASE_URL || "").trim();
  if (!url) return res.status(500).json({ ok: false, error: "SUPABASE_URL missing" });

  try {
    const r = await fetch(`${url}/rest/v1/`, { method: "GET" });
    const text = await r.text();
    return res.status(200).json({ ok: true, status: r.status, body: text.slice(0, 120) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
