import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CACHE_KEY = 'am_feature_flags'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useFeatureFlags() {
  const [flags, setFlags] = useState(() => {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL) return data
    }
    return {}
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFlags() {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('flag_key, enabled, allowed_users')

      if (!error && data) {
        const flagMap = {}
        data.forEach(f => { flagMap[f.flag_key] = f })
        setFlags(flagMap)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: flagMap, timestamp: Date.now() }))
      }
      setLoading(false)
    }
    fetchFlags()
  }, [])

  const isEnabled = (key, userEmail) => {
    const flag = flags[key]
    if (!flag || !flag.enabled) return false
    if (flag.allowed_users?.length > 0) {
      return flag.allowed_users.includes(userEmail)
    }
    return true
  }

  return { flags, isEnabled, loading }
}
