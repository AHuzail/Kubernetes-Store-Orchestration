import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStores, createStore, deleteStore, getAuditEvents, getAdminCredentials, Store, AuditEvent, AdminCredentials } from './api';
import { Plus, Trash2, ExternalLink, RefreshCw, ShoppingCart, Activity, Key, Copy, Check, AlertCircle, Clock, Zap, Package, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [credentialsModalOpen, setCredentialsModalOpen] = useState<string | null>(null);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreType, setNewStoreType] = useState('woocommerce');
    const [credentials, setCredentials] = useState<AdminCredentials | null>(null);

    // Poll every 5 seconds to update status
    const { data: stores, isLoading, isError } = useQuery({
        queryKey: ['stores'],
        queryFn: getStores,
        refetchInterval: 5000,
    });

    const { data: auditEvents } = useQuery({
        queryKey: ['audit-events'],
        queryFn: () => getAuditEvents(20),
        refetchInterval: 5000,
    });

    const createMutation = useMutation({
        mutationFn: (data: { name: string; type: string }) => createStore(data.name, data.type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stores'] });
            setIsCreateModalOpen(false);
            setNewStoreName('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stores'] });
        },
    });

    const credentialsMutation = useMutation({
        mutationFn: getAdminCredentials,
        onSuccess: (data) => {
            setCredentials(data);
        },
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Creating store:', { newStoreName, newStoreType });
        createMutation.mutate({ name: newStoreName, type: newStoreType });
    };

    const handleViewCredentials = (storeId: string) => {
        setCredentialsModalOpen(storeId);
        credentialsMutation.mutate(storeId);
    };

    const stats = {
        total: stores?.length || 0,
        ready: stores?.filter(s => s.status === 'READY').length || 0,
        provisioning: stores?.filter(s => s.status === 'PROVISIONING').length || 0,
        failed: stores?.filter(s => s.status === 'FAILED').length || 0,
    };

    if (isLoading) return <LoadingScreen />;
    if (isError) return <ErrorScreen />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Hero Section */}
                <div className="mb-12">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                        <div>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg">
                                    <ShoppingCart className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-5xl font-black text-white tracking-tight">
                                        Kubernetes<br />Store Orchestrator
                                    </h1>
                                </div>
                            </div>
                            <p className="text-indigo-200 text-lg max-w-xl">Deploy and manage multi-tenant e-commerce platforms with automatic provisioning, monitoring, and orchestration.</p>
                        </div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full lg:w-auto group relative inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-105 overflow-hidden"
                        >
                            <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                            <span>Create Store</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard icon={<Package className="h-6 w-6" />} label="Total Stores" value={stats.total} color="blue" />
                    <StatCard icon={<Zap className="h-6 w-6" />} label="Ready" value={stats.ready} color="green" />
                    <StatCard icon={<Clock className="h-6 w-6" />} label="Provisioning" value={stats.provisioning} color="amber" />
                    <StatCard icon={<AlertCircle className="h-6 w-6" />} label="Failed" value={stats.failed} color="red" />
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Stores Section */}
                    <div className="lg:col-span-2">
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Zap className="h-8 w-8 text-indigo-400" />
                                Your Stores
                            </h2>
                        </div>

                        {stores && stores.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {stores.map((store) => (
                                    <StoreCard
                                        key={store.id}
                                        store={store}
                                        onDelete={() => deleteMutation.mutate(store.id)}
                                        onViewCredentials={() => handleViewCredentials(store.id)}
                                        isDeleting={deleteMutation.isPending}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
                        )}
                    </div>

                    {/* Activity Sidebar */}
                    <div>
                        <div className="mb-6">
                            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Activity className="h-8 w-8 text-indigo-400" />
                                Activity
                            </h2>
                        </div>

                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl" style={{maxHeight: '600px', overflowY: 'auto'}}>
                            {auditEvents && auditEvents.length > 0 ? (
                                <div className="divide-y divide-slate-700/50">
                                    {auditEvents.map((event) => (
                                        <ActivityItem key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400">
                                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No recent activity</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateStoreModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    newStoreName={newStoreName}
                    onNameChange={setNewStoreName}
                    newStoreType={newStoreType}
                    onTypeChange={setNewStoreType}
                    onSubmit={handleCreate}
                    isLoading={createMutation.isPending}
                    error={createMutation.error ? (createMutation.error as any).response?.data?.detail || (createMutation.error as any).message || 'Failed to create store' : null}
                />
            )}

            {credentialsModalOpen && (
                <CredentialsModal
                    isOpen={!!credentialsModalOpen}
                    onClose={() => {
                        setCredentialsModalOpen(null);
                        setCredentials(null);
                    }}
                    credentials={credentials}
                    isLoading={credentialsMutation.isPending}
                />
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-300',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-300',
        amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-300',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-300',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-6 backdrop-blur-sm`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-300 mb-2">{label}</p>
                    <p className="text-4xl font-bold text-white">{value}</p>
                </div>
                <div className="text-3xl opacity-50">
                    {icon}
                </div>
            </div>
        </div>
    );
}

function ActivityItem({ event }: { event: AuditEvent }) {
    const actionColors: Record<string, string> = {
        STORE_CREATED: 'text-green-400 bg-green-500/10',
        STORE_READY: 'text-blue-400 bg-blue-500/10',
        STORE_DELETED: 'text-red-400 bg-red-500/10',
        STORE_FAILED: 'text-amber-400 bg-amber-500/10',
    };

    const color = actionColors[event.action] || 'text-indigo-400 bg-indigo-500/10';

    return (
        <div className="p-4 hover:bg-slate-700/30 transition-colors border-l-4 border-indigo-500/50">
            <div className="flex items-start gap-3">
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${color}`}>
                    {event.action.replace('STORE_', '')}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{event.store_name || 'System'}</p>
                    {event.message && <p className="text-xs text-slate-400 truncate mt-1">{event.message}</p>}
                    <p className="text-xs text-slate-500 mt-2">
                        {new Date(event.created_at).toLocaleString()}
                    </p>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-12 text-center col-span-2">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-2xl font-bold text-white mb-2">No Stores Yet</h3>
            <p className="text-slate-400 mb-6">Create your first e-commerce store to get started with multi-tenant orchestration.</p>
            <button
                onClick={onCreateClick}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all duration-300"
            >
                <Plus size={20} />
                Create Store
            </button>
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
            <div className="text-center">
                <div className="inline-block p-4 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl mb-4">
                    <RefreshCw className="animate-spin h-8 w-8 text-white" />
                </div>
                <p className="text-xl font-bold text-white">Loading Your Stores...</p>
                <p className="text-slate-400 mt-2">Setting up orchestration</p>
            </div>
        </div>
    );
}

function ErrorScreen() {
    return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
            <div className="text-center">
                <div className="inline-block p-4 bg-red-500/20 rounded-2xl mb-4">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-xl font-bold text-white">Connection Error</p>
                <p className="text-slate-400 mt-2">Make sure the backend is running at http://localhost:8000</p>
            </div>
        </div>
    );
}

function StoreCard({ store, onDelete, onViewCredentials, isDeleting }: { store: Store; onDelete: () => void; onViewCredentials: () => void; isDeleting: boolean }) {
    const isReady = store.status === 'READY';
    const isProvisioning = store.status === 'PROVISIONING';
    const isFailed = store.status === 'FAILED';
    const [duration, setDuration] = useState('');

    useEffect(() => {
        if (!isProvisioning) return;

        const updateDuration = () => {
            const created = new Date(store.created_at);
            const now = new Date();
            const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            setDuration(`${minutes}m ${secs}s`);
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);
        return () => clearInterval(interval);
    }, [isProvisioning, store.created_at]);

    return (
        <div className={clsx(
            "group relative rounded-2xl border backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105",
            isReady ? "bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/30 hover:border-green-500/60 shadow-lg shadow-green-500/10" :
            isProvisioning ? "bg-gradient-to-br from-amber-500/10 to-orange-600/5 border-amber-500/30 hover:border-amber-500/60 shadow-lg shadow-amber-500/10" :
            "bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/30 hover:border-red-500/60 shadow-lg shadow-red-500/10"
        )}>
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start gap-4 mb-4">
                    <div>
                        <h3 className="text-2xl font-black text-white mb-2 truncate">{store.name}</h3>
                        <p className="text-xs text-slate-400 font-mono bg-black/20 px-2.5 py-1 rounded inline-block">{store.namespace}</p>
                    </div>
                    <div className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 whitespace-nowrap",
                        isReady ? 'bg-green-500/20 text-green-300 border border-green-500/50' :
                        isProvisioning ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                        'bg-red-500/20 text-red-300 border border-red-500/50'
                    )}>
                        {isProvisioning && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {isReady && <Zap className="h-3 w-3" />}
                        {isFailed && <AlertCircle className="h-3 w-3" />}
                        {store.status}
                    </div>
                </div>

                {/* Type Badge */}
                <div className="inline-block bg-indigo-500/20 text-indigo-300 text-xs font-bold px-3 py-1 rounded-lg mb-4 border border-indigo-500/30">
                    {store.type === 'woocommerce' ? '🛒 WooCommerce' : '🚀 MedusaJS'}
                </div>

                {/* Provisioning Status */}
                {isProvisioning && (
                    <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-3 py-2 rounded-lg mb-4 border border-amber-500/30">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span>Provisioning for <span className="font-bold">{duration}</span></span>
                    </div>
                )}

                {/* Error Message */}
                {isFailed && store.status_message && (
                    <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 px-3 py-2 rounded-lg mb-4 border border-red-500/30">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{store.status_message}</span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 mb-4">
                    {store.url && isReady && (
                        <a
                            href={store.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 text-white font-bold bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 group/btn text-sm"
                        >
                            <ExternalLink className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                            Visit Storefront
                        </a>
                    )}
                    {isReady && store.type === 'woocommerce' && (
                        <button
                            onClick={onViewCredentials}
                            className="flex items-center justify-center gap-2 text-white font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 rounded-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all duration-300 group/btn text-sm w-full"
                        >
                            <Key className="h-4 w-4 group-hover/btn:rotate-12 transition-transform" />
                            Admin Credentials
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <span className="text-xs text-slate-400">
                        {new Date(store.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Store"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface CreateStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    newStoreName: string;
    onNameChange: (name: string) => void;
    newStoreType: string;
    onTypeChange: (type: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    error?: string | null;
}

function CreateStoreModal({
    isOpen,
    onClose,
    newStoreName,
    onNameChange,
    newStoreType,
    onTypeChange,
    onSubmit,
    isLoading,
    error,
}: CreateStoreModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700/50" onClick={(e) => e.stopPropagation()}>
                <div className="px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-indigo-600/10 to-blue-600/10">
                    <h2 className="text-3xl font-black text-white mb-2">Create Store</h2>
                    <p className="text-slate-300">Launch your e-commerce platform in minutes</p>
                </div>
                <form onSubmit={onSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}
                    {/* Store Name */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-3">Store Name</label>
                        <input
                            type="text"
                            required
                            pattern="^[a-z0-9-]+$"
                            title="Lowercase letters, numbers, and hyphens only"
                            className="w-full rounded-xl border border-slate-600 bg-slate-700/50 focus:bg-slate-700 text-white placeholder-slate-400 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            placeholder="my-awesome-store"
                            value={newStoreName}
                            onChange={(e) => onNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        />
                        <p className="text-xs text-slate-400 mt-2">Lowercase letters, numbers, and hyphens only. Used for URL generation (e.g., <code className="bg-slate-700/50 px-1.5 py-0.5 rounded">my-store.local</code>)</p>
                    </div>

                    {/* Platform Selection */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-3">Platform Engine</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => onTypeChange('woocommerce')}
                                className={clsx(
                                    "p-4 rounded-xl border-2 transition-all duration-200 text-center",
                                    newStoreType === 'woocommerce'
                                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-400/50 shadow-lg shadow-indigo-500/20"
                                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50"
                                )}
                            >
                                <div className="text-lg font-black">🛒</div>
                                <p className="font-bold mt-2">WooCommerce</p>
                                <p className="text-xs opacity-75 mt-1">Classic & Robust</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => onTypeChange('medusa')}
                                className={clsx(
                                    "p-4 rounded-xl border-2 transition-all duration-200 text-center",
                                    newStoreType === 'medusa'
                                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-400/50 shadow-lg shadow-indigo-500/20"
                                        : "border-slate-600 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50"
                                )}
                            >
                                <div className="text-lg font-black">🚀</div>
                                <p className="font-bold mt-2">MedusaJS</p>
                                <p className="text-xs opacity-75 mt-1">Headless & Modern</p>
                            </button>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-slate-300 bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !newStoreName.trim()}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading && <RefreshCw className="animate-spin h-4 w-4" />}
                            {isLoading ? 'Provisioning...' : 'Create Store'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface CredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    credentials: AdminCredentials | null;
    isLoading: boolean;
}

function CredentialsModal({ isOpen, onClose, credentials, isLoading }: CredentialsModalProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-700/50" onClick={(e) => e.stopPropagation()}>
                <div className="px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-indigo-600/10 to-blue-600/10 flex items-center gap-3">
                    <Key className="h-8 w-8 text-indigo-400" />
                    <div>
                        <h2 className="text-3xl font-black text-white">Admin Credentials</h2>
                        <p className="text-slate-300 text-sm mt-1">WooCommerce administrator details</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center">
                        <div className="inline-block p-3 bg-indigo-500/20 rounded-xl mb-3">
                            <RefreshCw className="animate-spin h-6 w-6 text-indigo-400" />
                        </div>
                        <p className="text-slate-300 font-semibold">Fetching credentials...</p>
                    </div>
                ) : credentials ? (
                    <div className="p-8 space-y-4">
                        <CredentialField
                            label="Admin URL"
                            value={credentials.admin_url}
                            onCopy={() => copyToClipboard(credentials.admin_url, 'url')}
                            isCopied={copied === 'url'}
                            isPassword={false}
                        />
                        <CredentialField
                            label="Username"
                            value={credentials.admin_user}
                            onCopy={() => copyToClipboard(credentials.admin_user, 'user')}
                            isCopied={copied === 'user'}
                            isPassword={false}
                        />
                        <CredentialField
                            label="Password"
                            value={credentials.admin_password}
                            onCopy={() => copyToClipboard(credentials.admin_password, 'pass')}
                            isCopied={copied === 'pass'}
                            isPassword={true}
                        />
                        <CredentialField
                            label="Email"
                            value={credentials.admin_email}
                            onCopy={() => copyToClipboard(credentials.admin_email, 'email')}
                            isCopied={copied === 'email'}
                            isPassword={false}
                        />
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                        <p className="text-red-300 font-semibold">Failed to fetch credentials</p>
                    </div>
                )}

                <div className="px-8 py-4 border-t border-slate-700/50 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:shadow-lg hover:shadow-indigo-500/50 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

interface CredentialFieldProps {
    label: string;
    value: string;
    onCopy: () => void;
    isCopied: boolean;
    isPassword: boolean;
}

function CredentialField({ label, value, onCopy, isCopied, isPassword }: CredentialFieldProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wide">{label}</label>
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 font-mono text-sm text-slate-300 overflow-auto max-h-12 flex items-center">
                    {isPassword && !showPassword ? '••••••••••••••••' : value}
                </div>
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
                        title={showPassword ? "Hide" : "Show"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onCopy}
                    className={clsx(
                        "p-2.5 rounded-lg transition-all flex items-center justify-center",
                        isCopied
                            ? "bg-green-500/20 text-green-300"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                    )}
                    title="Copy to clipboard"
                >
                    {isCopied ? <Check size={18} /> : <Copy size={18} />}
                </button>
            </div>
        </div>
    );
}
