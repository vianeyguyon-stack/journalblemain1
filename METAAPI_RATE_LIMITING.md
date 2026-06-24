# Système de Rate Limiting MetaApi

## Vue d'ensemble

Le système de rate limiting MetaApi a été implémenté pour gérer intelligemment les requêtes vers l'API MetaApi et éviter les erreurs 429 (Too Many Requests). Il comprend :

1. **File d'attente avec délais** - Queue système qui traite les requêtes une par une
2. **Retry automatique** - Gestion intelligente des erreurs 429 avec backoff
3. **Limitation concurrente** - Maximum 5 requêtes simultanées par compte
4. **Monitoring en temps réel** - Dashboard de visualisation des statistiques

## Architecture

### Tables de base de données

#### `metaapi_request_logs`
Enregistre toutes les requêtes MetaApi avec leur statut et détails :
- `id` - Identifiant unique de la requête
- `account_id` - Compte MT concerné
- `user_id` - Utilisateur propriétaire
- `request_type` - Type : history, positions, info, sync, delete
- `status` - Statut : pending, processing, success, failed, retrying
- `attempt_count` - Nombre de tentatives
- `error_code` - Code d'erreur si échec
- `error_message` - Message d'erreur détaillé
- `recommended_retry_time` - Temps recommandé avant retry (ms)
- `request_data` - Données de la requête (JSON)
- `response_data` - Données de la réponse (JSON)
- `started_at` - Date de début
- `completed_at` - Date de fin

#### `metaapi_rate_limits`
Gère les limites de taux par compte :
- `account_id` - Compte MT (unique)
- `last_request_at` - Date de dernière requête
- `consecutive_errors` - Erreurs 429 consécutives
- `total_429_errors` - Total d'erreurs 429
- `is_throttled` - Compte temporairement bloqué
- `throttle_until` - Date de fin du blocage
- `active_requests` - Nombre de requêtes en cours

### Configuration

Paramètres par défaut dans `metaapi-queue-types.ts` :

```typescript
export const DEFAULT_CONFIG: QueueConfig = {
  delayBetweenRequests: 3000,      // 3 secondes entre chaque requête
  maxRetries: 3,                    // Max 3 tentatives
  requestTimeout: 30000,            // Timeout de 30 secondes
  maxConcurrentRequests: 5,         // Max 5 requêtes simultanées
};
```

## Utilisation

### Dans les Edge Functions

Les fonctions `metaapi-sync-trades` et `metaapi-get-history` utilisent automatiquement le système :

```typescript
import { MetaApiQueueManager } from '../_shared/metaapi-queue-manager.ts';

const queueManager = new MetaApiQueueManager(supabaseClient, {
  delayBetweenRequests: 3000,
  maxRetries: 3,
  requestTimeout: 30000,
  maxConcurrentRequests: 5,
});

// Ajouter une requête à la queue
const requestId = await queueManager.enqueueRequest(
  accountId,
  userId,
  'history',
  { startTime, endTime, region },
  1 // priorité
);

// Traiter la queue
await queueManager.processQueue(accountId, async (request) => {
  // Logique de la requête
  return await fetchData(request.requestData);
});

// Récupérer le résultat
const { data: requestLog } = await supabaseClient
  .from('metaapi_request_logs')
  .select('status, response_data')
  .eq('id', requestId)
  .single();
```

## Gestion des erreurs 429

### Détection automatique

Le système détecte les erreurs 429 de plusieurs façons :
- Code de statut HTTP 429
- En-tête `Retry-After` dans la réponse
- Message d'erreur contenant "Too many requests"
- Propriété `recommendedRetryTime` dans l'erreur

### Stratégie de retry

1. **Premier échec** : Attendre le temps recommandé (ou 60s par défaut)
2. **Deuxième échec** : Backoff exponentiel
3. **Troisième échec** : Compte marqué comme throttled

### Throttling automatique

