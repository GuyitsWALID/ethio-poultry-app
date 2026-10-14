import {defineConfig,devices} from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({...base,projects:[
  {name:"chromium",use:{...devices["Desktop Chrome"]}},
  {name:"firefox",use:{...devices["Desktop Firefox"]}},
  {name:"webkit",use:{...devices["Desktop Safari"]}},
  {name:"edge",use:{...devices["Desktop Edge"],channel:"msedge"}},
]});
