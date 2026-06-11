"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { User } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/utils/cn";

// `Avatar` is the profile-image primitive: a sized, positioned surface that shows
// an image and falls back to initials (or a generic user icon) when the image is
// missing or fails to load. The image renders through `next/image` (`fill`) so
// Supabase-hosted avatars keep their optimization.
//
// The fallback is always rendered *behind* the image (the root carries the
// fallback colours); a successfully-painted image simply covers it, and a failed
// one is dropped so the fallback shows. This needs no `onLoad` coordination — it
// can't get stuck hiding a cached image — and failure is tracked per-`src`, so the
// upload flow (a broken avatar replaced by a freshly-staged file) recovers cleanly.
//
// Axes: size (dimensions + fallback text size), variant (fallback surface colour),
// shape (circle vs rounded square).
const avatarVariants = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden font-semibold select-none",
  {
    variants: {
      size: {
        sm: "size-9 text-xs", // 36px — contact rows
        md: "size-11 text-sm", // 44px — default, navbar (mobile)
        lg: "size-16 text-xl", // 64px — coach card
        xl: "size-24 text-3xl", // 96px — profile blocks
      },
      variant: {
        // navy: dark surface, green-light initials (the existing default look)
        navy: "bg-card text-accent",
        // teal: green-light surface, navy initials (Figma `color=teal` state)
        teal: "bg-accent text-card",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "navy",
      shape: "circle",
    },
  },
);

function Avatar({
  className,
  size,
  variant,
  shape,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof avatarVariants>) {
  return (
    <span
      data-slot="avatar"
      className={cn(avatarVariants({ size, variant, shape }), className)}
      {...props}
    />
  );
}

// `next/image fill` needs a positioned, sized box — the `Avatar` root provides it.
// Renders nothing when there's no source or the current source has failed, which
// reveals the `AvatarFallback` beneath.
function AvatarImage({
  className,
  src,
  alt = "",
  sizes = "96px",
  onError,
  ...props
}: Omit<ImageProps, "src" | "fill"> & {
  src: string | null | undefined;
}) {
  // Remember which `src` failed (not just "errored") so a new source recovers.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  if (!src || failedSrc === src) return null;

  return (
    <Image
      data-slot="avatar-image"
      fill
      src={src}
      alt={alt}
      sizes={sizes}
      className={cn("object-cover", className)}
      onError={(e) => {
        setFailedSrc(src);
        onError?.(e);
      }}
      {...props}
    />
  );
}

// Sits behind the image; visible while the image loads, is absent, or has failed.
// Renders its children (typically initials) or a generic user icon when given none.
function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center", className)}
      {...props}
    >
      {children ?? <User className="size-1/2" aria-hidden />}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback, avatarVariants };
