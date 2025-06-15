
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  let sizeClasses = '';
  switch (size) {
    case 'sm': sizeClasses = 'max-w-sm'; break;
    case 'md': sizeClasses = 'max-w-md'; break;
    case 'lg': sizeClasses = 'max-w-lg'; break;
    case 'xl': sizeClasses = 'max-w-xl'; break;
    case 'full': sizeClasses = 'max-w-full h-full'; break;
    default: sizeClasses = 'max-w-md';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 ${sizeClasses} w-full text-gray-200 transform transition-all`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold diablo-red text-shadow-sm-dark">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="모달 닫기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
         {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
