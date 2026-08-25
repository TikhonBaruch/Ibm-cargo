import { Suspense } from "react";
import { ManufacturerCabinet } from "@/components/ved/ManufacturerCabinet";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManufacturerCabinet />
    </Suspense>
  );
}
