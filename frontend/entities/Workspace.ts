export interface Workspace {
    id?: number;
    uid?: string;
    name: string;
    owner_email?: string;
    is_creator?: boolean;
    my_project_count?: number;
    created_at?: string;
    updated_at?: string;
}
