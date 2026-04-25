import React from 'react';
import { ArrowUpRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
    textColor?: string;
}

export function ButtonColorful({
    className,
    label = "Explore Components",
    textColor = "white",
    ...props
}: ButtonColorfulProps) {
    const isBlack = textColor === "black";
    const textHex = isBlack ? "#000000" : "#ffffff";

    return (
        <Button
            className={cn(
                "relative h-14 px-12 overflow-hidden text-base",
                "bg-[#b05730] dark:bg-[#c96442]",
                "transition-all duration-200",
                "group",
                className
            )}
            {...props}
        >
            {/* Gradient background effect */}
            <div
                className={cn(
                    "absolute inset-0",
                    "bg-gradient-to-r from-[#c96442] via-[#e38562] to-[#b05730]",
                    "opacity-90 group-hover:opacity-100",
                    "transition-opacity duration-300"
                )}
            />

            {/* Content */}
            <div className="relative flex items-center justify-center gap-2">
                <span className={cn("font-bold relative z-10")} style={{ color: textHex }}>
                    {label}
                </span>
                <ArrowUpRight className="w-5 h-5 relative z-10" style={{ color: textHex }} />
            </div>
        </Button>
    );
}
