import React from 'react';
import { Link } from 'react-router-dom';

const HeroSection: React.FC = () => (
  <section className="relative flex flex-col items-center justify-center text-center py-16 px-4 bg-gradient-to-br from-blue-50 to-white">
    {/* Login button top right */}
    <div className="absolute top-6 right-6">
      <Link to="/login">
        <button className="rounded-full bg-white border border-blue-600 text-blue-600 px-6 py-2 font-semibold shadow hover:scale-105 hover:bg-blue-50 transition-transform">
          Login
        </button>
      </Link>
    </div>
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
        Smart LPG Distribution. <span className="text-blue-600">GST-Ready.</span> Workforce-Light.
      </h1>
      <p className="text-lg md:text-xl text-gray-700 mb-6">
        Track every order, invoice, and cylinder — from anywhere in the world.
      </p>
      <div className="flex flex-col md:flex-row gap-4 justify-center mb-6">
        <button className="rounded-full bg-blue-600 text-white px-8 py-3 font-semibold shadow-lg hover:scale-105 hover:bg-blue-700 transition-transform">Request Demo</button>
        <button className="rounded-full bg-white border border-blue-600 text-blue-600 px-8 py-3 font-semibold shadow hover:scale-105 hover:bg-blue-50 transition-transform">Explore Features</button>
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-center text-sm text-gray-600 mb-8">
        <span className="bg-green-100 text-green-800 rounded-full px-4 py-1">Up to 40–50% reduction in workforce with GasLink automation</span>
        <span className="bg-yellow-100 text-yellow-800 rounded-full px-4 py-1">No more lost cylinders — every movement is tracked</span>
        <span className="bg-purple-100 text-purple-800 rounded-full px-4 py-1">Replaces Tally for LPG distributors</span>
      </div>
    </div>
  </section>
);

export default HeroSection; 