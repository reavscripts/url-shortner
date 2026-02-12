// api/shorten.js
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { long_url } = req.body || {};

  if (
    !long_url ||
    typeof long_url !== "string" ||
    (!long_url.startsWith("http://") && !long_url.startsWith("https://"))
  ) {
    return res.status(400).json({
      message: "Invalid URL. Must start with http:// or https://",
    });
  }

  try {
    // già esistente?
    const { data: existing } = await supabase
      .from("short_urls")
      .select("short_id")
      .eq("long_url", long_url)
      .maybeSingle();

    if (existing?.short_id) {
      return res.status(200).json({
        shortUrl: `https://s.reav.space/${existing.short_id}`,
      });
    }

    // genera id
    const shortId = nanoid(7);

    const { error } = await supabase
      .from("short_urls")
      .insert([{ long_url, short_id: shortId }]);

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
