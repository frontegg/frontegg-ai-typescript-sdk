import { FronteggAiAgentsClientConfig } from './types/frontegg-ai-agents-client-config';
import { Client } from '@modelcontextprotocol/sdk/client/index.d.ts';
import { FronteggHttpTransport } from './frontegg-http-transport';
import { loadMcpTools } from '@langchain/mcp-adapters';
import Logger from './logger';

export class FronteggAiAgentsClient {
  private static instance: FronteggAiAgentsClient;
  private readonly mcpClient: Client;
  private transport: FronteggHttpTransport;
  private vendorJWT?: string;
  private vendorJWTExpiration?: Date;
  private constructor(private readonly config: FronteggAiAgentsClientConfig) {
    if (!this.config.mcpServerUrl) {
      this.config.mcpServerUrl = 'https://mcp.frontegg.com/'; // TODO get by region env param & stging
    }
    if (!this.config.apiUrl) {
      this.config.apiUrl = 'https://api.frontegg.com/'; // TODO get by region env param & stging
    }
    this.mcpClient = new Client({
      name: 'Frontegg AI Agents Client',
      version: '1.0.0',
    });
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
      await this.refreshClientIfNeeded();
      const response = await this.mcpClient.listTools();
      return response.data;
    } catch (error) {
      Logger.error('Failed to get tools', error);
      throw error;
    }
  }

  public async callTool(toolId: string, input: any) {
    try {
      await this.refreshClientIfNeeded();
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

  public async getToolsAsLangchainTools() {
    try {
      await this.refreshClientIfNeeded();
      const tools = await loadMcpTools('frontegg', this.mcpClient);
      return tools;
    } catch (error) {
      Logger.error('Failed to get tools as Langchain tools', error);
      throw error;
    }
  }

  private async connect() {
    try {
      await this.mcpClient.connect(this.transport);
    } catch (error) {
      Logger.error('Failed to connect MCP client', error);
      throw error;
    }
  }

  private async refreshClientIfNeeded() {
    if (!this.vendorJWT || !this.vendorJWTExpiration || this.vendorJWTExpiration < new Date()) {
      await this.refreshClient();
    }
  }

  private async refreshClient() {
    try {
      await this.mcpClient.close();
      await this.refreshTransport();
      await this.connect();
    } catch (error) {
      Logger.error('Failed to refresh client', error);
      throw error;
    }
  }

  private async refreshTransport() {
    try {
      await this.refreshVendorJWT();
      if (!this.vendorJWT || !this.vendorJWTExpiration) {
        throw new Error('Failed to refresh vendor JWT - JWT or expiration missing after refresh attempt');
      }
      this.transport = new FronteggHttpTransport(
        new URL(this.config.mcpServerUrl),
        this.config.agentId,
        this.vendorJWT,
      );
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
      const response = await fetch(`${this.config.apiUrl}/auth/vendor/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
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
