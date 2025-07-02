import React from 'react';
import { FaFileInvoice, FaBoxOpen, FaTruck, FaSearch, FaBrain, FaGlobeAsia } from 'react-icons/fa';

const features = [
  {
    icon: <FaFileInvoice className="text-blue-600 text-3xl mb-2" />,
    title: 'Automated Invoicing',
    desc: 'Instant GST-ready invoice generation post delivery',
  },
  {
    icon: <FaBoxOpen className="text-green-600 text-3xl mb-2" />,
    title: 'Inventory Control',
    desc: 'Manual adjustments, real-time stock tracking',
  },
  {
    icon: <FaTruck className="text-yellow-600 text-3xl mb-2" />,
    title: 'Order & Delivery Management',
    desc: 'Order lifecycle from booking to driver delivery',
  },
  {
    icon: <FaSearch className="text-purple-600 text-3xl mb-2" />,
    title: 'Accountability Logs',
    desc: 'Track lost/damaged cylinders with assigned responsibility',
  },
  {
    icon: <FaBrain className="text-pink-600 text-3xl mb-2" />,
    title: 'Tally Replacement',
    desc: 'Complete finance and reporting suite for distributors',
  },
  {
    icon: <FaGlobeAsia className="text-indigo-600 text-3xl mb-2" />,
    title: 'Global Access + GST Sync',
    desc: '24/7 access with real-time sync to Indian GST portal',
  },
];

const FeaturesSection: React.FC = () => (
  <section className="py-14 px-4 bg-gray-50">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center">Feature Highlights</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {features.map((f, idx) => (
          <div
            key={f.title}
            className="bg-white rounded-xl shadow hover:shadow-xl transition-shadow p-6 flex flex-col items-center text-center group cursor-pointer hover:scale-105"
          >
            {f.icon}
            <h3 className="text-lg font-bold text-gray-800 mb-1">{f.title}</h3>
            <p className="text-gray-600 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection; 