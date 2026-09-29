from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,requests
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D
root=Path(__file__).resolve().parents[2]
items=[('creatine-monohydrate','creatine monohydrate'),('beta-nmn','beta-Nicotinamide mononucleotide'),('trans-resveratrol','trans-resveratrol'),('caffeine','caffeine'),('biotin','biotin'),('l-cysteine-hydrochloride','L-cysteine hydrochloride')]
def draw(item):
 art,name=item
 url='https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'+requests.utils.quote(name,safe='')+'/property/IsomericSMILES/JSON'
 for attempt in range(3):
  try:
   r=requests.get(url,timeout=30);r.raise_for_status();data=r.json()['PropertyTable']['Properties'][0];break
  except Exception:
   if attempt==2:raise
 mol=Chem.MolFromSmiles(data['SMILES']);assert mol
 drawer=rdMolDraw2D.MolDraw2DSVG(520,360)
 opts=drawer.drawOptions();opts.clearBackground=False;opts.useBWAtomPalette();opts.padding=.12;opts.bondLineWidth=1.6;opts.minFontSize=17;opts.maxFontSize=26
 rdMolDraw2D.PrepareAndDrawMolecule(drawer,mol);drawer.FinishDrawing()
 (root/'public/images/supplement-ingredients'/f'{art}.svg').write_text(drawer.GetDrawingText())
 record={'name':name,'cid':data['CID'],'smiles':data['SMILES'],'source':f'https://pubchem.ncbi.nlm.nih.gov/compound/{data["CID"]}','retrieved':'2026-09-29','art':art,'rendered':'RDKit 2D, stereochemistry retained; diagram of the named compound, not finished product efficacy'}
 print(art,data['CID'],flush=True);return record
records=list(ThreadPoolExecutor(max_workers=3).map(draw,items))
(root/'creative/supplement-visual-v1/molecule-sources.json').write_text(json.dumps(records,indent=2)+'\n')
