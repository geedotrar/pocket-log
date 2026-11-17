"use client";

import { useFormStatus } from "react-dom";
import { type ComponentProps } from "react";
import { Loader2 } from "lucide-react";

type Props = ComponentProps<"button"> & {
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      className={`flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed ${
        className || ""
      }`}
      type="submit"
      disabled={pending || props.disabled}
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? pendingText : children}
    </button>
  );
}
