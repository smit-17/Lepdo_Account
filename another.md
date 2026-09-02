# Data Synchronization Analysis

## Reasons

1. **The whole workspace is saved as one JSON snapshot.**
   `store.tsx` serializes all `LepdoData` and `workspace.functions.ts` performs an `upsert` of the complete `workspace.data` value. A save from one browser therefore replaces the complete document written by another browser instead of adding or updating only the changed entry.

2. **This creates a lost-update race between browsers.**
   Browser 2 can hold an older snapshot in React state or `localStorage`. When it refreshes, reconnects, or its debounced save runs, it can write that old snapshot to Supabase. Entries created by Browser 1 are then absent from the replacement JSON, so they appear to be deleted in both browsers.

3. **The 500 ms debounce increases the stale-write window.**
   The save effect schedules a delayed full-document write. A browser can queue a write from old state, receive newer realtime data, and still have timing interactions between the pending save, `pull()`, and realtime callbacks.

4. **No optimistic-concurrency check exists.**
   `saveWorkspace` does not send or compare the snapshot's `updated_at`/version before writing. Supabase accepts the last `upsert`, even when that payload was read before a newer payload was saved.

5. **Realtime synchronization sends replacements, not changes.**
   Realtime delivers the latest complete JSON row and `applyRemote()` replaces local state with it. This can synchronize clients after a successful write, but it cannot merge two simultaneous edits and cannot recover data already overwritten by a stale full snapshot.

6. **The shared row is not scoped to a user or workspace member.**
   The fixed ID `lepdo-main` and server-side service-role client make every session write to the same row. This is expected for shared data, but it makes the overwrite problem global and the missing authorization/version protection more significant.

## Possible Solutions

### Preferred: Store entries as database rows

- Create tables for transactions, invoices, parties, accounts, and the other collections, with stable IDs and appropriate foreign keys.
- Insert or update only the record changed by the current browser.
- Subscribe to row-level changes through Supabase Realtime and update the matching local record.
- Keep settings or small metadata in a separate row if needed.

This removes the whole-document lost-update race and is the most reliable long-term design for multi-browser use.

### Minimal change: Add optimistic concurrency to the snapshot

- Return `updated_at` (or an integer version) from `loadWorkspace`.
- Send the version read by the client with every save.
- Update only when the database version still matches; otherwise reject the save.
- On conflict, reload the latest snapshot, merge the local change into it, and retry, or show a conflict message.
- Use an atomic SQL/RPC function or conditional update such as `WHERE id = ... AND updated_at = ...`; a client-side check followed by a separate `upsert` is not safe.

This prevents silent deletion, but merging arbitrary full JSON snapshots remains complex.

### Safer transitional option: Patch-based writes

- Send operations such as `add transaction`, `update transaction`, and `void transaction` instead of sending the entire `LepdoData` snapshot.
- Apply each operation atomically on the server, preferably through Supabase RPC functions or row-level tables.
- Re-fetch or process realtime changes after reconnecting.

This preserves more of the current store while avoiding replacement writes, but requires defining and validating every operation.

### Additional protections for the current design

- Do not save cached/local state to the cloud when the cloud has a non-empty snapshot unless a deliberate migration/import is being performed.
- Cancel or sequence overlapping `pull()` calls so an older response cannot replace newer state.
- Track a request/version token and ignore realtime or load results older than the latest applied version.
- Flush or cancel pending debounced saves when remote data arrives; never write a snapshot that was based on an older remote version.
- Add server-side validation, authentication, workspace membership checks, and an audit/history record for rejected conflicts.

These measures reduce the frequency and impact of data loss, but they do not make concurrent full-snapshot `upsert` operations safe by themselves.

## Verification

Test at minimum with two browsers:

1. Load both browsers from the same workspace.
2. Add different entries in each browser within the debounce interval.
3. Refresh or disconnect/reconnect either browser while the other has unsaved changes.
4. Confirm that both entries remain after reload and realtime synchronization.
5. Force a stale-version save and confirm it is rejected or merged, never silently accepted as a replacement.