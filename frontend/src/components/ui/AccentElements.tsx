import { cn } from '@/lib/utils'

interface AccentStarProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function AccentStar({ className, size = 'md' }: AccentStarProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <svg
      className={cn('accent-star', sizeClasses[size], className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

interface AccentDiamondProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function AccentDiamond({ className, size = 'md' }: AccentDiamondProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  }

  return (
    <svg
      className={cn('accent-diamond', sizeClasses[size], className)}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l4.5 4.5L12 11 7.5 6.5 12 2zm0 20l-4.5-4.5L12 13l4.5 4.5L12 22z" />
    </svg>
  )
}