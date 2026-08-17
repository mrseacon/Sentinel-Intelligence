import { OG_IMAGE_ALT, OG_IMAGE_SIZE, renderBrandImage } from "@/lib/og-image";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderBrandImage();
}
