import React from 'react';

const Contact = () => {
  return (
    <div className="min-h-screen bg-white px-6 py-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Contact Us
        </h1>

        <p className="text-gray-600 text-lg mb-10">
          We'd love to hear from you. Reach out using the details below.
        </p>

        <div className="space-y-6">
          <div>
            <h2 className="font-semibold text-xl mb-2">Email</h2>
            <p className="text-gray-600">support@yoursaas.com</p>
          </div>

          <div>
            <h2 className="font-semibold text-xl mb-2">Phone</h2>
            <p className="text-gray-600">+254 700 000 000</p>
          </div>

          <div>
            <h2 className="font-semibold text-xl mb-2">Location</h2>
            <p className="text-gray-600">Nairobi, Kenya</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;