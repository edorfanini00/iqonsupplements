import { IQONSite } from "./site";
export default function Home() {
 const designPreview=process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development";
 return <IQONSite designPreview={designPreview}/>;
}
