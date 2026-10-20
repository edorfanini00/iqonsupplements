"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

const subscribeToHydration = () => () => {}

function useHydrated() {
  return React.useSyncExternalStore(subscribeToHydration, () => true, () => false)
}

// Closed panels stay mounted so their answers are part of the HTML and the rendered page.
// While closed they are collapsed and visibility:hidden: not shown, not focusable and not
// in the accessibility tree. The panel height is measured continuously because Radix only
// measures mounted panels at render time. The closing animation is enabled after
// hydration so server-rendered closed panels do not animate on page load.
function AccordionContent({
  className,
  children,
  style,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const hydrated = useHydrated()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number>()
  React.useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || typeof ResizeObserver === "undefined") return
    const measure = () => setHeight(panel.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm data-[state=open]:animate-accordion-down data-[state=closed]:h-0 data-[state=closed]:invisible",
        hydrated && "data-[state=closed]:animate-[iqon-accordion-up_0.2s_ease-out]"
      )}
      style={{ "--radix-accordion-content-height": height === undefined ? undefined : `${height}px`, ...style } as React.CSSProperties}
      {...props}
      forceMount
    >
      <div ref={panelRef} className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
