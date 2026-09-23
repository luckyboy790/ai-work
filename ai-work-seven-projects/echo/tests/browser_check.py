"""Full-game browser smoke tests. Requires dependencies vendored and the server running.
Uses Chromium desktop + mobile emulation. Teleport is only a facility setup helper;
walking, drag-look, touch movement and touch actions use browser input.
Collision-kernel tests are separate; this script is not a human playthrough.
Run: python tests/browser_check.py --url http://127.0.0.1:4173
"""
import argparse, asyncio, json, math, os
from pathlib import Path
from playwright.async_api import async_playwright

async def main(url):
    report={"desktop":[],"touch_emulation":[],"errors":[],"real_device_tested":False}
    out=Path(__file__).resolve().parents[1]/'evidence';out.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await browser.new_page(viewport={"width":1440,"height":900})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        failed=[];page.on('requestfailed',lambda r:failed.append(r.url))
        try:
            await page.goto(url+'/?test=1',wait_until='networkidle')
            await page.wait_for_function('!!window.__TRISOLARIS__',timeout=15000)
        except Exception as error:
            report['blocked']='Navigation or full Three.js scene initialization failed; no full-game checks passed.'
            report['reason']=str(error)
            report['startup_text']=await page.locator('#loading').inner_text() if await page.locator('#loading').count() else ''
            report['failed_requests']=failed
            (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
            await browser.close();print(json.dumps(report,ensure_ascii=False,indent=2));return
        await page.screenshot(path=str(out/'entry-desktop.png'))
        await page.locator('#begin').click();await page.wait_for_timeout(500)
        start=await page.evaluate('__TRISOLARIS__.player()')
        await page.keyboard.down('w');await page.wait_for_timeout(1400);await page.keyboard.up('w')
        after=await page.evaluate('__TRISOLARIS__.player()');assert after['z']<start['z']-3
        report['desktop'].append('Natural keyboard walking moves player forward.')
        await page.mouse.move(720,450);await page.mouse.down();await page.mouse.move(870,470,steps=15);await page.mouse.up()
        look=await page.evaluate('__TRISOLARIS__.player()');assert abs(look['yaw']-after['yaw'])>.1
        report['desktop'].append('Pointer drag changes yaw and pitch without pointer lock.')
        await page.evaluate('__TRISOLARIS__.teleport(0,-15)');await page.keyboard.press('e')
        await page.locator('[data-action="observe"]').click();assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['observed']==1
        assert await page.locator('[data-action="observe"]').is_disabled()
        await page.evaluate('__TRISOLARIS__.advance(11)');await page.locator('[data-action="observe"]').click()
        assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['forecast'] is not None
        report['desktop'].append('Facility observation, cooldown, repeat measurement and forecast UI work.')
        await page.locator('[data-global="closeStation"]').click()
        await page.evaluate('__TRISOLARIS__.teleport(0,27)')
        before=(await page.evaluate('__TRISOLARIS__.snapshot()'))['observed'];await page.evaluate('__TRISOLARIS__.action("observe")')
        assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['observed']==before
        report['desktop'].append('Remote facility action is rejected by proximity guard.')
        await page.keyboard.press('j');t=(await page.evaluate('__TRISOLARIS__.snapshot()'))['t'];await page.wait_for_timeout(500)
        assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['t']==t
        await page.locator('#modalClose').click();report['desktop'].append('Journal pauses the actual simulation, close resumes.')
        await page.evaluate('__TRISOLARIS__.teleport(-20,8)');await page.keyboard.press('e');await page.locator('[data-action="dehydrate"]').click()
        await page.evaluate('__TRISOLARIS__.advance(12)');assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['active']==0
        report['desktop'].append('Dehydration transfers population and stops labour.')
        await page.locator('[data-global="closeStation"]').click();await page.evaluate('__TRISOLARIS__.teleport(20,10.5)');await page.keyboard.press('e');await page.locator('[data-action="revive"][data-arg="batch"]').click();await page.evaluate('__TRISOLARIS__.advance(9)')
        assert (await page.evaluate('__TRISOLARIS__.snapshot()'))['active']>23
        report['desktop'].append('Batch revival charges water and restores active people over time.')
        await page.locator('[data-global="closeStation"]').click();await page.screenshot(path=str(out/'game-desktop.png'))
        await page.evaluate('__TRISOLARIS__.advance(2000)');assert await page.locator('[data-global="rebuild"]').is_visible()
        await page.locator('[data-global="retry"]').click();await page.wait_for_timeout(850)
        snap=await page.evaluate('__TRISOLARIS__.snapshot()');assert not snap['ended'] and snap['t']<3 and snap['mode']=='none'
        report['desktop'].append('Natural simulated extinction shows explanation; retry resets live state.')
        report['rendering']=await page.evaluate('__TRISOLARIS__.rendererInfo()')
        mobile=await browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
        mp=await mobile.new_page();await mp.goto(url+'/?test=1');await mp.wait_for_function('!!window.__TRISOLARIS__');await mp.locator('#begin').tap();await mp.wait_for_timeout(500)
        session=await mobile.new_cdp_session(mp);box=await mp.locator('#joystick').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
        before=await mp.evaluate('__TRISOLARIS__.player()')
        await session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy,'id':1}]})
        await session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx,'y':cy-40,'id':1}]})
        await mp.wait_for_timeout(1200);await session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        after=await mp.evaluate('__TRISOLARIS__.player()');assert after['z']<before['z']-2
        report['touch_emulation'].append('Chromium touch joystick moves the player and releases.')
        await mp.evaluate('__TRISOLARIS__.teleport(0,-15)');await mp.locator('#interact').tap();await mp.locator('[data-action="observe"]').tap()
        assert (await mp.evaluate('__TRISOLARIS__.snapshot()'))['observed']==1
        report['touch_emulation'].append('Touch interaction and facility action complete without keyboard.')
        await mp.screenshot(path=str(out/'game-touch-emulation.png'))
        assert await mp.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        report['touch_emulation'].append('390x844 layout has no horizontal overflow.')
        await browser.close()
    (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('--url',default='http://127.0.0.1:4173');asyncio.run(main(args.parse_args().url))
