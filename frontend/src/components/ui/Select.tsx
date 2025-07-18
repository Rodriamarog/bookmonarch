import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'error' | 'success'
  selectSize?: 'sm' | 'md' | 'lg'
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', variant = 'default', selectSize = 'md', style, children, ...props }, ref) => {
    const baseClasses = 'w-full rounded-lg border-4 border-black transition-all duration-200 focus:outline-none font-bold appearance-none bg-white'
    
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
        // Bold black dropdown arrow
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23000000' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 1rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
        paddingRight: '3rem',
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
      <select
        className={`${baseClasses} ${sizeClasses[selectSize]} ${className}`}
        style={getVariantStyle()}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select }