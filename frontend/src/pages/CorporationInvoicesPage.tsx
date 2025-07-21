import React, { useState, useEffect } from 'react';
import invoiceService from '../services/invoiceService';
import type { ApiError, AC4ERVInvoice, OutgoingERV } from '../types';

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

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await invoiceService.fetchCorporationInvoices();
      setInvoices(data);
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
      setOutgoingERVs(data);
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
    <div className="max-w-5xl mx-auto mt-8 p-4 border rounded bg-gray-50">
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
        <div className="overflow-x-auto">
          <p className="text-gray-600">
            {activeTab === 'incoming' 
              ? `Found ${invoices.length} AC4/ERV invoices` 
              : `Found ${outgoingERVs.length} outgoing ERVs`
            }
          </p>
          {activeTab === 'outgoing' && outgoingERVs.length > 0 && (
            (() => {
              const excludeKeys = [
                'ac4_date',
                'ac4_receipt_datetime',
                'driver_name',
                'e_way_bill_amount',
                'remarks',
              ];
              const keys = outgoingERVs[0] ? Object.keys(outgoingERVs[0]).filter(k => !excludeKeys.includes(k)) : [];
              return (
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50">
                    <tr>
                      {keys.map((key) => (
                        <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {outgoingERVs.map((erv, idx) => (
                      <tr key={idx}>
                        {keys.map((key) => (
                          <td key={key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {typeof (erv as Record<string, any>)[key] === 'object'
                              ? JSON.stringify((erv as Record<string, any>)[key])
                              : String((erv as Record<string, any>)[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
          {activeTab === 'incoming' && invoices.length > 0 && (
            (() => {
              const excludeKeys = [
                'ac4_date',
                'ac4_receipt_datetime',
                'driver_name',
                'e_way_bill_amount',
                'remarks',
              ];
              const keys = invoices[0] ? Object.keys(invoices[0]).filter(k => !excludeKeys.includes(k)) : [];
              return (
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50">
                    <tr>
                      {keys.map((key) => (
                        <th key={key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((inv, idx) => (
                      <tr key={idx}>
                        {keys.map((key) => (
                          <td key={key} className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {typeof (inv as Record<string, any>)[key] === 'object'
                              ? JSON.stringify((inv as Record<string, any>)[key])
                              : String((inv as Record<string, any>)[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};

export default CorporationInvoicesPage; 