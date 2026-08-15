import { inject, type App, type InjectionKey, type Plugin } from "vue";
import type { ChatGateClient } from "@chatgate/core";

export const ChatGateVueKey: InjectionKey<ChatGateClient> = Symbol("ChatGateClient");
const pluginStates = new WeakMap<ChatGateClient, { autoStart: boolean; startPromise?: Promise<void> }>();

export interface ChatGateVuePluginOptions {
  client: ChatGateClient;
  autoStart?: boolean;
}

export function createChatGatePlugin({ client, autoStart = true }: ChatGateVuePluginOptions): Plugin {
  return {
    install(app: App) {
      app.provide(ChatGateVueKey, client);
      const state = pluginStates.get(client) ?? { autoStart: false };
      state.autoStart ||= autoStart;
      pluginStates.set(client, state);
      if (typeof app.onUnmount === "function") {
        app.onUnmount(() => client.stop());
      }
    },
  };
}

export function startChatGateClientIfNeeded(client: ChatGateClient): Promise<void> | undefined {
  const state = pluginStates.get(client);
  if (!state?.autoStart || state.startPromise) return state?.startPromise;
  state.startPromise = client.start().then(() => undefined, () => undefined);
  return state.startPromise;
}

export function useChatGate(): ChatGateClient {
  const client = inject(ChatGateVueKey);
  if (!client) throw new Error("useChatGate must be used after app.use(createChatGatePlugin(...))");
  return client;
}
