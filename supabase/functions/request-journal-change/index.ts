import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface JournalChangeRequest {
  requested_journal_id: string;
  reason?: string;
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

    const { requested_journal_id, reason } = (await req.json()) as JournalChangeRequest;

    if (!requested_journal_id) {
      throw new Error("requested_journal_id est requis");
    }

    const supabaseAdmin = await import("npm:@supabase/supabase-js").then(
      (mod) =>
        mod.createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
    );

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      throw new Error("Erreur lors de la récupération de l'abonnement");
    }

    if (!subscription) {
      throw new Error("Aucun abonnement actif trouvé");
    }

    if (!subscription.journal_id) {
      throw new Error("Votre abonnement n'est pas lié à un journal");
    }

    if (subscription.journal_id === requested_journal_id) {
      throw new Error("Vous êtes déjà abonné à ce journal");
    }

    const { data: existingRequest, error: existingError } = await supabaseAdmin
      .from("journal_change_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing request:", existingError);
      throw new Error("Erreur lors de la vérification des demandes existantes");
    }

    if (existingRequest) {
      throw new Error("Vous avez déjà une demande de changement en attente");
    }

    const { data: requestedJournal, error: journalError } = await supabaseAdmin
      .from("journals")
      .select("*")
      .eq("id", requested_journal_id)
      .eq("is_active", true)
      .maybeSingle();

    if (journalError) {
      console.error("Error fetching journal:", journalError);
      throw new Error("Erreur lors de la vérification du journal");
    }

    if (!requestedJournal) {
      throw new Error("Journal demandé introuvable ou inactif");
    }

    const now = new Date();

    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("journal_change_requests")
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        current_journal_id: subscription.journal_id,
        requested_journal_id: requested_journal_id,
        status: "pending",
        reason: reason || null,
        requested_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating request:", insertError);
      throw new Error("Erreur lors de la création de la demande");
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "journal_change_requested",
      resource_type: "journal_change_request",
      resource_id: newRequest.id,
      metadata: {
        current_journal_id: subscription.journal_id,
        requested_journal_id: requested_journal_id,
        reason: reason,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demande de changement créée avec succès",
        request: newRequest,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in request-journal-change:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de la demande de changement",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
