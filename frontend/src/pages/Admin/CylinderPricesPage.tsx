import React, { useEffect, useState } from "react";
import apiClient, { api } from "../../services/apiClient";

const months = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];
const currentYear = new Date().getFullYear();

export default function CylinderPricesPage() {
  const [cylinderTypes, setCylinderTypes] = useState<any[]>([]);
  const [priceInputs, setPriceInputs] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [priceLog, setPriceLog] = useState<any[]>([]);
  const [pricesExist, setPricesExist] = useState(false);

  useEffect(() => {
    api.cylinderTypes.getAll().then(res => setCylinderTypes(res.data));
    fetchPriceLog(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  const fetchPriceLog = async (month: number, year: number) => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await api.cylinderPrices.getByMonthYear(month, year);
      setPriceLog(res.data);
      setPricesExist(res.data && res.data.length > 0);
      if (res.data && res.data.length > 0) {
        setPriceInputs(res.data.map((p: any) => ({ cylinder_type_id: p.cylinder_type_id, unit_price: p.unit_price })));
      } else {
        setPriceInputs([]);
      }
    } catch (err: any) {
      setError("Failed to fetch price log");
      setPriceLog([]);
      setPricesExist(false);
    } finally {
      setLoading(false);
    }
  };

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

    // Ensure all cylinder types have a valid price
    if (
      cylinderTypes.some(
        type =>
          !priceInputs.find(
            p =>
              p.cylinder_type_id === type.cylinder_type_id &&
              p.unit_price !== "" &&
              !isNaN(Number(p.unit_price)) &&
              Number(p.unit_price) > 0 // Optionally require > 0
          )
      )
    ) {
      setError("Please enter a valid price for every cylinder type.");
      setLoading(false);
      return;
    }

    try {
      await api.cylinderPrices.insert({
        month: selectedMonth,
        year: selectedYear,
        prices: priceInputs.map(p => ({
          cylinder_type_id: p.cylinder_type_id,
          unit_price: parseFloat(p.unit_price)
        }))
      });
      setSuccess(true);
      fetchPriceLog(selectedMonth, selectedYear);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save prices");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start min-h-[70vh] py-10 bg-gray-50">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl border border-gray-100">
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
                {cylinderTypes.map(type => (
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
          <div className="flex justify-center">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg shadow transition-all duration-150 font-semibold text-lg" disabled={loading || pricesExist}>
              {loading ? "Saving..." : "Save Prices"}
            </button>
          </div>
          {success && <div className="text-green-600 text-center font-medium">Prices saved successfully!</div>}
          {error && <div className="text-red-600 text-center font-medium">{error}</div>}
        </form>
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Price Log for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h3>
          {priceLog.length === 0 ? (
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
                {priceLog.map((p: any) => (
                  <tr key={p.cylinder_type_id}>
                    <td className="border-b px-4 py-2">{cylinderTypes.find(ct => ct.cylinder_type_id === p.cylinder_type_id)?.name || p.cylinder_type_id}</td>
                    <td className="border-b px-4 py-2">₹{p.unit_price}</td>
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