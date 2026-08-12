import { OperationsDetailWorkspace } from "@/components/operations/operations-detail-workspace";

export default async function HouseOverview({params}:{params:Promise<{farmId:string;houseId:string}>}){const {farmId,houseId}=await params;return <OperationsDetailWorkspace mode="house" farmId={farmId} houseId={houseId}/>}
