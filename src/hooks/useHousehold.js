import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyList, toLists } from '../lib/model.js'
import { STORAGE_KEY, loadItems, saveItems } from '../lib/storage.js'
import { seedItems } from '../lib/seed.js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js'
import {
  diffForPush,
  itemsToRows,
  mergeRemote,
  rowsToItems,
  sameItems,
  toSyncedMap,
} from '../lib/sync.js'

const PUSH_DEBOUNCE_MS = 400

// The single source of truth for household data.
//
// localStorage is written unconditionally, so the app is a complete product
// offline, signed out, on one device. When someone signs in, the same rows are
// mirrored to Supabase and merged three ways against what other devices did.
// UI components never learn which mode they are in: they only call patch().
export function useHousehold() {
  const [items, setItems] = useState(() => loadItems() ?? seedItems())
  const [session, setSession] = useState(null)
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [role, setRole] = useState(null)
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'local')
  const [error, setError] = useState(null)
  const [supabase, setSupabase] = useState(null)

  // The client library is fetched only when this build has a backend.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let alive = true
    getSupabase().then((client) => {
      if (alive) setSupabase(client)
    })
    return () => {
      alive = false
    }
  }, [])

  const skipNextWrite = useRef(false)
  const syncedRef = useRef(new Map())
  const itemsRef = useRef(items)
  const readyRef = useRef(false)

  itemsRef.current = items

  // --- local persistence -------------------------------------------------

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false
      return
    }
    saveItems(items)
  }, [items])

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return
      const incoming = loadItems()
      if (!incoming) return
      skipNextWrite.current = true
      setItems(incoming)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const lists = useMemo(() => toLists(items), [items])

  const patch = useCallback((listName, updateFn) => {
    setItems((current) => {
      const rows = toLists(current)[listName]
      if (!rows) throw new Error(`Unknown list: ${listName}`)
      const next = updateFn(rows)
      if (!Array.isArray(next)) throw new Error(`patch('${listName}') must return an array`)
      return applyList(current, listName, next).items
    })
  }, [])

  // --- auth --------------------------------------------------------------

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session ?? null)
      if (!data.session) setStatus('signed-out')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null)
      if (!next) {
        // Signing out drops the mirror, not the data: the device keeps its
        // own copy and carries on working.
        syncedRef.current = new Map()
        readyRef.current = false
        setHousehold(null)
        setMembers([])
        setRole(null)
        setStatus('signed-out')
      }
    })

    return () => {
      alive = false
      subscription?.subscription?.unsubscribe()
    }
  }, [supabase])

  // --- which household am I in? -----------------------------------------

  const loadMembership = useCallback(async (userId) => {
    if (!supabase || !userId) return
    setError(null)
    const { data: memberships, error: membersError } = await supabase
      .from('members')
      .select('household_id, role')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)

    if (membersError) {
      setError(membersError.message)
      setStatus('error')
      return
    }
    if (!memberships || memberships.length === 0) {
      setHousehold(null)
      setMembers([])
      setRole(null)
      setStatus('no-household')
      return
    }

    const { data: households, error: householdError } = await supabase
      .from('households')
      .select('*')
      .eq('id', memberships[0].household_id)
      .limit(1)

    if (householdError) {
      setError(householdError.message)
      setStatus('error')
      return
    }
    setRole(memberships[0].role)
    setHousehold(households?.[0] ?? null)
  }, [supabase])

  // Who is in the household. Emails live in auth.users, which clients cannot
  // read, so this is seats and roles — enough to show what the plan covers
  // without handing every member everyone else's address.
  const loadMembers = useCallback(async (householdId) => {
    if (!supabase || !householdId) return
    const { data } = await supabase
      .from('members')
      .select('user_id, role, joined_at')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true })
    setMembers(data ?? [])
  }, [supabase])

  useEffect(() => {
    if (!supabase || !household?.id) return
    loadMembers(household.id)
  }, [supabase, household?.id, loadMembers])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return
    setStatus('loading')
    loadMembership(session.user.id)
  }, [supabase, session, loadMembership])

  // --- pull + merge ------------------------------------------------------

  const pull = useCallback(async (householdId) => {
    if (!supabase || !householdId) return
    const { data, error: fetchError } = await supabase
      .from('items')
      .select('id, kind, data, updated_at')
      .eq('household_id', householdId)

    if (fetchError) {
      setError(fetchError.message)
      setStatus('error')
      return
    }

    const remote = rowsToItems(data ?? [])
    const merged = mergeRemote(itemsRef.current, remote, syncedRef.current)
    // What we now believe the server holds. Rows we are about to push are
    // deliberately absent, so the next push still sees them as changed.
    syncedRef.current = toSyncedMap(remote.filter((item) => merged.some((m) => m.id === item.id)))
    readyRef.current = true
    if (!sameItems(itemsRef.current, merged)) {
      itemsRef.current = merged
      setItems(merged)
    }
    setStatus('synced')
  }, [supabase])

  useEffect(() => {
    if (!supabase || !household?.id) return
    // First pull after sign-in unions the device's existing list with the
    // household's — signing in keeps your data, it never starts you empty.
    pull(household.id)
  }, [supabase, household?.id, pull])

  // --- push --------------------------------------------------------------

  useEffect(() => {
    if (!supabase || !household?.id || !readyRef.current) return undefined

    const timer = setTimeout(async () => {
      const { upserts, deletes } = diffForPush(items, syncedRef.current)
      if (upserts.length === 0 && deletes.length === 0) return

      try {
        if (upserts.length > 0) {
          const { error: upsertError } = await supabase
            .from('items')
            .upsert(itemsToRows(upserts, household.id), { onConflict: 'household_id,id' })
          if (upsertError) throw upsertError
        }
        if (deletes.length > 0) {
          const { error: deleteError } = await supabase
            .from('items')
            .delete()
            .eq('household_id', household.id)
            .in('id', deletes)
          if (deleteError) throw deleteError
        }
        syncedRef.current = toSyncedMap(items)
        setError(null)
        setStatus('synced')
      } catch (pushError) {
        // The local copy is still correct and still saved; the diff will be
        // retried on the next edit or the next realtime nudge.
        setError(pushError.message ?? String(pushError))
        setStatus('error')
      }
    }, PUSH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [supabase, items, household?.id])

  // --- realtime ----------------------------------------------------------

  useEffect(() => {
    if (!supabase || !household?.id) return undefined
    const channel = supabase
      .channel(`items:${household.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `household_id=eq.${household.id}`,
        },
        () => pull(household.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, household?.id, pull])

  // --- account actions ---------------------------------------------------

  const signIn = useCallback(async (email) => {
    const client = await getSupabase()
    if (!client) throw new Error('Sign-in is not configured for this build.')
    const { error: signInError } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (signInError) throw signInError
  }, [])

  const signOut = useCallback(async () => {
    const client = await getSupabase()
    if (client) await client.auth.signOut()
  }, [])

  const renameHousehold = useCallback(
    async (name) => {
      if (!supabase || !household?.id) return
      const trimmed = name.trim()
      if (!trimmed || trimmed === household.name) return
      const { data, error: renameError } = await supabase
        .from('households')
        .update({ name: trimmed })
        .eq('id', household.id)
        .select()
        .limit(1)
      if (renameError) throw renameError
      if (data?.[0]) setHousehold(data[0])
    },
    [supabase, household?.id, household?.name]
  )

  const leaveHousehold = useCallback(async () => {
    if (!supabase || !session?.user?.id || !household?.id) return
    const { error: leaveError } = await supabase
      .from('members')
      .delete()
      .eq('household_id', household.id)
      .eq('user_id', session.user.id)
    if (leaveError) throw leaveError
    syncedRef.current = new Map()
    readyRef.current = false
    setHousehold(null)
    setMembers([])
    setRole(null)
    setStatus('no-household')
  }, [supabase, session?.user?.id, household?.id])

  const createHousehold = useCallback(
    async (name) => {
      const client = await getSupabase()
      if (!client) throw new Error('Sign-in is not configured for this build.')
      const { data, error: rpcError } = await client.rpc('create_household', { name })
      if (rpcError) throw rpcError
      setRole('owner')
      setHousehold(data)
      return data
    },
    []
  )

  const joinHousehold = useCallback(async (inviteCode) => {
    const client = await getSupabase()
    if (!client) throw new Error('Sign-in is not configured for this build.')
    const { data, error: rpcError } = await client.rpc('join_household', {
      invite_code: inviteCode,
    })
    if (rpcError) throw rpcError
    setRole('member')
    setHousehold(data)
    return data
  }, [])

  const account = {
    configured: isSupabaseConfigured,
    session,
    household,
    members,
    role,
    status,
    error,
    isPro: household?.plan === 'pro',
    signIn,
    signOut,
    createHousehold,
    joinHousehold,
    renameHousehold,
    leaveHousehold,
    refresh: () => household?.id && pull(household.id),
  }

  return { items, lists, patch, account }
}
