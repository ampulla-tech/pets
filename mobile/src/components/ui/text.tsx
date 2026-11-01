import * as React from "react";
import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/utils";

/**
 * Lets a parent (a Button) set the text colour and weight of the Text beneath
 * it without threading props.
 */
const TextClassContext = React.createContext<string | undefined>(undefined);

type Props = TextProps & { className?: string };

function Text({ className, ...props }: Props) {
  const textClass = React.useContext(TextClassContext);
  return <RNText className={cn("text-base text-foreground", textClass, className)} {...props} />;
}

function Heading({ className, ...props }: Props) {
  return (
    <Text role="heading" className={cn("text-xl font-semibold text-foreground", className)} {...props} />
  );
}

function Muted({ className, ...props }: Props) {
  return <Text className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Heading, Muted, Text, TextClassContext };
