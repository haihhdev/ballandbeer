'use client'

import { useEffect } from 'react'

export default function UserFetcher() {
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        console.log('Users from MongoDB:', data)
      } catch (err) {
        console.error('Error fetching users:', err)
      }
    }

    fetchUsers()
  }, [])

  return null // Không render gì lên UI, chỉ log ra console
}
