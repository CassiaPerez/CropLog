import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <img
      src="/assets/images/gcf_logo_05.png"
      alt="GCF Logística"
      className={className}
    />
  );
};