import { EditCampaignScreen } from "@/components/workspace/campaigns";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EditCampaignScreen id={id}/>;}
