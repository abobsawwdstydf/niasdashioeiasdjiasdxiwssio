import { memo } from 'react';
import { getInitials, generateAvatarColor } from '../lib/utils';
import { Check } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
} as const;

const onlineDotSize = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
} as const;

const verifiedBadgeSize = {
  xs: 'w-3 h-3 -bottom-0.5 -right-0.5',
  sm: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  md: 'w-4 h-4 -bottom-0.5 -right-0.5',
  lg: 'w-5 h-5 -bottom-0.5 -right-0.5',
  xl: 'w-6 h-6 -bottom-0.5 -right-0.5',
} as const;

function AvatarInner({ src, name, size = 'md', className = '', online, isVerified, verifiedBadgeUrl, verifiedBadgeType }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const initials = getInitials(name || '?');
  const gradientClass = generateAvatarColor(name || '');

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className="relative inline-block">
        {src ? (
          <img
            src={src}
            alt={name}
            className={`${sizeClass} rounded-full object-cover select-none pointer-events-none`}
            draggable={false}
          />
        ) : (
          <div
            className={`${sizeClass} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-medium select-none`}
          >
            {initials}
          </div>
        )}
        {/* Verified Badge */}
        {isVerified && (
          <div className={`absolute ${verifiedBadgeSize[size]} rounded-full bg-blue-500 flex items-center justify-center shadow-lg`} style={{ zIndex: 10 }}>
            {verifiedBadgeUrl && verifiedBadgeType !== 'default' ? (
              <img src={verifiedBadgeUrl} alt="verified" className="w-full h-full rounded-full object-cover" />
            ) : (
              <Check size={size === 'xs' ? 8 : size === 'sm' ? 10 : size === 'md' ? 12 : size === 'lg' ? 14 : 16} className="text-white" strokeWidth={3} />
            )}
          </div>
        )}
      </div>
      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 ${onlineDotSize[size]} rounded-full border-surface ${
            online ? 'bg-emerald-500' : 'bg-zinc-500'
          }`}
          style={isVerified ? { zIndex: 11 } : {}}
        />
      )}
    </div>
  );
}

const Avatar = memo(AvatarInner);
export default Avatar;
