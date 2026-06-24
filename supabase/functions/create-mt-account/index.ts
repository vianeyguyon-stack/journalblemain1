import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateAccountRequest {
  journal_id: string;
  name: string;
  broker: string;
  platform: "MT4" | "MT5";
  account_type: "demo" | "live";
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
    const body: CreateAccountRequest = await req.json();
    const { journal_id, name, broker, platform, account_type } = body;

    // Validation
    if (!journal_id || !name || !broker || !platform || !account_type) {
      throw new Error("Missing required fields");
    }

    // Vérifier l'accès au journal
    const { data: hasAccess, error: accessError } = await supabase.rpc(
      "user_has_journal_access",
      { p_user_id: user.id, p_journal_id: journal_id }
    );

    if (accessError || !hasAccess) {
      throw new Error("Access denied to this journal");
    }

    // Créer le compte via MetaAPI Provisioning API (london region)
    const provisioningUrl = "https://mt-provisioning-api-v1.london.agiliumtrade.ai/users/current/accounts";

    const metaapiResponse = await fetch(provisioningUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": metaapiToken,
      },
      body: JSON.stringify({
        name,
        type: "cloud",
        region: "london",
        platform,
        magic: 0,
        application: "MetaApi",
        copyFactoryRoles: [],
      }),
    });

    if (!metaapiResponse.ok) {
      const errorText = await metaapiResponse.text();
      console.error("MetaAPI error:", errorText);
      throw new Error(`MetaAPI error: ${metaapiResponse.status} - ${errorText}`);
    }

    const metaapiAccount = await metaapiResponse.json();
    const metaapiAccountId = metaapiAccount.id;

    // Générer le lien de configuration (valid 7 days)
    const configLinkUrl = `https://mt-provisioning-api-v1.london.agiliumtrade.ai/users/current/accounts/${metaapiAccountId}/configuration-link`;

    const configResponse = await fetch(`${configLinkUrl}?ttl=604800`, {
      method: "PUT",
      headers: {
        "auth-token": metaapiToken,
      },
    });

    if (!configResponse.ok) {
      throw new Error("Failed to generate configuration link");
    }

    const configData = await configResponse.json();
    const configLink = configData.link;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Enregistrer dans la base de données
    const { data: mtAccount, error: insertError } = await supabase
      .from("mt_accounts")
      .insert({
        journal_id,
        metaapi_account_id: metaapiAccountId,
        name,
        broker,
        platform,
        region: "london",
        account_type,
        status: "pending_configuration",
        config_link: configLink,
        config_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw new Error("Failed to save account");
    }

    return new Response(
      JSON.stringify({
        success: true,
        account: mtAccount,
        config_link: configLink,
        expires_at: expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-mt-account:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
