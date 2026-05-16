import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ensureUserProfile } from '../lib/firestore'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        await ensureUserProfile(u.uid, u.email ?? '', u.displayName ?? 'User')
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading, isAuthenticated: !!user }
}
