'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { strings } from '@/lib/strings'

export async function copyText(text: string, successMessage: string = strings.copy.copied): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
    return true
  } catch {
    toast.error(strings.copy.failed)
    return false
  }
}

/** Copies `text` and briefly swaps the icon for a check mark. */
export function CopyButton({
  text,
  label,
  successMessage,
  showLabel = false,
  className,
}: {
  text: string
  label: string
  successMessage?: string
  showLabel?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = async () => {
    if (!(await copyText(text, successMessage))) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  const icon = copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />
  return showLabel ? (
    <Button variant="outline" size="sm" onClick={onClick} className={className}>
      {icon}
      {label}
    </Button>
  ) : (
    <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} title={label} className={className}>
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
