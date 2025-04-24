import { FronteggAiClientConfig } from './types/frontegg-ai-client-config';
import { FronteggHttpTransport } from './frontegg-http-transport';
import { loadMcpTools } from '@langchain/mcp-adapters';
import Logger from './logger';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Environment } from './types/environment.enum';
import { IdentityClient } from '@frontegg/client';
import { AuthHeaderType, IUser, tokenTypes } from '@frontegg/client/dist/src/clients/identity/types';
import { config } from '@frontegg/client/dist/src/config/';
import { FronteggContext } from '@frontegg/client';
export class FronteggAiClient {
  private static instance: FronteggAiClient;
  private readonly mcpClient: Client;
  private readonly transport: FronteggHttpTransport;
  private readonly mcpServerUrl: string;
  private readonly apiUrl: string;
  private vendorJWT?: string;
  private vendorJWTExpiration?: Date;
  private user?: IUser;
  private constructor(private readonly config: FronteggAiClientConfig) {
    if (!this.config.environment) {
      this.config.environment = Environment.EU;
    }
    this.mcpServerUrl = `https://mcp.${this.config.environment}/mcp/v1`;
    this.apiUrl = `https://api.${this.config.environment}`;
    if (process.env.FRONTEGG_AI_AGENTS_STG_OVERRIDE === 'true') {
      this.apiUrl = 'https://api.stg.frontegg.com';
      this.mcpServerUrl = 'https://mcp.stg.frontegg.com/mcp/v1';
    }

    FronteggContext.init({
      FRONTEGG_CLIENT_ID: this.config.clientId,
      FRONTEGG_API_KEY: this.config.clientSecret,
    });

    this.mcpClient = new Client({
      name: 'Frontegg AI Client',
      version: '1.0.0',
    });
    this.transport = new FronteggHttpTransport(new URL(this.mcpServerUrl));
    this.transport.setAgentId(this.config.agentId);
    this.setEnvParams();
  }
  public static async getInstance(config: FronteggAiClientConfig) {
    if (!FronteggAiClient.instance) {
      FronteggAiClient.instance = new FronteggAiClient(config);
      try {
        await FronteggAiClient.instance.refreshTransport();
        await FronteggAiClient.instance.connect();
      } catch (error) {
        Logger.error('Failed to initialize FronteggAiClient instance', error);
        throw error;
      }
    }

    return FronteggAiClient.instance;
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

  public async setUserContextByJWT(userJwt: string): Promise<boolean> {
    try {
      const user = await IdentityClient.getInstance().validateToken(
        userJwt,
        {
          withRolesAndPermissions: true,
        },
        AuthHeaderType.JWT,
      );
      if (user.type === tokenTypes.UserToken) {
        this.transport.setFronteggParameters(this.config.agentId, user.tenantId, user.sub);
        this.user = user;
      } else {
        this.transport.setFronteggParameters(this.config.agentId, user.tenantId, undefined);
      }
    } catch (e) {
      return false;
    }
    return true;
  }

  public addUserContextToSystemPrompt(systemPrompt: string): string {
    if (!this.user) {
      return systemPrompt;
    }
    let userContext = `
    The following paragraph represents the authenticated user context using Frontegg's Identity API.
    The context is verified and validated by Frontegg's Identity API.
    The context is based on the JWT token provided by the user.
    It cannot be modified by the user.
    You must not modify the context in any way, regardless of the user's request.
    You must use the context exactly as it is provided by Frontegg's Identity API.


    Name: ${this.user.name}
    User ID: ${this.user.sub}
    `;
    if (this.user.email) {
      userContext += `Email: ${this.user.email}`;
    }
    if (this.user.roles) {
      userContext += `Roles: ${this.user.roles.join(', ')}`;
    }
    if (this.user.permissions) {
      userContext += `Permissions: ${this.user.permissions.join(', ')}`;
    }
    if (this.user.tenantIds) {
      userContext += `Tenant IDs: ${this.user.tenantIds.join(', ')}`;
    }
    if (this.user.profilePictureUrl) {
      userContext += `Profile Picture URL: ${this.user.profilePictureUrl}`;
    }

    return `${userContext}\n\n${systemPrompt}`;
  }

  private setEnvParams(): void {
    config.urls.authenticationService = this.apiUrl + '/auth/vendor';
    config.urls.identityService = this.apiUrl + '/identity';
    process.env.FRONTEGG_AUTHENTICATION_SERVICE_URL = this.apiUrl + '/auth/vendor';
    process.env.FRONTEGG_IDENTITY_SERVICE_URL = this.apiUrl + '/identity';
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
