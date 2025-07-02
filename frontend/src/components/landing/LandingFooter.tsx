import React from 'react';
import { FaWhatsapp, FaLinkedin } from 'react-icons/fa';

const LandingFooter: React.FC = () => (
  <footer className="bg-gray-900 text-gray-200 py-10 px-4 mt-8">
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
      <div>
        <h4 className="font-bold mb-2">About</h4>
        <ul className="space-y-1 text-sm">
          <li><a href="#" className="hover:underline">About Us</a></li>
          <li><a href="#" className="hover:underline">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4 className="font-bold mb-2">Legal</h4>
        <ul className="space-y-1 text-sm">
          <li><a href="#" className="hover:underline">Privacy</a></li>
          <li><a href="#" className="hover:underline">Terms</a></li>
        </ul>
      </div>
      <div>
        <h4 className="font-bold mb-2">Connect</h4>
        <ul className="space-y-1 text-sm flex flex-col">
          <li className="flex items-center gap-2"><FaWhatsapp className="text-green-400" /><a href="#" className="hover:underline">WhatsApp</a></li>
          <li className="flex items-center gap-2"><FaLinkedin className="text-blue-400" /><a href="#" className="hover:underline">LinkedIn</a></li>
        </ul>
      </div>
    </div>
    <div className="text-center text-xs text-gray-400 mt-8 opacity-80">&copy; {new Date().getFullYear()} GasLink. All rights reserved.</div>
  </footer>
);

export default LandingFooter; 