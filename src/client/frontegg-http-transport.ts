import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

export class FronteggHttpTransport extends StreamableHTTPClientTransport {
  private agentId: string;
  private authToken: string;
  constructor(url: URL, agentId: string, authToken: string) {
    super(url);
    this.setFronteggParameters(agentId, authToken);
  }

  async _commonHeaders(agentId: string, authToken: string) {
    const headers = {};
    if (this._sessionId) {
      headers['mcp-session-id'] = this._sessionId;
    }
    headers['Authorization'] = `Bearer ${this.authToken}`;
    headers['agent-id'] = this.agentId;
    return headers;
  }

  private setFronteggParameters(agentId: string, authToken: string) {
    this.agentId = agentId;
    this.authToken = authToken;
  }
}
