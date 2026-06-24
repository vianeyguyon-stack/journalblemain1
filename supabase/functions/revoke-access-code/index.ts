import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RevokeCodeRequest {
  code_id: string;
  reason: string;
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

    const { code_id, reason } = (await req.json()) as RevokeCodeRequest;

    if (!code_id) {
      throw new Error("code_id est requis");
    }

    if (!reason || reason.trim() === "") {
      throw new Error("La raison de révocation est requise");
    }

    const supabaseAdmin = await import("npm:@supabase/supabase-js").then(
      (mod) =>
        mod.createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
    );

    const { data: accessCode, error: codeError } = await supabaseAdmin
      .from("access_codes")
      .select("*")
      .eq("id", code_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (codeError) {
      console.error("Error fetching access code:", codeError);
      throw new Error("Erreur lors de la récupération du code");
    }

    if (!accessCode) {
      throw new Error("Code d'accès introuvable");
    }

    if (accessCode.status === "revoked") {
      throw new Error("Ce code a déjà été révoqué");
    }

    const now = new Date();

    const { error: updateError } = await supabaseAdmin
      .from("access_codes")
      .update({
        status: "revoked",
        revoked_at: now.toISOString(),
        revoked_reason: reason,
      })
      .eq("id", code_id);

    if (updateError) {
      console.error("Error revoking access code:", updateError);
      throw new Error("Erreur lors de la révocation du code");
    }

    const { error: activationError } = await supabaseAdmin
      .from("journal_activations")
      .update({ status: "revoked" })
      .eq("access_code_id", code_id)
      .eq("status", "active");

    if (activationError) {
      console.error("Error updating activations:", activationError);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "access_code_revoked",
      resource_type: "access_code",
      resource_id: code_id,
      metadata: {
        code: accessCode.code,
        reason: reason,
        journal_id: accessCode.journal_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Code révoqué avec succès",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in revoke-access-code:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de la révocation du code",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
