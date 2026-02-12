// api/shorten.js
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

function normalizeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;

  let url = raw.trim();
  if (!url) return null;

  // Add https:// if missing scheme
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const u = new URL(url);

    // Only allow http/https (block javascript:, data:, etc.)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;

    // Must have hostname
    if (!u.hostname) return null;

    return u.toString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { long_url } = req.body || {};

  const normalized = normalizeUrl(long_url);
  if (!normalized) {
    return res.status(400).json({
      message: "Invalid URL. Use example.com or https://example.com",
    });
  }

  try {
    // already exists?
    const { data: existing, error: existingError } = await supabase
      .from("short_urls")
      .select("short_id")
      .eq("long_url", normalized)
      .maybeSingle();

    if (existingError) {
      console.error("Supabase select error:", existingError);
      return res.status(500).json({ message: "Database query failed" });
    }

    if (existing?.short_id) {
      return res.status(200).json({
        shortUrl: `https://s.reav.space/${existing.short_id}`,
      });
    }

    // generate id (URL-safe for our rewrite pattern)
    const shortId = nanoid(7);

    const { error } = await supabase
      .from("short_urls")
      .insert([{ long_url: normalized, short_id: shortId }]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        message: "Database insert failed",
        error: error.message,
      });
    }

    return res.status(200).json({
      shortUrl: `https://s.reav.space/${shortId}`,
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
