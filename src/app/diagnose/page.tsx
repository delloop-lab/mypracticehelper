"use client";

import { useEffect, useState } from 'react';

interface EnvVarStatus {
    status: 'SET' | 'NOT SET' | 'PLACEHOLDER';
    value?: string;
}

interface Diagnostics {
    timestamp: string;
    environment: string;
    vercelUrl: string;
    environmentVariables: {
        critical: Record<string, EnvVarStatus>;
        important: Record<string, EnvVarStatus>;
        optional: Record<string, EnvVarStatus>;
    };
    summary: {
        criticalMissing: number;
        importantMissing: number;
        status: string;
    };
    supabaseConfigured: boolean;
    databaseConnection?: string;
    databaseError?: string;
    clientsCount?: number;
}

export default function DiagnosePage() {
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/diagnose')
            .then(res => res.json())
            .then(data => {
                setDiagnostics(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const getStatusColor = (status: string) => {
        if (status === 'SET') return 'text-green-600 bg-green-50';
        if (status === 'PLACEHOLDER') return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    const getStatusIcon = (status: string) => {
        if (status === 'SET') return '✅';
        if (status === 'PLACEHOLDER') return '⚠️';
        return '❌';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading diagnostics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                    <p className="text-gray-700">{error}</p>
                </div>
            </div>
        );
    }

    if (!diagnostics) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Environment Variables Diagnostic</h1>
                    <p className="text-gray-600 mb-4">
                        Last updated: {new Date(diagnostics.timestamp).toLocaleString()}
                    </p>
                    <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${
                        diagnostics.summary.status.includes('✅') ? 'bg-green-100 text-green-800' :
                        diagnostics.summary.status.includes('⚠️') ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                        {diagnostics.summary.status}
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">Environment</div>
                            <div className="text-lg font-semibold text-gray-900">{diagnostics.environment}</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">Critical Missing</div>
                            <div className="text-lg font-semibold text-red-600">{diagnostics.summary.criticalMissing}</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-600">Important Missing</div>
                            <div className="text-lg font-semibold text-yellow-600">{diagnostics.summary.importantMissing}</div>
                        </div>
                    </div>
                </div>

                {/* Critical Variables */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-red-900 mb-4">🔴 Critical Variables (Required)</h2>
                    <div className="space-y-3">
                        {Object.entries(diagnostics.environmentVariables.critical).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex-1">
                                    <div className="font-mono text-sm font-semibold text-gray-900">{key}</div>
                                    {value.value && (
                                        <div className="text-xs text-gray-500 mt-1">Value: {value.value}</div>
                                    )}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(value.status)}`}>
                                    {getStatusIcon(value.status)} {value.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Important Variables */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-yellow-900 mb-4">🟡 Important Variables (Recommended)</h2>
                    <div className="space-y-3">
                        {Object.entries(diagnostics.environmentVariables.important).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex-1">
                                    <div className="font-mono text-sm font-semibold text-gray-900">{key}</div>
                                    {value.value && (
                                        <div className="text-xs text-gray-500 mt-1">Value: {value.value}</div>
                                    )}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(value.status)}`}>
                                    {getStatusIcon(value.status)} {value.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Optional Variables */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">⚪ Optional Variables</h2>
                    <div className="space-y-3">
                        {Object.entries(diagnostics.environmentVariables.optional).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex-1">
                                    <div className="font-mono text-sm font-semibold text-gray-900">{key}</div>
                                    {value.value && (
                                        <div className="text-xs text-gray-500 mt-1">Value: {value.value}</div>
                                    )}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(value.status)}`}>
                                    {getStatusIcon(value.status)} {value.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Database Connection Status */}
                {diagnostics.databaseConnection && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Database Connection</h2>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-700">Supabase Configured:</span>
                                <span className={`font-semibold ${diagnostics.supabaseConfigured ? 'text-green-600' : 'text-red-600'}`}>
                                    {diagnostics.supabaseConfigured ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-700">Connection Status:</span>
                                <span className={`font-semibold ${
                                    diagnostics.databaseConnection === 'SUCCESS' ? 'text-green-600' :
                                    diagnostics.databaseConnection === 'FAILED' ? 'text-red-600' :
                                    'text-yellow-600'
                                }`}>
                                    {diagnostics.databaseConnection}
                                </span>
                            </div>
                            {diagnostics.databaseError && (
                                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                                    <div className="text-sm text-red-800 font-semibold">Error:</div>
                                    <div className="text-sm text-red-600">{diagnostics.databaseError}</div>
                                </div>
                            )}
                            {diagnostics.clientsCount !== undefined && (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700">Test Query:</span>
                                    <span className="text-gray-900 font-semibold">Found {diagnostics.clientsCount} client(s)</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}







