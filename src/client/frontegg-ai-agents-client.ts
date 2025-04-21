import { FronteggAiAgentsClientConfig } from './types/frontegg-ai-agents-client-config';
import { FronteggHttpTransport } from './frontegg-http-transport';
import { loadMcpTools } from '@langchain/mcp-adapters';
import Logger from './logger';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Environment } from './types/environment.enum';

export class FronteggAiAgentsClient {
  private static instance: FronteggAiAgentsClient;
  private readonly mcpClient: Client;
  private readonly transport: FronteggHttpTransport;
  private readonly mcpServerUrl: string;
  private readonly apiUrl: string;
  private vendorJWT?: string;
  private vendorJWTExpiration?: Date;
  private constructor(private readonly config: FronteggAiAgentsClientConfig) {
    if (!this.config.environment) {
      this.config.environment = Environment.EU;
    }
    this.mcpServerUrl = `https://mcp.${this.config.environment}`;
    this.apiUrl = `https://api.${this.config.environment}`;

    this.mcpClient = new Client({
      name: 'Frontegg AI Agents Client',
      version: '1.0.0',
    });
    this.transport = new FronteggHttpTransport(new URL(this.mcpServerUrl));
  }
  public static async getInstance(config: FronteggAiAgentsClientConfig) {
    if (!FronteggAiAgentsClient.instance) {
      FronteggAiAgentsClient.instance = new FronteggAiAgentsClient(config);
      try {
        await FronteggAiAgentsClient.instance.refreshTransport();
        await FronteggAiAgentsClient.instance.connect();
      } catch (error) {
        Logger.error('Failed to initialize FronteggAiAgentsClient instance', error);
        throw error;
      }
    }

    return FronteggAiAgentsClient.instance;
  }

  public async getTools() {
    try {
      await this.refreshTransportIfNeeded();
      const response = await this.mcpClient.listTools();
      return response.data;
    } catch (error) {
      Logger.error('Failed to get tools', error);
      throw error;
    }
  }

  public async callTool(toolId: string, input: any, tenantId: string, userId?: string) {
    try {
      await this.refreshTransportIfNeeded();
      this.transport.setFronteggParameters(this.config.agentId, tenantId, userId);
      const response = await this.mcpClient.callTool({
        name: toolId,
        arguments: input,
      });
      return response.data;
    } catch (error) {
      Logger.error(`Failed to call tool: ${toolId}`, error);
      throw error;
    }
  }

  public async getToolsAsLangchainTools(): Promise<any[]> {
    try {
      await this.refreshTransportIfNeeded();
      const tools = await loadMcpTools('frontegg', this.mcpClient);
      return tools;
    } catch (error) {
      Logger.error('Failed to get tools as Langchain tools', error);
      throw error;
    }
  }

  public setContext(tenantId: string, userId?: string) {
    this.transport.setFronteggParameters(this.config.agentId, tenantId, userId);
  }

  private async connect() {
    try {
      await this.mcpClient.connect(this.transport);
    } catch (error) {
      Logger.error('Failed to connect MCP client', error);
      throw error;
    }
  }

  private async refreshTransportIfNeeded() {
    if (!this.vendorJWT || !this.vendorJWTExpiration || this.vendorJWTExpiration < new Date()) {
      await this.refreshTransport();
    }
  }

  private async refreshTransport() {
    try {
      await this.refreshVendorJWT();
      if (!this.vendorJWT || !this.vendorJWTExpiration) {
        throw new Error('Failed to refresh vendor JWT - JWT or expiration missing after refresh attempt');
      }
      this.transport.setAuthToken(this.vendorJWT);
    } catch (error) {
      Logger.error('Failed to refresh transport', error);
      throw error;
    }
  }

  private async refreshVendorJWT() {
    const vendorJWT = await this.createVendorJWT();
    this.vendorJWT = vendorJWT.token;
    this.vendorJWTExpiration = vendorJWT.expiration;
  }

  private async createVendorJWT() {
    try {
      const response = await fetch(`${this.apiUrl}/auth/vendor/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.config.clientId,
          secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to create vendor JWT: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const result = await response.json();
      const expiration = new Date(Date.now() + result.expiresIn * 1000);
      return {
        token: result.token,
        expiration: expiration,
      };
    } catch (error) {
      Logger.error('Failed to create vendor JWT', error);
      throw error;
    }
  }
}
