// Pre-injected into the page before app code runs. Stubs the Tauri IPC bridge
// (window.__TAURI_INTERNALS__) with mock implementations so the Vue app can
// load and run inside a regular browser for end-to-end testing. The real
// Tauri commands aren't reachable here — we either return fake responses or
// no-op based on the command name.
(function () {
  const noop = async () => undefined
  const mockInvoke = async (cmd, args) => {
    // Tests can override responses by calling
    //   window.__E2E_INVOKE_MOCKS__[cmd] = async (args) => ...
    // before triggering a click that fires the command.
    const mocks = window.__E2E_INVOKE_MOCKS__ || {}
    if (typeof mocks[cmd] === 'function') return mocks[cmd](args)
    // Permissive defaults for commands the app fires at startup.
    switch (cmd) {
      case 'load_config':
      case 'load_autosave':
        return ''
      case 'opening_book_query_moves':
      case 'opening_book_get_stats':
        return []
      default:
        return undefined
    }
  }
  window.__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    transformCallback: cb => cb,
    metadata: { plugins: [], windows: [] },
  }
  window.__TAURI_INVOKE__ = mockInvoke
  window.__E2E_INVOKE_MOCKS__ = window.__E2E_INVOKE_MOCKS__ || {}
  window.__E2E_INVOKE_LOG__ = []
  // Log every invoke for assertions.
  const wrappedInvoke = async (cmd, args) => {
    window.__E2E_INVOKE_LOG__.push({ cmd, args })
    return mockInvoke(cmd, args)
  }
  window.__TAURI_INTERNALS__.invoke = wrappedInvoke
  window.__TAURI_INVOKE__ = wrappedInvoke
})()
