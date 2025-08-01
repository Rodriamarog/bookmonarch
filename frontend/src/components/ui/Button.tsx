import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', style, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-bold transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 border-4 border-black active:translate-x-1 active:translate-y-1 active:shadow-none hover:brightness-110 hover:opacity-90'
    
    const sizeClasses = {
      sm: 'px-5 py-3 text-sm',
      md: 'px-7 py-4 text-base',
      lg: 'px-9 py-5 text-lg'
    }

    const getVariantStyle = () => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            boxShadow: '6px 6px 0px 0px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
            borderColor: '#000000',
            fontWeight: '700',
            // Fix anti-aliasing issues
            outline: '1px solid transparent',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased'
          }
        case 'secondary':
          return {
            backgroundColor: '#F9FAFB',
            color: '#111827',
            borderColor: '#000000',
            boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
            fontWeight: '600',
            // Fix anti-aliasing issues
            outline: '1px solid transparent',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased'
          }
        default:
          return {}
      }
    }

    return (
      <button
        className={`${baseClasses} ${sizeClasses[size]} ${className}`}
        style={{ ...getVariantStyle(), ...style }}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }