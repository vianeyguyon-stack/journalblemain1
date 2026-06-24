import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivateCodeRequest {
  code: string;
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

    const token = authHeader.replace("Bearer ", "");

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

    const { code } = (await req.json()) as ActivateCodeRequest;

    if (!code || typeof code !== "string") {
      throw new Error("Code invalide");
    }

    const cleanedCode = code.replace(/-/g, "").toUpperCase();

    if (cleanedCode.length !== 16) {
      throw new Error("Le code doit contenir 16 caractères");
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
      .eq("code", cleanedCode)
      .maybeSingle();

    if (codeError) {
      console.error("Error fetching access code:", codeError);
      throw new Error("Erreur lors de la validation du code");
    }

    if (!accessCode) {
      throw new Error("Code invalide");
    }

    if (accessCode.status === "expired") {
      throw new Error("Ce code a expiré");
    }

    if (accessCode.status === "revoked") {
      throw new Error("Ce code a été révoqué");
    }

    if (accessCode.status === "suspended") {
      throw new Error("Ce code est suspendu");
    }

    const now = new Date();
    const expiresAt = new Date(accessCode.expires_at);

    if (expiresAt < now) {
      await supabaseAdmin
        .from("access_codes")
        .update({ status: "expired" })
        .eq("id", accessCode.id);

      throw new Error("Ce code a expiré");
    }

    if (accessCode.user_id && accessCode.user_id !== user.id) {
      throw new Error("Ce code a déjà été activé par un autre utilisateur");
    }

    const { data: existingActivation, error: activationCheckError } = await supabaseAdmin
      .from("access_code_activations")
      .select("*")
      .eq("activated_by_user_id", user.id)
      .eq("access_code_id", accessCode.id)
      .eq("status", "active")
      .maybeSingle();

    if (activationCheckError) {
      console.error("Error checking activation:", activationCheckError);
      throw new Error("Erreur lors de la vérification de l'activation");
    }

    if (existingActivation) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Vous avez déjà accès à ce journal",
          activation: existingActivation,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (accessCode.status === "pending") {
      const { error: updateCodeError } = await supabaseAdmin
        .from("access_codes")
        .update({
          status: "active",
          activated_at: now.toISOString(),
        })
        .eq("id", accessCode.id);

      if (updateCodeError) {
        console.error("Error updating access code:", updateCodeError);
        throw new Error("Erreur lors de l'activation du code");
      }
    }

    const { data: newActivation, error: activationError } = await supabaseAdmin
      .from("access_code_activations")
      .insert({
        access_code_id: accessCode.id,
        activated_by_user_id: user.id,
        status: "active",
        activated_at: now.toISOString(),
      })
      .select()
      .single();

    if (activationError) {
      console.error("Error creating activation:", activationError);
      throw new Error("Erreur lors de la création de l'activation");
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: user.id,
      action: "journal_activated",
      resource_type: "access_code_activation",
      resource_id: newActivation.id,
      metadata: {
        access_code_id: accessCode.id,
        journal_id: accessCode.journal_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Code activé avec succès",
        activation: newActivation,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in activate-journal-code:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de l'activation du code",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
