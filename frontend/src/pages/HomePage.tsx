import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const benefits = [
  {
    title: 'Inventory Management',
    desc: 'Real-time stock tracking and automated replenishment.',
    icon: '📦',
    color: 'from-blue-100 to-blue-200',
  },
  {
    title: 'Smart Delivery',
    desc: 'Optimized route planning and driver management.',
    icon: '🚚',
    color: 'from-red-100 to-red-200',
  },
  {
    title: 'Financial Control',
    desc: 'Comprehensive billing and payment tracking.',
    icon: '💰',
    color: 'from-blue-100 to-blue-200',
  },
  {
    title: 'Analytics',
    desc: 'Business insights and performance metrics.',
    icon: '📊',
    color: 'from-red-100 to-red-200',
  },
  {
    title: 'Credit Control',
    desc: 'Automated credit checks and customer management.',
    icon: '🧾',
    color: 'from-blue-100 to-blue-200',
  },
  {
    title: 'Audit & Compliance',
    desc: 'Full audit logs and regulatory compliance.',
    icon: '🛡️',
    color: 'from-red-100 to-red-200',
  },
  {
    title: 'Mobile Access',
    desc: 'Works on any device, anywhere.',
    icon: '📱',
    color: 'from-blue-100 to-blue-200',
  },
  {
    title: 'Multi-role Security',
    desc: 'Admin, Inventory, Finance, and Driver roles.',
    icon: '🔐',
    color: 'from-red-100 to-red-200',
  },
];

const steps = [
  {
    icon: '📝',
    title: 'Sign Up',
    desc: 'Create your GasLink account and set up your business profile.'
  },
  {
    icon: '📦',
    title: 'Add Inventory',
    desc: 'Input your LPG cylinders, trucks, and customer data.'
  },
  {
    icon: '🚚',
    title: 'Manage Deliveries',
    desc: 'Assign drivers, track orders, and monitor deliveries in real time.'
  },
  {
    icon: '📊',
    title: 'Analyze & Grow',
    desc: 'View analytics, manage finances, and grow your business.'
  },
];

const HomePage: React.FC = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Hero Section */}
      <header className="relative flex flex-col items-center justify-center py-12 px-4 text-center overflow-hidden bg-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-[600px] h-[600px] bg-gradient-to-br from-blue-100 via-blue-200 to-red-100 rounded-full blur-3xl absolute -top-40 -left-40" />
          <div className="w-[400px] h-[400px] bg-gradient-to-tr from-red-100 via-blue-100 to-blue-200 rounded-full blur-2xl absolute top-20 right-0" />
        </div>
        <div className="z-10 flex flex-col items-center">
          <div className="mb-4">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-200 to-red-200 shadow-lg text-5xl">🔥</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-red-400 to-blue-600 bg-clip-text text-transparent drop-shadow-lg">Welcome to GasLink</h1>
          <p className="text-lg md:text-2xl text-gray-700 mb-6 font-medium drop-shadow">LPG Distribution Management, Reimagined.</p>
          <button
            className="mt-2 px-8 py-3 rounded-full bg-gradient-to-r from-blue-300 to-red-300 text-white font-bold text-lg shadow-lg hover:scale-105 transition-transform duration-200"
            onClick={() => document.getElementById('login-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* Login Form Section - now at the top, below hero */}
      <section className="flex flex-col items-center justify-start pt-4 pb-8 px-4" id="login-form">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-blue-100 animate-fade-in">
          <h2 className="text-xl font-bold mb-4 text-center text-gray-900">Login to GasLink</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              className="px-4 py-2 rounded bg-blue-50 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              type="password"
              className="px-4 py-2 rounded bg-red-50 border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-200 text-gray-900"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && <div className="text-red-500 text-sm text-center">{error}</div>}
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-300 to-red-300 px-4 py-2 rounded text-white font-semibold disabled:opacity-60 hover:scale-105 transition-transform duration-200"
              disabled={submitting || loading}
            >
              {submitting || loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <div className="text-center mt-4">
            <a href="#" className="text-blue-600 hover:underline text-sm">Forgot Password?</a>
          </div>
        </div>
      </section>

      {/* Benefits/Features Grid */}
      <section className="py-8 px-4 max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-gray-900">Why GasLink?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className={`rounded-2xl p-6 shadow-lg bg-gradient-to-br ${b.color} text-gray-900 flex flex-col items-center transform hover:scale-105 transition-transform duration-200 animate-fade-in`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-5xl mb-3 drop-shadow-lg">{b.icon}</div>
              <div className="font-bold text-lg mb-1 text-center">{b.title}</div>
              <div className="text-gray-700 text-sm text-center">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-8 px-4 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-gray-900">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center">
              <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-red-100 text-3xl mb-3 shadow-lg" style={{ animationDelay: `${i * 100}ms` }}>{step.icon}</div>
              <div className="font-bold text-lg mb-1 text-center">{step.title}</div>
              <div className="text-gray-700 text-sm text-center">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 py-8 text-gray-700 text-center text-sm border-t border-blue-100 bg-white">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-5xl mx-auto px-4 gap-4">
          <div className="mb-2 md:mb-0 flex items-center gap-2">
            <span className="font-bold text-gray-900 text-lg">GasLink</span>
            <span className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded-full ml-2">v1.0</span>
            <span className="ml-2">Professional LPG distribution management solution for modern businesses.</span>
          </div>
          <div className="mb-2 md:mb-0">
            <span className="font-bold text-gray-900">Features:</span> Inventory, Route Optimization, Customer, Finance, Analytics
          </div>
          <div className="flex gap-3 items-center">
            <a href="mailto:support@gaslink.com" className="hover:text-blue-600 transition-colors" title="Email"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 11-8 0 4 4 0 018 0zm0 0v1a4 4 0 01-8 0v-1m8 0V7a4 4 0 00-8 0v5" /></svg></a>
            <a href="#" className="hover:text-red-400 transition-colors" title="Twitter"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557a9.93 9.93 0 01-2.828.775 4.932 4.932 0 002.165-2.724c-.951.564-2.005.974-3.127 1.195a4.92 4.92 0 00-8.384 4.482C7.691 8.095 4.066 6.13 1.64 3.161c-.542.929-.856 2.01-.857 3.17 0 2.188 1.115 4.117 2.823 5.254A4.904 4.904 0 01.964 10.1v.062a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.084 4.936 4.936 0 004.604 3.419A9.867 9.867 0 010 21.543a13.94 13.94 0 007.548 2.209c9.057 0 14.009-7.496 14.009-13.986 0-.213-.005-.425-.014-.636A9.936 9.936 0 0024 4.557z" /></svg></a>
            <a href="#" className="hover:text-blue-600 transition-colors" title="LinkedIn"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 11.268h-3v-5.604c0-1.337-.025-3.063-1.868-3.063-1.868 0-2.154 1.459-2.154 2.967v5.7h-3v-10h2.881v1.367h.041c.401-.761 1.381-1.563 2.841-1.563 3.039 0 3.6 2.001 3.6 4.601v5.595z" /></svg></a>
          </div>
        </div>
        <div className="mt-4">© 2024 GasLink. All rights reserved.</div>
      </footer>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: none; }
        }
        .animate-fade-in {
          animation: fade-in 0.7s both;
        }
      `}</style>
    </div>
  );
};

export default HomePage; 