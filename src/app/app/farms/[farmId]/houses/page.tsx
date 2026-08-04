import { OperationsDetailWorkspace } from "@/components/operations/operations-detail-workspace";

export default async function FarmHousesPage({params}:{params:Promise<{farmId:string}>}){const {farmId}=await params;return <OperationsDetailWorkspace mode="houses" farmId={farmId}/>}
