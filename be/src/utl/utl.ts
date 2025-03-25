import { customAlphabet } from 'nanoid';

export type UtlExcludeCreatedAt<T> = Omit<T, 'createdAt'>;

export type UtlDataOnly<T> = {
    // eslint-disable-next-line @typescript-eslint/ban-types
    [K in keyof T as T[K] extends Function ? never : K]: T[K];
}

export const utlNanoid = customAlphabet('useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict', 21);

export function utlNewId(prefix: string, size: number = 21): string {
    return (prefix ? (prefix + '-') : '') + utlNanoid(size);
}