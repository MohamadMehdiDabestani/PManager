// apps/web/src/lib/ability-context.tsx
'use client';
import { createContext, useContext, useMemo } from 'react';
import { createContextualCan } from '@casl/react';
import { PureAbility } from '@casl/ability';
import { unpackRules, type PackRule } from '@casl/ability/extra';

const AbilityContext = createContext<PureAbility>(new PureAbility([]));
export const Can = createContextualCan(AbilityContext.Consumer);
export const useAbility = () => useContext(AbilityContext);

/** Server sends packRules(ability.rules) in the session; also cache them in IndexedDB for offline use. */
export function AbilityProvider({ packed, children }: { packed: PackRule<any>[]; children: React.ReactNode }) {
  const ability = useMemo(() => new PureAbility(unpackRules(packed) as any), [packed]);
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

// Usage (UI convenience only; server enforces):
// <Can I="assign" a="WorkOrder"><AssignButton /></Can>
// const ability = useAbility(); ability.can('execute', subject('WorkOrder', wo))
//
// Server side, e.g. in a layout/route: const packed = packRules(defineAbilityFor(user).rules);
// Offline: store { packed, rulesVersion } in Dexie `meta`; refresh on login/sync; server re-checks queued actions.
