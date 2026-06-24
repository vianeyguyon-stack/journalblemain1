import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DealHistory {
  id: string;
  positionId?: string;
  type: string;
  time: string;
  symbol: string;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
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

    console.log("🔄 Starting sync worker...");

    // Sélectionner jusqu'à 10 jobs prêts à être traités
    const { data: jobs, error: fetchError } = await supabase
      .from("sync_queue")
      .select("*")
      .eq("status", "pending")
      .eq("locked", false)
      .lte("next_retry_at", new Date().toISOString())
      .limit(10);

    if (fetchError) {
      console.error("Failed to fetch jobs:", fetchError);
      throw new Error("Failed to fetch jobs");
    }

    if (!jobs || jobs.length === 0) {
      console.log("✅ No jobs to process");
      return new Response(
        JSON.stringify({ success: true, message: "No jobs to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Found ${jobs.length} jobs to process`);

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        // Lock le job
        const { error: lockError } = await supabase
          .from("sync_queue")
          .update({ locked: true, locked_at: new Date().toISOString(), status: "processing" })
          .eq("id", job.id)
          .eq("locked", false);

        if (lockError) {
          console.log(`⚠️ Failed to lock job ${job.id}, skipping`);
          continue;
        }

        // Récupérer le compte MT
        const { data: account, error: accountError } = await supabase
          .from("mt_accounts")
          .select("*")
          .eq("id", job.mt_account_id)
          .single();

        if (accountError || !account) {
          console.error(`❌ Account not found for job ${job.id}`);
          await supabase.from("sync_queue").update({
            status: "failed",
            error_message: "Account not found",
            locked: false,
          }).eq("id", job.id);
          failed++;
          continue;
        }

        // Vérifier rate limit
        const { data: rateLimit } = await supabase
          .from("metaapi_rate_limits")
          .select("*")
          .eq("mt_account_id", account.id)
          .maybeSingle();

        if (rateLimit?.throttled_until) {
          const throttledUntil = new Date(rateLimit.throttled_until);
          if (throttledUntil > new Date()) {
            console.log(`⏳ Account ${account.id} is throttled until ${throttledUntil}`);
            const nextRetry = new Date(throttledUntil.getTime() + 5000);
            await supabase.from("sync_queue").update({
              status: "pending",
              locked: false,
              next_retry_at: nextRetry.toISOString(),
            }).eq("id", job.id);
            continue;
          }
        }

        // Traiter le job selon l'opération
        if (job.operation === "sync_trades") {
          await syncTrades(supabase, account, job, metaapiToken);
          processed++;
        } else if (job.operation === "check_status") {
          await checkAccountStatus(supabase, account, job, metaapiToken);
          processed++;
        }

      } catch (error: any) {
        console.error(`❌ Error processing job ${job.id}:`, error);
        failed++;

        // Incrémenter retry count
        const newRetryCount = (job.retry_count || 0) + 1;
        const maxRetries = job.max_retries || 5;

        if (newRetryCount >= maxRetries) {
          await supabase.from("sync_queue").update({
            status: "failed",
            error_message: error.message,
            locked: false,
            retry_count: newRetryCount,
          }).eq("id", job.id);
        } else {
          const nextRetry = new Date(Date.now() + Math.pow(2, newRetryCount) * 5000);
          await supabase.from("sync_queue").update({
            status: "pending",
            locked: false,
            retry_count: newRetryCount,
            next_retry_at: nextRetry.toISOString(),
            error_message: error.message,
          }).eq("id", job.id);
        }
      }
    }

    console.log(`✅ Worker completed: ${processed} processed, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, processed, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Worker error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncTrades(supabase: any, account: any, job: any, metaapiToken: string) {
  console.log(`📊 Syncing trades for account ${account.metaapi_account_id}`);

  const startTime = account.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const historyUrl = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${account.metaapi_account_id}/historical-market-data/deals/${startTime}/${new Date().toISOString()}`;

  const response = await fetch(historyUrl, {
    method: "GET",
    headers: {
      "auth-token": metaapiToken,
    },
  });

  // Gestion 202 Accepted
  if (response.status === 202) {
    console.log(`⏳ MetaAPI returned 202 for account ${account.metaapi_account_id}`);

    await updateRateLimit(supabase, account.id, { consecutive_202: 1, last_202: new Date() });

    const nextRetry = new Date(Date.now() + 5000);
    await supabase.from("sync_queue").update({
      status: "pending",
      locked: false,
      retry_count: (job.retry_count || 0) + 1,
      next_retry_at: nextRetry.toISOString(),
    }).eq("id", job.id);
    return;
  }

  // Gestion 429 Too Many Requests
  if (response.status === 429) {
    console.log(`🚫 MetaAPI returned 429 for account ${account.metaapi_account_id}`);

    const retryAfter = response.headers.get("retry-after") || response.headers.get("recommendedRetryTime");
    const throttleDuration = retryAfter ? parseInt(retryAfter) * 1000 : 15 * 60 * 1000;

    const consecutive429 = ((await getConsecutive429(supabase, account.id)) || 0) + 1;
    const throttledUntil = new Date(Date.now() + (consecutive429 >= 3 ? 15 * 60 * 1000 : throttleDuration));

    await updateRateLimit(supabase, account.id, {
      consecutive_429: consecutive429,
      last_429: new Date(),
      throttled_until: throttledUntil,
    });

    await supabase.from("sync_queue").update({
      status: "pending",
      locked: false,
      next_retry_at: new Date(throttledUntil.getTime() + 5000).toISOString(),
    }).eq("id", job.id);
    return;
  }

  if (!response.ok) {
    throw new Error(`MetaAPI error: ${response.status}`);
  }

  const deals: DealHistory[] = await response.json();
  console.log(`📈 Found ${deals.length} deals`);

  // Reset rate limit counters on success
  await updateRateLimit(supabase, account.id, { consecutive_429: 0, consecutive_202: 0 });

  // Insérer les trades (upsert)
  if (deals.length > 0) {
    const tradesToInsert = deals.map(deal => ({
      mt_account_id: account.id,
      journal_id: account.journal_id,
      metaapi_deal_id: deal.id,
      position_id: deal.positionId,
      symbol: deal.symbol,
      type: deal.type,
      volume: deal.volume,
      price: deal.price,
      profit: deal.profit,
      commission: deal.commission,
      swap: deal.swap,
      open_time: deal.time,
    }));

    for (const trade of tradesToInsert) {
      await supabase.from("trades").upsert(trade, { onConflict: "metaapi_deal_id" });
    }
  }

  // Mettre à jour last_sync_at
  await supabase.from("mt_accounts").update({
    last_sync_at: new Date().toISOString(),
    consecutive_errors: 0,
  }).eq("id", account.id);

  // Marquer le job comme terminé
  await supabase.from("sync_queue").update({
    status: "completed",
    locked: false,
  }).eq("id", job.id);

  console.log(`✅ Sync completed for account ${account.metaapi_account_id}`);
}

async function checkAccountStatus(supabase: any, account: any, job: any, metaapiToken: string) {
  console.log(`🔍 Checking status for account ${account.metaapi_account_id}`);

  const accountUrl = `https://mt-provisioning-api-v1.london.agiliumtrade.ai/users/current/accounts/${account.metaapi_account_id}`;

  const response = await fetch(accountUrl, {
    method: "GET",
    headers: {
      "auth-token": metaapiToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check account status: ${response.status}`);
  }

  const accountData = await response.json();

  await supabase.from("mt_accounts").update({
    deployment_state: accountData.state,
    connection_status: accountData.connectionStatus,
    status: mapMetaApiStatus(accountData.state, accountData.connectionStatus),
  }).eq("id", account.id);

  await supabase.from("sync_queue").update({
    status: "completed",
    locked: false,
  }).eq("id", job.id);

  console.log(`✅ Status check completed for account ${account.metaapi_account_id}`);
}

async function getConsecutive429(supabase: any, accountId: string): Promise<number> {
  const { data } = await supabase
    .from("metaapi_rate_limits")
    .select("consecutive_429")
    .eq("mt_account_id", accountId)
    .maybeSingle();

  return data?.consecutive_429 || 0;
}

async function updateRateLimit(supabase: any, accountId: string, updates: any) {
  const { data: existing } = await supabase
    .from("metaapi_rate_limits")
    .select("*")
    .eq("mt_account_id", accountId)
    .maybeSingle();

  const payload: any = { mt_account_id: accountId };

  if (updates.consecutive_429 !== undefined) payload.consecutive_429 = updates.consecutive_429;
  if (updates.consecutive_202 !== undefined) payload.consecutive_202 = updates.consecutive_202;
  if (updates.last_429) payload.last_429_at = updates.last_429.toISOString();
  if (updates.last_202) payload.last_202_at = updates.last_202.toISOString();
  if (updates.throttled_until) payload.throttled_until = updates.throttled_until.toISOString();

  if (existing) {
    await supabase.from("metaapi_rate_limits").update(payload).eq("mt_account_id", accountId);
  } else {
    await supabase.from("metaapi_rate_limits").insert(payload);
  }
}

function mapMetaApiStatus(state: string, connectionStatus: string): string {
  if (state === "DEPLOYED" && connectionStatus === "CONNECTED") return "connected";
  if (state === "DEPLOYED") return "deployed";
  if (state === "DEPLOYING") return "deploying";
  if (state === "UNDEPLOYING") return "undeploying";
  if (state === "UNDEPLOYED") return "undeployed";
  return "error";
}
