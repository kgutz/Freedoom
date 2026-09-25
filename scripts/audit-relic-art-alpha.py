"""Read-only silhouette inventory, used to check CSS clipping at small sizes."""
import json
import subprocess
from pathlib import Path
from PIL import Image

definitions=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ALL_RELIC_DEFINITIONS as defs} from './src/data/loot-data.js'; console.log(JSON.stringify(defs.map(d=>({id:d.id,image:d.image}))))"],text=True))
result={}
for definition in definitions:
    with Image.open(Path('public')/definition['image']) as image:
        alpha=image.convert('RGBA').getchannel('A')
        bounds=alpha.point(lambda a:255 if a>=16 else 0).getbbox()
        result[definition['id']]=[image.width,image.height,*bounds]
print(json.dumps(result,separators=(',',':')))
