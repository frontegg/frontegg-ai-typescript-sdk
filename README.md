# Frontegg AI Agents SDK

The Frontegg AI Agents SDK provides AI Agent developers with tools and utilities to easily empower AI agents within their applications. This SDK seamlessly integrates with the Frontegg platform, enabling advanced tool authentication, authorization, and identity management capabilities for AI Agents.

## Features

- Secure integration with Frontegg authentication
- Easy integration with Frontegg built-in and 3rd party application tools
- User identity context for agent throught Frontegg's identity platform
- Seamless integration with Langchain AI applications and agents

## 🚀 Prerequisites

Ensure that your environment meets the following requirements:

- **Node.js**: Version **18.16.0** or later
- **TypeScript**: Version **5.7.2** or later
- A working **LangChain** project with agent implementation
- Access to a **Frontegg** tenant and registered application credentials

## Installation

```bash
npm install @frontegg/ai-sdk
# or
yarn add @frontegg/ai-sdk
```

## Quick Start

## SDK Configuration

Initialize the Frontegg AI client to connect with your tenant environment:

```ts
// frontegg.config.ts
import { Environment, FronteggAiClient } from '@frontegg/ai-sdk';

export const fronteggClient = await FronteggAiClient.getInstance({
  agentId: process.env.FRONTEGG_AGENT_ID!,
  clientId: process.env.FRONTEGG_CLIENT_ID!,
  clientSecret: process.env.FRONTEGG_CLIENT_SECRET!,
  environment: Environment.EU,
});
```

## Dynamic Tool Integration with User Context

Fetch user-specific tools from Frontegg and dynamically construct a LangChain agent:

```ts
public async processRequest(request: string, userJwt: string): Promise<any> {
  if (!this.fronteggAiClient) {
    throw new Error('Frontegg client not initialized');
  }

  await this.fronteggAiClient.setUserContextByJWT(userJwt);
  const tools = await this.fronteggAiClient.getToolsAsLangchainTools();

  const messages = [
    {
      role: 'system',
      content: this.fronteggAiClient.addUserContextToSystemPrompt(this.systemMessage),
    },
    ...this.conversationHistory,
    new MessagesPlaceholder('agent_scratchpad'),
  ];

  const prompt = ChatPromptTemplate.fromMessages(messages);

  const openAIFunctionsAgent = await createOpenAIFunctionsAgent({
    llm: this.model as any,
    tools: tools as any,
    prompt: prompt as any,
  });

  this.agent = new AgentExecutor({
    agent: openAIFunctionsAgent as any,
    tools: tools as any,
    verbose: true,
  });

  const result = await this.agent.invoke({ input: request });

  return result;
}
```

## Documentation

For detailed documentation, please visit our [official documentation](https://docs.frontegg.com/ai-agents).

## Examples

Check out our [example project](https://github.com/frontegg/commitment-lifecycle-agent) for sample implementations and use cases.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://docs.frontegg.com/ai-agents)
- 💬 [Community Slack](https://join.slack.com/t/frontegg-community/shared_invite/zt-e1oxi1vn-SZErBZcwHcbgj4vrwRIp5A)
- 📧 [Email Support](mailto:support@frontegg.com)

## About Frontegg

[Frontegg](https://frontegg.com) is a powerful user management platform that provides everything modern apps need beyond authentication.
