from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3000/overview',wait_until='load')
 page.wait_for_timeout(800)
 toggle=page.get_by_role('switch',name='Use mock data')
 if toggle.get_attribute('aria-checked')=='false': toggle.click()
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':1000 if width==1440 else 844})
  for route in ['leads','campaigns','campaigns/new','inbox','analytics']:
   page.goto('http://localhost:3000/'+route,wait_until='load')
   page.wait_for_timeout(700)
   assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),(route,width)
   page.screenshot(path='artifacts/polished-'+route.replace('/','-')+'-'+str(width)+'.png',full_page=True)
   print(width,route,'OK')
  if width==1440:
   page.get_by_label('Analytics date range').select_option('30')
   page.goto('http://localhost:3000/inbox',wait_until='load')
   page.wait_for_timeout(650)
   page.get_by_label('Your reply').fill('Layout verification draft')
   page.get_by_role('button',name='Save reply draft').click()
   assert 'Layout verification draft' in page.get_by_role('status').inner_text()
 print('PAGE_ERRORS',errors)
 assert not errors
 b.close()
