import { useId, type ComponentProps, type ReactNode } from "react";
import { strings } from "@pets/core/strings";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled control with its hint and its error. The control is a render
 * prop that receives the id and the aria attributes to put on itself.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (control: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">({strings.app.optional})</span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A group of radio pills: one choice from a few. */
export function ChoiceGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  error,
  disabled,
}: {
  label: ReactNode;
  name: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const stacked = options.some((o) => o.hint);
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend id={id} className="mb-1.5 text-sm font-medium">
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className={cn("flex gap-2", stacked ? "flex-col" : "flex-wrap")}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:disabled]:opacity-60",
              stacked && "items-start",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={cn("size-4", stacked && "mt-0.5")}
            />
            <span className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              {option.hint ? <span className="text-xs text-muted-foreground">{option.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}

const areaClass =
  "min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

export function TextArea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(areaClass, props.className)} />;
}
