import { LabelHTMLAttributes, forwardRef } from 'react'

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', required = false, children, ...props }, ref) => {
    return (
      <label
        className={`block text-base font-bold mb-3 ${className}`}
        style={{ color: '#000000' }}
        ref={ref}
        {...props}
      >
        {children}
        {required && <span className="text-red-600 ml-1 font-black">*</span>}
      </label>
    )
  }
)
Label.displayName = 'Label'

export { Label }