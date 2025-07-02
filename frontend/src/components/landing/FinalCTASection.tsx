import React from 'react';

const trustBadges = [
  { label: 'GST Filing Support', color: 'bg-blue-100 text-blue-800' },
  { label: 'Zero Cylinder Losses', color: 'bg-green-100 text-green-800' },
  { label: 'Made for Indian LPG Distributors', color: 'bg-yellow-100 text-yellow-800' },
];

const FinalCTASection: React.FC = () => (
  <section className="py-14 px-4 bg-white">
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
        Ready to eliminate manual workflows and lost revenue in your LPG business?
      </h2>
      <div className="flex flex-col md:flex-row gap-4 justify-center mb-6">
        <button className="rounded-full bg-blue-600 text-white px-8 py-3 font-semibold shadow-lg hover:scale-105 hover:bg-blue-700 transition-transform">Request Demo</button>
        <button className="rounded-full bg-white border border-blue-600 text-blue-600 px-8 py-3 font-semibold shadow hover:scale-105 hover:bg-blue-50 transition-transform">See How It Works</button>
        <button className="rounded-full bg-green-600 text-white px-8 py-3 font-semibold shadow-lg hover:scale-105 hover:bg-green-700 transition-transform">Contact Sales</button>
      </div>
      <div className="flex flex-wrap gap-3 justify-center mt-4">
        {trustBadges.map(badge => (
          <span key={badge.label} className={`rounded-full px-4 py-1 text-sm font-medium ${badge.color}`}>{badge.label}</span>
        ))}
      </div>
    </div>
  </section>
);

export default FinalCTASection; 