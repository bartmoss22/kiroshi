// Minimal TypeScript declarations for Svelte 5 runes.
// These satisfy TS tooling that doesn't understand the compiler macros.

declare function $state<T>(initial?: T): T;

declare function $props<T extends Record<string, any> = Record<string, any>>(): T;

declare function $effect(effect: () => void | (() => void)): void;

declare function $bindable<T>(initial: T): T;
