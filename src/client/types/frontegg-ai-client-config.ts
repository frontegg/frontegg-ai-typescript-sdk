import { Environment } from './environment.enum';

export interface FronteggAiClientConfig {
  environment: Environment;
  agentId: string;
  clientId: string;
  clientSecret: string;
}
