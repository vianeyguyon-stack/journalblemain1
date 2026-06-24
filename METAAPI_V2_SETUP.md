# MetaAPI V2 - Architecture et Configuration

## Vue d'ensemble

Le système MetaAPI a été complètement refactorisé en architecture V2 avec les principes suivants:

- **Région unique**: `london` (Europe)
- **Multi-tenant strict**: Accès basé sur `journal_members`
- **Queue persistée**: Synchronisation asynchrone via `sync_queue`
- **Rate limiting intelligent**: Gestion robuste des erreurs 202 et 429
- **Worker cron**: Traitement automatique toutes les 2 minutes

## Architecture

### Tables principales

1. **journals** - Journaux de trading (existante)
2. **journal_members** - Système multi-tenant strict
3. **mt_accounts** - Comptes MT (région london uniquement)
4. **trades** - Historique des trades synchronisés
5. **sync_queue** - Queue persistée pour synchronisation
6. **metaapi_rate_limits** - Gestion du rate limiting

### Edge Functions

1. **create-mt-account** - Crée un compte MT via MetaAPI Provisioning API
2. **regenerate-config-link** - Régénère le lien de configuration (TTL 7 jours)
3. **enqueue-sync** - Ajoute un job de synchronisation dans la queue
4. **delete-mt-account** - Supprime un compte MT
5. **sync-worker** - Worker qui traite la queue (à exécuter en cron)

## Configuration du Cron Job

Le worker `sync-worker` doit être exécuté toutes les 2 minutes via Supabase Scheduled Functions.

### Option 1: Supabase Dashboard (Recommandé)

1. Aller dans **Database** → **Cron Jobs**
2. Créer un nouveau cron job avec:
   - **Name**: `metaapi-sync-worker`
   - **Schedule**: `*/2 * * * *` (toutes les 2 minutes)
   - **Command**:
   ```sql
   SELECT net.http_post(
     url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/sync-worker',
     headers := jsonb_build_object(
       'Content-Type', 'application/json'
     ),
     body := '{}'::jsonb
   );
   ```

### Option 2: pg_cron via SQL

```sql
SELECT cron.schedule(
  'metaapi-sync-worker',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/sync-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Flux de synchronisation

### 1. Création d'un compte MT

```typescript
POST /functions/v1/create-mt-account
{
  "journal_id": "uuid",
  "name": "My Account",
  "broker": "ICMarkets-Live",
  "platform": "MT5",
  "account_type": "demo"
}
```

Retourne:
- `metaapi_account_id`
- `config_link` (valide 7 jours)
- Compte enregistré en DB avec status `pending_configuration`

### 2. Configuration du compte

L'utilisateur ouvre le `config_link` et configure ses identifiants MT4/MT5.
MetaAPI déploie automatiquement le compte.

### 3. Vérification du statut

```typescript
POST /functions/v1/enqueue-sync
{
  "account_id": "uuid",
  "operation": "check_status"
}
```

Ajoute un job dans `sync_queue` pour vérifier l'état du déploiement.

### 4. Synchronisation des trades

```typescript
POST /functions/v1/enqueue-sync
{
  "account_id": "uuid",
  "operation": "sync_trades"
}
```

Ajoute un job dans `sync_queue` pour synchroniser l'historique des trades.

### 5. Traitement par le worker

Le worker `sync-worker` s'exécute toutes les 2 minutes et:

1. Sélectionne max 10 jobs `pending` non `locked`
2. Pour chaque job:
   - Lock le job
   - Vérifie le rate limit
   - Appelle MetaAPI
   - Gère les réponses 202/429/Success
   - Met à jour le statut

#### Gestion 202 (Accepted)

Quand MetaAPI retourne 202 (données en cours de préparation):
- Incrémente `retry_count`
- `next_retry_at` = NOW() + 5 secondes
- Status reste `pending`

#### Gestion 429 (Too Many Requests)

Quand MetaAPI retourne 429:
- Incrémente `consecutive_429`
- Si `consecutive_429 >= 3`: throttle 15 minutes
- Sinon: utilise `recommendedRetryTime`
- Met à jour `metaapi_rate_limits.throttled_until`

#### Success

- Insère/update les trades dans `trades` table
- Met à jour `mt_accounts.last_sync_at`
- Marque le job comme `completed`
- Reset les compteurs de rate limit

## Sécurité

### Multi-tenant

Toutes les fonctions vérifient l'accès via:

```typescript
const { data: hasAccess } = await supabase.rpc(
  'user_has_journal_access',
  { p_user_id: user.id, p_journal_id: journal_id }
);
```

### RLS (Row Level Security)

Activé sur toutes les tables avec politiques strictes:
- Users peuvent voir/modifier uniquement leurs journaux
- `sync_queue` accessible uniquement par service role
- `metaapi_rate_limits` accessible uniquement par service role

## Variables d'environnement

Toutes les variables sont déjà configurées automatiquement:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `METAAPI_TOKEN`

## Monitoring

### Vérifier la queue

```sql
SELECT
  sq.id,
  sq.operation,
  sq.status,
  sq.retry_count,
  sq.next_retry_at,
  sq.error_message,
  ma.name as account_name
FROM sync_queue sq
JOIN mt_accounts ma ON ma.id = sq.mt_account_id
ORDER BY sq.created_at DESC
LIMIT 20;
```

### Vérifier les rate limits

```sql
SELECT
  ma.name,
  rl.consecutive_429,
  rl.throttled_until,
  rl.last_429_at
FROM metaapi_rate_limits rl
JOIN mt_accounts ma ON ma.id = rl.mt_account_id
WHERE rl.throttled_until > NOW()
  OR rl.consecutive_429 > 0;
```

### Vérifier les comptes

```sql
SELECT
  ma.name,
  ma.status,
  ma.deployment_state,
  ma.connection_status,
  ma.last_sync_at,
  ma.consecutive_errors
FROM mt_accounts ma
ORDER BY ma.created_at DESC;
```

## Évolution future

Cette architecture permet facilement d'ajouter:

- WebSocket streaming en temps réel
- Copie trading automatique
- Analytics avancés
- Support multi-région
- Priorités basées sur le plan d'abonnement
- Webhooks MetaAPI pour notifications instantanées

## Troubleshooting

### Le worker ne traite pas les jobs

1. Vérifier que le cron job est actif
2. Vérifier les logs de la fonction `sync-worker`
3. Vérifier que `METAAPI_TOKEN` est configuré

### Erreurs 429 persistantes

1. Vérifier `metaapi_rate_limits` table
2. Attendre que `throttled_until` soit passé
3. Considérer augmenter l'intervalle du worker (3-5 minutes au lieu de 2)

### Jobs bloqués en `processing`

```sql
UPDATE sync_queue
SET status = 'pending', locked = false
WHERE status = 'processing'
  AND locked_at < NOW() - INTERVAL '10 minutes';
```

### Nettoyer les jobs complétés

```sql
DELETE FROM sync_queue
WHERE status = 'completed'
  AND created_at < NOW() - INTERVAL '7 days';
```
