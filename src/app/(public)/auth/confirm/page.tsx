import Image from "next/image";
import Link from "next/link";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { confirmRecovery } from "./actions";

/**
 * Password-recovery interstitial.
 */
export default async function ConfirmRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; error?: string }>;
}) {
  const { token_hash, error } = await searchParams;
  const isExpired = error === "expired_link" || error === "invalid_link";

  return (
    <div className="font-inter min-h-screen bg-[#2B4257] flex items-center justify-center p-4">
      <div className="flex w-full max-w-[1229px] shadow-[0px_4px_20px_rgba(0,0,0,0.1)] min-h-[661px]">
        <div
          className="w-full lg:w-[568px] bg-white flex flex-col items-center justify-center py-12 px-8 relative z-10"
          style={{ borderRadius: "12px 12px 12px 12px" }}
        >
          <div className="w-full max-w-[400px] flex flex-col gap-[18px]">
            <div className="flex flex-col items-center mb-6">
              <Image
                src="/images/logos/talkmaze-logo-horizontal-color.svg"
                alt="TalkMaze Logo"
                width={150}
                height={145}
                className="h-[145px] w-auto object-contain"
                priority
              />
            </div>

            <div className="text-center mb-4">
              <h1 className="text-[24px] font-bold text-[#1F2E3B] mb-2">
                Reset Password
              </h1>
              <p className="text-[#1F2E3B]/60 italic">
                Click below to continue resetting your password.
              </p>
            </div>

            {isExpired ? (
              <Alert
                variant="destructive"
                className="rounded-[10px] font-medium"
              >
                This password reset link is invalid or has expired.{" "}
                <Link href="/forgot-password" className="underline font-bold">
                  Request a new link
                </Link>
                .
              </Alert>
            ) : (
              <form action={confirmRecovery}>
                <input
                  type="hidden"
                  name="token_hash"
                  value={token_hash ?? ""}
                />
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  className="w-full h-11 md:h-[38px] text-[20px]"
                >
                  Reset my password
                </Button>
              </form>
            )}

            <div className="text-center mt-2">
              <Link
                href="/login"
                className="text-[#1F2E3B] font-bold hover:underline inline-flex items-center min-h-11 md:min-h-0 px-2 -mx-2"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>

        <div
          className="hidden lg:block relative w-[661px] bg-[#65CFAD] overflow-hidden"
          style={{ borderRadius: "0px 8px 8px 0px" }}
        >
          <Image
            src="/images/hero/photo.svg"
            alt="TalkMaze Illustration"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}
