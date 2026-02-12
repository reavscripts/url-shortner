// api/[shortId].js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export default async function handler(req, res) {
  // Env check
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase env vars (redirect)", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      urlValue: supabaseUrl,
    });
    return res.status(500).send("Server misconfigured (missing Supabase env).");
  }

  const { shortId } = req.query;

  if (!shortId || typeof shortId !== "string") {
    return res.status(400).send("Short ID is missing.");
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("short_urls")
      .select("long_url")
      .eq("short_id", shortId)
      .single();

    // "no rows"
    if (error && error.code === "PGRST116") {
      console.warn(`Short URL '${shortId}' not found.`);
      return res.status(404).send("Short URL not found.");
    }

    if (error) {
      console.error("Supabase query error during redirect:", error);
      return res.status(500).send("Internal server error during redirect.");
    }

    if (!data?.long_url) {
      return res.status(404).send("Short URL not found.");
    }

    res.writeHead(302, { Location: data.long_url });
    res.end();
  } catch (err) {
    console.error("Server error during redirect:", err);
    res.status(500).send("Internal server error during redirect.");
  }
}
