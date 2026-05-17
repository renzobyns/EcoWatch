import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
    {
        variants: {
            variant: {
                default: "border-primary/30 bg-primary/15 text-primary",
                secondary: "border-border bg-foreground/5 text-foreground/70",
                destructive: "border-red-500/30 bg-red-500/15 text-red-500",
                warning: "border-yellow-500/30 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
                success: "border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400",
                outline: "border-border text-foreground/80",
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
