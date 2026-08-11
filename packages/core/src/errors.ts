export class ChatGateError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options: { status?: number; details?: unknown; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "ChatGateError";
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.details !== undefined) this.details = options.details;
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
      });
    }
  }
}
