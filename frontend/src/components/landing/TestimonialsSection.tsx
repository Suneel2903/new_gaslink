import React from 'react';
import { FaQuoteLeft } from 'react-icons/fa';

const TestimonialsSection: React.FC = () => (
  <section className="py-14 px-4 bg-gray-50">
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">What Our Clients Say</h2>
      <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <FaQuoteLeft className="text-blue-400 text-3xl mb-4" />
        <p className="text-lg text-gray-700 mb-4 italic">
          “GasLink helped us cut our monthly manual work by 50%. No more disputes, no lost cylinders.”
        </p>
        <div className="font-semibold text-blue-700">— Sri Durga Gas Distributors (Beta Client)</div>
      </div>
    </div>
  </section>
);

export default TestimonialsSection; 