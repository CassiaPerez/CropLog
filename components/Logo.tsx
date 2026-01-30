import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  // Using direct path reference relative to the public root/index.html
  // Browsers running native modules cannot import non-JS files directly.
  return (
    <img 
      src="assets/images/logo.svg" 
      alt="GCF Logística" 
      className={`object-contain ${className}`} 
    />
  );
};