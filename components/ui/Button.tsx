
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyles = "font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors duration-150";
  
  let variantStyles = '';
  switch (variant) {
    case 'primary':
      variantStyles = 'bg-red-600 lg:hover:bg-red-700 text-white focus:ring-red-500';
      break;
    case 'secondary':
      variantStyles = 'bg-gray-600 lg:hover:bg-gray-700 text-gray-100 focus:ring-gray-500';
      break;
    case 'danger':
      variantStyles = 'bg-red-700 lg:hover:bg-red-800 text-white focus:ring-red-600';
      break;
    case 'ghost':
      variantStyles = 'bg-transparent lg:hover:bg-gray-700 text-gray-300 focus:ring-gray-500 border border-gray-600';
      break;
  }

  let sizeStyles = '';
  switch (size) {
    case 'sm':
      sizeStyles = 'px-2.5 py-1.5 text-xs';
      break;
    case 'md':
      sizeStyles = 'px-4 py-2 text-sm';
      break;
    case 'lg':
      sizeStyles = 'px-6 py-3 text-base';
      break;
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
