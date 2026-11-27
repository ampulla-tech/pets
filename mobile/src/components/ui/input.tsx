import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";

import { useRequiredHint } from "@/components/ui/field";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Props = TextInputProps & { className?: string; invalid?: boolean };

const Input = React.forwardRef<TextInput, Props>(function Input(
  { className, invalid, multiline, ...props },
  ref,
) {
  const required = useRequiredHint();
  return (
    <TextInput
      ref={ref}
      {...required}
      multiline={multiline}
      className={cn(
        "min-h-11 rounded-lg border border-input bg-card px-3 text-base text-foreground",
        multiline && "min-h-24 py-2",
        invalid && "border-late",
        className,
      )}
      style={multiline ? { textAlignVertical: "top" } : undefined}
      placeholderTextColor={colors["muted-foreground"]}
      {...props}
    />
  );
});

export { Input };
