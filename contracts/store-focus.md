# Store focus state (PRD 05.1 §3.9 · US-O2O-01)

Single-store analysis mode for 到店 pack. Prevents “thousand stores all lit”.

## AppContext fields

```js
{
  storeFocusId: null,      // entity id of 小李 store, or null
  storeFocusMode: false,   // true only when focusing one store
  selected_entity: null    // may mirror storeFocusId for generic handlers
}
```

## State machine

```text
browse (LOD rules)
  -- click store / list select --> focus(storeFocusId)
focus
  -- map shows: that store + coverage/fence/flow faces; others faded or hidden
  -- exit control / clear selection --> browse
```

| Rule | Requirement |
|------|-------------|
| Enter | `storeFocusId` set ⇒ `storeFocusMode = true` |
| Exit | both cleared; restore `lodLevel` point density |
| Analysis panel | coverage, nearby zone heat, optional road access blurb |
| Forbidden | at large scale with no filter, highlight hundreds of stores equally |

## Entity id

Store ids come from processed entities (WS-C/E), brand **小李*** only in public delivery. No employer site names.
