import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CancelRequestBody {
  request_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Non authentifié");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = await import("npm:@supabase/supabase-js").then(
      (mod) =>
        mod.createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: { Authorization: authHeader },
          },
          auth: { persistSession: false },
        })
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Non authentifié");
    }

    const { request_id } = (await req.json()) as CancelRequestBody;

    if (!request_id) {
      throw new Error("request_id est requis");
    }

    const supabaseAdmin = await import("npm:@supabase/supabase-js").then(
      (mod) =>
        mod.createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
    );

    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from("journal_change_requests")
      .select("*")
      .eq("id", request_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching request:", fetchError);
      throw new Error("Erreur lors de la récupération de la demande");
    }

    if (!existingRequest) {
      throw new Error("Demande introuvable");
    }

    if (existingRequest.status !== "pending") {
      throw new Error(`Cette demande ne peut pas être annulée (statut: ${existingRequest.status})`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("journal_change_requests")
      .update({ status: "cancelled" })
      .eq("id", request_id);

    if (updateError) {
      console.error("Error cancelling request:", updateError);
      throw new Error("Erreur lors de l'annulation de la demande");
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "journal_change_cancelled",
      resource_type: "journal_change_request",
      resource_id: request_id,
      metadata: {
        current_journal_id: existingRequest.current_journal_id,
        requested_journal_id: existingRequest.requested_journal_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demande annulée avec succès",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in cancel-journal-change-request:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de l'annulation de la demande",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
