import { cookies } from "next/headers";
import { DEFAULT_SEGMENT, isSegment, type Segment } from "./segments";

// Segmento escolhido no topo da tela (fica num cookie, por navegador).
export const SEGMENT_COOKIE = "spj_segment";

export async function getCurrentSegment(): Promise<Segment> {
  const value = (await cookies()).get(SEGMENT_COOKIE)?.value;
  return isSegment(value) ? value : DEFAULT_SEGMENT;
}
