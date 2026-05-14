export interface Env {
  PAIR_SESSIONS: DurableObjectNamespace;
  AUTH_STATE: KVNamespace;
  RobloxClientId: string;
  RobloxClientSecret: string;
  RobloxRedirectUri: string;
}
