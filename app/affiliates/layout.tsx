import './portal.css';
import { Toaster } from 'sonner';
export const metadata={title:'Affiliates | IQON Supplements',robots:{index:false,follow:false}};
export default function AffiliatesLayout({children}:{children:React.ReactNode}){return <div className="affiliate-platform">{children}<Toaster richColors position="top-right"/></div>;}
