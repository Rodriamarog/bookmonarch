'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crown, User, Menu, X } from 'lucide-react'
import { Button } from './Button'
import { useAuthContext } from '@/contexts/AuthContext'

export function NavigationMenu() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, profile, loading, signOut } = useAuthContext()

  const handleSignOut = async () => {
    await signOut()
    setIsMobileMenuOpen(false)
  }

  const navigationItems = [
    { href: '/', label: 'Generate Book' },
    { href: '/books', label: 'Your Books', requiresAuth: true },
    { href: '/settings', label: 'Settings', requiresAuth: true, disabled: true }
  ]

  const visibleNavItems = navigationItems.filter(item => 
    !item.requiresAuth || (item.requiresAuth && user)
  )

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Crown className="h-6 w-6" style={{ color: "#D97706" }} />
            <span className="text-xl font-bold" style={{ color: "#111827" }}>
              BookMonarch
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  item.disabled 
                    ? 'text-gray-400 cursor-not-allowed'
                    : pathname === item.href
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-700 hover:text-orange-600'
                }`}
                onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              >
                {item.label}
                {item.disabled && (
                  <span className="ml-1 text-xs text-gray-400">(Soon)</span>
                )}
              </Link>
            ))}
          </nav>

          {/* Desktop User Info */}
          <div className="hidden md:flex items-center gap-4">
            {loading ? (
              <div className="text-sm" style={{ color: "#111827" }}>Loading...</div>
            ) : user ? (
              <>
                <div className="text-sm" style={{ color: "#4B5563" }}>
                  {profile?.subscription_status === 'free' ? (
                    <span>Free Plan • {profile?.books_generated_today || 0}/1 books today</span>
                  ) : (
                    <span>Pro Plan • {profile?.books_generated_today || 0}/10 books today</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" style={{ color: "#4B5563" }} />
                  <span className="text-sm" style={{ color: "#111827" }}>
                    {profile?.full_name || user.email}
                  </span>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/">
                <Button variant="secondary" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" style={{ color: "#111827" }} />
            ) : (
              <Menu className="h-5 w-5" style={{ color: "#111827" }} />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col gap-2">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${
                    item.disabled 
                      ? 'text-gray-400 cursor-not-allowed'
                      : pathname === item.href
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-700 hover:text-orange-600 hover:bg-gray-50'
                  }`}
                  onClick={item.disabled ? (e) => e.preventDefault() : () => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                  {item.disabled && (
                    <span className="ml-1 text-xs text-gray-400">(Soon)</span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Mobile User Info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {loading ? (
                <div className="text-sm px-3" style={{ color: "#111827" }}>Loading...</div>
              ) : user ? (
                <div className="space-y-3">
                  <div className="px-3">
                    <div className="text-sm" style={{ color: "#4B5563" }}>
                      {profile?.subscription_status === 'free' ? (
                        <span>Free Plan • {profile?.books_generated_today || 0}/1 books today</span>
                      ) : (
                        <span>Pro Plan • {profile?.books_generated_today || 0}/10 books today</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4" style={{ color: "#4B5563" }} />
                      <span className="text-sm" style={{ color: "#111827" }}>
                        {profile?.full_name || user.email}
                      </span>
                    </div>
                  </div>
                  <div className="px-3">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="w-full"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-3">
                  <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="secondary" size="sm" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}