Après 3 erreurs 429 consécutives :
- Le compte est marqué `is_throttled = true`
- Aucune nouvelle requête n'est acceptée jusqu'à `throttle_until`
- Les requêtes existantes en queue sont mises en pause

### Reset automatique

Dès qu'une requête réussit :
- `consecutive_errors` est remis à 0
- `is_throttled` est remis à false
- Les requêtes en queue reprennent

## Dashboard de monitoring

Accessible via l'onglet "API Monitor" dans le dashboard :

### Statistiques affichées

1. **Métriques globales**
   - Total de requêtes
   - Requêtes réussies (avec taux de succès)
   - Requêtes échouées
   - Total d'erreurs 429

2. **Rate Limits par compte**
   - Requêtes actives
   - Erreurs consécutives
   - Total d'erreurs 429
   - Statut de throttling

3. **Historique des requêtes**
   - 50 dernières requêtes
   - Statut avec icônes
   - Type de requête
   - Nombre de tentatives
   - Code d'erreur
   - Date relative

### Mise à jour automatique

Le dashboard se rafraîchit automatiquement toutes les 10 secondes pour afficher les données en temps réel.

## Avantages

### 1. Fiabilité
- Retry automatique en cas d'échec
- Gestion intelligente du rate limiting
- Pas de perte de requêtes

### 2. Performance
- Délais optimisés entre requêtes
- Requêtes concurrentes limitées
- Évite la surcharge de l'API

### 3. Traçabilité
- Logs complets de toutes les requêtes
- Historique des erreurs
- Statistiques détaillées

### 4. Monitoring
- Dashboard en temps réel
- Alertes visuelles pour les problèmes
- Identification rapide des comptes problématiques

### 5. Autonomie
- Gestion automatique sans intervention
- Recovery automatique après erreurs
- Adaptation dynamique aux limites

## Maintenance

### Nettoyage des logs

Une fonction `clean_old_metaapi_logs()` est disponible pour supprimer les logs de plus de 30 jours :

```sql
SELECT clean_old_metaapi_logs();
```

Peut être configurée en cron job pour s'exécuter automatiquement.

### Ajustement de la configuration

Pour modifier les paramètres par défaut, éditer `DEFAULT_CONFIG` dans :
`supabase/functions/_shared/metaapi-queue-types.ts`

### Déblocage manuel d'un compte

Si un compte reste bloqué par erreur :

```sql
UPDATE metaapi_rate_limits
SET is_throttled = false,
    throttle_until = null,
    consecutive_errors = 0
WHERE account_id = 'uuid-du-compte';
```

## Dépannage

### Problème : Trop d'erreurs 429

**Solution** : Augmenter `delayBetweenRequests` dans la configuration

```typescript
const queueManager = new MetaApiQueueManager(supabaseClient, {
  delayBetweenRequests: 5000, // 5 secondes au lieu de 3
});
```

### Problème : Requêtes qui timeout

**Solution** : Augmenter `requestTimeout`

```typescript
const queueManager = new MetaApiQueueManager(supabaseClient, {
  requestTimeout: 60000, // 60 secondes au lieu de 30
});
```

### Problème : Queue qui ne se vide pas

**Vérifications** :
1. Vérifier les logs de la console
2. Vérifier le statut dans `metaapi_request_logs`
3. Vérifier si le compte est throttled dans `metaapi_rate_limits`

### Problème : Dashboard vide

**Causes possibles** :
1. Aucun compte MT configuré
2. Aucune requête n'a été faite
3. Problème de permissions RLS

## Prochaines améliorations possibles

1. **Queue distribuée** - Support multi-instance
2. **Priorisation avancée** - Algorithmes de priorité dynamiques
3. **Alertes email** - Notifications en cas de problèmes
4. **Métriques avancées** - Temps de réponse moyen, etc.
5. **API publique** - Endpoints pour interroger la queue

## Support

Pour toute question ou problème, consulter :
- Les logs dans `metaapi_request_logs`
- Le dashboard de monitoring
- Les logs de la console Edge Functions
