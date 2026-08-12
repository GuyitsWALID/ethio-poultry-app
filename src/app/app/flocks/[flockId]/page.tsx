import { OperationsDetailWorkspace } from "@/components/operations/operations-detail-workspace";

export default async function FlockDetailPage({params}:{params:Promise<{flockId:string}>}){const {flockId}=await params;return <OperationsDetailWorkspace mode="flock" flockId={flockId}/>}
