import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { Text, TextClassContext } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

// 44px is the touch floor: `default` meets it, `lg` is the full-width call to
// action, `sm` a compact secondary inside a row.
const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-lg active:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        outline: "border border-border bg-card",
        ghost: "bg-transparent",
        destructive: "bg-late-tint",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const buttonTextVariants = cva("text-base font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      ghost: "text-primary",
      destructive: "text-late",
    },
    size: { default: "", sm: "text-sm", lg: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    /** The label, when the button is only text. */
    label?: string;
    busy?: boolean;
    icon?: React.ReactNode;
  };

function Button({
  className,
  variant,
  size,
  label,
  busy,
  icon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const off = disabled || busy;
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        role="button"
        accessibilityState={{ disabled: !!off, busy: !!busy }}
        disabled={off}
        className={cn(buttonVariants({ variant, size }), off && "opacity-50", className)}
        {...props}
      >
        {busy ? (
          <ActivityIndicator
            color={variant === "default" || !variant ? colors["primary-foreground"] : colors.primary}
          />
        ) : (
          icon
        )}
        {label ? <Text>{label}</Text> : (children as React.ReactNode)}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
