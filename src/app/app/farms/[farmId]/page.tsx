import { OperationsDetailWorkspace } from "@/components/operations/operations-detail-workspace";

export default async function FarmOverview({params}:{params:Promise<{farmId:string}>}){const {farmId}=await params;return <OperationsDetailWorkspace mode="farm" farmId={farmId}/>}
