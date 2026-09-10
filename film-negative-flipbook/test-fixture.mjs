// Render synthetic metadata in memory; tests never read a personal archive.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const { index, records, sleeveCount } = JSON.parse(execFileSync('python3', ['-c', `
import json
from build_archive import document, sleeve_markup, PAGE_CAPACITY
records = [{"index": i, "filename": f"photo-{i}.png",
            "web_path": f"assets/full-archive/archive-{i:04d}.png"}
           for i in range(73, 0, -1)]
pages = [records[i:i+PAGE_CAPACITY] for i in range(0, len(records), PAGE_CAPACITY)]
sleeves = [sleeve_markup(i, page) for i, page in enumerate(pages)]
print(json.dumps({"index": document(len(records), sleeves, len(sleeves)),
                  "records": records, "sleeveCount": len(sleeves)}))
`], { cwd: fileURLToPath(new URL('./', import.meta.url)), encoding: 'utf8' }));
