export type PlayerRole = "frontend" | "backend" | "devops";

export type PartyRoomStatus =
  | "lobby"
  | "briefing"
  | "speaking"
  | "evaluating"
  | "resolved";

export interface RoleClue {
  role: PlayerRole;
  roleLabel: string;
  summary: string;
  metrics: string[];
  suspectedCause: string;
  targetKeywords: string[];
}

export interface PartyScenario {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2";
  summary: string;
  incidentContext: string;
  estimatedMinutes: number;
  targetKeywords: string[];
  clues: Record<PlayerRole, RoleClue>;
  resolutionChecklist: string[];
}

export interface PartyPlayerSlot {
  id: string;
  displayName: string;
  role: PlayerRole;
  isReady: boolean;
  transcript?: string;
  score?: number;
}

export interface TurnEvaluation {
  playerId: string;
  role: PlayerRole;
  transcript: string;
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  feedback: string;
  durationMs: number;
}

export interface PartyRoomState {
  roomCode: string;
  scenarioId: string;
  status: PartyRoomStatus;
  currentTurnRole: PlayerRole | null;
  players: PartyPlayerSlot[];
  evaluations: TurnEvaluation[];
  teamScore: number;
  createdAt: string;
  updatedAt: string;
}

export const PARTY_SCENARIOS: PartyScenario[] = [
  {
    id: "production-database-deadlock",
    title: "Production Database Deadlock",
    severity: "SEV-1",
    summary:
      "Checkout requests are timing out across all regions while PostgreSQL lock waits spike on the orders table.",
    incidentContext:
      "At 14:05 UTC, payment confirmations began hanging for 30 seconds before returning 504 Gateway Timeout. Support reports duplicate retry clicks from users.",
    estimatedMinutes: 6,
    targetKeywords: [
      "deadlock",
      "transaction",
      "lock contention",
      "connection pool",
      "rollback",
      "idempotency",
      "index",
      "timeout",
    ],
    clues: {
      frontend: {
        role: "frontend",
        roleLabel: "Frontend Engineer",
        summary:
          "Checkout button stays enabled during slow requests, causing users to fire overlapping POST /checkout calls.",
        metrics: [
          "Client retry burst: 4.2x duplicate submits per user",
          "504 timeout rate on /api/checkout: 68%",
        ],
        suspectedCause:
          "Missing submit lock and idempotency key on the client checkout form.",
        targetKeywords: ["idempotency", "timeout", "retry", "checkout"],
      },
      backend: {
        role: "backend",
        roleLabel: "Backend Engineer",
        summary:
          "Two concurrent transactions update inventory and orders rows in opposite lock order without row-level timeout.",
        metrics: [
          "PostgreSQL deadlock_detected errors: 410/min",
          "Avg transaction duration: 24.8s",
        ],
        suspectedCause:
          "Inconsistent lock acquisition order inside multi-table payment transaction.",
        targetKeywords: ["deadlock", "transaction", "lock contention", "rollback"],
      },
      devops: {
        role: "devops",
        roleLabel: "DevOps / SRE",
        summary:
          "PgBouncer connection pool is saturated at 100% and read replicas show normal CPU while primary is blocked on locks.",
        metrics: [
          "Active DB connections: 200/200 exhausted",
          "Replica lag: 120ms (healthy)",
        ],
        suspectedCause:
          "Connection pool starvation caused by long-running locked transactions on primary.",
        targetKeywords: ["connection pool", "timeout", "index", "rollback"],
      },
    },
    resolutionChecklist: [
      "Terminate blocking queries and restore connection pool headroom",
      "Enforce consistent lock ordering and statement_timeout in transaction",
      "Add client submit debounce and server-side idempotency key",
    ],
  },
  {
    id: "api-memory-leak-storm",
    title: "API Memory Leak Storm",
    severity: "SEV-1",
    summary:
      "Node.js API pods are crash-looping with OOMKilled every 12 minutes right after a streaming export feature shipped.",
    incidentContext:
      "Latency spikes precede container restarts across the API cluster. Autoscaler keeps spinning up new pods that immediately climb to 4GB RSS.",
    estimatedMinutes: 6,
    targetKeywords: [
      "memory leak",
      "heap",
      "oomkilled",
      "garbage collection",
      "stream",
      "buffer",
      "autoscaling",
      "heap snapshot",
    ],
    clues: {
      frontend: {
        role: "frontend",
        roleLabel: "Frontend Engineer",
        summary:
          "Dashboard polling keeps re-opening report export sockets whenever a previous request aborts.",
        metrics: [
          "Aborted /api/reports/export calls: 190/min",
          "Client reconnect loop interval: 2s",
        ],
        suspectedCause:
          "AbortController signal is ignored, leaving orphaned export requests hammering the API.",
        targetKeywords: ["stream", "reconnect", "abort", "latency"],
      },
      backend: {
        role: "backend",
        roleLabel: "Backend Engineer",
        summary:
          "Export route buffers entire CSV payloads in an unbounded module-level Map instead of piping streams.",
        metrics: [
          "V8 heap used: 3.85GB / 4.0GB limit",
          "GC pause time: 1.9s per cycle",
        ],
        suspectedCause:
          "Unbounded in-memory cache and unclosed stream listeners retaining large buffers.",
        targetKeywords: ["memory leak", "heap", "garbage collection", "buffer"],
      },
      devops: {
        role: "devops",
        roleLabel: "DevOps / SRE",
        summary:
          "Kubernetes events show repeated OOMKilled exit code 137 while HPA scales pods from 6 to 24.",
        metrics: [
          "Pod restarts (last 30m): 47 OOMKilled",
          "Cluster node memory pressure: 92%",
        ],
        suspectedCause:
          "Container memory limit hit due to steep RSS growth under concurrent export traffic.",
        targetKeywords: ["oomkilled", "autoscaling", "heap snapshot", "stream"],
      },
    },
    resolutionChecklist: [
      "Stream export chunks directly instead of buffering in memory",
      "Clean up event listeners and cache entries on request close",
      "Capture heap snapshot in staging and cap HPA burst",
    ],
  },
  {
    id: "leaked-cloud-key-breach",
    title: "Leaked Cloud Key Breach",
    severity: "SEV-1",
    summary:
      "An AWS access key was accidentally bundled into a public client build and unauthorized S3 list calls appeared within minutes.",
    incidentContext:
      "Security telemetry flagged unusual GetObject and ListBuckets calls from an unknown ASN using credentials tied to the staging/prod CI role.",
    estimatedMinutes: 7,
    targetKeywords: [
      "revoke",
      "rotate",
      "iam",
      "least privilege",
      "environment variable",
      "audit log",
      "secret",
      "blast radius",
    ],
    clues: {
      frontend: {
        role: "frontend",
        roleLabel: "Frontend Engineer",
        summary:
          "A NEXT_PUBLIC_ prefix was added to the cloud secret variable, exposing the key in the browser JS bundle.",
        metrics: [
          "Exposed bundle hash: main-8f31c.js",
          "Public source map deployed to CDN",
        ],
        suspectedCause:
          "Client-exposed environment variable leaked private credentials in static assets.",
        targetKeywords: ["environment variable", "secret", "bundle", "revoke"],
      },
      backend: {
        role: "backend",
        roleLabel: "Backend Engineer",
        summary:
          "Upload presigned URL generator shares the same broad IAM user key instead of a short-lived scoped STS token.",
        metrics: [
          "Unauthorized S3 requests: 1,420 calls",
          "Affected bucket: speakit-user-artifacts",
        ],
        suspectedCause:
          "Over-privileged static credentials used in server upload helper.",
        targetKeywords: ["iam", "least privilege", "rotate", "secret"],
      },
      devops: {
        role: "devops",
        roleLabel: "DevOps / SRE",
        summary:
          "CloudTrail shows the leaked key originated from CI/CD secrets and lacks IP or condition restrictions.",
        metrics: [
          "First suspicious API call: 4m after deploy",
          "CloudTrail anomalous IPs: 3 external regions",
        ],
        suspectedCause:
          "Missing secret scanning gate in CI and overly wide IAM policy blast radius.",
        targetKeywords: ["revoke", "rotate", "audit log", "blast radius"],
      },
    },
    resolutionChecklist: [
      "Immediately revoke and rotate the compromised IAM credentials",
      "Purge exposed JS bundles and remove NEXT_PUBLIC_ secret prefix",
      "Audit CloudTrail logs and enforce least-privilege IAM + CI secret scan",
    ],
  },
  {
    id: "cdn-cache-poisoning",
    title: "CDN Cache Poisoning",
    severity: "SEV-2",
    summary:
      "Logged-in users are seeing another user's personalized dashboard JSON served directly from edge cache.",
    incidentContext:
      "Support received screenshots of mismatched user profiles on /api/session after an edge caching rule update went live.",
    estimatedMinutes: 5,
    targetKeywords: [
      "cache-control",
      "vary",
      "edge cache",
      "purge",
      "authorization",
      "private",
      "cache key",
      "stale",
    ],
    clues: {
      frontend: {
        role: "frontend",
        roleLabel: "Frontend Engineer",
        summary:
          "Client fetch sends Authorization header without cache-busting or no-store, receiving 200 OK with X-Cache: HIT.",
        metrics: [
          "Edge HIT ratio on /api/session: 84%",
          "Cross-user profile mismatch reports: 23",
        ],
        suspectedCause:
          "Authenticated user endpoints are hitting shared edge cache instead of bypassing it.",
        targetKeywords: ["edge cache", "authorization", "stale", "private"],
      },
      backend: {
        role: "backend",
        roleLabel: "Backend Engineer",
        summary:
          "Session API omits Cache-Control: private, no-store and does not return Vary: Authorization, Cookie.",
        metrics: [
          "Response header: Cache-Control: public, max-age=300",
          "Missing Vary header on auth routes",
        ],
        suspectedCause:
          "Default public caching middleware applied to authenticated JSON endpoints.",
        targetKeywords: ["cache-control", "vary", "private", "authorization"],
      },
      devops: {
        role: "devops",
        roleLabel: "DevOps / SRE",
        summary:
          "CDN rule ignores Authorization and Cookie headers in the cache key for all /api/* paths.",
        metrics: [
          "Global edge POPs serving stale payload: 18",
          "Purge propagation time: 45s",
        ],
        suspectedCause:
          "Wildcard CDN cache key configuration caches personalized responses globally.",
        targetKeywords: ["cache key", "purge", "edge cache", "cache-control"],
      },
    },
    resolutionChecklist: [
      "Execute immediate full edge cache purge for /api/*",
      "Set Cache-Control: private, no-store on all authenticated endpoints",
      "Restrict CDN caching rules to static/public routes with proper Vary headers",
    ],
  },
  {
    id: "friday-deploy-rollback",
    title: "Friday Deploy Rollback",
    severity: "SEV-2",
    summary:
      "A Friday 17:30 release introduced a backward-incompatible schema migration that broke older mobile and web clients.",
    incidentContext:
      "Error rates jumped to 35% right after deployment. Simply reverting the app container fails because a column was renamed in production.",
    estimatedMinutes: 6,
    targetKeywords: [
      "rollback",
      "migration",
      "backward compatible",
      "canary",
      "feature flag",
      "hotfix",
      "schema",
      "blue-green",
    ],
    clues: {
      frontend: {
        role: "frontend",
        roleLabel: "Frontend Engineer",
        summary:
          "Cached web tabs still send the old payload field name, triggering 400 validation errors on the new API.",
        metrics: [
          "400 Bad Request rate from cached clients: 35%",
          "Old bundle active share: 42% of sessions",
        ],
        suspectedCause:
          "Client payload contract changed abruptly without dual-field support.",
        targetKeywords: ["backward compatible", "schema", "feature flag", "hotfix"],
      },
      backend: {
        role: "backend",
        roleLabel: "Backend Engineer",
        summary:
          "Database migration renamed display_name to full_name directly instead of using an expand-and-contract pattern.",
        metrics: [
          "500 SQL column-not-found errors on rollback attempt",
          "Affected endpoints: /api/profile, /api/leaderboard",
        ],
        suspectedCause:
          "Destructive schema rename prevents clean container rollback.",
        targetKeywords: ["migration", "rollback", "backward compatible", "schema"],
      },
      devops: {
        role: "devops",
        roleLabel: "DevOps / SRE",
        summary:
          "Deployment skipped canary traffic shifting and pushed 100% traffic to the new release right before weekend.",
        metrics: [
          "Canary stage: bypassed",
          "Blue-green target group switched 100% at 17:32",
        ],
        suspectedCause:
          "Zero-canary rollout paired with non-reversible migration blocked instant rollback.",
        targetKeywords: ["canary", "blue-green", "rollback", "hotfix"],
      },
    },
    resolutionChecklist: [
      "Deploy backward-compatible hotfix supporting both old and new column names",
      "Restore blue-green / canary traffic gate before weekend freezes",
      "Adopt expand-and-contract database migrations for future releases",
    ],
  },
];

export function findPartyScenarioById(id: string): PartyScenario | undefined {
  return PARTY_SCENARIOS.find((scenario) => scenario.id === id);
}
