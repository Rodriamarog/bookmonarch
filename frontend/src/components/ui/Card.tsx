import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', children, style, ...props }, ref) => {
    const baseClasses = 'rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-xl'
    
    const variantClasses = {
      default: 'bg-white border-4 border-black',
      elevated: 'bg-white border-4 border-black',
      outlined: 'bg-transparent border-4 border-black'
    }

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    }

    const getVariantStyle = () => {
      switch (variant) {
        case 'elevated':
          return {
            // Bold 3D shadow like Gittodoc
            boxShadow: '8px 8px 0px 0px rgba(0, 0, 0, 1)',
            background: 'linear-gradient(135deg, #FFEEDB 0%, #FFE4C4 100%)',
            transform: 'perspective(1000px) rotateX(1deg)',
            // Fix anti-aliasing issues
            outline: '1px solid transparent',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased',
            ...style
          }
        default:
          return {
            boxShadow: '4px 4px 0px 0px rgba(0, 0, 0, 1)',
            backgroundColor: '#FFFBF5',
            // Fix anti-aliasing issues
            outline: '1px solid transparent',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'antialiased',
            ...style
          }
      }
    }

    return (
      <div
        className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
        style={getVariantStyle()}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

// Card Header component
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        className={`flex flex-col space-y-1.5 pb-4 ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CardHeader.displayName = 'CardHeader'

// Card Title component
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <h3
        className={`text-2xl font-bold leading-none tracking-tight ${className}`}
        style={{ color: '#111827' }}
        ref={ref}
        {...props}
      >
        {children}
      </h3>
    )
  }
)
CardTitle.displayName = 'CardTitle'

// Card Description component
interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        className={`text-sm ${className}`}
        style={{ color: '#4B5563' }}
        ref={ref}
        {...props}
      >
        {children}
      </p>
    )
  }
)
CardDescription.displayName = 'CardDescription'

// Card Content component
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className={`pt-0 ${className}`} ref={ref} {...props}>
        {children}
      </div>
    )
  }
)
CardContent.displayName = 'CardContent'

// Card Footer component
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div className={`flex items-center pt-4 ${className}`} ref={ref} {...props}>
        {children}
      </div>
    )
  }
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }