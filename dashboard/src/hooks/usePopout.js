export function usePopout() {
  const popout = (path, title = 'JS Fenster') => {
    window.open(
      `${path}?standalone=1`,
      '_blank',
      `width=1200,height=800,menubar=no,toolbar=no`
    )
  }
  return { popout }
}

export function useIsStandalone() {
  return !!(window.opener || new URLSearchParams(window.location.search).get('standalone'))
}
