import React from 'react';

const Features = () => {
  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Features
        </h1>

        <p className="text-gray-600 text-lg mb-12">
          Powerful tools designed to simplify school management,
          communication, analytics, and payments.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 rounded-2xl shadow border">
            <h2 className="text-2xl font-semibold mb-3">
              Student Management
            </h2>
            <p className="text-gray-600">
              Easily manage student records, admissions,
              attendance, and academic progress.
            </p>
          </div>

          <div className="p-6 rounded-2xl shadow border">
            <h2 className="text-2xl font-semibold mb-3">
              Fee Collection
            </h2>
            <p className="text-gray-600">
              Automate fee payments with M-Pesa integration
              and real-time payment tracking.
            </p>
          </div>

          <div className="p-6 rounded-2xl shadow border">
            <h2 className="text-2xl font-semibold mb-3">
              Analytics Dashboard
            </h2>
            <p className="text-gray-600">
              Get insights into school performance,
              finances, and student statistics.
            </p>
          </div>

          <div className="p-6 rounded-2xl shadow border">
            <h2 className="text-2xl font-semibold mb-3">
              Secure Access
            </h2>
            <p className="text-gray-600">
              Role-based authentication and protected
              access for administrators, teachers, and parents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;