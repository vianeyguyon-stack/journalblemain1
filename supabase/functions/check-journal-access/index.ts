import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * check-journal-access
 *
 * Returns whether the authenticated user has access to a given journal.
 * Access rule (HYBRID):
 *   (a) subscriptions row with user_id = auth.uid(),
 *       status IN ('active','trialing') AND journal_id = <journal_id>
 *   OR
 *   (b) journal_members row with user_id = auth.uid() AND journal_id = <journal_id>
 *
 * Logic is server-side so it cannot be bypassed from the browser.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ has_access: false, reason: "no_auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ has_access: false, reason: "no_auth" }, 401);
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { journal_id?: string };
    const journalId = body.journal_id;
    if (!journalId) {
      return json({ has_access: false, reason: "missing_journal_id" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // (a) subscription
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, journal_id, status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (sub) {
      if (sub.journal_id === journalId) {
        return json({ has_access: true, reason: "subscription" });
      }
      // user has an active sub but for another journal
      // still try (b) below
    }

    // (b) journal_members
    const { data: member } = await admin
      .from("journal_members")
      .select("id")
      .eq("user_id", userId)
      .eq("journal_id", journalId)
      .maybeSingle();

    if (member) {
      return json({ has_access: true, reason: "member" });
    }

    if (sub && sub.journal_id !== journalId) {
      return json({ has_access: false, reason: "wrong_journal" });
    }

    return json({ has_access: false, reason: "no_subscription" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return json({ has_access: false, reason: "server_error", error: msg }, 500);
  }
});
