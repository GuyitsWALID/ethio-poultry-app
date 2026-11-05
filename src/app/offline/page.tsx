import {OfflineToday} from "@/components/today/offline-today";
import {Suspense} from "react";

// Public, data-free HTML. Identity and farm data are recovered only in the browser.
export default function OfflinePage(){return <Suspense fallback={null}><OfflineToday/></Suspense>;}
