export interface AreaMember {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
    areas_members?: {
        role: 'member' | 'admin';
        created_at: string;
    };
}

export interface AreaSubscriber {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    avatar_image?: string;
    AreasSubscriber?: {
        source: 'manual' | 'admin_role';
        added_by: number;
        created_at: string;
    };
}

export interface Area {
    id?: number;
    uid?: string;
    name: string;
    description?: string;
    active?: boolean;
    Members?: AreaMember[]; // This is using capital letters because of the Sequelize association naming convention
    Subscribers?: AreaSubscriber[];
}
