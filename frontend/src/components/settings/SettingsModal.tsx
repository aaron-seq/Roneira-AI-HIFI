/**
 * Settings Modal Component
 *
 * Configuration for the application
 */

import React from 'react';
import { X, Save, Shield, Database, Palette } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gold-500/30 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Shield className="text-gold-500" />
                        System Configuration
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8">

                    {/* API Configuration */}
                    <section>
                        <h3 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                            <Database className="w-5 h-5" /> API Connectivity
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Backend API URL</label>
                                <input
                                    type="text"
                                    value="http://localhost:3001"
                                    readOnly
                                    className="w-full bg-gray-800 border border-gray-700 text-gray-500 rounded px-4 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">ML Service Status</label>
                                <div className="w-full bg-gray-800 border border-gray-700 text-green-500 rounded px-4 py-2 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    Connected via Proxy
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Appearance */}
                    <section>
                        <h3 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5" /> Interface
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-center gap-3 p-4 bg-gray-800 border-2 border-gold-500 rounded cursor-pointer">
                                <div className="w-4 h-4 rounded-full bg-gold-500" />
                                <div>
                                    <div className="font-semibold text-white">Pro Terminal</div>
                                    <div className="text-xs text-gray-400">High contrast dark mode</div>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-4 bg-gray-800 border border-gray-700 rounded opacity-50 cursor-not-allowed">
                                <div className="w-4 h-4 rounded-full border border-gray-500" />
                                <div>
                                    <div className="font-semibold text-white">Light Mode</div>
                                    <div className="text-xs text-gray-400">Coming soon</div>
                                </div>
                            </label>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gold-600 hover:bg-gold-500 text-black font-bold rounded flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
