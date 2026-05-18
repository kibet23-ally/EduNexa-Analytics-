import React from 'react';

const Pricing = () => {
  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Pricing
        </h1>

        <p className="text-gray-600 text-lg mb-12">
          Affordable pricing plans built for schools of all sizes.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="border rounded-2xl p-8 shadow">
            <h2 className="text-2xl font-semibold mb-4">Starter</h2>
            <p className="text-4xl font-bold mb-4">KES 2,999</p>
            <p className="text-gray-600">
              Ideal for small schools getting started.
            </p>
          </div>

          <div className="border rounded-2xl p-8 shadow">
            <h2 className="text-2xl font-semibold mb-4">Professional</h2>
            <p className="text-4xl font-bold mb-4">KES 7,999</p>
            <p className="text-gray-600">
              Advanced tools for growing institutions.
            </p>
          </div>

          <div className="border rounded-2xl p-8 shadow">
            <h2 className="text-2xl font-semibold mb-4">Enterprise</h2>
            <p className="text-4xl font-bold mb-4">Custom</p>
            <p className="text-gray-600">
              Tailored solutions for large organizations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;