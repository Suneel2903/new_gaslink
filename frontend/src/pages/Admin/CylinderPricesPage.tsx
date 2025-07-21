import React, { useEffect, useState } from "react";
import { api } from "../../services/apiClient";
import type { ApiError, CylinderType } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useDebug } from "../../contexts/DebugContext";

interface PriceInput {
  cylinder_type_id: string;
  unit_price: string;
}

interface PriceLogEntry {
  price_id: string;
  cylinder_type_id: string;
  unit_price: number;
  effective_from: string;
  cylinder_type_name: string;
}

const months = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];
const currentYear = new Date().getFullYear();

export default function CylinderPricesPage() {
  const { log } = useDebug();
  const { distributor_id, isSuperAdmin } = useAuth();
  const [cylinderTypes, setCylinderTypes] = useState<CylinderType[]>([]);
  const [priceInputs, setPriceInputs] = useState<PriceInput[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [priceLog, setPriceLog] = useState<PriceLogEntry[]>([]);
  const [pricesExist, setPricesExist] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    log("Mounted CylinderPricesPage");
    log("distributor_id: " + distributor_id);
  }, [distributor_id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    log('🔥 CylinderPricesPage useEffect triggered: ' + JSON.stringify({ distributor_id, isSuperAdmin }));
    if (isSuperAdmin && !distributor_id) {
      setError("Please select a distributor to view cylinder prices.");
      setCylinderTypes([]);
      setPriceLog([]);
      log('🛑 Guard triggered: distributor_id missing, state cleared');
      return;
    }
    log('🟢 Proceeding to fetch data');
    log('Calling fetchCylinderTypes()');
    log('Calling fetchPriceLog()');
    fetchCylinderTypes();
    fetchPriceLog(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, distributor_id, isSuperAdmin]);

  const fetchCylinderTypes = async () => {
    log('📥 fetchCylinderTypes called');
    try {
      const res = await api.cylinderTypes.getAll(distributor_id || undefined);
      setCylinderTypes(res.data.data ?? []);
      log('✅ setCylinderTypes: ' + JSON.stringify(res.data.data ?? []));
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || "Failed to fetch cylinder types");
      setCylinderTypes([]);
      log('❌ Error in fetchCylinderTypes: ' + (apiError.message || 'Unknown error'));
    }
  };

  const fetchPriceLog = async (month: number, year: number) => {
    log('📥 fetchPriceLog called: ' + JSON.stringify({ month, year, distributor_id }));
    log('Fetching prices:', { distributor_id, month, year });
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await api.cylinderPrices.getByMonthYear(month, year, distributor_id ?? undefined);
      log('Received:', res.data.data ? res.data.data.length : 0, 'entries');
      setPriceLog(res.data.data ?? []);
      setPricesExist((res.data.data ?? []).length > 0);
      log('Fetched price log: ' + JSON.stringify(res.data.data ?? []));
      if (res.data.data && res.data.data.length > 0) {
        setPriceInputs(res.data.data.map((p: PriceLogEntry) => ({ cylinder_type_id: p.cylinder_type_id, unit_price: p.unit_price.toString() })));
      } else {
        setPriceInputs([]);
      }
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || "Failed to fetch price log");
      setPriceLog([]);
      setPricesExist(false);
      log('❌ Error in fetchPriceLog: ' + (apiError.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    log('Rendering prices:', priceLog.length);
  }, [priceLog]);

  const handlePriceChange = (id: string, value: string) => {
    setPriceInputs(inputs => {
      if (inputs.some(p => p.cylinder_type_id === id)) {
        return inputs.map(p => p.cylinder_type_id === id ? { ...p, unit_price: value } : p);
      } else {
        return [...inputs, { cylinder_type_id: id, unit_price: value }];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const safeCylinderTypes = cylinderTypes ?? [];
    if (
      safeCylinderTypes.some(
        type =>
          !priceInputs.find(
            p =>
              p.cylinder_type_id === type.cylinder_type_id &&
              p.unit_price !== "" &&
              !isNaN(Number(p.unit_price)) &&
              Number(p.unit_price) > 0
          )
      )
    ) {
      setError("Please enter a valid price for every cylinder type.");
      setLoading(false);
      return;
    }

    try {
      for (const priceInput of priceInputs) {
        await api.cylinderPrices.insert({
          cylinder_type_id: priceInput.cylinder_type_id,
          unit_price: parseFloat(priceInput.unit_price),
          effective_from: `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
        });
      }
      setSuccess(true);
      fetchPriceLog(selectedMonth, selectedYear);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      setError(apiError.message || "Failed to save prices");
    } finally {
      setLoading(false);
    }
  };

  const safePriceLog = priceLog ?? [];
  const safeCylinderTypes = cylinderTypes ?? [];

  return (
    <div className="flex justify-center items-start min-h-[70vh] py-10 bg-gray-50">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl border border-gray-100">
        {error && (
          <div className="text-red-600 text-center font-medium mb-2">{error}</div>
        )}
        <h2 className="text-3xl font-extrabold mb-6 text-center text-primary-700">Cylinder Prices <span className='text-base font-normal'>(Admin)</span></h2>
        <div className="flex gap-6 items-center justify-center mb-4">
          <label className="font-medium">Month:</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="border rounded px-2 py-1">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <label className="font-medium">Year:</label>
          <input type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="border rounded px-2 py-1 w-24" />
        </div>
        {pricesExist && (
          <div className="text-red-600 text-center font-medium mb-2">Prices already added for this month. No more changes are possible.</div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border-b px-4 py-2 text-left font-semibold text-gray-700">Cylinder Type</th>
                  <th className="border-b px-4 py-2 text-left font-semibold text-gray-700">Unit Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {safeCylinderTypes.map(type => (
                  <tr key={type.cylinder_type_id} className="hover:bg-gray-50">
                    <td className="border-b px-4 py-2">{type.name}</td>
                    <td className="border-b px-4 py-2">
                      <input
                        type="number"
                        value={priceInputs.find(p => p.cylinder_type_id === type.cylinder_type_id)?.unit_price || ""}
                        onChange={e => handlePriceChange(type.cylinder_type_id, e.target.value)}
                        min={0}
                        step={0.01}
                        required
                        className="border rounded px-2 py-1 w-32 focus:ring-2 focus:ring-primary-300"
                        disabled={pricesExist}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!pricesExist && (
            <button
              type="submit"
              className="mt-6 w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              disabled={loading}
            >
              Save Prices
            </button>
          )}
          {success && <div className="text-green-600 text-center font-medium">Prices saved successfully!</div>}
        </form>
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Price Log for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h3>
          {safePriceLog.length === 0 ? (
            <div className="text-gray-500 text-center">No prices entered for this month.</div>
          ) : (
            <table className="min-w-full border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-2 text-left">Cylinder Type</th>
                  <th className="border-b px-4 py-2 text-left">Unit Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {safePriceLog.map((p: any) => (
                  <tr key={p.cylinder_type_id}>
                    <td className="border-b px-4 py-2">{safeCylinderTypes.find(ct => ct.cylinder_type_id === p.cylinder_type_id)?.name || p.cylinder_type_id}</td>
                    <td className="border-b px-4 py-2">₹{Number(p.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
} 