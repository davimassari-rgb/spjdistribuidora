"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/current-user";
import { SEGMENT_COOKIE } from "@/lib/segment-server";
import { isSegment } from "@/lib/segments";

export async function setSegmentAction(formData: FormData): Promise<void> {
  await requireUser();
  const segment = formData.get("segment");
  if (!isSegment(segment)) return;
  (await cookies()).set(SEGMENT_COOKIE, segment, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
