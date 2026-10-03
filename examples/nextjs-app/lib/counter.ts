// In-memory counter so you can see whether a POST got through. Kept on
// globalThis so it survives dev-server module reloads.
const store = globalThis as typeof globalThis & {__csrfDemoCount?: number};

export function getCount(): number {
    return store.__csrfDemoCount ?? 0;
}

export function increment(): number {
    store.__csrfDemoCount = getCount() + 1;
    return store.__csrfDemoCount;
}
