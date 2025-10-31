declare module '*/utils/logger' {
  const logger: {
    info: (message: string) => void;
    error: (message: string, ...meta: any[]) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
  };
  export default logger;
}
