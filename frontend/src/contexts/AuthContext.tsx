'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[AuthContext] Initial session:', session)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] onAuthStateChange event:`, event, session)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    console.log('[AuthContext] signInWithEmail called', { email })
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      console.error('[AuthContext] signInWithEmail error:', error)
      throw error
    }
    console.log('[AuthContext] signInWithEmail success:', data)
  }

  const signUpWithEmail = async (email: string, password: string) => {
    console.log('[AuthContext] signUpWithEmail called', { email })
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) {
      console.error('[AuthContext] signUpWithEmail error:', error)
      throw error
    }
    console.log('[AuthContext] signUpWithEmail success:', data)
  }

  const signInWithGoogle = async () => {
    console.log('[AuthContext] signInWithGoogle called')
    const { error, data } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      // No redirectTo option here; use Supabase dashboard setting
    })
    if (error) {
      console.error('[AuthContext] signInWithGoogle error:', error)
      throw error
    }
    console.log('[AuthContext] signInWithGoogle success:', data)
    if (data?.url) {
      window.location.href = data.url
    }
  }

  const signOut = async () => {
    console.log('[AuthContext] signOut called')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[AuthContext] signOut error:', error)
      throw error
    }
    setUser(null)
    setSession(null)
    console.log('[AuthContext] signOut success, user and session cleared')
    window.location.href = '/'
  }

  const value = {
    user,
    session,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 