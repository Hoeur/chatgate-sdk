import {
  defineComponent,
  inject,
  onUnmounted,
  provide,
  readonly,
  ref,
  shallowRef,
  type InjectionKey,
  type PropType,
  type Ref,
  type ShallowRef,
} from "vue";
import type { ChatGateClient } from "@chatgate/core";
import { ChatGateVueKey } from "./plugin.js";

export type ChatGateConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface ChatGateVueConnection {
  status: Readonly<Ref<ChatGateConnectionStatus>>;
  error: Readonly<ShallowRef<Error | undefined>>;
}

export const ChatGateConnectionKey: InjectionKey<ChatGateVueConnection> = Symbol(
  "ChatGateConnection",
);

/**
 * Connection status of the nearest `ChatGateProvider`. Returns undefined when
 * the client was installed with `createChatGatePlugin`, which does not track
 * connection state.
 */
export function useChatGateConnection(): ChatGateVueConnection | undefined {
  return inject(ChatGateConnectionKey, undefined);
}

/**
 * Component-level alternative to `app.use(createChatGatePlugin(...))`: provides
 * the client to its subtree only, tracks connection status, and renders the
 * `fallback` slot until the first session is available.
 */
export const ChatGateProvider = defineComponent({
  name: "ChatGateProvider",
  props: {
    client: { type: Object as PropType<ChatGateClient>, required: true },
    autoStart: { type: Boolean, default: true },
    stopOnUnmount: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const client = props.client;
    const status = ref<ChatGateConnectionStatus>(client.connected ? "connected" : "idle");
    const error = shallowRef<Error | undefined>();

    provide(ChatGateVueKey, client);
    provide(ChatGateConnectionKey, {
      status: readonly(status),
      error: readonly(error) as Readonly<ShallowRef<Error | undefined>>,
    });

    const cleanups = [
      client.on("connected", () => {
        status.value = "connected";
      }),
      client.on("disconnected", () => {
        status.value = "disconnected";
      }),
      client.on("connectionError", (cause) => {
        status.value = "error";
        error.value = cause instanceof Error ? cause : new Error("ChatGate connection failed");
      }),
      client.on("error", (nextError) => {
        status.value = "error";
        error.value = nextError;
      }),
    ];

    if (props.autoStart) {
      status.value = "connecting";
      void client.start().catch((cause: unknown) => {
        status.value = "error";
        error.value = cause instanceof Error ? cause : new Error("ChatGate failed to start");
      });
    }

    onUnmounted(() => {
      for (const cleanup of cleanups) cleanup();
      if (props.stopOnUnmount) client.stop();
    });

    return () => {
      if (slots.fallback && status.value === "connecting" && !client.session) {
        return slots.fallback();
      }
      return slots.default?.();
    };
  },
});
