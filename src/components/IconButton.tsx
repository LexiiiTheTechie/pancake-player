import React from 'react';

interface IconButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  title?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  icon: Icon,
  className = "",
  active = false,
  disabled = false,
  size = 20,
  title = ""
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded-full transition-all duration-200 ease-out
      disabled:opacity-30 disabled:cursor-not-allowed
      ${active
        ? 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
        : 'text-gray-400 hover:text-white hover:bg-white/5'}
      ${className}
    `}
  >
    <Icon size={size} />
  </button>
);

export default IconButton;
