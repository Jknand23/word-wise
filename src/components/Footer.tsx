import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            <div className="text-lg font-bold gradient-text">
              WordWise AI
            </div>
            <span className="text-sm text-gray-500">
              Intelligent writing assistance
            </span>
          </div>
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <a href="#" className="hover:text-gray-900 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">
              Support
            </a>
            <span className="text-gray-400">
              © 2024 WordWise AI
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 