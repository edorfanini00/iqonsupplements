import { Droplets, Layers2, Sparkles, ScanFace, Moon, Sun, Feather, Waves, Hand, Eye, CircleDashed } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { SkincareStory } from "@/lib/skincare-stories";
import type { SkinVisualContent } from "@/lib/skincare-visual-content";

const benefitIcons={droplet:Droplets,layers:Layers2,spark:Sparkles,face:ScanFace,moon:Moon,sun:Sun,feather:Feather,rinse:Waves};
const routineIcons={cleanse:Waves,apply:Hand,sun:Sun,moon:Moon,layers:Layers2,pad:CircleDashed,eye:Eye};

export function SkincareVisualBenefits({id,story,visual}:{id:string;story:SkincareStory;visual:SkinVisualContent}) {
  return <div className="skin-benefits-editorial">
    <div className="skin-benefits-copy"><p className="skin-kicker">{story.eyebrow}</p><h2 id="benefits-heading">{story.title}</h2><p className="skin-benefits-intro">{story.introduction}</p>
      <div className="skin-benefit-points">{visual.benefits.map(benefit=>{const Icon=benefitIcons[benefit.icon];return <article key={benefit.title}><Icon size={27} strokeWidth={1.2} aria-hidden="true"/><h3>{benefit.title}</h3><p>{benefit.body}</p></article>;})}</div>
    </div>
    <figure className="skin-benefits-photo"><img src={`/images/pdp-materials-v6/${id}.webp`} alt={story.imageAlt} width={1122} height={1402} loading="lazy" decoding="async"/><span className="skin-photo-label">A CLOSER LOOK</span><figcaption>{visual.texture}</figcaption></figure>
  </div>;
}

export function SkincareVisualRoutine({id,name,size,directions,story,visual}:{id:string;name:string;size:string;directions:string;story:SkincareStory;visual:SkinVisualContent}) {
  return <>
    <header className="skin-application-heading"><div><p className="skin-kicker">YOUR DAILY RITUAL</p><h2 id="routine-heading">{visual.routineTitle}</h2></div><span className="skin-timing-label">{id==='retinol-rx'?<Moon size={18} strokeWidth={1.2}/>:<Sun size={18} strokeWidth={1.2}/>} {visual.timing}</span></header>
    <div className="skin-application-board">
      <figure className="skin-application-photo"><img src={`/images/pdp-stories-v5/${id}.webp`} alt={`${name} — IQON product editorial`} width={1122} height={1402} loading="lazy" decoding="async"/><figcaption><strong>{name}</strong><span>{size}</span></figcaption></figure>
      <ol className="skin-application-steps">{visual.steps.map((step,i)=>{const Icon=routineIcons[step.icon];return <li key={step.title}><div className="skin-step-top"><span>0{i+1}</span><Icon size={38} strokeWidth={1} aria-hidden="true"/></div><h3>{step.title}</h3><p>{step.body}</p></li>;})}</ol>
    </div>
    <div className="skin-application-details"><p><strong>Keep in mind</strong>{story.routineNote}</p><Accordion type="single" collapsible><AccordionItem value="directions"><AccordionTrigger>Read the complete directions</AccordionTrigger><AccordionContent>{directions}</AccordionContent></AccordionItem></Accordion></div>
  </>;
}
