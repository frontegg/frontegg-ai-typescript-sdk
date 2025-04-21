import { Environment } from './environment.enum';

export interface FronteggAiAgentsClientConfig {
  environment: Environment;
  agentId: string;
  clientId: string;
  clientSecret: string;
}
