"use client"

import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { resolvedTheme, theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isRotating, setIsRotating] = useState(false)

  // Éviter les erreurs d'hydratation
  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setIsRotating(true)
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
    
    // Réinitialiser l'état d'animation après la transition
    setTimeout(() => {
      setIsRotating(false)
    }, 500) // Durée correspondant à notre animation
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-full h-8 w-8 relative"
    >
      <div className={cn(
        "w-full h-full flex items-center justify-center",
        isRotating && "animate-theme-toggle"
      )}>
        {/* Afficher une icône par défaut avant le montage du client */}
        {!mounted ? (
          <Sun className="h-[1.2rem] w-[1.2rem]" />
        ) : (
          <>
            <Sun
              className={cn(
                "h-[1.2rem] w-[1.2rem] transition-all duration-300",
                resolvedTheme === "dark" ? "opacity-0 scale-0" : "opacity-100 scale-100"
              )}
            />
            <Moon
              className={cn(
                "absolute h-[1.2rem] w-[1.2rem] transition-all duration-300",
                resolvedTheme === "dark" ? "opacity-100 scale-100" : "opacity-0 scale-0"
              )}
            />
          </>
        )}
      </div>
    </Button>
  )
} 