import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// @ts-expect-error overriding private properties in order to pass custom headers
export class FronteggHttpTransport extends StreamableHTTPClientTransport {
  private agentId!: string;
  private tenantId!: string;
  private userId?: string;
  private authToken!: string;
  private userAccessToken?: string;
  constructor(url: URL) {
    super(url);
  }

  async _commonHeaders() {
    const headers = {};
    // @ts-expect-error as per original implementation
    if (this._sessionId) {
      // @ts-expect-error as per original implementation
      headers['mcp-session-id'] = this._sessionId;
    }
    headers['Authorization'] = `Bearer ${this.authToken}`;
    headers['agent-id'] = this.agentId;
    headers['tenant-id'] = this.tenantId;
    if (this.userAccessToken) {
      headers['frontegg-user-access-token'] = this.userAccessToken;
    }
    if (this.userId) {
      headers['user-id'] = this.userId;
    }
    // @ts-expect-error as per original implementation
    return new Headers({ ...headers, ...this._requestInit?.headers });
  }

  public setFronteggParameters(agentId: string, tenantId: string, userId?: string) {
    this.agentId = agentId;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  public setAgentId(agentId: string) {
    this.agentId = agentId;
  }

  public setAuthToken(authToken: string) {
    this.authToken = authToken;
  }

  public setUserAccessToken(userAccessToken: string) {
    this.userAccessToken = userAccessToken;
  }
}
