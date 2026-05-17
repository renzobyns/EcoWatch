import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
    {
        variants: {
            variant: {
                default: "border-primary/30 bg-primary/15 text-primary",
                secondary: "border-white/10 bg-white/5 text-white/70",
                destructive: "border-red-500/30 bg-red-500/15 text-red-400",
                warning: "border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
                success: "border-green-500/30 bg-green-500/15 text-green-400",
                outline: "border-white/15 text-white/80",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
