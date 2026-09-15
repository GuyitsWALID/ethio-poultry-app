import { MortalityControlRoom } from "@/components/mortality/mortality-control-room";
import { RecordCheckCorrectionBanner } from "@/components/record-check-correction-banner";

export default function MortalityPage() {
  return <div className="space-y-5"><RecordCheckCorrectionBanner/><MortalityControlRoom /></div>;
}
