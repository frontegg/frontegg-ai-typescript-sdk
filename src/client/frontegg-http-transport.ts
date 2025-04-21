import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// @ts-ignore
export class FronteggHttpTransport extends StreamableHTTPClientTransport {
  private agentId!: string;
  private tenantId!: string;
  private userId?: string;
  private authToken!: string;
  constructor(url: URL) {
    super(url);
  }

  async _commonHeaders() {
    const headers = {};
    // @ts-ignore
    if (this._sessionId) {
      // @ts-ignore
      headers['mcp-session-id'] = this._sessionId;
    }
    headers['Authorization'] = `Bearer ${this.authToken}`;
    headers['agent-id'] = this.agentId;
    headers['tenant-id'] = this.tenantId;
    if (this.userId) {
      headers['user-id'] = this.userId;
    }
    // @ts-ignore
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
}
