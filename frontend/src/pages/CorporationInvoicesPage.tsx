import React, { useState, useEffect } from 'react';
import invoiceService from '../services/invoiceService';
import type { ApiError, AC4ERVInvoice, OutgoingERV } from '../types';
import { api } from '../services/apiClient';
// Remove: import { Modal, Button } from 'antd';

interface UploadResult {
  success?: boolean;
  error?: string;
  items_inserted?: number;
  extracted_data?: Record<string, unknown>;
}

const CorporationInvoicesPage: React.FC = () => {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [invoices, setInvoices] = useState<AC4ERVInvoice[]>([]);
  const [outgoingERVs, setOutgoingERVs] = useState<OutgoingERV[]>([]);
  const [uploadERVFile, setUploadERVFile] = useState<File | null>(null);
  const [uploadERVResult, setUploadERVResult] = useState<UploadResult | null>(null);
  const [uploadERVLoading, setUploadERVLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingOutgoingERVs, setLoadingOutgoingERVs] = useState(false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [distributor_id, setDistributorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [corporationInvoices, setCorporationInvoices] = useState<AC4ERVInvoice[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<AC4ERVInvoice | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cylinderTypes, setCylinderTypes] = useState<any[]>([]);
  const [selectedCylinderType, setSelectedCylinderType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Fetch cylinder types when modal opens
  useEffect(() => {
    if (editModalOpen && cylinderTypes.length === 0) {
      api.cylinderTypes.getAll().then(res => {
        setCylinderTypes(res.data?.data || res.data);
      });
    }
  }, [editModalOpen, cylinderTypes.length]);

  // When opening modal, set default cylinder type and date
  useEffect(() => {
    if (editModalOpen && editInvoice) {
      setSelectedCylinderType((editInvoice.confirmed_data && editInvoice.confirmed_data.cylinder_type_id) || editInvoice.cylinder_type_id || '');
      setSelectedDate((editInvoice.confirmed_data && editInvoice.confirmed_data.date) || editInvoice.date || '');
    }
  }, [editModalOpen, editInvoice]);

  useEffect(() => {
    if (activeTab === 'incoming') {
      fetchInvoices();
    } else {
      fetchOutgoingERVs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (isSuperAdmin && !distributor_id) {
      setLoading(false);
      return;
    }
    fetchCorporationInvoices();
  }, [distributor_id, isSuperAdmin]);

  // Normalize invoice_id for all rows after fetch
  const normalizeInvoices = (data: any[], type: 'ac4' | 'erv') =>
    data.map(row => ({
      ...row,
      invoice_id: row.invoice_id || row.erv_id || row.id || row._id || '', // robust fallback
    }));

  // Fetch and normalize AC4/ERV data
  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await invoiceService.fetchCorporationInvoices();
      setInvoices(normalizeInvoices(data, 'ac4'));
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching invoices:', apiError);
      setInvoices([]);
    }
    setLoadingInvoices(false);
  };

  const fetchOutgoingERVs = async () => {
    setLoadingOutgoingERVs(true);
    try {
      const data = await invoiceService.fetchOutgoingERVs();
      setOutgoingERVs(normalizeInvoices(data, 'erv'));
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching outgoing ERVs:', apiError);
      setOutgoingERVs([]);
    }
    setLoadingOutgoingERVs(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleERVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadERVFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const result = await invoiceService.uploadInvoicePDF(uploadFile);
      setUploadResult(result);
      fetchInvoices(); // Refresh after upload
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setUploadResult({ error: apiError.message || 'Upload failed' });
    }
    setUploadLoading(false);
  };

  const handleERVUpload = async () => {
    if (!uploadERVFile) return;
    setUploadERVLoading(true);
    try {
      const result = await invoiceService.uploadERVPDF(uploadERVFile);
      setUploadERVResult(result);
      fetchOutgoingERVs(); // Refresh after upload
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setUploadERVResult({ error: apiError.message || 'Upload failed' });
    }
    setUploadERVLoading(false);
  };

  const fetchCorporationInvoices = async () => {
    setLoading(true);
    try {
      const data = await invoiceService.fetchCorporationInvoices();
      setCorporationInvoices(data);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      console.error('Error fetching AC4/ERV invoices:', apiError);
      setCorporationInvoices([]);
    }
    setLoading(false);
  };

  // Only show unconfirmed invoices
  const unconfirmedInvoices = invoices.filter(inv => !inv.confirmed);

  // When opening modal, set default cylinder type and date
  const handleEdit = (invoice: AC4ERVInvoice) => {
    setEditInvoice(invoice);
    setEditValues(invoice.extracted_data || {});
    setSelectedCylinderType((invoice.confirmed_data && invoice.confirmed_data.cylinder_type_id) || invoice.cylinder_type_id || '');
    setSelectedDate((invoice.confirmed_data && invoice.confirmed_data.date) || invoice.date || '');
    setEditModalOpen(true);
  };

  const handleEditChange = (key: string, value: any) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  // In handleConfirm, always use invoice.invoice_id and log the payload
  const handleConfirm = async (invoice: AC4ERVInvoice | OutgoingERV, edited: boolean = false) => {
    setConfirmingId(invoice.invoice_id);
    // Log the invoice row for debugging
    console.log('Invoice row:', JSON.stringify(invoice, null, 2));
    try {
      const original = Object.keys(invoice.extracted_data || {}).length > 0
        ? invoice.extracted_data
        : getEditableFields(invoice);
      const merged = { ...original, ...editValues, cylinder_type_id: selectedCylinderType, date: selectedDate };
      const payload = {
        invoice_id: invoice.invoice_id,
        type: activeTab === 'incoming' ? 'ac4' : 'erv',
        confirmed_data: merged,
      };
      // Log the payload for debugging
      console.log('Confirm payload:', JSON.stringify(payload, null, 2));
      // Guard: if invoice_id or type is missing, alert and do not proceed
      if (!payload.invoice_id || !payload.type) {
        alert('Invoice ID or type is missing! Please check the data.');
        setConfirmingId(null);
        return;
      }
      await invoiceService.confirmOCRInvoice(payload);
      setEditModalOpen(false);
      setEditInvoice(null);
      if (activeTab === 'incoming') {
        fetchInvoices();
      } else {
        fetchOutgoingERVs();
      }
    } catch (err) {
      alert('Failed to confirm invoice. Please try again.');
    }
    setConfirmingId(null);
  };

  // Show all invoices, not just unconfirmed
  const allInvoices = invoices;
  const allERVs = outgoingERVs;

  // For modal: show both previous and confirmed values if available
  const getModalFields = (invoice: AC4ERVInvoice) => {
    const original = invoice.extracted_data || {};
    const confirmed = invoice.confirmed_data || invoice.confirmed_data || {};
    return { original, confirmed };
  };

  const handleViewEdit = (invoice: AC4ERVInvoice) => {
    setEditInvoice(invoice);
    setEditValues(invoice.confirmed ? (invoice.confirmed_data || invoice.extracted_data || {}) : (invoice.extracted_data || {}));
    setEditModalOpen(true);
  };

  // Helper to get editable fields from invoice row
  const getEditableFields = (invoice: any) => {
    const exclude = [
      'id', 'invoice_id', 'erv_id', 'created_at', 'updated_at', 'status', 'confirmed', 'confirmed_data', 'extracted_data', 'pdf_url'
    ];
    return Object.fromEntries(
      Object.entries(invoice).filter(([k, v]) => !exclude.includes(k) && typeof v !== 'object')
    );
  };

  // Defensive UI checks
  if (isSuperAdmin && !distributor_id) {
    return null; // Already handled in DashboardLayout
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!corporationInvoices) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Something went wrong loading AC4/ERV invoices</div>
      </div>
    );
  }

  if (corporationInvoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No AC4/ERV invoices found.</div>
      </div>
    );
  }

  return (
    <div className="w-full px-8 py-6 bg-gray-50 border rounded-xl shadow-md" style={{ minHeight: '80vh' }}>
      {/* Tabs for Incoming/Outgoing ERVs */}
      <div className="flex mb-4 border-b">
        <button
          className={`px-4 py-2 font-semibold focus:outline-none border-b-2 transition-colors ${activeTab === 'incoming' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming AC4's
        </button>
        <button
          className={`ml-2 px-4 py-2 font-semibold focus:outline-none border-b-2 transition-colors ${activeTab === 'outgoing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          onClick={() => setActiveTab('outgoing')}
        >
          Outgoing ERVs
        </button>
      </div>
      {activeTab === 'incoming' ? (
        <>
          <h2 className="text-lg font-semibold mb-2">
            Upload Corporation Invoice PDF (OCR)
          </h2>
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
          <button
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={handleUpload}
            disabled={uploadLoading || !uploadFile}
          >
            {uploadLoading ? 'Uploading...' : 'Upload'}
          </button>
          {uploadResult && (
            <div className="mt-4">
              {uploadResult.error ? (
                <div className="text-red-600">Error: {uploadResult.error}</div>
              ) : (
                <div>
                  <div className="font-semibold mb-2">Extracted Items:</div>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(uploadResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-2">
            Upload Outgoing ERV PDF (OCR)
          </h2>
          <input type="file" accept="application/pdf" onChange={handleERVFileChange} />
          <button
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={handleERVUpload}
            disabled={uploadERVLoading || !uploadERVFile}
          >
            {uploadERVLoading ? 'Uploading...' : 'Upload'}
          </button>
          {uploadERVResult && (
            <div className="mt-4">
              {uploadERVResult.error ? (
                <div className="text-red-600">Error: {uploadERVResult.error}</div>
              ) : (
                <div>
                  <div className="font-semibold mb-2">Extracted Items:</div>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(uploadERVResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <hr className="my-6" />
      <h3 className="text-md font-semibold mb-2">
        {activeTab === 'outgoing' ? 'All Outgoing ERVs' : "All Incoming AC4's"}
      </h3>
      {(activeTab === 'outgoing' ? loadingOutgoingERVs : loadingInvoices) ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto w-full">
          <p className="text-gray-600">
            {activeTab === 'incoming' 
              ? `Found ${allInvoices.length} AC4/ERV invoices` 
              : `Found ${allERVs.length} outgoing ERVs`}
          </p>
          {activeTab === 'outgoing' && allERVs.length > 0 && (
            (() => {
              const excludeKeys = [
                'ac4_date',
                'ac4_receipt_datetime',
                'driver_name',
                'e_way_bill_amount',
                'remarks',
                'extracted_data',
                'confirmed_data',
              ];
              const keys = allERVs[0] ? Object.keys(allERVs[0]).filter(k => !excludeKeys.includes(k)) : [];
              return (
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50">
                    <tr>
                      {keys.map((key) => (
                        <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allERVs.map((erv, idx) => (
                      <tr key={idx}>
                        {keys.map((key) => (
                          <td key={key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {typeof (erv as Record<string, any>)[key] === 'object'
                              ? JSON.stringify((erv as Record<string, any>)[key])
                              : String((erv as Record<string, any>)[key])}
                          </td>
                        ))}
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {erv.status === 'confirmed' ? (
                            <span className="text-green-600 font-semibold">Confirmed</span>
                          ) : (
                            <span className="text-yellow-600 font-semibold">Unconfirmed</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {erv.status === 'confirmed' ? (
                            <button className="btn-secondary" onClick={() => handleViewEdit(erv)}>View</button>
                          ) : (
                            <button className="btn-primary" onClick={() => handleEdit(erv)} disabled={confirmingId === erv.invoice_id}>
                              {confirmingId === erv.invoice_id ? 'Confirming...' : 'Confirm'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
          {activeTab === 'incoming' && allInvoices.length > 0 && (
            (() => {
              const excludeKeys = [
                'ac4_date',
                'ac4_receipt_datetime',
                'driver_name',
                'e_way_bill_amount',
                'remarks',
                'extracted_data',
                'confirmed_data',
              ];
              const keys = allInvoices[0] ? Object.keys(allInvoices[0]).filter(k => !excludeKeys.includes(k)) : [];
              return (
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50">
                    <tr>
                      {keys.map((key) => (
                        <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allInvoices.map((inv, idx) => (
                      <tr key={idx}>
                        {keys.map((key) => (
                          <td key={key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {typeof (inv as Record<string, any>)[key] === 'object'
                              ? JSON.stringify((inv as Record<string, any>)[key])
                              : String((inv as Record<string, any>)[key])}
                          </td>
                        ))}
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {inv.status === 'confirmed' ? (
                            <span className="text-green-600 font-semibold">Confirmed</span>
                          ) : (
                            <span className="text-yellow-600 font-semibold">Unconfirmed</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {inv.status === 'confirmed' ? (
                            <button className="btn-secondary" onClick={() => handleViewEdit(inv)}>View</button>
                          ) : (
                            <button className="btn-primary" onClick={() => handleEdit(inv)} disabled={confirmingId === inv.invoice_id}>
                              {confirmingId === inv.invoice_id ? 'Confirming...' : 'Confirm'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>
      )}
      {/* Edit/View Modal */}
      {editModalOpen && editInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-8">
            <h2 className="text-xl font-bold mb-4">{editInvoice.status === 'confirmed' ? 'View/Edit Invoice Data' : 'Edit Invoice Data'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Previous Values</h3>
                {(Object.keys(editInvoice.extracted_data || {}).length > 0
                  ? Object.entries(editInvoice.extracted_data)
                  : Object.entries(getEditableFields(editInvoice))
                ).map(([key, value]) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{key}</label>
                    <div className="input-field w-full bg-gray-100">{value ?? ''}</div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-2">{editInvoice.status === 'confirmed' ? 'Confirmed Values' : 'Edit Values'}</h3>
                {/* Cylinder Type Dropdown and Date Picker for unconfirmed */}
                {editInvoice.status !== 'confirmed' && (
                  <>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cylinder Type</label>
                      <select
                        className="input-field w-full"
                        value={selectedCylinderType}
                        onChange={e => setSelectedCylinderType(e.target.value)}
                      >
                        <option value="">Select Cylinder Type</option>
                        {cylinderTypes.map((ct: any) => (
                          <option key={ct.cylinder_type_id} value={ct.cylinder_type_id}>{ct.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        className="input-field w-full"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {(editInvoice.status === 'confirmed'
                  ? Object.keys(editInvoice.confirmed_data || editInvoice.extracted_data || getEditableFields(editInvoice))
                  : (Object.keys(editInvoice.extracted_data || {}).length > 0
                      ? Object.keys(editInvoice.extracted_data)
                      : Object.keys(getEditableFields(editInvoice))
                    )
                ).map((key) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{key}</label>
                    {editInvoice.status === 'confirmed' ? (
                      <div className="input-field w-full bg-gray-100">{(editInvoice.confirmed_data && editInvoice.confirmed_data[key] !== undefined) ? editInvoice.confirmed_data[key] : (editInvoice.extracted_data ? editInvoice.extracted_data[key] : getEditableFields(editInvoice)[key])}</div>
                    ) : (
                      <input
                        className="input-field w-full"
                        value={editValues[key] ?? ''}
                        onChange={e => handleEditChange(key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setEditModalOpen(false)}>Close</button>
              {editInvoice.status !== 'confirmed' && (
                <button className="btn-primary" onClick={() => handleConfirm(editInvoice, true)}>Confirm</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporationInvoicesPage; 