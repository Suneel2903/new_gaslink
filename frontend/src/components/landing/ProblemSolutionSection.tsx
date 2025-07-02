import React from 'react';
import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';

const problems = [
  {
    problem: 'Inventory mismatch, lost stock',
    solution: 'Cylinder-level traceability',
  },
  {
    problem: 'Manual billing & late payments',
    solution: 'Auto-invoicing & real-time GST sync',
  },
  {
    problem: 'Tally not built for LPG flow',
    solution: 'Purpose-built LPG SaaS',
  },
  {
    problem: 'Disconnected teams',
    solution: 'One-stop platform with full audit trails',
  },
];

const ProblemSolutionSection: React.FC = () => (
  <section className="py-12 px-4 bg-white">
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">Problem → Solution Snapshot</h2>
      <div className="relative border-l-4 border-blue-100 pl-8">
        {problems.map((item, idx) => (
          <div key={idx} className="mb-10 last:mb-0 flex items-start">
            <div className="absolute -left-6 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mb-2">
                <FaExclamationCircle className="text-red-500 text-xl" />
              </div>
              <div className="h-8 border-l-2 border-blue-200" style={{ visibility: idx === problems.length - 1 ? 'hidden' : 'visible' }}></div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mt-2">
                <FaCheckCircle className="text-green-600 text-xl" />
              </div>
            </div>
            <div className="flex-1 ml-4">
              <div className="text-lg font-semibold text-red-700 mb-1">{item.problem}</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400 text-2xl">→</span>
                <span className="text-lg font-semibold text-green-700">{item.solution}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ProblemSolutionSection; 