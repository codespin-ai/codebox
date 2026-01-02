// HTTP Transport types

export type HttpTransportOptions = {
  host?: string | undefined;
  port?: number | undefined;
  allowedOrigins?: string[] | undefined;
  idleTimeout?: number | undefined;
  auth?: boolean | undefined;
};
