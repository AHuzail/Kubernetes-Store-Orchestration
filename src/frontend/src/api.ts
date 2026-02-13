import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1', // Proxied by Vite in dev
});

export interface Store {
    id: string;
    name: string;
    type: 'woocommerce' | 'medusa';
    status: 'PROVISIONING' | 'READY' | 'FAILED' | 'DELETING';
    url?: string;
    namespace: string;
    created_at: string;
    status_message?: string;
}

export interface AdminCredentials {
    store_url: string;
    admin_url: string;
    admin_user: string;
    admin_password: string;
    admin_email: string;
}

export interface AuditEvent {
    id: string;
    store_id?: string;
    store_name?: string;
    action: string;
    message?: string;
    created_at: string;
}

export const getStores = async (): Promise<Store[]> => {
    const response = await api.get<Store[]>('/stores');
    return response.data;
};

export const createStore = async (name: string, type: string): Promise<Store> => {
    const response = await api.post<Store>('/stores', { name, type });
    return response.data;
};

export const deleteStore = async (id: string): Promise<void> => {
    await api.delete(`/stores/${id}`);
};

export const getAdminCredentials = async (storeId: string): Promise<AdminCredentials> => {
    const response = await api.get<AdminCredentials>(`/stores/${storeId}/admin-credentials`);
    return response.data;
};

export const getAuditEvents = async (limit = 50): Promise<AuditEvent[]> => {
    const response = await api.get<AuditEvent[]>(`/audit-events?limit=${limit}`);
    return response.data;
};
