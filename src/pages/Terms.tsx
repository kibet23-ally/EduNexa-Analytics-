import React from 'react';

const Terms = () => {
  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Terms & Conditions
        </h1>

        <p className="text-gray-600 leading-8 mb-6">
          By using this platform, you agree to comply with
          our terms and conditions.
        </p>

        <p className="text-gray-600 leading-8 mb-6">
          Users are responsible for maintaining the confidentiality
          of their account credentials.
        </p>

        <p className="text-gray-600 leading-8">
          We reserve the right to modify or discontinue services
          at any time without prior notice.
        </p>
      </div>
    </div>
  );
};

export default Terms;