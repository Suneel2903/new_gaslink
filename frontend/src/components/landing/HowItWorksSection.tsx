import React from 'react';
import { FaUsers, FaClipboardList, FaFileInvoice } from 'react-icons/fa';

const steps = [
  {
    icon: <FaUsers className="text-blue-600 text-3xl mb-2" />,
    title: 'Setup Your Team & Customers',
    desc: 'Onboard your admins, inventory staff, drivers, and customers',
  },
  {
    icon: <FaClipboardList className="text-green-600 text-3xl mb-2" />,
    title: 'Track Orders to Deliveries',
    desc: 'Place, assign, and fulfill with full audit trail',
  },
  {
    icon: <FaFileInvoice className="text-yellow-600 text-3xl mb-2" />,
    title: 'Automate Invoices & GST Filing',
    desc: 'Generate GST-compliant invoices instantly — synced to the portal',
  },
];

const HowItWorksSection: React.FC = () => (
  <section className="py-14 px-4 bg-white">
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">How It Works</h2>
      <div className="flex flex-col md:flex-row justify-between items-stretch gap-8">
        {steps.map((step, idx) => (
          <div
            key={step.title}
            className="flex-1 bg-gray-50 rounded-xl shadow p-6 flex flex-col items-center text-center group hover:shadow-lg transition-shadow"
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-100 mb-3">
              {step.icon}
            </div>
            <div className="text-2xl font-bold text-blue-700 mb-2">Step {idx + 1}</div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">{step.title}</h3>
            <p className="text-gray-600 text-sm">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection; 