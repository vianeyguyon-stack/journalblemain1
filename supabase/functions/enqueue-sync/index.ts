import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EnqueueSyncRequest {
  account_id: string;
  operation?: "sync_trades" | "check_status";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Vérifier l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parser le body
    const body: EnqueueSyncRequest = await req.json();
    const { account_id, operation = "sync_trades" } = body;

    if (!account_id) {
      throw new Error("Missing account_id");
    }

    // Vérifier que le compte existe et que l'utilisateur y a accès
    const { data: account, error: fetchError } = await supabase
      .from("mt_accounts")
      .select("*, journals!inner(id)")
      .eq("id", account_id)
      .single();

    if (fetchError || !account) {
      throw new Error("Account not found");
    }

    // Vérifier l'accès au journal
    const { data: hasAccess, error: accessError } = await supabase.rpc(
      "user_has_journal_access",
      { p_user_id: user.id, p_journal_id: account.journal_id }
    );

    if (accessError || !hasAccess) {
      throw new Error("Access denied");
    }

    // Vérifier qu'il n'y a pas déjà un job pending pour ce compte
    const { data: existingJob } = await supabase
      .from("sync_queue")
      .select("id")
      .eq("mt_account_id", account_id)
      .eq("operation", operation)
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (existingJob) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Sync already queued",
          job_id: existingJob.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Créer un nouveau job dans la queue
    const { data: job, error: insertError } = await supabase
      .from("sync_queue")
      .insert({
        mt_account_id: account_id,
        operation,
        status: "pending",
        retry_count: 0,
        next_retry_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to enqueue sync:", insertError);
      throw new Error("Failed to enqueue sync");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sync queued successfully",
        job_id: job.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in enqueue-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
