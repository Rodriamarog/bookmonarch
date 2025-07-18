interface AccentElementProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'coral' | 'mint' | 'red' | 'green'
  animated?: boolean
}

// Sparkle/Star component
export function AccentStar({ className = '', size = 'md', color = 'coral', animated = false }: AccentElementProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  }

  const colorStyles = {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    red: '#FF3D57',
    green: '#00D59B'
  }

  const animationClass = animated ? 'animate-pulse' : ''

  return (
    <svg
      className={`${sizeClasses[size]} ${animationClass} ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: colorStyles[color] }}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

// Diamond component
export function AccentDiamond({ className = '', size = 'md', color = 'mint', animated = false }: AccentElementProps) {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  }

  const colorStyles = {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    red: '#FF3D57',
    green: '#00D59B'
  }

  const animationClass = animated ? 'animate-bounce' : ''

  return (
    <svg
      className={`${sizeClasses[size]} ${animationClass} ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: colorStyles[color] }}
    >
      <path d="M12 2l4.5 4.5L12 11 7.5 6.5 12 2zm0 20l-4.5-4.5L12 13l4.5 4.5L12 22z" />
    </svg>
  )
}

// Circle/Dot component
export function AccentCircle({ className = '', size = 'md', color = 'coral', animated = false }: AccentElementProps) {
  const sizeClasses = {
    xs: 'w-1 h-1',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-6 h-6'
  }

  const colorStyles = {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    red: '#FF3D57',
    green: '#00D59B'
  }

  const animationClass = animated ? 'animate-ping' : ''

  return (
    <div
      className={`${sizeClasses[size]} ${animationClass} rounded-full ${className}`}
      style={{ backgroundColor: colorStyles[color] }}
    />
  )
}

// Triangle component
export function AccentTriangle({ className = '', size = 'md', color = 'mint', animated = false }: AccentElementProps) {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  }

  const colorStyles = {
    coral: '#FF6B6B',
    mint: '#4ECDC4',
    red: '#FF3D57',
    green: '#00D59B'
  }

  const animationClass = animated ? 'animate-spin' : ''

  return (
    <svg
      className={`${sizeClasses[size]} ${animationClass} ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ color: colorStyles[color] }}
    >
      <path d="M12 2l10 18H2L12 2z" />
    </svg>
  )
}

// Decorative scatter component for backgrounds
interface AccentScatterProps {
  className?: string
  density?: 'low' | 'medium' | 'high'
}

export function AccentScatter({ className = '', density = 'medium' }: AccentScatterProps) {
  const elements = {
    low: 3,
    medium: 6,
    high: 10
  }

  const count = elements[density]
  const shapes = ['star', 'diamond', 'circle', 'triangle']
  const colors: Array<'coral' | 'mint' | 'red' | 'green'> = ['coral', 'mint', 'red', 'green']
  const sizes: Array<'xs' | 'sm' | 'md'> = ['xs', 'sm', 'md']

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {Array.from({ length: count }).map((_, i) => {
        const shape = shapes[Math.floor(Math.random() * shapes.length)]
        const color = colors[Math.floor(Math.random() * colors.length)]
        const size = sizes[Math.floor(Math.random() * sizes.length)]
        const top = Math.random() * 100
        const left = Math.random() * 100
        const opacity = 0.3 + Math.random() * 0.4

        const style = {
          position: 'absolute' as const,
          top: `${top}%`,
          left: `${left}%`,
          opacity,
        }

        switch (shape) {
          case 'star':
            return <AccentStar key={i} size={size} color={color} className="absolute" style={style} />
          case 'diamond':
            return <AccentDiamond key={i} size={size} color={color} className="absolute" style={style} />
          case 'circle':
            return <AccentCircle key={i} size={size} color={color} className="absolute" style={style} />
          case 'triangle':
            return <AccentTriangle key={i} size={size} color={color} className="absolute" style={style} />
          default:
            return null
        }
      })}
    </div>
  )
}