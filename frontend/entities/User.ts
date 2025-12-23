export interface User {
    id?: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    language: string;
    appearance: string;
    timezone: string;
    avatarUrl?: string;
    is_admin?: boolean;
}
