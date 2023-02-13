// Doesn't produce `& Partial<{}>` in resulting type if T has no keys
export type PartialLaconic<T> = {} extends T ? {} : Partial<T>;
