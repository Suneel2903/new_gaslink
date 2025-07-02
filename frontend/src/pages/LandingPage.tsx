import React from 'react';
import HeroSection from '../components/landing/HeroSection';
import ProblemSolutionSection from '../components/landing/ProblemSolutionSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import LandingFooter from '../components/landing/LandingFooter';

const LandingPage: React.FC = () => (
  <div className="bg-gray-50 min-h-screen">
    <HeroSection />
    <ProblemSolutionSection />
    <FeaturesSection />
    <HowItWorksSection />
    <TestimonialsSection />
    <FinalCTASection />
    <LandingFooter />
  </div>
);

export default LandingPage; 