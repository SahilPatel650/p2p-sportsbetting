"use client"

import * as React from "react"
import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
}

export function useToast() {
  const toast = ({ title, description, variant = "default" }: ToastProps) => {
    const toastOptions = {
      className: variant === "destructive" 
        ? "bg-destructive text-destructive-foreground" 
        : variant === "success"
        ? "bg-green-100 text-green-800"
        : "",
    }
    
    return sonnerToast(
      <div className="flex flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>,
      {
        ...toastOptions,
      }
    )
  }

  return { toast }
}

export type { ToastProps } 