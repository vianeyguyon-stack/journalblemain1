import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegenerateLinkRequest {
  account_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaapiToken = Deno.env.get("METAAPI_TOKEN");

    if (!metaapiToken) {
      throw new Error("METAAPI_TOKEN not configured");
    }

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
    const body: RegenerateLinkRequest = await req.json();
    const { account_id } = body;

    if (!account_id) {
      throw new Error("Missing account_id");
    }

    // Récupérer le compte
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

    // Régénérer le lien de configuration (7 jours)
    const configLinkUrl = `https://mt-provisioning-api-v1.london.agiliumtrade.ai/users/current/accounts/${account.metaapi_account_id}/configuration-link`;

    const configResponse = await fetch(`${configLinkUrl}?ttl=604800`, {
      method: "PUT",
      headers: {
        "auth-token": metaapiToken,
      },
    });

    if (!configResponse.ok) {
      const errorText = await configResponse.text();
      console.error("MetaAPI error:", errorText);
      throw new Error("Failed to regenerate configuration link");
    }

    const configData = await configResponse.json();
    const configLink = configData.link;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Mettre à jour dans la base de données
    const { error: updateError } = await supabase
      .from("mt_accounts")
      .update({
        config_link: configLink,
        config_expires_at: expiresAt.toISOString(),
      })
      .eq("id", account_id);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to update account");
    }

    return new Response(
      JSON.stringify({
        success: true,
        config_link: configLink,
        expires_at: expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in regenerate-config-link:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
