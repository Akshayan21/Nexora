from playwright.sync_api import sync_playwright
from pathlib import Path
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
  for route in ['overview','leads','discover','campaigns','campaigns/new','inbox','analytics','settings']:
   page.goto('http://localhost:3000/'+route,wait_until='networkidle')
   overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth')
   print(width,route,'overflow='+str(overflow))
   page.screenshot(path='artifacts/design-'+route.replace('/','-')+'-'+str(width)+'.png',full_page=True)
 print('PAGE_ERRORS',errors)
 b.close()
