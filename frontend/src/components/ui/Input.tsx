import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'success'
  inputSize?: 'sm' | 'md' | 'lg'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', variant = 'default', inputSize = 'md', style, ...props }, ref) => {
    const baseClasses = 'w-full rounded-lg border-4 border-black transition-all duration-200 focus:outline-none font-bold'
    
    const sizeClasses = {
      sm: 'px-4 py-3 text-sm',
      md: 'px-5 py-4 text-base',
      lg: 'px-6 py-5 text-lg'
    }

    const getVariantStyle = () => {
      const baseStyle = {
        backgroundColor: '#FFFFFF',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
        fontWeight: '600',
        // Fix anti-aliasing issues
        outline: '1px solid transparent',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        ...style
      }

      switch (variant) {
        case 'error':
          return {
            ...baseStyle,
            borderColor: '#DC2626',
            boxShadow: '4px 4px 0px 0px rgba(220, 38, 38, 1)',
          }
        case 'success':
          return {
            ...baseStyle,
            borderColor: '#16A34A',
            boxShadow: '4px 4px 0px 0px rgba(22, 163, 74, 1)',
          }
        default:
          return {
            ...baseStyle,
            borderColor: '#000000',
            boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
          }
      }
    }

    return (
      <input
        className={`${baseClasses} ${sizeClasses[inputSize]} ${className}`}
        style={getVariantStyle()}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }