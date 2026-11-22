declare module '@deepseek-ai/dsh-client-runtime/client' {
  export interface ClientContext {
    effect(install: () => unknown, label?: string): unknown
    layout: {
      toggleSidebar(): void
      [key: string]: unknown
    }
    get(name: string): unknown | undefined
    [key: string]: unknown
  }
}

declare module 'react' {
  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
  export function useState<T>(initial: T): [T, (value: T) => void]
}
