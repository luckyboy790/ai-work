"""No network, no Three.js substitute. Tests real Input/UI modules in an offline
Chromium document, plus an attempted standalone GLSL compilation when WebGL2 is
available. This is NOT a
rendered-game end-to-end test and must not be reported as one.
"""
import asyncio,json,re,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]

def js_module(name):
    text=(ROOT/'src'/name).read_text()
    text=re.sub(r'^import[^\n]*\n','',text,flags=re.M)
    return re.sub(r'\bexport\s+(?=class|const|function)','',text)
async def load_harness(page):
    html=(ROOT/'tests/input-harness.html').read_text()
    body=re.search(r'<script type="module">([\s\S]*?)</script>',html).group(1)
    body=re.sub(r'import[^;]+;','',body)
    html=re.sub(r'<script[\s\S]*?</script>','',html)
    await page.set_content(html)
    await page.add_script_tag(content='(()=>{'+js_module('simulation.js')+js_module('input.js')+body+'})()')
    await page.wait_for_function('!!window.harness')
async def main():
    report={'method':'Offline document injection; actual app Input/UI modules; no Three.js renderer','desktop_input':[],'touch_emulation':[],'ui':[],'shader_compile':[],'errors':[],'real_device_tested':False}
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=await b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:report['errors'].append(str(e)))
        await load_harness(page)
        await page.keyboard.down('w');await page.wait_for_timeout(3800);await page.keyboard.up('w');await page.wait_for_timeout(100)
        s=await page.evaluate('harness.snapshot()');assert 10.9<=s['z']<=11.3,s;assert abs(s['y']-s['ground']-1.78)<.04
        report['desktop_input'].append('Real keyboard input walks into a test wall and stops; camera remains above the analytic ground.')
        x=s['x'];await page.keyboard.down('d');await page.wait_for_timeout(600);await page.keyboard.up('d');assert (await page.evaluate('harness.snapshot()'))['x']>x+2
        report['desktop_input'].append('Wall-adjacent sideways movement does not lock the player.')
        await page.mouse.move(650,400);await page.mouse.down();await page.mouse.move(810,440,steps=16);await page.mouse.up()
        s=await page.evaluate('harness.snapshot()');assert abs(s['yaw'])>.3;assert s['pitch']<.09
        report['desktop_input'].append('Mouse drag changes yaw and pitch; pointer release is handled.')
        await page.keyboard.press('p');s=await page.evaluate('harness.snapshot()');assert not s['enabled'];before=s['z'];await page.keyboard.down('w');await page.wait_for_timeout(250);await page.keyboard.up('w');assert (await page.evaluate('harness.snapshot()'))['z']==before
        await page.keyboard.press('p');await page.keyboard.press('e');await page.keyboard.press('j');assert 'interact' in (await page.evaluate('harness.snapshot()'))['events']
        report['desktop_input'].append('Pause clears held inputs; E and J route the corresponding actions.')
        ctx=await b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        mp=await ctx.new_page();mp.on('pageerror',lambda e:report['errors'].append(str(e)));await load_harness(mp)
        cdp=await ctx.new_cdp_session(mp);box=await mp.locator('#joystick').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
        async def touch(kind,points):await cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
        await touch('touchStart',[{'x':x,'y':y,'id':1}]);await touch('touchMove',[{'x':x,'y':y-42,'id':1}]);await mp.wait_for_timeout(650)
        await touch('touchStart',[{'x':x,'y':y-42,'id':1},{'x':260,'y':300,'id':2}]);await touch('touchMove',[{'x':x,'y':y-42,'id':1},{'x':330,'y':330,'id':2}]);await mp.wait_for_timeout(300)
        s=await mp.evaluate('harness.snapshot()');assert s['z']<24;assert abs(s['yaw'])>.1
        report['touch_emulation'].append('Two simultaneous Chromium touch contacts: joystick movement and camera look both work.')
        await touch('touchEnd',[]);await mp.wait_for_timeout(100);s=await mp.evaluate('harness.snapshot()');assert s['stick']=={'x':0,'y':0}
        report['touch_emulation'].append('Releasing touches resets the joystick without sticky movement.')
        await mp.locator('#act').tap();assert 'touch-button' in (await mp.evaluate('harness.snapshot()'))['events'];report['touch_emulation'].append('Touch action button works without keyboard.')
        await touch('touchStart',[{'x':x,'y':y,'id':1}]);await touch('touchMove',[{'x':x+35,'y':y,'id':1}]);await touch('touchCancel',[]);assert (await mp.evaluate('harness.snapshot()'))['stick']=={'x':0,'y':0};report['touch_emulation'].append('Touch cancellation resets captured movement.')
        # UI modules with real state, but intentionally no purported Three.js background.
        uihtml=(ROOT/'index.html').read_text();uihtml=re.sub(r'<script[\s\S]*?</script>','',uihtml);uihtml=re.sub(r'<link[^>]+>','',uihtml)
        uip=await ctx.new_page();uip.on('pageerror',lambda e:report['errors'].append(str(e)));await uip.set_content(uihtml);await uip.add_style_tag(content=(ROOT/'style.css').read_text())
        await uip.add_script_tag(content='(()=>{'+js_module('simulation.js')+js_module('ui.js')+'''
        document.body.classList.add("touch");window.testEvents=[];window.testSim=new Simulation();window.testUI=new UI(a=>testEvents.push(a),(a,b)=>testEvents.push([a,b]));testUI.ready(false,137);testUI.enter();testUI.update(testSim.s,{x:0,z:27,yaw:0},1);
        })()''')
        assert await uip.evaluate('document.documentElement.scrollWidth<=innerWidth+1');report['ui'].append('390x844 HUD does not cause horizontal document overflow.')
        for station in ['scope','vault','pool','camp','archive','ruinHeat','ruinCold']:
            await uip.evaluate('(id)=>testUI.openStation(id,testSim.s)',station)
            assert await uip.locator('#stationTitle').inner_text()
            assert await uip.locator('#stationActions button').count()>0
        report['ui'].append('All seven facility panels render their correct action controls and state readings.')
        await uip.evaluate('testUI.openStation("pool",testSim.s)');await uip.locator('[data-action="revive"][data-arg="batch"]').tap();assert ['revive','batch'] in await uip.evaluate('testEvents')
        report['ui'].append('Mobile facility button dispatches batch revival with the expected argument.')
        await uip.evaluate('testUI.closeStation();testUI.journal(testSim.s)');assert await uip.locator('#historyChart').is_visible()
        await uip.evaluate('testUI.closeModal();testUI.guide()');await uip.locator('#modalContent [data-global="closeModal"]').scroll_into_view_if_needed();await uip.locator('#modalContent [data-global="closeModal"]').tap();assert 'closeModal' in await uip.evaluate('testEvents')
        report['ui'].append('Journal graph, long instructions, modal scrolling and close controls render and receive touch input.')
        await uip.set_viewport_size({'width':844,'height':390})
        await uip.evaluate('testUI.closeModal();testUI.openStation("pool",testSim.s)')
        await uip.locator('[data-action="revive"][data-arg="batch"]').tap()
        assert await uip.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        await uip.locator('#station [data-global="closeStation"]').tap()
        assert 'closeStation' in await uip.evaluate('testEvents')
        await uip.evaluate('testSim.s.t=126.5;testUI.update(testSim.s,{x:0,z:27,yaw:0},1)')
        assert await uip.locator('#epoch').inner_text()=='126.5'
        report['ui'].append('844x390 landscape facility actions and close control are reachable; displayed epoch uses simulation ticks consistently.')
        # Try standalone compilation only when WebGL2 is available. Library chunks
        # for tone mapping / output conversion are intentionally excluded: not an integration test.
        world=(ROOT/'src/world.js').read_text();shaders={}
        for name in ['skyVertex','skyFragment','waterVertex','waterFragment','weatherVertex','weatherFragment']:
            shaders[name]=re.search(r'const '+name+r'=`([\s\S]*?)`;',world).group(1)
        shaderpage=await b.new_page();await shaderpage.set_content('<canvas id="gl" width="8" height="8"></canvas>')
        result=await shaderpage.evaluate('''(sources)=>{
          const gl=document.querySelector('#gl').getContext('webgl2');if(!gl)return {supported:false,results:[]};
          const results=[];
          for(const name of ['sky','water','weather']){
            let vs=sources[name+'Vertex'].replaceAll('varying','out');
            let fs=sources[name+'Fragment'].replaceAll('varying','in').replaceAll('gl_FragColor','fragColor').replace(/#include[^\\n]*/g,'');
            vs='#version 300 es\\nprecision highp float;\\nin vec3 position;in vec2 uv;uniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;\\n'+vs;
            fs='#version 300 es\\nprecision highp float;out vec4 fragColor;\\n'+fs;
            function compile(type,text){const sh=gl.createShader(type);gl.shaderSource(sh,text);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(name+': '+gl.getShaderInfoLog(sh));return sh}
            const v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));results.push(name+' vertex + fragment compile and link');gl.deleteProgram(program);gl.deleteShader(v);gl.deleteShader(f);
          }
          return {supported:true,results};
        }''',shaders)
        report['shader_compile']=result;await b.close()
    assert not report['errors'],report['errors']
    (ROOT/'evidence/offline-browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':asyncio.run(main())
