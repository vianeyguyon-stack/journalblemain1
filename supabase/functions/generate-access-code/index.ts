import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateCodeRequest {
  journal_id: string;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

    const { journal_id } = (await req.json()) as GenerateCodeRequest;

    if (!journal_id) {
      throw new Error("journal_id est requis");
    }

    const supabaseAdmin = await import("npm:@supabase/supabase-js").then(
      (mod) =>
        mod.createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
    );

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("*, journals(id, name)")
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

    if (subscription.journal_id !== journal_id) {
      const journalName = subscription.journals?.name || "ce journal";
      throw new Error(
        `Votre abonnement est lié à ${journalName}. Vous ne pouvez générer des codes que pour ce journal.`
      );
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);

    if (periodEnd < now) {
      throw new Error("Votre abonnement a expiré");
    }

    const code = generateCode();

    const { data: newCode, error: codeError } = await supabaseAdmin
      .from("access_codes")
      .insert({
        code: code,
        user_id: user.id,
        subscription_id: subscription.id,
        plan_id: subscription.plan_id,
        journal_id: journal_id,
        status: "pending",
        expires_at: subscription.current_period_end,
      })
      .select()
      .single();

    if (codeError) {
      console.error("Error creating access code:", codeError);
      throw new Error("Erreur lors de la création du code d'accès");
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "access_code_generated",
      resource_type: "access_code",
      resource_id: newCode.id,
      metadata: {
        code: code,
        journal_id: journal_id,
        subscription_id: subscription.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        code: code,
        access_code: newCode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-access-code:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de la génération du code",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
