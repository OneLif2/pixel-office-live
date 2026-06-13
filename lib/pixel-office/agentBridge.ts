import { OfficeState } from './engine/officeState'
import type { FloorColor } from './types'

/** User-chosen appearance for an agent, persisted per OpenClaw agent id. */
export interface AgentAppearance {
  skin?: number
  color?: FloorColor | null
}

export interface SubagentInfo {
  toolId: string
  label: string
  sessionKey?: string
  childSessionKey?: string
  activityEvents?: Array<{ key: string; text: string; at: number }>
}

export interface AgentActivity {
  agentId: string
  name: string
  emoji: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTool?: string
  toolStatus?: string
  lastActive: number
  subagents?: SubagentInfo[]
  lastTask?: string
}

/** Track which subagent keys were active last sync, per parent agent */
const prevSubagentKeys = new Map<string, Set<string>>()

/** Track previous agent states to detect offline→working transitions */
const prevAgentStates = new Map<string, string>()

const AGENT_CHARACTER_VARIANTS: Record<string, number> = {
  ani: 1,
}

function preferredVariantForAgent(agentId: string): number | undefined {
  return AGENT_CHARACTER_VARIANTS[agentId.trim().toLowerCase()]
}

/**
 * Which agent currently holds each reserved character skin (palette).
 *
 * OpenClaw sometimes spins up a temporary look-alike agent (e.g. a second
 * "ani") that resolves to the same reserved variant as the real one. Pinning
 * both would give them an identical skin. We pin a reserved variant to a single
 * owner; any other agent that maps to the same variant is treated as having no
 * preferred variant, so it falls back to a distinct, diverse skin instead of
 * duplicating the original.
 */
const variantOwner = new Map<number, string>()

/**
 * Decide, for the current sync, which agent owns each reserved variant. The
 * existing owner keeps it while still live; otherwise the lexicographically
 * smallest agentId wins so the choice is stable across syncs (e.g. the canonical
 * "Ani" beats a temp "ani"). Owners that went offline release their variant.
 */
function refreshVariantOwners(activities: AgentActivity[]): void {
  const liveAgentIds = new Set(
    activities.filter((a) => a.state !== 'offline').map((a) => a.agentId),
  )
  for (const [variant, owner] of variantOwner) {
    if (!liveAgentIds.has(owner)) variantOwner.delete(variant)
  }

  const claimantsByVariant = new Map<number, string[]>()
  for (const a of activities) {
    if (a.state === 'offline') continue
    const variant = preferredVariantForAgent(a.agentId)
    if (variant === undefined) continue
    const list = claimantsByVariant.get(variant) ?? []
    list.push(a.agentId)
    claimantsByVariant.set(variant, list)
  }
  for (const [variant, claimants] of claimantsByVariant) {
    const current = variantOwner.get(variant)
    if (current !== undefined && claimants.includes(current)) continue
    claimants.sort()
    variantOwner.set(variant, claimants[0])
  }
}

/** The reserved palette to pin for this agent, or undefined to use a diverse one. */
function pinnedVariantForAgent(agentId: string): number | undefined {
  const variant = preferredVariantForAgent(agentId)
  if (variant === undefined) return undefined
  return variantOwner.get(variant) === agentId ? variant : undefined
}

export function syncAgentsToOffice(
  activities: AgentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
  seatAssignments?: Record<string, string>,
  agentAppearance?: Record<string, AgentAppearance>,
): void {
  const currentAgentIds = new Set(activities.map(a => a.agentId))
  refreshVariantOwners(activities)

  // Remove agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevSubagentKeys.delete(agentId)
    }
  }

  for (const activity of activities) {
    if (activity.state === 'offline') {
      if (agentIdMap.has(activity.agentId)) {
        const charId = agentIdMap.get(activity.agentId)!
        office.removeAllSubagents(charId)
        office.removeAgent(charId)
        agentIdMap.delete(activity.agentId)
        prevSubagentKeys.delete(activity.agentId)
      }
      prevAgentStates.set(activity.agentId, 'offline')
      continue
    }

    let charId = agentIdMap.get(activity.agentId)
    if (charId !== undefined && !office.characters.has(charId)) {
      agentIdMap.delete(activity.agentId)
      charId = undefined
    }
    if (charId === undefined) {
      charId = nextIdRef.current++
      agentIdMap.set(activity.agentId, charId)
      // 只有從 offline 恢復時才從門口走進來；
      // 頁面初始載入（isNew）時直接放到座位，避免讓使用者以為角色剛去摸魚回來
      const wasOffline = prevAgentStates.get(activity.agentId) === 'offline'
      const initialSkin = agentAppearance?.[activity.agentId]?.skin ?? pinnedVariantForAgent(activity.agentId)
      office.addAgent(
        charId,
        initialSkin,
        undefined,
        seatAssignments?.[activity.agentId],
        undefined,
        wasOffline,
      )
    }

    // Set label, avoiding duplicated values like "main (main)"
    const ch = office.characters.get(charId)
    if (ch) {
      const appearance = agentAppearance?.[activity.agentId]
      if (appearance?.skin !== undefined) {
        // user-chosen skin wins over the auto-assigned reserved/diverse variant
        ch.palette = appearance.skin
        ch.hueShift = 0
      } else {
        const preferredVariant = pinnedVariantForAgent(activity.agentId)
        if (preferredVariant !== undefined) {
          ch.palette = preferredVariant
          ch.hueShift = 0
        }
      }
      ch.colorTint = appearance?.color ?? undefined
      const displayName = activity.name?.trim()
      ch.label = displayName && displayName !== activity.agentId
        ? `${displayName} (${activity.agentId})`
        : activity.agentId
    }

    switch (activity.state) {
      case 'working':
        office.setAgentActive(charId, true)
        office.setAgentTool(charId, activity.currentTool || null)
        office.setAgentTaskText(charId, activity.lastTask)
        break
      case 'idle':
        office.setAgentActive(charId, false)
        office.setAgentTool(charId, null)
        office.setAgentTaskText(charId, undefined)
        break
      case 'waiting':
        office.setAgentActive(charId, true)
        office.showWaitingBubble(charId)
        break
    }

    // Sync subagents
    const currentSubKeys = new Set<string>()
    if (activity.subagents) {
      for (const sub of activity.subagents) {
        const subKey = sub.sessionKey ? `${sub.sessionKey}::${sub.toolId}` : sub.toolId
        currentSubKeys.add(subKey)
        const existingSubId = office.getSubagentId(charId, subKey)
        if (existingSubId === null) {
          const subId = office.addSubagent(charId, subKey)
          office.setAgentActive(subId, true)
          const subCh = office.characters.get(subId)
          if (subCh) subCh.label = office.getTempWorkerLabel()
        } else {
          const subCh = office.characters.get(existingSubId)
          if (subCh) {
            subCh.label = office.getTempWorkerLabel()
            office.setAgentActive(existingSubId, true)
          }
        }
      }
    }

    // Remove subagents that are no longer active
    const prevKeys = prevSubagentKeys.get(activity.agentId)
    if (prevKeys) {
      for (const subKey of prevKeys) {
        if (!currentSubKeys.has(subKey)) {
          office.removeSubagent(charId, subKey)
        }
      }
    }
    prevSubagentKeys.set(activity.agentId, currentSubKeys)
    prevAgentStates.set(activity.agentId, activity.state)
  }
}
