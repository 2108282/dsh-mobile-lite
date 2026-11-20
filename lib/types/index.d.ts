export declare const name = "dsh-mobile-lite";
interface ClientModules {
    rebuilt(id: string): string | undefined;
}
interface HostContext {
    inject(keys: string[], install: (scope: {
        clientModules: ClientModules;
    }) => void): unknown;
}
export declare function apply(ctx: HostContext): void;
export {};
