// api/health.js
export default async function handler(req, res) {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_ANON_KEY || "").trim();

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Missing env vars",
      hasUrl: !!url,
      hasKey: !!key,
    });
  }

  try {
    // ping semplice al REST endpoint (non richiede query su tabelle)
    const r = await fetch(`${url}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    const text = await r.text();
    return res.status(200).json({
      ok: true,
      status: r.status,
      body: text.slice(0, 200),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
}
