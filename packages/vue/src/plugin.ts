import { inject, type App, type InjectionKey, type Plugin } from "vue";
import type { ChatGateClient } from "@chatgate/core";

export const ChatGateVueKey: InjectionKey<ChatGateClient> = Symbol("ChatGateClient");

export interface ChatGateVuePluginOptions {
  client: ChatGateClient;
  autoStart?: boolean;
}

export function createChatGatePlugin({ client, autoStart = true }: ChatGateVuePluginOptions): Plugin {
  return {
    install(app: App) {
      app.provide(ChatGateVueKey, client);
      if (autoStart) void client.start();
    },
  };
}

export function useChatGate(): ChatGateClient {
  const client = inject(ChatGateVueKey);
  if (!client) throw new Error("useChatGate must be used after app.use(createChatGatePlugin(...))");
  return client;
}
