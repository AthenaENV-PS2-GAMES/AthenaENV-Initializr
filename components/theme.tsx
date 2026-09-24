'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { strings } from '@/lib/strings'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'athena-theme'

/** Runs before hydration (inlined in <head>) so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}var c=document.documentElement.classList;c.remove('dark','light');c.add(t)}catch(e){}})()`

function readTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

/** The theme class on <html>, kept in sync with changes made elsewhere. */
function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>('dark')
  useEffect(() => {
    setTheme(readTheme())
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

export function ThemeToggle() {
  const theme = useTheme()
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? strings.header.themeToLight : strings.header.themeToDark
  const toggle = () => {
    const classes = document.documentElement.classList
    classes.remove('dark', 'light')
    classes.add(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode, blocked): the choice lasts for this page only.
    }
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

export function ThemedToaster() {
  return <Toaster theme={useTheme()} position="bottom-right" />
}
