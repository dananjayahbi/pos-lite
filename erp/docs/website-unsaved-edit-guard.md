# Website CMS - unsaved-edit protection

ARGUS #502: the CMS guarded tab switches and browser unload, but clicking the
sidebar Dashboard (or any in-app link) navigated away with no dialog. Dirty
state was also a keystroke counter, so changing Tagline and changing it back
still showed "Unsaved changes" and kept Save enabled.

## Real diff

`isWebsiteConfigDirty()` (`src/lib/website/dirty-state.core.ts`) compares the
current config with the config loaded/saved last:

- object key order is ignored (tabs rebuild nested objects);
- array order matters (slides/footer links);
- `undefined` keys count as absent;
- a reverted edit is clean again.

The form stores the loaded/last-saved object in a ref and derives `isDirty` on
each render. Save, Discard and Reset all update that ref.

## Route guard

While dirty, a capture-phase `click` listener intercepts same-origin
`<a href>` navigations before Next's router handles them. It ignores modified
clicks, `target="_blank"`, `download`, hash-only links and external origins.
The existing dialog is reused; its three paths now all clean up the pending
destination:

- **Cancel** - stay, clear the pending tab/navigation.
- **Discard** - restore the last saved config, then switch tab or navigate.
- **Save** - save first; navigate/switch only if the save succeeded.

`beforeunload` still covers browser close/reload. Browser Back/Forward is not
intercepted by the App Router and remains covered only by that unload guard.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/website/__tests__/dirty-state.core.test.ts`
