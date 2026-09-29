from pathlib import Path
import math,json
root=Path(__file__).resolve().parents[2]
assets={}
def path(d,**a):
 return '<path d="'+d+'" '+ ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in a.items())+'/>'
def circle(x,y,r,**a):
 return f'<circle cx="{x}" cy="{y}" r="{r}" '+ ' '.join(f'{k.replace("_","-")}="{v}"' for k,v in a.items())+'/>'
def ellipse(x,y,rx,ry):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}"/>'
# Concept diagrams deliberately avoid pretending to show atomically exact proteins or plant extracts.
chain=''
for y,off in [(105,0),(180,25),(255,-5)]:
 chain+=path(f'M{90+off} {y} '+ ' '.join(f'L{x+off} {y+(22 if i%2 else -22)}' for i,x in enumerate([140,195,250,305,360,415])),stroke_width=1.4)
 for i,x in enumerate([90,140,195,250,305,360,415]):chain+=circle(x+off,y if i==0 else y+(22 if (i-1)%2 else -22),9,fill='#26343b',fill_opacity='.12')
assets['collagen-peptides']=chain
assets['capsule-shell']='<g transform="rotate(-29 260 180)"><rect x="122" y="116" width="276" height="128" rx="64" fill="#26343b" fill-opacity=".04"/>'+path('M260 116v128M276 119v122M142 160c0-16 18-27 37-27',stroke_width=1.5)+'</g>'
# Hydration schematic: strands and approaching water droplets, no efficacy implication.
assets['psyllium-fiber']=''.join(path(f'M80 {y}q45-50 90 0t90 0t90 0t90 0',stroke_width=1.6) for y in [130,180,230])+''.join(circle(x,y,9,fill='#26343b',fill_opacity='.1') for x,y in [(95,75),(220,80),(355,78),(140,285),(270,282),(400,283)])
assets['immunoglobulin']=path('M249 294v-88L146 105M271 294v-88l103-101M230 199l-102-81M290 199l102-81',stroke_width=11,stroke_linecap='round')+path('M195 154l-37-38M325 154l37-38M249 245h22M249 262h22',stroke_width=2,stroke_linecap='round')
# Accurate proportions, interpreted by editable HTML alongside the schematic.
assets['colostrum-composition']=circle(260,180,106,stroke_width=2)+f'<path d="M260 74 A106 106 0 0 1 366 180" stroke="#26343b" stroke-width="22"/>'+circle(260,180,76,stroke_width=1,stroke_dasharray='3 7')
assets['root-complex']=path('M260 64v228m0-164-72 38-51 64m123-68 70 41 45 55m-115-50-50 58m50-29 28 37M188 166l-60 7m202 30 59-7m-179 70-52 7',stroke_width=2,stroke_linecap='round')+circle(260,180,126,stroke_width='.7',stroke_dasharray='2 7')
assets['bacillus']=''.join(f'<g transform="rotate({a} {x} {y})"><rect x="{x-62}" y="{y-24}" width="124" height="48" rx="24" fill="#26343b" fill-opacity=".04"/>'+ellipse(x,y,21,14)+'</g>' for x,y,a in [(176,135,-35),(331,130,25),(269,241,-15)])
assets['four-enzymes']=''.join(f'<g transform="translate({x} {y})">'+path('M0-37c33-18 73 4 76 38 3 36-39 64-70 39-26 16-56-4-53-31 2-22 25-25 47-46Z',stroke_width=1.5)+circle(4,14,12,fill='#26343b',fill_opacity='.07')+'</g>' for x,y in [(161,105),(328,105),(161,232),(328,232)])
assets['digestive-blend']=circle(178,175,74,stroke_width=1.3)+circle(333,175,74,stroke_width=1.3)+path('M148 213q-45-73 27-117 62 34 17 90l-31 45m12-112-13 110m13-55-20-18m18 0 22-18',stroke_width=1.3)+path('M330 132c34-13 58 17 38 44 19 27-6 60-34 41-27 17-52-11-34-39-14-28 4-50 30-46Z',stroke_width=1.3)
assets['nutrient-grid']=''.join(f'<rect x="{x}" y="{y}" width="64" height="64" rx="12" fill="#26343b" fill-opacity="{.12 if i%3==0 else .025}"/>' for i,(x,y) in enumerate([(x,y) for y in [77,153,229] for x in [153,229,305]]))
# Ingredient-family art is schematic, not botanical identification or a molecule.
leaf=lambda x,y,angle:f'<g transform="translate({x} {y}) rotate({angle})">'+path('M0 94C-64 35-50-45 0-82 62-40 60 44 0 94Z',stroke_width=1.6,fill='#26343b',fill_opacity='.03')+path('M0 83V-58M0 31-27 4M0-7l25-28M0 54l26-24',stroke_width=1)+'</g>'
assets['botanical-pair']=leaf(194,181,-22)+leaf(334,177,24)
assets['botanical-blend']=leaf(170,187,-32)+leaf(262,161,0)+leaf(350,191,33)
assets['stevia-leaf']=leaf(260,188,12)
assets['artichoke-leaf']=path('M260 289 200 250 209 223 163 187 189 169 173 113 223 127 260 64 297 127 347 113 331 169 357 187 311 223 320 250Z',fill='#26343b',fill_opacity='.04')+path('M260 86v206m0-58-58-43m58 6-48-51m48 88 58-43m-58 6 48-51',stroke_width=1.2)
assets['flavor-blend']=circle(194,180,83,stroke_width=1.2)+circle(326,180,83,stroke_width=1.2)+''.join(circle(x,y,r,fill='#26343b',fill_opacity='.15') for x,y,r in [(168,161,7),(193,132,6),(166,209,9),(213,229,7),(216,177,5)])+path('M286 183q20-50 40-3t39-2M297 222q17-35 31-3t25-2',stroke_width=1.2)
for art,body in assets.items():
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360"><g fill="none" stroke="#26343b" stroke-width="1.5" stroke-linejoin="round">{body}</g></svg>'
 (root/'public/images/supplement-ingredients'/f'{art}.svg').write_text(svg+'\n')
(root/'creative/supplement-visual-v1/illustration-notes.json').write_text(json.dumps({'purpose':'Conceptual format, ingredient-family and composition diagrams. These are labelled illustrations, not exact molecular models or measured biological outcomes.','assets':list(assets)},indent=2)+'\n')
print('Created',len(assets),'ingredient illustrations')
