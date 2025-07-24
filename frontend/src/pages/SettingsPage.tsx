import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/apiClient';
import type { ApiError } from '../types';

interface DueDateSettings {
  due_date_credit_notes: number;
  due_date_invoice_disputes: number;
  due_date_customer_modifications: number;
  due_date_inventory_adjustments: number;
  due_date_accountability_logs: number;
  due_date_stock_replenishment: number;
  due_date_unallocated_payments: number;
}

interface CylinderThreshold {
  cylinder_type_id: string;
  name: string;
  threshold: number;
}

export const SettingsPage: React.FC = () => {
  const { distributor_id } = useAuth();
  const [settings, setSettings] = useState<DueDateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cylinderThresholds, setCylinderThresholds] = useState<CylinderThreshold[]>([]);
  const [thresholdsLoading, setThresholdsLoading] = useState(true);
  const [thresholdsSaving, setThresholdsSaving] = useState(false);
  const [thresholdsError, setThresholdsError] = useState<string | null>(null);
  const [thresholdsSuccess, setThresholdsSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (distributor_id) {
      fetchSettings();
      fetchCylinderThresholds();
    }
  }, [distributor_id]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.settings.getDistributorSettings(distributor_id!);
      setSettings(response.data.data);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Error fetching settings:', apiError);
      setError(apiError.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinderThresholds = async () => {
    try {
      setThresholdsLoading(true);
      setThresholdsError(null);
      const response = await api.settings.getCylinderThresholds(distributor_id!);
      setCylinderThresholds(response.data.data);
    } catch (err) {
      setThresholdsError('Failed to fetch cylinder thresholds');
    } finally {
      setThresholdsLoading(false);
    }
  };

  const handleSettingChange = (key: keyof DueDateSettings, value: number) => {
    if (settings) {
      setSettings({
        ...settings,
        [key]: value
      });
    }
  };

  const handleThresholdChange = (idx: number, value: number) => {
    setCylinderThresholds((prev) => prev.map((t, i) => i === idx ? { ...t, threshold: value } : t));
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await api.settings.updateDistributorSettings(distributor_id!, settings);
      setSuccess('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Error saving settings:', apiError);
      setError(apiError.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      setThresholdsSaving(true);
      setThresholdsError(null);
      setThresholdsSuccess(null);
      await api.settings.updateCylinderThresholds(distributor_id!, cylinderThresholds);
      setThresholdsSuccess('Cylinder thresholds saved successfully!');
      setTimeout(() => setThresholdsSuccess(null), 3000);
    } catch (err) {
      setThresholdsError('Failed to save cylinder thresholds');
    } finally {
      setThresholdsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    try {
      setLoading(true);
      const response = await api.settings.getDefaultDueDateSettings();
      setSettings(response.data.data);
      setSuccess('Reset to default settings!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('Error resetting to defaults:', apiError);
      setError(apiError.message || 'Failed to reset to defaults');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">No settings available</div>
      </div>
    );
  }

  const settingFields = [
    {
      key: 'due_date_credit_notes' as keyof DueDateSettings,
      label: 'Credit Notes',
      description: 'Days to process credit note requests',
      icon: '🧾'
    },
    {
      key: 'due_date_invoice_disputes' as keyof DueDateSettings,
      label: 'Invoice Disputes',
      description: 'Days to resolve invoice disputes',
      icon: '⚠️'
    },
    {
      key: 'due_date_customer_modifications' as keyof DueDateSettings,
      label: 'Customer Modifications',
      description: 'Days to process customer modification requests',
      icon: '👤'
    },
    {
      key: 'due_date_inventory_adjustments' as keyof DueDateSettings,
      label: 'Inventory Adjustments',
      description: 'Days to approve manual inventory adjustments',
      icon: '⚖️'
    },
    {
      key: 'due_date_accountability_logs' as keyof DueDateSettings,
      label: 'Accountability Logs',
      description: 'Days to resolve missing cylinder logs',
      icon: '🔍'
    },
    {
      key: 'due_date_stock_replenishment' as keyof DueDateSettings,
      label: 'Stock Replenishment',
      description: 'Days to process stock replenishment requests (0 = immediate)',
      icon: '📦',
      critical: true
    },
    {
      key: 'due_date_unallocated_payments' as keyof DueDateSettings,
      label: 'Unallocated Payments',
      description: 'Days to allocate unallocated payments',
      icon: '💰'
    }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">Configure your business settings and due dates</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <strong className="font-bold">Success: </strong>
          <span className="block sm:inline">{success}</span>
        </div>
      )}

      {/* Due Date Settings */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Due Date Settings</h2>
            <p className="text-gray-600 dark:text-gray-400">Configure how many days each action type should take to complete</p>
          </div>
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
        </div>

        <div className="space-y-6">
          {settingFields.map((field) => (
            <div key={field.key} className={`p-4 border rounded-lg ${field.critical ? 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">{field.icon}</span>
                  <div>
                    <h3 className={`font-medium ${field.critical ? 'text-orange-800 dark:text-orange-200' : 'text-gray-900 dark:text-white'}`}>
                      {field.label}
                      {field.critical && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded-full">
                          Critical
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {field.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={settings[field.key]}
                    onChange={(e) => handleSettingChange(field.key, parseInt(e.target.value) || 0)}
                    className={`w-20 px-3 py-2 border rounded-lg text-center ${
                      field.critical 
                        ? 'border-orange-300 focus:border-orange-500 focus:ring-orange-500' 
                        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                    } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">days</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Cylinder Thresholds Section */}
      <div className="card p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Cylinder Thresholds</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Configure the minimum stock threshold for each cylinder type. If stock falls below this value, an alert and replenishment request will be triggered.</p>
        {thresholdsError && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">{thresholdsError}</div>}
        {thresholdsSuccess && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">{thresholdsSuccess}</div>}
        {thresholdsLoading ? (
          <div className="flex items-center justify-center min-h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="w-full bg-white dark:bg-gray-800 rounded-lg shadow text-sm">
            <thead>
              <tr className="bg-blue-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                <th className="px-4 py-3 text-left font-bold">Cylinder Type</th>
                <th className="px-4 py-3 text-left font-bold">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {cylinderThresholds.map((row, idx) => (
                <tr key={row.cylinder_type_id} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      value={row.threshold}
                      onChange={e => handleThresholdChange(idx, parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border rounded-lg text-center border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveThresholds}
            disabled={thresholdsSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {thresholdsSaving ? 'Saving...' : 'Save Thresholds'}
          </button>
        </div>
      </div>

      {/* Information Section */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">About Due Date Settings</h2>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>• <strong>Due dates</strong> determine when pending actions become overdue and require immediate attention</p>
          <p>• <strong>Stock Replenishment</strong> is marked as critical and should typically be set to 0 (immediate action)</p>
          <p>• <strong>Overdue items</strong> will be highlighted in red in the pending actions list</p>
          <p>• <strong>Settings are per-distributor</strong> - each distributor can have their own SLA times</p>
          <p>• <strong>Changes take effect immediately</strong> for new pending actions</p>
        </div>
      </div>
    </div>
  );
}; 