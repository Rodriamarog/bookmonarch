import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', style, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'
    
    const sizeClasses = {
      sm: 'h-9 px-4 py-2 text-sm',
      md: 'h-11 px-6 py-3',
      lg: 'h-12 px-8 py-4 text-lg'
    }

    const getVariantStyle = () => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            boxShadow: '0 4px 8px rgba(217, 119, 6, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
            border: 'none'
          }
        case 'secondary':
          return {
            backgroundColor: '#F9FAFB',
            color: '#111827',
            border: '1px solid #D1D5DB',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
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