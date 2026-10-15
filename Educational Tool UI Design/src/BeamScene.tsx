import { useId, useRef, useState } from 'react';
// Temporary display-only design shape (task 1.9); replaced in task 14.4.
type Design = { kind: 'circle' | 'tube' | 'rectangle' | 'iSection'; width: number; height: number; thickness: number; rotated: boolean };

export default function BeamScene({ design, deformed, zoom, reset }: { design: Design; deformed: boolean; zoom: number; reset: number }) {
  const [angle, setAngle] = useState(.47);
  const [elevation, setElevation] = useState(Math.atan(.43));
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const clampElevation = (value: number) => Math.max(-Math.PI / 3, Math.min(Math.PI / 3, value));
  const [previousReset, setPreviousReset] = useState(reset);
  if (previousReset !== reset) { setPreviousReset(reset); setAngle(.47); setElevation(Math.atan(.43)); }
  type Point = [number,number,number];
  const wallMask = useId();
  const camera: Point = [Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),-Math.cos(angle)*Math.cos(elevation)];
  const dot = (a:Point,b:Point) => a.reduce((sum,v,i)=>sum+v*b[i],0);
  const project = ([x,y,z]: Point) => {
    const a = angle, k = zoom;
    // Orbit around the beam's midpoint, with independent yaw and elevation.
    const centeredX = x - 165;
    return [
      450+k*(centeredX*Math.cos(a)+z*Math.sin(a)),
      250+k*(-y*Math.cos(elevation)+(centeredX*Math.sin(a)-z*Math.cos(a))*Math.sin(elevation)),
    ];
  };
  const pts = (p: Point[]) => p.map(v=>project(v).join(',')).join(' ');
  const w = design.width*1.1, h = (design.kind === 'circle' || design.kind === 'tube' ? design.width : design.height)*1.1;
  const b = design.rotated ? h : w, depth = design.rotated ? w : h, t=design.thickness*1.1;
  let section: [number,number][];
  if (design.kind === 'circle' || design.kind === 'tube') section = Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/16)*b/2,Math.sin(i*Math.PI/16)*depth/2]);
  else if (design.kind === 'iSection') section = [[-b/2,-depth/2],[b/2,-depth/2],[b/2,-depth/2+t],[t/2,-depth/2+t],[t/2,depth/2-t],[b/2,depth/2-t],[b/2,depth/2],[-b/2,depth/2],[-b/2,depth/2-t],[-t/2,depth/2-t],[-t/2,-depth/2+t],[-b/2,-depth/2+t]];
  else section = [[-b/2,-depth/2],[b/2,-depth/2],[b/2,depth/2],[-b/2,depth/2]];
  const point = (x:number, s:[number,number], bend=false): Point => [x,s[1]-(bend ? 42*(x/330)**2*(3-x/330)/2:0),s[0]];
  const tip=project([330,depth/2+18,0]);
  type Surface = { points: Point[]; fill: string; stroke: string; wall?: boolean };
  const surfaces: Surface[] = [];
  const solidBox = (x:number,y:number,z:number,width:number,height:number,thickness:number,wall=false) => {
    const vertices:Point[] = [[x,y,z],[x+width,y,z],[x+width,y+height,z],[x,y+height,z],[x,y,z+thickness],[x+width,y,z+thickness],[x+width,y+height,z+thickness],[x,y+height,z+thickness]];
    const sides: { indices:number[]; normal:Point; fill:string }[] = [
      {indices:[0,4,7,3],normal:[-1,0,0],fill:'#b8c1b2'},
      {indices:[1,2,6,5],normal:[1,0,0],fill:'#cbd4c4'},
      {indices:[0,1,5,4],normal:[0,-1,0],fill:'#929f89'},
      {indices:[3,7,6,2],normal:[0,1,0],fill:'#e1e7da'},
      {indices:[0,3,2,1],normal:[0,0,-1],fill:'#acb9a0'},
      {indices:[4,5,6,7],normal:[0,0,1],fill:'#9daa93'},
    ];
    for(const side of sides){
      if(dot(side.normal,camera)>0.00001)surfaces.push({points:side.indices.map(i=>vertices[i]),fill:side.fill,stroke:'#89977e',wall});
    }
  };
  // Closed six-sided solids, with only camera-facing surfaces rendered.
  solidBox(-38,-86,-65,38,186,130,true);
  solidBox(0,-36,-36,7,72,72);
  if(camera[0]>0){
    for(const y of [-27,27])for(const z of [-27,27])surfaces.push({
      points:Array.from({length:6},(_,i)=>[8,y+4*Math.cos(i*Math.PI/3),z+4*Math.sin(i*Math.PI/3)] as Point),
      fill:'#8a9880',stroke:'#697b5e',
    });
  }
  // Short beam strips keep depth ordering correct where the beam meets the wall.
  for(let x=7;x<330;x+=17)for(let i=0;i<section.length;i++){
    const s=section[i],next=section[(i+1)%section.length];
    const normal:Point=[0,s[0]-next[0],next[1]-s[1]];
    if(dot(normal,camera)<=0)continue;
    surfaces.push({points:[point(x,s),point(Math.min(x+17,330),s),point(Math.min(x+17,330),next),point(x,next)],fill:i%3===0?'#91a99b':i%3===1?'#d7e1d7':'#bdcdbf',stroke:'none'});
  }
  if(camera[0]>0)surfaces.push({points:section.map(s=>point(330,s)),fill:'#dbe4db',stroke:'#6c8977'});
  const depthOf = (surface:Surface) => surface.points.reduce((sum,p)=>sum+dot(p,camera),0)/surface.points.length;
  return <svg className="beam-scene" viewBox="0 0 900 500" role="img" tabIndex={0} aria-label="Interactive cantilever beam. Drag horizontally or vertically, or use arrow keys, to orbit." onPointerDown={e=>{
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId};
    e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={e=>{
    const previous=drag.current;
    if(previous?.pointerId===e.pointerId){
      setAngle(a=>a+(e.clientX-previous.x)*.008);
      setElevation(value=>clampElevation(value+(e.clientY-previous.y)*.008));
      drag.current={x:e.clientX,y:e.clientY,pointerId:e.pointerId};
    }
  }} onPointerUp={e=>{
    if(drag.current?.pointerId===e.pointerId){
      drag.current=null;
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }} onPointerCancel={()=>drag.current=null} onLostPointerCapture={()=>drag.current=null} onKeyDown={e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft')setAngle(a=>a-.1);
    if(e.key==='ArrowRight')setAngle(a=>a+.1);
    if(e.key==='ArrowUp')setElevation(value=>clampElevation(value-.1));
    if(e.key==='ArrowDown')setElevation(value=>clampElevation(value+.1));
  }}>
    <defs><pattern id="floor" width="38" height="22" patternUnits="userSpaceOnUse" patternTransform="matrix(1 -.25 1 .5 -50 380)"><path d="M 38 0 L 0 0 0 22" fill="none" stroke="#d9dfd9" strokeWidth=".7"/></pattern><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M-2 9L9-2M7 11L11 7" stroke="#a4aaa3" strokeWidth="1"/></pattern><linearGradient id="metal"><stop stopColor="#b9c9c0"/><stop offset=".5" stopColor="#e2e9e2"/><stop offset="1" stopColor="#9aafa2"/></linearGradient><marker id="arrow" markerWidth="9" markerHeight="9" refX="5" refY="4" orient="auto"><path d="M0 0L7 4L0 8" fill="none" stroke="#cf744b" strokeWidth="1.6"/></marker></defs>
    <rect width="900" height="500" fill="url(#floor)" opacity=".6"/>
    <ellipse cx="508" cy="351" rx="194" ry="23" fill="#304b3c" opacity=".045"/>
    <defs><mask id={wallMask} maskUnits="userSpaceOnUse" x="0" y="0" width="900" height="500"><rect width="900" height="500" fill="white"/>{surfaces.filter(s=>s.wall).map((s,i)=><polygon key={i} points={pts(s.points)} fill="black" stroke="black" strokeWidth="1"/>)}</mask></defs>
    {surfaces.sort((a,b)=>depthOf(a)-depthOf(b)).map((surface,i)=><polygon key={i} points={pts(surface.points)} fill={surface.fill} stroke={surface.stroke} strokeWidth=".8" strokeLinejoin="round"/>)}
    {design.kind==='tube' && camera[0]>0 && <polygon points={pts(Array.from({length:32},(_,i)=>point(330,[Math.cos(i*Math.PI/16)*(b/2-t),Math.sin(i*Math.PI/16)*(depth/2-t)])))} fill="#667f6e"/>}
    {deformed && <g mask={`url(#${wallMask})`}>{section.filter((_,i)=>i%3===0).map((s,i)=><polyline key={i} points={pts(Array.from({length:25},(_,j)=>point(j*330/24,s,true)))} fill="none" stroke="#ce8c60" strokeWidth="1.4" strokeDasharray="5 4" opacity=".8"/>)}<polygon points={pts(section.map(s=>point(330,s,true)))} fill="#e5ba96" fillOpacity=".25" stroke="#ca875b" strokeDasharray="4 3"/></g>}
    <path d={`M${tip[0]} ${tip[1]-102}V${tip[1]-12}`} stroke="#cf744b" strokeWidth="2" markerEnd="url(#arrow)"/>
    <text x={tip[0]+15} y={tip[1]-75} fill="#ad5e3c" fontSize="15" fontWeight="600">300 N</text><text x={tip[0]+15} y={tip[1]-56} fill="#8d948b" fontSize="10">TIP LOAD</text>
    <polyline points={pts([[0,-100,10],[330,-100,10]])} stroke="#9ba89b" strokeWidth="1" fill="none"/>
    {[0,330].map(x=><polyline key={x} points={pts([[x,-92,10],[x,-108,10]])} stroke="#9ba89b"/>)}
    <text x={project([165,-120,10])[0]} y={project([165,-120,10])[1]} textAnchor="middle" fill="#7b877c" fontSize="12">600 mm <tspan fill="#a2aaa0">· fixed span</tspan></text>
    <g transform="translate(46 421)"><path d="M0 30V-5M0 30L33 39M0 30L-18 42" fill="none" stroke="#9ca797"/><text y="-14" x="-3" fontSize="10" fill="#758773">Y</text><text x="39" y="43" fontSize="10" fill="#758773">X</text><text x="-29" y="49" fontSize="10" fill="#758773">Z</text></g>
    <text x="450" y="473" textAnchor="middle" fill="#929a8f" fontSize="11">Drag in any direction to orbit · + / − to zoom</text>
  </svg>;
}
