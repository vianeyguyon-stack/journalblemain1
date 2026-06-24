import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAccountRequest {
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
    const body: DeleteAccountRequest = await req.json();
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

    // Supprimer le compte dans MetaAPI
    const deleteUrl = `https://mt-provisioning-api-v1.london.agiliumtrade.ai/users/current/accounts/${account.metaapi_account_id}`;

    const metaapiResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "auth-token": metaapiToken,
      },
    });

    if (!metaapiResponse.ok && metaapiResponse.status !== 404) {
      const errorText = await metaapiResponse.text();
      console.error("MetaAPI delete error:", errorText);
      throw new Error(`Failed to delete account from MetaAPI: ${metaapiResponse.status}`);
    }

    // Supprimer de la base de données (CASCADE supprime aussi trades, rate_limits, sync_queue)
    const { error: deleteError } = await supabase
      .from("mt_accounts")
      .delete()
      .eq("id", account_id);

    if (deleteError) {
      console.error("Database delete error:", deleteError);
      throw new Error("Failed to delete account from database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account deleted successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-mt-account:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
