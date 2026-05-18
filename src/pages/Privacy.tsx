import React from 'react';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Privacy Policy
        </h1>

        <p className="text-gray-600 leading-8 mb-6">
          We value your privacy and are committed to protecting
          your personal information.
        </p>

        <p className="text-gray-600 leading-8 mb-6">
          Information collected through our platform is used solely
          for providing and improving our services.
        </p>

        <p className="text-gray-600 leading-8">
          We do not sell or share user data with unauthorized third parties.
        </p>
      </div>
    </div>
  );
};

export default Privacy;