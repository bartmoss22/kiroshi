import { env } from '$env/dynamic/public';
import { building } from '$app/environment';

const get = (key: string): string => {
    const value = env[key as keyof typeof env];
    if (value) return value;
    if (building) return 'BUILD_PLACEHOLDER';
    throw new Error(`Missing environment variable: ${key}`);
};

export const config = {
    get publicBaseUrl() { return get('PUBLIC_BASE_URL'); },
};