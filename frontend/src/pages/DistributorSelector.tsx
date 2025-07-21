import { useState, useEffect } from "react";
import axios from "../services/apiClient";

const DistributorSelector = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    axios.get("/distributors/all").then((res) => setDistributors(res.data));
  }, []);

  return (
    <div className="flex flex-col gap-2 p-4">
      <h2 className="text-lg font-bold">Select a Distributor</h2>
      <select
        className="border rounded p-2"
        onChange={(e) => onSelect(e.target.value)}
        defaultValue=""
      >
        <option disabled value="">-- Choose Distributor --</option>
        {distributors.map((dist: any) => (
          <option key={dist.id} value={dist.id}>
            {dist.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DistributorSelector; 