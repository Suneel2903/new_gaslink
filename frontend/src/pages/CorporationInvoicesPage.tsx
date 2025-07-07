import React, { useState, useEffect } from 'react';
import invoiceService from '../services/invoiceService';

const CorporationInvoicesPage: React.FC = () => {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [outgoingERVs, setOutgoingERVs] = useState<any[]>([]);
  const [uploadERVFile, setUploadERVFile] = useState<File | null>(null);
  const [uploadERVResult, setUploadERVResult] = useState<any>(null);
  const [uploadERVLoading, setUploadERVLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingOutgoingERVs, setLoadingOutgoingERVs] = useState(false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');

  useEffect(() => {
    if (activeTab === 'incoming') {
      fetchInvoices();
    } else {
      fetchOutgoingERVs();
    }
  }, [activeTab]);

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const data = await invoiceService.fetchCorporationInvoices();
      setInvoices(data);
    } catch (err) {
      setInvoices([]);
    }
    setLoadingInvoices(false);
  };

  const fetchOutgoingERVs = async () => {
    setLoadingOutgoingERVs(true);
    try {
      const data = await invoiceService.fetchOutgoingERVs();
      setOutgoingERVs(data);
    } catch (err) {
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
    } catch (err: any) {
      setUploadResult({ error: err?.response?.data?.error || err.message });
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
    } catch (err: any) {
      setUploadERVResult({ error: err?.response?.data?.error || err.message });
    }
    setUploadERVLoading(false);
  };

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
      {(activeTab === 'incoming' ? loadingInvoices : loadingOutgoingERVs) ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border">
            <thead>
              <tr className="bg-gray-200">
                {activeTab === 'incoming' ? (
                  <>
                    <th className="p-2 border">File Name</th>
                    <th className="p-2 border">Tax Invoice No</th>
                    <th className="p-2 border">Invoice No</th>
                    <th className="p-2 border">TT No</th>
                    <th className="p-2 border">Date</th>
                    <th className="p-2 border">Eway Bill</th>
                    <th className="p-2 border">PO Ref</th>
                    <th className="p-2 border">Item No</th>
                    <th className="p-2 border">Material Code</th>
                    <th className="p-2 border">Description</th>
                    <th className="p-2 border">Qty</th>
                    <th className="p-2 border">Unit</th>
                    <th className="p-2 border">HSN</th>
                    <th className="p-2 border">Approved</th>
                  </>
                ) : (
                  <>
                    <th className="p-2 border">Distributor SAP Code</th>
                    <th className="p-2 border">SAP Plant Code</th>
                    <th className="p-2 border">AC4 No</th>
                    <th className="p-2 border">SAP Doc No</th>
                    <th className="p-2 border">Truck No</th>
                    <th className="p-2 border">Delivery Challan Date</th>
                    <th className="p-2 border">Delivery Challan No</th>
                    <th className="p-2 border">Equipment Code</th>
                    <th className="p-2 border">Return Description</th>
                    <th className="p-2 border">Quantity</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {activeTab === 'incoming' ? (
                invoices.map((row, idx) => (
                  <tr key={row.id || idx} className="border-b">
                    <td className="p-2 border">{row.file_name}</td>
                    <td className="p-2 border">{row.tax_invoice_no}</td>
                    <td className="p-2 border">{row.invoice_no}</td>
                    <td className="p-2 border">{row.tt_no}</td>
                    <td className="p-2 border">{row.date ? new Date(row.date).toLocaleDateString() : ''}</td>
                    <td className="p-2 border">{row.eway_bill}</td>
                    <td className="p-2 border">{row.po_ref}</td>
                    <td className="p-2 border">{row.item_no}</td>
                    <td className="p-2 border">{row.material_code}</td>
                    <td className="p-2 border">{row.material_description}</td>
                    <td className="p-2 border">{row.quantity}</td>
                    <td className="p-2 border">{row.unit}</td>
                    <td className="p-2 border">{row.hsn_code}</td>
                    <td className="p-2 border">{row.approved ? '✅' : '❌'}</td>
                  </tr>
                ))
              ) : (
                outgoingERVs.length === 0 ? (
                  <tr><td colSpan={10} className="p-2 border text-center text-gray-400">No outgoing ERVs found.</td></tr>
                ) : (
                  outgoingERVs.map((row, idx) => (
                    <tr key={row.id || idx} className="border-b">
                      <td className="p-2 border">{row.distributor_sap_code}</td>
                      <td className="p-2 border">{row.sap_plant_code}</td>
                      <td className="p-2 border">{row.ac4_no}</td>
                      <td className="p-2 border">{row.sap_doc_no}</td>
                      <td className="p-2 border">{row.truck_no}</td>
                      <td className="p-2 border">{row.delivery_challan_date}</td>
                      <td className="p-2 border">{row.delivery_challan_no}</td>
                      <td className="p-2 border">{row.equipment_code}</td>
                      <td className="p-2 border">{row.return_description}</td>
                      <td className="p-2 border">{row.quantity}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CorporationInvoicesPage; 