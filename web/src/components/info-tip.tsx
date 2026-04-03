"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { glossary, type GlossaryKey } from "@/lib/glossary";

interface InfoTipProps {
  term: GlossaryKey;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function InfoTip({ term, children, side = "top" }: InfoTipProps) {
  const entry = glossary[term];
  if (!entry) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger className="underline decoration-dotted decoration-zinc-600 underline-offset-4 cursor-help inline">
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-sm bg-zinc-900 border border-zinc-700 text-xs leading-relaxed p-3">
        <p className="font-medium text-zinc-200 mb-1">{entry.short}</p>
        <p className="text-zinc-400">{entry.long}</p>
      </TooltipContent>
    </Tooltip>
  );
}
