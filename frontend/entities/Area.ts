export interface AreaMember {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
    areas_members?: {
        role: 'member' | 'head';
        created_at: string;
    };
}

export interface Area {
    id?: number;
    uid?: string;
    name: string;
    description?: string;
    active?: boolean;
    Members?: AreaMember[];
}
