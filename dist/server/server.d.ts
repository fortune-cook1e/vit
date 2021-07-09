interface CreateServerConfig {
    port: number;
    cwd: string;
}
export declare const createServer: ({ port, cwd }: CreateServerConfig) => void;
export {};
