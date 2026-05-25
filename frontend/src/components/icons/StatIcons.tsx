import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

export const ArrowUpIcon: React.FC<IconProps> = ({ size = 10, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ display: 'block' }}>
    <path d="M8 1 L15 13 H1 Z" />
  </svg>
);

export const ArrowDownIcon: React.FC<IconProps> = ({ size = 10, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ display: 'block' }}>
    <path d="M1 3 H15 L8 15 Z" />
  </svg>
);
